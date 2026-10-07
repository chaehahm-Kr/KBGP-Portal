import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/auth/impersonation";
import {
  MAX_STAGED_FILE_BYTES,
  STAGING_BUCKET,
  STAGING_ROOT,
  decodeStagedFile,
} from "@/lib/files/staged-upload-shared";

/**
 * 스테이징 파일의 소유자 식별자. 로그인 사용자 id, 없으면 관리자 대리 로그인
 * 세션 id. 업로드 URL 발급과 회수(unstage) 양쪽에서 같은 값을 써서, 남의
 * 스테이징 경로를 마커로 위조해 끌어오는 것을 막는다.
 */
async function resolveStagingOwner(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;

  const impersonation = await getImpersonationSession();
  if (impersonation) return `imp-${impersonation.sessionId}`;

  return null;
}

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  return cleaned || "file";
}

export type StagedUploadTarget = {
  path: string;
  token: string;
};

export async function createStagedUploadTargets(
  files: { name: string; size: number }[]
): Promise<{ ok: true; targets: StagedUploadTarget[] } | { ok: false; error: string }> {
  const owner = await resolveStagingOwner();
  if (!owner) {
    return { ok: false, error: "로그인이 필요합니다." };
  }
  if (files.length === 0 || files.length > 20) {
    return { ok: false, error: "업로드할 파일 수가 올바르지 않습니다." };
  }
  for (const f of files) {
    if (!Number.isFinite(f.size) || f.size <= 0 || f.size > MAX_STAGED_FILE_BYTES) {
      return { ok: false, error: "파일 용량은 50MB를 넘을 수 없습니다." };
    }
  }

  const admin = createAdminClient();
  const targets: StagedUploadTarget[] = [];
  for (const f of files) {
    const path = `${STAGING_ROOT}/${owner}/${randomUUID()}/${sanitizeFileName(f.name)}`;
    const { data, error } = await admin.storage
      .from(STAGING_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[staged-upload] signed upload url failed", error);
      return { ok: false, error: "파일 업로드 준비에 실패했습니다." };
    }
    targets.push({ path: data.path, token: data.token });
  }
  return { ok: true, targets };
}

/**
 * File을 인자로 직접 받는 서버 액션용. 클라이언트가 `stageLargeFile()`로 바꿔 보낸
 * 마커 문자열이면 File로 되돌리고, File/null이면 그대로 돌려준다.
 */
export async function resolveStagedFile(
  value: File | string | null | undefined
): Promise<File | null> {
  if (value == null) return null;
  if (value instanceof File) return value;
  const fd = new FormData();
  fd.append("file", value);
  const resolved = (await unstageFormData(fd)).get("file");
  return resolved instanceof File ? resolved : null;
}

/**
 * 서버 액션 시작 시 호출한다. FormData 안의 스테이징 마커를 실제 File로 되돌린
 * 새 FormData를 반환한다(마커가 없으면 원본을 그대로 반환). 회수한 스테이징
 * 객체는 즉시 삭제한다 — 이후 저장은 각 액션의 기존 로직이 최종 경로에 한다.
 */
export async function unstageFormData(formData: FormData): Promise<FormData> {
  const entries = Array.from(formData.entries());
  if (!entries.some(([, v]) => decodeStagedFile(v))) {
    return formData;
  }

  const owner = await resolveStagingOwner();
  if (!owner) {
    throw new Error("로그인이 필요합니다.");
  }
  const ownerPrefix = `${STAGING_ROOT}/${owner}/`;

  const admin = createAdminClient();
  const result = new FormData();
  const consumed: string[] = [];
  try {
    for (const [key, value] of entries) {
      const ref = decodeStagedFile(value);
      if (!ref) {
        result.append(key, value);
        continue;
      }
      if (!ref.path.startsWith(ownerPrefix) || ref.path.includes("..")) {
        throw new Error("잘못된 업로드 파일 참조입니다.");
      }
      const { data, error } = await admin.storage.from(STAGING_BUCKET).download(ref.path);
      if (error || !data) {
        console.error("[staged-upload] download failed", ref.path, error);
        throw new Error("업로드된 파일을 찾을 수 없습니다. 다시 시도해 주세요.");
      }
      consumed.push(ref.path);
      result.append(key, new File([data], ref.name, { type: ref.type }));
    }
  } finally {
    if (consumed.length > 0) {
      const { error } = await admin.storage.from(STAGING_BUCKET).remove(consumed);
      if (error) console.warn("[staged-upload] staging cleanup failed", error);
    }
  }
  return result;
}
