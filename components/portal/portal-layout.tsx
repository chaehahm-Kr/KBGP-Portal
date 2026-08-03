"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import PortalSidebar from "./portal-sidebar";
import PortalHeader from "./portal-header";

interface PortalLayoutProps {
  children: React.ReactNode;
  companyName?: string;
  companyRole?: string;
  userEmail?: string;
  userDisplayName?: string;
}

export default function PortalLayout({
  children,
  companyName,
  companyRole,
  userEmail,
  userDisplayName
}: PortalLayoutProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 비인증 공개 라우트 리스트
  const bypassPaths = [
    "/portal/login",
    "/portal/signup",
    "/portal/reset-password",
    "/portal/invite/accept"
  ];

  const shouldBypass = bypassPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (shouldBypass) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar Navigation */}
      <PortalSidebar
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleSidebar}
        companyName={companyName}
        companyRole={companyRole}
      />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? "pl-16" : "pl-64"
        }`}
      >
        {/* Top Header */}
        <PortalHeader
          isSidebarCollapsed={isSidebarCollapsed}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
          companyRole={companyRole}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 px-6 pt-24 pb-12 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
