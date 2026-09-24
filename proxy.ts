import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16부터 middleware.ts는 proxy.ts로 이름이 바뀌었고 함수명도 proxy여야 한다.
// (node_modules/next/dist/docs의 버전 16 업그레이드 가이드 참고 — Edge 런타임은
// proxy에서 지원되지 않으며 Node.js 런타임으로 고정된다.)
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 아래를 제외한 모든 경로에서 proxy를 실행한다:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico
     * - 정적 이미지/아이콘/매니페스트 확장자
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
