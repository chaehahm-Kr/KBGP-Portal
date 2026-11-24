import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { requirePortalApiCompanyContext } from "@/lib/brand-comms/portal-auth";
import { unstageFormData } from "@/lib/files/staged-upload";
import {
  COMPLIANCE_DOCUMENT_CATEGORIES,
  type ComplianceDocumentCategory,
} from "@/lib/compliance/v1-types";
import { requireComplianceV1MutationAllowed } from "@/lib/compliance/v1-feature-gate";

export const dynamic = "force-dynamic";

const BUCKET = "company-uploads";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".docx"];

async function resolveApiCaller() {
  const adminAuth = await requireAdminApiSession();
  if (adminAuth.ok) {
    return { isAdmin: true as const, userId: adminAuth.userId, companyId: null as string | null };
  }
  const portalAuth = await requirePortalApiCompanyContext();
  if (portalAuth.ok) {
    return { isAdmin: false as const, userId: portalAuth.userId, companyId: portalAuth.companyId };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const caller = await resolveApiCaller();
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetType = String(searchParams.get("target_type") || "").toUpperCase();
  const targetId = String(searchParams.get("target_id") || "").trim();

  if (!targetId || (targetType !== "FACILITY" && targetType !== "PRODUCT")) {
    return NextResponse.json(
      { error: "target_type (FACILITY|PRODUCT) and target_id are required." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let query = admin
    .from("compliance_evidence_documents")
    .select("id, company_id, target_type, facility_id, product_id, document_category, file_name, mime_type, file_size, sha256, storage_path, created_at, uploaded_by")
    .eq("target_type", targetType)
    .order("created_at", { ascending: false });

  if (targetType === "FACILITY") {
    query = query.eq("facility_id", targetId);
  } else {
    query = query.eq("product_id", targetId);
  }

  if (!caller.isAdmin && caller.companyId) {
    query = query.eq("company_id", caller.companyId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({ documents: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const docs = data || [];
  const signedDocs = await Promise.all(
    docs.map(async (doc) => {
      let downloadUrl: string | null = null;
      if (doc.storage_path) {
        const { data: signed } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 3600);
        downloadUrl = signed?.signedUrl || null;
      }
      return { ...doc, download_url: downloadUrl };
    })
  );

  return NextResponse.json({ documents: signedDocs }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const gate = requireComplianceV1MutationAllowed();
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.error, errorCode: gate.errorCode }, { status: 403 });
  }

  const caller = await resolveApiCaller();
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rawFd = await req.formData();
    const fd = await unstageFormData(rawFd);
    const file = fd.get("file");
    const targetType = String(fd.get("target_type") || "").toUpperCase();
    const targetId = String(fd.get("target_id") || "").trim();
    const category = String(fd.get("document_category") || "OTHER").toUpperCase() as ComplianceDocumentCategory;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일을 선택해 주세요." }, { status: 400 });
    }
    if (targetType !== "FACILITY" && targetType !== "PRODUCT") {
      return NextResponse.json({ error: "target_type must be FACILITY or PRODUCT." }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ error: "target_id is required." }, { status: 400 });
    }
    if (!COMPLIANCE_DOCUMENT_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid document_category." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const ext = ALLOWED_EXTS.find((e) => lowerName.endsWith(e));
    if (!ext) {
      return NextResponse.json(
        { error: "지원되는 파일 형식: PDF, PNG, JPG, WEBP, XLSX, DOCX" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "파일 크기는 1B ~ 20MB 이내여야 합니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    let ownerCompanyId: string | null = null;
    if (targetType === "FACILITY") {
      const { data: fac } = await admin
        .from("company_shipping_origins")
        .select("id, company_id")
        .eq("id", targetId)
        .maybeSingle();
      ownerCompanyId = fac?.company_id || null;
    } else {
      const { data: prod } = await admin
        .from("products")
        .select("id, brands!inner(company_id)")
        .eq("id", targetId)
        .maybeSingle();
      ownerCompanyId = (prod as any)?.brands?.company_id || null;
    }

    if (!ownerCompanyId) {
      return NextResponse.json({ error: "Target facility or product not found." }, { status: 404 });
    }
    if (!caller.isAdmin && caller.companyId !== ownerCompanyId) {
      return NextResponse.json({ error: "Forbidden: Cross-company upload blocked." }, { status: 403 });
    }

    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    const nonce = crypto.randomBytes(6).toString("hex");
    const storagePath = `compliance-evidence/${ownerCompanyId}/${targetType.toLowerCase()}/${targetId}/${sha256.slice(0, 12)}_${nonce}${ext}`;

    const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
    }

    const { data: doc, error: dbErr } = await admin
      .from("compliance_evidence_documents")
      .insert({
        company_id: ownerCompanyId,
        target_type: targetType,
        facility_id: targetType === "FACILITY" ? targetId : null,
        product_id: targetType === "PRODUCT" ? targetId : null,
        document_category: category,
        storage_path: storagePath,
        file_name: file.name.replace(/[\r\n\0"<>|:*?]/g, "").trim() || `evidence${ext}`,
        mime_type: file.type || "application/octet-stream",
        file_size: buf.length,
        sha256,
        uploaded_by: caller.userId,
      })
      .select("id, target_type, facility_id, product_id, document_category, file_name, mime_type, file_size, sha256, created_at")
      .single();

    if (dbErr || !doc) {
      await admin.storage.from(BUCKET).remove([storagePath]);
      return NextResponse.json({ error: dbErr?.message || "Failed to save document metadata." }, { status: 500 });
    }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}
