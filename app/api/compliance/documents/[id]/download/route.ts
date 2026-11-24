import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { requirePortalApiCompanyContext } from "@/lib/brand-comms/portal-auth";
import { buildDownloadContentDisposition } from "@/lib/brand-comms/file-validation";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const adminAuth = await requireAdminApiSession();
  const portalAuth = adminAuth.ok ? null : await requirePortalApiCompanyContext();

  if (!adminAuth.ok && (!portalAuth || !portalAuth.ok)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("compliance_evidence_documents")
    .select("id, company_id, storage_path, file_name, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!adminAuth.ok && portalAuth?.ok && doc.company_id !== portalAuth.companyId) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (!doc.storage_path || !doc.storage_path.startsWith("compliance-evidence/") || doc.storage_path.includes("..")) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from("company-uploads")
    .download(doc.storage_path);

  if (dlErr || !blob) {
    return NextResponse.json({ error: "File could not be retrieved." }, { status: 404 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": doc.mime_type || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": buildDownloadContentDisposition(doc.file_name || "evidence"),
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
