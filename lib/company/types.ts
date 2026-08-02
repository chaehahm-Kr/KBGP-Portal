export type CompanyRole = "company_admin" | "company_staff";
export type CompanyUserStatus = "invited" | "active" | "suspended";

export type CompanyUserRow = {
  id: string;
  company_id: string;
  name: string;
  email: string;
  company_role: CompanyRole;
  status: CompanyUserStatus;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
};

export const INVITE_EXPIRY_DAYS = 7;

export function isInviteExpired(row: Pick<CompanyUserRow, "status" | "invited_at">) {
  if (row.status !== "invited" || !row.invited_at) return false;
  const invitedAtMs = new Date(row.invited_at).getTime();
  const expiryMs = invitedAtMs + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > expiryMs;
}
