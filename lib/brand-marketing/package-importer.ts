import JSZip from "jszip";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeEmailHtml, convertHtmlToPlainText } from "./template-parser";
import { detectExistingFooterInHtml } from "./marketing-footer";

export interface ExtractedAssetItem {
  originalPath: string;
  hostedUrl: string;
  byteSize: number;
  contentType: string;
}

export interface PackageImportResult {
  isValid: boolean;
  htmlContent: string;
  plainText: string;
  detectedHtmlFiles: string[];
  selectedHtmlFile: string;
  extractedAssets: ExtractedAssetItem[];
  unresolvedImages: string[];
  warnings: string[];
  errors: string[];
  hasExistingFooter: boolean;
  existingFooterSnippet?: string;
}

const ALLOWED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const MAX_ZIP_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_ENTRIES = 100;

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".html":
    case ".htm":
      return "text/html; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

// In-memory fallback asset store for local development or if storage bucket is unreachable
export const memoryAssetStore = new Map<string, { buffer: Buffer; contentType: string }>();

/**
 * Stores an asset to Supabase Storage or memory store and returns its public URL.
 */
async function hostTemplateAsset(
  templateId: string,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const assetKey = `templates/${templateId}/${cleanFilename}`;

  // Cache in memory for instant local & proxy fallback
  memoryAssetStore.set(assetKey, { buffer, contentType });

  const adminUrl = (
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://admin.kselectnetwork.com"
  ).replace(/\/$/, "");

  const hostedProxyUrl = `${adminUrl}/api/marketing/assets/${assetKey}`;

  try {
    const admin = createAdminClient();
    const storagePath = `marketing/${assetKey}`;

    const { error } = await admin.storage
      .from("company-uploads")
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.warn("[package-importer:storage] Storage upload warning (using proxy URL):", error.message);
    }
  } catch (err: any) {
    console.warn("[package-importer:storage] Storage upload exception (using proxy URL):", err.message);
  }

  return hostedProxyUrl;
}

/**
 * Imports a raw HTML file or string.
 */
export async function importRawHtmlPackage(
  rawHtml: string,
  templateId: string
): Promise<PackageImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!rawHtml || !rawHtml.trim()) {
    return {
      isValid: false,
      htmlContent: "",
      plainText: "",
      detectedHtmlFiles: [],
      selectedHtmlFile: "",
      extractedAssets: [],
      unresolvedImages: [],
      warnings: [],
      errors: ["HTML content is empty."],
      hasExistingFooter: false,
    };
  }

  // Sanitize
  const sanitizedHtml = sanitizeEmailHtml(rawHtml);
  const plainText = convertHtmlToPlainText(sanitizedHtml);

  // Check unresolved relative images
  const imgMatches = sanitizedHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
  const unresolvedImages: string[] = [];

  for (const match of imgMatches) {
    const src = match[1].trim();
    if (
      !src.startsWith("http://") &&
      !src.startsWith("https://") &&
      !src.startsWith("data:") &&
      !src.startsWith("//")
    ) {
      unresolvedImages.push(src);
    } else if (src.includes("localhost") || src.includes("127.0.0.1") || src.startsWith("blob:")) {
      warnings.push(`Image contains local or blob URL: ${src}`);
    }
  }

  if (unresolvedImages.length > 0) {
    warnings.push(
      `Detected ${unresolvedImages.length} relative image paths in standalone HTML (e.g. "${unresolvedImages[0]}"). For automatic image hosting, please upload as a ZIP package containing the image files.`
    );
  }

  const footerCheck = detectExistingFooterInHtml(sanitizedHtml);
  if (footerCheck.hasExistingFooter) {
    warnings.push(
      `Existing footer/unsubscribe keywords detected in HTML: [${footerCheck.detectedKeywords.join(", ")}]. The central marketing footer will be appended automatically.`
    );
  }

  return {
    isValid: errors.length === 0,
    htmlContent: sanitizedHtml,
    plainText,
    detectedHtmlFiles: ["index.html"],
    selectedHtmlFile: "index.html",
    extractedAssets: [],
    unresolvedImages,
    warnings,
    errors,
    hasExistingFooter: footerCheck.hasExistingFooter,
    existingFooterSnippet: footerCheck.snippet,
  };
}

/**
 * Safely parses and imports a ZIP package containing HTML and images.
 */
export async function importZipPackage(
  zipBuffer: Buffer,
  templateId: string,
  preferredHtmlFile?: string
): Promise<PackageImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (zipBuffer.length > MAX_ZIP_BYTES) {
    return {
      isValid: false,
      htmlContent: "",
      plainText: "",
      detectedHtmlFiles: [],
      selectedHtmlFile: "",
      extractedAssets: [],
      unresolvedImages: [],
      warnings: [],
      errors: [`ZIP file exceeds maximum allowed size of 30MB (Actual: ${(zipBuffer.length / 1024 / 1024).toFixed(1)}MB).`],
      hasExistingFooter: false,
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (err: any) {
    return {
      isValid: false,
      htmlContent: "",
      plainText: "",
      detectedHtmlFiles: [],
      selectedHtmlFile: "",
      extractedAssets: [],
      unresolvedImages: [],
      warnings: [],
      errors: ["Invalid or corrupted ZIP archive."],
      hasExistingFooter: false,
    };
  }

  const fileEntries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);

  if (fileEntries.length > MAX_ENTRIES) {
    return {
      isValid: false,
      htmlContent: "",
      plainText: "",
      detectedHtmlFiles: [],
      selectedHtmlFile: "",
      extractedAssets: [],
      unresolvedImages: [],
      warnings: [],
      errors: [`ZIP contains too many files (${fileEntries.length} > ${MAX_ENTRIES}).`],
      hasExistingFooter: false,
    };
  }

  // 1. Path Traversal & Security Validation
  for (const name of Object.keys(zip.files)) {
    if (
      name.includes("../") ||
      name.includes("..\\") ||
      name.startsWith("/") ||
      name.startsWith("\\") ||
      name === "/" ||
      name === "\\" ||
      /^[a-zA-Z]:[\\\/]/.test(name)
    ) {
      return {
        isValid: false,
        htmlContent: "",
        plainText: "",
        detectedHtmlFiles: [],
        selectedHtmlFile: "",
        extractedAssets: [],
        unresolvedImages: [],
        warnings: [],
        errors: [`Unsafe path detected in ZIP: "${name}". Path traversal is prohibited.`],
        hasExistingFooter: false,
      };
    }
  }

  // 2. Identify candidate HTML files
  const htmlFiles = fileEntries.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    if (ext !== ".html" && ext !== ".htm") return false;
    // Exclude design canvas files (.dc.html) and design system bundles
    if (f.toLowerCase().endsWith(".dc.html")) return false;
    if (f.startsWith("_ds/") || f.includes("/_ds/")) return false;
    return true;
  });

  if (htmlFiles.length === 0) {
    return {
      isValid: false,
      htmlContent: "",
      plainText: "",
      detectedHtmlFiles: [],
      selectedHtmlFile: "",
      extractedAssets: [],
      unresolvedImages: [],
      warnings: [],
      errors: ["No HTML email template found in the uploaded ZIP package."],
      hasExistingFooter: false,
    };
  }

  // Filter out preview files if non-preview versions exist
  const productionCandidates = htmlFiles.filter((f) => !f.toLowerCase().includes("preview"));
  const pool = productionCandidates.length > 0 ? productionCandidates : htmlFiles;

  // Sort descending so highest version (outreach-03 > 02 > 01) or index.html comes first
  pool.sort((a, b) => {
    const aBase = path.basename(a).toLowerCase();
    const bBase = path.basename(b).toLowerCase();
    if (aBase === "index.html" || aBase === "index.htm") return -1;
    if (bBase === "index.html" || bBase === "index.htm") return 1;
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
  });

  // Pick selected HTML file
  let selectedHtmlFile = pool[0];
  if (preferredHtmlFile && htmlFiles.includes(preferredHtmlFile)) {
    selectedHtmlFile = preferredHtmlFile;
  }

  if (htmlFiles.length > 1) {
    warnings.push(
      `Multiple HTML files detected in package: [${pool.join(", ")}]. Currently using "${selectedHtmlFile}".`
    );
  }

  // 3. Read and Sanitize the selected HTML file
  const rawHtml = await zip.files[selectedHtmlFile].async("string");
  let sanitizedHtml = sanitizeEmailHtml(rawHtml);
  const plainText = convertHtmlToPlainText(sanitizedHtml);

  // 4. Extract Images and build asset map (Parallel upload to prevent timeout)
  const imageEntries = fileEntries.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ALLOWED_IMAGE_EXTENSIONS.has(ext);
  });

  const extractedAssets: ExtractedAssetItem[] = [];
  const assetMap = new Map<string, string>(); // originalPath/basename -> hostedUrl

  await Promise.all(
    imageEntries.map(async (imgPath) => {
      try {
        const buffer = await zip.files[imgPath].async("nodebuffer");
        const mime = getMimeType(imgPath);
        const filename = path.basename(imgPath);
        const hostedUrl = await hostTemplateAsset(templateId, filename, buffer, mime);

        extractedAssets.push({
          originalPath: imgPath,
          hostedUrl,
          byteSize: buffer.length,
          contentType: mime,
        });

        // Index by both exact relative path, normalized path, and base filename for flexible matching
        assetMap.set(imgPath.toLowerCase(), hostedUrl);
        assetMap.set(imgPath.replace(/^\.\//, "").toLowerCase(), hostedUrl);
        assetMap.set(filename.toLowerCase(), hostedUrl);
      } catch (err: any) {
        warnings.push(`Failed to extract image "${imgPath}": ${err.message}`);
      }
    })
  );

  // 5. Rewrite Local & Placeholder Image Paths in HTML to Hosted URLs
  const unresolvedImages: string[] = [];

  const resolveAssetUrl = (rawSrc: string): string | null => {
    const trimmed = rawSrc.trim();
    if (!trimmed || trimmed.startsWith("data:")) return null;

    if (trimmed.includes("/api/marketing/assets/templates/")) {
      return trimmed;
    }

    const cleanSrc = trimmed.replace(/^\.\//, "").toLowerCase();
    let baseName = "";
    try {
      const urlObj = new URL(trimmed, "http://localhost");
      baseName = path.basename(urlObj.pathname).toLowerCase();
    } catch {
      baseName = path.basename(trimmed).toLowerCase();
    }

    // Direct match by clean path or base filename
    const hosted = assetMap.get(cleanSrc) || assetMap.get(baseName);
    if (hosted) return hosted;

    // Suffix match
    for (const [k, v] of assetMap.entries()) {
      if (cleanSrc.endsWith(k) || k.endsWith(cleanSrc)) return v;
    }

    // Fallback for placeholder hero images
    if (baseName.includes("hero")) {
      for (const [k, v] of assetMap.entries()) {
        if (k.includes("hero-kbeauty-journey")) return v;
      }
    }

    return null;
  };

  // Match <img ... src="..." ...>
  sanitizedHtml = sanitizedHtml.replace(/(<img\b[^>]*?\bsrc=["'])([^"']+)(["'][^>]*>)/gi, (match, prefix, src, suffix) => {
    const trimmed = src.trim();
    const resolved = resolveAssetUrl(trimmed);
    if (resolved) {
      return `${prefix}${resolved}${suffix}`;
    }

    // Preserve external HTTPS that did not match any zip asset
    if (trimmed.startsWith("https://") || trimmed.startsWith("//")) {
      return match;
    }

    if (trimmed.startsWith("http://")) {
      warnings.push(`Insecure HTTP image URL converted to secure HTTPS or left as-is: ${trimmed}`);
      return match;
    }

    if (trimmed.startsWith("data:")) {
      return match;
    }

    unresolvedImages.push(trimmed);
    return match;
  });

  // Match CSS background-image: url(...)
  sanitizedHtml = sanitizedHtml.replace(/(url\(["']?)([^"')]+)(["']?\))/gi, (match, prefix, urlVal, suffix) => {
    const trimmed = urlVal.trim();
    const resolved = resolveAssetUrl(trimmed);
    if (resolved) {
      return `${prefix}${resolved}${suffix}`;
    }

    if (trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("//")) {
      return match;
    }

    return match;
  });

  if (unresolvedImages.length > 0) {
    warnings.push(
      `Could not resolve ${unresolvedImages.length} image reference(s) from ZIP: [${unresolvedImages.slice(0, 3).join(", ")}${unresolvedImages.length > 3 ? "..." : ""}]. Ensure image files are included inside the ZIP archive.`
    );
  }

  // 6. Check for existing footers
  const footerCheck = detectExistingFooterInHtml(sanitizedHtml);
  if (footerCheck.hasExistingFooter) {
    warnings.push(
      `Existing footer/unsubscribe keywords detected in imported HTML: [${footerCheck.detectedKeywords.join(", ")}]. The central marketing footer will be appended automatically.`
    );
  }

  return {
    isValid: errors.length === 0,
    htmlContent: sanitizedHtml,
    plainText,
    detectedHtmlFiles: htmlFiles,
    selectedHtmlFile,
    extractedAssets,
    unresolvedImages,
    warnings,
    errors,
    hasExistingFooter: footerCheck.hasExistingFooter,
    existingFooterSnippet: footerCheck.snippet,
  };
}
