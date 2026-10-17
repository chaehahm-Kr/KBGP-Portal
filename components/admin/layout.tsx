"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar, { type SidebarStaffPermissions } from "./sidebar";
import Header from "./header";

import type { AdminUnreadCounts } from "@/lib/notifications/admin-read-state";
import {
  isAdminAuthRoute,
  ADMIN_LAYOUT_MAX_WIDTH_PX,
  ADMIN_LAYOUT_MAX_WIDTH_CLASS,
  // Backwards compatibility re-exports
  isPilotMaxWidthRoute,
  PILOT_MAX_WIDTH_PREFIXES,
} from "@/lib/admin/layout-config";

interface AdminLayoutProps {
  children: React.ReactNode;
  pendingInquiriesCount?: number;
  pendingApplicationsCount?: number;
  unreadCounts?: AdminUnreadCounts;
  permissions?: SidebarStaffPermissions;
}

export {
  ADMIN_LAYOUT_MAX_WIDTH_PX,
  ADMIN_LAYOUT_MAX_WIDTH_CLASS,
  isPilotMaxWidthRoute,
  PILOT_MAX_WIDTH_PREFIXES,
};

export default function AdminLayout({
  children,
  pendingInquiriesCount = 0,
  pendingApplicationsCount = 0,
  unreadCounts,
  permissions,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 비인증 / 인증 전 전용 라우트 리스트 (독립 Auth Layout 사용)
  if (isAdminAuthRoute(pathname)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  // ADM-LAYOUT-MAXWIDTH-002: Global responsive max-width layout (1800px) for all Admin routes
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex justify-center">
      <div className="w-full max-w-[1800px] min-h-screen flex relative min-[1801px]:border-x min-[1801px]:border-zinc-200 dark:min-[1801px]:border-zinc-800/80">
        {/* Sidebar Navigation */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          toggleCollapse={toggleSidebar}
          pendingInquiriesCount={pendingInquiriesCount}
          pendingApplicationsCount={pendingApplicationsCount}
          unreadCounts={unreadCounts}
          permissions={permissions}
          variant="sticky"
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300">
          {/* Top Header */}
          <Header
            isSidebarCollapsed={isSidebarCollapsed}
            variant="sticky"
          />

          {/* Scrollable Page Body */}
          <main className="flex-1 px-6 pt-8 pb-12 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
