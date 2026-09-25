"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateCompanyUser,
  reinviteCompanyUser,
  cancelCompanyUserInvite,
  removeCompanyMember,
} from "@/lib/company/invite-actions";
import { isInviteExpired } from "@/lib/company/types";
import { updateUserTaskAssignments } from "@/lib/company/task-actions";
import { TASK_DEFINITIONS } from "@/lib/company/task-constants";
import { InternationalPhoneInput } from "@/components/shared/international-phone-input";

interface CompanyUsersManagerProps {
  initialUsers: any[];
  currentUserId: string;
}

const STATUS_LABEL: Record<string, string> = {
  invited: "초대됨",
  active: "가입완료",
  suspended: "비활성화됨",
};

const ROLE_LABEL: Record<string, string> = {
  company_admin: "관리자(Admin)",
  company_staff: "담당자(Staff)",
};

const inputClass =
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-600";

const permissionOptions = [
  { value: "none", label: "접근불가" },
  { value: "read", label: "조회전용" },
  { value: "write", label: "수정가능" },
];

export function CompanyUsersManager({ initialUsers, currentUserId }: CompanyUsersManagerProps) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [cancelConfirmUser, setCancelConfirmUser] = useState<any | null>(null);
  const [removeConfirmUser, setRemoveConfirmUser] = useState<any | null>(null);

  // Edit Form Temp States
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formPosition, setFormPosition] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<"company_admin" | "company_staff">("company_staff");
  const [formStatus, setFormStatus] = useState<"active" | "suspended" | "invited">("active");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formPermissions, setFormPermissions] = useState<Record<string, any>>({
    application: "none",
    brands: "none",
    products: "none",
    company_info: "none",
  });

  // 6대 담당 업무 배정 체크박스 상태 선언
  const [formTaskAssignments, setFormTaskAssignments] = useState<
    Record<string, { is_primary: boolean; email_notify: boolean }>
  >({});

  const [isPending, startTransition] = useTransition();

  // Identify earliest created company admin
  const earliestAdminId = users
    .filter((u) => u.company_role === "company_admin")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]?.id;

  const isInitialOwner = (user: any) => {
    return (!user.invited_by && user.company_role === "company_admin") || user.id === earliestAdminId;
  };

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormName(user.name || "");
    setFormEmail(user.email || "");
    setFormTitle(user.title || "");
    setFormPosition(user.position || "");
    setFormPhone(user.phone || "");
    setFormRole(user.company_role);
    setFormStatus(user.status);
    setFormIsPrimary(user.is_primary || false);
    setFormPermissions({
      application: user.permissions?.application || "none",
      brands: user.permissions?.brands || "none",
      products: user.permissions?.products || "none",
      company_info: user.permissions?.company_info || "none",
      ...user.permissions,
    });

    // 해당 유저의 담당 업무 6개 상태 매핑
    const initialTasks: Record<string, { is_primary: boolean; email_notify: boolean }> = {};
    TASK_DEFINITIONS.forEach((def) => {
      const found = user.task_assignments?.find((a: any) => a.task_code === def.code);
      initialTasks[def.code] = {
        is_primary: found ? found.is_primary : false,
        email_notify: found ? found.email_notify : false,
      };
    });
    setFormTaskAssignments(initialTasks);
  };

  // 주 담당자 중복 방지 알럿 컨펌 및 이메일 자동 수신 체크
  const handleTaskCheckboxChange = (
    taskCode: string,
    field: "is_primary" | "email_notify",
    checked: boolean
  ) => {
    if (field === "is_primary" && checked) {
      const activePrimaryUser = users.find((u) => {
        if (u.id === editingUser.id) return false;
        return u.task_assignments?.some((a: any) => a.task_code === taskCode && a.is_primary);
      });

      if (activePrimaryUser) {
        const confirmChange = confirm(
          `현재 이 업무에는 다른 주 담당자(${activePrimaryUser.name || "미지정"})가 지정되어 있습니다. 주 담당자를 변경하시겠습니까?`
        );
        if (!confirmChange) return;
      }

      setFormTaskAssignments((prev) => ({
        ...prev,
        [taskCode]: {
          ...prev[taskCode],
          is_primary: true,
          email_notify: true,
        },
      }));
    } else {
      setFormTaskAssignments((prev) => ({
        ...prev,
        [taskCode]: {
          ...prev[taskCode],
          [field]: checked,
        },
      }));
    }
  };

  const handleSave = () => {
    if (!editingUser) return;
    if (!formName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    if (!formEmail.trim()) {
      alert("이메일을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        // 1. 유저 정보, 이메일, 권한 업데이트
        await updateCompanyUser(editingUser.id, {
          name: formName,
          email: formEmail,
          title: formTitle,
          position: formPosition,
          phone: formPhone,
          companyRole: formRole,
          status: formStatus,
          isPrimary: formIsPrimary,
          permissions: formPermissions,
        });

        // 2. 담당 업무 저장
        const payload = Object.entries(formTaskAssignments).map(([code, val]) => ({
          task_code: code,
          is_primary: val.is_primary,
          email_notify: val.email_notify,
        }));
        await updateUserTaskAssignments(editingUser.id, editingUser.company_id, payload, "portal");

        // 3. 로컬 상태 동기화
        const updatedUsers = users.map((u) => {
          if (u.id === editingUser.id) {
            const newAssignments = Object.entries(formTaskAssignments).map(([code, val]) => ({
              user_id: u.id,
              task_code: code,
              is_primary: val.is_primary,
              email_notify: val.email_notify,
            }));
            return {
              ...u,
              name: formName.trim(),
              email: formEmail.trim().toLowerCase(),
              title: formTitle.trim(),
              position: formPosition.trim(),
              phone: formPhone.trim(),
              company_role: formRole,
              status: formStatus,
              is_primary: formIsPrimary,
              permissions: formPermissions,
              task_assignments: newAssignments,
            };
          } else {
            const updatedAssignments =
              u.task_assignments?.map((a: any) => {
                const targetTask = formTaskAssignments[a.task_code];
                if (targetTask?.is_primary) {
                  return { ...a, is_primary: false };
                }
                return a;
              }) || [];

            return {
              ...u,
              is_primary: formIsPrimary ? false : u.is_primary,
              task_assignments: updatedAssignments,
            };
          }
        });

        setUsers(updatedUsers);
        setEditingUser(null);
        alert("수정이 완료되었습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "수정에 실패했습니다.");
      }
    });
  };

  const handleReinvite = async (id: string) => {
    startTransition(async () => {
      try {
        await reinviteCompanyUser(id);
        alert("초대장을 재발송했습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "재초대 실패");
      }
    });
  };

  const handleCancelInviteSubmit = async () => {
    if (!cancelConfirmUser) return;
    startTransition(async () => {
      try {
        const res = await cancelCompanyUserInvite(cancelConfirmUser.id);
        if (res?.error) {
          alert(res.error);
        } else {
          setUsers((prev) => prev.filter((u) => u.id !== cancelConfirmUser.id));
          alert("초청이 취소되었습니다.");
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "초청 취소에 실패했습니다.");
      } finally {
        setCancelConfirmUser(null);
      }
    });
  };

  const handleRemoveMemberSubmit = async () => {
    if (!removeConfirmUser) return;
    const targetId = removeConfirmUser.id;
    startTransition(async () => {
      try {
        const res = await removeCompanyMember(targetId);
        if (res && !res.success) {
          alert(res.error || "멤버 제거에 실패했습니다.");
        } else {
          setUsers((prev) => prev.filter((u) => u.id !== targetId));
          if (editingUser?.id === targetId) {
            setEditingUser(null);
          }
          alert("멤버가 회사에서 정상적으로 제거되었습니다.");
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "멤버 제거에 실패했습니다.");
      } finally {
        setRemoveConfirmUser(null);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Users Table Card */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-bold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
                <th className="px-6 py-3.5">이름</th>
                <th className="px-6 py-3.5">이메일 / 연락처</th>
                <th className="px-6 py-3.5">직함 / 부서</th>
                <th className="px-6 py-3.5">역할</th>
                <th className="px-6 py-3.5">가입 상태</th>
                <th className="px-6 py-3.5">이용 상태</th>
                <th className="px-6 py-3.5 text-right">설정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/80">
              {users.map((row) => {
                const expired = isInviteExpired(row);
                const isOwner = isInitialOwner(row);

                let joinStatusText = "가입완료";
                let joinStatusClass =
                  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
                if (expired) {
                  joinStatusText = "초대만료";
                  joinStatusClass =
                    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
                } else if (row.status === "invited") {
                  joinStatusText = "초대됨";
                  joinStatusClass =
                    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
                }

                let usageStatusText = "정상이용";
                let usageStatusClass =
                  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
                if (row.status === "invited" || expired) {
                  usageStatusText = "대기중";
                  usageStatusClass =
                    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
                } else if (row.status === "suspended") {
                  usageStatusText = "이용정지";
                  usageStatusClass =
                    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
                }

                return (
                  <tr
                    key={row.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 flex-wrap">
                        <span>{row.name || "(이름 미입력)"}</span>
                        {row.id === currentUserId && (
                          <span className="inline-block rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-1.5 py-0.5 text-[9px] font-bold">
                            본인
                          </span>
                        )}
                        {isOwner && (
                          <span className="inline-block rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800">
                            최초 관리자
                          </span>
                        )}
                        {row.is_primary && (
                          <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[9px] font-bold border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800">
                            대표 담당자
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <p className="text-zinc-900 dark:text-zinc-200 font-mono text-[11px]">
                        {row.email}
                      </p>
                      {row.phone ? (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                          📞 {row.phone}
                        </p>
                      ) : (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                          연락처 등록 없음
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      {row.title || row.position ? (
                        <>
                          {row.title && (
                            <span className="text-[11px] font-medium text-zinc-800 dark:text-zinc-200 block">
                              {row.title}
                            </span>
                          )}
                          {row.position && (
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block">
                              {row.position}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                          등록 없음
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {row.company_role === "company_admin" ? (
                        <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/70 dark:border-indigo-700/70 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-200 shadow-2xs">
                          {ROLE_LABEL[row.company_role] || "관리자(Admin)"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-zinc-100 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 px-2.5 py-0.5 text-[11px] font-medium text-zinc-800 dark:text-zinc-200">
                          {ROLE_LABEL[row.company_role] || "담당자(Staff)"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${joinStatusClass}`}
                      >
                        {joinStatusText}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${usageStatusClass}`}
                      >
                        {usageStatusText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {row.id === currentUserId && (
                        <>
                          <Link
                            href="/portal/account"
                            className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center gap-1"
                          >
                            <span>내 계정 관리</span>
                          </Link>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                        </>
                      )}
                      {row.status === "invited" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReinvite(row.id)}
                            className="font-semibold text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-white cursor-pointer"
                          >
                            재초대
                          </button>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <button
                            type="button"
                            onClick={() => setCancelConfirmUser(row)}
                            className="font-semibold text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                          >
                            초청 취소
                          </button>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(row.id === editingUser?.id ? editingUser : row)}
                            className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
                          >
                            수정
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(row.id === editingUser?.id ? editingUser : row)}
                            className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300 cursor-pointer"
                          >
                            수정
                          </button>
                          {!isOwner && (
                            <>
                              <span className="text-zinc-300 dark:text-zinc-700">|</span>
                              <button
                                type="button"
                                onClick={() => setRemoveConfirmUser(row)}
                                className="font-semibold text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer"
                              >
                                멤버 제거
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
                    등록된 멤버가 존재하지 않습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal (Popup) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 shrink-0">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  멤버 정보 및 권한 수정
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  기본 정보, 권한(ACL) 및 담당 업무를 설정합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {editingUser.id === currentUserId && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span>💡</span>
                    <span>본인의 프로필 및 비밀번호 변경은 <strong>내 계정</strong> 메뉴에서도 직접 관리하실 수 있습니다.</span>
                  </div>
                  <Link
                    href="/portal/account"
                    onClick={() => setEditingUser(null)}
                    className="font-bold underline hover:opacity-80 shrink-0 text-indigo-700 dark:text-indigo-300"
                  >
                    내 계정 바로가기 →
                  </Link>
                </div>
              )}

              {/* Section 1: 기본 정보 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    1. 기본 정보
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      이름 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="홍길동"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      이메일 (Login Email) *
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="account@company.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      직함 (Job Title)
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="대표, 이사, 과장, 매니저 등"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      포지션 / 부서 (Department)
                    </label>
                    <input
                      type="text"
                      value={formPosition}
                      onChange={(e) => setFormPosition(e.target.value)}
                      placeholder="해외영업팀, 마케팅팀, 물류운영 등"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Full-width Phone Input for Maximum Clarity & Visibility */}
                <div>
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    연락처 (Phone Number)
                  </label>
                  <div className="w-full">
                    <InternationalPhoneInput
                      value={formPhone}
                      onChange={(val) => setFormPhone(val)}
                      placeholder="856-555-1234 또는 010-1234-5678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      회사 내 역할
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as any)}
                      className={inputClass}
                    >
                      <option
                        value="company_staff"
                        className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        담당자 (Staff)
                      </option>
                      <option
                        value="company_admin"
                        className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        관리자 (Admin)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      이용 제한 상태
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className={inputClass}
                      disabled={editingUser.status === "invited"}
                    >
                      {editingUser.status === "invited" && (
                        <option
                          value="invited"
                          className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          초대 대기중
                        </option>
                      )}
                      <option
                        value="active"
                        className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        Active (정상 이용)
                      </option>
                      <option
                        value="suspended"
                        className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        Deactive (이용 일시정지)
                      </option>
                    </select>
                  </div>
                </div>

                {/* Primary Contact Selector */}
                <div className="flex items-center gap-2.5 py-2.5 px-3 bg-zinc-50 rounded-lg border border-zinc-200 dark:bg-zinc-950/40 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    id="primary-checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                  />
                  <label
                    htmlFor="primary-checkbox"
                    className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 select-none cursor-pointer"
                  >
                    대표 담당자 (회사 주 컨택 포인트로 지정)
                  </label>
                </div>
              </div>

              {/* Section 2: ACL Permissions Matrix */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                    2. 포털 메뉴별 세부 권한 설정 (ACL)
                  </span>
                  {formRole === "company_admin" && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-800">
                      관리자는 항상 모든 권한 소유
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
                  <div className="grid grid-cols-2 bg-zinc-50/80 text-[11px] font-bold text-zinc-600 border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800 p-2.5">
                    <div>메뉴 카테고리</div>
                    <div className="text-right">권한 수준</div>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-xs">
                    {/* Inquiry Application */}
                    <div className="grid grid-cols-2 p-2.5 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        입점 신청서
                      </span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.application || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) =>
                            setFormPermissions({
                              ...formPermissions,
                              application: e.target.value,
                            })
                          }
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                        >
                          {permissionOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Brands */}
                    <div className="grid grid-cols-2 p-2.5 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        브랜드 관리
                      </span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.brands || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) =>
                            setFormPermissions({
                              ...formPermissions,
                              brands: e.target.value,
                            })
                          }
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                        >
                          {permissionOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Products */}
                    <div className="grid grid-cols-2 p-2.5 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        제품 관리
                      </span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.products || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) =>
                            setFormPermissions({
                              ...formPermissions,
                              products: e.target.value,
                            })
                          }
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                        >
                          {permissionOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Company Info */}
                    <div className="grid grid-cols-2 p-2.5 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        회사 정보
                      </span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.company_info || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) =>
                            setFormPermissions({
                              ...formPermissions,
                              company_info: e.target.value,
                            })
                          }
                          className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 disabled:opacity-50"
                        >
                          {permissionOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: 담당 업무 설정 섹션 */}
              <div className="space-y-3 pt-2">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider block">
                    3. 담당 업무 및 알림 배정
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    업무별 주 담당자와 이메일 알림 수신 여부를 설정합니다.
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:bg-zinc-950/60 dark:border-zinc-800">
                        <th className="p-2.5">업무명 및 설명</th>
                        <th className="p-2.5 text-center w-20">주 담당자</th>
                        <th className="p-2.5 text-center w-24">이메일 알림</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {TASK_DEFINITIONS.map((def) => {
                        const state = formTaskAssignments[def.code] || {
                          is_primary: false,
                          email_notify: false,
                        };
                        return (
                          <tr
                            key={def.code}
                            className="hover:bg-zinc-50/20 dark:hover:bg-zinc-800/30"
                          >
                            <td className="p-2.5">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">
                                {def.label}
                              </span>
                              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                                {def.desc}
                              </span>
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={state.is_primary}
                                onChange={(e) =>
                                  handleTaskCheckboxChange(def.code, "is_primary", e.target.checked)
                                }
                                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={state.email_notify}
                                onChange={(e) =>
                                  handleTaskCheckboxChange(
                                    def.code,
                                    "email_notify",
                                    e.target.checked
                                  )
                                }
                                className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 dark:border-zinc-700 dark:bg-zinc-900 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/60 shrink-0">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              >
                {isPending ? "저장 중..." : "수정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Removal Confirmation Modal */}
      {removeConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  멤버 제거 확인
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  회사 소속 멤버십 해제
                </p>
              </div>
            </div>

            <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2 bg-zinc-50 dark:bg-zinc-950/40 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 leading-relaxed">
              <p>
                <strong className="text-zinc-900 dark:text-white font-semibold">
                  {removeConfirmUser.name || removeConfirmUser.email}
                </strong>
                님을 이 회사에서 제거하시겠습니까?
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                이 사용자는 더 이상 이 회사의 Portal 데이터(브랜드, 제품, 발주, 정산 등)에 접근할 수 없게 됩니다.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRemoveConfirmUser(null)}
                disabled={isPending}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleRemoveMemberSubmit}
                disabled={isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              >
                {isPending ? "제거 처리 중..." : "사용자 제거"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invite Modal */}
      {cancelConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  초청 취소 확인
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  초대 대기중인 사용자 초청 취소
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <strong className="text-zinc-900 dark:text-white font-semibold">
                {cancelConfirmUser.name || cancelConfirmUser.email}
              </strong>
              님의 초청을 취소하시겠습니까? 발송된 초대 링크가 즉시 무효화됩니다.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCancelConfirmUser(null)}
                disabled={isPending}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCancelInviteSubmit}
                disabled={isPending}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
              >
                {isPending ? "취소 처리 중..." : "초청 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

