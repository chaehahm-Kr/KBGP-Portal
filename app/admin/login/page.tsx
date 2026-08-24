import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { loginAdmin } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "관리자 로그인 | Korea Select Network",
};

export default function AdminLoginPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      {/* KSN Premium Logo & Title */}
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {/* KSN Burgundy Horizontal Logo */}
        <div className="max-w-[260px] w-full px-2">
          <img
            src="/ksn-logo-admin.png"
            alt="K SELECT NETWORK"
            className="w-full h-auto object-contain"
          />
        </div>
        <p className="text-[11px] text-zinc-400 font-medium">Letusto 내부 직원 전용 백엔드 관리 시스템</p>
      </div>

      <div className="border-t border-zinc-800 pt-6">
        <LoginForm
          action={loginAdmin}
        />
      </div>

      <div className="flex w-full max-w-sm justify-center text-xs text-zinc-400 border-t border-zinc-800 pt-4 mx-auto">
        <Link href="/admin/forgot-password" className="hover:text-white transition-colors">
          비밀번호를 잊으셨나요?
        </Link>
      </div>
    </div>
  );
}
