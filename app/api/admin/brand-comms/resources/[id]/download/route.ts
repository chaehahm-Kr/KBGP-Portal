import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import {
  BRAND_COMMS_STORAGE_BUCKET,
  buildDownloadContentDisposition,
  isValidBrandCommsStoragePath,
} from "@/lib/brand-comms/file-validation";
import { resolveLinkedInsightPdf } from "@/lib/brand-comms/insight-resolver";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();
  const { data: resource } = await adminDb
    .from("brand_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!resource) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  let bucket = BRAND_COMMS_STORAGE_BUCKET;
  let storagePath: string | null = null;
  let fileName = resource.file_name || "resource";
  let mimeType = resource.mime_type || "application/octet-stream";

  if (resource.source_type === "LINKED_INSIGHT_PDF") {
    const resolved = await resolveLinkedInsightPdf(resource.linked_insight_id);
    if (!resolved) {
      return NextResponse.json({ error: "Linked Insights PDF not found." }, { status: 404 });
    }
    bucket = resolved.bucket;
    storagePath = resolved.storagePath;
    fileName = resolved.fileName;
    mimeType = resolved.mimeType;
  } else {
    if (!isValidBrandCommsStoragePath(resource.storage_path)) {
      return NextResponse.json({ error: "No uploaded file found for this resource." }, { status: 404 });
    }
    storagePath = resource.storage_path;
  }

  if (!storagePath) {
    return NextResponse.json({ error: "No file path available." }, { status: 404 });
  }

  const { data: fileBlob, error: dlErr } = await adminDb.storage
    .from(bucket)
    .download(storagePath);

  if (dlErr || !fileBlob) {
    return NextResponse.json({ error: "Failed to read file from storage." }, { status: 404 });
  }

  const buf = Buffer.from(await fileBlob.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": buildDownloadContentDisposition(fileName),
      "Cache-Control": "private, no-store",
    },
  });
}
