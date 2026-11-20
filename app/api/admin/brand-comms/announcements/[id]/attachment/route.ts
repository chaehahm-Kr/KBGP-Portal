import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { unstageFormData } from "@/lib/files/staged-upload";
import {
  BRAND_COMMS_STORAGE_BUCKET,
  buildBrandCommsStoragePath,
  buildDownloadContentDisposition,
  isValidBrandCommsStoragePath,
  validateBrandCommsUpload,
} from "@/lib/brand-comms/file-validation";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();
  const { data: ann } = await adminDb
    .from("brand_announcements")
    .select("attachment_storage_path, attachment_file_name, attachment_mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!ann || !isValidBrandCommsStoragePath(ann.attachment_storage_path)) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const { data: fileBlob, error: dlErr } = await adminDb.storage
    .from(BRAND_COMMS_STORAGE_BUCKET)
    .download(ann.attachment_storage_path);

  if (dlErr || !fileBlob) {
    return NextResponse.json({ error: "Failed to read attachment from storage." }, { status: 404 });
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
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from("brand_announcements")
    .select("id, title_ko, attachment_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  try {
    const rawFd = await req.formData();
    const fd = await unstageFormData(rawFd);
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일을 선택해주세요." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const validation = await validateBrandCommsUpload(buf, file.name, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const storagePath = buildBrandCommsStoragePath(
      "announcements",
      id,
      validation.meta.sha256,
      validation.meta.fileType
    );

    const { error: uploadErr } = await adminDb.storage
      .from(BRAND_COMMS_STORAGE_BUCKET)
      .upload(storagePath, buf, {
        contentType: validation.meta.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Storage 업로드 실패: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: updated, error: updateErr } = await adminDb
      .from("brand_announcements")
      .update({
        attachment_storage_path: storagePath,
        attachment_file_name: validation.meta.fileName,
        attachment_mime_type: validation.meta.mimeType,
        attachment_file_size: validation.meta.fileSize,
        attachment_sha256: validation.meta.sha256,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updated) {
      await adminDb.storage.from(BRAND_COMMS_STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: updateErr?.message || "DB 저장 실패" }, { status: 500 });
    }

    // Safely remove old attachment if replaced and not referenced elsewhere
    if (
      existing.attachment_storage_path &&
      existing.attachment_storage_path !== storagePath &&
      isValidBrandCommsStoragePath(existing.attachment_storage_path)
    ) {
      const { data: refs } = await adminDb
        .from("brand_announcements")
        .select("id")
        .eq("attachment_storage_path", existing.attachment_storage_path)
        .limit(1);
      if (!refs || refs.length === 0) {
        await adminDb.storage
          .from(BRAND_COMMS_STORAGE_BUCKET)
          .remove([existing.attachment_storage_path]);
      }
    }

    await recordBrandCommsAudit({
      entityType: "ANNOUNCEMENT",
      entityId: id,
      action: existing.attachment_storage_path ? "FILE_REPLACE" : "FILE_UPLOAD",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `Attached "${validation.meta.fileName}" (${validation.meta.fileType}, SHA-256 ${validation.meta.sha256.slice(0, 12)})`,
      metadata: {
        file_name: validation.meta.fileName,
        file_size: validation.meta.fileSize,
        sha256: validation.meta.sha256,
      },
    });

    return NextResponse.json({ announcement: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "파일 업로드 오류" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from("brand_announcements")
    .select("id, attachment_storage_path, attachment_file_name")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  }

  const { data: updated, error } = await adminDb
    .from("brand_announcements")
    .update({
      attachment_storage_path: null,
      attachment_file_name: null,
      attachment_mime_type: null,
      attachment_file_size: null,
      attachment_sha256: null,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isValidBrandCommsStoragePath(existing.attachment_storage_path)) {
    const { data: refs } = await adminDb
      .from("brand_announcements")
      .select("id")
      .eq("attachment_storage_path", existing.attachment_storage_path)
      .limit(1);
    if (!refs || refs.length === 0) {
      await adminDb.storage
        .from(BRAND_COMMS_STORAGE_BUCKET)
        .remove([existing.attachment_storage_path]);
    }
  }

  await recordBrandCommsAudit({
    entityType: "ANNOUNCEMENT",
    entityId: id,
    action: "FILE_REMOVE",
    actorId: auth.userId,
    actorEmail: auth.email,
    summary: `Removed attachment "${existing.attachment_file_name || ""}"`,
  });

  return NextResponse.json({ announcement: updated });
}
