"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ApplicationsIcon,
  CompaniesIcon,
  ProductsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SupportIcon,
  SalesIcon
} from "../admin/icons";

interface PortalSidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  companyName?: string;
  companyRole?: string;
}

interface MenuItem {
  name: string;
  icon: React.ComponentType<any>;
  href: string;
  adminOnly?: boolean;
}

export default function PortalSidebar({
  isCollapsed,
  toggleCollapse,
  companyName = "Partner Company",
  companyRole = "member"
}: PortalSidebarProps) {
  const pathname = usePathname();
  const isCompanyAdmin = companyRole === "company_admin";

  const menuItems: MenuItem[] = [
    { name: "대시보드", icon: DashboardIcon, href: "/portal" },
    { name: "입점 신청서", icon: ApplicationsIcon, href: "/portal/applications" },
    { name: "브랜드 관리", icon: CompaniesIcon, href: "/portal/brands" },
    { name: "제품 관리", icon: ProductsIcon, href: "/portal/products" },
    { name: "발주 관리", icon: SalesIcon, href: "/portal/orders/purchase-orders" },
    { name: "선적 & 출고 관리", icon: DashboardIcon, href: "/portal/orders/shipping" },
    { name: "1:1 문의", icon: SupportIcon, href: "/portal/support" },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-20 flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        {!isCollapsed && (
          <Link href="/portal" className="flex items-center gap-2">
            <span className="font-sans text-xs font-semibold tracking-wider text-zinc-900 dark:text-white uppercase truncate max-w-[150px]">
              {companyName}
            </span>
            <span className="rounded bg-zinc-900 px-1 py-0.5 text-[8px] font-medium text-white dark:bg-white dark:text-zinc-950">
              PORTAL
            </span>
          </Link>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 dark:bg-white">
            <span className="text-[10px] font-bold text-white dark:text-zinc-950">KP</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 select-none scrollbar-thin">
        {menuItems.map((item) => {
          if (item.adminOnly && !isCompanyAdmin) return null;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="flex-1">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Collapse Button */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          {isCollapsed ? "→" : "← Collapse Sidebar"}
        </button>
      </div>
    </aside>
  );
}
