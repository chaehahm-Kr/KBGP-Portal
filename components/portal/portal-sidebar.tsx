"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ProductsIcon,
  SupportIcon,
  SalesIcon,
  ReportsIcon,
  SettingsIcon,
} from "../admin/icons";
import type { AclCategory } from "@/lib/permissions/brand-portal-acl";

interface PortalSidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  companyName?: string;
  companyRole?: string;
  permissions?: Record<string, any>;
}

interface MenuItem {
  name: string;
  icon: React.ComponentType<any>;
  href?: string;
  category?: AclCategory;
  adminOnly?: boolean;
  subItems?: { name: string; href: string; category?: AclCategory }[];
}

export default function PortalSidebar({
  isCollapsed,
  toggleCollapse,
  companyName = "Partner Company",
  companyRole = "member",
  permissions
}: PortalSidebarProps) {
  const pathname = usePathname();
  const isCompanyAdmin = companyRole === "company_admin";

  const isCategoryLocked = (category?: AclCategory): boolean => {
    if (!category) return false;
    if (isCompanyAdmin) return false;
    if (!permissions) return false;
    return permissions[category] === "none";
  };

  const [isOrdersOpen, setIsOrdersOpen] = useState(() => {
    return pathname.startsWith("/portal/orders");
  });

  const [isHelpOpen, setIsHelpOpen] = useState(() => {
    return pathname.startsWith("/portal/help") || pathname.startsWith("/portal/support");
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    return (
      pathname.startsWith("/portal/company/") ||
      pathname.startsWith("/portal/brands") ||
      pathname.startsWith("/portal/applications") ||
      pathname.startsWith("/portal/account")
    );
  });

  React.useEffect(() => {
    if (
      pathname.startsWith("/portal/company/") ||
      pathname.startsWith("/portal/brands") ||
      pathname.startsWith("/portal/applications") ||
      pathname.startsWith("/portal/account")
    ) {
      setIsSettingsOpen(true);
    }
    if (pathname.startsWith("/portal/orders")) {
      setIsOrdersOpen(true);
    }
    if (pathname.startsWith("/portal/help") || pathname.startsWith("/portal/support")) {
      setIsHelpOpen(true);
    }
  }, [pathname]);

  const menuItems: MenuItem[] = [
    { name: "대시보드", icon: DashboardIcon, href: "/portal" },
    { name: "제품 관리", icon: ProductsIcon, href: "/portal/products", category: "products" },
    {
      name: "주문 관리",
      icon: SalesIcon,
      category: "orders",
      subItems: [
        { name: "발주서", href: "/portal/orders/purchase-orders", category: "orders" },
        { name: "발주 요청", href: "/portal/orders/requests", category: "orders" },
      ],
    },
    { name: "정산 관리", icon: ReportsIcon, href: "/portal/finance", category: "finance" },
    {
      name: "Help & Support",
      icon: SupportIcon,
      category: "support",
      subItems: [
        { name: "Help Center", href: "/portal/help", category: "support" },
        { name: "Ask K SELECT", href: "/portal/help/ask", category: "support" },
        { name: "문의 지원", href: "/portal/support", category: "support" },
      ],
    },
  ];

  const settingsPages: { name: string; href: string; category?: AclCategory }[] = [
    { name: "회사 정보", href: "/portal/company/info", category: "company_info" },
    { name: "송금 계좌 정보", href: "/portal/company/info#bank", category: "bank_info" },
    { name: "계약 및 문서", href: "/portal/company/info#agreements", category: "agreements" },
    { name: "브랜드 관리", href: "/portal/brands", category: "brands" },
    ...(isCompanyAdmin ? [{ name: "사용자 관리", href: "/portal/company/users" }] : []),
    { name: "입점 신청 내역", href: "/portal/applications", category: "application" },
    { name: "My Account", href: "/portal/account" },
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

          const isLocked = isCategoryLocked(item.category);

          if (item.subItems) {
            const isGroupActive = item.name === "Help & Support"
              ? (pathname.startsWith("/portal/help") || pathname.startsWith("/portal/support"))
              : pathname.startsWith("/portal/orders");
            const isOpen = item.name === "Help & Support" ? isHelpOpen : isOrdersOpen;
            const toggleOpen = () => {
              if (item.name === "Help & Support") setIsHelpOpen(!isHelpOpen);
              else setIsOrdersOpen(!isOrdersOpen);
            };

            return (
              <div key={item.name} className="space-y-1">
                {isCollapsed ? (
                  isLocked ? (
                    <div
                      title="접근 권한이 없습니다."
                      className="flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-zinc-400 opacity-50 cursor-not-allowed"
                    >
                      <span className="text-[11px]">🔒</span>
                    </div>
                  ) : (
                    <Link
                      href={item.subItems[0].href}
                      className={`flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
                        isGroupActive
                          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                      }`}
                      title={item.name}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                    </Link>
                  )
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && toggleOpen()}
                      title={isLocked ? "접근 권한이 없습니다." : undefined}
                      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isLocked
                          ? "text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed"
                          : isGroupActive
                          ? "bg-zinc-100/70 text-zinc-900 dark:bg-zinc-800/70 dark:text-white font-semibold cursor-pointer"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white cursor-pointer"
                      }`}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={`flex-1 text-left ${isLocked ? "line-through" : ""}`}>{item.name}</span>
                      {isLocked ? (
                        <span className="text-[11px]">🔒</span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {isOpen ? "▼" : "▶"}
                        </span>
                      )}
                    </button>

                    {!isLocked && isOpen && (
                      <div className="pl-4 space-y-1 border-l border-zinc-200 dark:border-zinc-800 ml-5 mt-1">
                        {item.subItems.map((sub) => {
                          const isSubLocked = isCategoryLocked(sub.category);
                          const isSubActive = pathname === sub.href || (sub.href !== "/portal/orders" && sub.href !== "/portal/help" && pathname.startsWith(sub.href)) || (sub.href === "/portal/help" && pathname.startsWith("/portal/help"));

                          if (isSubLocked) {
                            return (
                              <div
                                key={sub.name}
                                title="접근 권한이 없습니다."
                                className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed"
                              >
                                <span className="line-through">{sub.name}</span>
                                <span className="text-[10px]">🔒</span>
                              </div>
                            );
                          }

                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                isSubActive
                                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-bold"
                                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                              }`}
                            >
                              <span className="text-zinc-400 text-[10px]">•</span>
                              <span>{sub.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const isActive =
            item.href === "/portal"
              ? pathname === "/portal"
              : pathname === item.href || (item.href && pathname.startsWith(item.href + "/"));

          if (isLocked) {
            return (
              <div
                key={item.name}
                title="접근 권한이 없습니다."
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed select-none ${
                  isCollapsed ? "justify-center h-10" : ""
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0 text-zinc-400 dark:text-zinc-600" />
                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="line-through">{item.name}</span>
                    <span className="text-[11px]">🔒</span>
                  </div>
                )}
                {isCollapsed && <span className="text-[10px]">🔒</span>}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href || "#"}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-semibold"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="flex-1">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 설정 (Settings) Section */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800 space-y-1">
        {isCollapsed ? (
          <Link
            href="/portal/company/info"
            className={`flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith("/portal/company/") || pathname.startsWith("/portal/brands") || pathname.startsWith("/portal/applications") || pathname.startsWith("/portal/account")
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            }`}
            title="설정"
          >
            <SettingsIcon className="h-5 w-5 shrink-0" />
          </Link>
        ) : (
          <div className="space-y-1">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                pathname.startsWith("/portal/company/") || pathname.startsWith("/portal/brands") || pathname.startsWith("/portal/applications") || pathname.startsWith("/portal/account")
                  ? "text-zinc-900 dark:text-white"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              }`}
            >
              <SettingsIcon className="h-5 w-5 shrink-0 text-zinc-500" />
              <span className="flex-1 text-left font-semibold">설정</span>
              <span className="text-[10px] text-zinc-400">
                {isSettingsOpen ? "▼" : "▲"}
              </span>
            </button>

            {isSettingsOpen && (
              <div className="pl-4 space-y-1 border-l border-zinc-150 dark:border-zinc-800 ml-5">
                {settingsPages.map((sub) => {
                  const isSubLocked = isCategoryLocked(sub.category);
                  const isSubActive = pathname === sub.href || pathname.startsWith(sub.href + "/");

                  if (isSubLocked) {
                    return (
                      <div
                        key={sub.name}
                        title="접근 권한이 없습니다."
                        className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-600 opacity-60 cursor-not-allowed select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">•</span>
                          <span className="line-through">{sub.name}</span>
                        </div>
                        <span className="text-[10px]">🔒</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={sub.name}
                      href={sub.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSubActive
                          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                      }`}
                    >
                      <span className="text-zinc-400">•</span>
                      <span>{sub.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
