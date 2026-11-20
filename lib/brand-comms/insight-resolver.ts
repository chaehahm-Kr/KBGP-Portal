import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractPdfAttachment,
  INSIGHTS_PDF_STORAGE_BUCKET,
  isSafeInsightPdfStoragePath,
} from "@/lib/insights/pdf-attachments";
import { PUBLIC_WEBSITE_BASE_URL } from "./types";

export interface ResolvedLinkedInsightPdf {
  insightId: string;
  slug: string;
  titleKo: string;
  titleEn: string | null;
  insightStatus: string;
  publicUrl: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  pageCount: number;
}

/**
 * Resolves a LINKED_INSIGHT_PDF resource dynamically against the existing
 * authoritative insights_articles.visuals PDF attachment (zero file copy).
 */
export async function resolveLinkedInsightPdf(
  linkedInsightId: string | null | undefined
): Promise<ResolvedLinkedInsightPdf | null> {
  if (!linkedInsightId) return null;
  const adminDb = createAdminClient();
  const { data: article, error } = await adminDb
    .from("insights_articles")
    .select("id, slug, title_ko, title_en, status, visuals")
    .eq("id", linkedInsightId)
    .maybeSingle();

  if (error || !article) return null;

  const pdf = extractPdfAttachment(article.visuals);
  if (!pdf || !isSafeInsightPdfStoragePath(pdf.storage_path)) return null;

  return {
    insightId: article.id,
    slug: article.slug,
    titleKo: article.title_ko || "",
    titleEn: article.title_en || null,
    insightStatus: article.status || "DRAFT",
    publicUrl: `${PUBLIC_WEBSITE_BASE_URL.replace(/\/$/, "")}/insights/${encodeURIComponent(article.slug)}`,
    bucket: INSIGHTS_PDF_STORAGE_BUCKET,
    storagePath: pdf.storage_path,
    fileName: pdf.file_name,
    mimeType: pdf.mime_type || "application/pdf",
    fileSize: pdf.file_size,
    sha256: pdf.sha256,
    pageCount: pdf.page_count,
  };
}
