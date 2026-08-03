import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env/public";

const AREAS: { prefix: string; login: string; publicPaths: string[] }[] = [
  {
    prefix: "/portal",
    login: "/portal/login",
    publicPaths: [
      "/portal/login",
      "/portal/signup",
      "/portal/reset-password",
      // 초대·비밀번호 재설정 이메일 링크는 URL 프래그먼트/쿼리에 토큰을 담아오는데,
      // 이걸 세션으로 바꾸는 처리는 브라우저의 Supabase 클라이언트가 페이지 로드 후에야
      // 수행한다. 즉 이 경로로 처음 들어오는 요청 시점에는 proxy가 아직 쿠키에서
      // 세션을 못 찾는 게 정상이므로, 로그인 화면으로 되돌리지 않고 통과시켜야 한다.
      "/portal/invite/accept",
    ],
  },
  {
    prefix: "/admin",
    login: "/admin/login",
    // /portal 쪽과 같은 이유(위 주석 참고) — 직원 초대 이메일 링크도 URL
    // 프래그먼트의 토큰을 브라우저에서 세션으로 바꾸는 처리가 페이지 로드 후에
    // 일어나므로, 최초 요청 시점에는 통과시켜야 한다.
    publicPaths: ["/admin/login", "/admin/invite/accept"],
  },
];

/**
 * 루트 proxy.ts에서 호출되는 세션 갱신 로직.
 * Supabase 공식 Next.js SSR 가이드(2026년 기준, Next.js 16의 proxy.ts 컨벤션 반영)를
 * 그대로 따른다 — 특히 아래 두 가지를 절대 건드리지 말 것:
 *   1. createServerClient와 getClaims() 사이에 다른 코드를 넣지 않는다.
 *   2. 반환하는 supabaseResponse의 쿠키를 그대로 유지한다.
 * 둘 중 하나라도 어기면 사용자가 무작위로 로그아웃되는, 디버깅하기 매우 어려운
 * 버그가 생긴다 (Supabase 공식 문서의 경고를 그대로 옮김).
 *
 * 여기서는 "로그인한 사람인가"만 빠르게 확인한다(getClaims()는 로컬에서 JWT
 * 서명만 검증하므로 데이터베이스 조회가 없어 모든 요청에서 실행해도 가볍다).
 * portal 계정이 /admin에 들어오는 것처럼 "올바른 area인가"에 대한 최종 판단은
 * 항상 lib/auth/dal.ts가 각 화면에서 담당한다 — proxy는 1차 방어선일 뿐이다.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const prefix = pathname.startsWith("/admin") ? "admin-" : pathname.startsWith("/portal") ? "portal-" : "";

  request.headers.set("x-url", pathname);
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          const allCookies = request.cookies.getAll();
          if (!prefix) return allCookies;
          return allCookies
            .filter((cookie) => {
              if (cookie.name.startsWith("sb-")) return false;
              if (cookie.name.startsWith("admin-sb-") && prefix !== "admin-") return false;
              if (cookie.name.startsWith("portal-sb-") && prefix !== "portal-") return false;
              return true;
            })
            .map((cookie) => {
              if (cookie.name.startsWith(prefix)) {
                return {
                  name: cookie.name.substring(prefix.length),
                  value: cookie.value,
                };
              }
              return cookie;
            });
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
            request.cookies.set(mappedName, value);
          });
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const mappedName = prefix && name.startsWith("sb-") ? `${prefix}${name}` : name;
            supabaseResponse.cookies.set(mappedName, value, options);
          });
        },
      },
    }
  );

  // createServerClient와 getUser() 사이에는 다른 코드를 두지 않는다 (위 주석 참고).
  // getUser()를 호출해야 만료된 session이 refresh token을 이용하여 쿠키(setAll)에 의해 자동 갱신됩니다.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    console.error("proxy.ts updateSession getUser error:", userError);
  }
  const isAuthenticated = Boolean(user);

  const area = AREAS.find(({ prefix }) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  const isPublicPath = area?.publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (area && !isAuthenticated && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = area.login;
    return NextResponse.redirect(url);
  }

  // supabaseResponse를 그대로 반환한다 — 새 응답 객체를 만들어야 한다면 쿠키를
  // 반드시 옮겨 담아야 한다 (Supabase 공식 문서 경고).
  return supabaseResponse;
}
