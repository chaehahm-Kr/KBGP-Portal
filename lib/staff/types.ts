export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "reviewer",
  "account_manager",
  "operations",
  "executive_viewer",
  "custom",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  reviewer: "Reviewer",
  account_manager: "Account Manager",
  operations: "Operations",
  executive_viewer: "Executive Viewer",
  custom: "Custom Role (사용자 정의)",
};

export type StaffStatus = "pending" | "invited" | "setting_up" | "active" | "suspended" | "locked";

export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
  pending: "초대 대기",
  invited: "초대 발송",
  setting_up: "계정 설정 중",
  active: "활성",
  suspended: "비활성",
  locked: "계정 잠금",
};

// 메뉴별 기본 권한 정의 타입
export type MenuActionPermissions = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
};

export type StaffMenuPermissions = {
  applications: MenuActionPermissions;
  companies: MenuActionPermissions;
  products: MenuActionPermissions;
  retail: MenuActionPermissions;
  sales: MenuActionPermissions;
  staff: MenuActionPermissions;
};

export const DEFAULT_MENU_ACTION: MenuActionPermissions = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
};

// 02_사용자유형과권한표.md 및 신규 기획에 맞춤 기본 권한 프리셋
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, StaffMenuPermissions> = {
  super_admin: {
    applications: { view: true, create: true, edit: true, delete: true, approve: true },
    companies: { view: true, create: true, edit: true, delete: true, approve: true },
    products: { view: true, create: true, edit: true, delete: true, approve: true },
    retail: { view: true, create: true, edit: true, delete: true, approve: true },
    sales: { view: true, create: true, edit: true, delete: true, approve: true },
    staff: { view: true, create: true, edit: true, delete: true, approve: true },
  },
  admin: {
    applications: { view: true, create: true, edit: true, delete: false, approve: true },
    companies: { view: true, create: true, edit: true, delete: false, approve: true },
    products: { view: true, create: true, edit: true, delete: false, approve: true },
    retail: { view: true, create: true, edit: true, delete: false, approve: false },
    sales: { view: true, create: true, edit: false, delete: false, approve: false },
    staff: { view: true, create: false, edit: false, delete: false, approve: false }, // Only view staff lists
  },
  reviewer: {
    applications: { view: true, create: false, edit: true, delete: false, approve: true },
    companies: { view: true, create: false, edit: false, delete: false, approve: false },
    products: { view: true, create: false, edit: true, delete: false, approve: true },
    retail: { view: false, create: false, edit: false, delete: false, approve: false },
    sales: { view: false, create: false, edit: false, delete: false, approve: false },
    staff: { view: false, create: false, edit: false, delete: false, approve: false },
  },
  account_manager: {
    applications: { view: true, create: false, edit: true, delete: false, approve: false },
    companies: { view: true, create: true, edit: true, delete: false, approve: false },
    products: { view: true, create: true, edit: true, delete: false, approve: false },
    retail: { view: true, create: false, edit: true, delete: false, approve: false },
    sales: { view: true, create: false, edit: false, delete: false, approve: false },
    staff: { view: false, create: false, edit: false, delete: false, approve: false },
  },
  operations: {
    applications: { view: true, create: false, edit: true, delete: false, approve: false },
    companies: { view: true, create: false, edit: true, delete: false, approve: false },
    products: { view: true, create: true, edit: true, delete: false, approve: true },
    retail: { view: true, create: true, edit: true, delete: false, approve: false },
    sales: { view: true, create: false, edit: false, delete: false, approve: false },
    staff: { view: false, create: false, edit: false, delete: false, approve: false },
  },
  executive_viewer: {
    applications: { view: true, create: false, edit: false, delete: false, approve: false },
    companies: { view: true, create: false, edit: false, delete: false, approve: false },
    products: { view: true, create: false, edit: false, delete: false, approve: false },
    retail: { view: true, create: false, edit: false, delete: false, approve: false },
    sales: { view: true, create: false, edit: false, delete: false, approve: false },
    staff: { view: true, create: false, edit: false, delete: false, approve: false },
  },
  custom: {
    applications: { ...DEFAULT_MENU_ACTION },
    companies: { ...DEFAULT_MENU_ACTION },
    products: { ...DEFAULT_MENU_ACTION },
    retail: { ...DEFAULT_MENU_ACTION },
    sales: { ...DEFAULT_MENU_ACTION },
    staff: { ...DEFAULT_MENU_ACTION },
  },
};
