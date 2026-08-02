import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

/**
 * 서버 컴포넌트/서버 액션/라우트 핸들러에서 사용하는 Supabase 클라이언트.
 * 매 요청마다 새로 만들어야 한다 (클라이언트를 재사용하거나 모듈 스코프에 캐시하지 말 것).
 *
 * anon key로 생성되므로 이 클라이언트를 통한 모든 조회·수정은 데이터베이스의
 * RLS(Row Level Security) 정책을 그대로 통과한다 — 데이터 격리(10_보안과권한요구사항.md 1번)의
 * 실제 강제 지점이 바로 이 클라이언트다. RLS를 우회해야 하는 극히 예외적인 경우에만
 * lib/supabase/admin.ts를 별도로 사용한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서 호출되면 쿠키를 쓸 수 없다 — proxy.ts가 세션 갱신을
            // 담당하므로 여기서는 무시해도 안전하다.
          }
        },
      },
    }
  );
}
