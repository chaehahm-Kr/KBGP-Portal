"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getNavItemsForRole } from "@/lib/retailer/navigation";
import { NavIcon } from "@/components/retailer/nav-icon";
import { useTranslation } from "@/lib/i18n/context";

interface RetailerSidebarProps {
  role: string;
  companyName: string;
  storeName: string;
  userName: string;
}

export function RetailerSidebar({
  role,
  companyName,
  storeName,
  userName,
}: RetailerSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const navItems = getNavItemsForRole(role);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        const isChildActive = item.subItems.some(
          (sub) =>
            pathname === sub.href ||
            pathname.startsWith(`${sub.href}/`) ||
            pathname === `/retailer${sub.href}` ||
            pathname.startsWith(`/retailer${sub.href}/`)
        );
        initial[item.key] = isChildActive;
      }
    });
    return initial;
  });

  useEffect(() => {
    navItems.forEach((item) => {
      if (item.subItems && item.subItems.length > 0) {
        const isChildActive = item.subItems.some(
          (sub) =>
            pathname === sub.href ||
            pathname.startsWith(`${sub.href}/`) ||
            pathname === `/retailer${sub.href}` ||
            pathname.startsWith(`/retailer${sub.href}/`)
        );
        if (isChildActive) {
          setOpenSections((prev) => ({ ...prev, [item.key]: true }));
        }
      }
    });
  }, [pathname, navItems]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-screen">
      {/* Brand & Store Header */}
      <div className="h-16 px-6 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-sm border border-zinc-200 dark:border-zinc-800 bg-black flex items-center justify-center">
            <Image
              src="/retailer-brand-mark.jpg"
              alt="K SELECT HUB"
              width={32}
              height={32}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-white block">
              K SELECT HUB
            </span>
            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 block tracking-wider uppercase">
              {t.header.retailerPortal}
            </span>
          </div>
        </Link>
      </div>

      {/* Organization / Active Store Context Badge */}
      <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200/80 dark:border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-200 truncate">
              {companyName}
            </p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
              📍 {storeName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const translatedName = t.nav[item.key as keyof typeof t.nav] || item.name;

            if (item.subItems && item.subItems.length > 0) {
              const isGroupActive = item.subItems.some(
                (sub) =>
                  pathname === sub.href ||
                  pathname.startsWith(`${sub.href}/`) ||
                  pathname === `/retailer${sub.href}` ||
                  pathname.startsWith(`/retailer${sub.href}/`)
              );
              const isOpen = openSections[item.key] ?? isGroupActive;

              return (
                <div key={item.key} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSection(item.key)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isOpen
                        ? "text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <NavIcon name={item.icon} className="w-4 h-4 shrink-0" />
                      <span>{translatedName}</span>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                        isOpen ? "rotate-90" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="pl-6 pr-1 py-1 space-y-1">
                      {item.subItems.map((sub) => {
                        const isSubActive =
                          pathname === sub.href ||
                          pathname.startsWith(`${sub.href}/`) ||
                          pathname === `/retailer${sub.href}` ||
                          pathname.startsWith(`/retailer${sub.href}/`);
                        const translatedSubName = t.nav[sub.key as keyof typeof t.nav] || sub.name;

                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                              isSubActive
                                ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white shadow-xs font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
                            }`}
                          >
                            <span>{translatedSubName}</span>
                            {sub.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                {sub.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname === "/retailer"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  pathname === `/retailer${item.href}` ||
                  pathname.startsWith(`/retailer${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <NavIcon name={item.icon} className="w-4 h-4 shrink-0" />
                  <span>{translatedName}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}

