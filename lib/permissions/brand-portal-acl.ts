/**
 * Brand Portal RBAC / ACL Authoritative Definitions & Helper Utilities
 */

export type AclLevel = "none" | "read" | "write" | "manage";

export const ACL_LEVEL_NUMERIC: Record<AclLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};

export const ACL_LEVEL_LABELS: Record<AclLevel, { ko: string; en: string }> = {
  none: { ko: "접근불가", en: "No Access" },
  read: { ko: "조회전용", en: "Read Only" },
  write: { ko: "생성/수정", en: "Create/Edit" },
  manage: { ko: "생성/수정/삭제", en: "Create/Edit/Delete" },
};

export type AclCategory =
  | "application"    // 입점 신청서
  | "brands"         // 브랜드 관리
  | "products"       // 제품 관리
  | "orders"         // 주문 관리
  | "finance"        // 정산 / 인보이스
  | "support"        // 문의 지원
  | "company_info"   // 회사 기본 정보
  | "bank_info"      // 송금 계좌 정보
  | "agreements";    // 계약 및 문서

export interface AclCategoryConfig {
  id: AclCategory;
  labelKo: string;
  labelEn: string;
  description: string;
}

export const ACL_CATEGORIES: AclCategoryConfig[] = [
  { id: "application", labelKo: "입점 신청서", labelEn: "Partnership Application", description: "입점 신청 내역 및 심사 진행 상태 조회/관리" },
  { id: "brands", labelKo: "브랜드 관리", labelEn: "Brand Management", description: "브랜드 등록, 로고 및 상세 프로필 관리" },
  { id: "products", labelKo: "제품 관리", labelEn: "Product Management", description: "제품 등록, 속성, 바코드(UPC/EAN) 및 이미지 관리" },
  { id: "orders", labelKo: "주문 관리", labelEn: "Order Management", description: "발주서(PO) 조회, PO 요청 및 배송 현황 관리" },
  { id: "finance", labelKo: "정산 / 인보이스", labelEn: "Finance & Invoices", description: "공급사 정산 내역 및 인보이스(Invoice) 발행/조회" },
  { id: "support", labelKo: "문의 지원", labelEn: "1:1 Support", description: "1:1 문의 접수 및 답변 확인" },
  { id: "company_info", labelKo: "회사 기본 정보", labelEn: "Company Basic Info", description: "회사 기본 정보, 주소 및 주요 담당자 정보 관리" },
  { id: "bank_info", labelKo: "송금 계좌 정보", labelEn: "Remittance Bank Info", description: "정산 대금 입금용 은행 계좌 정보 관리" },
  { id: "agreements", labelKo: "계약 및 문서", labelEn: "Agreements & Documents", description: "체결된 전자 기본계약서 및 법적 서류 확인/다운로드" },
];

export type BrandPortalRole = "restricted" | "viewer" | "staff" | "manager" | "admin";

export interface BrandPortalRoleConfig {
  id: BrandPortalRole;
  labelKo: string;
  labelEn: string;
  description: string;
}

export const BRAND_PORTAL_ROLES: BrandPortalRoleConfig[] = [
  { id: "restricted", labelKo: "접근 제한", labelEn: "Access Restricted", description: "모든 사업 메뉴 접근불가 (My Account만 이용 가능)" },
  { id: "viewer", labelKo: "조회 사용자", labelEn: "Viewer", description: "허용된 포털 메뉴의 정보 조회전용 (기본 초대 권한)" },
  { id: "staff", labelKo: "담당자", labelEn: "Staff", description: "실무 영역 생성/수정 가능 (민감/계좌 정보 제한)" },
  { id: "manager", labelKo: "매니저", labelEn: "Manager", description: "대부분의 사업/정산 영역 생성/수정 및 일부 관리" },
  { id: "admin", labelKo: "관리자", labelEn: "Admin", description: "회사 포털 전 메뉴 최고 권한 (생성/수정/삭제)" },
];

export const ROLE_PRESETS: Record<BrandPortalRole, Record<AclCategory, AclLevel>> = {
  restricted: {
    application: "none",
    brands: "none",
    products: "none",
    orders: "none",
    finance: "none",
    support: "none",
    company_info: "none",
    bank_info: "none",
    agreements: "none",
  },
  viewer: {
    application: "read",
    brands: "read",
    products: "read",
    orders: "read",
    finance: "read",
    support: "read",
    company_info: "read",
    bank_info: "none",
    agreements: "none",
  },
  staff: {
    application: "write",
    brands: "write",
    products: "write",
    orders: "write",
    finance: "read",
    support: "write",
    company_info: "read",
    bank_info: "none",
    agreements: "none",
  },
  manager: {
    application: "write",
    brands: "write",
    products: "manage",
    orders: "manage",
    finance: "write",
    support: "manage",
    company_info: "write",
    bank_info: "read",
    agreements: "read",
  },
  admin: {
    application: "manage",
    brands: "manage",
    products: "manage",
    orders: "manage",
    finance: "manage",
    support: "manage",
    company_info: "manage",
    bank_info: "manage",
    agreements: "manage",
  },
};

/**
 * Safely parse any level value into a canonical AclLevel
 */
export function parseAclLevel(val: any): AclLevel {
  if (!val) return "none";
  if (val === "none") return "none";
  if (val === "read") return "read";
  if (val === "write" || val === "edit") return "write";
  if (val === "manage" || val === "full" || val === "admin") return "manage";
  return "none";
}

/**
 * Normalizes an arbitrary permissions object into a complete 9-category AclLevel mapping.
 */
export function normalizePermissions(
  permissionsObj: Record<string, any> = {},
  userRole?: string
): Record<AclCategory, AclLevel> {
  const presetKey = permissionsObj?.preset || permissionsObj?.role || userRole;
  let defaultPreset = ROLE_PRESETS.viewer;
  if (presetKey === "company_admin" || presetKey === "admin") {
    defaultPreset = ROLE_PRESETS.admin;
  } else if (presetKey === "restricted" || presetKey === "company_restricted") {
    defaultPreset = ROLE_PRESETS.restricted;
  } else if (presetKey === "staff" || presetKey === "company_staff") {
    defaultPreset = ROLE_PRESETS.staff;
  } else if (presetKey === "manager" || presetKey === "company_manager") {
    defaultPreset = ROLE_PRESETS.manager;
  }

  const result: Record<AclCategory, AclLevel> = { ...defaultPreset };

  ACL_CATEGORIES.forEach((cat) => {
    if (permissionsObj[cat.id] !== undefined) {
      result[cat.id] = parseAclLevel(permissionsObj[cat.id]);
    }
  });

  return result;
}

/**
 * Canonical 5-Role Display Configuration & Badge Styles
 */
export const ROLE_DISPLAY_CONFIG: Record<BrandPortalRole, { labelKo: string; labelEn: string; fullLabel: string; badgeClass: string }> = {
  restricted: {
    labelKo: "접근 제한",
    labelEn: "Restricted",
    fullLabel: "접근 제한 (Restricted)",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  },
  viewer: {
    labelKo: "조회 사용자",
    labelEn: "Viewer",
    fullLabel: "조회 사용자 (Viewer)",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  },
  staff: {
    labelKo: "담당자",
    labelEn: "Staff",
    fullLabel: "담당자 (Staff)",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  },
  manager: {
    labelKo: "매니저",
    labelEn: "Manager",
    fullLabel: "매니저 (Manager)",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  },
  admin: {
    labelKo: "관리자",
    labelEn: "Admin",
    fullLabel: "관리자 (Admin)",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
  },
};

/**
 * Single Authoritative Source of Truth for resolving a company user's 5-level BrandPortalRole.
 * Priorities:
 * 1. permissions.preset
 * 2. permissions.role
 * 3. company_role / role property
 */
export function resolveCompanyUserRole(userObjOrRole: any, permissions?: Record<string, any>): BrandPortalRole {
  if (!userObjOrRole) return "viewer";

  if (typeof userObjOrRole === "string") {
    if (permissions?.preset || permissions?.role) {
      return mapRoleToPreset(permissions.preset || permissions.role);
    }
    return mapRoleToPreset(userObjOrRole);
  }

  if (typeof userObjOrRole === "object" && userObjOrRole !== null) {
    const perms = userObjOrRole.permissions || (userObjOrRole.preset || userObjOrRole.role ? userObjOrRole : null);
    const preset = perms?.preset || perms?.role || userObjOrRole.preset || userObjOrRole.role;
    if (preset) return mapRoleToPreset(preset);
    return mapRoleToPreset(userObjOrRole.company_role || userObjOrRole.role);
  }

  return "viewer";
}

/**
 * Maps a CompanyRole, permissions object, or BrandPortalRole to its canonical preset id
 */
export function mapRoleToPreset(
  roleOrPermissions: any,
  fallbackCompanyRole?: string
): BrandPortalRole {
  let r = "";
  if (typeof roleOrPermissions === "object" && roleOrPermissions !== null) {
    r = roleOrPermissions.preset || roleOrPermissions.role || fallbackCompanyRole || "";
  } else if (typeof roleOrPermissions === "string") {
    r = roleOrPermissions;
  } else {
    r = fallbackCompanyRole || "";
  }

  if (r === "company_admin" || r === "admin") return "admin";
  if (r === "company_manager" || r === "manager") return "manager";
  if (r === "company_staff" || r === "staff") return "staff";
  if (r === "company_restricted" || r === "restricted") return "restricted";
  return "viewer";
}

/**
 * Maps any role preset string ("admin", "staff", "viewer", "manager", "restricted") to valid company_users DB role enum
 */
export function mapPresetToMembershipRole(roleInput: string): "company_admin" | "company_staff" {
  if (roleInput === "admin" || roleInput === "company_admin") {
    return "company_admin";
  }
  return "company_staff";
}

export function getRoleKoreanTitle(userOrRole: any, permissions?: Record<string, any>): string {
  const preset = resolveCompanyUserRole(userOrRole, permissions);
  return ROLE_DISPLAY_CONFIG[preset]?.labelKo || "담당자";
}

export function getRoleDisplayLabel(userOrRole: any, permissions?: Record<string, any>): string {
  const preset = resolveCompanyUserRole(userOrRole, permissions);
  const config = ROLE_DISPLAY_CONFIG[preset];
  if (!config) return "Staff (담당자)";
  return `${config.labelEn} (${config.labelKo})`;
}


