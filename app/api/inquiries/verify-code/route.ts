import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";

export const runtime = "nodejs";

// 인메모리 폴백용 글로벌 맵 선언
const globalForVerifications = global as unknown as {
  inMemoryVerifications?: Map<string, { code: string; expiresAt: Date; verified: boolean }>;
};
const inMemoryCache = globalForVerifications.inMemoryVerifications || new Map();

export async function POST(request: Request) {
  // 1. 공유 시크릿 인증 확인
  const expected = serverEnv.INQUIRY_INTAKE_SECRET
    ? `Bearer ${serverEnv.INQUIRY_INTAKE_SECRET}`
    : null;
  if (expected && request.headers.get("authorization") !== expected) {
    return NextResponse.json({ ok: false, errors: ["unauthorized"] }, { status: 401 });
  }

  let body: { email: string; code: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["요청 바디를 해석할 수 없습니다."] }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();

  if (!email || !code) {
    return NextResponse.json({ ok: false, errors: ["이메일과 인증 번호를 모두 입력해 주세요."] }, { status: 400 });
  }

  // 2. DB 및 인메모리 인증번호 매칭 체크
  let verified = false;

  try {
    const admin = createAdminClient();
    // 가장 최근에 생성된 해당 이메일의 유효한 인증 코드를 조회
    const { data: verifications, error: queryError } = await admin
      .from("email_verifications")
      .select("id, code, expires_at, verified")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (queryError) {
      throw queryError;
    }

    if (verifications && verifications.length > 0) {
      const v = verifications[0];
      const codeMatch = v.code.trim() === code;
      const notExpired = new Date(v.expires_at) > new Date();

      if (codeMatch && notExpired) {
        // DB 상태를 verified = true 로 업데이트
        const { error: updateError } = await admin
          .from("email_verifications")
          .update({ verified: true })
          .eq("id", v.id);

        if (!updateError) {
          verified = true;
        }
      }
    }
  } catch (dbError) {
    console.warn(`[verification] DB verification query failed, trying in-memory fallback:`, dbError);
  }

  // DB에서 인증 성공하지 못했을 경우 인메모리 캐시에서 2차 확인
  if (!verified) {
    const cached = inMemoryCache.get(email);
    if (cached) {
      const codeMatch = cached.code.trim() === code;
      const notExpired = cached.expiresAt > new Date();

      if (codeMatch && notExpired) {
        cached.verified = true;
        inMemoryCache.set(email, cached);
        verified = true;
      }
    }
  }

  if (verified) {
    console.info(`[verification] Email verification succeeded for ${email}`);
    return NextResponse.json({ ok: true });
  } else {
    console.warn(`[verification] Email verification failed for ${email} with code ${code}`);
    return NextResponse.json({ ok: false, errors: ["인증 번호가 일치하지 않거나 유효 기간이 만료되었습니다."] }, { status: 400 });
  }
}
