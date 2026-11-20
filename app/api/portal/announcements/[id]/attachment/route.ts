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

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePortalApiCompanyContext();
  if (!ctx.ok) return ctx.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();

  const { data: ann } = await adminDb
    .from("brand_announcements")
    .select(
      "id, status, audience_mode, attachment_storage_path, attachment_file_name, attachment_mime_type"
    )
    .eq("id", id)
    .maybeSingle();

  if (!ann) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const { data: targets } = await adminDb
    .from("brand_announcement_targets")
    .select("company_id")
    .eq("announcement_id", id);

  const authorized = isCompanyAuthorizedForAudience({
    status: ann.status,
    audienceMode: ann.audience_mode,
    targetCompanyIds: (targets || []).map((t: any) => t.company_id),
    companyId: ctx.companyId,
  });

  if (!authorized) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  if (!isValidBrandCommsStoragePath(ann.attachment_storage_path)) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const { data: fileBlob, error: dlErr } = await adminDb.storage
    .from(BRAND_COMMS_STORAGE_BUCKET)
    .download(ann.attachment_storage_path);

  if (dlErr || !fileBlob) {
    return NextResponse.json({ error: "Attachment could not be loaded." }, { status: 404 });
  }

  const buf = Buffer.from(await fileBlob.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ann.attachment_mime_type || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": buildDownloadContentDisposition(
        ann.attachment_file_name || "attachment"
      ),
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
