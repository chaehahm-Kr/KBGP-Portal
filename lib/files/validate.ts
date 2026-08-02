import "server-only";

export type AllowedFileCategory = "image" | "document" | "spreadsheet";

// 09_알림및문서관리규칙.md Part 2 공통 규칙: 파일당 기본 10MB.
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

const MAGIC_BYTE_SIGNATURES: {
  category: AllowedFileCategory;
  mime: string;
  matches: (head: Uint8Array) => boolean;
}[] = [
  {
    category: "image",
    mime: "image/jpeg",
    matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  },
  {
    category: "image",
    mime: "image/png",
    matches: (h) => h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47,
  },
  {
    category: "image",
    mime: "image/webp",
    matches: (h) =>
      h[0] === 0x52 &&
      h[1] === 0x49 &&
      h[2] === 0x46 &&
      h[3] === 0x46 &&
      h[8] === 0x57 &&
      h[9] === 0x45 &&
      h[10] === 0x42 &&
      h[11] === 0x50,
  },
  {
    category: "document",
    mime: "application/pdf",
    matches: (h) => h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46,
  },
  {
    // .xlsx는 ZIP 컨테이너 형식이라 정확한 서명은 아니지만, "확장자만 바꾼 실행파일"류의
    // 명백한 위조는 이 정도의 매직 바이트 확인으로도 걸러진다.
    category: "spreadsheet",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    matches: (h) => h[0] === 0x50 && h[1] === 0x4b,
  },
];

export type FileValidationResult =
  | { ok: true; detectedMime: string }
  | { ok: false; error: string };

/**
 * 09_알림및문서관리규칙.md Part 2, 10_보안과권한요구사항.md 4번:
 * "파일 업로드 시 파일 내용이 실제로 신고된 형식과 일치하는지 확인합니다
 * (확장자만 바꾼 악성파일 방지)". 브라우저가 보낸 file.type이나 확장자를 그대로
 * 믿지 않고, 파일 내용 앞부분의 매직 바이트를 직접 읽어 검증한다.
 *
 * CSV는 일반 텍스트라 매직 바이트가 없으므로 확장자로만 판단한다.
 *
 * 바이러스/악성코드 전체 스캔(9번 문서 7번, 권장 사항)은 이 스켈레톤 범위 밖이다 —
 * 운영 전 Storage 업로드 파이프라인 앞단에 별도 스캔 서비스 연동을 권장한다.
 */
export async function validateUploadedFile(
  file: File,
  allowedCategories: AllowedFileCategory[]
): Promise<FileValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: "빈 파일은 업로드할 수 없습니다." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "파일 용량은 10MB를 넘을 수 없습니다." };
  }

  if (
    allowedCategories.includes("spreadsheet") &&
    file.name.toLowerCase().endsWith(".csv")
  ) {
    return { ok: true, detectedMime: "text/csv" };
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const match = MAGIC_BYTE_SIGNATURES.find(
    (entry) =>
      allowedCategories.includes(entry.category) && entry.matches(head)
  );

  if (!match) {
    return {
      ok: false,
      error:
        "지원하지 않는 파일 형식입니다. 파일 내용이 실제 이미지/문서 형식과 일치하는지 확인해주세요.",
    };
  }

  return { ok: true, detectedMime: match.mime };
}
