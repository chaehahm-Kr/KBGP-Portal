import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { loginPortal } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "파트너 포털 로그인 | K SELECT NETWORK",
};

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const isIdleLogout = resolvedParams.reason === "idle";

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      {/* KSN Premium Logo & Title */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {/* KSN New Dark Horizontal Logo */}
        <div className="max-w-[260px] w-full px-2">
          <img
            src="/ksn-logo-dark.png"
            alt="K SELECT NETWORK"
            className="w-full h-auto object-contain"
          />
        </div>
        <p className="text-[11px] text-zinc-400 font-medium">브랜드사 담당자 전용 로그인입니다.</p>
      </div>

      {isIdleLogout && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5 animate-fadeIn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 shrink-0 text-amber-400 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="font-semibold text-amber-200">자동 로그아웃 완료</p>
            <p className="text-amber-300/80 mt-0.5">30분 동안 활동이 없어 보안을 위해 자동 로그아웃되었습니다. 다시 로그인해 주세요.</p>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800 pt-6">
        <LoginForm
          action={loginPortal}
        />
      </div>
      <div className="flex w-full max-w-sm justify-between text-xs text-zinc-400 border-t border-zinc-800 pt-4 mx-auto">
        <Link href="/portal/signup" className="hover:text-white transition-colors">
          신규 파트너 가입 / 신청 확인
        </Link>
        <Link href="/portal/reset-password" className="hover:text-white transition-colors">
          비밀번호 재설정
        </Link>
      </div>
    </div>
  );
}
