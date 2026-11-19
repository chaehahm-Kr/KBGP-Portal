import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  INSIGHTS_PDF_STORAGE_BUCKET,
  buildContentDispositionHeader,
  computeSha256Hex,
  extractPdfAttachment,
  isSafeInsightPdfStoragePath,
  verifyInsightPreviewToken,
} from "@/lib/insights/pdf-attachments";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: "Missing article slug." }, { status: 400 });
    }

    const previewToken = request.nextUrl.searchParams.get("preview");
    const supabase = createAdminClient();

    const { data: article, error } = await supabase
      .from("insights_articles")
      .select("id, slug, status, publish_channels, network_enabled, hub_enabled, visuals")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !article) {
      return NextResponse.json({ error: "Guide article not found." }, { status: 404 });
    }

    const isValidPreview = verifyInsightPreviewToken(article.id, article.slug, previewToken);
    const channels = Array.isArray(article.publish_channels) ? article.publish_channels : [];
    const isPublishedForNetwork =
      article.status === "PUBLISHED" &&
      article.network_enabled !== false &&
      (channels.includes("K_SELECT_NETWORK") || channels.includes("NETWORK"));

    if (!isPublishedForNetwork && !isValidPreview) {
      return NextResponse.json(
        { error: "This guide is not publicly published yet." },
        { status: 404 }
      );
    }

    const attachment = extractPdfAttachment(article.visuals);
    if (
      !attachment ||
      attachment.storage_bucket !== INSIGHTS_PDF_STORAGE_BUCKET ||
      !isSafeInsightPdfStoragePath(attachment.storage_path)
    ) {
      return NextResponse.json(
        { error: "첨부된 PDF 가이드 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { data: blob, error: dlError } = await supabase.storage
      .from(INSIGHTS_PDF_STORAGE_BUCKET)
      .download(attachment.storage_path);

    if (dlError || !blob) {
      return NextResponse.json(
        { error: "PDF 가이드 파일이 현재 준비 중이거나 스토리지에서 누락되었습니다." },
        { status: 404 }
      );
    }

    const rawBytes = Buffer.from(await blob.arrayBuffer());
    const actualSha = computeSha256Hex(rawBytes);
    if (attachment.sha256 && actualSha !== attachment.sha256) {
      console.error(
        `[Insights PDF Integrity Error] slug=${slug} expected=${attachment.sha256} actual=${actualSha}`
      );
      return NextResponse.json(
        { error: "PDF 파일 무결성 검증에 실패했습니다." },
        { status: 500 }
      );
    }

    return new Response(new Uint8Array(rawBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(rawBytes.byteLength),
        "Content-Disposition": buildContentDispositionHeader(attachment.file_name),
        ETag: `"${actualSha}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isValidPreview
          ? "private, no-store, max-age=0"
          : "public, max-age=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("GET /api/insights/download/[slug] error:", err);
    return NextResponse.json(
      { error: "PDF 다운로드 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
