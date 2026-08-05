import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { serverEnv } from "@/lib/env/server";

export const runtime = "nodejs";

// 인메모리 폴백용 글로벌 맵 선언 (DB 테이블이 생성되지 않았거나 연동에 실패했을 때를 대비)
const globalForVerifications = global as unknown as {
  inMemoryVerifications?: Map<string, { code: string; expiresAt: Date; verified: boolean }>;
};
const inMemoryCache = globalForVerifications.inMemoryVerifications || new Map();
if (!globalForVerifications.inMemoryVerifications) {
  globalForVerifications.inMemoryVerifications = inMemoryCache;
}

export async function POST(request: Request) {
  // 1. 공유 시크릿 인증 확인 (마케팅 사이트로부터의 위임 요청 검증)
  const expected = serverEnv.INQUIRY_INTAKE_SECRET
    ? `Bearer ${serverEnv.INQUIRY_INTAKE_SECRET}`
    : null;
  if (expected && request.headers.get("authorization") !== expected) {
    return NextResponse.json({ ok: false, errors: ["unauthorized"] }, { status: 401 });
  }

  let body: { email: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ["요청 바디를 해석할 수 없습니다."] }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, errors: ["올바른 이메일 주소를 입력해 주세요."] }, { status: 400 });
  }

  // 2. 6자리 인증 코드 생성
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 유효

  let savedInDb = false;

  try {
    const admin = createAdminClient();
    // 기존에 해당 이메일로 생성된 인증 세션들이 있다면 정리를 위해(선택사항) 그냥 추가 적재합니다.
    const { error: insertError } = await admin.from("email_verifications").insert({
      email,
      code,
      expires_at: expiresAt.toISOString(),
      verified: false,
    });

    if (insertError) {
      throw insertError;
    }
    savedInDb = true;
    console.info(`[verification] verification code stored in DB for ${email}`);
  } catch (dbError) {
    // DB 테이블이 아직 없거나 RLS 오류가 발생한 경우 인메모리 캐시로 즉시 폴백
    console.warn(`[verification] DB insertion failed, falling back to in-memory cache:`, dbError);
    inMemoryCache.set(email, {
      code,
      expiresAt,
      verified: false,
    });
  }

  // 3. Resend를 통해 메일 발송
  const subject = "[K SELECT NETWORK] 이메일 인증 번호 안내";
  const textContent = `
안녕하세요, K SELECT NETWORK입니다.

K-Beauty Growth Program 파트너십 신청을 위해 아래 이메일 인증 번호를 입력해 주세요.

인증 번호: [ ${code} ]

해당 인증 번호는 발송 후 5분간 유효합니다.

감사합니다.
K SELECT NETWORK 드림
  `.trim();

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; rounded: 8px;">
      <h2 style="color: #131E2E; margin-bottom: 24px;">이메일 인증 번호 안내</h2>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6;">
        안녕하세요,<br />
        <strong>K SELECT NETWORK</strong>의 K-Beauty Growth Program 파트너십 신청을 위한 이메일 인증 번호입니다.
      </p>
      <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6;">
        아래 인증 번호를 신청서 화면에 입력해 주시기 바랍니다.
      </p>
      <div style="background-color: #f7f9fb; border: 1px solid #e2e8f0; padding: 16px; text-align: center; margin: 24px 0; border-radius: 6px;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #131E2E;">${code}</span>
      </div>
      <p style="font-size: 13px; color: #9e988e; line-height: 1.6; margin-top: 24px;">
        * 본 인증 번호는 발송 시점으로부터 5분간 유효합니다.<br />
        * 본 메일은 발신 전용 메일입니다. 관련 문의는 contact@letusto.com으로 보내주시기 바랍니다.
      </p>
      <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 24px 0;" />
      <p style="font-size: 11px; color: #9e988e; text-align: center; margin: 0;">
        K SELECT NETWORK &middot; K-Beauty Growth Program
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.info(`[verification] Verification code sent to ${email} (DB saved: ${savedInDb})`);
    return NextResponse.json({ ok: true });
  } catch (emailError) {
    console.error(`[verification] Failed to send email to ${email}`, emailError);
    return NextResponse.json({ ok: false, errors: ["인증 이메일 발송에 실패했습니다. 다시 시도해 주세요."] }, { status: 500 });
  }
}
