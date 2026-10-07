import "server-only";
import crypto from "crypto";
import { serverEnv } from "@/lib/env/server";

/**
 * 이메일 인증번호(OTP) 확인을 통과했다는 서버 서명 증표 (PORT-SEC-OTP-001).
 *
 * 예전에는 activatePartnerAccountAction(userId, password)가 OTP 확인 여부를 전혀
 * 보지 않아, 사업자등록번호·이메일로 userId 만 알아내면 OTP 단계를 건너뛰고 초대
 * 대기 계정의 비밀번호를 설정할 수 있었다. 이제 OTP 확인 성공 시에만 이 증표를
 * 발급하고, 비밀번호 설정은 증표의 서명·만료·대상 사용자를 모두 확인해야 진행된다.
 */
const PROOF_TTL_MS = 10 * 60 * 1000;
const PURPOSE = "partner-email-verified";

type ProofPayload = { purpose: string; userId: string; exp: number };

function sign(data: string): string {
  return crypto.createHmac("sha256", serverEnv.SUPABASE_SECRET_KEY).update(`${PURPOSE}:${data}`).digest("base64url");
}

export function issueEmailVerificationProof(userId: string): string {
  const payload: ProofPayload = { purpose: PURPOSE, userId, exp: Date.now() + PROOF_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyEmailVerificationProof(proof: string | null | undefined, userId: string): boolean {
  if (!proof || typeof proof !== "string") return false;
  const [body, signature] = proof.split(".");
  if (!body || !signature) return false;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ProofPayload;
    return payload.purpose === PURPOSE && payload.userId === userId && payload.exp > Date.now();
  } catch {
    return false;
  }
}
