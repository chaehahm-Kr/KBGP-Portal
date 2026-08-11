"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateCompanyAdminMetadata,
  adminInviteCompanyUser,
  adminUpdateCompanyUser,
  adminDeleteCompanyUser,
  type CompanyContact,
  type CompanyParsedMetadata
} from "@/lib/company/admin-actions";
import { type PartnerStatusConfig } from "@/lib/settings/actions";
import { 
  updateUserTaskAssignments, 
  assignTaskPrimaryUser, 
  handleUserSuspensionTaskCheck, 
  type TaskAssignmentItem 
} from "@/lib/company/task-actions";
import { TASK_DEFINITIONS } from "@/lib/company/task-constants";

const STATUS_LABEL: Record<string, string> = {
  invited: "초대됨",
  active: "가입완료",
  suspended: "비활성화됨",
};

const ROLE_LABEL: Record<string, string> = {
  company_admin: "관리자(Admin)",
  company_staff: "담당자(Staff)",
};

interface CompanyDetailManagerProps {
  company: {
    id: string;
    name: string;
    business_registration_number: string;
    country: string;
    status: string;
    created_at: string;
  };
  parsedMeta: CompanyParsedMetadata;
  companyUsers: any[];
  brands: {
    id: string;
    name: string;
    logoUrl: string | null;
    introText: string | null;
    hasKr: boolean;
    krNum: string | null;
    krUrl: string | null;
    hasUs: boolean;
    usNum: string | null;
    usUrl: string | null;
  }[];
  products: {
    id: string;
    name: string;
    name_en?: string | null;
    brand_id: string;
    price_additional_info?: any;
  }[];
  applications: {
    id: string;
    application_number: string;
    status: string;
    submitted_at: string;
  }[];
  brandNameById: Map<string, string>;
  typeOptions: string[];
  statusOptions: PartnerStatusConfig[];
  taskAssignments: TaskAssignmentItem[]; // [신규 추가]: 담당 업무 초기 데이터
}

export function CompanyDetailManager({
  company,
  parsedMeta,
  companyUsers,
  brands,
  products,
  applications,
  brandNameById,
  typeOptions,
  statusOptions,
  taskAssignments,
}: CompanyDetailManagerProps) {
  const [activeTab, setActiveTab] = useState<"brands" | "products" | "applications">("brands");
  const [isPending, startTransition] = useTransition();

  // Company general metadata states
  const [address, setAddress] = useState(parsedMeta.address);
  const [website, setWebsite] = useState(parsedMeta.website);
  const [adminMemo, setAdminMemo] = useState(parsedMeta.adminMemo);
  const [type, setType] = useState(parsedMeta.type);
  const [status, setStatus] = useState(parsedMeta.status);
  
  // Editing modes
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  // Temporary edit states
  const [tempAddress, setTempAddress] = useState(address);
  const [tempWebsite, setTempWebsite] = useState(website);
  const [tempAdminMemo, setTempAdminMemo] = useState(adminMemo);
  const [tempType, setTempType] = useState(type);
  const [tempStatus, setTempStatus] = useState(status);

  // New States for Portal User Manager
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // [신규 기능]: 로컬 유저 리스트 및 담당 업무 상태 선언
  const [users, setUsers] = useState<any[]>(companyUsers);
  const [tasks, setTasks] = useState<TaskAssignmentItem[]>(taskAssignments);

  // Add User Form States
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addPosition, setAddPosition] = useState("");
  const [addRole, setAddRole] = useState<"company_admin" | "company_staff">("company_staff");
  const [addIsPrimary, setAddIsPrimary] = useState(false);
  const [addPermissions, setAddPermissions] = useState({
    application: "none",
    brands: "none",
    products: "none",
    company_info: "none",
  });

  // Edit User Form States
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editRole, setEditRole] = useState<"company_admin" | "company_staff">("company_staff");
  const [editStatus, setEditStatus] = useState<"active" | "suspended" | "invited">("active");
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editPermissions, setEditPermissions] = useState({
    application: "none",
    brands: "none",
    products: "none",
    company_info: "none",
  });

  // [신규 기능]: 수정 모달 용 담당 업무 임시 상태
  const [editTaskAssignments, setEditTaskAssignments] = useState<
    Record<string, { is_primary: boolean; email_notify: boolean }>
  >({});

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name || "");
    setEditPhone(user.phone || "");
    setEditTitle(user.title || "");
    setEditPosition(user.position || "");
    setEditRole(user.company_role || "company_staff");
    setEditStatus(user.status || "active");
    setEditIsPrimary(user.is_primary || false);
    setEditPermissions(
      user.permissions || {
        application: "none",
        brands: "none",
        products: "none",
        company_info: "none",
      }
    );

    // 해당 유저의 담당 업무 6개 임시 상태 초기화
    const initialTasks: Record<string, { is_primary: boolean; email_notify: boolean }> = {};
    TASK_DEFINITIONS.forEach(def => {
      const found = user.task_assignments?.find((a: any) => a.task_code === def.code);
      initialTasks[def.code] = {
        is_primary: found ? found.is_primary : false,
        email_notify: found ? found.email_notify : false,
      };
    });
    setEditTaskAssignments(initialTasks);
    setIsEditUserOpen(true);
  };

  // [신규 기능]: 어드민 수정 모달용 주 담당자 체크박스 제어
  const handleEditTaskCheckboxChange = (
    taskCode: string,
    field: "is_primary" | "email_notify",
    checked: boolean
  ) => {
    if (field === "is_primary" && checked) {
      // 본인을 제외한 타인의 주 담당자 지정 여부 선제 체크
      const activePrimaryUser = users.find(u => {
        if (u.id === selectedUser.id) return false;
        return u.task_assignments?.some((a: any) => a.task_code === taskCode && a.is_primary);
      });

      if (activePrimaryUser) {
        const confirmChange = confirm(
          `현재 이 업무에는 다른 주 담당자(${activePrimaryUser.name || "미지정"})가 지정되어 있습니다. 주 담당자를 변경하시겠습니까?`
        );
        if (!confirmChange) return;
      }

      setEditTaskAssignments(prev => ({
        ...prev,
        [taskCode]: {
          ...prev[taskCode],
          is_primary: true,
          email_notify: true
        }
      }));
    } else {
      setEditTaskAssignments(prev => ({
        ...prev,
        [taskCode]: {
          ...prev[taskCode],
          [field]: checked
        }
      }));
    }
  };

  // [신규 기능]: 이메일 알림 수신인 텍스트 수집 헬퍼
  const getEmailRecipientsForTask = (taskCode: string) => {
    return users
      .filter(u => u.status === "active" && u.task_assignments?.some((a: any) => a.task_code === taskCode && a.email_notify))
      .map(u => u.name || "(이름 없음)")
      .join(", ") || "없음";
  };

  // [신규 기능]: 회사 상세 화면에서 직접 담당자 변경
  const handleAssignPrimaryUser = async (taskCode: string, targetUserId: string | null) => {
    const targetUser = users.find(u => u.id === targetUserId);
    const currentPrimary = tasks.find(t => t.taskCode === taskCode);

    if (targetUserId && currentPrimary?.userId && currentPrimary.userId !== targetUserId) {
      const confirmChange = confirm(
        `현재 이 업무에는 다른 주 담당자(${currentPrimary.userName || "미지정"})가 지정되어 있습니다. 주 담당자를 변경하시겠습니까?`
      );
      if (!confirmChange) return;
    }

    startTransition(async () => {
      try {
        await assignTaskPrimaryUser(company.id, taskCode, targetUserId, "admin");

        // 로컬 상태 동기화 갱신
        const updatedTasks = tasks.map(t => {
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
        });

        // 로컬 사용자 리스트 내 task_assignments 도 양방향 갱신
        const updatedUsers = users.map(u => {
          if (u.id === targetUserId) {
            const hasTask = u.task_assignments?.some((a: any) => a.task_code === taskCode);
            const fresh = u.task_assignments ? [...u.task_assignments] : [];
            if (hasTask) {
              return {
                ...u,
                task_assignments: fresh.map((a: any) => a.task_code === taskCode ? { ...a, is_primary: true, email_notify: true } : a)
              };
            } else {
              fresh.push({ user_id: u.id, task_code: taskCode, is_primary: true, email_notify: true });
              return { ...u, task_assignments: fresh };
            }
          } else {
            // 다른 유저의 해당 업무 is_primary 해제
            return {
              ...u,
              task_assignments: u.task_assignments?.map((a: any) => a.task_code === taskCode ? { ...a, is_primary: false } : a) || []
            };
          }
        });

        setTasks(updatedTasks);
        setUsers(updatedUsers);

        alert("주 담당자 배정이 완료되었습니다.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "담당자 배정에 실패했습니다.");
      }
    });
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) {
      alert("이름과 이메일은 필수 입력 사항입니다.");
      return;
    }
    startTransition(async () => {
      try {
        await adminInviteCompanyUser(company.id, {
          name: addName,
          email: addEmail,
          title: addTitle,
          position: addPosition,
          phone: addPhone,
          companyRole: addRole,
          isPrimary: addIsPrimary,
          permissions: addPermissions,
        });

        // 리로드 유도
        setIsAddUserOpen(false);
        alert("초대장이 발송되었습니다. 새로고침 후 유저 리스트에 반영됩니다.");
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "담당자 초대 실패");
      }
    });
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!editName.trim()) {
      alert("이름은 필수 입력 사항입니다.");
      return;
    }

    // [신규 예외처리]: 비활성화(suspended) 시 주 담당자 배정 여부 검사
    if (editStatus === "suspended") {
      const ownedPrimaryTasks = tasks.filter(t => t.userId === selectedUser.id);
      if (ownedPrimaryTasks.length > 0) {
        const taskLabels = ownedPrimaryTasks.map(t => `'${t.label}'`).join(", ");
        const confirmSuspension = confirm(
          `이 사용자는 현재 ${taskLabels} 업무의 주 담당자입니다. 비활성화 시 해당 업무들은 '주 담당자 미지정' 상태로 자동 변경됩니다. 비활성화를 진행하시겠습니까?`
        );
        if (!confirmSuspension) return;

        // 주 담당자 정보 DB 및 로컬 해제 실행
        await handleUserSuspensionTaskCheck(selectedUser.id, company.id);
      }
    }

    startTransition(async () => {
      try {
        // 1. 인적 권한 정보 갱신
        await adminUpdateCompanyUser(company.id, selectedUser.id, {
          name: editName,
          phone: editPhone,
          title: editTitle,
          position: editPosition,
          companyRole: editRole,
          status: editStatus,
          isPrimary: editIsPrimary,
          permissions: editPermissions,
        });

        // 2. 담당 업무 6개 상태 갱신
        const payload = Object.entries(editTaskAssignments).map(([code, val]) => ({
          task_code: code,
          is_primary: val.is_primary,
          email_notify: val.email_notify,
        }));
        await updateUserTaskAssignments(selectedUser.id, company.id, payload, "admin");

        // 3. 로컬 렌더링 상태 동기화 갱신
        const updatedUsers = users.map(u => {
          if (u.id === selectedUser.id) {
            const newAssignments = Object.entries(editTaskAssignments).map(([code, val]) => ({
              user_id: u.id,
              task_code: code,
              is_primary: val.is_primary,
              email_notify: val.email_notify,
            }));
            return {
              ...u,
              name: editName,
              phone: editPhone,
              title: editTitle,
              position: editPosition,
              company_role: editRole,
              status: editStatus,
              is_primary: editIsPrimary,
              permissions: editPermissions,
              task_assignments: newAssignments
            };
          } else {
            // 주 담당자 중복 해제 동기화
            const updatedAssignments = u.task_assignments?.map((a: any) => {
              const targetTask = editTaskAssignments[a.task_code];
              if (targetTask?.is_primary) {
                return { ...a, is_primary: false };
              }
              return a;
            }) || [];
            return {
              ...u,
              is_primary: editIsPrimary ? false : u.is_primary,
              task_assignments: updatedAssignments
            };
          }
        });

        // 로컬 tasks 명세도 즉시 동기화
        const updatedTasks = tasks.map(t => {
          const state = editTaskAssignments[t.taskCode];
          if (state?.is_primary) {
            return {
              ...t,
              userId: selectedUser.id,
              isPrimary: true,
              userName: editName,
              userTitle: editTitle,
              userPosition: editPosition,
              userEmail: selectedUser.email,
              userPhone: editPhone,
            };
          } else if (t.userId === selectedUser.id && !state?.is_primary) {
            // 본인이 주 담당자였으나 해제된 경우
            return {
              ...t,
              userId: null,
              isPrimary: false,
              userName: null,
              userTitle: null,
              userPosition: null,
              userEmail: null,
              userPhone: null,
            };
          }
          return t;
        });

        setUsers(updatedUsers);
        setTasks(updatedTasks);
        setIsEditUserOpen(false);
        alert("저장 완료되었습니다.");
      } catch (err: any) {
        alert(err.message || "담당자 정보 수정 실패");
      }
    });
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    // [신규 예외처리]: 삭제 대상이 주 담당자 배정 상태인지 확인
    const ownedPrimaryTasks = tasks.filter(t => t.userId === selectedUser.id);
    if (ownedPrimaryTasks.length > 0) {
      const taskLabels = ownedPrimaryTasks.map(t => `'${t.label}'`).join(", ");
      alert(`이 사용자는 현재 ${taskLabels} 업무의 주 담당자입니다. 새로운 주 담당자를 지정한 후 멤버를 삭제해 주세요.`);
      return;
    }

    if (!confirm(`${selectedUser.name || selectedUser.email} 담당자를 삭제하시겠습니까?\n삭제 시 이 사용자는 더 이상 포털에 로그인할 수 없습니다.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await adminDeleteCompanyUser(company.id, selectedUser.id);
        setIsEditUserOpen(false);
        alert("삭제되었습니다. 새로고침 후 유저 리스트에 반영됩니다.");
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "담당자 삭제 실패");
      }
    });
  };

  const handleSaveMeta = async () => {
    startTransition(async () => {
      try {
        await updateCompanyAdminMetadata(company.id, {
          address: tempAddress,
          website: tempWebsite,
          adminMemo: tempAdminMemo,
          contacts: [], 
          type: tempType,
          status: tempStatus,
        });
        setAddress(tempAddress);
        setWebsite(tempWebsite);
        setAdminMemo(tempAdminMemo);
        setType(tempType);
        setStatus(tempStatus);
        setIsEditingMeta(false);
      } catch (err) {
        alert(err instanceof Error ? err.message : "회사 정보 저장 실패");
      }
    });
  };

  const statusConfig = statusOptions.find((o) => o.id === status) || { label: status, color: "zinc" };
  const statusColorClass =
    statusConfig.color === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
      : statusConfig.color === "amber"
      ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
      : statusConfig.color === "rose"
      ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900"
      : "bg-zinc-50 text-zinc-700 border-zinc-150 dark:bg-zinc-800 dark:text-zinc-350 dark:border-zinc-700";

  // 활성 상태 멤버 목록
  const activeMembers = users.filter(u => u.status === "active");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-start">
        {/* Left Column: General legal information */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 relative">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                회사 정보 관리
              </span>
              {!isEditingMeta ? (
                <button
                  onClick={() => {
                    setTempAddress(address);
                    setTempWebsite(website);
                    setTempAdminMemo(adminMemo);
                    setTempType(type);
                    setTempStatus(status);
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
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">파트너 상태</span>
                {isEditingMeta ? (
                  <select
                    value={tempStatus}
                    onChange={(e) => setTempStatus(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`mt-1 inline-block rounded px-2.5 py-0.5 text-[10px] font-bold border ${statusColorClass}`}>
                    {statusConfig.label}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 유형</span>
                {isEditingMeta ? (
                  <select
                    value={tempType}
                    onChange={(e) => setTempType(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    {typeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{type}</span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">국가</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{company.country}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">사업자등록번호</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{company.business_registration_number}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">등록일</span>
                <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                  {new Date(company.created_at).toLocaleDateString()}
                </span>
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

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-550 uppercase block">관리자 메모</span>
                {isEditingMeta ? (
                  <textarea
                    value={tempAdminMemo}
                    onChange={(e) => setTempAdminMemo(e.target.value)}
                    placeholder="관리자용 내부 메모를 작성하세요"
                    rows={3}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                  />
                ) : (
                  <div className="bg-zinc-50 p-2.5 rounded-md mt-1 border border-zinc-150 text-[11px] text-zinc-600 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-400 min-h-[50px] whitespace-pre-wrap leading-relaxed">
                    {adminMemo || "작성된 관리자 메모가 없습니다."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: User Management, Brands & Products tabs */}
        <div className="md:col-span-2 space-y-6">
          
          {/* User list */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-950 dark:text-white">담당자 및 포털 사용자 ({users.length})</h3>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="rounded bg-zinc-900 px-2 py-1 text-[10px] font-bold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                + 신규 담당자 초대
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-2">이름</th>
                    <th className="px-4 py-2">이메일/연락처</th>
                    <th className="px-4 py-2">직함/부서</th>
                    <th className="px-4 py-2">역할</th>
                    <th className="px-4 py-2">상태</th>
                    <th className="px-4 py-2 text-right">설정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {users.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                      <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          {row.name || "(이름 없음)"}
                          {row.is_primary && (
                            <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[8px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                              주 컨택
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-[11px] text-zinc-600 dark:text-zinc-350">{row.email}</p>
                        {row.phone && <p className="text-[10px] text-zinc-400">📞 {row.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {row.title || row.position ? (
                          <>
                            {row.title && <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.title}</span>}
                            {row.position && <span className="text-[10px] text-zinc-400 block">{row.position}</span>}
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">등록 없음</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] border border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                          {ROLE_LABEL[row.company_role]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${
                          row.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : row.status === "invited"
                            ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300"
                        }`}>
                          {STATUS_LABEL[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="font-bold text-indigo-650 hover:underline dark:text-indigo-400"
                        >
                          상세 및 권한
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* [신규 기능]: 담당 업무 및 주 담당자 관리 테이블 카드 */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">담당 업무 및 주 담당자</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <th className="px-4 py-3">업무명</th>
                    <th className="px-4 py-3">주 담당자 정보</th>
                    <th className="px-4 py-3">알림 수신인</th>
                    <th className="px-4 py-3 text-center w-28">지정 상태</th>
                    <th className="px-4 py-3 text-right">담당자 직접 변경</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {tasks.map((task) => {
                    const notifyNames = getEmailRecipientsForTask(task.taskCode);
                    const matchingUser = users.find(u => u.id === task.userId);
                    return (
                      <tr key={task.taskCode} className="hover:bg-zinc-50/20">
                        <td className="px-4 py-3.5">
                          <span className="font-bold text-zinc-850 dark:text-zinc-200 block">{task.label}</span>
                          <span className="text-[9px] text-zinc-400 block mt-0.5 leading-relaxed max-w-xs">{task.desc}</span>
                        </td>
                        <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-350">
                          {task.userId ? (
                            <div className="space-y-0.5">
                              {/* 담당자 이름을 클릭하면 해당 사용자의 권한 수정 모달 오픈 */}
                              <button
                                onClick={() => matchingUser && handleOpenEdit(matchingUser)}
                                className="font-semibold text-emerald-600 hover:underline dark:text-emerald-450 text-[13px] text-left cursor-pointer"
                              >
                                {task.userName}
                              </button>
                              {task.userTitle || task.userPosition ? (
                                <p className="text-[10px] text-zinc-400">
                                  {task.userTitle || ""}{task.userTitle && task.userPosition ? " / " : ""}{task.userPosition || ""}
                                </p>
                              ) : null}
                              <p className="text-[9px] text-zinc-455 font-mono">{task.userEmail}</p>
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
                            <span className="inline-block rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300">
                              설정 완료
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold border border-rose-100 dark:bg-rose-950/40 dark:text-rose-300">
                              미지정
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <select
                            value={task.userId || ""}
                            onChange={(e) => handleAssignPrimaryUser(task.taskCode, e.target.value || null)}
                            disabled={isPending}
                            className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-800 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white max-w-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="">-- 담당자 선택 --</option>
                            {activeMembers.map(u => (
                              <option key={u.id} value={u.id}>
                                {u.name || "(이름 없음)"} ({u.title || "멤버"})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Brands, Products, Applications Tabs */}
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/20">
              <nav className="flex gap-4 text-xs font-bold text-zinc-400">
                {(["brands", "products", "applications"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-1 border-b-2 transition-all ${
                      activeTab === tab
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent hover:text-zinc-600"
                    }`}
                  >
                    {tab === "brands" ? "보유 브랜드" : tab === "products" ? "등록 제품" : "입점 신청서"}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-5 text-xs">
              {activeTab === "brands" && (
                <div className="space-y-3">
                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <div key={brand.id} className="flex items-center justify-between border-b border-zinc-50 pb-2 last:border-0 dark:border-zinc-800/50">
                        <div>
                          <p className="font-bold text-zinc-850 dark:text-zinc-200">{brand.name}</p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">{brand.introText || "브랜드 소개글이 없습니다."}</p>
                        </div>
                        <div className="flex gap-1.5">
                          {brand.hasKr && (
                            <span className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] dark:bg-zinc-800 dark:border-zinc-700">
                              KR 상표
                            </span>
                          )}
                          {brand.hasUs && (
                            <span className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] dark:bg-zinc-800 dark:border-zinc-700">
                              US 상표
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-400 italic">보유한 브랜드가 없습니다.</p>
                  )}
                </div>
              )}

              {activeTab === "products" && (
                <div className="space-y-2">
                  {products.length > 0 ? (
                    products.map((prod) => {
                      const overrides = (prod.price_additional_info as any)?.admin_overrides || {};
                      const prodDisplayName = overrides.name_en || prod.name_en || overrides.name || prod.name;
                      return (
                        <div key={prod.id} className="flex justify-between items-center border-b border-zinc-50 pb-1.5 last:border-0 dark:border-zinc-800/50">
                          <Link
                            href={`/admin/products/${prod.id}`}
                            className="font-semibold text-zinc-850 hover:underline hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white transition-colors"
                          >
                            {prodDisplayName}
                          </Link>
                          <span className="text-[10px] text-zinc-450 font-medium">
                            브랜드: {brandNameById.get(prod.brand_id) || "알 수 없음"}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-zinc-400 italic">등록된 제품이 없습니다.</p>
                  )}
                </div>
              )}

              {activeTab === "applications" && (
                <div className="space-y-2">
                  {applications.length > 0 ? (
                    applications.map((app) => (
                      <div key={app.id} className="flex justify-between items-center border-b border-zinc-50 pb-1.5 last:border-0 dark:border-zinc-800/50">
                        <div>
                          <Link
                            href={`/admin/applications/${app.id}`}
                            className="font-bold text-zinc-850 hover:underline dark:text-zinc-200"
                          >
                            {app.application_number}
                          </Link>
                          <span className="text-[10px] text-zinc-400 ml-2 font-mono">
                            {new Date(app.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                          app.status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : app.status === "info_requested"
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : app.status === "under_review"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}>
                          {app.status === "approved"
                            ? "승인완료"
                            : app.status === "info_requested"
                            ? "보완요청"
                            : app.status === "under_review"
                            ? "심사중"
                            : "반려"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-400 italic">제출된 입점 신청서가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">신규 담당자 등록 및 초대</h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-150"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-450 block">이름 *</label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-450 block">이메일 *</label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-450 block">직함</label>
                  <input
                    type="text"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    placeholder="과장, 부장 등"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-450 block">포지션/부서</label>
                  <input
                    type="text"
                    value={addPosition}
                    onChange={(e) => setAddPosition(e.target.value)}
                    placeholder="영업부, 마케팅 등"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-455 block">연락처</label>
                <input
                  type="text"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-zinc-100">
                <div>
                  <label className="text-[10px] font-bold text-zinc-450 block">회사 내 역할</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="company_staff">담당자 (Staff)</option>
                    <option value="company_admin">관리자 (Admin)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add-primary"
                      checked={addIsPrimary}
                      onChange={(e) => setAddIsPrimary(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="add-primary" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      대표 담당자(주 컨택 지정)
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-550 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-900 px-4 py-2 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950"
                >
                  {isPending ? "초대중..." : "초대 메일 발송"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditUserOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">담당자 세부 설정 및 권한</h3>
                <p className="text-[10px] text-zinc-450 font-mono mt-0.5">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditUserOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-150"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUserSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이름 *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">연락처</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="010-1234-5678"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">직함</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="과장, 차장 등"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">포지션/부서</label>
                  <input
                    type="text"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    placeholder="해외영업부, 마케팅 등"
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-805">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">회사 내 역할 (Role)</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  >
                    <option value="company_staff">담당자 (Staff)</option>
                    <option value="company_admin">관리자 (Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">이용 상태 (Status)</label>
                  <select
                    value={editStatus}
                    disabled={selectedUser.status === "invited"}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white disabled:bg-zinc-50/50 disabled:text-zinc-400"
                  >
                    <option value="active">정상 이용 (Active)</option>
                    <option value="suspended">이용 정지 (Suspended)</option>
                    <option value="invited">초대 대기중 (Invited)</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-primary"
                      checked={editIsPrimary}
                      onChange={(e) => setEditIsPrimary(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="edit-primary" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                      주 컨택 지정
                    </label>
                  </div>
                </div>
              </div>

              {/* Permissions matrix */}
              <div className="rounded-lg border border-zinc-150 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-950/20 space-y-3">
                <h4 className="font-bold text-[11px] text-zinc-450 dark:text-zinc-550 uppercase tracking-wider">메뉴별 상세 권한 설정</h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">입점 신청서</span>
                    <select
                      value={editPermissions.application || "none"}
                      onChange={(e) => setEditPermissions({ ...editPermissions, application: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">브랜드 관리</span>
                    <select
                      value={editPermissions.brands || "none"}
                      onChange={(e) => setEditPermissions({ ...editPermissions, brands: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">제품 관리</span>
                    <select
                      value={editPermissions.products || "none"}
                      onChange={(e) => setEditPermissions({ ...editPermissions, products: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">회사 정보</span>
                    <select
                      value={editPermissions.company_info || "none"}
                      onChange={(e) => setEditPermissions({ ...editPermissions, company_info: e.target.value })}
                      className="rounded border border-zinc-200 bg-white p-1 text-[11px] text-zinc-900 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="none">권한 없음</option>
                      <option value="read_only">읽기 전용</option>
                      <option value="read_write">읽기 및 쓰기</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* [신규 기능]: 어드민 수정 모달 내 담당 업무 설정 */}
              <div className="space-y-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">담당 업무 설정</h4>
                  <p className="text-[10px] text-zinc-550 mt-1 leading-relaxed">
                    업무별 주 담당자와 이메일 알림 수신 여부를 설정합니다.
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-200 overflow-hidden dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-zinc-50 text-[10px] font-bold text-zinc-500 border-b border-zinc-200 dark:bg-zinc-950/20 dark:border-zinc-800">
                        <th className="p-2">업무명</th>
                        <th className="p-2 text-center w-20">주 담당자</th>
                        <th className="p-2 text-center w-24">이메일 알림</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {TASK_DEFINITIONS.map(def => {
                        const state = editTaskAssignments[def.code] || { is_primary: false, email_notify: false };
                        return (
                          <tr key={def.code} className="hover:bg-zinc-50/20">
                            <td className="p-2">
                              <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{def.label}</span>
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={state.is_primary}
                                onChange={(e) => handleEditTaskCheckboxChange(def.code, "is_primary", e.target.checked)}
                                className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={state.email_notify}
                                onChange={(e) => handleEditTaskCheckboxChange(def.code, "email_notify", e.target.checked)}
                                className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isPending}
                  className="rounded border border-red-200 bg-rose-50 px-4 py-2 font-bold text-red-650 hover:bg-rose-100 disabled:opacity-50 text-[11px]"
                >
                  담당자 삭제
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditUserOpen(false)}
                    className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-500 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950 text-[11px]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded bg-zinc-950 px-4 py-2 font-bold text-white hover:bg-zinc-850 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 text-[11px]"
                  >
                    {isPending ? "저장중..." : "변경 사항 저장"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
