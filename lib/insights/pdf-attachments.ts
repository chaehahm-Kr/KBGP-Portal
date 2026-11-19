import crypto from "crypto";
import { PDFDocument } from "pdf-lib";

export const INSIGHTS_PDF_STORAGE_BUCKET = "company-uploads";
export const INSIGHTS_PDF_STORAGE_PREFIX = "insights-guides/";
export const INSIGHTS_PDF_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export interface InsightPdfAttachment {
  asset_id: string;
  asset_type: "PDF_GUIDE";
  article_id: string;
  file_name: string;
  mime_type: "application/pdf";
  file_size: number;
  page_count: number;
  sha256: string;
  storage_bucket: string;
  storage_path: string;
  card_title_ko: string;
  card_title_en: string;
  card_description_ko: string;
  card_description_en: string;
  button_label_ko: string;
  button_label_en: string;
  uploaded_at: string;
  uploaded_by: string;
  status: "APPROVED";
}

export interface PublicInsightPdfAttachment {
  available: boolean;
  file_name: string;
  mime_type: "application/pdf";
  file_size: number;
  page_count: number;
  sha256: string;
  card_title_ko: string;
  card_title_en: string;
  card_description_ko: string;
  card_description_en: string;
  button_label_ko: string;
  button_label_en: string;
  download_path: string;
}

const SAFE_STORAGE_PATH_RE = /^insights-guides\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+\.pdf$/;

export function isSafeInsightPdfStoragePath(storagePath: unknown): storagePath is string {
  if (typeof storagePath !== "string") return false;
  if (!storagePath.startsWith(INSIGHTS_PDF_STORAGE_PREFIX)) return false;
  if (storagePath.includes("..") || storagePath.includes("\\") || storagePath.includes("\0") || storagePath.includes("//")) {
    return false;
  }
  return SAFE_STORAGE_PATH_RE.test(storagePath);
}

export function buildSafeInsightPdfStoragePath(articleId: string, sha256: string): string {
  const cleanArticleId = articleId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanArticleId) {
    throw new Error("Invalid article ID for storage path.");
  }
  const shaPrefix = sha256.replace(/[^a-f0-9]/gi, "").slice(0, 16).toLowerCase();
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${INSIGHTS_PDF_STORAGE_PREFIX}${cleanArticleId}/${shaPrefix}_${nonce}.pdf`;
}

export function computeSha256Hex(buffer: Uint8Array | Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function inspectAndValidatePdfBuffer(
  rawBuffer: Buffer,
  fileName: string
): Promise<
  | { ok: true; pageCount: number; sha256: string; byteLength: number }
  | { ok: false; error: string }
> {
  if (!fileName || !fileName.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "PDF(.pdf) 파일만 업로드할 수 있습니다." };
  }
  if (!rawBuffer || rawBuffer.byteLength === 0) {
    return { ok: false, error: "업로드된 PDF 파일이 비어 있습니다." };
  }
  if (rawBuffer.byteLength > INSIGHTS_PDF_MAX_BYTES) {
    return { ok: false, error: "PDF 파일 크기는 25MB를 초과할 수 없습니다." };
  }

  // Verify %PDF- magic header (0x25 0x50 0x44 0x46 0x2D)
  if (
    rawBuffer.byteLength < 8 ||
    rawBuffer[0] !== 0x25 ||
    rawBuffer[1] !== 0x50 ||
    rawBuffer[2] !== 0x44 ||
    rawBuffer[3] !== 0x46 ||
    rawBuffer[4] !== 0x2d
  ) {
    return { ok: false, error: "유효한 PDF 파일 헤더(%PDF-)가 아닙니다." };
  }

  try {
    const pdfDoc = await PDFDocument.load(rawBuffer, { updateMetadata: false });
    const pageCount = pdfDoc.getPageCount();
    if (!Number.isInteger(pageCount) || pageCount < 1) {
      return { ok: false, error: "페이지 수가 0인 손상된 PDF 파일입니다." };
    }
    const sha256 = computeSha256Hex(rawBuffer);
    return {
      ok: true,
      pageCount,
      sha256,
      byteLength: rawBuffer.byteLength,
    };
  } catch {
    return {
      ok: false,
      error: "PDF 파일 구조를 읽을 수 없거나 암호화·손상된 파일입니다.",
    };
  }
}

export function extractPdfAttachment(visuals: unknown): InsightPdfAttachment | null {
  if (!Array.isArray(visuals)) return null;
  const found = visuals.find(
    (item: any) =>
      item &&
      typeof item === "object" &&
      item.asset_type === "PDF_GUIDE" &&
      isSafeInsightPdfStoragePath(item.storage_path)
  );
  if (!found) return null;

  return {
    asset_id: String(found.asset_id || `pdf-${found.article_id || "guide"}`),
    asset_type: "PDF_GUIDE",
    article_id: String(found.article_id || ""),
    file_name: String(found.file_name || "guide.pdf"),
    mime_type: "application/pdf",
    file_size: Number(found.file_size || 0),
    page_count: Number(found.page_count || 0),
    sha256: String(found.sha256 || ""),
    storage_bucket: String(found.storage_bucket || INSIGHTS_PDF_STORAGE_BUCKET),
    storage_path: found.storage_path,
    card_title_ko: String(found.card_title_ko || found.file_name || "PDF 가이드 다운로드"),
    card_title_en: String(found.card_title_en || found.card_title_ko || "Download PDF Guide"),
    card_description_ko: String(found.card_description_ko || `${found.page_count || ""}페이지`),
    card_description_en: String(found.card_description_en || found.card_description_ko || ""),
    button_label_ko: String(found.button_label_ko || "무료 PDF 다운로드"),
    button_label_en: String(found.button_label_en || "Download Free PDF"),
    uploaded_at: String(found.uploaded_at || new Date().toISOString()),
    uploaded_by: String(found.uploaded_by || "Admin"),
    status: "APPROVED",
  };
}

export function upsertPdfAttachmentInVisuals(
  visuals: unknown,
  attachment: InsightPdfAttachment
): any[] {
  const existing = Array.isArray(visuals)
    ? visuals.filter((item: any) => !(item && typeof item === "object" && item.asset_type === "PDF_GUIDE"))
    : [];
  return [...existing, attachment];
}

export function removePdfAttachmentFromVisuals(visuals: unknown): any[] {
  if (!Array.isArray(visuals)) return [];
  return visuals.filter((item: any) => !(item && typeof item === "object" && item.asset_type === "PDF_GUIDE"));
}

export function toPublicPdfAttachment(
  attachment: InsightPdfAttachment | null,
  slug: string,
  available = true
): PublicInsightPdfAttachment | null {
  if (!attachment) return null;
  return {
    available,
    file_name: attachment.file_name,
    mime_type: "application/pdf",
    file_size: attachment.file_size,
    page_count: attachment.page_count,
    sha256: attachment.sha256,
    card_title_ko: attachment.card_title_ko,
    card_title_en: attachment.card_title_en,
    card_description_ko: attachment.card_description_ko,
    card_description_en: attachment.card_description_en,
    button_label_ko: attachment.button_label_ko,
    button_label_en: attachment.button_label_en,
    download_path: `/api/insights/download/${encodeURIComponent(slug)}`,
  };
}

export function buildContentDispositionHeader(originalFileName: string): string {
  const safeBase = originalFileName
    .replace(/[\r\n"]/g, "")
    .trim() || "K-SELECT-Guide.pdf";
  const asciiFallback =
    safeBase
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/[\\/:*?"<>|;]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "K-SELECT-Guide.pdf";
  const encodedUtf8 = encodeURIComponent(safeBase).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`;
}

function getPreviewSigningSecret(): string | null {
  const secret =
    process.env.INQUIRY_INTAKE_SECRET ||
    process.env.INSIGHTS_PREVIEW_SECRET ||
    "";
  return secret.trim() ? secret.trim() : null;
}

export function createInsightPreviewToken(articleId: string, slug: string): string | null {
  const secret = getPreviewSigningSecret();
  if (!secret || !articleId || !slug) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(`ksn-insight-preview-v1:${articleId}:${slug}`)
    .digest("hex");
}

export function verifyInsightPreviewToken(
  articleId: string,
  slug: string,
  candidateToken: string | null | undefined
): boolean {
  if (!candidateToken || typeof candidateToken !== "string") return false;
  const expected = createInsightPreviewToken(articleId, slug);
  if (!expected) return false;
  const candBuf = Buffer.from(candidateToken.trim(), "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (candBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(candBuf, expBuf);
}
