"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateCompanyAdminMetadata,
  adminInviteCompanyUser,
  adminUpdateCompanyUser,
  adminDeleteCompanyUser,
  adminUploadCompanyLogo,
  adminSaveSupplierData,
  type CompanyContact,
  type CompanyParsedMetadata
} from "@/lib/company/admin-actions";
import { adminUpdateBrand, adminCreateBrand } from "@/lib/brand/actions";
import { type PartnerStatusConfig } from "@/lib/settings/actions";
import { 
  updateUserTaskAssignments, 
  assignTaskPrimaryUser, 
  handleUserSuspensionTaskCheck, 
  type TaskAssignmentItem 
} from "@/lib/company/task-actions";
import { TASK_DEFINITIONS } from "@/lib/company/task-constants";
import { InternationalPhoneInput } from "@/components/shared/international-phone-input";

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
    manufacture_sku?: string | null;
    display_manufacture_sku?: string | null;
    letusto_sku?: string | null;
    is_draft: boolean;
    selection_status: string;
    sales_status: string;
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
  taskAssignments: TaskAssignmentItem[];
  isSuperAdmin: boolean;
  isFinanceUser: boolean;
  initialSupplierProfile: any | null;
  initialSupplierRemittance: any | null;
  warehouses: any[];
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
  isSuperAdmin,
  isFinanceUser,
  initialSupplierProfile,
  initialSupplierRemittance,
  warehouses,
}: CompanyDetailManagerProps) {
    const [companyCode, setCompanyCode] = useState(parsedMeta.companyCode || "");
  const [tempCompanyCode, setTempCompanyCode] = useState(companyCode);
  const [types, setTypes] = useState<string[]>(parsedMeta.types || ["Brand Owner"]);
  const [tempTypes, setTempTypes] = useState<string[]>(types);

  const [supplierProfile, setSupplierProfile] = useState<any>(initialSupplierProfile);
  const [supplierRemittance, setSupplierRemittance] = useState<any>(initialSupplierRemittance);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierPending, startSupplierTransition] = useTransition();

  const hasRemittanceAccess = isSuperAdmin || isFinanceUser;

  // Role list options
  const ROLE_OPTIONS = [
    "Brand Owner",
    "Manufacturer",
    "Supplier",
    "Distributor",
    "Retailer",
    "Logistics Partner",
    "Service Provider",
    "Other"
  ];

  // Supplier Profile States
  const [supStatus, setSupStatus] = useState(supplierProfile?.status || "active");
  const [supCurrency, setSupCurrency] = useState(supplierProfile?.default_currency || "");
  const [supPaymentTerms, setSupPaymentTerms] = useState(supplierProfile?.default_payment_terms || "");
  const [supPaymentTermsCustom, setSupPaymentTermsCustom] = useState(supplierProfile?.default_payment_terms_custom || "");
  const [supIncoterms, setSupIncoterms] = useState(supplierProfile?.default_incoterms || "");
  const [supShipFromWarehouseId, setSupShipFromWarehouseId] = useState(supplierProfile?.default_ship_from_warehouse_id || "");
  const [supPortOfLoading, setSupPortOfLoading] = useState(supplierProfile?.default_port_of_loading || "");
  const [supLeadTime, setSupLeadTime] = useState(supplierProfile?.default_production_lead_time || "");
  const [supMOQ, setSupMOQ] = useState<string>(supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined ? String(supplierProfile.default_moq) : "");
  const [supReceivingEmail, setSupReceivingEmail] = useState(supplierProfile?.po_receiving_email || "");
  const [supInternalNote, setSupInternalNote] = useState(supplierProfile?.internal_note || "");

  // Supplier Remittance States
  const [remMethod, setRemMethod] = useState(supplierRemittance?.payment_method || "");
  const [remBeneficiaryName, setRemBeneficiaryName] = useState(supplierRemittance?.beneficiary_name || "");
  const [remBeneficiaryAddress, setRemBeneficiaryAddress] = useState(supplierRemittance?.beneficiary_address || "");
  const [remBankName, setRemBankName] = useState(supplierRemittance?.bank_name || "");
  const [remBankAddress, setRemBankAddress] = useState(supplierRemittance?.bank_address || "");
  const [remBankCountry, setRemBankCountry] = useState(supplierRemittance?.bank_country || "");
  const [remAccountNumber, setRemAccountNumber] = useState(supplierRemittance?.account_number || "");
  const [remSwiftBic, setRemSwiftBic] = useState(supplierRemittance?.swift_bic || "");
  const [remRoutingNumber, setRemRoutingNumber] = useState(supplierRemittance?.routing_number || "");
  const [remAccountCurrency, setRemAccountCurrency] = useState(supplierRemittance?.account_currency || "USD");
  const [remIntermediaryBank, setRemIntermediaryBank] = useState(supplierRemittance?.intermediary_bank_info || "");
  const [remNote, setRemNote] = useState(supplierRemittance?.remittance_note || "");

  const handleTypeCheckboxChange = (opt: string, checked: boolean) => {
    if (checked) {
      setTempTypes([...tempTypes, opt]);
    } else {
      setTempTypes(tempTypes.filter((t) => t !== opt));
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    startSupplierTransition(async () => {
      try {
        const profilePayload = {
          status: supStatus,
          default_currency: supCurrency,
          default_payment_terms: supPaymentTerms,
          default_payment_terms_custom: supPaymentTerms === "Custom" ? supPaymentTermsCustom : "",
          default_incoterms: supIncoterms,
          default_ship_from_warehouse_id: supShipFromWarehouseId || null,
          default_port_of_loading: supPortOfLoading,
          default_production_lead_time: supLeadTime,
          default_moq: supMOQ.trim() ? parseInt(supMOQ) : null,
          po_receiving_email: supReceivingEmail,
          internal_note: supInternalNote,
        };

        let remittancePayload = undefined;
        if (hasRemittanceAccess) {
          remittancePayload = {
            payment_method: remMethod,
            beneficiary_name: remBeneficiaryName,
            beneficiary_address: remBeneficiaryAddress,
            bank_name: remBankName,
            bank_address: remBankAddress,
            bank_country: remBankCountry,
            account_number: remAccountNumber,
            swift_bic: remSwiftBic,
            routing_number: remRoutingNumber,
            account_currency: remAccountCurrency,
            intermediary_bank_info: remIntermediaryBank,
            remittance_note: remNote,
          };
        }

        const res = await adminSaveSupplierData(company.id, profilePayload, remittancePayload);
        if (res && res.success) {
          setSupplierProfile(profilePayload);
          if (remittancePayload) {
            setSupplierRemittance(remittancePayload);
          }
          setIsEditingSupplier(false);
          alert("공급사 정보가 정상 저장되었습니다.");
        }
      } catch (err: any) {
        alert(err.message || "공급사 정보 저장 중 오류가 발생했습니다.");
      }
    });
  };

  const showSupplierTab = true;

  const [activeTab, setActiveTab] = useState<
    "staff" | "tasks" | "brands" | "products" | "applications" | "supplier" | "remittance"
  >("staff");
  const [isPending, startTransition] = useTransition();

  // Company general metadata states
  const [name, setName] = useState(company.name);
  const [country, setCountry] = useState(company.country);
  const [address, setAddress] = useState(parsedMeta.address);
  const [address1, setAddress1] = useState(parsedMeta.address_1 || "");
  const [address2, setAddress2] = useState(parsedMeta.address_2 || "");
  const [city, setCity] = useState(parsedMeta.city || "");
  const [stateVal, setStateVal] = useState(parsedMeta.state || "");
  const [zipCode, setZipCode] = useState(parsedMeta.zip_code || "");
  
  const [website, setWebsite] = useState(parsedMeta.website);
  const [adminMemo, setAdminMemo] = useState(parsedMeta.adminMemo);
  const [type, setType] = useState(parsedMeta.type);
  const [status, setStatus] = useState(parsedMeta.status);
  const [logoUrl, setLogoUrl] = useState(parsedMeta.logoUrl || null);
  const [businessRegNum, setBusinessRegNum] = useState(company.business_registration_number);
  const [createdAt, setCreatedAt] = useState(company.created_at);
  
  // Editing modes
  const [isEditingMeta, setIsEditingMeta] = useState(false);

  // Temporary edit states
  const [tempName, setTempName] = useState(name);
  const [tempCountry, setTempCountry] = useState(country);
  const [tempAddress, setTempAddress] = useState(address);
  const [tempAddress1, setTempAddress1] = useState(address1);
  const [tempAddress2, setTempAddress2] = useState(address2);
  const [tempCity, setTempCity] = useState(city);
  const [tempStateVal, setTempStateVal] = useState(stateVal);
  const [tempZipCode, setTempZipCode] = useState(zipCode);
  
  const [tempWebsite, setTempWebsite] = useState(website);
  const [tempAdminMemo, setTempAdminMemo] = useState(adminMemo);
  const [tempType, setTempType] = useState(type);
  const [tempStatus, setTempStatus] = useState(status);
  const [tempLogoFile, setTempLogoFile] = useState<File | null>(null);
  const [tempBusinessRegNum, setTempBusinessRegNum] = useState(businessRegNum);
  const [tempCreatedAt, setTempCreatedAt] = useState(createdAt);

  // Brand Edit Modal States
  const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<any>(null);
  const [editBrandName, setEditBrandName] = useState("");
  const [editBrandIntro, setEditBrandIntro] = useState("");
  const [editBrandLogoFile, setEditBrandLogoFile] = useState<File | null>(null);
  const [editBrandLogoUrl, setEditBrandLogoUrl] = useState<string | null>(null);
  const [editBrandHasKr, setEditBrandHasKr] = useState(false);
  const [editBrandKrNum, setEditBrandKrNum] = useState("");
  const [editBrandKrFile, setEditBrandKrFile] = useState<File | null>(null);
  const [editBrandKrUrl, setEditBrandKrUrl] = useState<string | null>(null);
  const [editBrandHasUs, setEditBrandHasUs] = useState(false);
  const [editBrandUsNum, setEditBrandUsNum] = useState("");
  const [editBrandUsFile, setEditBrandUsFile] = useState<File | null>(null);
  const [editBrandUsUrl, setEditBrandUsUrl] = useState<string | null>(null);

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

  // Brand Create Modal States
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [addBrandName, setAddBrandName] = useState("");
  const [addBrandIntro, setAddBrandIntro] = useState("");
  const [addBrandHasKr, setAddBrandHasKr] = useState(false);
  const [addBrandKrNum, setAddBrandKrNum] = useState("");
  const [addBrandHasUs, setAddBrandHasUs] = useState(false);
  const [addBrandUsNum, setAddBrandUsNum] = useState("");

  const handleCreateBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addBrandName.trim()) {
      alert("브랜드명은 필수입니다.");
      return;
    }

    startTransition(async () => {
      try {
        await adminCreateBrand(
          company.id,
          addBrandName.trim(),
          addBrandIntro.trim(),
          addBrandHasKr,
          addBrandKrNum.trim() || null,
          addBrandHasUs,
          addBrandUsNum.trim() || null
        );
        setIsAddBrandOpen(false);
        alert("브랜드가 성공적으로 등록되었습니다. 변경 사항 반영을 위해 화면이 리로드됩니다.");
        window.location.reload();
      } catch (err: any) {
        alert(err.message || "브랜드 등록 실패");
      }
    });
  };

  const handleOpenEditBrand = (brand: any) => {
    setSelectedBrand(brand);
    setEditBrandName(brand.name || "");
    setEditBrandIntro(brand.introText || "");
    setEditBrandLogoFile(null);
    setEditBrandLogoUrl(brand.logoUrl || null);
    setEditBrandHasKr(brand.hasKr || false);
    setEditBrandKrNum(brand.krNum || "");
    setEditBrandKrFile(null);
    setEditBrandKrUrl(brand.krUrl || null);
    setEditBrandHasUs(brand.hasUs || false);
    setEditBrandUsNum(brand.usNum || "");
    setEditBrandUsFile(null);
    setEditBrandUsUrl(brand.usUrl || null);
    setIsEditBrandOpen(true);
  };

  const handleUpdateBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) return;
    if (!editBrandName.trim()) {
      alert("브랜드명은 필수입니다.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", editBrandName.trim());
        formData.append("intro", editBrandIntro.trim());
        formData.append("hasKrTrademark", editBrandHasKr ? "true" : "false");
        formData.append("krTrademarkNumber", editBrandKrNum.trim());
        formData.append("hasUsTrademark", editBrandHasUs ? "true" : "false");
        formData.append("usTrademarkNumber", editBrandUsNum.trim());

        if (editBrandLogoFile) {
          formData.append("logo", editBrandLogoFile);
        }
        if (editBrandKrFile) {
          formData.append("krTrademarkFile", editBrandKrFile);
        }
        if (editBrandUsFile) {
          formData.append("usTrademarkFile", editBrandUsFile);
        }

        const res = await adminUpdateBrand(selectedBrand.id, company.id, undefined, formData);
        if (res && res.error) {
          alert(res.error);
        } else {
          setIsEditBrandOpen(false);
          alert("브랜드 정보가 성공적으로 수정되었습니다. 변경 사항 반영을 위해 화면이 리로드됩니다.");
          window.location.reload();
        }
      } catch (err: any) {
        alert(err.message || "브랜드 수정 실패");
      }
    });
  };

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
    if (!tempName.trim()) {
      alert("회사명을 입력해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        if (tempLogoFile) {
          const formData = new FormData();
          formData.append("logo", tempLogoFile);
          await adminUploadCompanyLogo(company.id, formData);
        }

        const mergedAddress = tempAddress1
          ? `${tempAddress1}${tempAddress2 ? " " + tempAddress2 : ""}${tempCity ? ", " + tempCity : ""}${tempStateVal ? ", " + tempStateVal : ""}${tempZipCode ? " (" + tempZipCode + ")" : ""}`
          : tempAddress;

        await updateCompanyAdminMetadata(company.id, {
          name: tempName,
          country: tempCountry,
          address: mergedAddress,
          address_1: tempAddress1,
          address_2: tempAddress2,
          city: tempCity,
          state: tempStateVal,
          zipCode: tempZipCode,
          website: tempWebsite,
          adminMemo: tempAdminMemo,
          contacts: parsedMeta.contacts || [], 
          types: tempTypes,
          status: tempStatus,
          companyCode: tempCompanyCode,
          businessRegistrationNumber: tempBusinessRegNum,
          createdAt: tempCreatedAt,
        });
        setName(tempName);
        setCountry(tempCountry);
        setAddress(mergedAddress);
        setAddress1(tempAddress1);
        setAddress2(tempAddress2);
        setCity(tempCity);
        setStateVal(tempStateVal);
        setZipCode(tempZipCode);
        setWebsite(tempWebsite);
        setAdminMemo(tempAdminMemo);
        setTypes(tempTypes);
        setCompanyCode(tempCompanyCode);
        setStatus(tempStatus);
        setBusinessRegNum(tempBusinessRegNum);
        setCreatedAt(tempCreatedAt);
        setTempLogoFile(null);
        setTempTypes(types);
        setTempCompanyCode(companyCode);
        setIsEditingMeta(false);
        alert("회사 정보가 성공적으로 저장되었습니다. 로고 등 변경 사항 반영을 위해 화면이 리로드됩니다.");
        window.location.reload();
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
                    setTempName(name);
                    setTempCountry(country);
                    setTempAddress(address);
                    setTempAddress1(address1);
                    setTempAddress2(address2);
                    setTempCity(city);
                    setTempStateVal(stateVal);
                    setTempZipCode(zipCode);
                    setTempWebsite(website);
                    setTempAdminMemo(adminMemo);
                    setTempTypes(types);
                    setTempCompanyCode(companyCode);
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
              <div className="flex flex-col items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-950/40 rounded-lg border border-zinc-150 dark:border-zinc-850">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="h-16 w-16 rounded object-cover border border-zinc-200 dark:border-zinc-800"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-850 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-sans">
                    LOGO
                  </div>
                )}
                {isEditingMeta && (
                  <div className="w-full mt-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setTempLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-[10px] text-zinc-555 dark:text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-200 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-300 dark:hover:file:bg-zinc-750 cursor-pointer"
                    />
                    {tempLogoFile && (
                      <p className="text-[9px] text-emerald-600 font-semibold mt-1">✓ 파일 대기 중: {tempLogoFile.name}</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사명</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-bold"
                  />
                ) : (
                  <span className="font-bold text-zinc-900 dark:text-white mt-0.5 block">{name}</span>
                )}
              </div>

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
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">Company Code</span>
                {isEditingMeta && isSuperAdmin ? (
                  <input
                    type="text"
                    value={tempCompanyCode}
                    onChange={(e) => setTempCompanyCode(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                    placeholder="예: ABC-123"
                  />
                ) : (
                  <span className="font-semibold font-mono text-zinc-900 dark:text-white mt-0.5 block">
                    {companyCode || "미생성 (자동 할당 예정)"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 역할 (Roles)</span>
                {isEditingMeta ? (
                  <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto border border-zinc-150 rounded p-2 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/20">
                    {ROLE_OPTIONS.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-350">
                        <input
                          type="checkbox"
                          checked={tempTypes.includes(opt)}
                          onChange={(e) => handleTypeCheckboxChange(opt, e.target.checked)}
                          className="rounded border-zinc-300 accent-zinc-950 dark:accent-white cursor-pointer"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {types.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-350 border border-zinc-200 dark:border-zinc-700"
                      >
                        {t}
                      </span>
                    ))}
                    {types.length === 0 && <span className="text-[11px] text-zinc-400 italic">지정된 역할 없음</span>}
                  </div>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">국가</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempCountry}
                    onChange={(e) => setTempCountry(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">{country}</span>
                )}
              </div>
              
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">사업자등록번호</span>
                {isEditingMeta ? (
                  <input
                    type="text"
                    value={tempBusinessRegNum}
                    onChange={(e) => setTempBusinessRegNum(e.target.value)}
                    placeholder="사업자등록번호 입력"
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                  />
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block font-mono">{businessRegNum}</span>
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">등록일</span>
                {isEditingMeta ? (
                  <input
                    type="date"
                    value={tempCreatedAt ? new Date(tempCreatedAt).toISOString().split('T')[0] : ""}
                    onChange={(e) => setTempCreatedAt(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                  />
                ) : (
                  <span className="font-semibold text-zinc-900 dark:text-white mt-0.5 block">
                    {createdAt ? new Date(createdAt).toLocaleDateString() : "(미지정)"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">회사 주소</span>
                {isEditingMeta ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      type="text"
                      value={tempAddress1}
                      onChange={(e) => setTempAddress1(e.target.value)}
                      placeholder="기본 주소 (Address Line 1)"
                      className="w-full rounded border border-zinc-200 p-1.5 text-[11px] outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                    <input
                      type="text"
                      value={tempAddress2}
                      onChange={(e) => setTempAddress2(e.target.value)}
                      placeholder="상세 주소 (Address Line 2)"
                      className="w-full rounded border border-zinc-200 p-1.5 text-[11px] outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      <input
                        type="text"
                        value={tempCity}
                        onChange={(e) => setTempCity(e.target.value)}
                        placeholder="도시 (City)"
                        className="w-full rounded border border-zinc-200 p-1.5 text-[10px] outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                      <input
                        type="text"
                        value={tempStateVal}
                        onChange={(e) => setTempStateVal(e.target.value)}
                        placeholder="주/도 (State)"
                        className="w-full rounded border border-zinc-200 p-1.5 text-[10px] outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                      />
                      <input
                        type="text"
                        value={tempZipCode}
                        onChange={(e) => setTempZipCode(e.target.value)}
                        placeholder="우편번호"
                        className="w-full rounded border border-zinc-200 p-1.5 text-[10px] outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold text-zinc-750 dark:text-zinc-300 mt-0.5 block whitespace-pre-wrap">
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
                      className="font-semibold text-emerald-650 hover:underline dark:text-emerald-450 mt-0.5 inline-block"
                    >
                      {website}
                    </a>
                  ) : (
                    <span className="font-semibold text-zinc-400 mt-0.5 block">웹사이트 미등록</span>
                  )
                )}
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase block">관리자 메모</span>
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

        {/* Right Column: Integrated Tabs Container */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            {/* Tab Navigation Headers */}
            <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950/20">
              <nav className="flex flex-wrap gap-4 text-xs font-bold text-zinc-400">
                {([
                  "staff",
                  "tasks",
                  "brands",
                  "products",
                  "applications",
                  ...(showSupplierTab ? ["supplier" as const, "remittance" as const] : []),
                ] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-1 border-b-2 transition-all ${
                      activeTab === tab
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                        : "border-transparent hover:text-zinc-600"
                    }`}
                  >
                    {tab === "staff"
                      ? `담당자 & 포털 사용자 (${users.length})`
                      : tab === "tasks"
                      ? "담당 업무 지정"
                      : tab === "brands"
                      ? "보유 브랜드"
                      : tab === "products"
                      ? "등록 제품"
                      : tab === "applications"
                      ? "입점 신청서"
                      : tab === "supplier"
                      ? "거래 정보"
                      : "은행 정보"}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-5 text-xs">
              
              {/* 1. Staff Tab */}
              {activeTab === "staff" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
              )}

              {/* 2. Tasks Tab */}
              {activeTab === "tasks" && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-zinc-100 dark:border-zinc-800">
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
                                  <span className="text-zinc-455 italic">주 담당자 미지정</span>
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
              )}

              {/* 3. Brands Tab */}
              {activeTab === "brands" && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        setAddBrandName("");
                        setAddBrandIntro("");
                        setAddBrandHasKr(false);
                        setAddBrandKrNum("");
                        setAddBrandHasUs(false);
                        setAddBrandUsNum("");
                        setIsAddBrandOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 px-3 py-1.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      + 신규 브랜드 추가
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                  {brands.length > 0 ? (
                    brands.map((brand) => (
                      <div key={brand.id} className="rounded-lg border border-zinc-150 p-4 bg-zinc-50/30 dark:border-zinc-855 dark:bg-zinc-900/40 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">{brand.name}</h4>
                              <button
                                onClick={() => handleOpenEditBrand(brand)}
                                className="text-[10px] font-semibold text-zinc-555 hover:underline dark:text-zinc-400 flex items-center gap-0.5 border border-zinc-250 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              >
                                ✏️ 수정
                              </button>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1">{brand.introText || "브랜드 소개글이 등록되지 않았습니다."}</p>
                          </div>
                          {brand.logoUrl ? (
                            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-8 rounded border border-zinc-200 object-cover dark:border-zinc-800" />
                          ) : (
                            <div className="h-8 w-8 rounded border border-zinc-200 bg-zinc-100 flex items-center justify-center text-[8px] font-bold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-850 font-sans">LOGO</div>
                          )}
                        </div>

                        {/* 상표권 정보 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                          {/* 대한민국 상표권 */}
                          <div className="space-y-2 border-r border-zinc-100 pr-2 last:border-0 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block">대한민국 상표권</span>
                            {brand.hasKr ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-zinc-850 dark:text-zinc-250">
                                  상태: <span className="text-emerald-600 dark:text-emerald-450 font-bold">보유</span>
                                </p>
                                <p className="text-zinc-655 dark:text-zinc-400">
                                  등록번호: <span className="font-mono font-semibold">{brand.krNum || "(미등록)"}</span>
                                </p>
                                {brand.krUrl && (
                                  <a
                                    href={brand.krUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline gap-1 mt-1 cursor-pointer"
                                  >
                                    📁 상표권 인증서 다운로드 ↗
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className="text-zinc-400 italic">미보유</p>
                            )}
                          </div>

                          {/* 미국 USPTO 상표권 */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 block">미국 USPTO 상표권</span>
                            {brand.hasUs ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-zinc-850 dark:text-zinc-250">
                                  상태: <span className="text-emerald-600 dark:text-emerald-450 font-bold">보유</span>
                                </p>
                                <p className="text-zinc-655 dark:text-zinc-400">
                                  등록번호: <span className="font-mono font-semibold">{brand.usNum || "(미등록)"}</span>
                                </p>
                                {brand.usUrl && (
                                  <a
                                    href={brand.usUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline gap-1 mt-1 cursor-pointer"
                                  >
                                    📁 USPTO 인증서 다운로드 ↗
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className="text-zinc-400 italic">미보유</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-zinc-400 italic py-4 text-center">보유한 브랜드가 존재하지 않습니다.</p>
                  )}
                  </div>
                </div>
              )}

              {/* 4. Products Tab */}
              {activeTab === "products" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <th className="px-4 py-2.5">업체 SKU</th>
                        <th className="px-4 py-2.5">Letusto SKU</th>
                        <th className="px-4 py-2.5">제품명</th>
                        <th className="px-4 py-2.5">브랜드</th>
                        <th className="px-4 py-2.5">등록 상태</th>
                        <th className="px-4 py-2.5">선정 상태</th>
                        <th className="px-4 py-2.5">판매 상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                      {products.length > 0 ? (
                        products.map((prod) => {
                          const overrides = (prod.price_additional_info as any)?.admin_overrides || {};
                          const prodDisplayName = overrides.name_en || prod.name_en || overrides.name || prod.name;
                          return (
                            <tr key={prod.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/10">
                              <td className="px-4 py-3 font-mono text-[11px] text-zinc-650 dark:text-zinc-350">
                                {prod.display_manufacture_sku || prod.manufacture_sku || <span className="text-zinc-400 italic">미입력</span>}
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-zinc-655 dark:text-zinc-350">
                                {prod.letusto_sku || <span className="text-zinc-400 italic">미발급</span>}
                              </td>
                              <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                                <Link
                                  href={`/admin/products/${prod.id}`}
                                  className="hover:underline text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                  {prodDisplayName}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-zinc-550 dark:text-zinc-400">
                                {brandNameById.get(prod.brand_id) || "알 수 없음"}
                              </td>
                              <td className="px-4 py-3">
                                {prod.is_draft ? (
                                  <span className="rounded bg-amber-50 text-amber-700 px-2 py-0.5 text-[9px] font-bold border border-amber-100 dark:bg-amber-955/30 dark:text-amber-400 dark:border-amber-900/30">
                                    Draft (보완 대기)
                                  </span>
                                ) : (
                                  <span className="rounded bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[9px] font-bold border border-emerald-100 dark:bg-emerald-955/30 dark:text-emerald-400 dark:border-emerald-900/30">
                                    Complete (등록 완료)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold border ${
                                  prod.selection_status === "SELECTED"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-955/30 dark:text-emerald-400"
                                    : prod.selection_status === "PENDING"
                                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-emerald-955/30 dark:text-emerald-400"
                                    : prod.selection_status === "REJECTED"
                                    ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-emerald-955/30 dark:text-rose-400"
                                    : "bg-zinc-50 text-zinc-600 border-zinc-150 dark:bg-zinc-950/40 dark:text-zinc-400"
                                }`}>
                                  {prod.selection_status === "SELECTED"
                                    ? "선정"
                                    : prod.selection_status === "PENDING"
                                    ? "검토 중"
                                    : prod.selection_status === "REJECTED"
                                    ? "미선정"
                                    : "미검토"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold border ${
                                  prod.sales_status === "SELLING"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-955/30 dark:text-emerald-400"
                                    : prod.sales_status === "PAUSED"
                                    ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-emerald-955/30 dark:text-amber-400"
                                    : prod.sales_status === "STOPPED"
                                    ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-emerald-955/30 dark:text-rose-400"
                                    : "bg-zinc-50 text-zinc-650 border-zinc-150 dark:bg-zinc-950/40 dark:text-zinc-400"
                                }`}>
                                  {prod.sales_status === "SELLING"
                                    ? "판매 중"
                                    : prod.sales_status === "PAUSED"
                                    ? "일시 중지"
                                    : prod.sales_status === "STOPPED"
                                    ? "판매 종료"
                                    : "판매 준비"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-zinc-400 italic py-4 text-center">등록된 제품이 존재하지 않습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. Applications Tab */}
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

              {activeTab === "supplier" && showSupplierTab && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">거래 정보 (Supplier Trading Info)</h3>
                    {!isEditingSupplier ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSupStatus(supplierProfile?.status || "active");
                          setSupCurrency(supplierProfile?.default_currency || "");
                          setSupPaymentTerms(supplierProfile?.default_payment_terms || "");
                          setSupPaymentTermsCustom(supplierProfile?.default_payment_terms_custom || "");
                          setSupIncoterms(supplierProfile?.default_incoterms || "");
                          setSupShipFromWarehouseId(supplierProfile?.default_ship_from_warehouse_id || "");
                          setSupPortOfLoading(supplierProfile?.default_port_of_loading || "");
                          setSupLeadTime(supplierProfile?.default_production_lead_time || "");
                          setSupMOQ(supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined ? String(supplierProfile.default_moq) : "");
                          setSupReceivingEmail(supplierProfile?.po_receiving_email || "");
                          setSupInternalNote(supplierProfile?.internal_note || "");
                          setIsEditingSupplier(true);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold rounded border bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-750"
                      >
                        정보 수정
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingSupplier(false)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded border bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSupplier}
                          disabled={supplierPending}
                          className="px-3 py-1 text-[10px] font-bold rounded bg-zinc-950 text-white hover:opacity-90 disabled:opacity-50 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
                        >
                          {supplierPending ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Supplier Profile Details */}
                  <div className="space-y-4 max-w-3xl">
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">거래 상태 (Status)</label>
                        {isEditingSupplier ? (
                          <select
                            value={supStatus}
                            onChange={(e) => setSupStatus(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          >
                            <option value="active">Active</option>
                            <option value="on_hold">On Hold</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${
                            (supplierProfile?.status || 'active') === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' :
                            (supplierProfile?.status || 'active') === 'on_hold' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' :
                            'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                          }`}>
                            {(supplierProfile?.status || 'active').toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">기본 결제 통화 (Default Currency)</label>
                        {isEditingSupplier ? (
                          <select
                            value={supCurrency}
                            onChange={(e) => setSupCurrency(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          >
                            <option value="">미지정 (Not Set)</option>
                            <option value="USD">USD ($)</option>
                            <option value="KRW">KRW (₩)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="JPY">JPY (¥)</option>
                          </select>
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">{supplierProfile?.default_currency || "미지정"}</span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">기본 결제 조건 (Default Payment Terms)</label>
                        {isEditingSupplier ? (
                          <div className="space-y-1.5">
                            <select
                              value={supPaymentTerms}
                              onChange={(e) => setSupPaymentTerms(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            >
                              <option value="">미지정 (Not Set)</option>
                              <option value="Prepaid 100%">Prepaid 100%</option>
                              <option value="30% Deposit / 70% Balance">30% Deposit / 70% Balance</option>
                              <option value="50% Deposit / 50% Balance">50% Deposit / 50% Balance</option>
                              <option value="Net 15">Net 15</option>
                              <option value="Net 30">Net 30</option>
                              <option value="Net 60">Net 60</option>
                              <option value="Custom">Custom (직접 입력)</option>
                            </select>
                            {supPaymentTerms === "Custom" && (
                              <input
                                type="text"
                                placeholder="결제 조건을 직접 입력하세요..."
                                value={supPaymentTermsCustom}
                                onChange={(e) => setSupPaymentTermsCustom(e.target.value)}
                                className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              />
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {supplierProfile?.default_payment_terms === "Custom"
                              ? `Custom: ${supplierProfile?.default_payment_terms_custom || ""}`
                              : supplierProfile?.default_payment_terms || "미지정"}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">인코텀즈 조건 (Default Incoterms)</label>
                        {isEditingSupplier ? (
                          <select
                            value={supIncoterms}
                            onChange={(e) => setSupIncoterms(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          >
                            <option value="">미지정 (Not Set)</option>
                            <option value="EXW">EXW</option>
                            <option value="FOB">FOB</option>
                            <option value="CIF">CIF</option>
                            <option value="DDP">DDP</option>
                            <option value="DAP">DAP</option>
                          </select>
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">{supplierProfile?.default_incoterms || "미지정"}</span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">기본 출고지 주소 (Ship-from Address)</label>
                        {isEditingSupplier ? (
                          <div className="space-y-1">
                            <select
                              value={supShipFromWarehouseId}
                              onChange={(e) => setSupShipFromWarehouseId(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            >
                              <option value="">미지정 (Not Set)</option>
                              {warehouses.map((wh: any) => {
                                if (wh.status === "inactive" && wh.id !== supplierProfile?.default_ship_from_warehouse_id) {
                                  return null;
                                }
                                return (
                                  <option key={wh.id} value={wh.id}>
                                    [{wh.code}] {wh.name} ({wh.address1}){wh.status === "inactive" ? " (비활성)" : ""}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-0.5">
                              참고용 본사 주소: {address || "등록 없음"}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="font-semibold text-zinc-900 dark:text-white block">
                              {(() => {
                                const selectedWh = warehouses.find(w => w.id === supplierProfile?.default_ship_from_warehouse_id);
                                return selectedWh 
                                  ? `[${selectedWh.code}] ${selectedWh.name} (${selectedWh.address1})${selectedWh.status === "inactive" ? " (비활성)" : ""}`
                                  : "미지정 (Not Set)";
                              })()}
                            </span>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                              참고용 본사 주소: {address || "등록 없음"}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">선적항 (Port of Loading)</label>
                          {isEditingSupplier ? (
                            <input
                              type="text"
                              value={supPortOfLoading}
                              onChange={(e) => setSupPortOfLoading(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="Busan, Incheon..."
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierProfile?.default_port_of_loading || "Busan"}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">평균 리드타임 (Lead Time)</label>
                          {isEditingSupplier ? (
                            <input
                              type="text"
                              value={supLeadTime}
                              onChange={(e) => setSupLeadTime(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="30 days, 6 weeks..."
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierProfile?.default_production_lead_time || "등록 없음"}</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">기본 MOQ</label>
                          {isEditingSupplier ? (
                            <input
                              type="number"
                              value={supMOQ}
                              onChange={(e) => setSupMOQ(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="최소 구매 수량"
                              min="0"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined ? `${supplierProfile.default_moq.toLocaleString()} pcs` : "제한 없음"}
                            </span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">PO 수신 공식 이메일</label>
                          {isEditingSupplier ? (
                            <input
                              type="email"
                              value={supReceivingEmail}
                              onChange={(e) => setSupReceivingEmail(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="orders@supplier.com"
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white font-mono">{supplierProfile?.po_receiving_email || "등록 없음"}</span>
                          )}
                        </div>
                      </div>



                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">내부 관리용 메모 (Internal Note)</label>
                        {isEditingSupplier ? (
                          <textarea
                            value={supInternalNote}
                            onChange={(e) => setSupInternalNote(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none h-16"
                            placeholder="K SELECT 어드민 직원만 볼 수 있는 메모입니다..."
                          />
                        ) : (
                          <div className="bg-zinc-50 p-2 border border-zinc-150 rounded text-zinc-650 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-400 min-h-[40px] whitespace-pre-wrap">
                            {supplierProfile?.internal_note || "작성된 메모가 없습니다."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. Bank & Remittance Information Tab */}
              {activeTab === "remittance" && showSupplierTab && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">은행 정보 (Payment & Remittance Info)</h3>
                    {!isEditingSupplier ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSupStatus(supplierProfile?.status || "active");
                          setSupCurrency(supplierProfile?.default_currency || "");
                          setSupPaymentTerms(supplierProfile?.default_payment_terms || "");
                          setSupPaymentTermsCustom(supplierProfile?.default_payment_terms_custom || "");
                          setSupIncoterms(supplierProfile?.default_incoterms || "");
                          setSupShipFromWarehouseId(supplierProfile?.default_ship_from_warehouse_id || "");
                          setSupPortOfLoading(supplierProfile?.default_port_of_loading || "");
                          setSupLeadTime(supplierProfile?.default_production_lead_time || "");
                          setSupMOQ(supplierProfile?.default_moq !== null && supplierProfile?.default_moq !== undefined ? String(supplierProfile.default_moq) : "");
                          setSupReceivingEmail(supplierProfile?.po_receiving_email || "");
                          setSupInternalNote(supplierProfile?.internal_note || "");

                          if (hasRemittanceAccess) {
                            setRemMethod(supplierRemittance?.payment_method || "");
                            setRemBeneficiaryName(supplierRemittance?.beneficiary_name || "");
                            setRemBeneficiaryAddress(supplierRemittance?.beneficiary_address || "");
                            setRemBankName(supplierRemittance?.bank_name || "");
                            setRemBankAddress(supplierRemittance?.bank_address || "");
                            setRemBankCountry(supplierRemittance?.bank_country || "");
                            setRemAccountNumber(supplierRemittance?.account_number || "");
                            setRemSwiftBic(supplierRemittance?.swift_bic || "");
                            setRemRoutingNumber(supplierRemittance?.routing_number || "");
                            setRemAccountCurrency(supplierRemittance?.account_currency || "USD");
                            setRemIntermediaryBank(supplierRemittance?.intermediary_bank_info || "");
                            setRemNote(supplierRemittance?.remittance_note || "");
                          }
                          setIsEditingSupplier(true);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold rounded border bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-750"
                      >
                        정보 수정
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingSupplier(false)}
                          className="px-2.5 py-1 text-[10px] font-bold rounded border bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 cursor-pointer dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-850"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveSupplier}
                          disabled={supplierPending}
                          className="px-3 py-1 text-[10px] font-bold rounded bg-zinc-950 text-white hover:opacity-90 disabled:opacity-50 cursor-pointer dark:bg-zinc-100 dark:text-zinc-950"
                        >
                          {supplierPending ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Payment & Remittance Details */}
                  <div className="space-y-4 max-w-3xl">
                    {!hasRemittanceAccess && (
                      <div className="bg-amber-50/50 border border-amber-100 rounded p-2.5 text-[10px] text-amber-800 leading-relaxed dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300">
                        🔒 <strong>조회 권한 제한:</strong> 송금 정보(은행 정보)의 원본 및 수정 권한은 Super Admin과 Finance 부서 담당자에게만 제한되어 있습니다.
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">지불 방법 (Method)</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <select
                              value={remMethod}
                              onChange={(e) => setRemMethod(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            >
                              <option value="Wire Transfer">Wire Transfer (T/T)</option>
                              <option value="L/C">Letter of Credit (L/C)</option>
                              <option value="PayPal">PayPal</option>
                              <option value="Other">Other</option>
                            </select>
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierRemittance?.payment_method || "Wire Transfer"}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">수취 계좌 통화</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <select
                              value={remAccountCurrency}
                              onChange={(e) => setRemAccountCurrency(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            >
                              <option value="USD">USD ($)</option>
                              <option value="KRW">KRW (₩)</option>
                              <option value="EUR">EUR (€)</option>
                              <option value="CNY">CNY (¥)</option>
                            </select>
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierRemittance?.account_currency || "USD"}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">예금주명 (Beneficiary Name)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <input
                            type="text"
                            value={remBeneficiaryName}
                            onChange={(e) => setRemBeneficiaryName(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="수취인 실명"
                          />
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {hasRemittanceAccess 
                              ? (supplierRemittance?.beneficiary_name || "등록 없음")
                              : (supplierRemittance?.beneficiary_name ? "••••••••" : "등록 없음")}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">수취인 주소 (Beneficiary Address)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <input
                            type="text"
                            value={remBeneficiaryAddress}
                            onChange={(e) => setRemBeneficiaryAddress(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="송금 수취인 영문 주소"
                          />
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {hasRemittanceAccess 
                              ? (supplierRemittance?.beneficiary_address || "등록 없음")
                              : (supplierRemittance?.beneficiary_address ? "••••••••" : "등록 없음")}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">은행명 (Bank Name)</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <input
                              type="text"
                              value={remBankName}
                              onChange={(e) => setRemBankName(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="KEB Hana Bank..."
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierRemittance?.bank_name || "등록 없음"}</span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">은행 소재국</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <input
                              type="text"
                              value={remBankCountry}
                              onChange={(e) => setRemBankCountry(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                              placeholder="South Korea, USA..."
                            />
                          ) : (
                            <span className="font-semibold text-zinc-900 dark:text-white">{supplierRemittance?.bank_country || "등록 없음"}</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">은행 주소 (Bank Address)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <input
                            type="text"
                            value={remBankAddress}
                            onChange={(e) => setRemBankAddress(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="송금 수취 은행 영문 지점 주소"
                          />
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {hasRemittanceAccess 
                              ? (supplierRemittance?.bank_address || "등록 없음")
                              : (supplierRemittance?.bank_address ? "••••••••" : "등록 없음")}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">계좌번호 (Account Number)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <input
                            type="text"
                            value={remAccountNumber}
                            onChange={(e) => setRemAccountNumber(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                            placeholder="계좌번호 입력"
                          />
                        ) : (
                          <span className="font-semibold font-mono text-zinc-900 dark:text-white">
                            {hasRemittanceAccess 
                              ? (supplierRemittance?.account_number || "등록 없음")
                              : (supplierRemittance?.account_number 
                                  ? `••••••••${supplierRemittance.account_number.slice(-4)}`
                                  : "등록 없음")}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">SWIFT / BIC Code</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <input
                              type="text"
                              value={remSwiftBic}
                              onChange={(e) => setRemSwiftBic(e.target.value.toUpperCase())}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                              placeholder="SWIFT 코드"
                            />
                          ) : (
                            <span className="font-semibold font-mono text-zinc-900 dark:text-white">
                              {hasRemittanceAccess 
                                ? (supplierRemittance?.swift_bic || "등록 없음")
                                : (supplierRemittance?.swift_bic ? "••••••••" : "등록 없음")}
                            </span>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-zinc-400 block mb-1">Routing Number</label>
                          {isEditingSupplier && hasRemittanceAccess ? (
                            <input
                              type="text"
                              value={remRoutingNumber}
                              onChange={(e) => setRemRoutingNumber(e.target.value)}
                              className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                              placeholder="ABA, Routing No..."
                            />
                          ) : (
                            <span className="font-semibold font-mono text-zinc-900 dark:text-white">
                              {hasRemittanceAccess 
                                ? (supplierRemittance?.routing_number || "등록 없음")
                                : (supplierRemittance?.routing_number ? "••••••••" : "등록 없음")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">중개 은행 정보 (Intermediary Bank)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <input
                            type="text"
                            value={remIntermediaryBank}
                            onChange={(e) => setRemIntermediaryBank(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                            placeholder="중개 은행 명칭 및 지점 정보 (필요시)"
                          />
                        ) : (
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {hasRemittanceAccess 
                              ? (supplierRemittance?.intermediary_bank_info || "등록 없음")
                              : (supplierRemittance?.intermediary_bank_info ? "••••••••" : "등록 없음")}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 block mb-1">송금 비고 (Remittance Note)</label>
                        {isEditingSupplier && hasRemittanceAccess ? (
                          <textarea
                            value={remNote}
                            onChange={(e) => setRemNote(e.target.value)}
                            className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none h-12"
                            placeholder="해외 송금 시 수취인 지시 사항 등..."
                          />
                        ) : (
                          <div className="bg-zinc-50 p-2 border border-zinc-150 rounded text-zinc-650 dark:bg-zinc-950/20 dark:border-zinc-800 dark:text-zinc-400 min-h-[30px] whitespace-pre-wrap">
                            {supplierRemittance?.remittance_note || "등록 없음"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
                <label className="text-[10px] font-bold text-zinc-455 block mb-1">연락처 (Phone Number)</label>
                <InternationalPhoneInput
                  value={addPhone}
                  onChange={(val) => setAddPhone(val)}
                  placeholder="856 555 1234, 10 1234 5678"
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
                  <label className="text-[10px] font-bold text-zinc-400 block mb-1">연락처 (Phone Number)</label>
                  <InternationalPhoneInput
                    value={editPhone}
                    onChange={(val) => setEditPhone(val)}
                    placeholder="856 555 1234, 10 1234 5678"
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

      {/* Edit Brand Modal */}
      {isEditBrandOpen && selectedBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">브랜드 정보 수정</h3>
                <p className="text-[10px] text-zinc-450 mt-0.5">{selectedBrand.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditBrandOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-150"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateBrandSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">브랜드명 *</label>
                <input
                  type="text"
                  required
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">브랜드 소개글</label>
                <textarea
                  value={editBrandIntro}
                  onChange={(e) => setEditBrandIntro(e.target.value)}
                  rows={3}
                  placeholder="브랜드 소개 정보를 입력하세요"
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">브랜드 로고 이미지</label>
                {editBrandLogoUrl && !editBrandLogoFile && (
                  <div className="mb-2 flex items-center gap-2">
                    <img src={editBrandLogoUrl} alt="logo preview" className="h-10 w-10 rounded border border-zinc-200 object-cover" />
                    <span className="text-[10px] text-zinc-450">기존 로고 이미지 등록됨</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditBrandLogoFile(e.target.files?.[0] || null)}
                  className="block w-full text-[11px] text-zinc-555 dark:text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 dark:file:bg-zinc-800 dark:file:text-zinc-300 hover:file:bg-zinc-200 cursor-pointer"
                />
              </div>

              {/* KR Trademark Info */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-brand-has-kr"
                    checked={editBrandHasKr}
                    onChange={(e) => setEditBrandHasKr(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="edit-brand-has-kr" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    대한민국 상표권 보유
                  </label>
                </div>
                {editBrandHasKr && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">등록번호</label>
                      <input
                        type="text"
                        value={editBrandKrNum}
                        onChange={(e) => setEditBrandKrNum(e.target.value)}
                        placeholder="등록번호를 입력하세요"
                        className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">증빙 서류 변경</label>
                      {editBrandKrUrl && (
                        <p className="text-[10px] text-zinc-455 mb-1 font-semibold">📁 기존 인증서 파일 등록됨</p>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setEditBrandKrFile(e.target.files?.[0] || null)}
                        className="block w-full text-[10px] text-zinc-555 file:mr-2 file:py-1 file:px-2 file:rounded file:bg-zinc-200 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* US Trademark Info */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-brand-has-us"
                    checked={editBrandHasUs}
                    onChange={(e) => setEditBrandHasUs(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="edit-brand-has-us" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    미국 USPTO 상표권 보유
                  </label>
                </div>
                {editBrandHasUs && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">등록번호</label>
                      <input
                        type="text"
                        value={editBrandUsNum}
                        onChange={(e) => setEditBrandUsNum(e.target.value)}
                        placeholder="등록번호를 입력하세요"
                        className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">증빙 서류 변경</label>
                      {editBrandUsUrl && (
                        <p className="text-[10px] text-zinc-455 mb-1 font-semibold">📁 기존 인증서 파일 등록됨</p>
                      )}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setEditBrandUsFile(e.target.files?.[0] || null)}
                        className="block w-full text-[10px] text-zinc-555 file:mr-2 file:py-1 file:px-2 file:rounded file:bg-zinc-200 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditBrandOpen(false)}
                  className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-555 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950 text-[11px]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-955 px-4 py-2 font-bold text-white hover:bg-zinc-850 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 text-[11px]"
                >
                  {isPending ? "저장중..." : "변경 사항 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Brand Modal */}
      {isAddBrandOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">신규 브랜드 추가</h3>
                <p className="text-[10px] text-zinc-450 mt-0.5">{name}에 새 브랜드 등록</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBrandOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-150"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBrandSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">브랜드명 *</label>
                <input
                  type="text"
                  required
                  value={addBrandName}
                  onChange={(e) => setAddBrandName(e.target.value)}
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 block mb-1">브랜드 소개글</label>
                <textarea
                  value={addBrandIntro}
                  onChange={(e) => setAddBrandIntro(e.target.value)}
                  rows={3}
                  placeholder="브랜드 소개 정보를 입력하세요"
                  className="w-full rounded border border-zinc-200 p-2 text-xs outline-none bg-white focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-955 dark:text-white resize-none"
                />
              </div>

              {/* KR Trademark Info */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="add-brand-has-kr"
                    checked={addBrandHasKr}
                    onChange={(e) => setAddBrandHasKr(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="add-brand-has-kr" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    대한민국 상표권 보유
                  </label>
                </div>
                {addBrandHasKr && (
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">등록번호</label>
                    <input
                      type="text"
                      value={addBrandKrNum}
                      onChange={(e) => setAddBrandKrNum(e.target.value)}
                      placeholder="등록번호를 입력하세요"
                      className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* US Trademark Info */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="add-brand-has-us"
                    checked={addBrandHasUs}
                    onChange={(e) => setAddBrandHasUs(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-650 focus:ring-indigo-500 h-4 w-4"
                  />
                  <label htmlFor="add-brand-has-us" className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    미국 USPTO 상표권 보유
                  </label>
                </div>
                {addBrandHasUs && (
                  <div>
                    <label className="text-[9px] font-bold text-zinc-400 block mb-0.5">등록번호</label>
                    <input
                      type="text"
                      value={addBrandUsNum}
                      onChange={(e) => setAddBrandUsNum(e.target.value)}
                      placeholder="등록번호를 입력하세요"
                      className="w-full rounded border border-zinc-200 p-1.5 text-xs outline-none bg-white dark:border-zinc-800 dark:bg-zinc-955 dark:text-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddBrandOpen(false)}
                  className="rounded border border-zinc-200 px-4 py-2 font-bold text-zinc-555 hover:bg-zinc-50 dark:border-zinc-850 dark:hover:bg-zinc-950 text-[11px]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-zinc-950 px-4 py-2 font-bold text-white hover:bg-zinc-855 disabled:opacity-50 dark:bg-white dark:text-zinc-955 dark:hover:bg-zinc-100 text-[11px]"
                >
                  {isPending ? "등록중..." : "브랜드 등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
