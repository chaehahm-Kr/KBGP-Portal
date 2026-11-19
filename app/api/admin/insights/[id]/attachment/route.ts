import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstageFormData } from "@/lib/files/staged-upload";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  INSIGHTS_PDF_STORAGE_BUCKET,
  type InsightPdfAttachment,
  buildContentDispositionHeader,
  buildSafeInsightPdfStoragePath,
  computeSha256Hex,
  extractPdfAttachment,
  inspectAndValidatePdfBuffer,
  isSafeInsightPdfStoragePath,
  removePdfAttachmentFromVisuals,
  upsertPdfAttachmentInVisuals,
} from "@/lib/insights/pdf-attachments";

export const dynamic = "force-dynamic";

async function isStoragePathUsedByOtherArticles(
  adminDb: ReturnType<typeof createAdminClient>,
  currentArticleId: string,
  storagePath: string
): Promise<boolean> {
  const { data: rows } = await adminDb
    .from("insights_articles")
    .select("id, visuals")
    .neq("id", currentArticleId);

  if (!rows) return false;
  for (const row of rows) {
    if (!Array.isArray(row.visuals)) continue;
    for (const v of row.visuals) {
      if (v && typeof v === "object" && v.storage_path === storagePath) {
        return true;
      }
    }
  }
  return false;
}

async function appendVersionHistory(
  adminDb: ReturnType<typeof createAdminClient>,
  articleId: string,
  changedBy: string,
  changeType: string,
  reviewNote: string,
  snapshot: any
) {
  try {
    const { data: latest } = await adminDb
      .from("insights_version_history")
      .select("version_number")
      .eq("article_id", articleId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latest?.version_number || 0) + 1;
    await adminDb.from("insights_version_history").insert({
      article_id: articleId,
      version_number: nextVersion,
      changed_by: changedBy,
      change_type: changeType,
      review_note: reviewNote,
      snapshot,
    });
  } catch (err) {
    console.warn("Insights attachment version history warning:", err);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const adminDb = createAdminClient();

  const { data: article, error } = await adminDb
    .from("insights_articles")
    .select("id, slug, visuals")
    .eq("id", id)
    .single();

  if (error || !article) {
    return NextResponse.json({ error: "Insight article not found." }, { status: 404 });
  }

  const attachment = extractPdfAttachment(article.visuals);
  if (!attachment || !isSafeInsightPdfStoragePath(attachment.storage_path)) {
    return NextResponse.json({ error: "No PDF attachment associated with this article." }, { status: 404 });
  }

  const { data: blob, error: dlError } = await adminDb.storage
    .from(INSIGHTS_PDF_STORAGE_BUCKET)
    .download(attachment.storage_path);

  if (dlError || !blob) {
    return NextResponse.json(
      { error: "PDF file is missing from storage.", missing_storage: true },
      { status: 404 }
    );
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const actualSha = computeSha256Hex(buf);
  if (attachment.sha256 && actualSha !== attachment.sha256) {
    return NextResponse.json(
      { error: "PDF checksum verification failed.", expected: attachment.sha256, actual: actualSha },
      { status: 500 }
    );
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buf.byteLength),
      "Content-Disposition": buildContentDispositionHeader(attachment.file_name),
      "X-Content-SHA256": actualSha,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const adminDb = createAdminClient();

    const { data: existingArticle, error: fetchErr } = await adminDb
      .from("insights_articles")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existingArticle) {
      return NextResponse.json({ error: "Insight article not found." }, { status: 404 });
    }

    const formData = await unstageFormData(await request.formData());
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "PDF 파일을 선택해 주세요." }, { status: 400 });
    }

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const inspected = await inspectAndValidatePdfBuffer(rawBuffer, file.name);
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 400 });
    }

    const storagePath = buildSafeInsightPdfStoragePath(id, inspected.sha256);
    const { error: uploadErr } = await adminDb.storage
      .from(INSIGHTS_PDF_STORAGE_BUCKET)
      .upload(storagePath, rawBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadErr) {
      console.error("Insight PDF upload error:", uploadErr);
      return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    // Read back or verify checksum integrity directly
    const prevAttachment = extractPdfAttachment(existingArticle.visuals);
    const defaultTitleKo =
      (formData.get("card_title_ko") as string)?.trim() ||
      prevAttachment?.card_title_ko ||
      file.name.replace(/\.pdf$/i, "") + " PDF";
    const defaultTitleEn =
      (formData.get("card_title_en") as string)?.trim() ||
      prevAttachment?.card_title_en ||
      "Download PDF Guide";
    const defaultDescKo =
      (formData.get("card_description_ko") as string)?.trim() ||
      prevAttachment?.card_description_ko ||
      `${inspected.pageCount}페이지 | PDF 가이드`;
    const defaultDescEn =
      (formData.get("card_description_en") as string)?.trim() ||
      prevAttachment?.card_description_en ||
      `${inspected.pageCount} Pages | Practical PDF Guide`;
    const buttonKo =
      (formData.get("button_label_ko") as string)?.trim() ||
      prevAttachment?.button_label_ko ||
      "무료 PDF 다운로드";
    const buttonEn =
      (formData.get("button_label_en") as string)?.trim() ||
      prevAttachment?.button_label_en ||
      "Download Free PDF";

    const nextAttachment: InsightPdfAttachment = {
      asset_id: `pdf-${crypto.randomUUID().slice(0, 8)}`,
      asset_type: "PDF_GUIDE",
      article_id: id,
      file_name: file.name,
      mime_type: "application/pdf",
      file_size: inspected.byteLength,
      page_count: inspected.pageCount,
      sha256: inspected.sha256,
      storage_bucket: INSIGHTS_PDF_STORAGE_BUCKET,
      storage_path: storagePath,
      card_title_ko: defaultTitleKo,
      card_title_en: defaultTitleEn,
      card_description_ko: defaultDescKo,
      card_description_en: defaultDescEn,
      button_label_ko: buttonKo,
      button_label_en: buttonEn,
      uploaded_at: new Date().toISOString(),
      uploaded_by: auth.email,
      status: "APPROVED",
    };

    const updatedVisuals = upsertPdfAttachmentInVisuals(existingArticle.visuals, nextAttachment);
    const { data: updatedArticle, error: updateErr } = await adminDb
      .from("insights_articles")
      .update({
        visuals: updatedVisuals,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr || !updatedArticle) {
      // Roll back newly uploaded object on DB update failure
      await adminDb.storage.from(INSIGHTS_PDF_STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json(
        { error: updateErr?.message || "Failed to save PDF metadata on article." },
        { status: 500 }
      );
    }

    // Safely clean up previous storage object ONLY if unused by any other article
    if (
      prevAttachment &&
      prevAttachment.storage_path !== storagePath &&
      isSafeInsightPdfStoragePath(prevAttachment.storage_path)
    ) {
      const usedElsewhere = await isStoragePathUsedByOtherArticles(
        adminDb,
        id,
        prevAttachment.storage_path
      );
      if (!usedElsewhere) {
        await adminDb.storage
          .from(INSIGHTS_PDF_STORAGE_BUCKET)
          .remove([prevAttachment.storage_path]);
      }
    }

    await appendVersionHistory(
      adminDb,
      id,
      auth.email,
      prevAttachment ? "ATTACHMENT_REPLACED" : "ATTACHMENT_UPLOADED",
      `${prevAttachment ? "Replaced" : "Attached"} PDF "${file.name}" (${inspected.pageCount}p, ${inspected.byteLength} bytes, sha256=${inspected.sha256.slice(0, 16)}...)`,
      updatedArticle
    );

    return NextResponse.json({
      success: true,
      attachment: nextAttachment,
      article: updatedArticle,
    });
  } catch (err: any) {
    console.error("POST /api/admin/insights/[id]/attachment exception:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload PDF attachment." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const adminDb = createAdminClient();

  const { data: existingArticle, error } = await adminDb
    .from("insights_articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !existingArticle) {
    return NextResponse.json({ error: "Insight article not found." }, { status: 404 });
  }

  const current = extractPdfAttachment(existingArticle.visuals);
  if (!current) {
    return NextResponse.json({ error: "No PDF attachment exists to update." }, { status: 404 });
  }

  const updatedAttachment: InsightPdfAttachment = {
    ...current,
    card_title_ko: typeof body.card_title_ko === "string" ? body.card_title_ko.trim() : current.card_title_ko,
    card_title_en: typeof body.card_title_en === "string" ? body.card_title_en.trim() : current.card_title_en,
    card_description_ko:
      typeof body.card_description_ko === "string"
        ? body.card_description_ko.trim()
        : current.card_description_ko,
    card_description_en:
      typeof body.card_description_en === "string"
        ? body.card_description_en.trim()
        : current.card_description_en,
    button_label_ko:
      typeof body.button_label_ko === "string" ? body.button_label_ko.trim() : current.button_label_ko,
    button_label_en:
      typeof body.button_label_en === "string" ? body.button_label_en.trim() : current.button_label_en,
  };

  const updatedVisuals = upsertPdfAttachmentInVisuals(existingArticle.visuals, updatedAttachment);
  const { data: updatedArticle, error: updateErr } = await adminDb
    .from("insights_articles")
    .update({
      visuals: updatedVisuals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedArticle) {
    return NextResponse.json({ error: updateErr?.message || "Update failed." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    attachment: updatedAttachment,
    article: updatedArticle,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const adminDb = createAdminClient();

  const { data: existingArticle, error } = await adminDb
    .from("insights_articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !existingArticle) {
    return NextResponse.json({ error: "Insight article not found." }, { status: 404 });
  }

  const prevAttachment = extractPdfAttachment(existingArticle.visuals);
  if (!prevAttachment) {
    return NextResponse.json({ success: true, removed: false });
  }

  const updatedVisuals = removePdfAttachmentFromVisuals(existingArticle.visuals);
  const { data: updatedArticle, error: updateErr } = await adminDb
    .from("insights_articles")
    .update({
      visuals: updatedVisuals,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedArticle) {
    return NextResponse.json({ error: updateErr?.message || "Failed to remove attachment." }, { status: 500 });
  }

  if (isSafeInsightPdfStoragePath(prevAttachment.storage_path)) {
    const usedElsewhere = await isStoragePathUsedByOtherArticles(
      adminDb,
      id,
      prevAttachment.storage_path
    );
    if (!usedElsewhere) {
      await adminDb.storage
        .from(INSIGHTS_PDF_STORAGE_BUCKET)
        .remove([prevAttachment.storage_path]);
    }
  }

  await appendVersionHistory(
    adminDb,
    id,
    auth.email,
    "ATTACHMENT_REMOVED",
    `Removed PDF attachment "${prevAttachment.file_name}"`,
    updatedArticle
  );

  return NextResponse.json({
    success: true,
    removed: true,
    article: updatedArticle,
  });
}
