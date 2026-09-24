/**
 * Helper to extract user-friendly error messages from Server Actions / Server Components
 * Prevents internal Next.js production digest error strings from showing up on UI.
 */
export function formatActionError(err: any, fallbackMessage: string = "작업 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."): string {
  if (!err) return fallbackMessage;
  const msg = typeof err === "string" ? err : err.message;
  if (!msg || typeof msg !== "string") return fallbackMessage;

  // Mask generic Next.js production digest strings
  if (
    msg.includes("Server Components render") ||
    msg.includes("omitted in production builds") ||
    msg.includes("digest property is included")
  ) {
    return fallbackMessage;
  }

  return msg;
}
