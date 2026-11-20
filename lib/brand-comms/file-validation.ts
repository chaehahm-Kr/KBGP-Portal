import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import type { ResourceFileType } from "./types";

export const BRAND_COMMS_STORAGE_BUCKET = "company-uploads";
export const BRAND_COMMS_STORAGE_PREFIX = "brand-comms/";
export const MAX_BRAND_COMMS_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface ValidatedBrandCommsFile {
  fileType: ResourceFileType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  pageCount: number | null;
}

const MIME_BY_TYPE: Record<ResourceFileType, string[]> = {
  PDF: ["application/pdf", "application/octet-stream"],
  XLSX: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "application/zip",
  ],
  DOCX: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "application/zip",
  ],
};

const CANONICAL_MIME: Record<ResourceFileType, string> = {
  PDF: "application/pdf",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || "document";
  return base.replace(/[\r\n\0"<>|:*?]/g, "").trim() || "document";
}

export function detectFileTypeFromExtension(fileName: string): ResourceFileType | null {
  const lower = fileName.toLowerCase().trim();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".xlsx")) return "XLSX";
  if (lower.endsWith(".docx")) return "DOCX";
  return null;
}

export function hasPdfMagicHeader(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  return buf.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function hasZipMagicHeader(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

export async function validateBrandCommsUpload(
  buf: Buffer,
  originalFileName: string,
  declaredMimeType?: string | null
): Promise<{ ok: true; meta: ValidatedBrandCommsFile } | { ok: false; error: string }> {
  const safeName = sanitizeFileName(originalFileName);
  const fileType = detectFileTypeFromExtension(safeName);
  if (!fileType) {
    return {
      ok: false,
      error: "지원되는 파일 형식은 PDF, XLSX, DOCX입니다. (Only PDF, XLSX, DOCX files are allowed.)",
    };
  }

  if (buf.length === 0) {
    return { ok: false, error: "빈 파일은 업로드할 수 없습니다." };
  }

  if (buf.length > MAX_BRAND_COMMS_FILE_BYTES) {
    return {
      ok: false,
      error: "파일 크기가 최대 허용 용량(25MB)을 초과했습니다.",
    };
  }

  const normalizedMime = (declaredMimeType || "").toLowerCase().trim();
  if (normalizedMime && !MIME_BY_TYPE[fileType].includes(normalizedMime)) {
    return {
      ok: false,
      error: `MIME 타입(${normalizedMime})이 ${fileType} 확장자와 일치하지 않습니다.`,
    };
  }

  let pageCount: number | null = null;
  if (fileType === "PDF") {
    if (!hasPdfMagicHeader(buf)) {
      return {
        ok: false,
        error: "유효한 PDF 파일 시그니처(%PDF-)가 아닙니다.",
      };
    }
    try {
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      pageCount = doc.getPageCount();
      if (!pageCount || pageCount < 1) {
        return { ok: false, error: "PDF 페이지 정보를 확인할 수 없습니다." };
      }
    } catch {
      return { ok: false, error: "손상되었거나 읽을 수 없는 PDF 파일입니다." };
    }
  } else {
    // XLSX & DOCX are OpenXML ZIP archives
    if (!hasZipMagicHeader(buf)) {
      return {
        ok: false,
        error: `유효한 ${fileType} 파일 시그니처(OpenXML ZIP)가 아닙니다.`,
      };
    }
  }

  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  return {
    ok: true,
    meta: {
      fileType,
      fileName: safeName,
      mimeType: CANONICAL_MIME[fileType],
      fileSize: buf.length,
      sha256,
      pageCount,
    },
  };
}

export function buildBrandCommsStoragePath(
  scope: "announcements" | "resources",
  entityId: string,
  sha256: string,
  fileType: ResourceFileType
): string {
  const ext = fileType.toLowerCase();
  const nonce = crypto.randomBytes(6).toString("hex");
  return `${BRAND_COMMS_STORAGE_PREFIX}${scope}/${entityId}/${sha256.slice(0, 12)}_${nonce}.${ext}`;
}

export function isValidBrandCommsStoragePath(storagePath: string | null | undefined): boolean {
  if (!storagePath || typeof storagePath !== "string") return false;
  if (storagePath.includes("..")) return false;
  return storagePath.startsWith(BRAND_COMMS_STORAGE_PREFIX);
}

export function buildDownloadContentDisposition(fileName: string): string {
  const safe = sanitizeFileName(fileName);
  const asciiFallback = safe.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'") || "download";
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
