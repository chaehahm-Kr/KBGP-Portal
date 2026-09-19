import type { Metadata } from "next";
import Link from "next/link";
import { PortalVerificationSignup } from "@/components/auth/portal-verification-signup";

export const metadata: Metadata = {
  title: "파트너십 가입 내역 확인 | K SELECT NETWORK",
};

export default function PortalSignupPage() {
  return (
    <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/90 p-6 sm:p-8 shadow-2xl space-y-6 backdrop-blur-sm">
      <PortalVerificationSignup />
      <p className="text-xs text-zinc-400 text-center border-t border-zinc-800 pt-4">
        이미 Portal 계정이 있으신가요?{" "}
        <Link href="/portal/login" className="font-semibold text-white hover:underline">
          로그인 바로가기
        </Link>
      </p>
    </div>
  );
}
