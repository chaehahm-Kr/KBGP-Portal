"use client";

import React, { useState, useTransition } from "react";
import { updateCompanyUser, reinviteCompanyUser } from "@/lib/company/invite-actions";
import { isInviteExpired } from "@/lib/company/types";

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
  "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 outline-none transition-all focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-700";

const permissionOptions = [
  { value: "none", label: "접근불가" },
  { value: "read", label: "조회전용" },
  { value: "write", label: "수정가능" },
];

export function CompanyUsersManager({ initialUsers, currentUserId }: CompanyUsersManagerProps) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  
  // Edit Form Temp States
  const [formName, setFormName] = useState("");
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

  const [isPending, startTransition] = useTransition();

  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setFormName(user.name || "");
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
  };

  const handleSave = () => {
    if (!editingUser) return;
    if (!formName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        await updateCompanyUser(editingUser.id, {
          name: formName,
          title: formTitle,
          position: formPosition,
          phone: formPhone,
          companyRole: formRole,
          status: formStatus,
          isPrimary: formIsPrimary,
          permissions: formPermissions,
        });

        // Local state update
        setUsers(
          users.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  name: formName,
                  title: formTitle,
                  position: formPosition,
                  phone: formPhone,
                  company_role: formRole,
                  status: formStatus,
                  is_primary: formIsPrimary,
                  permissions: formPermissions,
                }
              : formIsPrimary
              ? { ...u, is_primary: false } // Reset primary contact for other users if this one is set
              : u
          )
        );
        
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

  return (
    <div className="space-y-6">
      {/* Users Table Card */}
      <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                <th className="px-6 py-3.5">이름</th>
                <th className="px-6 py-3.5">이메일 / 연락처</th>
                <th className="px-6 py-3.5">직함 / 부서</th>
                <th className="px-6 py-3.5">역할</th>
                <th className="px-6 py-3.5">가입 상태</th>
                <th className="px-6 py-3.5">이용 상태</th>
                <th className="px-6 py-3.5 text-right">설정</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-xs dark:divide-zinc-800/60">
              {users.map((row) => {
                const expired = isInviteExpired(row);
                
                // 가입 상태 계산
                let joinStatusText = "가입완료";
                let joinStatusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
                if (expired) {
                  joinStatusText = "초대만료";
                  joinStatusClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
                } else if (row.status === "invited") {
                  joinStatusText = "초대됨";
                  joinStatusClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
                }

                // 이용 상태 계산
                let usageStatusText = "정상이용";
                let usageStatusClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
                if (row.status === "invited" || expired) {
                  usageStatusText = "대기중";
                  usageStatusClass = "bg-zinc-50 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-450 dark:border-zinc-750";
                } else if (row.status === "suspended") {
                  usageStatusText = "이용정지";
                  usageStatusClass = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
                }

                return (
                  <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        {row.name || "(이름 미입력)"}
                        {row.is_primary && (
                          <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                            주 컨택
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <p className="text-zinc-650 dark:text-zinc-300 font-mono text-[11px]">{row.email}</p>
                      {row.phone && <p className="text-[10px] text-zinc-400">📞 {row.phone}</p>}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      {row.title || row.position ? (
                        <>
                          {row.title && <span className="text-[11px] font-medium text-zinc-850 dark:text-zinc-200">{row.title}</span>}
                          {row.position && <span className="text-[10px] text-zinc-400 block">{row.position}</span>}
                        </>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">등록 없음</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded bg-zinc-100 border border-zinc-200 dark:bg-zinc-850 dark:border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-800 dark:text-zinc-300">
                        {ROLE_LABEL[row.company_role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${joinStatusClass}`}>
                        {joinStatusText}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${usageStatusClass}`}>
                        {usageStatusText}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {row.status === "invited" && (
                        <button
                          type="button"
                          onClick={() => handleReinvite(row.id)}
                          className="font-semibold text-zinc-550 hover:underline dark:text-zinc-400 cursor-pointer"
                        >
                          재초대
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(row.id === editingUser?.id ? editingUser : row)}
                        className="font-semibold text-emerald-600 hover:underline dark:text-emerald-450 cursor-pointer"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 dark:text-zinc-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">멤버 정보 및 권한 수정</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Profile fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">이름 *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">직함</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="과장, 대표 등"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">포지션 / 부서</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    placeholder="해외영업부, 마케팅 등"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">연락처</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">회사 내 역할</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="company_staff">담당자 (Staff)</option>
                    <option value="company_admin">관리자 (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block">이용 제한 상태</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className={inputClass}
                    disabled={editingUser.status === "invited"}
                  >
                    {editingUser.status === "invited" && (
                      <option value="invited">초대 대기중</option>
                    )}
                    <option value="active">Active (정상 이용)</option>
                    <option value="suspended">Deactive (이용 일시정지)</option>
                  </select>
                </div>
              </div>

              {/* Primary selector */}
              <div className="flex items-center gap-2 py-1 bg-zinc-50/50 p-2.5 rounded border border-zinc-100 dark:bg-zinc-950/20 dark:border-zinc-800">
                <input
                  type="checkbox"
                  id="primary-checkbox"
                  checked={formIsPrimary}
                  onChange={(e) => setFormIsPrimary(e.target.checked)}
                  className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <label htmlFor="primary-checkbox" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 select-none cursor-pointer">
                  대표 담당자(주 컨택 지정)
                </label>
              </div>

              {/* ACL Permissions Matrix */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">메뉴별 세부 권한 설정</h4>
                  {formRole === "company_admin" && (
                    <span className="text-[9px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                      관리자는 항상 모든 권한 소유
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
                  <div className="grid grid-cols-2 bg-zinc-50/50 text-[10px] font-bold text-zinc-450 border-b border-zinc-200 dark:bg-zinc-950/20 dark:border-zinc-800 p-2">
                    <div>메뉴 카테고리</div>
                    <div className="text-right">권한 수준</div>
                  </div>
                  
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-[11px]">
                    {/* Inquiry Application */}
                    <div className="grid grid-cols-2 p-2 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">입점 신청서</span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.application || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) => setFormPermissions({ ...formPermissions, application: e.target.value })}
                          className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Brands */}
                    <div className="grid grid-cols-2 p-2 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">브랜드 관리</span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.brands || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) => setFormPermissions({ ...formPermissions, brands: e.target.value })}
                          className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Products */}
                    <div className="grid grid-cols-2 p-2 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">제품 관리</span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.products || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) => setFormPermissions({ ...formPermissions, products: e.target.value })}
                          className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Company Info */}
                    <div className="grid grid-cols-2 p-2 items-center">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">회사 정보</span>
                      <div className="flex justify-end">
                        <select
                          value={formPermissions.company_info || "none"}
                          disabled={formRole === "company_admin"}
                          onChange={(e) => setFormPermissions({ ...formPermissions, company_info: e.target.value })}
                          className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                        >
                          {permissionOptions.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-850"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "저장 중..." : "수정 완료"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
