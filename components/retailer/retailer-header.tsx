"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/retailer/theme-toggle";
import { logoutRetailer } from "@/lib/auth/actions";
import { NavIcon } from "@/components/retailer/nav-icon";
import { getNavItemsForRole } from "@/lib/retailer/navigation";
import { usePathname } from "next/navigation";

interface RetailerHeaderProps {
  userName: string;
  userEmail: string;
  companyName: string;
  role: string;
  storeName: string;
}

export function RetailerHeader({
  userName,
  userEmail,
  companyName,
  role,
  storeName,
}: RetailerHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const navItems = getNavItemsForRole(role);

  return (
    <>
      <header className="sticky top-0 z-40 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        {/* Left: Mobile Logo & Title or Desktop Store Info */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Open mobile menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile Logo */}
          <Link href="/retailer" className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-black text-xs">
              K
            </div>
            <span className="font-bold text-xs tracking-tight text-zinc-900 dark:text-white">
              K SELECT HUB
            </span>
          </Link>

          {/* Desktop Breadcrumb / Store context */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">Retailer Portal</span>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <span className="font-bold text-zinc-900 dark:text-white">{companyName}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              📍 {storeName}
            </span>
          </div>
        </div>

        {/* Right Actions: Theme Toggle & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme Toggle (Desktop and Mobile) */}
          <ThemeToggle variant="compact" />

          {/* User Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold text-xs flex items-center justify-center shadow-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:block text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
                {userName}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Card */}
            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-xl z-50 space-y-3">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {userName}
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">{userEmail}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize border border-zinc-200 dark:border-zinc-700">
                        {role.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                        {companyName}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Appearance
                    </div>
                    <ThemeToggle variant="buttons" />
                  </div>

                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2">
                    <Link
                      href="/retailer/account"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <NavIcon name="user" className="w-3.5 h-3.5" />
                      Account Settings
                    </Link>

                    <form action={logoutRetailer} className="mt-1">
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full z-50 shadow-2xl">
            {/* Drawer Header */}
            <div className="h-16 px-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-black text-sm">
                  K
                </div>
                <span className="font-bold text-sm text-zinc-900 dark:text-white">
                  K SELECT HUB
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Context Badge */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border-b border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{companyName}</p>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">📍 {storeName}</p>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/retailer"
                    ? pathname === "/retailer" || pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold ${
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <NavIcon name={item.icon} className="w-4 h-4" />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <ThemeToggle variant="buttons" />
              <form action={logoutRetailer}>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-red-600/10 border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-600/20 transition-all"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
