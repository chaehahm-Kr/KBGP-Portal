import React from "react";
import { redirect } from "next/navigation";
import { getAdminStaffContext } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

/**
 * Server-Side RBAC Guard for Admin Finance Module (P3-RBAC-FIX-001)
 * Enforces that only authorized admin staff with finance permission
 * can access any page or route under /admin/finance/**.
 */
export default async function AdminFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getAdminStaffContext();

  if (!staff.canAccessFinance) {
    redirect("/admin?reason=unauthorized_finance");
  }

  return <>{children}</>;
}
