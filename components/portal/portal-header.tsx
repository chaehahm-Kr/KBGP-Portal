"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SunIcon,
  MoonIcon,
  BellIcon,
  ChevronDownIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
  CompaniesIcon
} from "../admin/icons";
import { logoutPortal } from "@/lib/auth/actions";

interface PortalHeaderProps {
  isSidebarCollapsed: boolean;
  userEmail?: string;
  userDisplayName?: string;
  companyRole?: string;
}

export default function PortalHeader({
  isSidebarCollapsed,
  userEmail = "partner@kselectnetwork.com",
  userDisplayName = "",
  companyRole = "member"
}: PortalHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Initialize theme
  useEffect(() => {
    const root = window.document.documentElement;
    const initialDark =
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    setIsDarkMode(initialDark);
    if (initialDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("theme", "light");
      setIsDarkMode(false);
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDarkMode(true);
    }
  };

  // Generate breadcrumb items from pathname
  const getBreadcrumbs = () => {
    const paths = pathname.split("/").filter(Boolean);
    return paths.map((path, index) => {
      const href = "/" + paths.slice(0, index + 1).join("/");
      const label =
        path === "portal"
          ? "Portal"
          : path.charAt(0).toUpperCase() + path.slice(1).replace("-", " ");
      return { label, href, isLast: index === paths.length - 1 };
    });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header
      className={`fixed top-0 right-0 z-10 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ${
        isSidebarCollapsed ? "left-16" : "left-0 lg:left-64"
      }`}
    >
      {/* Left side: Breadcrumbs */}
      <nav className="flex items-center space-x-1 text-sm font-medium text-zinc-500">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.href}>
            {index > 0 && <span className="text-zinc-300 dark:text-zinc-700">/</span>}
            {crumb.isLast ? (
              <span className="text-zinc-950 dark:text-white font-semibold">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-zinc-900 dark:hover:text-zinc-300"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right side: Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
        >
          {isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            <BellIcon size={16} />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-md border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-900">
                <span className="text-xs font-bold text-zinc-950 dark:text-white">
                  알림 (Notifications)
                </span>
              </div>
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 text-center py-4">
                새로운 알림이 없습니다.
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2 rounded-md hover:bg-zinc-50 p-1 dark:hover:bg-zinc-900 outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
              {userDisplayName ? userDisplayName.trim().charAt(0) : (userEmail ? userEmail.trim().charAt(0).toUpperCase() : "P")}
            </div>
            <ChevronDownIcon size={14} className="text-zinc-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-100 p-3 dark:border-zinc-900">
                <p className="text-sm font-bold text-zinc-950 dark:text-white truncate">
                  {userDisplayName || "파트너 사용자"}
                </p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">{userEmail}</p>
                <span className="inline-block mt-1.5 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 uppercase">
                  {companyRole === "company_admin" ? "관리자" : "멤버"}
                </span>
              </div>
              
              <div className="p-1 border-b border-zinc-100 dark:border-zinc-900 space-y-0.5">
                <Link
                  href="/portal/company/info"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <CompaniesIcon size={14} className="text-zinc-400" />
                  회사 정보
                </Link>
                
                <Link
                  href="/portal/brands"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  <SettingsIcon size={14} className="text-zinc-400" />
                  브랜드 관리
                </Link>

                {companyRole === "company_admin" && (
                  <Link
                    href="/portal/company/users"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <UsersIcon size={14} className="text-zinc-400" />
                    사용자 관리
                  </Link>
                )}
              </div>

              <div className="p-1">
                <button
                  onClick={async () => {
                    await logoutPortal();
                    router.push("/portal/login");
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOutIcon size={14} />
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
