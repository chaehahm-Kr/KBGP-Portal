import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildContentDispositionHeader,
  buildSafeInsightPdfStoragePath,
  createInsightPreviewToken,
  extractPdfAttachment,
  inspectAndValidatePdfBuffer,
  isSafeInsightPdfStoragePath,
  removePdfAttachmentFromVisuals,
  toPublicPdfAttachment,
  upsertPdfAttachmentInVisuals,
  verifyInsightPreviewToken,
} from "@/lib/insights/pdf-attachments";
import {
  FEI_ARTICLE_DRAFT,
  FEI_GUIDE_SLUG,
  FEI_PDF_CARD_META,
  MOCRA_ARTICLE_DRAFT,
  MOCRA_GUIDE_SLUG,
  MOCRA_PDF_CARD_META,
} from "@/lib/insights/guides-seed-data";

const UPLOADED_FEI_PDF =
  "C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e/.user_uploaded/media_1795126918404_5f2ba41a.pdf";
const UPLOADED_MOCRA_PDF =
  "C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e/.user_uploaded/media_1795126918431_61fabd5a.pdf";

describe("ADM-INSIGHTS-GUIDES-001: Insights PDF Attachment Security, Integrity & Guide Content", () => {
  it("enforces strict insights-guides/ storage path confinement and blocks traversal", () => {
    const validPath = buildSafeInsightPdfStoragePath(
      "ab8bbe2a-cdb7-42d2-ae48-b64e6fc6e1ef",
      "6c7a964186a050af1af2919a453d4becf84b99cbbfe34d4523e8c1ced93a5dad"
    );
    expect(isSafeInsightPdfStoragePath(validPath)).toBe(true);
    expect(isSafeInsightPdfStoragePath("../secrets/key.pdf")).toBe(false);
    expect(isSafeInsightPdfStoragePath("insights-guides/../other/file.pdf")).toBe(false);
    expect(isSafeInsightPdfStoragePath("knowledge/doc/manual.pdf")).toBe(false);
    expect(isSafeInsightPdfStoragePath("insights-guides/art-1/script.exe")).toBe(false);
  });

  it("validates PDF magic bytes, rejects disguised/corrupted files, and verifies original MoCRA (25p) & FEI (5p) PDFs", async () => {
    const fakePdf = Buffer.from("MZ-not-a-pdf-binary", "utf8");
    const fakeRes = await inspectAndValidatePdfBuffer(fakePdf, "disguised.pdf");
    expect(fakeRes.ok).toBe(false);

    const truncatedPdf = Buffer.from("%PDF-1.7\ncorrupted-stream", "utf8");
    const truncRes = await inspectAndValidatePdfBuffer(truncatedPdf, "corrupt.pdf");
    expect(truncRes.ok).toBe(false);

    if (fs.existsSync(UPLOADED_MOCRA_PDF) && fs.existsSync(UPLOADED_FEI_PDF)) {
      const mocraBuf = fs.readFileSync(UPLOADED_MOCRA_PDF);
      const mocraCheck = await inspectAndValidatePdfBuffer(
        mocraBuf,
        MOCRA_PDF_CARD_META.file_name
      );
      expect(mocraCheck).toEqual({
        ok: true,
        pageCount: 25,
        byteLength: 4807571,
        sha256: "6c7a964186a050af1af2919a453d4becf84b99cbbfe34d4523e8c1ced93a5dad",
      });

      const feiBuf = fs.readFileSync(UPLOADED_FEI_PDF);
      const feiCheck = await inspectAndValidatePdfBuffer(feiBuf, FEI_PDF_CARD_META.file_name);
      expect(feiCheck).toEqual({
        ok: true,
        pageCount: 5,
        byteLength: 915048,
        sha256: "03b9a34ed8eae9dd5e4e8e1135dcbb130d6fa02e285e3f0fa78636726185b0b7",
      });
    }
  });

  it("strips internal storage paths when converting PDF metadata for public API responses and formats RFC 5987 Content-Disposition", () => {
    const visuals = upsertPdfAttachmentInVisuals(
      [{ asset_id: "hero-1", asset_type: "HERO", preview_url: "/images/insights/mocra.svg" }],
      {
        asset_id: "pdf-mocra",
        asset_type: "PDF_GUIDE",
        article_id: "art-123",
        mime_type: "application/pdf",
        file_size: 4807571,
        page_count: 25,
        sha256: "6c7a964186a050af1af2919a453d4becf84b99cbbfe34d4523e8c1ced93a5dad",
        storage_bucket: "company-uploads",
        storage_path: "insights-guides/art-123/6c7a964186a050af_abcd1234.pdf",
        ...MOCRA_PDF_CARD_META,
        uploaded_at: "2026-11-19T00:00:00.000Z",
        uploaded_by: "admin@kselectnetwork.com",
        status: "APPROVED",
      }
    );

    expect(visuals.length).toBe(2);
    const extracted = extractPdfAttachment(visuals);
    expect(extracted?.page_count).toBe(25);

    const publicMeta = toPublicPdfAttachment(extracted, MOCRA_GUIDE_SLUG, true)!;
    expect(publicMeta.card_title_ko).toBe("MoCRA 직접 등록 가이드 PDF");
    expect(publicMeta.card_description_ko).toBe("25페이지 | 2026 Updated Edition");
    expect(publicMeta.button_label_ko).toBe("무료 PDF 다운로드");
    expect(publicMeta.download_path).toBe(`/api/insights/download/${MOCRA_GUIDE_SLUG}`);
    expect((publicMeta as any).storage_path).toBeUndefined();
    expect((publicMeta as any).storage_bucket).toBeUndefined();

    const afterRemove = removePdfAttachmentFromVisuals(visuals);
    expect(afterRemove.length).toBe(1);
    expect(extractPdfAttachment(afterRemove)).toBeNull();

    const cd = buildContentDispositionHeader("[K·SELECT] MoCRA Guide.pdf");
    expect(cd).toContain("filename*=UTF-8''%5BK%C2%B7SELECT%5D%20MoCRA%20Guide.pdf");
  });

  it("verifies bilingual KO/EN completeness, cross-linking, K SELECT NETWORK ONLY channel isolation, and HMAC preview tokens", () => {
    process.env.INQUIRY_INTAKE_SECRET = "unit-test-shared-secret-2026";
    const tok = createInsightPreviewToken("id-mocra-1", MOCRA_GUIDE_SLUG);
    expect(tok).toBeTruthy();
    expect(verifyInsightPreviewToken("id-mocra-1", MOCRA_GUIDE_SLUG, tok)).toBe(true);
    expect(verifyInsightPreviewToken("id-other-2", MOCRA_GUIDE_SLUG, tok)).toBe(false);
    expect(verifyInsightPreviewToken("id-mocra-1", FEI_GUIDE_SLUG, tok)).toBe(false);
    expect(verifyInsightPreviewToken("id-mocra-1", MOCRA_GUIDE_SLUG, "forged-token")).toBe(false);

    for (const draft of [MOCRA_ARTICLE_DRAFT, FEI_ARTICLE_DRAFT]) {
      expect(draft.status).toBe("DRAFT");
      expect(draft.publish_channels).toEqual(["K_SELECT_NETWORK"]);
      expect(draft.network_enabled).toBe(true);
      expect(draft.hub_enabled).toBe(false);
      expect(draft.hub_publish_status).toBe("DISABLED");
      expect(draft.category).toBe("U.S. MARKET ENTRY");
      expect(draft.title_ko.length).toBeGreaterThan(15);
      expect(draft.title_en.length).toBeGreaterThan(15);
      expect(draft.summary_ko.length).toBeGreaterThan(40);
      expect(draft.summary_en.length).toBeGreaterThan(40);
      expect(draft.body_blocks_ko.length).toBeGreaterThanOrEqual(20);
      expect(draft.body_blocks_en.length).toBeGreaterThanOrEqual(20);
    }

    const mocraJson = JSON.stringify(MOCRA_ARTICLE_DRAFT);
    const feiJson = JSON.stringify(FEI_ARTICLE_DRAFT);
    expect(mocraJson).toContain(`/insights/${FEI_GUIDE_SLUG}`);
    expect(feiJson).toContain(`/insights/${MOCRA_GUIDE_SLUG}`);
    expect(mocraJson).toContain("https://direct.fda.gov");
    expect(feiJson).toContain("https://www.accessdata.fda.gov/scripts/feiportal/");

    if (process.env.EXPORT_GUIDES_SEED_JSON) {
      fs.writeFileSync(
        process.env.EXPORT_GUIDES_SEED_JSON,
        JSON.stringify(
          {
            MOCRA_ARTICLE_DRAFT,
            FEI_ARTICLE_DRAFT,
            MOCRA_PDF_CARD_META,
            FEI_PDF_CARD_META,
          },
          null,
          2
        ),
        "utf8"
      );
    }
  });
});
