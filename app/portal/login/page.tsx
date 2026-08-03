import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { loginPortal } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "파트너 포털 로그인 | K SELECT NETWORK",
};

export default function PortalLoginPage() {
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

      <div className="border-t border-zinc-800 pt-6">
        <LoginForm
          action={loginPortal}
        />
      </div>
      <div className="flex w-full max-w-sm justify-between text-xs text-zinc-400 border-t border-zinc-800 pt-4 mx-auto">
        <Link href="/portal/signup" className="hover:text-white transition-colors">
          신규 파트너 회원가입
        </Link>
        <Link href="/portal/reset-password" className="hover:text-white transition-colors">
          비밀번호 재설정
        </Link>
      </div>
    </div>
  );
}
