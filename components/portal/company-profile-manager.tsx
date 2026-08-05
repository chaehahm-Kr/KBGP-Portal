"use client";

import React, { useState, useTransition } from "react";
import { updateCompanyPortalMetadata } from "@/lib/company/portal-actions";
import { type CompanyContact, type CompanyParsedMetadata } from "@/lib/company/admin-actions";
import { assignTaskPrimaryUser, type TaskAssignmentItem } from "@/lib/company/task-actions";

interface CompanyProfileManagerProps {
  company: {
    id: string;
    name: string;
    business_registration_number: string;
    country: string;
    status: string;
    created_at: string;
  };
  parsedMeta: CompanyParsedMetadata;
  companyRole: string; 
  taskAssignments: TaskAssignmentItem[];
  companyUsers: any[];
}

export function CompanyProfileManager({
  company,
  parsedMeta,
  companyRole,
  taskAssignments,
  companyUsers,
}: CompanyProfileManagerProps) {
  const isCompanyAdmin = companyRole === "company_admin";
  const [isPending, startTransition] = useTransition();

  const [address, setAddress] = useState(parsedMeta.address);
  const [website, setWebsite] = useState(parsedMeta.website);
  const contacts = parsedMeta.contacts;

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [tempAddress, setTempAddress] = useState(address);
  const [tempWebsite, setTempWebsite] = useState(website);

  // [신규 기능]: 담당 업무 상태 로컬 관리
  const [tasks, setTasks] = useState<TaskAssignmentItem[]>(taskAssignments);

  // [신규 기능]: 인쇄할 이메일 알림 수신자 목록 헬퍼
  const getEmailRecipientsForTask = (taskCode: string) => {
    // 해당 업무의 이메일 알림을 활성화한 활성 멤버들의 이름 수집
    return companyUsers
      .filter(u => u.status === "active" && u.task_assignments?.some((a: any) => a.task_code === taskCode && a.email_notify))
      .map(u => u.name || "(이름 없음)")
      .join(", ") || "없음";
  };

  // [신규 기능]: 주 담당자 직접 변경 핸들러
  const handleAssignPrimaryUser = async (taskCode: string, targetUserId: string | null) => {
    const targetUser = companyUsers.find(u => u.id === targetUserId);
    const currentPrimary = tasks.find(t => t.taskCode === taskCode);

    if (targetUserId && currentPrimary?.userId && currentPrimary.userId !== targetUserId) {
      const confirmChange = confirm(
        `현재 이 업무에는 다른 주 담당자(${currentPrimary.userName || "미지정"})가 지정되어 있습니다. 주 담당자를 변경하시겠습니까?`
      );
      if (!confirmChange) return;
    }

    startTransition(async () => {
      try {
        await assignTaskPrimaryUser(company.id, taskCode, targetUserId, "portal");

        // 로컬 상태 동기화 갱신
        setTasks(prev => 
          prev.map(t => {
            if (t.taskCode === taskCode) {
              return {
                ...t,
                userId: targetUserId,
                isPrimary: !!targetUserId,
                userName: targetUser?.name || null,
                userTitle: targetUser?.title || null,
                userPosition: targetUser?.position || null,
                userEmail: targetUser?.email || null,
                userPhone: targetUser?.phone || null,
              };
            }
            return t;
          })
        );

        alert("담당자 배정이 완료되었습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "담당자 배정에 실패했습니다.");
      }
    });
  };

  const handleSaveMeta = async () => {
    startTransition(async () => {
      try {
        await updateCompanyPortalMetadata(company.id, {
          address: tempAddress,
          website: tempWebsite,
          contacts, 
        });
        setAddress(tempAddress);
        setWebsite(tempWebsite);
        setIsEditingMeta(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "회사 정보 저장 실패");
      }
    });
  };

  const getStatusBadgeClass = () => {
    if (parsedMeta.status === "Active") {
      return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900";
    } else if (parsedMeta.status === "Pending") {
      return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900";
    }
    return "bg-zinc-50 text-zinc-700 border-zinc-100 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-700";
  };

  // 활성 상태의 소속 사용자만 선택 가능
  const activeMembers = companyUsers.filter(u => u.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-950 dark:text-white">회사 정보 관리</h1>
        <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
          귀사의 소속 법인 정보와 웹사이트, 그리고 소속 담당자들의 연락망을 확인하고 수정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-start">
        {/* Left Column: General & Legal Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                회사 정보 설정
              </span>
              {isCompanyAdmin && (
                !isEditingMeta ? (
                  <button
                    onClick={() => {
                      setTempAddress(address);
                      setTempWebsite(website);
                      setIsEditingMeta(true);
                    }}
                    className="text-xs font-semibold text-zinc-550 hover:underline dark:text-zinc-400"
                  >
                    수정
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveMeta}
                      disabled={isPending}
                      className="text-xs font-bold text-emerald-650 hover:underline disabled:opacity-50"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditingMeta(false)}
                      className="text-xs font-semibold text-zinc-400 hover:underline"
                    >
                      취소
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">파트너 상태</span>
                <span className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${getStatusBadgeClass()}`}>
                  {parsedMeta.status}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 유형</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{parsedMeta.type}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  설립 국가 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.country}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  사업자등록번호 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.business_registration_number}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase flex items-center gap-1">
                  공식 법인명 🔒
                </span>
                <span className="font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 block bg-zinc-50/50 p-1.5 rounded dark:bg-zinc-950/20">{company.name}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 주소</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempAddress}
                    onChange={(e) => setTempAddress(e.target.value)}
                    placeholder="회사 주소를 입력해주세요"
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 block whitespace-pre-wrap">
                    {address || "주소 미등록"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">웹사이트</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempWebsite}
                    onChange={(e) => setTempWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  website ? (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-600 dark:text-emerald-450 hover:underline mt-0.5 inline-block"
                    >
                      {website}
                    </a>
                  ) : (
                    <span className="font-semibold text-zinc-400 mt-0.5 block">웹사이트 미등록</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Contacts & Task Assignments */}
        <div className="md:col-span-2 space-y-6">
          {/* Contacts List Card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">소속 담당자 목록 ({contacts.length})</h3>
            </div>

            <div className="space-y-4">
              {contacts.length > 0 ? (
                contacts.map((contact, index) => (
                  <div key={contact.id || index} className={`text-xs space-y-2 ${index > 0 ? "pt-4 border-t border-zinc-100 dark:border-zinc-800/80" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-bold text-zinc-900 dark:text-white text-[13px] flex items-center gap-1.5">
                          {contact.name}
                          {contact.isPrimary && (
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                              주 컨택
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {contact.title && (
                          <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-650 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                            직함: {contact.title}
                          </span>
                        )}
                        {contact.position && (
                          <span className="rounded bg-zinc-50 border border-zinc-150 text-zinc-650 px-1.5 py-0.5 text-[9px] font-semibold dark:bg-zinc-800/20 dark:border-zinc-700 dark:text-zinc-350">
                            부서: {contact.position}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-[11px] text-zinc-550 dark:text-zinc-450">
                      {contact.phone && <p>📞 {contact.phone}</p>}
                      {contact.email && <p>✉️ {contact.email}</p>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-400 py-3 text-center">등록된 담당자 정보가 없습니다.</p>
              )}
            </div>

            {isCompanyAdmin && (
              <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <a
                  href="/portal/company/users"
                  className="inline-block text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-450"
                >
                  담당자 초대, 수정 및 권한 관리는 [사용자 관리] 메뉴에서 진행할 수 있습니다. →
                </a>
              </div>
            )}
          </div>

          {/* [신규 기능]: 담당 업무 및 주 담당자 관리 테이블 카드 */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-950 dark:text-white">담당 업무 및 주 담당자</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-3">업무명</th>
                    <th className="px-4 py-3">주 담당자 정보</th>
                    <th className="px-4 py-3">알림 수신인</th>
                    <th className="px-4 py-3 text-center w-28">지정 상태</th>
                    {isCompanyAdmin && <th className="px-4 py-3 text-right">담당자 변경</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {tasks.map((task) => {
                    const notifyNames = getEmailRecipientsForTask(task.taskCode);
                    return (
                      <tr key={task.taskCode} className="hover:bg-zinc-50/20">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-zinc-850 dark:text-zinc-200 block">{task.label}</span>
                          <span className="text-[9px] text-zinc-400 block mt-0.5 leading-relaxed max-w-xs">{task.desc}</span>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-350">
                          {task.userId ? (
                            <div className="space-y-0.5">
                              <a
                                href="/portal/company/users"
                                className="font-semibold text-emerald-600 hover:underline dark:text-emerald-450 text-[13px]"
                              >
                                {task.userName}
                              </a>
                              {task.userTitle || task.userPosition ? (
                                <p className="text-[10px] text-zinc-400">
                                  {task.userTitle || ""}{task.userTitle && task.userPosition ? " / " : ""}{task.userPosition || ""}
                                </p>
                              ) : null}
                              <p className="text-[9px] text-zinc-450 font-mono">{task.userEmail}</p>
                              {task.userPhone && <p className="text-[9px] text-zinc-400">📞 {task.userPhone}</p>}
                            </div>
                          ) : (
                            <span className="text-zinc-450 italic">주 담당자 미지정</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-zinc-500 dark:text-zinc-400 max-w-xxs truncate" title={notifyNames}>
                          {notifyNames}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {task.userId ? (
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                              설정 완료
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold border border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900">
                              미지정
                            </span>
                          )}
                        </td>
                        {isCompanyAdmin && (
                          <td className="px-4 py-3.5 text-right">
                            <select
                              value={task.userId || ""}
                              onChange={(e) => handleAssignPrimaryUser(task.taskCode, e.target.value || null)}
                              disabled={isPending}
                              className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white max-w-xs focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="">-- 담당자 선택 --</option>
                              {activeMembers.map(u => (
                                <option key={u.id} value={u.id}>
                                  {u.name || "(이름 없음)"} ({u.title || "멤버"})
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
