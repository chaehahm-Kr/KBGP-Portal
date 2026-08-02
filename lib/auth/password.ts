import { z } from "zod";

/**
 * 10_보안과권한요구사항.md 2번: "비밀번호는 최소 길이와 조합 규칙을 강제합니다
 * (예: 8자 이상, 영문+숫자 조합)." 화면에도 이 규칙을 그대로 안내한다.
 *
 * Supabase 프로젝트 대시보드(Authentication > Policies > Password Requirements)에도
 * 동일한 최소 길이(8자)를 설정해두는 것을 권장한다 — 이 zod 검증은 즉각적인 사용자
 * 피드백용이고, 최종 강제는 Supabase Auth 자체 설정이 한 번 더 담당한다.
 */
export const PASSWORD_RULE_DESCRIPTION = "8자 이상, 영문과 숫자를 각각 하나 이상 포함";

export const passwordSchema = z
  .string()
  .min(8, { message: `비밀번호는 ${PASSWORD_RULE_DESCRIPTION}해야 합니다.` })
  .regex(/[a-zA-Z]/, { message: "비밀번호에 영문을 하나 이상 포함해주세요." })
  .regex(/[0-9]/, { message: "비밀번호에 숫자를 하나 이상 포함해주세요." });
