"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  verifyPartnerApplicationAction,
  activatePartnerAccountAction,
  verifyBrandInvitationTokenAction,
  sendInvitationVerificationCodeAction,
  verifyInvitationCodeAction,
  activatePartnerAccountWithTokenAction,
} from "@/lib/auth/signup-verification";
import { PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400";
const labelClass = "block text-xs font-semibold text-zinc-300 mb-1";

type StepState =
  | "token_loading"
  | "verify"
  | "email_confirm"
  | "otp_verify"
  | "setPassword"
  | "success"
  | "result_A"
  | "result_B"
  | "result_C"
  | "error_expired"
  | "error_used"
  | "error_invalid";

export function PortalVerificationSignup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  // Initial step: If token exists in URL, start immediately in token_loading to avoid generic form flash
  const [step, setStep] = useState<StepState>(
    tokenFromUrl ? "token_loading" : "verify"
  );

  // Public Application Inputs
  const [brn, setBrn] = useState("");
  const [email, setEmail] = useState("");

  // OTP Verification Inputs
  const [otpCode, setOtpCode] = useState("");

  // Password Inputs
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // States
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const [verifiedUser, setVerifiedUser] = useState<{
    userId: string;
    companyName: string;
    contactName: string;
    email: string;
  } | null>(null);

  const [activeEmail, setActiveEmail] = useState("");

  // PORT-ONB-003: Auto-verify Token from Email CTA link on mount
  useEffect(() => {
    if (tokenFromUrl) {
      setInviteToken(tokenFromUrl);
      setPending(true);
      setError(null);
      verifyBrandInvitationTokenAction(tokenFromUrl)
        .then((res) => {
          setPending(false);
          if (res.success && res.case === "D") {
            setVerifiedUser({
              userId: res.userId,
              companyName: res.companyName,
              contactName: res.contactName,
              email: res.email,
            });
            setEmail(res.email);
            setStep("email_confirm");
          } else if (res.case === "EXPIRED") {
            setError(res.message);
            setStep("error_expired");
          } else if (res.case === "USED") {
            setActiveEmail((res as any).email || "");
            setError(res.message);
            setStep("error_used");
          } else if (res.case === "INVALID") {
            setError(res.message);
            setStep("error_invalid");
          } else {
            setError(res.message || "초대 링크가 유효하지 않거나 만료되었습니다.");
            setStep("error_invalid");
          }
        })
        .catch((err) => {
          setPending(false);
          setError(err?.message || "초대 정보 검증 중 오류가 발생했습니다.");
          setStep("error_invalid");
        });
    }
  }, [tokenFromUrl]);

  // 1단계: 파트너십 신청 조회 (Public Application BRN + Email path)
  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await verifyPartnerApplicationAction(brn, email);
      setPending(false);

      if (res.success) {
        // Case D: 가입 가능 상태
        setVerifiedUser({
          userId: res.userId,
          companyName: res.companyName,
          contactName: res.contactName,
          email: res.email,
        });
        setStep("setPassword");
      } else {
        // Case A, B, C 분기
        if (res.case === "A") {
          setStep("result_A");
          setError(res.message);
        } else if (res.case === "B") {
          setStep("result_B");
        } else if (res.case === "C") {
          setActiveEmail(res.email);
          setStep("result_C");
        }
      }
    } catch (err: any) {
      setPending(false);
      setError(err?.message || "서버 통신 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  }

  // Admin Direct Invite: Send 6-digit OTP code to email
  async function handleSendOtp() {
    if (!verifiedUser?.email) {
      setError("초청 계정 이메일 정보가 없습니다.");
      return;
    }
    setError(null);
    setOtpNotice(null);
    setPending(true);

    try {
      const res = await sendInvitationVerificationCodeAction(verifiedUser.email);
      setPending(false);
      if (res.success) {
        setOtpNotice(`${verifiedUser.email} (으)로 6자리 인증 번호가 발송되었습니다.`);
        setStep("otp_verify");
      } else {
        setError(res.error || "인증 번호 발송에 실패했습니다.");
      }
    } catch (err: any) {
      setPending(false);
      setError(err?.message || "인증 번호 발송 중 오류가 발생했습니다.");
    }
  }

  // Admin Direct Invite: Verify 6-digit OTP code
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!verifiedUser?.email) return;
    setError(null);
    setPending(true);

    try {
      const res = await verifyInvitationCodeAction(verifiedUser.email, otpCode);
      setPending(false);
      if (res.success) {
        setStep("setPassword");
      } else {
        setError(res.error || "인증 번호가 일치하지 않습니다.");
      }
    } catch (err: any) {
      setPending(false);
      setError(err?.message || "인증 번호 확인 중 오류가 발생했습니다.");
    }
  }

  // 비밀번호 설정 및 계정 활성화 (Token / Public 공통)
  async function handleActivate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!verifiedUser) {
      setError("검증된 사용자 세션이 없습니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setPending(true);

    try {
      let res: { success: boolean; error?: string; email?: string };
      if (inviteToken) {
        res = await activatePartnerAccountWithTokenAction(inviteToken, password);
      } else {
        res = await activatePartnerAccountAction(verifiedUser.userId, password);
      }
      setPending(false);

      if (res.success) {
        setStep("success");
      } else {
        setError(res.error || "비밀번호 설정 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setPending(false);
      setError(err?.message || "비밀번호 설정 처리 중 문제가 발생했습니다.");
    }
  }

  // 0. Token Check Loading State (Prevents generic signup flash)
  if (step === "token_loading") {
    return (
      <div className="space-y-6 py-8 text-center">
        <div className="flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">초청 정보 확인 중</h2>
          <p className="text-xs text-zinc-400">
            초청 토큰 및 파트너 계정 승인 상태를 검증하고 있습니다. 잠시만 기다려 주세요...
          </p>
        </div>
      </div>
    );
  }

  // 1. 조회 단계 폼 (Public Marketing Application 2-Path Onboarding UI)
  if (step === "verify") {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div className="space-y-1.5 text-center sm:text-left">
          <h1 className="text-xl font-bold text-white">
            파트너십 가입 내역 확인
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            K SELECT NETWORK 파트너십 신청 여부에 따라 아래에서 해당하는 절차를 선택해 주세요.
          </p>
        </div>

        {/* SECTION 1: 이미 파트너십을 신청했습니다 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-zinc-950">
              1
            </span>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">
                이미 파트너십을 신청하셨나요?
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                kselectnetwork.com에서 이미 파트너십 신청서를 제출하셨다면, 사업자등록번호와 신청 당시 이메일 주소를 입력하여 신청 내역을 확인해 주세요.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-3.5 pt-1">
            <div>
              <label htmlFor="brn" className={labelClass}>
                사업자등록번호
              </label>
              <input
                id="brn"
                type="text"
                placeholder="사업자등록번호 (대시 없이 숫자만 입력)"
                required
                value={brn}
                onChange={(e) => setBrn(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                * 사업자등록번호는 대시(-) 없이 입력해 주세요.
              </p>
            </div>

            <div>
              <label htmlFor="email" className={labelClass}>
                이메일 주소
              </label>
              <input
                id="email"
                type="email"
                placeholder="신청 시 입력한 이메일 (example@company.com)"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400 font-medium" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer h-10 shadow-sm"
            >
              {pending ? "조회 중..." : "신청 내역 확인"}
            </button>
          </form>
        </div>

        {/* SECTION 2: 아직 파트너십을 신청하지 않았습니다 */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-extrabold text-zinc-300 border border-zinc-700">
              2
            </span>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">
                아직 파트너십을 신청하지 않으셨나요?
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                K SELECT NETWORK 파트너가 되시려면 먼저 파트너십 신청 및 자격 확인 절차를 진행해 주세요.
              </p>
            </div>
          </div>

          <div className="pt-1">
            <a
              href="https://www.kselectnetwork.com/#eligibility"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 hover:border-zinc-500 transition-colors cursor-pointer shadow-sm"
            >
              <span>파트너십 신청하기</span>
              <span className="text-xs font-bold">→</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Admin Direct Invite: Step 2 - Confirm Invited Email & Trigger OTP
  if (step === "email_confirm") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 text-[11px] font-bold">
            어드민 직접 초청 파트너
          </div>
          <h1 className="text-xl font-bold text-white">
            브랜드 포털 계정 활성화
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            초대받으신 담당자 계정 정보를 확인하고 이메일 소유 인증을 진행해 주세요.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-3.5 shadow-sm">
          <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/80">
            <span className="text-xs text-zinc-400 font-medium">파트너사명</span>
            <span className="text-xs font-bold text-white">{verifiedUser?.companyName}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/80">
            <span className="text-xs text-zinc-400 font-medium">담당자</span>
            <span className="text-xs font-bold text-white">{verifiedUser?.contactName}</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-xs text-zinc-400 font-medium">초청 이메일</span>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-800/40">
              {verifiedUser?.email}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-medium" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSendOtp}
          disabled={pending}
          className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer h-10 shadow-sm"
        >
          {pending ? "인증 번호 발송 중..." : "이메일 인증 번호 받기"}
        </button>
      </div>
    );
  }

  // Admin Direct Invite: Step 3 - Enter & Verify 6-digit OTP
  if (step === "otp_verify") {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold">
            이메일 인증 번호 발송됨
          </div>
          <h1 className="text-xl font-bold text-white">
            이메일 인증 번호 입력
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            <strong className="text-white">{verifiedUser?.email}</strong> (으)로 발송된 6자리 인증 번호를 입력해 주세요. (5분간 유효)
          </p>
        </div>

        {otpNotice && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 font-medium">
            {otpNotice}
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp" className={labelClass}>
              6자리 인증 번호
            </label>
            <input
              id="otp"
              type="text"
              maxLength={6}
              placeholder="123456"
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-center text-xl font-mono tracking-[0.5em] font-bold text-white placeholder:text-zinc-600 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-medium" role="alert">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={pending}
              className="w-1/3 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50 cursor-pointer h-10"
            >
              재발송
            </button>
            <button
              type="submit"
              disabled={pending || otpCode.length !== 6}
              className="w-2/3 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer h-10 shadow-sm"
            >
              {pending ? "인증 확인 중..." : "인증 번호 확인"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Step 4. 비밀번호 설정 화면 (Token & Public Common)
  if (step === "setPassword") {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold">
            인증 완료
          </div>
          <h1 className="text-xl font-bold text-white">
            비밀번호 설정
          </h1>
          <div className="text-xs text-zinc-400 space-y-1 bg-zinc-950/60 rounded-lg p-3 border border-zinc-800 mt-2">
            <div>• <strong className="text-zinc-300">회사명</strong>: {verifiedUser?.companyName}</div>
            <div>• <strong className="text-zinc-300">담당자</strong>: {verifiedUser?.contactName}</div>
            <div>• <strong className="text-zinc-300">계정(이메일)</strong>: {verifiedUser?.email}</div>
          </div>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label htmlFor="pass" className={labelClass}>
              새 비밀번호
            </label>
            <div className="relative mt-1">
              <input
                id="pass"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-zinc-700 bg-zinc-950 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              {PASSWORD_RULE_DESCRIPTION}
            </p>
          </div>

          <div>
            <label htmlFor="passConfirm" className={labelClass}>
              비밀번호 확인
            </label>
            <div className="relative mt-1">
              <input
                id="passConfirm"
                type={showPasswordConfirm ? "text" : "password"}
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="block w-full rounded-md border border-zinc-700 bg-zinc-950 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
              />
              <button
                type="button"
                onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPasswordConfirm ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 font-medium" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50 cursor-pointer h-10 shadow-sm"
          >
            {pending ? "활성화 처리 중..." : "가입 및 계정 활성화 완료"}
          </button>
        </form>
      </div>
    );
  }

  // Step 5. 성공 완료 화면
  if (step === "success") {
    const targetEmail = verifiedUser?.email || activeEmail;
    const loginUrl = targetEmail
      ? `/portal/login?email=${encodeURIComponent(targetEmail)}&signup_success=true`
      : `/portal/login?signup_success=true`;

    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-950/60 border border-emerald-500/30 p-3.5 text-emerald-400">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            가입 및 비밀번호 설정 완료!
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            파트너 계정이 성공적으로 활성화되었습니다. 이제 설정하신 비밀번호로 로그인하여 브랜드 온보딩 절차를 진행해 주세요.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href={loginUrl}
            className="block w-full text-center rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 shadow-sm"
          >
            브랜드 포털 로그인 바로가기 →
          </Link>
        </div>
      </div>
    );
  }

  // Dedicated Error State 1: Expired Token
  if (step === "error_expired") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-950/60 border border-amber-500/30 p-3.5 text-amber-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">초청 링크 만료</h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            {error || "초청 링크 유효 기간(7일)이 만료되었습니다. 관리자에게 재초대를 요청해 주세요."}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/portal/login"
            className="block w-full text-center rounded-md bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
          >
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    );
  }

  // Dedicated Error State 2: Used Token
  if (step === "error_used") {
    const loginUrl = activeEmail
      ? `/portal/login?email=${encodeURIComponent(activeEmail)}`
      : `/portal/login`;

    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-950/60 border border-emerald-500/30 p-3.5 text-emerald-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">이미 사용된 초청 링크</h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            이미 파트너 포털 가입 및 비밀번호 설정이 완료된 계정입니다. 가입하신 계정으로 로그인해 주세요.
          </p>
          {activeEmail && (
            <div className="mt-2 bg-zinc-950 rounded p-2.5 text-xs font-mono text-emerald-400 border border-zinc-800">
              {activeEmail}
            </div>
          )}
        </div>
        <div className="pt-2">
          <Link
            href={loginUrl}
            className="block w-full text-center rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 shadow-sm"
          >
            로그인 하러 가기 →
          </Link>
        </div>
      </div>
    );
  }

  // Dedicated Error State 3: Invalid / Cancelled Token
  if (step === "error_invalid") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-rose-950/60 border border-rose-500/30 p-3.5 text-rose-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">유효하지 않은 초청 링크</h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            {error || "유효하지 않거나 취소된 초청 링크입니다. 어드민 관리자에게 문의해 주세요."}
          </p>
        </div>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              setInviteToken(null);
              setStep("verify");
              setError(null);
            }}
            className="block w-full text-center rounded-md bg-zinc-900 border border-zinc-700 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
          >
            신청 내역 직접 조회하기
          </button>
        </div>
      </div>
    );
  }

  // Case A. 입점 신청 내역을 찾을 수 없는 경우 (Public Flow)
  if (step === "result_A") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-rose-950/60 border border-rose-500/30 p-3.5 text-rose-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            입점 신청 내역 없음
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            입력하신 사업자등록번호와 연락처에 매칭되는 입점 신청 내역을 찾을 수 없습니다. 파트너 포털에 가입하시려면 먼저 kselectnetwork.com을 통한 입점 신청이 선행되어야 합니다.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <a
            href="https://www.kselectnetwork.com/#eligibility"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 shadow-sm"
          >
            kselectnetwork.com에서 파트너십 신청하기 →
          </a>
          <button
            onClick={() => setStep("verify")}
            className="block w-full text-center text-xs font-semibold text-zinc-400 hover:text-white underline bg-transparent border-0 cursor-pointer"
          >
            다시 정보 입력하기
          </button>
        </div>
      </div>
    );
  }

  // Case B. 신청 내역은 있으나 심사 및 승인 대기인 경우 (Public Flow)
  if (step === "result_B") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-950/60 border border-amber-500/30 p-3.5 text-amber-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            입점 신청 심사 대기 중
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            제출해주신 입점 신청서가 접수되어 현재 <strong className="text-white">어드민 검토 대기 중</strong>입니다. 심사 및 가입 요청 승인이 완료되면 기재하신 이메일로 포털 가입 안내 메일이 발송됩니다.
          </p>
        </div>

        <div className="pt-4 border-t border-zinc-800/80">
          <Link
            href="/portal/login"
            className="inline-flex items-center text-xs font-bold text-white hover:underline gap-1.5"
          >
            ← 로그인 화면으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // Case C. 이미 가입 완료 상태인 경우 (Public Flow)
  if (step === "result_C") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-950/60 border border-emerald-500/30 p-3.5 text-emerald-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">
            이미 가입 완료된 회원
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed px-2">
            이미 파트너 포털 가입 및 비밀번호 설정이 완료된 계정입니다. 아래 이메일 계정으로 로그인해 주세요.
          </p>
          <div className="mt-2 bg-zinc-950 rounded p-2.5 text-xs font-mono text-emerald-400 border border-zinc-800 select-all">
            {activeEmail}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href={activeEmail ? `/portal/login?email=${encodeURIComponent(activeEmail)}` : "/portal/login"}
            className="block w-full text-center rounded-md bg-white px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-zinc-200 shadow-sm"
          >
            로그인 하러 가기 →
          </Link>
          <button
            onClick={() => setStep("verify")}
            className="block w-full text-center text-xs font-semibold text-zinc-400 hover:text-white underline bg-transparent border-0 cursor-pointer"
          >
            다른 정보로 가입하기
          </button>
        </div>
      </div>
    );
  }

  return null;
}
