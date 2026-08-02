import Link from "next/link";

export default function EntryPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-10 bg-zinc-50 px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">
          K Select Network 파트너 포털
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          이용하시는 계정 종류에 맞는 로그인 화면으로 들어가주세요.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link
          href="/portal/login"
          className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          파트너 포털 로그인
        </Link>
        <Link
          href="/admin/login"
          className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          Letusto 관리자 로그인
        </Link>
      </div>
    </div>
  );
}
