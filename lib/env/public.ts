import { z } from "zod";

/**
 * 브라우저(클라이언트)로 노출되어도 되는 환경변수만 여기 둔다.
 * NEXT_PUBLIC_ 접두사가 붙은 값은 빌드 시 클라이언트 번들에 그대로 포함되므로,
 * 비밀키·서비스 롤 키 등은 절대 이 파일에 추가하지 않는다 (→ lib/env/server.ts).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL은 Supabase 프로젝트의 Project URL이어야 합니다.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, {
    message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 비어 있습니다.",
  }),
  NEXT_PUBLIC_SITE_URL: z.string().url({
    message: "NEXT_PUBLIC_SITE_URL은 이 포털이 배포된 주소여야 합니다 (예: https://portal.kselectnetwork.com).",
  }),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `환경변수 설정이 올바르지 않습니다:\n${details}\n\n.env.local.example을 복사해 .env.local을 만들고 값을 채워주세요.`
  );
}

export const publicEnv = parsed.data;
