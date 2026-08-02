import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이메일을 확인해주세요 | K Select Network",
};

export default function CheckEmailPage() {
  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl space-y-6 text-center">
      <h1 className="text-xl font-semibold text-white">
        이메일을 확인해주세요
      </h1>
      <p className="text-sm text-zinc-400">
        입력하신 이메일 주소로 인증 링크를 발송해드렸습니다. 링크를 클릭하여
        인증을 완료하시면 로그인이 가능합니다.
      </p>
      <div className="border-t border-zinc-800 pt-4">
        <Link
          href="/portal/login"
          className="text-xs font-semibold text-white hover:underline"
        >
          로그인 화면으로 이동
        </Link>
      </div>
    </div>
  );
}
