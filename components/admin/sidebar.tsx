"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ApplicationsIcon,
  CompaniesIcon,
  ProductsIcon,
  SamplesIcon,
  RetailIcon,
  SalesIcon,
  AmazonIcon,
  TasksIcon,
  ReportsIcon,
  UsersIcon,
  SettingsIcon,
  InsightsIcon,
  KnowledgeIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from "./icons";

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

interface MenuItem {
  name: string;
  icon: React.ComponentType<any>;
  href?: string;
  subItems?: { name: string; href: string }[];
}

export default function Sidebar({ isCollapsed, toggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Applications: false,
    "Companies & Brands": false,
    Products: false,
    "Retail Network": false,
    "Sales & Performance": false,
    "Growth Simulator": false,
    INSIGHTS: false,
    Amazon: false,
    "Tasks & Communication": false,
    Settings: false,
  });

  // Auto-expand parent menu matching current pathname
  useEffect(() => {
    if (!pathname) return;
    setExpandedMenus({
      Applications: pathname.startsWith("/admin/applications"),
      "Companies & Brands": pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/brands"),
      Products: pathname.startsWith("/admin/products"),
      "Retail Network": pathname.startsWith("/admin/stores"),
      "Sales & Performance": pathname.startsWith("/admin/sales"),
      "Growth Simulator": pathname.startsWith("/admin/simulator"),
      INSIGHTS: pathname.startsWith("/admin/insights"),
      Amazon: pathname.startsWith("/admin/amazon"),
      "Tasks & Communication": pathname.startsWith("/admin/tasks") || pathname.startsWith("/admin/partner-inquiries") || pathname.startsWith("/admin/inquiries"),
      Settings: pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/knowledge"),
    });
  }, [pathname]);

  const menuItems: MenuItem[] = [
    { name: "Dashboard", icon: DashboardIcon, href: "/admin" },
    { name: "Applications", icon: ApplicationsIcon, href: "/admin/applications" },
    {
      name: "Companies & Brands",
      icon: CompaniesIcon,
      subItems: [
        { name: "Companies", href: "/admin/companies" },
        { name: "Brands", href: "/admin/brands" },
      ],
    },
    {
      name: "Products",
      icon: ProductsIcon,
      subItems: [
        { name: "All Products", href: "/admin/products" },
        { name: "Compliance", href: "/admin/products?status=compliance" },
        { name: "Pricing & Profitability", href: "/admin/products/pricing-profitability" },
        { name: "Curation", href: "/admin/products/curation" },
      ],
    },
    {
      name: "Retail Network",
      icon: RetailIcon,
      subItems: [
        { name: "Stores", href: "/admin/stores" },
        { name: "Placements", href: "/admin/stores?tab=placements" },
      ],
    },
    {
      name: "Sales & Performance",
      icon: SalesIcon,
      subItems: [
        { name: "Overview", href: "/admin/sales" },
        { name: "SKU Performance", href: "/admin/sales?tab=sku" },
      ],
    },
    {
      name: "Growth Simulator",
      icon: SamplesIcon,
      subItems: [
        { name: "Overview", href: "/admin/simulator" },
        { name: "Simulation Results", href: "/admin/simulator/results" },
        { name: "Configuration", href: "/admin/simulator/configuration" },
        { name: "Test Sandbox", href: "/admin/simulator/sandbox" },
      ],
    },
    {
      name: "INSIGHTS",
      icon: InsightsIcon,
      subItems: [
        { name: "Overview", href: "/admin/insights" },
        { name: "Review Queue", href: "/admin/insights/queue" },
        { name: "All Insights", href: "/admin/insights/all" },
        { name: "Categories", href: "/admin/insights/categories" },
        { name: "Authors", href: "/admin/insights/authors" },
        { name: "Editorial Rules", href: "/admin/insights/rules" },
        { name: "Automation Runs", href: "/admin/insights/automation-runs" },
      ],
    },
    {
      name: "Amazon",
      icon: AmazonIcon,
      subItems: [
        { name: "Launch Pipeline", href: "/admin/amazon" },
        { name: "Inventory", href: "/admin/amazon?tab=inventory" },
      ],
    },
    {
      name: "Tasks & Communication",
      icon: TasksIcon,
      subItems: [
        { name: "Tasks", href: "/admin/tasks" },
        { name: "Partner Inquiries", href: "/admin/partner-inquiries" },
        { name: "Onboarding Leads", href: "/admin/inquiries" },
        { name: "Activity Log", href: "/admin/tasks?tab=activity" },
      ],
    },
    { name: "Reports", icon: ReportsIcon, href: "/admin/reports" },
    { name: "Users & Permissions", icon: UsersIcon, href: "/admin/staff" },
    {
      name: "Settings",
      icon: SettingsIcon,
      subItems: [
        { name: "Knowledge Center", href: "/admin/knowledge" },
        { name: "Email Templates", href: "/admin/settings/email-templates" },
        { name: "Company Configs", href: "/admin/settings/company-configs" },
        { name: "Categories", href: "/admin/settings/categories" },
        { name: "Attribute Profiles", href: "/admin/settings/attribute-profiles" },
        { name: "Attributes & Options", href: "/admin/settings/attributes" },
        { name: "Curation Settings", href: "/admin/settings/curation" },
      ],
    },
  ];

  const handleToggleExpand = (name: string) => {
    if (isCollapsed) {
      toggleCollapse(); // Expand sidebar if collapsed
    }
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const isMenuItemActive = (item: MenuItem): boolean => {
    if (item.href === pathname) return true;
    if (item.subItems) {
      return item.subItems.some((sub) => {
        if (sub.href === pathname) return true;
        if (sub.href === "/admin/insights" && (pathname === "/admin/insights" || pathname.startsWith("/admin/insights/"))) {
          return true;
        }
        if (sub.href === "/admin/knowledge" && (pathname === "/admin/knowledge" || pathname.startsWith("/admin/knowledge/"))) {
          return true;
        }
        if (sub.href !== "/admin/insights" && sub.href !== "/admin/knowledge" && pathname.startsWith(sub.href + "/")) {
          return true;
        }
        return false;
      });
    }
    return false;
  };

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-20 flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
        {!isCollapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <span className="font-sans text-sm font-semibold tracking-wider text-zinc-900 dark:text-white uppercase">
              K SELECT NETWORK
            </span>
            <span className="rounded bg-zinc-900 px-1 py-0.5 text-[9px] font-medium text-white dark:bg-white dark:text-zinc-950">
              ADMIN
            </span>
          </Link>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 dark:bg-white">
            <span className="text-[10px] font-bold text-white dark:text-zinc-950">KS</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 select-none scrollbar-thin">
        {menuItems.map((item) => {
          const isActive = isMenuItemActive(item);
          const hasSubItems = !!item.subItems;
          const isExpanded = expandedMenus[item.name] && !isCollapsed;

          return (
            <div key={item.name} className="space-y-1">
              {hasSubItems ? (
                <button
                  onClick={() => handleToggleExpand(item.name)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-semibold"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && (
                    <span className="flex-1 text-left">{item.name}</span>
                  )}
                  {!isCollapsed && (
                    isExpanded ? (
                      <ChevronDownIcon size={16} className="text-zinc-400" />
                    ) : (
                      <ChevronRightIcon size={16} className="text-zinc-400" />
                    )
                  )}
                </button>
              ) : (
                <Link
                  href={item.href || "/admin"}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-semibold"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="flex-1">{item.name}</span>}
                </Link>
              )}

              {/* Submenus */}
              {hasSubItems && isExpanded && (
                <div className="pl-9 space-y-1">
                  {item.subItems?.map((sub) => {
                    const isSubActive = pathname === sub.href ||
                      (sub.href === "/admin/insights" && pathname.startsWith("/admin/insights")) ||
                      (sub.href === "/admin/knowledge" && pathname.startsWith("/admin/knowledge"));

                    return (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        className={`block rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSubActive
                            ? "text-zinc-900 dark:text-white font-bold bg-zinc-100/70 dark:bg-zinc-800/70"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        {sub.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
