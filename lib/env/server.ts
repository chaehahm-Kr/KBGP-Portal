import "server-only";
import { z } from "zod";

/**
 * 서버에서만 읽는 환경변수. 이 파일을 클라이언트 컴포넌트에서 import하면
 * "server-only"가 빌드 에러를 발생시켜 실수로 브라우저에 노출되는 것을 막는다.
 */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1, {
    message:
      "SUPABASE_SECRET_KEY가 비어 있습니다. Supabase 대시보드 > Project Settings > API Keys > Secret keys에서 복사하세요.",
  }),
  // 아래 두 값은 선택 사항이다. 없으면 lib/notifications/email.ts가 실제 발송 대신
  // 콘솔에 로그만 남긴다 — 이메일 서비스(Resend 등) 연동 전에도 개발을 막지 않기 위함.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  // Vercel Cron이 /api/cron/* 라우트를 호출할 때 Authorization 헤더로 보내는 값과
  // 대조한다. 운영 배포에서는 반드시 설정해야 한다 — 없으면 해당 라우트가 요청을
  // 전부 거부한다(로컬 개발에서만 헤더 없이도 통과시킨다, lib/env/server.ts 하단 참고).
  CRON_SECRET: z.string().optional(),
  // 마케팅 사이트(kselectnetwork.com)의 /api/applications가 이 값을 Authorization
  // 헤더로 보내야 /api/inquiries가 요청을 받아준다. CRON_SECRET과 같은 이유로
  // 로컬 개발에서는 없어도 통과시키고, 운영에서는 필수로 요구한다.
  INQUIRY_INTAKE_SECRET: z.string().optional(),
});

const parsed = serverEnvSchema.safeParse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  CRON_SECRET: process.env.CRON_SECRET,
  INQUIRY_INTAKE_SECRET: process.env.INQUIRY_INTAKE_SECRET,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  const errorMessage = `서버 전용 환경변수 설정이 올바르지 않습니다:\n${details}\n\n이 값들은 절대 NEXT_PUBLIC_ 접두사를 붙이거나 클라이언트 코드에 노출하지 마세요.`;
  
  if (process.env.NODE_ENV === "production" && !process.env.SUPABASE_SECRET_KEY) {
    console.warn("⚠️ [WARN] 빌드 컴파일 단계 서버 환경변수 누락 우회:", errorMessage);
  } else {
    throw new Error(errorMessage);
  }
}

export const serverEnv = parsed.data || {
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || "dummy-secret-key",
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  CRON_SECRET: process.env.CRON_SECRET,
  INQUIRY_INTAKE_SECRET: process.env.INQUIRY_INTAKE_SECRET,
};
