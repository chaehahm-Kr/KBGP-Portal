import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { isCompanyAuthorizedForAudience } from "@/lib/brand-comms/types";
import {
  buildBrandCommsStoragePath,
  buildDownloadContentDisposition,
  isValidBrandCommsStoragePath,
  validateBrandCommsUpload,
} from "@/lib/brand-comms/file-validation";

describe("BRAND-COMMS-001 — Tenant Audience & File Validation", () => {
  it("enforces strict audience isolation across PUBLISHED, DRAFT, ARCHIVED, and Company A/B", () => {
    // Global published announcement visible to both Company A and Company B
    expect(
      isCompanyAuthorizedForAudience({
        status: "PUBLISHED",
        audienceMode: "ALL_COMPANIES",
        targetCompanyIds: [],
        companyId: "company-a",
      })
    ).toBe(true);
    expect(
      isCompanyAuthorizedForAudience({
        status: "PUBLISHED",
        audienceMode: "ALL_COMPANIES",
        targetCompanyIds: [],
        companyId: "company-b",
      })
    ).toBe(true);

    // Company A-only published notice visible to Company A, denied to Company B
    expect(
      isCompanyAuthorizedForAudience({
        status: "PUBLISHED",
        audienceMode: "SELECTED_COMPANIES",
        targetCompanyIds: ["company-a"],
        companyId: "company-a",
      })
    ).toBe(true);
    expect(
      isCompanyAuthorizedForAudience({
        status: "PUBLISHED",
        audienceMode: "SELECTED_COMPANIES",
        targetCompanyIds: ["company-a"],
        companyId: "company-b",
      })
    ).toBe(false);

    // DRAFT and ARCHIVED are never visible to Brand Portal users
    expect(
      isCompanyAuthorizedForAudience({
        status: "DRAFT",
        audienceMode: "ALL_COMPANIES",
        targetCompanyIds: ["company-a"],
        companyId: "company-a",
      })
    ).toBe(false);
    expect(
      isCompanyAuthorizedForAudience({
        status: "ARCHIVED",
        audienceMode: "ALL_COMPANIES",
        targetCompanyIds: ["company-a"],
        companyId: "company-a",
      })
    ).toBe(false);
  });

  it("validates genuine PDF files and rejects spoofed or unsupported uploads", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const pdfBytes = Buffer.from(await doc.save());

    const validPdf = await validateBrandCommsUpload(
      pdfBytes,
      "MoCRA_실무가이드.pdf",
      "application/pdf"
    );
    expect(validPdf.ok).toBe(true);
    if (validPdf.ok) {
      expect(validPdf.meta.fileType).toBe("PDF");
      expect(validPdf.meta.pageCount).toBe(1);
      expect(validPdf.meta.sha256).toHaveLength(64);
    }

    // Spoofed PDF without %PDF- signature
    const fakePdf = await validateBrandCommsUpload(
      Buffer.from("<html>not a pdf</html>"),
      "fake.pdf",
      "application/pdf"
    );
    expect(fakePdf.ok).toBe(false);

    // Valid ZIP header for XLSX
    const fakeZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const validXlsx = await validateBrandCommsUpload(
      fakeZipHeader,
      "Product_Template.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(validXlsx.ok).toBe(true);

    // Unsupported extension rejected
    const exeUpload = await validateBrandCommsUpload(
      fakeZipHeader,
      "malware.exe",
      "application/octet-stream"
    );
    expect(exeUpload.ok).toBe(false);
  });

  it("confines storage paths to brand-comms/ and encodes UTF-8 Content-Disposition", () => {
    const p = buildBrandCommsStoragePath(
      "resources",
      "res-123",
      "abcdef1234567890",
      "PDF"
    );
    expect(p.startsWith("brand-comms/resources/res-123/")).toBe(true);
    expect(isValidBrandCommsStoragePath(p)).toBe(true);
    expect(isValidBrandCommsStoragePath("brand-comms/../secrets.pdf")).toBe(false);
    expect(isValidBrandCommsStoragePath("insights-guides/other.pdf")).toBe(false);

    const cd = buildDownloadContentDisposition("[K·SELECT] MoCRA Guide.pdf");
    expect(cd).toContain("attachment;");
    expect(cd).toContain("filename*=UTF-8''");
  });
});
