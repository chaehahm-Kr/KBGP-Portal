import React from "react";
import type { Metadata } from "next";
import AdminLayout from "@/components/admin/layout";
import { getPendingPartnerInquiriesCount } from "@/lib/inquiry/actions";
import { getPendingApplicationsCount } from "@/lib/application/actions";
import { getAdminUnreadCounts } from "@/lib/notifications/admin-read-state";
import { getAdminStaffContext } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "K Select Network 어드민",
  description: "K Select Network 운영 관리 시스템",
  icons: {
    icon: [
      { url: "/symbol-Hotpink-Cyan.png?v=admin_v1", type: "image/png" },
      { url: "/admin-favicon-32x32.png?v=admin_v1", sizes: "32x32", type: "image/png" },
      { url: "/admin-favicon-16x16.png?v=admin_v1", sizes: "16x16", type: "image/png" },
      { url: "/admin-favicon.ico?v=admin_v1", sizes: "any" },
    ],
    shortcut: ["/symbol-Hotpink-Cyan.png?v=admin_v1"],
    apple: [
      { url: "/admin-apple-touch-icon.png?v=admin_v1", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function AdminPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pendingInquiriesCount, pendingApplicationsCount, unreadCounts, staff] = await Promise.all([
    getPendingPartnerInquiriesCount(),
    getPendingApplicationsCount(),
    getAdminUnreadCounts(),
    getAdminStaffContext().catch(() => null),
  ]);

  const permissions = staff
    ? {
        canAccessFinance: staff.canAccessFinance,
        canAccessExecutiveKPIs: staff.canAccessExecutiveKPIs,
        canAccessRetail: staff.hasPermission("retail", "view"),
        canAccessBrand: staff.hasPermission("applications", "view") || staff.hasPermission("products", "view"),
        canManageStaff: staff.canManageStaff,
        isSuperAdmin: staff.isSuperAdmin,
      }
    : undefined;

  return (
    <AdminLayout
      pendingInquiriesCount={pendingInquiriesCount}
      pendingApplicationsCount={pendingApplicationsCount}
      unreadCounts={unreadCounts}
      permissions={permissions}
    >
      {children}
    </AdminLayout>
  );
}
