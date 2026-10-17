"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar, { type SidebarStaffPermissions } from "./sidebar";
import Header from "./header";

import type { AdminUnreadCounts } from "@/lib/notifications/admin-read-state";

interface AdminLayoutProps {
  children: React.ReactNode;
  pendingInquiriesCount?: number;
  pendingApplicationsCount?: number;
  unreadCounts?: AdminUnreadCounts;
  permissions?: SidebarStaffPermissions;
}

import { isPilotMaxWidthRoute, PILOT_MAX_WIDTH_PREFIXES } from "@/lib/admin/layout-config";

export { isPilotMaxWidthRoute, PILOT_MAX_WIDTH_PREFIXES };

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
  const authPaths = [
    "/admin/login",
    "/admin/forgot-password",
    "/admin/reset-password",
    "/admin/invite/accept",
  ];

  const isAuthRoute = authPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  const isPilot = isPilotMaxWidthRoute(pathname);

  // ADM-LAYOUT-MAXWIDTH-001: Pilot responsive max-width layout (1600px) for 4 Retail Network menus
  if (isPilot) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex justify-center">
        <div className="w-full max-w-[1600px] min-h-screen flex relative min-[1601px]:border-x min-[1601px]:border-zinc-200 dark:min-[1601px]:border-zinc-800/80">
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

  // Standard full-width layout for all other Admin sections (Rule 27 standard)
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleSidebar}
        pendingInquiriesCount={pendingInquiriesCount}
        pendingApplicationsCount={pendingApplicationsCount}
        unreadCounts={unreadCounts}
        permissions={permissions}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? "pl-16" : "pl-64"
        }`}
      >
        {/* Top Header */}
        <Header isSidebarCollapsed={isSidebarCollapsed} />

        {/* Scrollable Page Body */}
        <main className="flex-1 px-6 pt-24 pb-12 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
