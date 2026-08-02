"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-white">
          <h2 className="text-xl font-bold">오류가 발생했습니다.</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {error?.message || "시스템 오류가 발생했습니다. 관리자에게 문의해 주세요."}
          </p>
          <button
            onClick={() => reset()}
            className="mt-6 rounded bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-100"
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
