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
        {/* KSN Logo Image - Dark Circle cropping the top circle from the JPG */}
        <div className="relative h-20 w-20 rounded-full overflow-hidden border border-zinc-850 shadow-2xl bg-black">
          <img
            src="/ksn-logo.jpg"
            alt="KSN Logo"
            className="h-full w-full object-cover object-top scale-110"
          />
        </div>
        <div className="space-y-1">
          <h1 className="text-base font-bold text-white tracking-tight">Korea Select Network</h1>
          <p className="text-[11px] text-zinc-400 font-medium">브랜드사 담당자 전용 로그인입니다.</p>
        </div>
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
