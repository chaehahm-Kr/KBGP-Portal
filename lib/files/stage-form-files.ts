"use client";

import { createClient } from "@/lib/supabase/client";
import { requestStagedUploadAction } from "@/lib/files/staged-upload-actions";
import {
  STAGING_BUCKET,
  encodeStagedFile,
  needsStaging,
} from "@/lib/files/staged-upload-shared";

/**
 * 서버 액션에 넘기기 직전의 FormData를 받아, 파일 합계가 Vercel 요청 한도에
 * 걸릴 크기면 파일을 Storage에 먼저 올리고 마커로 바꾼 FormData를 돌려준다.
 * 작은 요청은 원본을 그대로 돌려주므로 기존 동작과 같다.
 * (서버 쪽 짝: lib/files/staged-upload.ts 의 unstageFormData)
 */
export async function stageLargeFiles(formData: FormData): Promise<FormData> {
  const entries = Array.from(formData.entries());
  const files = entries
    .map(([, v]) => v)
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (!needsStaging(files)) {
    return formData;
  }

  const res = await requestStagedUploadAction(
    files.map((f) => ({ name: f.name, size: f.size }))
  );
  if (!res.ok) {
    throw new Error(res.error);
  }

  const supabase = createClient();
  const markers = new Map<File, string>();
  await Promise.all(
    files.map(async (file, i) => {
      const target = res.targets[i];
      const { error } = await supabase.storage
        .from(STAGING_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (error) {
        throw new Error(`파일 업로드에 실패했습니다: ${file.name}`);
      }
      markers.set(
        file,
        encodeStagedFile({
          path: target.path,
          name: file.name,
          type: file.type,
          size: file.size,
        })
      );
    })
  );

  const staged = new FormData();
  for (const [key, value] of entries) {
    const marker = value instanceof File ? markers.get(value) : undefined;
    staged.append(key, marker ?? value);
  }
  return staged;
}

/**
 * File을 인자로 직접 받는 서버 액션용. 크기가 크면 마커 문자열로 바꿔 돌려준다.
 * (서버 쪽 짝: resolveStagedFile)
 */
export async function stageLargeFile(file: File | null | undefined): Promise<File | string | null> {
  if (!file) return null;
  const fd = new FormData();
  fd.append("file", file);
  return (await stageLargeFiles(fd)).get("file");
}
