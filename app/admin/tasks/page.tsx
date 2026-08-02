import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/auth/dal";
import { mockTasks } from "@/lib/data/mockData";

export const metadata: Metadata = {
  title: "할 일 및 업무 관리 | K SELECT NETWORK 어드민",
};

export default async function AdminTasksPage() {
  await verifyAdminSession();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">할 일 및 업무 (Tasks & Communication)</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          한국 입점사 관리, 통관 서류 심사, 아마존 마케팅 등 유기적 업무 플로우와 담당 심사원 일감을 통합 모니터링합니다.
        </p>
      </div>

      {/* Tasks Table */}
      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-zinc-500 dark:text-zinc-400">
            <thead>
              <tr className="border-b border-zinc-150 bg-zinc-50 font-bold text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-white">
                <th className="px-6 py-3 font-semibold">할 일 제목 (Task Title)</th>
                <th className="px-6 py-3 font-semibold">회사명</th>
                <th className="px-6 py-3 font-semibold">우선순위</th>
                <th className="px-6 py-3 font-semibold">상태</th>
                <th className="px-6 py-3 font-semibold">담당 직원</th>
                <th className="px-6 py-3 font-semibold text-right">기한 (Due Date)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {mockTasks.map((task) => {
                const priorityClass =
                  task.priority === "Urgent"
                    ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 font-bold"
                    : task.priority === "High"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                const statusClass =
                  task.status === "Completed"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : task.status === "In Progress"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                return (
                  <tr key={task.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    <td className="px-6 py-3.5 font-bold text-zinc-950 dark:text-white">
                      {task.title}
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300">
                      {task.company}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${priorityClass}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-semibold ${statusClass}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-700 dark:text-zinc-300 font-medium">
                      {task.owner}
                    </td>
                    <td className="px-6 py-3.5 text-right text-zinc-400 font-mono">
                      {task.dueDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
