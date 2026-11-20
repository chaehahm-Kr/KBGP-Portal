import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCompanyAuthorizedForAudience,
  requirePortalApiCompanyContext,
} from "@/lib/brand-comms/portal-auth";
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
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

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

  const { data: targets } = await adminDb
    .from("brand_resource_targets")
    .select("company_id")
    .eq("resource_id", id);

  const authorized = isCompanyAuthorizedForAudience({
    status: resource.status,
    audienceMode: resource.audience_mode,
    targetCompanyIds: (targets || []).map((t: any) => t.company_id),
    companyId: ctx.companyId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  let bucket = BRAND_COMMS_STORAGE_BUCKET;
  let storagePath: string | null = null;
  let fileName = resource.file_name || "resource";
  let mimeType = resource.mime_type || "application/octet-stream";

  if (resource.source_type === "LINKED_INSIGHT_PDF") {
    const resolved = await resolveLinkedInsightPdf(resource.linked_insight_id);
    if (!resolved) {
      return NextResponse.json({ error: "Linked PDF file is unavailable." }, { status: 404 });
    }
    bucket = resolved.bucket;
    storagePath = resolved.storagePath;
    fileName = resolved.fileName;
    mimeType = resolved.mimeType;
  } else {
    if (!isValidBrandCommsStoragePath(resource.storage_path)) {
      return NextResponse.json({ error: "Resource file is unavailable." }, { status: 404 });
    }
    storagePath = resource.storage_path;
  }

  if (!storagePath) {
    return NextResponse.json({ error: "Resource file is unavailable." }, { status: 404 });
  }

  const { data: fileBlob, error: dlErr } = await adminDb.storage
    .from(bucket)
    .download(storagePath);

  if (dlErr || !fileBlob) {
    return NextResponse.json({ error: "Failed to download file." }, { status: 404 });
  }

  const buf = Buffer.from(await fileBlob.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": buildDownloadContentDisposition(fileName),
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
