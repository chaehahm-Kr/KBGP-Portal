export const STAFF_ROLES = [
  "super_admin",
  "reviewer",
  "account_manager",
  "operations",
  "executive_viewer",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// 02_사용자유형과권한표.md 5개 내부 역할.
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  super_admin: "Super Admin",
  reviewer: "Reviewer",
  account_manager: "Account Manager",
  operations: "Operations",
  executive_viewer: "Executive Viewer",
};
