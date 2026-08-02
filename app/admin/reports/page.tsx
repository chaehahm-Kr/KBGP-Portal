import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";

export const metadata: Metadata = {
  title: "리포트 | K SELECT NETWORK 어드민",
};

export default async function AdminReportsPage() {
  await verifyAdminSession();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">리포트 및 통계 (Reports & Analytics)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          통합 입점 실적, 심사 통계, 매출 성과 리포트를 작성하고 다운로드합니다.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center py-16">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          보고서 생성 시스템 모듈 준비 중입니다. 조만간 분석 차트 리포트 다운로드 기능이 추가될 예정입니다.
        </p>
      </div>
    </div>
  );
}
