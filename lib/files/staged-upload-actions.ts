"use server";

import { createStagedUploadTargets } from "@/lib/files/staged-upload";

/** 클라이언트가 대용량 파일을 Storage에 직접 올릴 서명 업로드 토큰을 요청한다. */
export async function requestStagedUploadAction(files: { name: string; size: number }[]) {
  return createStagedUploadTargets(files);
}
