import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPortalSession } from "@/lib/auth/dal";

/**
 * company-uploads 버킷은 private이므로(10_보안과권한요구사항.md 4번, 직접 URL 접근 금지),
 * 화면에 파일을 보여줄 때는 항상 짧은 시간만 유효한 서명된 URL을 매번 새로 발급한다.
 * 이 호출 자체도 RLS가 적용되는 서버 클라이언트를 쓰므로, 본인 회사 소속이 아니면
 * 애초에 서명이 발급되지 않는다.
 */
export async function getSignedFileUrl(
  path: string,
  expiresInSeconds = 3600,
  bucket: "company-uploads" | "inquiry-uploads" = "company-uploads",
  options?: { download?: string | boolean },
  clientParam?: any
) {
  let supabase = clientParam;
  if (!supabase) {
    try {
      const session = await verifyPortalSession();
      supabase = session.isImpersonating ? createAdminClient() : await createClient();
    } catch {
      supabase = await createClient();
    }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, options);

  if (error || !data) return null;
  return data.signedUrl;
}
