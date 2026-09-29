"use client";

import React, { useState, useTransition } from "react";
import { getSupportSessionLogsAction, type SupportSessionLogFilter } from "@/lib/auth/impersonation-actions";

export interface SupportSessionLogItem {
  id: string;
  session_id: string;
  admin_user_id: string;
  admin_email: string;
  admin_name?: string;
  target_user_id: string;
  target_user_email: string;
  target_user_name?: string;
  target_company_id: string;
  target_company_name: string;
  portal_type: "BRAND" | "RETAILER";
  action: string;
  reason: string;
  note?: string | null;
  exit_reason?: string | null;
  duration_seconds?: number | null;
  durationText?: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  started_at: string;
  ended_at?: string | null;
  expires_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

interface SupportSessionLogsClientProps {
  initialLogs: SupportSessionLogItem[];
  staffMembers: { id: string; name: string; email: string }[];
  companies: { id: string; name: string }[];
}

export function SupportSessionLogsClient({
  initialLogs,
  staffMembers,
  companies,
}: SupportSessionLogsClientProps) {
  const [logs, setLogs] = useState<SupportSessionLogItem[]>(initialLogs);
  const [selectedLog, setSelectedLog] = useState<SupportSessionLogItem | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter States
  const [staffId, setStaffId] = useState<string>("ALL");
  const [companyId, setCompanyId] = useState<string>("ALL");
  const [portalType, setPortalType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const handleFilterApply = (overrideFilters?: Partial<SupportSessionLogFilter>) => {
    const filterPayload: SupportSessionLogFilter = {
      staffId: overrideFilters?.staffId !== undefined ? overrideFilters.staffId : staffId,
      companyId: overrideFilters?.companyId !== undefined ? overrideFilters.companyId : companyId,
      portalType: overrideFilters?.portalType !== undefined ? overrideFilters.portalType : portalType,
      status: overrideFilters?.status !== undefined ? overrideFilters.status : status,
      startDate: overrideFilters?.startDate !== undefined ? overrideFilters.startDate : startDate,
      endDate: overrideFilters?.endDate !== undefined ? overrideFilters.endDate : endDate,
      query: overrideFilters?.query !== undefined ? overrideFilters.query : query,
    };

    startTransition(async () => {
      const res = await getSupportSessionLogsAction(filterPayload);
      if (res.logs) {
        setLogs(res.logs);
      }
    });
  };

  const handleStaffDrilldown = (staffUserId: string) => {
    setStaffId(staffUserId);
    handleFilterApply({ staffId: staffUserId });
  };

  const handleResetFilters = () => {
    setStaffId("ALL");
    setCompanyId("ALL");
    setPortalType("ALL");
    setStatus("ALL");
    setStartDate("");
    setEndDate("");
    setQuery("");
    handleFilterApply({
      staffId: "ALL",
      companyId: "ALL",
      portalType: "ALL",
      status: "ALL",
      startDate: "",
      endDate: "",
      query: "",
    });
  };

  // Export CSV Helper
  const handleExportCsv = () => {
    if (logs.length === 0) {
      alert("다운로드할 지원 세션 로그가 없습니다.");
      return;
    }

    const headers = [
      "Started At (KST)",
      "Session ID",
      "Staff Name",
      "Staff Email",
      "Target Company",
      "Target User Name",
      "Target User Email",
      "Portal Type",
      "Reason for Access",
      "Note / Ticket",
      "Duration",
      "Status",
      "Ended At",
    ];

    const rows = logs.map((l) => [
      new Date(l.started_at).toLocaleString("ko-KR"),
      l.session_id,
      `"${l.admin_name || l.admin_email}"`,
      `"${l.admin_email}"`,
      `"${l.target_company_name}"`,
      `"${l.target_user_name || l.target_user_email}"`,
      `"${l.target_user_email}"`,
      l.portal_type === "BRAND" ? "Brand Portal (NETWORK)" : "Retailer Portal (HUB)",
      `"${(l.reason || "").replace(/"/g, '""')}"`,
      `"${(l.note || "").replace(/"/g, '""')}"`,
      l.durationText || "-",
      l.status,
      l.ended_at ? new Date(l.ended_at).toLocaleString("ko-KR") : "-",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `support_session_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedStaffMember = staffMembers.find((s) => s.id === staffId);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-white">
              Support Session Logs (사용자 지원 세션 로그)
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            Admin Staff가 <code className="font-semibold text-amber-600 dark:text-amber-400">Login as User</code>를 실행한 모든 접속 이력을 감사 목적으로 조회 및 검수합니다. (수정/삭제 불가 Read-Only)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Active Staff Drilldown Header Banner */}
      {staffId !== "ALL" && selectedStaffMember && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
            <span className="text-base">🔍</span>
            <span>
              <strong>Staff 드릴다운 조회:</strong> <span className="font-bold underline">{selectedStaffMember.name}</span> ({selectedStaffMember.email}) 님의 전체 지원 세션 실행 이력을 조회 중입니다.
            </span>
          </div>
          <button
            onClick={() => {
              setStaffId("ALL");
              handleFilterApply({ staffId: "ALL" });
            }}
            className="text-xs font-bold text-amber-800 hover:underline dark:text-amber-400 cursor-pointer"
          >
            ✕ 필터 해제 (전체 보기)
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* Staff Filter */}
          <div className="space-y-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">Staff (실행 관리자)</label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer"
            >
              <option value="ALL">전체 Staff</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          {/* Company Filter */}
          <div className="space-y-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">대상 회사 (Company)</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer"
            >
              <option value="ALL">전체 회사</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Portal Type Filter */}
          <div className="space-y-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">Portal 구분</label>
            <select
              value={portalType}
              onChange={(e) => setPortalType(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer"
            >
              <option value="ALL">전체 Portal</option>
              <option value="BRAND">Brand Portal (K SELECT NETWORK)</option>
              <option value="RETAILER">Retailer Portal (K SELECT HUB)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="block font-bold text-zinc-700 dark:text-zinc-300">세션 상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 outline-none font-medium cursor-pointer"
            >
              <option value="ALL">전체 상태</option>
              <option value="ACTIVE">🟢 Active (진행 중)</option>
              <option value="ENDED">⚪ Ended (정상 종료)</option>
              <option value="EXPIRED">🟠 Expired (시간 만료)</option>
            </select>
          </div>

        </div>

        {/* Search Bar & Date Filter & Apply Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="회사명, 사용자명, 이메일, 사유 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full sm:w-64 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 outline-none"
              />
              <span className="text-zinc-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 outline-none"
              />
            </div>

            <button
              onClick={() => handleFilterApply()}
              disabled={isPending}
              className="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 font-extrabold rounded-lg cursor-pointer disabled:opacity-50"
            >
              {isPending ? "검색 중..." : "검색"}
            </button>
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold rounded-lg cursor-pointer"
            >
              초기화
            </button>
          </div>
        </div>

      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold select-none">
                <th className="py-3 px-4">시작 일시</th>
                <th className="py-3 px-4">Staff (실행 관리자)</th>
                <th className="py-3 px-4">대상 회사</th>
                <th className="py-3 px-4">대상 사용자</th>
                <th className="py-3 px-4">Portal</th>
                <th className="py-3 px-4">접속 사유</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-medium">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400 select-none">
                    조회된 지원 세션 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        {new Date(log.started_at).toLocaleString("ko-KR")}
                      </td>

                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStaffDrilldown(log.admin_user_id);
                          }}
                          className="font-extrabold text-indigo-650 hover:underline dark:text-indigo-400 text-left cursor-pointer"
                          title="Staff 드릴다운 조회"
                        >
                          👤 {log.admin_name || log.admin_email}
                        </button>
                      </td>

                      <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                        {log.target_company_name}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {log.target_user_name || log.target_user_email}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono">
                          {log.target_user_email}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {log.portal_type === "BRAND" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60">
                            Brand Portal
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60">
                            Retailer Portal
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-xs truncate text-zinc-700 dark:text-zinc-300" title={log.reason}>
                        {log.reason}
                      </td>

                      <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {log.durationText}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {log.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Active
                          </span>
                        )}
                        {log.status === "ENDED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            Ended
                          </span>
                        )}
                        {log.status === "EXPIRED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Expired
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl relative animate-in fade-in zoom-in duration-150">
            
            <button
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold p-1 cursor-pointer"
            >
              ✕
            </button>

            <div className="border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider">
                SESSION ID: {selectedLog.session_id}
              </span>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5 flex items-center gap-2">
                <span>🔑 Support Session 상세 이력</span>
              </h2>
            </div>

            <div className="space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">실행 Staff (Admin)</label>
                  <div className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {selectedLog.admin_name || selectedLog.admin_email}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">{selectedLog.admin_email}</div>
                  <div className="text-[9px] text-zinc-400 font-mono mt-0.5">ID: {selectedLog.admin_user_id}</div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">대상 사용자 (User)</label>
                  <div className="font-extrabold text-zinc-900 dark:text-white mt-0.5">
                    {selectedLog.target_user_name || selectedLog.target_user_email}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">{selectedLog.target_user_email}</div>
                  <div className="text-[9px] text-zinc-400 font-mono mt-0.5">ID: {selectedLog.target_user_id}</div>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">대상 회사:</span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">{selectedLog.target_company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">Portal 구분:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedLog.portal_type === "BRAND" ? "Brand Portal (K SELECT NETWORK)" : "Retailer Portal (K SELECT HUB)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">세션 상태:</span>
                  <span className="font-extrabold">{selectedLog.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-bold">Duration:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{selectedLog.durationText}</span>
                </div>
                {selectedLog.exit_reason && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500 font-bold">Exit Type:</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedLog.exit_reason}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-zinc-500 font-bold block">접속 사유 (Reason):</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5 leading-relaxed">
                    {selectedLog.reason}
                  </div>
                </div>
                {selectedLog.note && (
                  <div className="pt-1 border-t border-zinc-200 dark:border-zinc-800 mt-1">
                    <span className="text-zinc-500 font-bold block">티켓 / 추가 노트:</span>
                    <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5 leading-relaxed">
                      {selectedLog.note}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-zinc-400 font-mono space-y-1">
                <div className="flex justify-between">
                  <span>시작 일시:</span>
                  <span>{new Date(selectedLog.started_at).toLocaleString("ko-KR")}</span>
                </div>
                {selectedLog.ended_at && (
                  <div className="flex justify-between">
                    <span>종료 일시:</span>
                    <span>{new Date(selectedLog.ended_at).toLocaleString("ko-KR")}</span>
                  </div>
                )}
                {selectedLog.expires_at && (
                  <div className="flex justify-between">
                    <span>만료 예상 일시:</span>
                    <span>{new Date(selectedLog.expires_at).toLocaleString("ko-KR")}</span>
                  </div>
                )}
              </div>

            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
