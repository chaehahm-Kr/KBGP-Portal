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
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type NotificationItem
} from "@/lib/notification/actions";

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const loadNotifications = async () => {
    const data = await getNotifications();
    setNotifications(data);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      await markNotificationAsRead(n.id);
      setNotifications(prev =>
        prev.map(item => item.id === n.id ? { ...item, is_read: true } : item)
      );
    }
    setIsNotificationsOpen(false);
    if (n.link_url) {
      router.push(n.link_url);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(item => ({ ...item, is_read: true })));
  };

  const formatRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}일 전`;
  };

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
      root.classList.remove("light");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
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
        isSidebarCollapsed ? "left-16" : "left-64"
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
            {notifications.some(n => !n.is_read) && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 z-50">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-2 dark:border-zinc-900">
                <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
                  알림 센터
                </span>
                {notifications.some(n => !n.is_read) && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                  >
                    모두 읽음
                  </button>
                )}
              </div>
              
              <div className="max-h-72 overflow-y-auto space-y-1 scrollbar-thin">
                {notifications.length > 0 ? (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex gap-2.5 items-start ${
                        n.is_read
                          ? "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-650 dark:text-zinc-400"
                          : "bg-indigo-50/40 hover:bg-indigo-50/70 border-l-2 border-indigo-500 pl-2 dark:bg-indigo-950/10 dark:hover:bg-indigo-950/20 text-zinc-900 dark:text-white"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${!n.is_read ? "text-indigo-600 dark:text-indigo-400" : ""}`}>
                          {n.title}
                        </p>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.content}
                        </p>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-1.5 block font-medium">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      {!n.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 self-center shrink-0" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-6">
                    새로운 알림이 없습니다.
                  </div>
                )}
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
