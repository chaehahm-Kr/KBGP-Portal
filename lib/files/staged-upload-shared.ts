/**
 * 대용량 파일 "스테이징 업로드" — 클라이언트/서버 공용 상수와 마커 형식.
 *
 * 왜 필요한가: Vercel 서버리스 함수는 요청 본문이 약 4.5MB를 넘으면 함수에
 * 도달하기도 전에 413 FUNCTION_PAYLOAD_TOO_LARGE로 거절한다. 그런데 앱은 파일당
 * 10MB(영상 50MB)까지 허용하고 파일을 서버 액션(FormData)으로 보내므로, 운영
 * 환경에서는 4.5MB 초과 파일 업로드가 전부 실패했다.
 *
 * 해결: 요청 본문이 커질 FormData의 파일은 브라우저가 Supabase Storage의
 * `_staging/` 경로에 직접(서명 업로드 URL) 올리고, FormData에는 아래 마커 문자열만
 * 남긴다. 서버 액션은 시작 시 `unstageFormData()`로 마커를 다시 File로 되돌리므로
 * 기존 검증(매직 바이트 등)·저장 로직은 그대로 동작한다.
 */

export const STAGING_BUCKET = "company-uploads";
export const STAGING_ROOT = "_staging";
export const STAGED_FILE_MARKER = "__ksn_staged_file__:";

/**
 * FormData의 파일 합계가 이 값을 넘으면 스테이징한다. Vercel 한도(4.5MB)에서
 * 텍스트 필드·multipart 오버헤드 여유분을 뺀 값. 이 이하는 기존 경로 그대로다.
 */
export const DIRECT_BODY_BUDGET_BYTES = 3.5 * 1024 * 1024;

/** 스테이징 1회 요청에서 허용하는 최대 파일 크기 (Supabase 기본 업로드 한도와 같음). */
export const MAX_STAGED_FILE_BYTES = 50 * 1024 * 1024;

export type StagedFileRef = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export function encodeStagedFile(ref: StagedFileRef): string {
  return `${STAGED_FILE_MARKER}${JSON.stringify(ref)}`;
}

export function decodeStagedFile(value: unknown): StagedFileRef | null {
  if (typeof value !== "string" || !value.startsWith(STAGED_FILE_MARKER)) {
    return null;
  }
  try {
    const parsed = JSON.parse(value.slice(STAGED_FILE_MARKER.length)) as StagedFileRef;
    if (
      typeof parsed.path !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.type !== "string" ||
      typeof parsed.size !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 업로드 대상 파일들의 합계가 직접 전송 예산을 넘는지. */
export function needsStaging(files: { size: number }[]): boolean {
  const total = files.reduce((sum, f) => sum + f.size, 0);
  return total > DIRECT_BODY_BUDGET_BYTES;
}
