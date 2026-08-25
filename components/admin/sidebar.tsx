"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardIcon,
  ApplicationsIcon,
  CompaniesIcon,
  ProductsIcon,
  RetailIcon,
  PurchasingIcon,
  SalesIcon,
  AmazonIcon,
  TasksIcon,
  ReportsIcon,
  UsersIcon,
  SettingsIcon,
  IntelligenceIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  KnowledgeSubIcon,
  EmailTemplatesIcon,
  CompanyConfigsIcon,
  WarehousesIcon,
  CategoriesSubIcon,
  AttributeProfilesIcon,
  AttributesOptionsIcon,
  CurationSettingsIcon,
} from "./icons";

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  pendingInquiriesCount?: number;
}

interface SubItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<any>;
  subItems?: { name: string; href: string }[];
}

interface MenuItem {
  name: string;
  icon: React.ComponentType<any>;
  href?: string;
  subItems?: SubItem[];
}

export default function Sidebar({
  isCollapsed,
  toggleCollapse,
  pendingInquiriesCount = 0,
}: SidebarProps) {
  const pathname = usePathname();

  // Depth 1 expand state
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    Applications: false,
    "Companies & Brands": false,
    Products: false,
    Inventory: false,
    Purchasing: false,
    Finance: false,
    "Retail Network": false,
    "Sales & Performance": false,
    Intelligence: false,
    Amazon: false,
    "Tasks & Communication": false,
    Settings: false,
  });

  // Depth 2 expand state (for 3-depth items like Intelligence -> Growth Simulator)
  const [expandedSubMenus, setExpandedSubMenus] = useState<Record<string, boolean>>({
    "Intelligence->Growth Simulator": true,
    "Intelligence->Insights": true,
  });

  // Auto-expand parent and nested submenus matching current pathname
  useEffect(() => {
    if (!pathname) return;

    const isSimulator = pathname.startsWith("/admin/simulator");
    const isInsights = pathname.startsWith("/admin/insights");
    const isIntelligence = isSimulator || isInsights;

    setExpandedMenus((prev) => ({
      ...prev,
      Applications: pathname.startsWith("/admin/applications"),
      "Companies & Brands": pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/brands"),
      Products: pathname.startsWith("/admin/products"),
      Inventory: pathname.startsWith("/admin/inventory"),
      Purchasing: pathname.startsWith("/admin/purchasing") && !pathname.startsWith("/admin/purchasing/invoices"),
      Finance: pathname.startsWith("/admin/finance"),
      "Retail Network": pathname.startsWith("/admin/stores"),
      "Sales & Performance": pathname.startsWith("/admin/sales"),
      Intelligence: isIntelligence,
      Amazon: pathname.startsWith("/admin/amazon"),
      "Tasks & Communication":
        pathname.startsWith("/admin/tasks") ||
        pathname.startsWith("/admin/partner-inquiries") ||
        pathname.startsWith("/admin/inquiries"),
      Settings: pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/knowledge"),
    }));

    if (isIntelligence) {
      setExpandedSubMenus((prev) => ({
        ...prev,
        "Intelligence->Growth Simulator": isSimulator || prev["Intelligence->Growth Simulator"],
        "Intelligence->Insights": isInsights || prev["Intelligence->Insights"],
      }));
    }
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
        { name: "Product Catalog", href: "/admin/products" },
        { name: "Trading Products", href: "/admin/products/trading" },
        { name: "Compliance", href: "/admin/products?status=compliance" },
        { name: "Pricing Simulator", href: "/admin/products/pricing-profitability" },
        { name: "Curation", href: "/admin/products/curation" },
      ],
    },
    {
      name: "Inventory",
      icon: TasksIcon,
      subItems: [{ name: "Inventory Overview", href: "/admin/inventory" }],
    },
    {
      name: "Purchasing",
      icon: PurchasingIcon,
      subItems: [
        { name: "Purchase Orders", href: "/admin/purchasing" },
      ],
    },
    {
      name: "Finance",
      icon: ReportsIcon,
      subItems: [
        { name: "Supplier Invoices", href: "/admin/finance/invoices" },
        { name: "Payments", href: "/admin/finance/payments" },
        { name: "Landed Cost", href: "/admin/finance/landed-cost" },
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
      name: "Intelligence",
      icon: IntelligenceIcon,
      subItems: [
        {
          name: "Growth Simulator",
          subItems: [
            { name: "Overview", href: "/admin/simulator" },
            { name: "Simulation Results", href: "/admin/simulator/results" },
            { name: "Configuration", href: "/admin/simulator/configuration" },
            { name: "Test Sandbox", href: "/admin/simulator/sandbox" },
          ],
        },
        {
          name: "Insights",
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
        { name: "Knowledge Center", href: "/admin/knowledge", icon: KnowledgeSubIcon },
        { name: "Email Templates", href: "/admin/settings/email-templates", icon: EmailTemplatesIcon },
        { name: "Company Configs", href: "/admin/settings/company-configs", icon: CompanyConfigsIcon },
        { name: "Warehouses", href: "/admin/settings/warehouses", icon: WarehousesIcon },
        { name: "Categories", href: "/admin/settings/categories", icon: CategoriesSubIcon },
        { name: "Attribute Profiles", href: "/admin/settings/attribute-profiles", icon: AttributeProfilesIcon },
        { name: "Attributes & Options", href: "/admin/settings/attributes", icon: AttributesOptionsIcon },
        { name: "Curation Settings", href: "/admin/settings/curation", icon: CurationSettingsIcon },
      ],
    },
  ];

  const handleToggleExpand = (name: string) => {
    if (isCollapsed) {
      toggleCollapse(); // Expand sidebar if collapsed
    }
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleToggleSubExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSubItemActive = (sub: SubItem): boolean => {
    if (sub.href) {
      if (pathname === sub.href) return true;
      if (sub.href === "/admin/insights" && pathname.startsWith("/admin/insights")) return true;
      if (sub.href === "/admin/knowledge" && pathname.startsWith("/admin/knowledge")) return true;
      if (sub.href !== "/admin/insights" && sub.href !== "/admin/knowledge" && pathname.startsWith(sub.href + "/")) {
        return true;
      }
    }
    if (sub.subItems) {
      return sub.subItems.some(
        (child) =>
          pathname === child.href ||
          (child.href === "/admin/insights" && pathname.startsWith("/admin/insights")) ||
          (child.href !== "/admin/insights" && pathname.startsWith(child.href + "/"))
      );
    }
    return false;
  };

  const isMenuItemActive = (item: MenuItem): boolean => {
    if (item.href === pathname) return true;
    if (item.subItems) {
      return item.subItems.some((sub) => isSubItemActive(sub));
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
                  {!isCollapsed && <span className="flex-1 text-left">{item.name}</span>}
                  {!isCollapsed && item.name === "Tasks & Communication" && pendingInquiriesCount > 0 && (
                    <span className="mr-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2">
                      {pendingInquiriesCount}
                    </span>
                  )}
                  {!isCollapsed &&
                    (isExpanded ? (
                      <ChevronDownIcon size={16} className="text-zinc-400" />
                    ) : (
                      <ChevronRightIcon size={16} className="text-zinc-400" />
                    ))}
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

              {/* Depth 2 & Depth 3 Submenus */}
              {hasSubItems && isExpanded && (
                <div className="pl-6 space-y-1">
                  {item.subItems?.map((sub) => {
                    const hasNested = !!sub.subItems;
                    const subKey = `${item.name}->${sub.name}`;
                    const isSubExpanded = expandedSubMenus[subKey] !== false;
                    const isSubActive = isSubItemActive(sub);

                    if (hasNested) {
                      return (
                        <div key={sub.name} className="space-y-1">
                          <button
                            onClick={(e) => handleToggleSubExpand(subKey, e)}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isSubActive
                                ? "text-zinc-900 dark:text-white font-bold"
                                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {sub.icon && <sub.icon size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />}
                              <span>{sub.name}</span>
                            </span>
                            {isSubExpanded ? (
                              <ChevronDownIcon size={14} className="text-zinc-400" />
                            ) : (
                              <ChevronRightIcon size={14} className="text-zinc-400" />
                            )}
                          </button>

                          {/* Depth 3 Links */}
                          {isSubExpanded && (
                            <div className="pl-4 space-y-1 border-l border-zinc-200 dark:border-zinc-800 ml-3">
                              {sub.subItems?.map((child) => {
                                const isChildActive =
                                  pathname === child.href ||
                                  (child.href === "/admin/insights" && pathname === "/admin/insights") ||
                                  (child.href === "/admin/simulator" && pathname === "/admin/simulator");

                                return (
                                  <Link
                                    key={child.name}
                                    href={child.href}
                                    className={`block rounded-md px-3 py-1 text-xs transition-colors ${
                                      isChildActive
                                        ? "text-zinc-900 dark:text-white font-bold bg-zinc-100/70 dark:bg-zinc-800/70"
                                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                                    }`}
                                  >
                                    {child.name}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // 2-Depth item with optional subitem icon (e.g. Settings items)
                    return (
                      <Link
                        key={sub.name}
                        href={sub.href || "#"}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          isSubActive
                            ? "text-zinc-900 dark:text-white font-bold bg-zinc-100/70 dark:bg-zinc-800/70"
                            : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                        }`}
                      >
                        {sub.icon && <sub.icon size={14} className="text-zinc-400 dark:text-zinc-500 shrink-0" />}
                        <span className="flex-1">{sub.name}</span>
                        {sub.name === "Partner Inquiries" && pendingInquiriesCount > 0 && (
                          <span className="rounded-full bg-amber-500 text-white px-2 py-0.2 text-[10px] font-extrabold shadow-xs">
                            {pendingInquiriesCount}
                          </span>
                        )}
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
