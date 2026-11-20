import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApiSession } from "@/lib/insights/admin-auth";
import { unstageFormData } from "@/lib/files/staged-upload";
import {
  BRAND_COMMS_STORAGE_BUCKET,
  buildBrandCommsStoragePath,
  isValidBrandCommsStoragePath,
  validateBrandCommsUpload,
} from "@/lib/brand-comms/file-validation";
import { recordBrandCommsAudit } from "@/lib/brand-comms/audit";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const adminDb = createAdminClient();
  const { data: existing } = await adminDb
    .from("brand_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Resource not found." }, { status: 404 });
  }

  try {
    const rawFd = await req.formData();
    const fd = await unstageFormData(rawFd);
    const file = fd.get("file");
    const nextVersionRaw = fd.get("version");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "업로드할 파일을 선택해주세요." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const validation = await validateBrandCommsUpload(buf, file.name, file.type);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const storagePath = buildBrandCommsStoragePath(
      "resources",
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

    const nextVersion =
      typeof nextVersionRaw === "string" && nextVersionRaw.trim()
        ? nextVersionRaw.trim()
        : existing.version || "v1.0";

    const { data: updated, error: updateErr } = await adminDb
      .from("brand_resources")
      .update({
        source_type: "UPLOADED_FILE",
        file_type: validation.meta.fileType,
        file_name: validation.meta.fileName,
        storage_path: storagePath,
        mime_type: validation.meta.mimeType,
        file_size: validation.meta.fileSize,
        file_sha256: validation.meta.sha256,
        page_count: validation.meta.pageCount,
        version: nextVersion,
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

    // Safely remove old replaced file ONLY if it was a brand-comms uploaded file not referenced elsewhere
    if (
      existing.source_type === "UPLOADED_FILE" &&
      existing.storage_path &&
      existing.storage_path !== storagePath &&
      isValidBrandCommsStoragePath(existing.storage_path)
    ) {
      const { data: refs } = await adminDb
        .from("brand_resources")
        .select("id")
        .eq("storage_path", existing.storage_path)
        .limit(1);
      if (!refs || refs.length === 0) {
        await adminDb.storage
          .from(BRAND_COMMS_STORAGE_BUCKET)
          .remove([existing.storage_path]);
      }
    }

    await recordBrandCommsAudit({
      entityType: "RESOURCE",
      entityId: id,
      action: existing.storage_path ? "FILE_REPLACE" : "FILE_UPLOAD",
      actorId: auth.userId,
      actorEmail: auth.email,
      summary: `${existing.storage_path ? "Replaced" : "Uploaded"} "${validation.meta.fileName}" (${nextVersion}, SHA-256 ${validation.meta.sha256.slice(0, 12)})`,
      metadata: {
        file_type: validation.meta.fileType,
        file_name: validation.meta.fileName,
        file_size: validation.meta.fileSize,
        sha256: validation.meta.sha256,
        version: nextVersion,
        previous_sha256: existing.file_sha256 || null,
      },
    });

    return NextResponse.json({ resource: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "파일 업로드 오류" }, { status: 500 });
  }
}
