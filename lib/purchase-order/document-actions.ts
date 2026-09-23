"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrl } from "@/lib/files/storage";

import {
  PoDocumentType,
  PO_DOCUMENT_TYPE_LABELS,
  PO_DOCUMENT_TYPE_BADGES,
  PoDocument,
} from "@/lib/purchase-order/document-types";

/**
 * Fetch all documents associated with a PO (combining goods_readiness uploads and direct document uploads)
 */
export async function getPoDocuments(poId: string): Promise<PoDocument[]> {
  const supabase = createAdminClient();

  const documents: PoDocument[] = [];
  const seenPaths = new Set<string>();

  // 1. Fetch from goods_readiness headers
  const { data: grList } = await supabase
    .from("goods_readiness")
    .select("id, goods_ready_date, packing_list_path, packing_list_filename, commercial_invoice_path, commercial_invoice_filename, created_at, updated_at")
    .eq("purchase_order_id", poId);

  (grList ?? []).forEach((gr) => {
    if (gr.packing_list_path && !seenPaths.has(gr.packing_list_path)) {
      seenPaths.add(gr.packing_list_path);
      documents.push({
        id: `gr-pl-${gr.id}`,
        poId,
        goodsReadinessId: gr.id,
        documentType: "PACKING_LIST",
        fileName: gr.packing_list_filename || "Packing_List.pdf",
        filePath: gr.packing_list_path,
        uploadedAt: gr.updated_at || gr.created_at,
        relatedLabel: `출고 준비 (Ready Date: ${gr.goods_ready_date})`,
        uploaderName: "공급사 (Supplier)",
      });
    }

    if (gr.commercial_invoice_path && !seenPaths.has(gr.commercial_invoice_path)) {
      seenPaths.add(gr.commercial_invoice_path);
      documents.push({
        id: `gr-ci-${gr.id}`,
        poId,
        goodsReadinessId: gr.id,
        documentType: "COMMERCIAL_INVOICE",
        fileName: gr.commercial_invoice_filename || "Commercial_Invoice.pdf",
        filePath: gr.commercial_invoice_path,
        uploadedAt: gr.updated_at || gr.created_at,
        relatedLabel: `출고 준비 (Ready Date: ${gr.goods_ready_date})`,
        uploaderName: "공급사 (Supplier)",
      });
    }
  });

  // 2. Fetch from purchase_orders activity_logs for any extra document attachments
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, po_number, activity_logs")
    .eq("id", poId)
    .single();

  const activityLogs = (po?.activity_logs as any[]) || [];
  activityLogs.forEach((log) => {
    if (log.document && log.document.filePath && !seenPaths.has(log.document.filePath)) {
      seenPaths.add(log.document.filePath);
      documents.push({
        id: log.document.id || `act-${Math.random().toString(36).substring(2, 9)}`,
        poId,
        goodsReadinessId: log.document.goodsReadinessId,
        inboundShipmentId: log.document.inboundShipmentId,
        documentType: log.document.documentType || "OTHER",
        fileName: log.document.fileName || "Document.pdf",
        filePath: log.document.filePath,
        fileSize: log.document.fileSize,
        note: log.document.note,
        uploadedBy: log.actorId,
        uploaderName: log.actor || "사용자",
        uploadedAt: log.timestamp,
        relatedLabel: log.document.relatedLabel || `발주서 (${po?.po_number || "PO"})`,
      });
    }
  });

  // 3. Resolve signed URLs for all documents
  const resolvedDocuments = await Promise.all(
    documents.map(async (doc) => {
      let signedUrl: string | null = null;
      try {
        signedUrl = await getSignedFileUrl(doc.filePath, 3600);
      } catch {
        // Fallback null
      }
      return {
        ...doc,
        signedUrl,
      };
    })
  );

  return resolvedDocuments.sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
}

/**
 * Upload a PO / Shipping document
 */
export async function uploadPoDocument(formData: FormData) {
  const poId = formData.get("poId") as string;
  const documentType = (formData.get("documentType") as PoDocumentType) || "OTHER";
  const relatedType = (formData.get("relatedType") as "PO" | "GOODS_READY" | "SHIPMENT") || "PO";
  const relatedId = formData.get("relatedId") as string | null;
  const note = formData.get("note") as string | null;
  const file = formData.get("file") as File | null;

  if (!poId || !file) {
    throw new Error("필수 파라미터(발주 ID 또는 첨부 파일)가 누락되었습니다.");
  }

  // Verify file size (20MB)
  const maxBytes = 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("파일 크기는 최대 20MB를 초과할 수 없습니다.");
  }

  const supabase = createAdminClient();

  // Get PO details
  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .select("id, po_number, supplier_id, activity_logs")
    .eq("id", poId)
    .single();

  if (poErr || !po) {
    throw new Error("발주서를 찾을 수 없습니다.");
  }

  // Upload to company-uploads bucket
  const fileExt = file.name.split(".").pop() || "pdf";
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `po-documents/${poId}/${Date.now()}-${cleanFileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabase.storage
    .from("company-uploads")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`파일 업로드 실패: ${uploadErr.message}`);
  }

  // If this is packing list or commercial invoice and linked to goods_readiness, sync to goods_readiness
  if (relatedType === "GOODS_READY" && relatedId) {
    if (documentType === "PACKING_LIST") {
      await supabase
        .from("goods_readiness")
        .update({
          packing_list_path: storagePath,
          packing_list_filename: file.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", relatedId);
    } else if (documentType === "COMMERCIAL_INVOICE") {
      await supabase
        .from("goods_readiness")
        .update({
          commercial_invoice_path: storagePath,
          commercial_invoice_filename: file.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", relatedId);
    }
  }

  // Log in PO activity_logs
  const timestamp = new Date().toISOString();
  const typeLabel = PO_DOCUMENT_TYPE_LABELS[documentType] || documentType;
  const relatedLabel =
    relatedType === "GOODS_READY"
      ? "출고 준비 서류"
      : relatedType === "SHIPMENT"
      ? "선적물 서류"
      : `발주서 (${po.po_number})`;

  const docRecord = {
    id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    documentType,
    fileName: file.name,
    filePath: storagePath,
    fileSize: file.size,
    goodsReadinessId: relatedType === "GOODS_READY" ? relatedId : null,
    inboundShipmentId: relatedType === "SHIPMENT" ? relatedId : null,
    relatedLabel,
    note: note || null,
  };

  const updatedLogs = [
    ...((po.activity_logs as any[]) || []),
    {
      event: "DOCUMENT_UPLOADED",
      actor: "사용자",
      actorId: null,
      timestamp,
      description: `[증빙 서류 등록] ${typeLabel} (${file.name}) 서류가 등록되었습니다.${note ? ` (메모: ${note})` : ""}`,
      document: docRecord,
    },
  ];

  await supabase
    .from("purchase_orders")
    .update({
      activity_logs: updatedLogs,
      updated_at: timestamp,
    })
    .eq("id", poId);

  revalidatePath(`/admin/purchasing/${poId}`);
  revalidatePath(`/portal/orders/purchase-orders/${poId}`);

  return { success: true, document: docRecord };
}
