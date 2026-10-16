"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  KnowledgeIcon,
  SupportIcon,
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
  PaymentSettingsIcon,
} from "./icons";

import type { AdminUnreadCounts } from "@/lib/notifications/admin-read-state";

export interface SidebarStaffPermissions {
  canAccessFinance?: boolean;
  canAccessExecutiveKPIs?: boolean;
  canAccessRetail?: boolean;
  canAccessBrand?: boolean;
  canManageStaff?: boolean;
  isSuperAdmin?: boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  pendingInquiriesCount?: number;
  pendingApplicationsCount?: number;
  unreadCounts?: AdminUnreadCounts;
  permissions?: SidebarStaffPermissions;
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
  onClick?: () => void;
}

// Calculate the single best-matching href across all navigation items
function getBestActiveHref(
  items: MenuItem[],
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
): string | null {
  if (!pathname) return null;

  let bestHref: string | null = null;
  let bestScore = -1;

  const evaluateCandidate = (href?: string) => {
    if (!href) return;

    const [targetPath, targetQuery] = href.split("?");
    const targetParams = new URLSearchParams(targetQuery || "");

    const isExactPath = pathname === targetPath;
    const isPrefixPath = pathname.startsWith(targetPath + "/");

    if (!isExactPath && !isPrefixPath) {
      return;
    }

    // Check query params matching
    let queryMatches = true;
    let queryParamCount = 0;
    if (targetQuery) {
      for (const [k, v] of targetParams.entries()) {
        queryParamCount++;
        const currentVal = searchParams?.get(k);
        // Also support alias if k === "type", check "tab" as well
        const aliasVal =
          k === "type"
            ? searchParams?.get("tab")
            : k === "tab"
            ? searchParams?.get("type")
            : null;
        if (!searchParams || (currentVal !== v && aliasVal !== v)) {
          queryMatches = false;
          break;
        }
      }
    }

    if (!queryMatches) return;

    // Specificity score:
    // Base score = targetPath.length
    // Exact path match bonus: +1000
    // Query param match bonus: +5000 per matched query param
    let score = targetPath.length;
    if (isExactPath) score += 1000;
    if (queryParamCount > 0) score += 5000 * queryParamCount;

    if (score > bestScore) {
      bestScore = score;
      bestHref = href;
    }
  };

  for (const item of items) {
    if (item.href) evaluateCandidate(item.href);
    if (item.subItems) {
      for (const sub of item.subItems) {
        if (sub.href) evaluateCandidate(sub.href);
        if (sub.subItems) {
          for (const child of sub.subItems) {
            if (child.href) evaluateCandidate(child.href);
          }
        }
      }
    }
  }

  return bestHref;
}

export default function Sidebar({
  isCollapsed,
  toggleCollapse,
  pendingInquiriesCount = 0,
  pendingApplicationsCount = 0,
  unreadCounts = {
    applications: 0,
    poRequests: 0,
    products: 0,
    supplierInvoices: 0,
    totalPurchasing: 0,
    totalFinance: 0,
    totalProducts: 0,
  },
  permissions,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Section level independent expand states (Brand, Hub, General Operations)
  // Default on login / initial load: Brand & Hub expanded, General Ops collapsed (ADM-NAV-HUB-001-R3)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    brand: true,
    hub: true,
    generalOps: false,
  });

  // Depth 1 menu expand state
  // Default on login / initial load: all menus collapsed (ADM-NAV-HUB-001-R3)
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    "Companies & Brands": false,
    Products: false,
    Purchasing: false,
    Finance: false,
    "Retail Network": false,
    "Sales & Performance": false,
    "Tasks & Communication": false,
    Amazon: false,
    Intelligence: false,
    Settings: false,
  });

  // Depth 2 expand state (for 3-depth items like Intelligence -> Growth Simulator / Insights)
  const [expandedSubMenus, setExpandedSubMenus] = useState<Record<string, boolean>>({
    "Intelligence->Growth Simulator": false,
    "Intelligence->Insights": false,
  });

  // Helper to reset sidebar to default state on Dashboard / logo click (ADM-NAV-HUB-001-R3)
  // Default: K SELECT BRAND & K SELECT HUB expanded, Settings & GENERAL OPERATIONS collapsed, all submenus collapsed
  const resetToDefaultDashboardState = () => {
    setExpandedSections({
      brand: true,
      hub: true,
      generalOps: false,
    });
    setExpandedMenus({
      "Companies & Brands": false,
      Products: false,
      Purchasing: false,
      Finance: false,
      "Retail Network": false,
      "Sales & Performance": false,
      "Tasks & Communication": false,
      Amazon: false,
      Intelligence: false,
      Settings: false,
    });
    setExpandedSubMenus({
      "Intelligence->Growth Simulator": false,
      "Intelligence->Insights": false,
    });
  };

  // Auto-expand parent section and nested submenus matching current route
  useEffect(() => {
    if (!pathname) return;

    // Reset sidebar to default state when on Dashboard (ADM-NAV-HUB-001-R3)
    if (pathname === "/admin") {
      resetToDefaultDashboardState();
      return;
    }

    const queryType =
      searchParams?.get("type") || searchParams?.get("tab") || searchParams?.get("source");

    const isBrandApps = pathname.startsWith("/admin/applications") && queryType !== "retailer";
    const isHubApps = pathname.startsWith("/admin/applications") && queryType === "retailer";

    const isBrandInquiries = pathname.startsWith("/admin/partner-inquiries") && queryType !== "retailer";
    const isHubInquiries = pathname.startsWith("/admin/partner-inquiries") && queryType === "retailer";

    const isCompanies = pathname.startsWith("/admin/companies") || pathname.startsWith("/admin/brands");
    const isTrading = pathname.startsWith("/admin/products/trading");
    const isContent = pathname.startsWith("/admin/products/content");
    const isBrandProducts =
      (pathname.startsWith("/admin/products") || pathname.startsWith("/admin/inventory")) &&
      !isTrading &&
      !isContent;
    const isPurchasing = pathname.startsWith("/admin/purchasing");
    const isReceivables = pathname.startsWith("/admin/finance/receivables");
    const isBrandFinance = pathname.startsWith("/admin/finance") && !isReceivables;
    const isRetailNetwork =
      pathname.startsWith("/admin/retailers") ||
      pathname.startsWith("/admin/stores") ||
      pathname.startsWith("/admin/store-operations") ||
      pathname.startsWith("/admin/protection-reviews");
    const isOrderProcessing = pathname.startsWith("/admin/sales/orders");
    const isSales = pathname.startsWith("/admin/sales") && !isOrderProcessing;
    const isReports = pathname.startsWith("/admin/reports");
    const isTasks = pathname.startsWith("/admin/tasks") || pathname.startsWith("/admin/inquiries");
    const isAmazon = pathname.startsWith("/admin/amazon");
    const isSimulator = pathname.startsWith("/admin/simulator");
    const isInsights = pathname.startsWith("/admin/insights");
    const isIntelligence = isSimulator || isInsights;
    const isSettings =
      pathname.startsWith("/admin/settings") ||
      pathname.startsWith("/admin/knowledge") ||
      pathname.startsWith("/admin/staff");

    // Automatically expand parent section without collapsing other sections
    if (isBrandApps || isCompanies || isBrandProducts || isPurchasing || isBrandFinance || isBrandInquiries) {
      setExpandedSections((prev) => ({ ...prev, brand: true }));
    }
    if (isHubApps || isTrading || isRetailNetwork || isOrderProcessing || isReceivables || isContent || isSales || isHubInquiries) {
      setExpandedSections((prev) => ({ ...prev, hub: true }));
    }
    if (isReports || isTasks || isAmazon || isIntelligence) {
      setExpandedSections((prev) => ({ ...prev, generalOps: true }));
    }

    setExpandedMenus((prev) => ({
      ...prev,
      "Companies & Brands": isCompanies || prev["Companies & Brands"],
      Products: isBrandProducts || prev.Products,
      Purchasing: isPurchasing || prev.Purchasing,
      Finance: isBrandFinance || prev.Finance,
      "Retail Network": isRetailNetwork || prev["Retail Network"],
      "Sales & Performance": isSales || prev["Sales & Performance"],
      "Tasks & Communication": isTasks || prev["Tasks & Communication"],
      Amazon: isAmazon || prev.Amazon,
      Intelligence: isIntelligence || prev.Intelligence,
      Settings: isSettings || prev.Settings,
    }));

    if (isIntelligence) {
      setExpandedSubMenus((prev) => ({
        ...prev,
        "Intelligence->Growth Simulator": isSimulator || prev["Intelligence->Growth Simulator"],
        "Intelligence->Insights": isInsights || prev["Intelligence->Insights"],
      }));
    }
  }, [pathname, searchParams]);

  // Section 0: Dashboard (Top level)
  const dashboardItem: MenuItem = {
    name: "Dashboard",
    icon: DashboardIcon,
    href: "/admin",
    onClick: resetToDefaultDashboardState,
  };

  // Section 1: K SELECT BRAND items
  const rawBrandItems: MenuItem[] = [
    {
      name: "Brand Applications",
      icon: ApplicationsIcon,
      href: "/admin/applications?type=brand",
    },
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
        { name: "Inventory Overview", href: "/admin/inventory" },
        { name: "Compliance", href: "/admin/products/compliance" },
        { name: "Pricing Simulator", href: "/admin/products/pricing-profitability" },
        { name: "Curation", href: "/admin/products/curation" },
      ],
    },
    {
      name: "Purchasing",
      icon: PurchasingIcon,
      subItems: [
        { name: "Order Dashboard", href: "/admin/purchasing/dashboard" },
        { name: "PO Requests", href: "/admin/purchasing/requests" },
        { name: "Purchase Orders", href: "/admin/purchasing/orders" },
        { name: "Landed Cost", href: "/admin/purchasing/landed-cost" },
      ],
    },
    {
      name: "Finance",
      icon: ReportsIcon,
      subItems: [
        { name: "Supplier Invoices", href: "/admin/finance/invoices" },
        { name: "Payments", href: "/admin/finance/payments" },
        { name: "Cost Review (Landed Cost)", href: "/admin/finance/landed-cost" },
      ],
    },
    {
      name: "Brand Inquiries",
      icon: SupportIcon,
      href: "/admin/partner-inquiries?type=brand",
    },
  ];

  // Section 2: K SELECT HUB items
  const rawHubItems: MenuItem[] = [
    {
      name: "Retailer Applications",
      icon: ApplicationsIcon,
      href: "/admin/applications?type=retailer",
    },
    {
      name: "Trading Products",
      icon: ProductsIcon,
      href: "/admin/products/trading",
    },
    {
      name: "Retail Network",
      icon: RetailIcon,
      subItems: [
        { name: "Retailers", href: "/admin/retailers" },
        { name: "Store Operations", href: "/admin/store-operations" },
        { name: "Protection Reviews", href: "/admin/protection-reviews" },
      ],
    },
    {
      name: "Order Processing",
      icon: SalesIcon,
      href: "/admin/sales/orders",
    },
    {
      name: "Invoices & Receivables",
      icon: ReportsIcon,
      href: "/admin/finance/receivables",
    },
    {
      name: "Content & Training",
      icon: KnowledgeIcon,
      href: "/admin/products/content",
    },
    {
      name: "Sales & Performance",
      icon: SalesIcon,
      subItems: [
        { name: "Overview", href: "/admin/sales" },
        { name: "SKU Performance", href: "/admin/sales?tab=sku" },
        { name: "Promotions & Coupons", href: "/admin/sales/promotions" },
      ],
    },
    {
      name: "Retail Inquiries",
      icon: SupportIcon,
      href: "/admin/partner-inquiries?type=retailer",
    },
  ];

  // Section 3: Settings (Independent Top-Level Menu)
  const rawSettingsItem: MenuItem = {
    name: "Settings",
    icon: SettingsIcon,
    subItems: [
      { name: "Users & Permissions", href: "/admin/staff", icon: UsersIcon },
      { name: "Company Configs", href: "/admin/settings/company-configs", icon: CompanyConfigsIcon },
      { name: "Warehouses", href: "/admin/settings/warehouses", icon: WarehousesIcon },
      { name: "Categories", href: "/admin/settings/categories", icon: CategoriesSubIcon },
      { name: "Attribute Profiles", href: "/admin/settings/attribute-profiles", icon: AttributeProfilesIcon },
      { name: "Attributes & Options", href: "/admin/settings/attributes", icon: AttributesOptionsIcon },
      { name: "Curation Settings", href: "/admin/settings/curation", icon: CurationSettingsIcon },
      { name: "Agreement Templates", href: "/admin/settings/agreement-templates", icon: EmailTemplatesIcon },
      { name: "Email Templates", href: "/admin/settings/email-templates", icon: EmailTemplatesIcon },
      { name: "Knowledge Center", href: "/admin/knowledge", icon: KnowledgeSubIcon },
      { name: "Payments", href: "/admin/settings/payments", icon: PaymentSettingsIcon },
    ],
  };

  // Section 4: GENERAL OPERATIONS items
  const rawGeneralOpsItems: MenuItem[] = [
    {
      name: "Reports",
      icon: ReportsIcon,
      href: "/admin/reports",
    },
    {
      name: "Tasks & Communication",
      icon: TasksIcon,
      subItems: [
        { name: "Tasks", href: "/admin/tasks" },
        { name: "Onboarding Leads", href: "/admin/inquiries" },
        { name: "Activity Log", href: "/admin/tasks?tab=activity" },
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
  ];

  // Filter items by staff permissions
  const filterMenuItems = (items: MenuItem[]) => {
    return items.filter((item) => {
      if (!permissions) return true;
      if (permissions.isSuperAdmin) return true;

      if (item.name === "Brand Applications" && permissions.canAccessBrand === false) return false;
      if (item.name === "Retailer Applications" && permissions.canAccessRetail === false) return false;
      if (item.name === "Finance" && permissions.canAccessFinance === false) return false;
      if (item.name === "Invoices & Receivables" && permissions.canAccessFinance === false) return false;
      if (item.name === "Retail Network" && permissions.canAccessRetail === false) return false;
      return true;
    });
  };

  const brandItems = useMemo(() => filterMenuItems(rawBrandItems), [rawBrandItems, permissions]);
  const hubItems = useMemo(() => filterMenuItems(rawHubItems), [rawHubItems, permissions]);
  const generalOpsItems = useMemo(
    () => filterMenuItems(rawGeneralOpsItems),
    [rawGeneralOpsItems, permissions]
  );
  const settingsItem = useMemo(() => {
    let item = { ...rawSettingsItem };
    if (
      item.subItems &&
      permissions &&
      !permissions.isSuperAdmin &&
      permissions.canManageStaff === false
    ) {
      item.subItems = item.subItems.filter((sub) => sub.name !== "Users & Permissions");
    }
    return item;
  }, [rawSettingsItem, permissions]);

  // All active candidate items
  const allItems = useMemo(
    () => [dashboardItem, ...brandItems, ...hubItems, settingsItem, ...generalOpsItems],
    [dashboardItem, brandItems, hubItems, settingsItem, generalOpsItems]
  );

  // Compute the single best-matching active href across all items
  const bestActiveHref = useMemo(
    () => getBestActiveHref(allItems, pathname, searchParams),
    [allItems, pathname, searchParams]
  );

  const handleToggleSection = (sectionKey: string) => {
    if (isCollapsed) {
      toggleCollapse();
    }
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleToggleExpand = (name: string) => {
    if (isCollapsed) {
      toggleCollapse();
    }
    setExpandedMenus((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleToggleSubExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isSubItemActive = (sub: SubItem): boolean => {
    if (sub.href) {
      return sub.href === bestActiveHref;
    }
    if (sub.subItems) {
      return sub.subItems.some((child) => child.href === bestActiveHref);
    }
    return false;
  };

  const isMenuItemActive = (item: MenuItem): boolean => {
    if (item.href) {
      return item.href === bestActiveHref;
    }
    if (item.subItems) {
      return item.subItems.some((sub) => isSubItemActive(sub));
    }
    return false;
  };

  // Badge calculations
  const brandBadgeCount =
    (unreadCounts.applications || 0) +
    (unreadCounts.poRequests || 0) +
    (unreadCounts.supplierInvoices || 0) +
    (pendingInquiriesCount || 0);

  const hubBadgeCount = (unreadCounts.applications || 0) + (pendingInquiriesCount || 0);

  const renderMenuItem = (item: MenuItem) => {
    const isActive = isMenuItemActive(item);
    const hasSubItems = !!item.subItems;
    const isExpanded = expandedMenus[item.name] && !isCollapsed;

    // Parent item unread count badge
    let parentBadgeCount = 0;
    if (item.name === "Brand Applications" || item.name === "Retailer Applications") {
      parentBadgeCount = unreadCounts.applications;
    } else if (item.name === "Products") {
      parentBadgeCount = unreadCounts.products;
    } else if (item.name === "Purchasing") {
      parentBadgeCount = unreadCounts.poRequests;
    } else if (item.name === "Finance") {
      parentBadgeCount = unreadCounts.supplierInvoices;
    } else if (item.name === "Brand Inquiries" || item.name === "Retail Inquiries") {
      parentBadgeCount = pendingInquiriesCount;
    } else if (item.name === "Tasks & Communication") {
      parentBadgeCount = pendingInquiriesCount;
    }

    return (
      <div key={item.name} className="space-y-1">
        {hasSubItems ? (
          <button
            onClick={() => handleToggleExpand(item.name)}
            title={isCollapsed ? item.name : undefined}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative cursor-pointer ${
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="flex-1 text-left">{item.name}</span>}
            {!isCollapsed && parentBadgeCount > 0 && !isExpanded && (
              <span className="mr-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 shadow-xs">
                {parentBadgeCount}
              </span>
            )}
            {isCollapsed && parentBadgeCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-950" />
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
            onClick={item.onClick}
            title={isCollapsed ? item.name : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative ${
              isActive
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white font-semibold"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
            }`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="flex-1">{item.name}</span>}
            {!isCollapsed && parentBadgeCount > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-extrabold shadow-xs">
                {parentBadgeCount}
              </span>
            )}
            {isCollapsed && parentBadgeCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-950" />
            )}
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

              // Subitem unread count
              let subBadgeCount = 0;
              if (sub.name === "PO Requests") {
                subBadgeCount = unreadCounts.poRequests;
              } else if (sub.name === "Product Catalog") {
                subBadgeCount = unreadCounts.products;
              } else if (sub.name === "Supplier Invoices") {
                subBadgeCount = unreadCounts.supplierInvoices;
              }

              if (hasNested) {
                return (
                  <div key={sub.name} className="space-y-1">
                    <button
                      onClick={(e) => handleToggleSubExpand(subKey, e)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
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
                          const isChildActive = child.href === bestActiveHref;

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
                  {subBadgeCount > 0 && (
                    <span className="rounded-full bg-amber-500 text-white px-2 py-0.2 text-[10px] font-extrabold shadow-xs">
                      {subBadgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed top-0 bottom-0 left-0 z-20 flex flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Logo Area */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800 shrink-0">
        {!isCollapsed && (
          <Link
            href="/admin"
            onClick={resetToDefaultDashboardState}
            className="flex items-center gap-2 group cursor-pointer"
            title="K SELECT NETWORK ADMIN — Go to Dashboard"
          >
            <span className="font-sans text-sm font-semibold tracking-wider text-zinc-900 dark:text-white uppercase group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
              K SELECT NETWORK
            </span>
            <span className="rounded bg-zinc-900 px-1 py-0.5 text-[9px] font-medium text-white dark:bg-white dark:text-zinc-950">
              ADMIN
            </span>
          </Link>
        )}
        {isCollapsed && (
          <Link
            href="/admin"
            onClick={resetToDefaultDashboardState}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900 dark:bg-white cursor-pointer hover:opacity-80 transition-opacity"
            title="K SELECT NETWORK ADMIN — Go to Dashboard"
          >
            <span className="text-[10px] font-bold text-white dark:text-zinc-950">KS</span>
          </Link>
        )}
      </div>

      {/* Navigation Scroll Container */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 select-none scrollbar-thin">
        {/* Top: Dashboard */}
        {renderMenuItem(dashboardItem)}

        {/* ------------------------------------------------------------- */}
        {/* Section 1: K SELECT BRAND                                     */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-2">
          <div className="mb-2 border-t border-zinc-200 dark:border-zinc-800/80" />
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => handleToggleSection("brand")}
              className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold tracking-wider uppercase rounded-md text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors group cursor-pointer"
              title="Toggle K SELECT BRAND section"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden bg-black shadow-2xs">
                  <img
                    src="/symbol-Cyan-Hotpink.png"
                    alt="K SELECT BRAND"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="truncate text-zinc-900 dark:text-zinc-100 font-extrabold tracking-wider">
                  K SELECT BRAND
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!expandedSections.brand && brandBadgeCount > 0 && (
                  <span className="rounded-full bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 shadow-xs">
                    {brandBadgeCount}
                  </span>
                )}
                {expandedSections.brand ? (
                  <ChevronDownIcon size={14} className="text-zinc-400 dark:text-zinc-500" />
                ) : (
                  <ChevronRightIcon size={14} className="text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
            </button>
          ) : (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={toggleCollapse}
                title="K SELECT BRAND"
                className="w-8 h-8 rounded-md flex items-center justify-center bg-black hover:opacity-80 transition-opacity"
              >
                <img
                  src="/symbol-Cyan-Hotpink.png"
                  alt="K SELECT BRAND"
                  className="w-5 h-5 object-contain"
                />
              </button>
            </div>
          )}

          {/* Brand Items (when expanded or collapsed sidebar) */}
          {(expandedSections.brand || isCollapsed) && (
            <div className="space-y-1 mt-1">{brandItems.map(renderMenuItem)}</div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Section 2: K SELECT HUB                                       */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-2">
          <div className="mb-2 border-t border-zinc-200 dark:border-zinc-800/80" />
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => handleToggleSection("hub")}
              className="flex w-full items-center justify-between px-3 py-2 text-[11px] font-bold tracking-wider uppercase rounded-md text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors group cursor-pointer"
              title="Toggle K SELECT HUB section"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden bg-zinc-900/10 dark:bg-black/60 shadow-2xs">
                  <img
                    src="/symbol-Hotpink-Cyan.png"
                    alt="K SELECT HUB"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="truncate text-zinc-900 dark:text-zinc-100 font-extrabold tracking-wider">
                  K SELECT HUB
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!expandedSections.hub && hubBadgeCount > 0 && (
                  <span className="rounded-full bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 shadow-xs">
                    {hubBadgeCount}
                  </span>
                )}
                {expandedSections.hub ? (
                  <ChevronDownIcon size={14} className="text-zinc-400 dark:text-zinc-500" />
                ) : (
                  <ChevronRightIcon size={14} className="text-zinc-400 dark:text-zinc-500" />
                )}
              </div>
            </button>
          ) : (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={toggleCollapse}
                title="K SELECT HUB"
                className="w-8 h-8 rounded-md flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:opacity-80 transition-opacity"
              >
                <img
                  src="/symbol-Hotpink-Cyan.png"
                  alt="K SELECT HUB"
                  className="w-5 h-5 object-contain"
                />
              </button>
            </div>
          )}

          {/* Hub Items (when expanded or collapsed sidebar) */}
          {(expandedSections.hub || isCollapsed) && (
            <div className="space-y-1 mt-1">{hubItems.map(renderMenuItem)}</div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Settings: Independent Top-Level Menu                          */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-2">
          <div className="mb-2 border-t border-zinc-200 dark:border-zinc-800/80" />
          {renderMenuItem(settingsItem)}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Section 3: GENERAL OPERATIONS                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-2">
          <div className="mb-2 border-t border-zinc-200 dark:border-zinc-800/80" />
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => handleToggleSection("generalOps")}
              className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded-md text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100/40 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
              title="Toggle GENERAL OPERATIONS section"
            >
              <span className="truncate font-bold tracking-wider">
                GENERAL OPERATIONS
              </span>
              {expandedSections.generalOps ? (
                <ChevronDownIcon size={12} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              ) : (
                <ChevronRightIcon size={12} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              )}
            </button>
          ) : (
            <div className="my-2 border-t border-zinc-200 dark:border-zinc-800/80 mx-2" />
          )}

          {/* General Operations Items */}
          {(expandedSections.generalOps || isCollapsed) && (
            <div className="space-y-1 mt-1">{generalOpsItems.map(renderMenuItem)}</div>
          )}
        </div>
      </nav>

      {/* Footer / Collapse Button */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800 shrink-0">
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white cursor-pointer"
        >
          {isCollapsed ? "→" : "← Collapse Sidebar"}
        </button>
      </div>
    </aside>
  );
}
