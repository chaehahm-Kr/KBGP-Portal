"use client";

import React, { useState, useEffect, useTransition } from "react";
import { 
  type StaffRole, 
  type StaffStatus, 
  type StaffMenuPermissions,
  type MenuActionPermissions,
  STAFF_ROLE_LABEL,
  STAFF_STATUS_LABEL,
  DEFAULT_ROLE_PERMISSIONS
} from "@/lib/staff/types";

type StaffMember = {
  id: string;
  name: string;
  email: string;
  status: StaffStatus;
  english_name: string | null;
  nickname: string | null;
  phone: string | null;
  region: string | null;
  timezone: string | null;
  language: string;
  birthday: string | null;
  department_id: string | null;
  job_title_id: string | null;
  manager_id: string | null;
  hire_date: string | null;
  base_role: StaffRole;
  menu_permissions: StaffMenuPermissions | null;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

type Department = {
  id: string;
  name: string;
  is_active: boolean;
};

type JobTitle = {
  id: string;
  name: string;
  is_active: boolean;
};

type AuditLog = {
  id: string;
  actor_name: string;
  target_name: string;
  action_type: string;
  old_values: any;
  new_values: any;
  ip_address: string;
  reason: string;
  created_at: string;
};

type StaffWorkspaceProps = {
  currentUserId: string;
  initialStaff: StaffMember[];
  departments: Department[];
  jobTitles: JobTitle[];
  auditLogs: AuditLog[];
  inviteAction: (prevState: any, formData: FormData) => Promise<any>;
  updatePermissions: (targetId: string, baseRole: StaffRole, menuPermissions: StaffMenuPermissions, reason: string) => Promise<void>;
  updateBasicInfo: (targetId: string, data: any, reason: string) => Promise<void>;
  updateOrgInfo: (targetId: string, data: any, reason: string) => Promise<void>;
  updateStatus: (targetId: string, status: StaffStatus, reason: string) => Promise<void>;
  resetPassword: (targetId: string, reason: string) => Promise<string>;
  reinviteStaff: (targetId: string) => Promise<void>;
  addDept: (name: string) => Promise<Department>;
  toggleDept: (id: string, active: boolean) => Promise<void>;
  addTitle: (name: string) => Promise<JobTitle>;
  toggleTitle: (id: string, active: boolean) => Promise<void>;
};

export function StaffWorkspace({
  currentUserId,
  initialStaff,
  departments,
  jobTitles,
  auditLogs,
  inviteAction,
  updatePermissions,
  updateBasicInfo,
  updateOrgInfo,
  updateStatus,
  resetPassword,
  reinviteStaff,
  addDept,
  toggleDept,
  addTitle,
  toggleTitle,
}: StaffWorkspaceProps) {
  // Panel resizing states
  const [leftWidth, setLeftWidth] = useState(380);
  const [rightWidth, setRightWidth] = useState(420);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Tab State: 'list' | 'invite' | 'dept_title' | 'audit'
  const [activeTab, setActiveTab] = useState<"list" | "invite" | "dept_title" | "audit">("list");
  
  // Staff Selection States
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialStaff[0]?.id || "");
  const activeStaff = staffList.find((s) => s.id === selectedStaffId) || staffList[0];

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // UI Local Form States for Active Staff Editing
  const [name, setName] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [timezone, setTimezone] = useState("");
  const [language, setLanguage] = useState("");
  const [birthday, setBirthday] = useState("");

  const [departmentId, setDepartmentId] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [hireDate, setHireDate] = useState("");

  const [baseRole, setBaseRole] = useState<StaffRole>("reviewer");
  const [permissions, setPermissions] = useState<StaffMenuPermissions | null>(null);

  // Invitation Form Local States
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffRole>("reviewer");
  const [inviteMsg, setInviteMsg] = useState("");

  // Departments & Job Titles Local States
  const [newDeptName, setNewDeptName] = useState("");
  const [newTitleName, setNewTitleName] = useState("");

  // Loading/Transition States
  const [isActionPending, startAction] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionReason, setActionReason] = useState("");

  // Mouse Resizing Handler Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(300, Math.min(650, e.clientX - 16));
        setLeftWidth(newWidth);
      }
      if (isResizingRight) {
        const newWidth = Math.max(300, Math.min(650, window.innerWidth - e.clientX - 16));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingLeft, isResizingRight]);

  // Sync edit states when selected staff changes
  useEffect(() => {
    if (activeStaff) {
      setName(activeStaff.name || "");
      setEnglishName(activeStaff.english_name || "");
      setNickname(activeStaff.nickname || "");
      setPhone(activeStaff.phone || "");
      setRegion(activeStaff.region || "");
      setTimezone(activeStaff.timezone || "Asia/Seoul");
      setLanguage(activeStaff.language || "ko");
      setBirthday(activeStaff.birthday || "");

      setDepartmentId(activeStaff.department_id || "");
      setJobTitleId(activeStaff.job_title_id || "");
      setManagerId(activeStaff.manager_id || "");
      setHireDate(activeStaff.hire_date || "");

      setBaseRole(activeStaff.base_role);
      // Fallback if null
      setPermissions(activeStaff.menu_permissions || DEFAULT_ROLE_PERMISSIONS[activeStaff.base_role]);
      
      setErrorMsg("");
      setSuccessMsg("");
      setActionReason("");
    }
  }, [selectedStaffId, staffList]);

  // Handle Base Role changes (auto-populate defaults)
  const handleBaseRoleChange = (role: StaffRole) => {
    setBaseRole(role);
    setPermissions(DEFAULT_ROLE_PERMISSIONS[role]);
  };

  // Toggle specific permission cell
  const handlePermissionToggle = (menu: keyof StaffMenuPermissions, action: keyof StaffMenuPermissions[keyof StaffMenuPermissions]) => {
    if (!permissions) return;
    const updated = {
      ...permissions,
      [menu]: {
        ...permissions[menu],
        [action]: !permissions[menu][action],
      },
    };
    setPermissions(updated);
  };

  // Submit profile basic info
  const handleBasicInfoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setErrorMsg("이름을 입력해 주세요.");
    setErrorMsg("");
    setSuccessMsg("");

    startAction(async () => {
      try {
        await updateBasicInfo(activeStaff.id, {
          name,
          englishName,
          nickname,
          phone,
          region,
          timezone,
          language,
          birthday: birthday || null,
        }, actionReason || "직원 기본 정보 직접 변경");

        // Sync local state
        setStaffList(prev =>
          prev.map(s => s.id === activeStaff.id ? { 
            ...s, 
            name, english_name: englishName, nickname, phone, region, timezone, language, birthday: birthday || null 
          } : s)
        );
        setSuccessMsg("기본 정보가 저장되었습니다.");
        setActionReason("");
      } catch (err: any) {
        setErrorMsg(err.message || "기본 정보 변경에 실패했습니다.");
      }
    });
  };

  // Submit Organization info
  const handleOrgInfoSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    startAction(async () => {
      try {
        await updateOrgInfo(activeStaff.id, {
          departmentId: departmentId || null,
          jobTitleId: jobTitleId || null,
          managerId: managerId || null,
          hireDate: hireDate || null,
        }, actionReason || "직원 조직 배정 변경");

        setStaffList(prev =>
          prev.map(s => s.id === activeStaff.id ? { 
            ...s, 
            department_id: departmentId || null, 
            job_title_id: jobTitleId || null,
            manager_id: managerId || null,
            hire_date: hireDate || null
          } : s)
        );
        setSuccessMsg("조직 정보가 업데이트되었습니다.");
        setActionReason("");
      } catch (err: any) {
        setErrorMsg(err.message || "조직 정보 업데이트에 실패했습니다.");
      }
    });
  };

  // Save Role and custom overrides
  const handlePermissionsSave = async () => {
    if (!permissions) return;
    setErrorMsg("");
    setSuccessMsg("");

    startAction(async () => {
      try {
        await updatePermissions(activeStaff.id, baseRole, permissions, actionReason || "직원 역할 및 세부 권한 재설정");
        setStaffList(prev =>
          prev.map(s => s.id === activeStaff.id ? { 
            ...s, 
            base_role: baseRole, 
            menu_permissions: permissions 
          } : s)
        );
        setSuccessMsg("역할 및 메뉴 접근 권한 정보가 저장되었습니다.");
        setActionReason("");
      } catch (err: any) {
        setErrorMsg(err.message || "권한 변경에 실패했습니다.");
      }
    });
  };

  // Toggle Account status
  const handleStatusToggle = async (status: StaffStatus) => {
    setErrorMsg("");
    setSuccessMsg("");

    const term = status === "suspended" ? "비활성화" : status === "locked" ? "계정 잠금" : "재활성화";
    const reasonPrompt = actionReason || `${term} 처리`;

    startAction(async () => {
      try {
        await updateStatus(activeStaff.id, status, reasonPrompt);
        setStaffList(prev =>
          prev.map(s => s.id === activeStaff.id ? { ...s, status } : s)
        );
        setSuccessMsg(`계정 상태를 [${STAFF_STATUS_LABEL[status]}]로 성공적으로 변경했습니다.`);
        setActionReason("");
      } catch (err: any) {
        setErrorMsg(err.message || "계정 상태 변경 실패.");
      }
    });
  };

  // Reset password action
  const handlePasswordReset = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    if (!confirm("정말 이 직원의 비밀번호를 강제 초기화하고 임시 비밀번호를 발송하겠습니까?")) return;

    startAction(async () => {
      try {
        const tempPw = await resetPassword(activeStaff.id, actionReason || "관리자 요청 비밀번호 강제 초기화");
        setSuccessMsg(`성공! 새 임시 비밀번호가 메일로 발송되었습니다.\n임시 비밀번호: ${tempPw}`);
        setActionReason("");
      } catch (err: any) {
        setErrorMsg(err.message || "비밀번호 초기화 실패.");
      }
    });
  };

  // Reinvite Staff Action
  const handleReinvite = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    startAction(async () => {
      try {
        await reinviteStaff(activeStaff.id);
        setSuccessMsg("초대 이메일이 재발송되었습니다.");
      } catch (err: any) {
        setErrorMsg(err.message || "재발송 실패.");
      }
    });
  };

  // Submit Invite Form
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!inviteName.trim()) return setErrorMsg("이름을 입력해 주세요.");
    if (!inviteEmail.trim()) return setErrorMsg("이메일을 입력해 주세요.");
    if (!inviteDept) return setErrorMsg("부서를 선택해 주세요.");
    if (!inviteTitle) return setErrorMsg("직책을 선택해 주세요.");

    startAction(async () => {
      const fd = new FormData();
      fd.append("name", inviteName);
      fd.append("email", inviteEmail);
      fd.append("departmentId", inviteDept);
      fd.append("jobTitleId", inviteTitle);
      fd.append("baseRole", inviteRole);
      fd.append("customMessage", inviteMsg);

      const res = await inviteAction(null, fd);
      if (res && res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(res?.success || "성공적으로 초대 이메일을 발송했습니다!");
        // Reset form
        setInviteName("");
        setInviteEmail("");
        setInviteMsg("");
      }
    });
  };

  // Add Department
  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    try {
      await addDept(newDeptName);
      setNewDeptName("");
      alert("부서가 추가되었습니다. 화면을 새로고침하여 적용해 주세요.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Add Job Title
  const handleAddTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleName.trim()) return;

    try {
      await addTitle(newTitleName);
      setNewTitleName("");
      alert("직책이 추가되었습니다. 화면을 새로고침하여 적용해 주세요.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filter staff members list
  const filteredStaff = staffList.filter((staff) => {
    const nameMatch = (staff.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = (staff.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    const queryMatch = nameMatch || emailMatch;

    const deptMatch = !deptFilter || staff.department_id === deptFilter;
    const roleMatch = !roleFilter || staff.base_role === roleFilter;
    const statusMatch = !statusFilter || staff.status === statusFilter;

    return queryMatch && deptMatch && roleMatch && statusMatch;
  });

  return (
    <div className="flex h-[calc(100vh-11rem)] gap-0.5 overflow-hidden text-xs select-none">
      
      {/* 1. Left Panel (Tabbed Workspaces) */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="shrink-0 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden rounded-l-lg"
      >
        {/* Tab Headers */}
        <div className="flex border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0">
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 py-3 font-bold border-b-2 text-center transition-colors cursor-pointer ${
              activeTab === "list"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📋 직원 목록
          </button>
          <button
            onClick={() => setActiveTab("invite")}
            className={`flex-1 py-3 font-bold border-b-2 text-center transition-colors cursor-pointer ${
              activeTab === "invite"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            ✉️ 초대하기
          </button>
          <button
            onClick={() => setActiveTab("dept_title")}
            className={`flex-1 py-3 font-bold border-b-2 text-center transition-colors cursor-pointer ${
              activeTab === "dept_title"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            🏢 조직 관리
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex-1 py-3 font-bold border-b-2 text-center transition-colors cursor-pointer ${
              activeTab === "audit"
                ? "border-zinc-950 text-zinc-950 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            📜 변경 이력
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-white dark:bg-zinc-900 select-text">
          
          {/* TAB 1: Staff List */}
          {activeTab === "list" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search & Filters */}
              <div className="p-3 border-b border-zinc-150 dark:border-zinc-800 space-y-2 shrink-0 select-none">
                <input
                  type="text"
                  placeholder="이름 또는 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50/50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 outline-none focus:border-zinc-500 font-medium text-zinc-900 dark:text-white"
                />
                <div className="grid grid-cols-3 gap-1">
                  <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    className="bg-zinc-50/50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 p-1 outline-none cursor-pointer text-zinc-900 dark:text-white"
                  >
                    <option value="">전체 부서</option>
                    {departments.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-zinc-50/50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 p-1 outline-none cursor-pointer text-zinc-900 dark:text-white"
                  >
                    <option value="">전체 역할</option>
                    {Object.entries(STAFF_ROLE_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-zinc-50/50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 p-1 outline-none cursor-pointer text-zinc-900 dark:text-white"
                  >
                    <option value="">전체 상태</option>
                    {Object.entries(STAFF_STATUS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Staff Scroll List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredStaff.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400">조건에 맞는 직원이 없습니다.</div>
                ) : (
                  filteredStaff.map((staff) => {
                    const dept = departments.find(d => d.id === staff.department_id)?.name || "소속 없음";
                    const isSelected = selectedStaffId === staff.id;
                    return (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => setSelectedStaffId(staff.id)} // setSelectedStaffId is bound via state
                        className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-zinc-950 border-zinc-950 text-white dark:bg-white dark:border-white dark:text-zinc-950 font-bold shadow-sm"
                            : "border-zinc-150 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/30 text-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px] truncate max-w-[130px]">
                            {staff.name || staff.email}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide uppercase leading-none ${
                              staff.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400"
                                : staff.status === "suspended"
                                ? "bg-red-50 text-red-700 border border-red-100 dark:bg-red-950/20 dark:text-red-400"
                                : "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}
                          >
                            {STAFF_STATUS_LABEL[staff.status]}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[9px] opacity-75">
                          <span className="truncate max-w-[150px]">{staff.email}</span>
                          <span>{dept}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Invite Staff */}
          {activeTab === "invite" && (
            <form onSubmit={handleInviteSubmit} className="flex-1 p-4 space-y-3 overflow-y-auto">
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm select-none border-b pb-2">✉️ 신규 직원 초대 발송</h3>
              
              <div className="space-y-0.5">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">직원 이메일</label>
                <input
                  type="email"
                  required
                  placeholder="staff@kselectnetwork.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 outline-none focus:border-zinc-500 font-semibold"
                />
              </div>

              <div className="space-y-0.5">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">직원 한글이름</label>
                <input
                  type="text"
                  required
                  placeholder="김심사"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 outline-none focus:border-zinc-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">소속 부서</label>
                  <select
                    required
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 p-1.5 outline-none cursor-pointer"
                  >
                    <option value="">부서 선택</option>
                    {departments.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">보임 직책</label>
                  <select
                    required
                    value={inviteTitle}
                    onChange={(e) => setInviteTitle(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 p-1.5 outline-none cursor-pointer"
                  >
                    <option value="">직책 선택</option>
                    {jobTitles.filter(j => j.is_active).map(j => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-0.5">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">기본 역할 배정</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                  className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 p-1.5 outline-none cursor-pointer"
                >
                  {Object.entries(STAFF_ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-0.5">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 select-none">초대장 전달 사항 (선택)</label>
                <textarea
                  placeholder="예: 영업 마케팅 부서 매니저로의 입사를 축하합니다."
                  value={inviteMsg}
                  onChange={(e) => setInviteMsg(e.target.value)}
                  className="w-full h-20 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 p-2 outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isActionPending}
                className="w-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold py-2.5 rounded transition-all cursor-pointer disabled:opacity-50"
              >
                {isActionPending ? "생성 및 이메일 발송 중..." : "🚀 계정 생성 및 초대 메일 보내기"}
              </button>
            </form>
          )}

          {/* TAB 3: Departments & Titles CRUD */}
          {activeTab === "dept_title" && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Department Management Section */}
              <div className="space-y-2 border-b pb-4">
                <h4 className="font-extrabold text-zinc-900 dark:text-white text-sm select-none border-l-2 border-zinc-950 pl-2">부서 관리</h4>
                <form onSubmit={handleAddDept} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="신규 부서 이름"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="flex-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 outline-none"
                  />
                  <button type="submit" className="bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-2.5 py-1 rounded font-bold cursor-pointer">추가</button>
                </form>
                <div className="space-y-1 mt-2">
                  {departments.map((dept) => (
                    <div key={dept.id} className="flex items-center justify-between p-1.5 bg-zinc-50/50 dark:bg-zinc-800/30 rounded border border-zinc-100 dark:border-zinc-850">
                      <span className={`font-semibold ${!dept.is_active ? 'line-through text-zinc-400' : ''}`}>{dept.name}</span>
                      <button
                        onClick={() => toggleDept(dept.id, !dept.is_active)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase cursor-pointer ${
                          dept.is_active 
                            ? "bg-red-50 text-red-700 border border-red-100" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {dept.is_active ? "비활성" : "활성화"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Job Title Management Section */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-zinc-900 dark:text-white text-sm select-none border-l-2 border-zinc-950 pl-2">직책 관리</h4>
                <form onSubmit={handleAddTitle} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="신규 직책 이름"
                    value={newTitleName}
                    onChange={(e) => setNewTitleName(e.target.value)}
                    className="flex-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 outline-none"
                  />
                  <button type="submit" className="bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 px-2.5 py-1 rounded font-bold cursor-pointer">추가</button>
                </form>
                <div className="space-y-1 mt-2">
                  {jobTitles.map((title) => (
                    <div key={title.id} className="flex items-center justify-between p-1.5 bg-zinc-50/50 dark:bg-zinc-800/30 rounded border border-zinc-100 dark:border-zinc-850">
                      <span className={`font-semibold ${!title.is_active ? 'line-through text-zinc-400' : ''}`}>{title.name}</span>
                      <button
                        onClick={() => toggleTitle(title.id, !title.is_active)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wide uppercase cursor-pointer ${
                          title.is_active 
                            ? "bg-red-50 text-red-700 border border-red-100" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {title.is_active ? "비활성" : "활성화"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Audit Logs */}
          {activeTab === "audit" && (
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm border-b pb-2 select-none">📜 권한 및 직원 변경 감사 로그</h3>
              {auditLogs.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">등록된 변경 이력이 없습니다.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-100 dark:border-zinc-800/60 rounded-xl space-y-1.5 text-[10px]">
                    <div className="flex justify-between font-bold text-zinc-500">
                      <span className="text-zinc-800 dark:text-zinc-300">👤 {log.actor_name || "시스템"}</span>
                      <span>{new Date(log.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                    <div className="font-semibold text-zinc-900 dark:text-white">
                      대상: {log.target_name || "조직/전체"} | 액션: <span className="underline underline-offset-2 uppercase text-indigo-600 dark:text-indigo-400">{log.action_type}</span>
                    </div>
                    {log.reason && (
                      <div className="bg-white dark:bg-zinc-900 p-1.5 rounded border border-zinc-100 dark:border-zinc-800/80 leading-normal">
                        <span className="font-extrabold mr-1">사유:</span> {log.reason}
                      </div>
                    )}
                    <div className="text-[9px] text-zinc-400 font-mono flex items-center gap-1.5">
                      <span>IP: {log.ip_address}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* Resize Splitter 1 */}
      <div
        onMouseDown={() => setIsResizingLeft(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingLeft ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 2. Center Panel: Detailed Information Editing Form */}
      <div className="flex-1 min-w-[340px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden">
        {activeStaff ? (
          <>
            <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0 flex justify-between items-center">
              <div>
                <span className="font-mono text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">ID: {activeStaff.id.substring(0,8)}...</span>
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-[13px]">{activeStaff.name || activeStaff.email}</h3>
              </div>
              
              {/* Account suspension / activation toolbar */}
              <div className="flex gap-1 select-none">
                {activeStaff.status === "active" ? (
                  <button
                    onClick={() => handleStatusToggle("suspended")}
                    className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    🚫 즉시 비활성화
                  </button>
                ) : (
                  <button
                    onClick={() => handleStatusToggle("active")}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    ✓ 활성화
                  </button>
                )}
                <button
                  onClick={handlePasswordReset}
                  className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-bold rounded-lg cursor-pointer"
                >
                  🔑 비밀번호 초기화
                </button>
                {activeStaff.status === "invited" && (
                  <button
                    onClick={handleReinvite}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg cursor-pointer"
                  >
                    ✉️ 초대 재발송
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto select-text">
              
              {/* Status messages */}
              {errorMsg && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/15 dark:text-red-400 shrink-0 select-none">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/15 dark:text-emerald-400 shrink-0 select-none">
                  {successMsg}
                </div>
              )}

              {/* Common Audit Reason input */}
              <div className="p-3 bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-100 dark:border-zinc-800/80 rounded-xl space-y-1.5 select-none shrink-0">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">✍️ 변경 사유 입력 (변경 전 필수 입력 권장)</label>
                <input
                  type="text"
                  placeholder="예: 부서 이동으로 인한 조직정보 갱신, 보안 사고 의심으로 인한 비밀번호 강제 초기화 등"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 outline-none font-medium text-[10px]"
                />
              </div>

              {/* GRID: Basic Info Form & Org Info Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* FORM A: Basic Info */}
                <form onSubmit={handleBasicInfoSave} className="space-y-3 bg-zinc-50/20 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/50">
                  <h4 className="font-extrabold text-zinc-900 dark:text-white border-b pb-1 select-none">👤 인적 정보 (기본 정보)</h4>
                  
                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">이름 (한글)</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">영문 이름</label>
                    <input
                      type="text"
                      value={englishName}
                      onChange={(e) => setEnglishName(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">닉네임</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">연락처</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">근무 도시 / 시간대</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        placeholder="Seoul"
                        className="flex-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1"
                      />
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-1/2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 cursor-pointer"
                      >
                        <option value="Asia/Seoul">KST (GMT+9)</option>
                        <option value="America/New_York">EST (GMT-5)</option>
                        <option value="America/Los_Angeles">PST (GMT-8)</option>
                        <option value="UTC">UTC (GMT+0)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="block text-zinc-500 font-bold select-none">생년월일</label>
                      <input
                        type="date"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer text-xs"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="block text-zinc-500 font-bold select-none">선호 언어</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer"
                      >
                        <option value="ko">한국어 (Korean)</option>
                        <option value="en">English (영어)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isActionPending}
                    className="w-full mt-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 font-bold py-1.5 rounded transition-all cursor-pointer disabled:opacity-50 select-none"
                  >
                    💾 기본 인적사항 저장
                  </button>
                </form>

                {/* FORM B: Organizational Info */}
                <form onSubmit={handleOrgInfoSave} className="space-y-3 bg-zinc-50/20 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/50">
                  <h4 className="font-extrabold text-zinc-900 dark:text-white border-b pb-1 select-none">🏢 인사 정보 (조직 배정)</h4>
                  
                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">소속 부서</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer"
                    >
                      <option value="">소속 없음</option>
                      {departments.filter(d => d.is_active).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">보임 직책</label>
                    <select
                      value={jobTitleId}
                      onChange={(e) => setJobTitleId(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer"
                    >
                      <option value="">직책 없음</option>
                      {jobTitles.filter(j => j.is_active).map(j => (
                        <option key={j.id} value={j.id}>{j.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">직속 관리자</label>
                    <select
                      value={managerId}
                      onChange={(e) => setManagerId(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer"
                    >
                      <option value="">지정 없음</option>
                      {staffList.filter(s => s.id !== activeStaff.id && s.status === 'active').map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.email}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="block text-zinc-500 font-bold select-none">입사일</label>
                    <input
                      type="date"
                      value={hireDate}
                      onChange={(e) => setHireDate(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2.5 space-y-1 text-[10px] text-zinc-400 select-none">
                    <div className="flex justify-between">
                      <span>최근 로그인 일시:</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-350">{activeStaff.last_login_at ? new Date(activeStaff.last_login_at).toLocaleString("ko-KR") : "기록 없음"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>최초 계정 등록일:</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-350">{new Date(activeStaff.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isActionPending}
                    className="w-full mt-2 bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 font-bold py-1.5 rounded transition-all cursor-pointer disabled:opacity-50 select-none"
                  >
                    💾 조직 정보 업데이트
                  </button>
                </form>

              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-zinc-400 select-none">
            직원을 선택해 주세요.
          </div>
        )}
      </div>

      {/* Resize Splitter 2 */}
      <div
        onMouseDown={() => setIsResizingRight(true)}
        className={`w-2 shrink-0 self-stretch hover:bg-zinc-300 dark:hover:bg-zinc-700 active:bg-zinc-400 dark:active:bg-zinc-500 transition-colors cursor-col-resize flex items-center justify-center select-none ${
          isResizingRight ? "bg-zinc-400 dark:bg-zinc-500" : "bg-transparent"
        }`}
      >
        <div className="h-6 w-0.5 bg-zinc-300 dark:bg-zinc-700 rounded" />
      </div>

      {/* 3. Right Panel: Menu Permissions Checkbox Grid (Width: rightWidth) */}
      <div
        style={{ width: `${rightWidth}px` }}
        className="shrink-0 border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden rounded-r-lg"
      >
        {activeStaff ? (
          <>
            <div className="p-3.5 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 shrink-0 flex justify-between items-center select-none">
              <h3 className="font-extrabold text-zinc-900 dark:text-white">메뉴별 접근 권한 설정</h3>
              <button
                onClick={handlePermissionsSave}
                disabled={isActionPending}
                className="px-3 py-1 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isActionPending ? "변경 중..." : "💾 권한 저장"}
              </button>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              
              {/* Role selection dropdown */}
              <div className="space-y-1 bg-zinc-50/50 dark:bg-zinc-950/20 p-3 rounded-lg border select-none">
                <label className="block font-bold text-zinc-700 dark:text-zinc-300">대표 권한 역할 (Base Role)</label>
                <select
                  value={baseRole}
                  onChange={(e) => handleBaseRoleChange(e.target.value as StaffRole)}
                  className="w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 outline-none font-semibold cursor-pointer"
                >
                  {Object.entries(STAFF_ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <p className="text-[9px] text-zinc-400 mt-1 leading-normal">
                  * 대표 역할을 변경하면 해당 역할의 기본 메뉴 권한 세트가 아래 그리드에 자동으로 복원되며, 필요한 경우 각 체크박스를 수정하여 개별 오버라이드할 수 있습니다.
                </p>
              </div>

              {/* Grid Header and Cells */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden select-none">
                <table className="w-full text-center border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-2.5 pl-3 text-left font-bold text-zinc-600 dark:text-zinc-400">메뉴 (Menu)</th>
                      <th className="py-2.5 font-bold text-zinc-600 dark:text-zinc-400">보기</th>
                      <th className="py-2.5 font-bold text-zinc-600 dark:text-zinc-400">생성</th>
                      <th className="py-2.5 font-bold text-zinc-600 dark:text-zinc-400">수정</th>
                      <th className="py-2.5 font-bold text-zinc-600 dark:text-zinc-400">삭제</th>
                      <th className="py-2.5 font-bold text-zinc-600 dark:text-zinc-400">승인</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                    {permissions && Object.keys(permissions).map((menuKey) => {
                      const mKey = menuKey as keyof StaffMenuPermissions;
                      const row = permissions[mKey];
                      const menuLabelMap: Record<string, string> = {
                        applications: "🏢 Applications",
                        companies: "💼 Companies",
                        products: "🧴 Products",
                        retail: "🏪 Retail Network",
                        sales: "📈 Sales & Perf",
                        staff: "👥 Staff & Perms",
                      };

                      return (
                        <tr key={mKey} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-950/30 transition-colors">
                          <td className="py-3 pl-3 text-left font-extrabold text-zinc-800 dark:text-zinc-200 bg-zinc-50/20">
                            {menuLabelMap[mKey] || mKey}
                          </td>
                          {Object.keys(row).map((actionKey) => {
                            const aKey = actionKey as keyof MenuActionPermissions;
                            const isChecked = row[aKey];
                            return (
                              <td key={aKey} className="py-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handlePermissionToggle(mKey, aKey)}
                                  disabled={baseRole === "super_admin"} // Super Admin is hard-locked to true
                                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer disabled:opacity-50"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-zinc-400 select-none">
            직원을 선택해 주세요.
          </div>
        )}
      </div>

    </div>
  );
}

// Separate state binding wrapper to hold selection target
export function StaffWorkspaceWrapper({
  currentUserId,
  initialStaff,
  departments,
  jobTitles,
  auditLogs,
  inviteAction,
  updatePermissions,
  updateBasicInfo,
  updateOrgInfo,
  updateStatus,
  resetPassword,
  reinviteStaff,
  addDept,
  toggleDept,
  addTitle,
  toggleTitle,
}: StaffWorkspaceProps) {
  // Use state to manage selected staff ID across workspace callbacks
  const [selectedStaffId, setSelectedStaffId] = useState<string>(initialStaff[0]?.id || "");
  
  // Custom setter to bind to selectedKey parameter
  const setSelectedKey = (key: string) => {
    setSelectedStaffId(key);
  };

  // Render the real component override custom binder
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <StaffWorkspace
        currentUserId={currentUserId}
        initialStaff={initialStaff}
        departments={departments}
        jobTitles={jobTitles}
        auditLogs={auditLogs}
        inviteAction={inviteAction}
        updatePermissions={updatePermissions}
        updateBasicInfo={updateBasicInfo}
        updateOrgInfo={updateOrgInfo}
        updateStatus={updateStatus}
        resetPassword={resetPassword}
        reinviteStaff={reinviteStaff}
        addDept={addDept}
        toggleDept={toggleDept}
        addTitle={addTitle}
        toggleTitle={toggleTitle}
      />
    </div>
  );
}
