"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  verifyPartnerApplicationAction,
  activatePartnerAccountAction,
} from "@/lib/auth/signup-verification";
import { PASSWORD_RULE_DESCRIPTION } from "@/lib/auth/password";

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-350 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export function PortalVerificationSignup() {
  const router = useRouter();
  const [step, setStep] = useState<
    "verify" | "result_A" | "result_B" | "result_C" | "setPassword" | "success"
  >("verify");

  // Inputs
  const [brn, setBrn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // States
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<{
    userId: string;
    companyName: string;
    contactName: string;
    email: string;
  } | null>(null);
  const [activeEmail, setActiveEmail] = useState("");

  // 1단계: 파트너십 신청 조회
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

  // 2단계: 비밀번호 설정 및 완료
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
      const res = await activatePartnerAccountAction(verifiedUser.userId, password);
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

  // 1. 조회 단계 폼
  if (step === "verify") {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            파트너십 가입 내역 확인
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            kselectnetwork.com에서 파트너십을 신청한 담당자 정보로 가입이 진행됩니다.
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label htmlFor="brn" className={labelClass}>
              사업자등록번호
            </label>
            <input
              id="brn"
              type="text"
              placeholder="1234567890"
              required
              value={brn}
              onChange={(e) => setBrn(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              * 대시(-) 없이 숫자 10자리만 입력해 주세요.
            </p>
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              이메일 주소
            </label>
            <input
              id="email"
              type="email"
              placeholder="example@kselectnetwork.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer h-10"
          >
            {pending ? "조회 중..." : "신청 내역 확인"}
          </button>
        </form>
      </div>
    );
  }

  // Case A. 입점 신청 내역을 찾을 수 없는 경우
  if (step === "result_A") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-950/30 p-3 text-red-600 dark:text-red-400">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            입점 신청 내역 없음
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
            입력하신 사업자등록번호와 연락처에 매칭되는 입점 신청 내역을 찾을 수 없습니다. 파트너 포털에 가입하시려면 먼저 kselectnetwork.com을 통한 입점 신청이 선행되어야 합니다.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <a
            href="https://kselectnetwork.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            kselectnetwork.com에서 신청하기
          </a>
          <button
            onClick={() => setStep("verify")}
            className="block w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline bg-transparent border-0 cursor-pointer"
          >
            다시 정보 입력하기
          </button>
        </div>
      </div>
    );
  }

  // Case B. 신청 내역은 있으나 심사 및 승인 대기인 경우
  if (step === "result_B") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-100 dark:bg-amber-950/30 p-3 text-amber-600 dark:text-amber-400">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            입점 신청 심사 대기 중
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
            제출해주신 입점 신청서가 접수되어 현재 <strong>어드민 검토 대기 중</strong>입니다. 심사 및 가입 요청 승인이 완료되면 기재하신 이메일로 포털 가입 안내 메일이 발송됩니다. 심사가 완료될 때까지 잠시만 기다려 주시기 바랍니다.
          </p>
        </div>

        <div className="pt-4 border-t border-zinc-800/50">
          <Link
            href="/portal/login"
            className="inline-flex items-center text-sm font-semibold text-white hover:underline gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            로그인 화면으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // Case C. 이미 가입 완료 상태인 경우
  if (step === "result_C") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-950/30 p-3 text-emerald-600 dark:text-emerald-400">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            이미 가입 완료된 회원
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
            이미 파트너 포털 가입 및 비밀번호 설정이 완료된 계정입니다. 아래 이메일 계정으로 로그인 화면을 이용해 주세요.
          </p>
          <div className="mt-2 bg-zinc-950/50 rounded p-2 text-xs font-mono text-zinc-300 select-all border border-zinc-800">
            {activeEmail}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/portal/login"
            className="block w-full text-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            로그인 하러 가기
          </Link>
          <button
            onClick={() => setStep("verify")}
            className="block w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 underline bg-transparent border-0 cursor-pointer"
          >
            다른 정보로 가입하기
          </button>
        </div>
      </div>
    );
  }

  // Case D. 비밀번호 설정 화면
  if (step === "setPassword") {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 text-[10px] font-bold">
            신청 확인 완료
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
            계정 활성화 및 비밀번호 설정
          </h1>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 bg-zinc-950/30 rounded p-3 border border-zinc-850 mt-2">
            <div>• <strong>회사명</strong>: {verifiedUser?.companyName}</div>
            <div>• <strong>담당자</strong>: {verifiedUser?.contactName}</div>
            <div>• <strong>계정(이메일)</strong>: {verifiedUser?.email}</div>
          </div>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label htmlFor="pass" className={labelClass}>
              새 비밀번호
            </label>
            <input
              id="pass"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              {PASSWORD_RULE_DESCRIPTION}
            </p>
          </div>

          <div>
            <label htmlFor="passConfirm" className={labelClass}>
              비밀번호 확인
            </label>
            <input
              id="passConfirm"
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100 cursor-pointer h-10"
          >
            {pending ? "활성화 처리 중..." : "가입 및 계정 활성화 완료"}
          </button>
        </form>
      </div>
    );
  }

  // 성공 완료 화면
  if (step === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-950/30 p-3 text-emerald-600 dark:text-emerald-400 animate-bounce">
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
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            가입 및 비밀번호 설정 완료!
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed px-2">
            파트너 계정이 성공적으로 활성화되었습니다. 이제 아래의 로그인 페이지 링크를 통해 가입하신 정보로 포털에 로그인하실 수 있습니다.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/portal/login?signup_success=true"
            className="block w-full text-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
          >
            로그인 화면으로 이동
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
