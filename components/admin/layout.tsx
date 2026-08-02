"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";
import Header from "./header";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // 로그인 화면에서는 사이드바와 헤더를 그리지 않음
  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* Sidebar Navigation */}
      <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={toggleSidebar} />

      {/* Main Content Area */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarCollapsed ? "pl-16" : "pl-0 lg:pl-64"
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
