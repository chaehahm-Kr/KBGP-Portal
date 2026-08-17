export type ErrorCode =
  | "USER_ALREADY_IN_COMPANY"
  | "EMAIL_ALREADY_IN_OTHER_COMPANY"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "REQUIRED_FIELD"
  | "PERMISSION_DENIED"
  | "SAVE_FAILED"
  | "USER_CREATE_FAILED"
  | "INVITATION_FAILED"
  | "SESSION_EXPIRED";

export interface BilingualMessage {
  code: ErrorCode;
  ko: string;
  en: string;
}

export const BILINGUAL_ERRORS: Record<ErrorCode, BilingualMessage> = {
  USER_ALREADY_IN_COMPANY: {
    code: "USER_ALREADY_IN_COMPANY",
    ko: "이미 등록된 사용자입니다.",
    en: "This user is already registered.",
  },
  EMAIL_ALREADY_IN_OTHER_COMPANY: {
    code: "EMAIL_ALREADY_IN_OTHER_COMPANY",
    ko: "이미 등록된 사용자입니다.",
    en: "This user is already registered.",
  },
  INVALID_EMAIL: {
    code: "INVALID_EMAIL",
    ko: "올바른 이메일 주소를 입력해주세요.",
    en: "Please enter a valid email address.",
  },
  INVALID_PHONE: {
    code: "INVALID_PHONE",
    ko: "올바른 전화번호를 입력해주세요.",
    en: "Please enter a valid phone number.",
  },
  REQUIRED_FIELD: {
    code: "REQUIRED_FIELD",
    ko: "필수 정보를 입력해주세요.",
    en: "Please complete the required information.",
  },
  PERMISSION_DENIED: {
    code: "PERMISSION_DENIED",
    ko: "이 작업을 수행할 권한이 없습니다.",
    en: "You do not have permission to perform this action.",
  },
  SAVE_FAILED: {
    code: "SAVE_FAILED",
    ko: "정보를 저장하지 못했습니다. 다시 시도해주세요.",
    en: "Unable to save the information. Please try again.",
  },
  USER_CREATE_FAILED: {
    code: "USER_CREATE_FAILED",
    ko: "사용자를 추가하지 못했습니다. 입력 정보를 확인한 후 다시 시도해주세요.",
    en: "Unable to add the user. Please review the information and try again.",
  },
  INVITATION_FAILED: {
    code: "INVITATION_FAILED",
    ko: "초대를 보내지 못했습니다. 입력 정보를 확인한 후 다시 시도해주세요.",
    en: "Unable to send the invitation. Please review the information and try again.",
  },
  SESSION_EXPIRED: {
    code: "SESSION_EXPIRED",
    ko: "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
    en: "Your session has expired. Please sign in again.",
  },
};

/**
 * Returns a bilingual string formatted as:
 * 한국어
 * English
 */
export function formatBilingualText(ko: string, en: string): string {
  return `${ko}\n${en}`;
}

/**
 * Returns formatted bilingual error message by ErrorCode
 */
export function getBilingualError(code: ErrorCode): string {
  const item = BILINGUAL_ERRORS[code];
  if (!item) return formatBilingualText("오류가 발생했습니다.", "An error occurred.");
  return formatBilingualText(item.ko, item.en);
}
