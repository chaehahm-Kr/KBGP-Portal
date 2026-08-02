"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  SearchIcon,
  BellIcon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  ChevronDownIcon,
  LogOutIcon
} from "./icons";
import { logoutAdmin } from "@/lib/auth/actions";

interface HeaderProps {
  isSidebarCollapsed: boolean;
}

export default function Header({ isSidebarCollapsed }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Initialize theme from localStorage or system preference
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
        path === "admin"
          ? "Admin"
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
        {/* Global Search Bar */}
        <div className="relative hidden max-w-xs md:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-zinc-400" />
          </span>
          <input
            type="text"
            placeholder="Search projects, stores..."
            className="w-64 rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-xs font-medium text-zinc-900 outline-none transition-all focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700"
          />
        </div>

        {/* Quick Add Button */}
        <Link
          href="/admin/applications"
          className="flex h-8 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          <PlusIcon size={14} />
          <span className="hidden sm:inline">New Application</span>
        </Link>

        {/* Theme Toggle Button */}
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
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-md border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2 dark:border-zinc-900">
                <span className="text-xs font-bold text-zinc-950 dark:text-white">
                  Notifications
                </span>
                <button className="text-[10px] font-semibold text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  Clear All
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex flex-col gap-0.5 rounded border border-zinc-50 p-2 dark:border-zinc-900">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    New Application Submitted
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    APP-000001 (Moisturizer Inc.)
                  </span>
                  <span className="text-[9px] text-zinc-400 mt-1">2 mins ago</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded border border-zinc-50 p-2 dark:border-zinc-900">
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    Compliance Alert
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Missing ingredient certificate for SKU-3401.
                  </span>
                  <span className="text-[9px] text-zinc-400 mt-1">1 hr ago</span>
                </div>
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
              L
            </div>
            <ChevronDownIcon size={14} className="text-zinc-400" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b border-zinc-100 p-3 dark:border-zinc-900">
                <p className="text-xs font-bold text-zinc-950 dark:text-white">Letusto Admin</p>
                <p className="text-[10px] text-zinc-500">admin@kselectnetwork.com</p>
              </div>
              <div className="p-1">
                <Link
                  href="/admin/settings/email-templates"
                  className="flex items-center gap-2 rounded px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                >
                  Account Settings
                </Link>
                <button
                  onClick={async () => {
                    await logoutAdmin();
                    router.push("/admin/login");
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOutIcon size={14} />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
