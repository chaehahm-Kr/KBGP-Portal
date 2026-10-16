"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type {
  AdminStoreOperationItem,
  AdminStoreOperationsData,
  AdminStoreInventoryItem,
  AdminStoreInventoryOverview,
  AdminStoreOrderItem,
  AdminStoreOrdersOverview,
  AdminStoreStaffItem,
  AdminStoreTrainingProductItem,
  AdminStoreTrainingOverview,
  AdminStorePerformanceSkuItem,
  AdminStorePerformanceOverview,
  StorePerformanceStatus,
  AdminStoreFixtureItem,
  AdminStoreFixturesOverview,
  AdminStoreFixturePlacementItem,
  StoreAssortmentProductItem,
  PlacementStatus,
  formatPlacementStatus,
  FixtureType,
  FixtureInstallationStatus,
  FixtureOperationalStatus,
  formatFixtureType,
  formatInstallationStatus,
  formatOperationalStatus,
} from "@/lib/retailer/admin-store-operations";
import {
  registerStoreFixtureAction,
  updateStoreFixtureAction,
  assignStoreFixturePlacementAction,
  updateStoreFixturePlacementAction,
  unassignStoreFixturePlacementAction,
} from "@/lib/retailer/admin-fixture-actions";

interface StoreOperationsViewProps {
  data: AdminStoreOperationsData;
}

type DetailTabKey =
  | "overview"
  | "inventory"
  | "orders"
  | "sales"
  | "training"
  | "fixtures"
  | "activities";

interface TabDefinition {
  key: DetailTabKey;
  label: string;
  badge?: string;
  phaseLabel: string;
}

const DETAIL_TABS: TabDefinition[] = [
  { key: "overview", label: "Overview", phaseLabel: "Phase 1 (Active)" },
  { key: "inventory", label: "Inventory & Reorder", phaseLabel: "Phase 2 (Active)" },
  { key: "orders", label: "Orders & Deliveries", phaseLabel: "Phase 2 (Active)" },
  { key: "sales", label: "Sales & Performance", phaseLabel: "Phase 2 (Active)" },
  { key: "training", label: "Staff & Training", phaseLabel: "Phase 2 (Active)" },
  { key: "fixtures", label: "Fixtures & Placements", phaseLabel: "Phase 3 (Active)" },
  { key: "activities", label: "Store Activities", badge: "Future", phaseLabel: "Future Phase (Planned)" },
];

function formatOrderCurrency(amount: number): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatOrderDateTime(dateStr?: string | null): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return dateStr;
  }
}

function getOrderStatusBadgeClasses(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "submitted":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300";
    case "confirmed":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300";
    case "processing":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300";
    case "partially_shipped":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300";
    case "shipped":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300";
    case "delivered":
      return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800 dark:text-teal-300";
    case "cancelled":
    case "partially_cancelled":
      return "bg-zinc-100 text-zinc-500 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300";
  }
}

function formatOrderStatusName(status: string): string {
  const s = status.toLowerCase();
  switch (s) {
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    case "processing":
      return "Processing";
    case "partially_shipped":
      return "Partially Shipped";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    case "partially_cancelled":
      return "Partially Cancelled";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function StoreOperationsView({ data }: StoreOperationsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [retailerFilter, setRetailerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Selected Store ID from URL or local state
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(() => searchParams?.get("storeId") || null);
  const activeTabParam = (searchParams?.get("tab") as DetailTabKey) || "overview";
  const [activeTab, setActiveTab] = useState<DetailTabKey>(activeTabParam);

  useEffect(() => {
    setSelectedStoreId(searchParams?.get("storeId") || null);
  }, [searchParams]);

  useEffect(() => {
    if (activeTabParam && DETAIL_TABS.some((t) => t.key === activeTabParam)) {
      setActiveTab(activeTabParam);
    }
  }, [activeTabParam]);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return data.stores.find((s) => s.id === selectedStoreId) || null;
  }, [selectedStoreId, data.stores]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setActiveTab("overview");
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("storeId", storeId);
    params.set("tab", "overview");
    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", newUrl);
    }
  };

  const handleBackToList = () => {
    setSelectedStoreId(null);
    router.push(pathname);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", pathname);
    }
  };

  const handleTabChange = (tabKey: DetailTabKey) => {
    setActiveTab(tabKey);
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (selectedStoreId) {
      params.set("storeId", selectedStoreId);
    }
    params.set("tab", tabKey);
    const newUrl = `${pathname}?${params.toString()}`;
    router.push(newUrl);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", newUrl);
    }
  };

  // Inventory Tab Search, Filter and Sort States
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"ALL" | "REPORTED" | "NOT_REPORTED" | "REORDER_ATTENTION">("ALL");
  const [inventorySort, setInventorySort] = useState<"REORDER_FIRST" | "STOCK_DESC" | "STOCK_ASC" | "NAME_ASC" | "NAME_DESC" | "DATE_DESC">("REORDER_FIRST");

  const storeInventory = useMemo<AdminStoreInventoryOverview | null>(() => {
    if (!selectedStoreId || !data.storeInventoryMap) return null;
    return data.storeInventoryMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeInventoryMap]);

  const filteredInventoryItems = useMemo<AdminStoreInventoryItem[]>(() => {
    if (!storeInventory?.items) return [];
    let items = [...storeInventory.items];

    // Search filter
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase().trim();
      items = items.filter(
        (it) =>
          it.productName.toLowerCase().includes(q) ||
          it.brandName.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (inventoryFilter === "REPORTED") {
      items = items.filter((it) => it.reportedRemaining !== null);
    } else if (inventoryFilter === "NOT_REPORTED") {
      items = items.filter((it) => it.reportedRemaining === null);
    } else if (inventoryFilter === "REORDER_ATTENTION") {
      items = items.filter((it) => it.reorderNeeded);
    }

    // Sort
    items.sort((a, b) => {
      switch (inventorySort) {
        case "REORDER_FIRST": {
          if (a.reorderNeeded !== b.reorderNeeded) {
            return a.reorderNeeded ? -1 : 1;
          }
          if (b.suggestedReorderQty !== a.suggestedReorderQty) {
            return b.suggestedReorderQty - a.suggestedReorderQty;
          }
          return a.productName.localeCompare(b.productName);
        }
        case "STOCK_DESC": {
          const valA = a.reportedRemaining ?? -1;
          const valB = b.reportedRemaining ?? -1;
          return valB - valA;
        }
        case "STOCK_ASC": {
          const valA = a.reportedRemaining ?? 999999;
          const valB = b.reportedRemaining ?? 999999;
          return valA - valB;
        }
        case "NAME_ASC":
          return a.productName.localeCompare(b.productName);
        case "NAME_DESC":
          return b.productName.localeCompare(a.productName);
        case "DATE_DESC": {
          const dateA = a.reportingDate || "";
          const dateB = b.reportingDate || "";
          return dateB.localeCompare(dateA);
        }
        default:
          return 0;
      }
    });

    return items;
  }, [storeInventory, inventorySearch, inventoryFilter, inventorySort]);

  // Orders Tab Search, Filter and Sort States
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSort, setOrderSort] = useState<"DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC" | "UNITS_DESC">("DATE_DESC");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const storeOrders = useMemo<AdminStoreOrdersOverview | null>(() => {
    if (!selectedStoreId || !data.storeOrdersMap) return null;
    return data.storeOrdersMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeOrdersMap]);

  const filteredStoreOrders = useMemo<AdminStoreOrderItem[]>(() => {
    if (!storeOrders?.orders) return [];
    let orders = [...storeOrders.orders];

    // Search filter
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase().trim();
      orders = orders.filter((o) => {
        const matchNumber = o.orderNumber.toLowerCase().includes(q);
        const matchTracking = o.fulfillments.some((f) =>
          (f.trackingNumber && f.trackingNumber.toLowerCase().includes(q)) ||
          (f.carrier && f.carrier.toLowerCase().includes(q)) ||
          f.boxes.some((b) => b.trackingNumber && b.trackingNumber.toLowerCase().includes(q))
        );
        const matchItem = o.items.some((it) =>
          it.productName.toLowerCase().includes(q) ||
          it.sku.toLowerCase().includes(q) ||
          (it.brandName && it.brandName.toLowerCase().includes(q))
        );
        return matchNumber || matchTracking || matchItem;
      });
    }

    // Status filter
    if (orderStatusFilter !== "ALL") {
      orders = orders.filter((o) => o.orderStatus.toLowerCase() === orderStatusFilter.toLowerCase());
    }

    // Sort
    orders.sort((a, b) => {
      switch (orderSort) {
        case "DATE_DESC":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "DATE_ASC":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "AMOUNT_DESC":
          return b.totalAmount - a.totalAmount;
        case "AMOUNT_ASC":
          return a.totalAmount - b.totalAmount;
        case "UNITS_DESC":
          return b.totalOrderedUnits - a.totalOrderedUnits;
        default:
          return 0;
      }
    });

    return orders;
  }, [storeOrders, orderSearch, orderStatusFilter, orderSort]);

  // Staff & Training Tab Search, Filter and Sort States
  const [staffSearch, setStaffSearch] = useState("");
  const [staffExpandedUserId, setStaffExpandedUserId] = useState<string | null>(null);
  const [trainingProductSearch, setTrainingProductSearch] = useState("");
  const [trainingProductFilter, setTrainingProductFilter] = useState<"ALL" | "GAPS_ONLY" | "COVERED_ONLY" | "UNAVAILABLE">("ALL");
  const [trainingProductSort, setTrainingProductSort] = useState<"STATUS_FIRST" | "NAME_ASC" | "BRAND_ASC" | "STAFF_DESC">("STATUS_FIRST");

  const storeTraining = useMemo<AdminStoreTrainingOverview | null>(() => {
    if (!selectedStoreId || !data.storeTrainingMap) return null;
    return data.storeTrainingMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeTrainingMap]);

  const filteredStaff = useMemo<AdminStoreStaffItem[]>(() => {
    if (!storeTraining?.staff) return [];
    let staff = [...storeTraining.staff];
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase().trim();
      staff = staff.filter(
        (s) =>
          s.userName.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.role.toLowerCase().includes(q)
      );
    }
    return staff;
  }, [storeTraining, staffSearch]);

  const filteredTrainingProducts = useMemo<AdminStoreTrainingProductItem[]>(() => {
    if (!storeTraining?.products) return [];
    let prods = [...storeTraining.products];

    // Search filter
    if (trainingProductSearch.trim()) {
      const q = trainingProductSearch.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (trainingProductFilter === "GAPS_ONLY") {
      prods = prods.filter((p) => p.coverageStatus === "needs_training");
    } else if (trainingProductFilter === "COVERED_ONLY") {
      prods = prods.filter((p) => p.coverageStatus === "covered");
    } else if (trainingProductFilter === "UNAVAILABLE") {
      prods = prods.filter((p) => p.trainingStatus !== "published");
    }

    // Sort
    prods.sort((a, b) => {
      switch (trainingProductSort) {
        case "STATUS_FIRST": {
          const getScore = (p: AdminStoreTrainingProductItem) => {
            if (p.coverageStatus === "needs_training") return 0; // Gaps first
            if (p.coverageStatus === "covered") return 1; // Covered
            return 2; // Unavailable
          };
          const scoreDiff = getScore(a) - getScore(b);
          if (scoreDiff !== 0) return scoreDiff;
          return a.productName.localeCompare(b.productName);
        }
        case "NAME_ASC":
          return a.productName.localeCompare(b.productName);
        case "BRAND_ASC":
          return a.brandName.localeCompare(b.brandName);
        case "STAFF_DESC":
          return b.qualifiedEmployees.length - a.qualifiedEmployees.length;
        default:
          return 0;
      }
    });

    return prods;
  }, [storeTraining, trainingProductSearch, trainingProductFilter, trainingProductSort]);

  // Sales & Performance Tab Search, Filter and Sort States (ADM-STORE-OPS-P2-004)
  const [salesSearch, setSalesSearch] = useState("");
  const [salesRiskFilter, setSalesRiskFilter] = useState<string>("ALL");
  const [salesSort, setSalesSort] = useState<"RISK_FIRST" | "VELOCITY_DESC" | "STOCK_DESC" | "NAME_ASC">("RISK_FIRST");

  const storePerformance = useMemo<AdminStorePerformanceOverview | null>(() => {
    if (!selectedStoreId || !data.storePerformanceMap) return null;
    return data.storePerformanceMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storePerformanceMap]);

  const filteredPerformanceProducts = useMemo<AdminStorePerformanceSkuItem[]>(() => {
    if (!storePerformance?.products) return [];
    let prods = [...storePerformance.products];

    // Search filter
    if (salesSearch.trim()) {
      const q = salesSearch.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Risk / Status filter
    if (salesRiskFilter !== "ALL") {
      prods = prods.filter((p) => p.stockRisk === salesRiskFilter);
    }

    // Sort
    prods.sort((a, b) => {
      switch (salesSort) {
        case "RISK_FIRST": {
          const getRiskScore = (risk: string) => {
            if (risk === "stockout") return 0;
            if (risk === "low_stock") return 1;
            if (risk === "unreported") return 2;
            if (risk === "overstock") return 3;
            if (risk === "sufficient") return 4;
            return 5;
          };
          const scoreDiff = getRiskScore(a.stockRisk) - getRiskScore(b.stockRisk);
          if (scoreDiff !== 0) return scoreDiff;
          return a.productName.localeCompare(b.productName);
        }
        case "VELOCITY_DESC": {
          const vA = a.estimatedWeeklyVelocity ?? -1;
          const vB = b.estimatedWeeklyVelocity ?? -1;
          if (vA !== vB) return vB - vA;
          return a.productName.localeCompare(b.productName);
        }
        case "STOCK_DESC": {
          const sA = a.latestReportedStock ?? -1;
          const sB = b.latestReportedStock ?? -1;
          if (sA !== sB) return sB - sA;
          return a.productName.localeCompare(b.productName);
        }
        case "NAME_ASC":
          return a.productName.localeCompare(b.productName);
        default:
          return 0;
      }
    });

    return prods;
  }, [storePerformance, salesSearch, salesRiskFilter, salesSort]);

  // Fixtures & Placements Tab Search, Filter, Sort and Form States (ADM-STORE-OPS-P3-002)
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [fixtureTypeFilter, setFixtureTypeFilter] = useState<string>("ALL");
  const [fixtureStatusFilter, setFixtureStatusFilter] = useState<string>("ALL");
  const [fixtureSort, setFixtureSort] = useState<"CODE_ASC" | "NAME_ASC" | "STATUS_FIRST" | "BAYS_DESC">("CODE_ASC");

  // Fixture Modals & Detail Drawers
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
  const [fixtureModalMode, setFixtureModalMode] = useState<"register" | "edit">("register");
  const [editingFixture, setEditingFixture] = useState<AdminStoreFixtureItem | null>(null);
  const [detailFixture, setDetailFixture] = useState<AdminStoreFixtureItem | null>(null);

  // Fixture Form Fields
  const [formFixtureCode, setFormFixtureCode] = useState("");
  const [formFixtureName, setFormFixtureName] = useState("");
  const [formFixtureType, setFormFixtureType] = useState<FixtureType>("wall_4ft");
  const [formBayCount, setFormBayCount] = useState<number>(1);
  const [formShelfCount, setFormShelfCount] = useState<number>(5);
  const [formHasHeaderSignage, setFormHasHeaderSignage] = useState<boolean>(true);
  const [formInStoreLocation, setFormInStoreLocation] = useState("");
  const [formInstallationStatus, setFormInstallationStatus] = useState<FixtureInstallationStatus>("planned");
  const [formOperationalStatus, setFormOperationalStatus] = useState<FixtureOperationalStatus>("active");
  const [formInstallationDate, setFormInstallationDate] = useState("");
  const [formInstalledBy, setFormInstalledBy] = useState("");
  const [formPrimaryPhotoUrl, setFormPrimaryPhotoUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Placement Management States (ADM-STORE-OPS-P3-003)
  const [expandedFixturePlacements, setExpandedFixturePlacements] = useState<Record<string, boolean>>({});
  const [selectedBayByFixture, setSelectedBayByFixture] = useState<Record<string, number>>({});

  // Placement Modal State
  const [isPlacementModalOpen, setIsPlacementModalOpen] = useState(false);
  const [placementModalMode, setPlacementModalMode] = useState<"assign" | "edit">("assign");
  const [targetFixtureForPlacement, setTargetFixtureForPlacement] = useState<AdminStoreFixtureItem | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<AdminStoreFixturePlacementItem | null>(null);

  // Placement Form Fields
  const [placementBayNumber, setPlacementBayNumber] = useState<number>(1);
  const [placementShelfLevel, setPlacementShelfLevel] = useState<number>(1);
  const [placementPositionSlot, setPlacementPositionSlot] = useState<number>(1);
  const [placementProductId, setPlacementProductId] = useState<string>("");
  const [placementProductSearch, setPlacementProductSearch] = useState<string>("");
  const [placementFacingCount, setPlacementFacingCount] = useState<number>(1);
  const [placementCapacityUnits, setPlacementCapacityUnits] = useState<number>(6);
  const [placementStatus, setPlacementStatus] = useState<"active" | "planned" | "clearance">("active");
  const [placementNotes, setPlacementNotes] = useState<string>("");
  const [placementFormError, setPlacementFormError] = useState<string | null>(null);
  const [placementSubmitting, setPlacementSubmitting] = useState(false);

  // Unassign Confirm Modal State
  const [unassignTarget, setUnassignTarget] = useState<{
    placement: AdminStoreFixturePlacementItem;
    fixture: AdminStoreFixtureItem;
  } | null>(null);
  const [unassignSubmitting, setUnassignSubmitting] = useState(false);

  const storeFixtures = useMemo<AdminStoreFixturesOverview | null>(() => {
    if (!selectedStoreId || !data.storeFixturesMap) return null;
    return data.storeFixturesMap[selectedStoreId] || null;
  }, [selectedStoreId, data.storeFixturesMap]);

  const filteredAssortmentProducts = useMemo(() => {
    const list = storeFixtures?.eligibleProducts || [];
    if (!placementProductSearch.trim()) return list;
    const q = placementProductSearch.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brandName && p.brandName.toLowerCase().includes(q))
    );
  }, [storeFixtures?.eligibleProducts, placementProductSearch]);

  const filteredFixtures = useMemo<AdminStoreFixtureItem[]>(() => {
    if (!storeFixtures?.fixtures) return [];
    let list = [...storeFixtures.fixtures];

    // Search filter
    if (fixtureSearch.trim()) {
      const q = fixtureSearch.toLowerCase().trim();
      list = list.filter(
        (f) =>
          f.fixtureCode.toLowerCase().includes(q) ||
          f.fixtureName.toLowerCase().includes(q) ||
          (f.inStoreLocation && f.inStoreLocation.toLowerCase().includes(q)) ||
          f.fixtureTypeLabel.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (fixtureTypeFilter !== "ALL") {
      list = list.filter((f) => f.fixtureType === fixtureTypeFilter);
    }

    // Status filter
    if (fixtureStatusFilter !== "ALL") {
      list = list.filter(
        (f) =>
          f.operationalStatus === fixtureStatusFilter ||
          f.installationStatus === fixtureStatusFilter
      );
    }

    // Sort
    list.sort((a, b) => {
      switch (fixtureSort) {
        case "CODE_ASC":
          return a.fixtureCode.localeCompare(b.fixtureCode);
        case "NAME_ASC":
          return a.fixtureName.localeCompare(b.fixtureName);
        case "STATUS_FIRST": {
          const getStatusScore = (f: AdminStoreFixtureItem) => {
            if (f.operationalStatus === "damaged") return 0;
            if (f.operationalStatus === "needs_maintenance") return 1;
            if (f.installationStatus === "planned") return 2;
            if (f.installationStatus === "shipped") return 3;
            if (f.installationStatus === "installed") return 4;
            return 5;
          };
          const scoreDiff = getStatusScore(a) - getStatusScore(b);
          if (scoreDiff !== 0) return scoreDiff;
          return a.fixtureCode.localeCompare(b.fixtureCode);
        }
        case "BAYS_DESC":
          return b.bayCount - a.bayCount;
        default:
          return 0;
      }
    });

    return list;
  }, [storeFixtures, fixtureSearch, fixtureTypeFilter, fixtureStatusFilter, fixtureSort]);

  const handleOpenRegisterModal = () => {
    setFixtureModalMode("register");
    setEditingFixture(null);
    setFormFixtureCode("");
    setFormFixtureName("");
    setFormFixtureType("wall_4ft");
    setFormBayCount(1);
    setFormShelfCount(5);
    setFormHasHeaderSignage(true);
    setFormInStoreLocation("");
    setFormInstallationStatus("planned");
    setFormOperationalStatus("active");
    setFormInstallationDate("");
    setFormInstalledBy("");
    setFormPrimaryPhotoUrl("");
    setFormNotes("");
    setFormError(null);
    setIsFixtureModalOpen(true);
  };

  const handleOpenEditModal = (fixture: AdminStoreFixtureItem) => {
    setFixtureModalMode("edit");
    setEditingFixture(fixture);
    setFormFixtureCode(fixture.fixtureCode);
    setFormFixtureName(fixture.fixtureName);
    setFormFixtureType(fixture.fixtureType);
    setFormBayCount(fixture.bayCount);
    setFormShelfCount(fixture.shelfCount);
    setFormHasHeaderSignage(fixture.hasHeaderSignage);
    setFormInStoreLocation(fixture.inStoreLocation || "");
    setFormInstallationStatus(fixture.installationStatus);
    setFormOperationalStatus(fixture.operationalStatus);
    setFormInstallationDate(fixture.installationDate || "");
    setFormInstalledBy(fixture.installedBy || "");
    setFormPrimaryPhotoUrl(fixture.primaryPhotoUrl || "");
    setFormNotes(fixture.notes || "");
    setFormError(null);
    setIsFixtureModalOpen(true);
  };

  const handleFormTypeChange = (type: FixtureType) => {
    setFormFixtureType(type);
    if (fixtureModalMode === "register") {
      if (type === "wall_4ft") setFormBayCount(1);
      else if (type === "wall_8ft") setFormBayCount(2);
      else if (type === "wall_12ft") setFormBayCount(3);
      else if (type === "endcap_3ft") setFormBayCount(1);
      else if (type === "countertop") setFormBayCount(1);
    }
  };

  const handleSaveFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) return;
    setFormError(null);

    if (!formFixtureCode.trim()) {
      setFormError("Fixture Code is required.");
      return;
    }
    if (!formFixtureName.trim()) {
      setFormError("Fixture Name is required.");
      return;
    }
    if (formBayCount < 1 || formBayCount > 6) {
      setFormError("Bay count must be between 1 and 6.");
      return;
    }
    if (formShelfCount < 1 || formShelfCount > 15) {
      setFormError("Shelf count must be between 1 and 15.");
      return;
    }

    setFormSubmitting(true);
    try {
      if (fixtureModalMode === "register") {
        const res = await registerStoreFixtureAction({
          storeId: selectedStore.id,
          fixtureCode: formFixtureCode.trim(),
          fixtureName: formFixtureName.trim(),
          fixtureType: formFixtureType,
          bayCount: formBayCount,
          shelfCount: formShelfCount,
          hasHeaderSignage: formHasHeaderSignage,
          inStoreLocation: formInStoreLocation.trim() || null,
          installationStatus: formInstallationStatus,
          operationalStatus: formOperationalStatus,
          installationDate: formInstallationDate.trim() || null,
          installedBy: formInstalledBy.trim() || null,
          primaryPhotoUrl: formPrimaryPhotoUrl.trim() || null,
          notes: formNotes.trim() || null,
        });

        if (!res.success) {
          setFormError(res.error || "Failed to register fixture.");
          setFormSubmitting(false);
          return;
        }

        setIsFixtureModalOpen(false);
        router.refresh();
      } else if (editingFixture) {
        const res = await updateStoreFixtureAction({
          fixtureId: editingFixture.id,
          fixtureCode: formFixtureCode.trim(),
          fixtureName: formFixtureName.trim(),
          fixtureType: formFixtureType,
          bayCount: formBayCount,
          shelfCount: formShelfCount,
          hasHeaderSignage: formHasHeaderSignage,
          inStoreLocation: formInStoreLocation.trim() || null,
          installationStatus: formInstallationStatus,
          operationalStatus: formOperationalStatus,
          installationDate: formInstallationDate.trim() || null,
          installedBy: formInstalledBy.trim() || null,
          primaryPhotoUrl: formPrimaryPhotoUrl.trim() || null,
          notes: formNotes.trim() || null,
        });

        if (!res.success) {
          setFormError(res.error || "Failed to update fixture.");
          setFormSubmitting(false);
          return;
        }

        setIsFixtureModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setFormError(err?.message || "An unexpected error occurred while saving fixture.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Placement Management Handlers (ADM-STORE-OPS-P3-003)
  const handleToggleFixturePlacements = (fixtureId: string) => {
    setExpandedFixturePlacements((prev) => ({
      ...prev,
      [fixtureId]: !prev[fixtureId],
    }));
    if (!selectedBayByFixture[fixtureId]) {
      setSelectedBayByFixture((prev) => ({ ...prev, [fixtureId]: 1 }));
    }
  };

  const handleSelectBay = (fixtureId: string, bayNumber: number) => {
    setSelectedBayByFixture((prev) => ({ ...prev, [fixtureId]: bayNumber }));
  };

  const handleOpenAssignPlacementModal = (
    fixture: AdminStoreFixtureItem,
    defaultBay?: number,
    defaultShelf?: number,
    defaultSlot?: number
  ) => {
    setTargetFixtureForPlacement(fixture);
    setPlacementModalMode("assign");
    setEditingPlacement(null);

    const bay = defaultBay || selectedBayByFixture[fixture.id] || 1;
    const shelf = defaultShelf || 1;

    // Calculate next available position slot for this bay & shelf
    let slot = defaultSlot || 1;
    if (!defaultSlot && fixture.placements) {
      const occupiedSlots = new Set(
        fixture.placements
          .filter((p) => p.bayNumber === bay && p.shelfLevel === shelf && p.placementStatus !== "removed")
          .map((p) => p.positionSlot)
      );
      for (let s = 1; s <= 25; s++) {
        if (!occupiedSlots.has(s)) {
          slot = s;
          break;
        }
      }
    }

    setPlacementBayNumber(bay);
    setPlacementShelfLevel(shelf);
    setPlacementPositionSlot(slot);
    setPlacementProductId(storeFixtures?.eligibleProducts?.[0]?.id || "");
    setPlacementProductSearch("");
    setPlacementFacingCount(1);
    setPlacementCapacityUnits(6);
    setPlacementStatus("active");
    setPlacementNotes("");
    setPlacementFormError(null);
    setIsPlacementModalOpen(true);
  };

  const handleOpenEditPlacementModal = (
    fixture: AdminStoreFixtureItem,
    placement: AdminStoreFixturePlacementItem
  ) => {
    setTargetFixtureForPlacement(fixture);
    setPlacementModalMode("edit");
    setEditingPlacement(placement);
    setPlacementBayNumber(placement.bayNumber);
    setPlacementShelfLevel(placement.shelfLevel);
    setPlacementPositionSlot(placement.positionSlot);
    setPlacementProductId(placement.productId);
    setPlacementProductSearch("");
    setPlacementFacingCount(placement.facingCount);
    setPlacementCapacityUnits(placement.capacityUnits);
    setPlacementStatus(
      placement.placementStatus === "removed"
        ? "active"
        : (placement.placementStatus as "active" | "planned" | "clearance")
    );
    setPlacementNotes(placement.notes || "");
    setPlacementFormError(null);
    setIsPlacementModalOpen(true);
  };

  const handleSavePlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !targetFixtureForPlacement) return;
    setPlacementFormError(null);

    if (!placementProductId) {
      setPlacementFormError("Please select a product carried in this store's assortment.");
      return;
    }

    const bayCountLimit = targetFixtureForPlacement.bayCount || 1;
    if (placementBayNumber < 1 || placementBayNumber > bayCountLimit) {
      setPlacementFormError(`Bay number must be between 1 and ${bayCountLimit}.`);
      return;
    }

    const shelfCountLimit = targetFixtureForPlacement.shelfCount || 5;
    if (placementShelfLevel < 1 || placementShelfLevel > shelfCountLimit) {
      setPlacementFormError(`Shelf level must be between 1 and ${shelfCountLimit}.`);
      return;
    }

    if (placementPositionSlot < 1 || placementPositionSlot > 25) {
      setPlacementFormError("Position slot must be between 1 and 25.");
      return;
    }

    if (placementFacingCount < 1 || placementFacingCount > 10) {
      setPlacementFormError("Facing count must be between 1 and 10.");
      return;
    }

    if (placementCapacityUnits < 0 || placementCapacityUnits > 200) {
      setPlacementFormError("Capacity units must be between 0 and 200.");
      return;
    }

    setPlacementSubmitting(true);
    try {
      if (placementModalMode === "assign") {
        const res = await assignStoreFixturePlacementAction({
          fixtureId: targetFixtureForPlacement.id,
          storeId: selectedStore.id,
          productId: placementProductId,
          bayNumber: placementBayNumber,
          shelfLevel: placementShelfLevel,
          positionSlot: placementPositionSlot,
          facingCount: placementFacingCount,
          capacityUnits: placementCapacityUnits,
          placementStatus,
          notes: placementNotes.trim() || null,
        });

        if (!res.success) {
          setPlacementFormError(res.error || "Failed to assign placement.");
          setPlacementSubmitting(false);
          return;
        }

        setIsPlacementModalOpen(false);
        // Ensure this fixture is expanded
        setExpandedFixturePlacements((prev) => ({ ...prev, [targetFixtureForPlacement.id]: true }));
        setSelectedBayByFixture((prev) => ({ ...prev, [targetFixtureForPlacement.id]: placementBayNumber }));
        router.refresh();
      } else if (editingPlacement) {
        const res = await updateStoreFixturePlacementAction({
          placementId: editingPlacement.id,
          fixtureId: targetFixtureForPlacement.id,
          storeId: selectedStore.id,
          productId: placementProductId,
          bayNumber: placementBayNumber,
          shelfLevel: placementShelfLevel,
          positionSlot: placementPositionSlot,
          facingCount: placementFacingCount,
          capacityUnits: placementCapacityUnits,
          placementStatus,
          notes: placementNotes.trim() || null,
        });

        if (!res.success) {
          setPlacementFormError(res.error || "Failed to update placement.");
          setPlacementSubmitting(false);
          return;
        }

        setIsPlacementModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setPlacementFormError(err?.message || "An unexpected error occurred while saving placement.");
    } finally {
      setPlacementSubmitting(false);
    }
  };

  const handleOpenUnassignConfirm = (
    fixture: AdminStoreFixtureItem,
    placement: AdminStoreFixturePlacementItem
  ) => {
    setUnassignTarget({ fixture, placement });
  };

  const handleExecuteUnassign = async () => {
    if (!unassignTarget || !selectedStore) return;
    setUnassignSubmitting(true);
    try {
      const res = await unassignStoreFixturePlacementAction({
        placementId: unassignTarget.placement.id,
        fixtureId: unassignTarget.fixture.id,
        storeId: selectedStore.id,
      });

      if (!res.success) {
        alert(res.error || "Failed to unassign placement.");
        setUnassignSubmitting(false);
        return;
      }

      setUnassignTarget(null);
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "An error occurred while unassigning placement.");
    } finally {
      setUnassignSubmitting(false);
    }
  };

  // Filtered stores for list
  const filteredStores = useMemo(() => {
    return data.stores.filter((store) => {
      // 1. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = store.name.toLowerCase().includes(q);
        const matchRetailer = store.companyName.toLowerCase().includes(q);
        const matchCode = store.storeCode?.toLowerCase().includes(q) || false;
        const matchCity = store.city?.toLowerCase().includes(q) || false;
        const matchState = store.state?.toLowerCase().includes(q) || false;
        if (!matchName && !matchRetailer && !matchCode && !matchCity && !matchState) {
          return false;
        }
      }

      // 2. Retailer Filter
      if (retailerFilter !== "ALL" && store.companyId !== retailerFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== "ALL" && store.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [data.stores, searchTerm, retailerFilter, statusFilter]);

  const isFilterActive = searchTerm.trim() !== "" || retailerFilter !== "ALL" || statusFilter !== "ALL";

  const handleClearFilters = () => {
    setSearchTerm("");
    setRetailerFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <div className="space-y-6 w-full" data-testid="store-operations-container">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white" data-testid="page-title">
              Store Operations
            </h1>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {data.totalStoresCount} Stores
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1" data-testid="page-subtitle">
            Store Network & Operations Overview
          </p>
        </div>

        {/* Global Action / Link to Retailers */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/retailers"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
          >
            <span>Retailer 360° Management ↗</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Total Stores
          </span>
          <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
            {data.totalStoresCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Authoritative physical stores
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Active Stores
          </span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {data.activeStoresCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Ready for dispatch & orders
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Operating Retailers
          </span>
          <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">
            {data.totalRetailersCount}
          </p>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Distinct partner companies
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Operations Foundation
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Phase 1 Active
            </span>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Read-only consolidated overview
          </span>
        </div>
      </div>

      {/* DETAIL VIEW (When a store is selected) */}
      {selectedStore ? (
        <div className="space-y-6" data-testid="store-detail-view">
          {/* Detail View Breadcrumbs & Back Link */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={handleBackToList}
              data-testid="back-to-store-list-btn"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span>←</span>
              <span>Back to Store List</span>
            </button>

            <Link
              href={`/admin/retailers/${selectedStore.companyId}?tab=stores`}
              data-testid="open-retailer-360-btn"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              <span>Manage in Retailer 360°</span>
              <span>↗</span>
            </Link>
          </div>

          {/* Compact Store Header */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900" data-testid="store-detail-header">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-zinc-950 dark:text-white" data-testid="detail-store-name">
                    {selectedStore.name}
                  </h2>
                  {selectedStore.storeCode && (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700" data-testid="detail-store-code">
                      {selectedStore.storeCode}
                    </span>
                  )}
                  <span
                    data-testid="detail-store-status"
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold border ${
                      selectedStore.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                    }`}
                  >
                    {selectedStore.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span>Parent Retailer:</span>
                  <Link
                    href={`/admin/retailers/${selectedStore.companyId}`}
                    data-testid="detail-parent-retailer-link"
                    className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                  >
                    {selectedStore.companyName}
                  </Link>
                  {selectedStore.companyCode && (
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      ({selectedStore.companyCode})
                    </span>
                  )}
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span>Store Type: {selectedStore.type}</span>
                </div>
              </div>

              {/* Quick ID Badge */}
              <div className="text-left md:text-right text-[10px] text-zinc-400 font-mono">
                <div>Store ID: {selectedStore.id}</div>
                <div>Company ID: {selectedStore.companyId}</div>
              </div>
            </div>
          </div>

          {/* 7 Section Navigation Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800">
            <nav className="flex space-x-2 overflow-x-auto scrollbar-thin pb-px" data-testid="store-detail-tabs">
              {DETAIL_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    data-testid={`tab-${tab.key}`}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
                      isActive
                        ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white bg-zinc-50/50 dark:bg-zinc-850/40"
                        : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-normal bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* TAB 1: OVERVIEW (Active Read-Only Content) */}
          {activeTab === "overview" && (
            <div className="space-y-6" data-testid="tab-content-overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Location & Address */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                      Location & Shipping Address
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Street Address
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                        {selectedStore.address || "Not Available"}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          City
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.city || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          State
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.state || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          ZIP Code
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                          {selectedStore.zip || "Not Available"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
                      ℹ️ Destination store for order delivery and physical stock intake.
                    </div>
                  </div>
                </div>

                {/* Store Management & Contact Info */}
                <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                  <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                      Management & Contact Information
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Store Phone
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                        {selectedStore.phone || "Not Available"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                        Store Email
                      </span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                        {selectedStore.email || "Not Available"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          Store Manager Name
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                          {selectedStore.managerName || "Not Available"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase block">
                          Manager Phone
                        </span>
                        <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                          {selectedStore.managerPhone || "Not Available"}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-400">
                      ℹ️ Managed and maintained by Retailer Organization owners.
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Record Linkages Summary */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <h3 className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
                    Authoritative Operational Linkages
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Orders Placed</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.ordersCount} Orders
                    </p>
                    <span className="text-[10px] text-zinc-400">Linked to this store</span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Weekly Stock Checks</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.weeklyChecksCount} Records
                    </p>
                    <span className="text-[10px] text-zinc-400">
                      {selectedStore.latestWeeklyCheckStatus
                        ? `Latest: ${selectedStore.latestWeeklyCheckStatus}`
                        : "No check recorded"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Assigned Staff</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
                      {selectedStore.assignedUsersCount} Members
                    </p>
                    <span className="text-[10px] text-zinc-400">Authorized store users</span>
                  </div>

                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Registration Date</span>
                    <p className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 font-mono text-[11px]">
                      {new Date(selectedStore.createdAt).toLocaleDateString()}
                    </p>
                    <span className="text-[10px] text-zinc-400">Store record creation</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & REORDER (Active Phase 2 Integration) */}
          {activeTab === "inventory" && (
            <div className="space-y-6" data-testid="tab-content-inventory">
              {/* If no inventory data or 0 products found */}
              {!storeInventory || storeInventory.items.length === 0 ? (
                <div
                  className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                  data-testid="inventory-empty-state"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xl">
                    📦
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="inventory-empty-state-title">
                      No Weekly Stock Submissions Recorded
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      No weekly physical inventory counts have been submitted for {selectedStore.name} yet. Counts and automated replenishment recommendations will populate here automatically once physical stock checks are submitted by store staff.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                      data-testid="inventory-empty-retailer-360-link"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Manage Company Inventory in Retailer 360° ↗</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 4 KPI Summary Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Latest Submission Date */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-latest-submission"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Latest Submission
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeInventory.latestSubmissionDate || "No Submission"}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeInventory.latestReportingWeek
                          ? `Week: ${storeInventory.latestReportingWeek}`
                          : "Pending weekly count"}
                      </span>
                    </div>

                    {/* KPI 2: Submission Status */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-submission-status"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Submission Status
                      </span>
                      <div className="pt-0.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${
                            storeInventory.submissionStatus === "submitted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                              : storeInventory.submissionStatus === "in_progress"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                          }`}
                        >
                          {storeInventory.submissionStatusLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Authoritative store status
                      </span>
                    </div>

                    {/* KPI 3: Reported Stock Coverage */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-stock-coverage"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Stock Count Coverage
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white">
                        {storeInventory.productsWithReportedStockCount} / {storeInventory.totalAssortedProductsCount}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-1.5">
                          (
                          {storeInventory.totalAssortedProductsCount > 0
                            ? Math.round(
                                (storeInventory.productsWithReportedStockCount /
                                  storeInventory.totalAssortedProductsCount) *
                                  100
                              )
                            : 0}
                          %)
                        </span>
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Assorted products counted
                      </span>
                    </div>

                    {/* KPI 4: Reorder Attention */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-reorder-attention"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Reorder Attention
                      </span>
                      <p
                        className={`text-lg font-bold ${
                          storeInventory.reorderAttentionCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {storeInventory.reorderAttentionCount} Products
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeInventory.reorderAttentionCount > 0
                          ? "Replenishment recommended"
                          : "Stock levels sufficient"}
                      </span>
                    </div>
                  </div>

                  {/* Search, Filter & Sort Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search product name, brand, SKU, category..."
                        data-testid="inventory-search-input"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                      {inventorySearch && (
                        <button
                          type="button"
                          onClick={() => setInventorySearch("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Filter Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Filter:</span>
                        <select
                          value={inventoryFilter}
                          onChange={(e) => setInventoryFilter(e.target.value as any)}
                          data-testid="inventory-filter-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Products ({storeInventory.items.length})</option>
                          <option value="REPORTED">Stock Reported ({storeInventory.productsWithReportedStockCount})</option>
                          <option value="NOT_REPORTED">
                            Not Reported ({storeInventory.totalAssortedProductsCount - storeInventory.productsWithReportedStockCount})
                          </option>
                          <option value="REORDER_ATTENTION">Reorder Attention ({storeInventory.reorderAttentionCount})</option>
                        </select>
                      </div>

                      {/* Sort Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                        <select
                          value={inventorySort}
                          onChange={(e) => setInventorySort(e.target.value as any)}
                          data-testid="inventory-sort-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="REORDER_FIRST">Reorder Attention First</option>
                          <option value="STOCK_DESC">Reported Stock: High → Low</option>
                          <option value="STOCK_ASC">Reported Stock: Low → High</option>
                          <option value="NAME_ASC">Product Name (A → Z)</option>
                          <option value="NAME_DESC">Product Name (Z → A)</option>
                          <option value="DATE_DESC">Reporting Date (Newest)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Product Inventory Table */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs" data-testid="inventory-table">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-3 px-3 min-w-[220px]">Product & Brand</th>
                            <th className="py-3 px-3 min-w-[120px]">SKU & Category</th>
                            <th className="py-3 px-3 text-right">Pack & MOQ</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Reported Stock</th>
                            <th className="py-3 px-3 text-right">Est. Sold</th>
                            <th className="py-3 px-3 min-w-[110px]">Reporting Date</th>
                            <th className="py-3 px-3 min-w-[170px]">Reorder Suggestion</th>
                            <th className="py-3 px-3 text-center min-w-[110px]">Status</th>
                            <th className="py-3 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredInventoryItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-xs text-zinc-500">
                                No products match your current search and filter settings.
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInventorySearch("");
                                      setInventoryFilter("ALL");
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer"
                                  >
                                    Reset Filters
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredInventoryItems.map((item) => (
                              <tr
                                key={item.productId}
                                data-testid={`inventory-table-row-${item.productId}`}
                                className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                              >
                                {/* Product & Brand */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5">
                                    {item.thumbnailUrl ? (
                                      <img
                                        src={item.thumbnailUrl}
                                        alt={item.productName}
                                        className="w-9 h-9 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0 bg-white"
                                      />
                                    ) : (
                                      <div className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-400 text-[10px]">
                                        📦
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <span
                                        className="font-semibold text-zinc-900 dark:text-white block truncate max-w-[200px]"
                                        title={item.productName}
                                      >
                                        {item.productName}
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block truncate">
                                        {item.brandName}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* SKU & Category */}
                                <td className="py-2.5 px-3">
                                  <span className="font-mono text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 block">
                                    {item.sku}
                                  </span>
                                  <span className="text-[10px] text-zinc-400 block">
                                    {item.category}
                                  </span>
                                </td>

                                {/* Pack & MOQ */}
                                <td className="py-2.5 px-3 text-right">
                                  <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 block">
                                    {item.cartonPackQty} pcs/cs
                                  </span>
                                  <span className="text-[10px] text-zinc-400 block">
                                    MOQ: {item.moq} pcs
                                  </span>
                                </td>

                                {/* Reported Stock */}
                                <td className="py-2.5 px-3 text-right" data-testid={`stock-cell-${item.productId}`}>
                                  {item.reportedRemaining !== null ? (
                                    item.reportedRemaining === 0 ? (
                                      <div>
                                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 block">
                                          0 units
                                        </span>
                                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                                          Zero Stock
                                        </span>
                                      </div>
                                    ) : (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-white block">
                                          {item.reportedRemaining} units
                                        </span>
                                        <span className="text-[10px] text-zinc-400 block font-mono">
                                          {Math.floor(item.reportedRemaining / item.cartonPackQty)} cs
                                          {item.reportedRemaining % item.cartonPackQty > 0
                                            ? ` + ${item.reportedRemaining % item.cartonPackQty} ea`
                                            : ""}
                                        </span>
                                      </div>
                                    )
                                  ) : (
                                    <div>
                                      <span className="italic text-zinc-400 font-medium block">
                                        Not Reported
                                      </span>
                                      <span className="text-[9px] text-zinc-400 block">
                                        No count in check
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Estimated Sold */}
                                <td className="py-2.5 px-3 text-right font-mono">
                                  {item.estimatedSold !== null ? (
                                    <span className="text-zinc-900 dark:text-white font-semibold">
                                      {item.estimatedSold}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-400 italic text-[11px]">
                                      Not Available
                                    </span>
                                  )}
                                </td>

                                {/* Reporting Date & Week */}
                                <td className="py-2.5 px-3">
                                  {item.reportingDate ? (
                                    <div>
                                      <span className="font-mono text-xs text-zinc-800 dark:text-zinc-200 block">
                                        {item.reportingDate}
                                      </span>
                                      {item.reportingWeek && (
                                        <span className="text-[10px] text-zinc-400 block font-mono">
                                          {item.reportingWeek}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="italic text-zinc-400 text-xs">
                                      Not Reported
                                    </span>
                                  )}
                                </td>

                                {/* Reorder Suggestion */}
                                <td className="py-2.5 px-3">
                                  {item.reorderNeeded ? (
                                    <div>
                                      <div className="flex items-center gap-1 font-mono font-bold text-amber-600 dark:text-amber-400">
                                        <span>{item.suggestedReorderQty} units</span>
                                        <span className="text-[10px] font-normal">
                                          ({item.suggestedCases} {item.suggestedCases === 1 ? "cs" : "cases"})
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-amber-700 dark:text-amber-300 block line-clamp-1" title={item.reorderReason}>
                                        {item.reorderReason}
                                      </span>
                                    </div>
                                  ) : item.reportedRemaining !== null ? (
                                    <div>
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block">
                                        Sufficient Stock
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block">
                                        No reorder needed
                                      </span>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-xs text-zinc-400 italic block">
                                        Needs Physical Count
                                      </span>
                                      <span className="text-[10px] text-zinc-400 block">
                                        Pending count submission
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Status Badge */}
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    data-testid={`stock-badge-${item.productId}`}
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${
                                      item.dataStatus === "zero_stock"
                                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                                        : item.dataStatus === "reorder_attention"
                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                                        : item.dataStatus === "reported"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                                        : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    {item.dataStatus === "zero_stock"
                                      ? "Zero Stock"
                                      : item.dataStatus === "reorder_attention"
                                      ? "Reorder Needed"
                                      : item.dataStatus === "reported"
                                      ? "In Stock"
                                      : "Not Reported"}
                                  </span>
                                </td>

                                {/* Action */}
                                <td className="py-2.5 px-3 text-right">
                                  <Link
                                    href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                                    data-testid={`reorder-link-${item.productId}`}
                                    className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
                                  >
                                    360° ↗
                                  </Link>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Authoritative Attribution & Policy Footer Banner */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Authoritative Data Origin & Replenishment Rules
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Physical counts originate from submitted store weekly inventory checks. Carton pack sizing and minimum order quantities are synchronized with authoritative Brand Master specifications. Reorder quantities enforce whole carton multiples.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                      data-testid="inventory-retailer-360-link"
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Retailer 360° Management ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: ORDERS & DELIVERIES (Active Phase 2 Integration) */}
          {activeTab === "orders" && (
            <div className="space-y-6" data-testid="tab-content-orders">
              {/* If no orders data or 0 orders found for this store */}
              {!storeOrders || storeOrders.orders.length === 0 ? (
                <div
                  className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                  data-testid="orders-empty-state"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-xl">
                    🚚
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="orders-empty-state-title">
                      No Orders Recorded for This Store
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      No wholesale or replenishment orders have been routed to {selectedStore.name} yet. When an order is placed with this store as the shipping destination, it will be displayed here automatically.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=orders`}
                      data-testid="orders-empty-retailer-360-link"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>View Company Orders in Retailer 360° ↗</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {/* 4 Summary KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Total Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-total"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Total Orders
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeOrders.totalOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Store destination orders
                      </span>
                    </div>

                    {/* KPI 2: Open / In Progress Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-open"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Open / In Progress
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeOrders.openOrdersCount > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {storeOrders.openOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Submitted, confirmed, or processing
                      </span>
                    </div>

                    {/* KPI 3: Shipped / Dispatched Orders */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-shipped"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Shipped / Dispatched
                      </span>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {storeOrders.shippedOrdersCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Fulfillments dispatched or delivered
                      </span>
                    </div>

                    {/* KPI 4: Orders With Remaining Units */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-orders-remaining"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Remaining Unshipped
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeOrders.ordersWithRemainingUnitsCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-zinc-900 dark:text-white"
                        }`}
                      >
                        {storeOrders.ordersWithRemainingUnitsCount} Orders
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeOrders.ordersWithRemainingUnitsCount > 0
                          ? "Orders with pending quantity"
                          : "All ordered units fulfilled"}
                      </span>
                    </div>
                  </div>

                  {/* Search, Filter & Sort Controls */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder="Search order #, carrier tracking, product, SKU..."
                        data-testid="orders-search-input"
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      />
                      {orderSearch && (
                        <button
                          type="button"
                          onClick={() => setOrderSearch("")}
                          className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Filter Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Status:</span>
                        <select
                          value={orderStatusFilter}
                          onChange={(e) => setOrderStatusFilter(e.target.value)}
                          data-testid="orders-filter-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Statuses ({storeOrders.orders.length})</option>
                          <option value="submitted">Submitted</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="partially_shipped">Partially Shipped</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>

                      {/* Sort Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                        <select
                          value={orderSort}
                          onChange={(e) => setOrderSort(e.target.value as any)}
                          data-testid="orders-sort-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="DATE_DESC">Order Date (Newest First)</option>
                          <option value="DATE_ASC">Order Date (Oldest First)</option>
                          <option value="AMOUNT_DESC">Total Amount (High → Low)</option>
                          <option value="AMOUNT_ASC">Total Amount (Low → High)</option>
                          <option value="UNITS_DESC">Ordered Units (High → Low)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs" data-testid="orders-table">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-3 px-3 min-w-[170px]">Order Number & Date</th>
                            <th className="py-3 px-3 min-w-[120px]">Order Status</th>
                            <th className="py-3 px-3 min-w-[160px]">Items & Units</th>
                            <th className="py-3 px-3 text-right min-w-[110px]">Total Amount</th>
                            <th className="py-3 px-3 min-w-[170px]">Fulfillment / Dispatch</th>
                            <th className="py-3 px-3 min-w-[180px]">Tracking & Cartons</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredStoreOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                                No orders match your current search and filter settings.
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrderSearch("");
                                      setOrderStatusFilter("ALL");
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer"
                                  >
                                    Reset Filters
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredStoreOrders.map((order) => {
                              const isExpanded = expandedOrderId === order.id;
                              return (
                                <React.Fragment key={order.id}>
                                  <tr
                                    data-testid={`orders-table-row-${order.id}`}
                                    className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors ${
                                      isExpanded ? "bg-zinc-50/40 dark:bg-zinc-800/30" : ""
                                    }`}
                                  >
                                    {/* Order Number & Date */}
                                    <td className="py-2.5 px-3">
                                      <div className="font-mono font-bold text-zinc-900 dark:text-white">
                                        {order.orderNumber}
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {formatOrderDateTime(order.createdAt)}
                                      </div>
                                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                        {order.paymentTerms && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                            {order.paymentTerms}
                                          </span>
                                        )}
                                        <span className="text-[10px] font-medium text-zinc-400 capitalize">
                                          {order.paymentStatus}
                                        </span>
                                      </div>
                                    </td>

                                    {/* Order Status */}
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold border ${getOrderStatusBadgeClasses(
                                          order.orderStatus
                                        )}`}
                                        data-testid={`order-status-${order.id}`}
                                      >
                                        {formatOrderStatusName(order.orderStatus)}
                                      </span>
                                    </td>

                                    {/* Items & Units */}
                                    <td className="py-2.5 px-3">
                                      <div className="font-semibold text-zinc-900 dark:text-white">
                                        {order.totalItemsCount} {order.totalItemsCount === 1 ? "line item" : "line items"} · {order.totalOrderedUnits} units
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        {order.totalShippedUnits > 0 ? (
                                          <span>{order.totalShippedUnits} shipped</span>
                                        ) : order.orderStatus.toLowerCase() === "cancelled" ? (
                                          <span className="text-zinc-400">Cancelled</span>
                                        ) : (
                                          <span className="text-zinc-400">0 shipped</span>
                                        )}
                                        {order.totalRemainingUnits > 0 && order.orderStatus.toLowerCase() !== "cancelled" && (
                                          <span className="text-amber-600 dark:text-amber-400 font-semibold ml-1.5">
                                            ({order.totalRemainingUnits} remaining)
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Total Amount */}
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="font-mono font-bold text-zinc-900 dark:text-white">
                                        {formatOrderCurrency(order.totalAmount)}
                                      </div>
                                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                        Subtotal: {formatOrderCurrency(order.subtotalAmount)}
                                      </div>
                                    </td>

                                    {/* Fulfillment / Dispatch */}
                                    <td className="py-2.5 px-3">
                                      {order.fulfillments.length === 0 ? (
                                        <div className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                                          No Dispatches Yet
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <div className="font-semibold text-zinc-900 dark:text-white text-[11px]">
                                            {order.fulfillments.length}{" "}
                                            {order.fulfillments.length === 1 ? "Dispatch" : "Dispatches"}
                                            {order.totalBoxCount > 0 && ` (${order.totalBoxCount} Cartons)`}
                                          </div>
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {order.fulfillments.map((f) => (
                                              <span
                                                key={f.id}
                                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                                  f.status.toLowerCase() === "delivered"
                                                    ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                                                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                }`}
                                              >
                                                {f.status.toLowerCase() === "delivered" ? "Delivered" : "Shipped"}
                                              </span>
                                            ))}
                                            {order.fulfillments[0]?.shippedAt && (
                                              <span className="text-[10px] text-zinc-400">
                                                {formatOrderDate(order.fulfillments[0].shippedAt)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </td>

                                    {/* Tracking & Cartons */}
                                    <td className="py-2.5 px-3">
                                      {order.fulfillments.length === 0 ? (
                                        <span className="text-zinc-400 text-[11px]">—</span>
                                      ) : (
                                        <div className="space-y-1">
                                          {order.fulfillments.map((f) => (
                                            <div key={f.id} className="text-[11px]">
                                              {f.trackingUrl ? (
                                                <a
                                                  href={f.trackingUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                                                >
                                                  {f.carrier ? `${f.carrier}: ` : ""}
                                                  {f.trackingNumber || "Track"} ↗
                                                </a>
                                              ) : f.trackingNumber ? (
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                                                  {f.carrier ? `${f.carrier}: ` : ""}
                                                  {f.trackingNumber}
                                                </span>
                                              ) : (
                                                <span className="text-zinc-400 italic">No tracking #</span>
                                              )}
                                              {f.boxes.length > 1 && (
                                                <div className="text-[10px] text-zinc-400">
                                                  {f.boxes.length} carton tracking numbers
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Actions */}
                                    <td className="py-2.5 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                          data-testid={`order-toggle-${order.id}`}
                                          className="px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        >
                                          {isExpanded ? "Hide ▲" : "Details ▼"}
                                        </button>
                                        <Link
                                          href={`/admin/sales/orders/${order.id}`}
                                          data-testid={`order-process-link-${order.id}`}
                                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-bold transition-all shadow-xs shrink-0 flex items-center gap-1"
                                        >
                                          <span>Process ↗</span>
                                        </Link>
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Expanded Drawer */}
                                  {isExpanded && (
                                    <tr
                                      className="bg-zinc-50/70 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800"
                                      data-testid={`order-expanded-${order.id}`}
                                    >
                                      <td colSpan={7} className="p-4 space-y-4">
                                        {/* Deliveries / Dispatches Section */}
                                        <div className="space-y-2">
                                          <h4 className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                                            Confirmed Dispatches & Packaging ({order.fulfillments.length})
                                          </h4>
                                          {order.fulfillments.length === 0 ? (
                                            <div className="text-xs text-zinc-400 italic bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                              No fulfillment packages have been dispatched for this order yet.
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                              {order.fulfillments.map((f) => (
                                                <div
                                                  key={f.id}
                                                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2"
                                                >
                                                  <div className="flex items-center justify-between gap-2">
                                                    <div className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                                                      {f.fulfillmentNumber}
                                                    </div>
                                                    <span
                                                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                        f.status.toLowerCase() === "delivered"
                                                          ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                                                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                                      }`}
                                                    >
                                                      {f.status.toLowerCase() === "delivered"
                                                        ? "Delivered"
                                                        : "Shipped"}
                                                    </span>
                                                  </div>
                                                  <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-0.5">
                                                    <div>
                                                      <span className="text-zinc-400">Carrier:</span>{" "}
                                                      <span className="font-medium">{f.carrier || "Standard"}</span>
                                                    </div>
                                                    {f.shippedAt && (
                                                      <div>
                                                        <span className="text-zinc-400">Shipped:</span>{" "}
                                                        <span>{formatOrderDateTime(f.shippedAt)}</span>
                                                      </div>
                                                    )}
                                                    {f.deliveredAt && (
                                                      <div>
                                                        <span className="text-zinc-400">Delivered:</span>{" "}
                                                        <span className="text-teal-600 dark:text-teal-400 font-medium">
                                                          {formatOrderDateTime(f.deliveredAt)}
                                                        </span>
                                                      </div>
                                                    )}
                                                    {f.trackingNumber && (
                                                      <div>
                                                        <span className="text-zinc-400">Master Tracking:</span>{" "}
                                                        {f.trackingUrl ? (
                                                          <a
                                                            href={f.trackingUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                                                          >
                                                            {f.trackingNumber} ↗
                                                          </a>
                                                        ) : (
                                                          <span className="font-mono">{f.trackingNumber}</span>
                                                        )}
                                                      </div>
                                                    )}
                                                    {f.notes && (
                                                      <div className="text-[11px] text-zinc-500 italic mt-1">
                                                        Notes: {f.notes}
                                                      </div>
                                                    )}
                                                  </div>

                                                  {/* Carton Boxes */}
                                                  {f.boxes && f.boxes.length > 0 && (
                                                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                                                      <div className="text-[10px] font-bold text-zinc-400 uppercase">
                                                        Carton Boxes ({f.boxes.length}):
                                                      </div>
                                                      <div className="space-y-1">
                                                        {f.boxes.map((b) => (
                                                          <div
                                                            key={b.id}
                                                            className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded bg-zinc-50 dark:bg-zinc-800/60"
                                                          >
                                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                              Carton #{b.boxNumber} of {b.boxTotal}
                                                            </span>
                                                            {b.trackingUrl ? (
                                                              <a
                                                                href={b.trackingUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                                                              >
                                                                {b.trackingNumber || "Track"} ↗
                                                              </a>
                                                            ) : (
                                                              <span className="font-mono text-[11px] text-zinc-500">
                                                                {b.trackingNumber || "No tracking"}
                                                              </span>
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Order Items Table */}
                                        <div className="space-y-2">
                                          <h4 className="text-[11px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                                            Ordered Products & Quantities ({order.items.length})
                                          </h4>
                                          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
                                            <table className="w-full text-left text-xs">
                                              <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                                <tr>
                                                  <th className="py-2 px-3">Product Name & Brand</th>
                                                  <th className="py-2 px-3">SKU</th>
                                                  <th className="py-2 px-3 text-right">Ordered</th>
                                                  <th className="py-2 px-3 text-right">Shipped</th>
                                                  <th className="py-2 px-3 text-right">Cancelled</th>
                                                  <th className="py-2 px-3 text-right">Remaining</th>
                                                  <th className="py-2 px-3 text-right">Unit Price</th>
                                                  <th className="py-2 px-3 text-right">Line Total</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                                {order.items.length === 0 ? (
                                                  <tr>
                                                    <td colSpan={8} className="py-4 text-center text-zinc-400 italic">
                                                      No line item details found.
                                                    </td>
                                                  </tr>
                                                ) : (
                                                  order.items.map((item) => (
                                                    <tr
                                                      key={item.id}
                                                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                                                    >
                                                      <td className="py-2 px-3">
                                                        <div className="font-semibold text-zinc-900 dark:text-white">
                                                          {item.productName}
                                                        </div>
                                                        {item.brandName && (
                                                          <div className="text-[10px] text-zinc-400">
                                                            {item.brandName}
                                                          </div>
                                                        )}
                                                      </td>
                                                      <td className="py-2 px-3 font-mono text-[11px] text-zinc-500">
                                                        {item.sku}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium">
                                                        {item.quantity}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                        {item.quantityShipped}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium text-zinc-400">
                                                        {item.quantityCancelled}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-medium">
                                                        {item.quantityRemaining > 0 ? (
                                                          <span className="text-amber-600 dark:text-amber-400 font-bold">
                                                            {item.quantityRemaining}
                                                          </span>
                                                        ) : (
                                                          <span className="text-zinc-400">0</span>
                                                        )}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono text-zinc-600 dark:text-zinc-300">
                                                        {formatOrderCurrency(item.unitWholesalePrice)}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono font-bold text-zinc-900 dark:text-white">
                                                        {formatOrderCurrency(item.lineTotal)}
                                                      </td>
                                                    </tr>
                                                  ))
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Authoritative Attribution & Policy Footer Banner */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Authoritative Sales Order Ledger & Carrier Fulfillment
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Store orders are authoritatively tracked and processed within the Sales Orders module. Fulfillments, multi-carton tracking numbers, and delivery verifications are synchronized with carrier dispatches.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=orders`}
                      data-testid="orders-retailer-360-link"
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Retailer 360° Orders ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SALES & PERFORMANCE (ADM-STORE-OPS-P2-004) */}
          {activeTab === "sales" && (
            <div className="space-y-4" data-testid="tab-content-sales">
              {/* Header card with store attribution */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                      Phase 2 Active
                    </span>
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                      Store Estimated Movement & Sales Velocity
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Store-specific estimated movement, sales velocity, and inventory supply metrics for{" "}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedStore.name}</span> ({selectedStore.companyName}).
                    Derived authoritatively from weekly physical inventory count submissions and confirmed deliveries.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                    data-testid="sales-retailer-360-link"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-xs"
                  >
                    <span>Retailer 360° Performance ↗</span>
                  </Link>
                </div>
              </div>

              {!storePerformance ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  No performance data available for this store.
                </div>
              ) : (
                <>
                  {/* 4 Summary KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Estimated Units Sold */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-sales-estimated-units"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Estimated Units Sold
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storePerformance.totalEstimatedUnitsSold !== null
                          ? storePerformance.totalEstimatedUnitsSold.toLocaleString()
                          : "Insufficient Data"}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storePerformance.submittedChecksCount >= 2
                          ? `${storePerformance.submittedChecksCount} submitted physical counts`
                          : storePerformance.submittedChecksCount === 1
                          ? "1 submission (Baseline count recorded)"
                          : "0 submissions recorded"}
                      </span>
                    </div>

                    {/* KPI 2: Estimated Weekly Velocity */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-sales-weekly-velocity"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Estimated Weekly Velocity
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storePerformance.averageWeeklyVelocity !== null
                          ? `${storePerformance.averageWeeklyVelocity} units/wk`
                          : "Insufficient Data"}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storePerformance.submittedChecksCount >= 2
                          ? "Observed run rate across intervals"
                          : "Requires ≥ 2 submissions to calculate rate"}
                      </span>
                    </div>

                    {/* KPI 3: Products with Valid Data */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-sales-valid-products"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Products with Valid Data
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storePerformance.productsWithValidDataCount} / {storePerformance.carriedProductsCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storePerformance.productsWithValidDataCount > 0
                          ? `${Math.round(
                              (storePerformance.productsWithValidDataCount /
                                (storePerformance.carriedProductsCount || 1)) *
                                100
                            )}% assortment reporting rate`
                          : "No products reported yet"}
                      </span>
                    </div>

                    {/* KPI 4: Products Needing Attention */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-sales-attention-products"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Products Needing Attention
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storePerformance.productsNeedingAttentionCount > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {storePerformance.productsNeedingAttentionCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storePerformance.products.filter((p) => p.stockRisk === "stockout").length} stockout ·{" "}
                        {storePerformance.products.filter((p) => p.stockRisk === "low_stock").length} low stock ·{" "}
                        {storePerformance.products.filter((p) => p.stockRisk === "unreported").length} unreported
                      </span>
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1 max-w-sm">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 text-xs">
                          🔍
                        </span>
                        <input
                          type="text"
                          value={salesSearch}
                          onChange={(e) => setSalesSearch(e.target.value)}
                          placeholder="Search product name, brand, SKU..."
                          data-testid="sales-search-input"
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Filter by Stock Risk / Status */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Status:</span>
                        <select
                          value={salesRiskFilter}
                          onChange={(e) => setSalesRiskFilter(e.target.value)}
                          data-testid="sales-filter-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="ALL">All Products ({storePerformance.products.length})</option>
                          <option value="stockout">
                            Out of Stock ({storePerformance.products.filter((p) => p.stockRisk === "stockout").length})
                          </option>
                          <option value="low_stock">
                            Low Stock ({storePerformance.products.filter((p) => p.stockRisk === "low_stock").length})
                          </option>
                          <option value="sufficient">
                            Optimal / In Stock ({storePerformance.products.filter((p) => p.stockRisk === "sufficient").length})
                          </option>
                          <option value="overstock">
                            Overstock ({storePerformance.products.filter((p) => p.stockRisk === "overstock").length})
                          </option>
                          <option value="unreported">
                            Unreported ({storePerformance.products.filter((p) => p.stockRisk === "unreported").length})
                          </option>
                        </select>
                      </div>

                      {/* Sort Select */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                        <select
                          value={salesSort}
                          onChange={(e) => setSalesSort(e.target.value as any)}
                          data-testid="sales-sort-select"
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                        >
                          <option value="RISK_FIRST">Attention Priority</option>
                          <option value="VELOCITY_DESC">Highest Velocity</option>
                          <option value="STOCK_DESC">Highest Stock</option>
                          <option value="NAME_ASC">Product Name A–Z</option>
                        </select>
                      </div>

                      <span className="text-xs text-zinc-400 dark:text-zinc-500 pl-1">
                        Showing {filteredPerformanceProducts.length} of {storePerformance.products.length}
                      </span>
                    </div>
                  </div>

                  {/* SKU Performance Table */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto scrollbar-thin">
                      <table className="w-full text-left text-xs" data-testid="sales-table">
                        <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <tr>
                            <th className="py-3 px-3 min-w-[200px]">Product & SKU</th>
                            <th className="py-3 px-3 min-w-[130px]">Brand & Category</th>
                            <th className="py-3 px-3 text-right min-w-[120px]">Latest Reported Stock</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Estimated Units Sold</th>
                            <th className="py-3 px-3 text-right min-w-[130px]">Weekly Velocity</th>
                            <th className="py-3 px-3 text-right min-w-[120px]">Weeks of Supply</th>
                            <th className="py-3 px-3 min-w-[140px]">Status & Risk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredPerformanceProducts.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-xs text-zinc-500">
                                No products match your current search and filter settings.
                                <div className="mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSalesSearch("");
                                      setSalesRiskFilter("ALL");
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer"
                                  >
                                    Reset Filters
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            filteredPerformanceProducts.map((p) => {
                              return (
                                <tr
                                  key={p.productId}
                                  data-testid={`sales-table-row-${p.productId}`}
                                  className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors"
                                >
                                  {/* Product & SKU */}
                                  <td className="py-3 px-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden flex items-center justify-center">
                                        {p.thumbnailUrl ? (
                                          <img
                                            src={p.thumbnailUrl}
                                            alt={p.productName}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-[10px] text-zinc-400">📦</span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="font-semibold text-zinc-900 dark:text-white line-clamp-1">
                                          {p.productName}
                                        </div>
                                        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                                          {p.sku}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Brand & Category */}
                                  <td className="py-3 px-3">
                                    <div className="text-zinc-700 dark:text-zinc-300 font-medium">
                                      {p.brandName}
                                    </div>
                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                      {p.category}
                                    </div>
                                  </td>

                                  {/* Latest Reported Stock */}
                                  <td className="py-3 px-3 text-right">
                                    {p.latestReportedStock !== null ? (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">
                                          {p.latestReportedStock.toLocaleString()}
                                        </span>
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                          {p.lastReportingWeek || p.lastReportingDate || "Reported"}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                        Not Reported
                                      </span>
                                    )}
                                  </td>

                                  {/* Estimated Units Sold */}
                                  <td className="py-3 px-3 text-right">
                                    {p.performanceStatus === "valid_estimate" && p.estimatedUnitsSold !== null ? (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">
                                          {p.estimatedUnitsSold.toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 block">units sold</span>
                                      </div>
                                    ) : p.performanceStatus === "baseline_only" ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                                        Baseline Count
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                                    )}
                                  </td>

                                  {/* Weekly Velocity */}
                                  <td className="py-3 px-3 text-right">
                                    {p.performanceStatus === "valid_estimate" && p.estimatedWeeklyVelocity !== null ? (
                                      <div>
                                        <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">
                                          {p.estimatedWeeklyVelocity}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 block">units/wk</span>
                                      </div>
                                    ) : p.performanceStatus === "baseline_only" ? (
                                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500" title="Requires 2nd submission to establish rate">
                                        Pending 2nd Count
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                                    )}
                                  </td>

                                  {/* Weeks of Supply */}
                                  <td className="py-3 px-3 text-right">
                                    {p.approxWeeksOfSupply !== null ? (
                                      <div>
                                        <span
                                          className={`font-mono font-bold text-xs ${
                                            p.approxWeeksOfSupply < 2
                                              ? "text-red-600 dark:text-red-400"
                                              : p.approxWeeksOfSupply > 6
                                              ? "text-blue-600 dark:text-blue-400"
                                              : "text-zinc-900 dark:text-white"
                                          }`}
                                        >
                                          {p.approxWeeksOfSupply} wks
                                        </span>
                                      </div>
                                    ) : p.latestReportedStock === 0 ? (
                                      <span className="font-mono text-xs text-red-600 dark:text-red-400 font-bold">
                                        0 wks (Depleted)
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                                    )}
                                  </td>

                                  {/* Status & Risk */}
                                  <td className="py-3 px-3">
                                    <div>
                                      {p.stockRisk === "stockout" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                                          <span>🚨</span> Out of Stock
                                        </span>
                                      )}
                                      {p.stockRisk === "low_stock" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                                          <span>⚠️</span> Low Stock
                                        </span>
                                      )}
                                      {p.stockRisk === "sufficient" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                                          <span>✓</span> In Stock
                                        </span>
                                      )}
                                      {p.stockRisk === "overstock" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300">
                                          <span>📦</span> Overstock
                                        </span>
                                      )}
                                      {p.stockRisk === "unreported" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                                          <span>—</span> Unreported
                                        </span>
                                      )}
                                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                                        {p.statusLabel}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Authoritative Attribution Policy Banner */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300">
                        <span>ℹ️</span>
                        <span>Inventory-Based Performance Methodology</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        K SELECT calculates estimated movement and sales velocity using weekly physical count delta analysis (
                        <code className="text-[10px] bg-zinc-200/60 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">
                          Beginning Stock + Delivered Receipts - Ending Stock
                        </code>
                        ). These figures represent estimated retail movement derived from physical counts, not real-time point-of-sale (POS) cash register transactions. Single submissions serve as baseline inventory counts until subsequent counts establish run-rate velocity.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=performance`}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-xs font-semibold transition-all shadow-xs"
                    >
                      <span>Retailer 360° Performance ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: STAFF & TRAINING */}
          {activeTab === "training" && (
            <div className="space-y-4" data-testid="tab-content-training">
              {/* Header card with store attribution */}
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                      Phase 2 Active
                    </span>
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                      Store Staff & Verified Training Coverage
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Store-scoped staff assignments, verified product quiz qualifications, and carried product coverage gaps for{" "}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedStore.name}</span> ({selectedStore.companyName}).
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/admin/retailers/${selectedStore.companyId}?tab=training`}
                    data-testid="training-retailer-360-link"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 text-xs font-semibold transition-all shadow-xs"
                  >
                    <span>Retailer 360° Staff & Modules ↗</span>
                  </Link>
                </div>
              </div>

              {!storeTraining ? (
                <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                  No staff & training data available for this store.
                </div>
              ) : (
                <>
                  {/* 4 Summary KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* KPI 1: Assigned Staff */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-training-assigned-staff"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Assigned Staff
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeTraining.assignedStaffCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Active store-scoped users
                      </span>
                    </div>

                    {/* KPI 2: Eligible Products */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-training-eligible-products"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Eligible Products
                      </span>
                      <p className="text-lg font-bold text-zinc-900 dark:text-white font-mono">
                        {storeTraining.eligibleProductsCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        Carried with published quiz ({storeTraining.products.length} total carried)
                      </span>
                    </div>

                    {/* KPI 3: Store Training Coverage */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-training-coverage"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Training Coverage
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeTraining.storeCoveragePercent === null
                            ? "text-zinc-400 dark:text-zinc-500"
                            : storeTraining.storeCoveragePercent === 100
                            ? "text-emerald-600 dark:text-emerald-400"
                            : storeTraining.storeCoveragePercent > 0
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {storeTraining.storeCoveragePercent !== null
                          ? `${storeTraining.storeCoveragePercent}%`
                          : "N/A"}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeTraining.eligibleProductsCount === 0
                          ? "No published training modules"
                          : `${storeTraining.coveredProductsCount} of ${storeTraining.eligibleProductsCount} eligible covered`}
                      </span>
                    </div>

                    {/* KPI 4: Coverage Gaps */}
                    <div
                      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-1"
                      data-testid="kpi-training-gaps"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block">
                        Coverage Gaps
                      </span>
                      <p
                        className={`text-lg font-bold font-mono ${
                          storeTraining.needsTrainingProductsCount > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {storeTraining.needsTrainingProductsCount}
                      </p>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block">
                        {storeTraining.needsTrainingProductsCount > 0
                          ? "Carried products needing certified staff"
                          : "Full product training coverage"}
                      </span>
                    </div>
                  </div>

                  {/* SECTION 1: ASSIGNED STAFF & QUALIFICATIONS */}
                  <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                          Assigned Staff ({storeTraining.staff.length})
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Employees with authorized access to this store and verified quiz qualification status.
                        </p>
                      </div>

                      {/* Staff Search */}
                      {storeTraining.staff.length > 0 && (
                        <div className="relative min-w-[200px]">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400 text-xs">
                            🔍
                          </span>
                          <input
                            type="text"
                            value={staffSearch}
                            onChange={(e) => setStaffSearch(e.target.value)}
                            placeholder="Search staff name, email, role..."
                            data-testid="staff-search-input"
                            className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                          {staffSearch && (
                            <button
                              type="button"
                              onClick={() => setStaffSearch("")}
                              className="absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {storeTraining.staff.length === 0 ? (
                      <div
                        className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400"
                        data-testid="training-staff-empty-state"
                      >
                        <p className="font-semibold text-zinc-700 dark:text-zinc-300">No staff assigned to this store.</p>
                        <p className="mt-1">
                          In Retailer 360, company owners and managers can assign store access to individual employees.
                        </p>
                      </div>
                    ) : filteredStaff.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                        No assigned staff match &quot;{staffSearch}&quot;.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                              <th className="py-2.5 px-4">Staff Member</th>
                              <th className="py-2.5 px-3">Role</th>
                              <th className="py-2.5 px-3">Store Assignment</th>
                              <th className="py-2.5 px-3">Verified Qualifications</th>
                              <th className="py-2.5 px-3">Last Completed</th>
                              <th className="py-2.5 px-3 text-right">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredStaff.map((staff) => {
                              const isExpanded = staffExpandedUserId === staff.userId;
                              const completionRate =
                                storeTraining.eligibleProductsCount > 0
                                  ? Math.min(
                                      100,
                                      Math.round(
                                        (staff.verifiedProductsCompletedCount / storeTraining.eligibleProductsCount) * 100
                                      )
                                    )
                                  : 0;

                              return (
                                <React.Fragment key={staff.userId}>
                                  <tr
                                    className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                                      isExpanded ? "bg-zinc-50/60 dark:bg-zinc-800/30" : ""
                                    }`}
                                    data-testid={`staff-row-${staff.userId}`}
                                  >
                                    {/* Staff Member */}
                                    <td className="py-3 px-4">
                                      <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                        <span>{staff.userName}</span>
                                        {staff.verifiedProductsCompletedCount > 0 && (
                                          <span className="text-emerald-600 dark:text-emerald-400 text-xs" title="Verified Qualified">
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                        {staff.email}
                                      </div>
                                    </td>

                                    {/* Role */}
                                    <td className="py-3 px-3">
                                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 capitalize">
                                        {staff.role}
                                      </span>
                                    </td>

                                    {/* Assignment Status */}
                                    <td className="py-3 px-3">
                                      {staff.assignmentStatus === "assigned" ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                                          <span>🏪</span> Assigned Store
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-300">
                                          <span>🌐</span> All Stores Access
                                        </span>
                                      )}
                                    </td>

                                    {/* Verified Qualifications */}
                                    <td className="py-3 px-3">
                                      <div className="flex items-center gap-2">
                                        <div className="font-semibold text-zinc-900 dark:text-white text-xs">
                                          {staff.verifiedProductsCompletedCount}{" "}
                                          <span className="text-zinc-400 font-normal">
                                            / {storeTraining.eligibleProductsCount} passed
                                          </span>
                                        </div>
                                        <span className="text-[10px] font-semibold text-zinc-500">
                                          ({completionRate}%)
                                        </span>
                                      </div>
                                      <div className="w-32 bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            completionRate === 100
                                              ? "bg-emerald-500"
                                              : completionRate > 0
                                              ? "bg-blue-500"
                                              : "bg-zinc-300 dark:bg-zinc-700"
                                          }`}
                                          style={{ width: `${completionRate}%` }}
                                        />
                                      </div>
                                    </td>

                                    {/* Last Completed */}
                                    <td className="py-3 px-3 text-zinc-500 dark:text-zinc-400 text-xs">
                                      {formatOrderDate(staff.latestVerifiedCompletionDate)}
                                    </td>

                                    {/* Expand Action */}
                                    <td className="py-3 px-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setStaffExpandedUserId(isExpanded ? null : staff.userId)
                                        }
                                        data-testid={`toggle-staff-${staff.userId}`}
                                        className="text-xs font-semibold px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                                      >
                                        {isExpanded ? "Hide Modules ▲" : "View Modules ▼"}
                                      </button>
                                    </td>
                                  </tr>

                                  {/* Expanded Drawer for Staff Completed Products */}
                                  {isExpanded && (
                                    <tr className="bg-zinc-50/70 dark:bg-zinc-800/40">
                                      <td colSpan={6} className="p-4 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                            <h5 className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                              Verified Quiz Qualifications for {staff.userName}
                                            </h5>
                                            <span className="text-[10px] text-zinc-500">
                                              Only 100% server-graded passing scores qualify.
                                            </span>
                                          </div>

                                          {staff.completions.length === 0 ? (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic py-1">
                                              No verified quiz completions recorded yet.
                                            </p>
                                          ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                              {staff.completions.map((p) => (
                                                <div
                                                  key={p.productId}
                                                  className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-start justify-between gap-2 shadow-2xs"
                                                >
                                                  <div className="min-w-0">
                                                    <p className="font-semibold text-xs text-zinc-900 dark:text-white truncate">
                                                      {p.productName}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-zinc-400">
                                                      {p.sku || "No SKU"}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 mt-1">
                                                      Completed: {formatOrderDate(p.completedAt)}
                                                    </p>
                                                  </div>
                                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                                                    100% Passed
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: CARRIED PRODUCTS TRAINING MATRIX & COVERAGE GAPS */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      {/* Search Input */}
                      <div className="relative flex-1 min-w-[200px]">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400 text-xs">
                          🔍
                        </span>
                        <input
                          type="text"
                          value={trainingProductSearch}
                          onChange={(e) => setTrainingProductSearch(e.target.value)}
                          placeholder="Search carried products, brand, SKU..."
                          data-testid="training-products-search-input"
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                        {trainingProductSearch && (
                          <button
                            type="button"
                            onClick={() => setTrainingProductSearch("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Filter Select */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">Coverage:</span>
                          <select
                            value={trainingProductFilter}
                            onChange={(e) => setTrainingProductFilter(e.target.value as any)}
                            data-testid="training-products-filter-select"
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                          >
                            <option value="ALL">All Carried Products ({storeTraining.products.length})</option>
                            <option value="GAPS_ONLY">Coverage Gaps ({storeTraining.needsTrainingProductsCount})</option>
                            <option value="COVERED_ONLY">Verified Covered ({storeTraining.coveredProductsCount})</option>
                            <option value="UNAVAILABLE">
                              Training Unavailable ({storeTraining.products.length - storeTraining.eligibleProductsCount})
                            </option>
                          </select>
                        </div>

                        {/* Sort Select */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-zinc-500 uppercase">Sort:</span>
                          <select
                            value={trainingProductSort}
                            onChange={(e) => setTrainingProductSort(e.target.value as any)}
                            data-testid="training-products-sort-select"
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
                          >
                            <option value="STATUS_FIRST">Priority: Gaps First</option>
                            <option value="NAME_ASC">Product Name (A → Z)</option>
                            <option value="BRAND_ASC">Brand Name (A → Z)</option>
                            <option value="STAFF_DESC">Qualified Staff (Most First)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Products Training Table */}
                    <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
                      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
                            Carried Products & Training Coverage ({filteredTrainingProducts.length})
                          </h4>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Status of mandatory staff qualifications for all products carried at this store.
                          </p>
                        </div>
                      </div>

                      {filteredTrainingProducts.length === 0 ? (
                        <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
                          No products match the selected search or filter criteria.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                                <th className="py-2.5 px-4">Product & SKU</th>
                                <th className="py-2.5 px-3">Brand</th>
                                <th className="py-2.5 px-3">Training Module</th>
                                <th className="py-2.5 px-3">Verified Staff</th>
                                <th className="py-2.5 px-3 text-right">Coverage Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                              {filteredTrainingProducts.map((p) => (
                                <tr
                                  key={p.productId}
                                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                                  data-testid={`training-product-row-${p.productId}`}
                                >
                                  {/* Product & SKU */}
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-zinc-900 dark:text-white">
                                      {p.productName}
                                    </div>
                                    <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                                      {p.sku || "No SKU"}
                                    </div>
                                  </td>

                                  {/* Brand */}
                                  <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300 font-medium">
                                    {p.brandName}
                                  </td>

                                  {/* Training Module */}
                                  <td className="py-3 px-3">
                                    {p.trainingStatus === "published" ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                                        <span>📖</span> Published Quiz
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                        No Module
                                      </span>
                                    )}
                                  </td>

                                  {/* Verified Staff */}
                                  <td className="py-3 px-3">
                                    {p.qualifiedEmployees.length > 0 ? (
                                      <div>
                                        <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                                          <span>✓</span> {p.qualifiedEmployees.length} qualified staff
                                        </div>
                                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate max-w-xs">
                                          {p.qualifiedEmployees.join(", ")}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-400 dark:text-zinc-500 italic text-[11px]">
                                        0 qualified staff
                                      </span>
                                    )}
                                  </td>

                                  {/* Coverage Status */}
                                  <td className="py-3 px-3 text-right">
                                    {p.coverageStatus === "not_available" ? (
                                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400">
                                        Training Unavailable
                                      </span>
                                    ) : p.coverageStatus === "covered" ? (
                                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                                        ✓ Verified Covered
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                                        ⚠️ Needs Training
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Authoritative Attribution & Policy Footer Banner */}
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="text-zinc-500 dark:text-zinc-400 space-y-0.5">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Authoritative Training Coverage Policy:
                      </p>
                      <p>
                        A store is considered covered for a product when at least one store-assigned staff member has achieved a verified 100% score on the server-graded quiz. Legacy self-reported completions are excluded.
                      </p>
                    </div>
                    <Link
                      href={`/admin/retailers/${selectedStore.companyId}?tab=training`}
                      data-testid="training-retailer-360-footer-link"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 font-semibold shrink-0 transition-all shadow-xs"
                    >
                      <span>Manage Modules in Retailer 360° ↗</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 6: FIXTURES & PLACEMENTS */}
          {activeTab === "fixtures" && (
            <div className="space-y-6" data-testid="tab-content-fixtures">
              {/* Header & Registration Trigger */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300">
                      Phase 3 Active
                    </span>
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="fixtures-tab-title">
                      Physical Fixtures & Merchandising Assets
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                    Manage physical K-Beauty display units installed at{" "}
                    <strong className="text-zinc-900 dark:text-zinc-100">{selectedStore.name}</strong>. Track modular bay geometry, shelf configurations, and operational status.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenRegisterModal}
                  data-testid="btn-register-fixture"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <span>+ Register Fixture</span>
                </button>
              </div>

              {/* KPI Overview Summary (Visible when fixtures exist) */}
              {storeFixtures && storeFixtures.totalFixturesCount > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Fixtures</span>
                    <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1" data-testid="kpi-total-fixtures">
                      {storeFixtures.totalFixturesCount} Units
                    </p>
                    <span className="text-[10px] text-zinc-500">Registered assets</span>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Operational</span>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1" data-testid="kpi-active-fixtures">
                      {storeFixtures.activeFixturesCount} Active
                    </p>
                    <span className="text-[10px] text-zinc-500">Normal retail condition</span>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Installed Units</span>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1" data-testid="kpi-installed-fixtures">
                      {storeFixtures.installedFixturesCount} Verified
                    </p>
                    <span className="text-[10px] text-zinc-500">{storeFixtures.plannedFixturesCount} planned / in transit</span>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xs">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Maintenance</span>
                    <p className={`text-xl font-bold mt-1 ${storeFixtures.maintenanceNeededCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white"}`} data-testid="kpi-maintenance-fixtures">
                      {storeFixtures.maintenanceNeededCount} Issues
                    </p>
                    <span className="text-[10px] text-zinc-500">Requires attention</span>
                  </div>
                </div>
              )}

              {/* Fixtures List or Empty State */}
              {(!storeFixtures || storeFixtures.totalFixturesCount === 0) ? (
                <div
                  className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4"
                  data-testid="fixtures-empty-state"
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-2xl">
                    🏬
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-950 dark:text-white" data-testid="fixtures-empty-state-title">
                      No fixtures registered for this store.
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                      Physical display fixtures (such as 4ft, 8ft, 12ft modular wall units or feature endcaps) installed at {selectedStore.name} have not been registered yet.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleOpenRegisterModal}
                      data-testid="btn-register-first-fixture"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
                    >
                      <span>+ Register First Fixture</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search & Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={fixtureSearch}
                        onChange={(e) => setFixtureSearch(e.target.value)}
                        placeholder="Search fixtures by code, name, location..."
                        data-testid="fixture-search-input"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                      />
                      <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-zinc-400 text-xs pointer-events-none">
                        🔍
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase">Status:</span>
                      <select
                        value={fixtureStatusFilter}
                        onChange={(e) => setFixtureStatusFilter(e.target.value)}
                        data-testid="fixture-status-filter"
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="ALL">All ({storeFixtures.fixtures.length})</option>
                        <option value="active">Active ({storeFixtures.activeFixturesCount})</option>
                        <option value="installed">Installed ({storeFixtures.installedFixturesCount})</option>
                        <option value="planned">Planned ({storeFixtures.plannedFixturesCount})</option>
                        <option value="needs_maintenance">Maintenance ({storeFixtures.maintenanceNeededCount})</option>
                      </select>

                      <span className="text-[10px] font-semibold text-zinc-500 uppercase ml-2">Type:</span>
                      <select
                        value={fixtureTypeFilter}
                        onChange={(e) => setFixtureTypeFilter(e.target.value)}
                        data-testid="fixture-type-filter"
                        className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none cursor-pointer"
                      >
                        <option value="ALL">All Types</option>
                        <option value="wall_4ft">4ft Wall</option>
                        <option value="wall_8ft">8ft Wall</option>
                        <option value="wall_12ft">12ft Wall</option>
                        <option value="endcap_3ft">3ft Endcap</option>
                        <option value="countertop">Countertop</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  {/* Fixtures Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="fixtures-grid">
                    {filteredFixtures.map((fixture) => (
                      <div
                        key={fixture.id}
                        data-testid={`fixture-card-${fixture.id}`}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Card Header: Code, Badges, Edit Button */}
                          <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-zinc-950 dark:text-white" data-testid={`fixture-code-${fixture.id}`}>
                                  {fixture.fixtureCode}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                  {fixture.fixtureTypeLabel}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">
                                {fixture.fixtureName}
                              </h4>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(fixture)}
                              data-testid={`btn-edit-fixture-${fixture.id}`}
                              className="px-2.5 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                            >
                              Edit ✏️
                            </button>
                          </div>

                          {/* Badges Status Strip */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              data-testid={`fixture-op-status-${fixture.id}`}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                fixture.operationalStatus === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300"
                                  : fixture.operationalStatus === "needs_maintenance"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300"
                                  : fixture.operationalStatus === "damaged"
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300"
                                  : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                              }`}
                            >
                              {fixture.operationalStatusLabel}
                            </span>

                            <span
                              data-testid={`fixture-inst-status-${fixture.id}`}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300"
                            >
                              {fixture.installationStatusLabel}
                            </span>

                            {fixture.hasHeaderSignage && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300">
                                ✨ Header Lightbox
                              </span>
                            )}
                          </div>

                          {/* Metadata Specs Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase block">Modular Bays</span>
                              <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 font-mono">
                                {fixture.bayCount} Bay{fixture.bayCount > 1 ? "s" : ""}
                              </p>
                              <span className="text-[10px] text-zinc-400">
                                {fixture.shelfCount} shelves per bay ({fixture.bayCount * fixture.shelfCount} total)
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase block">Store Location</span>
                              <p className="font-semibold text-zinc-900 dark:text-white mt-0.5 truncate" title={fixture.inStoreLocation || "Not specified"}>
                                {fixture.inStoreLocation || "Not specified"}
                              </p>
                              <span className="text-[10px] text-zinc-400">
                                {fixture.installationDate ? `Installed ${fixture.installationDate}` : "Pending install"}
                              </span>
                            </div>
                          </div>

                          {fixture.notes && (
                            <div className="p-2.5 rounded-lg bg-zinc-50/75 dark:bg-zinc-850 border border-zinc-150 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300">
                              📝 {fixture.notes}
                            </div>
                          )}
                        </div>

                        {/* Shelf & Product Placement Management (ADM-STORE-OPS-P3-003) */}
                        {(() => {
                          const isExpanded = Boolean(expandedFixturePlacements[fixture.id]);
                          const activePlacements = (fixture.placements || []).filter(
                            (p) => p.placementStatus !== "removed"
                          );
                          const activeBay = selectedBayByFixture[fixture.id] || 1;
                          const bayPlacements = activePlacements.filter(
                            (p) => p.bayNumber === activeBay
                          );
                          const totalBayCapacity = bayPlacements.reduce(
                            (acc, p) => acc + (p.capacityUnits || 0),
                            0
                          );

                          return (
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                              {/* Placements Header & Quick Toggle Bar */}
                              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-base">📦</span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                        Shelf Placements
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                          activePlacements.length > 0
                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                            : "bg-zinc-150 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                        }`}
                                        data-testid={`placements-count-${fixture.id}`}
                                      >
                                        {activePlacements.length} {activePlacements.length === 1 ? "Slot" : "Slots"} Occupied
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 block truncate">
                                      {fixture.bayCount} Bay{fixture.bayCount > 1 ? "s" : ""} · {fixture.shelfCount} Shelves/Bay · {activePlacements.length} Active Positions
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFixturePlacements(fixture.id)}
                                    data-testid={`btn-manage-placements-${fixture.id}`}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                      isExpanded
                                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs"
                                        : "bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-700"
                                    }`}
                                  >
                                    <span>{isExpanded ? "Hide Planogram ▴" : "Manage Placements ▾"}</span>
                                  </button>
                                </div>
                              </div>

                              {/* If collapsed and has placements, show a compact preview strip */}
                              {!isExpanded && activePlacements.length > 0 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-thin text-[10px]">
                                  <span className="text-zinc-400 font-semibold uppercase text-[9px] shrink-0">
                                    Assigned:
                                  </span>
                                  {activePlacements.slice(0, 4).map((p) => (
                                    <span
                                      key={p.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shrink-0 font-medium"
                                    >
                                      <span className="font-mono font-bold text-zinc-500">
                                        B{p.bayNumber}S{p.shelfLevel}P{p.positionSlot}
                                      </span>
                                      <span className="max-w-[100px] truncate">{p.productName}</span>
                                    </span>
                                  ))}
                                  {activePlacements.length > 4 && (
                                    <span className="text-zinc-400 font-bold shrink-0">
                                      +{activePlacements.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Expanded Planogram Layout View */}
                              {isExpanded && (
                                <div
                                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-750 bg-zinc-50/50 dark:bg-zinc-850/40 space-y-3"
                                  data-testid={`fixture-planogram-${fixture.id}`}
                                >
                                  {/* Bay Switcher Tabs & Top Action */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200/70 dark:border-zinc-700/60 pb-2.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                                        Bay Selection:
                                      </span>
                                      {Array.from({ length: fixture.bayCount }, (_, i) => i + 1).map((bayNum) => {
                                        const bayPlacementsCount = activePlacements.filter(
                                          (p) => p.bayNumber === bayNum
                                        ).length;
                                        const isBayActive = activeBay === bayNum;
                                        return (
                                          <button
                                            key={bayNum}
                                            type="button"
                                            onClick={() => handleSelectBay(fixture.id, bayNum)}
                                            data-testid={`bay-tab-${fixture.id}-${bayNum}`}
                                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                              isBayActive
                                                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs"
                                                : "bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                            }`}
                                          >
                                            <span>Bay {bayNum}</span>
                                            <span
                                              className={`px-1 py-0.2 rounded text-[9px] font-mono ${
                                                isBayActive
                                                  ? "bg-zinc-700 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900"
                                                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                              }`}
                                            >
                                              {bayPlacementsCount}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                                        Cap: {totalBayCapacity} units
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenAssignPlacementModal(fixture, activeBay)}
                                        data-testid={`btn-assign-slot-${fixture.id}`}
                                        className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                      >
                                        <span>+ Assign Product</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Shelves Column for Selected Bay (Top to Bottom: shelfCount down to 1) */}
                                  <div className="space-y-2.5">
                                    {Array.from({ length: fixture.shelfCount }, (_, idx) => fixture.shelfCount - idx).map((shelfNum) => {
                                      const shelfPlacements = bayPlacements.filter(
                                        (p) => p.shelfLevel === shelfNum
                                      );

                                      return (
                                        <div
                                          key={shelfNum}
                                          data-testid={`shelf-row-${fixture.id}-b${activeBay}-s${shelfNum}`}
                                          className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2 shadow-2xs"
                                        >
                                          {/* Shelf Bar Header */}
                                          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-1.5 text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-mono">
                                                Shelf {shelfNum}
                                                {shelfNum === fixture.shelfCount
                                                  ? " (Top)"
                                                  : shelfNum === 1
                                                  ? " (Base)"
                                                  : ""}
                                              </span>
                                              <span className="text-[10px] text-zinc-400">
                                                {shelfPlacements.length > 0
                                                  ? `${shelfPlacements.length} product${shelfPlacements.length > 1 ? "s" : ""} placed`
                                                  : "Empty Shelf"}
                                              </span>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleOpenAssignPlacementModal(fixture, activeBay, shelfNum)
                                              }
                                              data-testid={`btn-add-to-shelf-${fixture.id}-b${activeBay}-s${shelfNum}`}
                                              className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                            >
                                              <span>+ Add Product</span>
                                            </button>
                                          </div>

                                          {/* Shelf Placements Slots */}
                                          {shelfPlacements.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                              {shelfPlacements.map((plc) => (
                                                <div
                                                  key={plc.id}
                                                  data-testid={`placement-card-${plc.id}`}
                                                  className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/60 dark:border-zinc-750 flex flex-col justify-between gap-2 text-xs hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                                                >
                                                  <div className="flex items-start gap-2">
                                                    {/* Product Thumbnail */}
                                                    <div className="w-10 h-10 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                                      {plc.thumbnailUrl ? (
                                                        <img
                                                          src={plc.thumbnailUrl}
                                                          alt={plc.productName}
                                                          className="w-full h-full object-cover"
                                                        />
                                                      ) : (
                                                        <span className="text-zinc-400 text-sm">💄</span>
                                                      )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                      <div className="flex items-center justify-between gap-1">
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-200/80 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                                                          Pos #{plc.positionSlot}
                                                        </span>
                                                        <span
                                                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                                            plc.placementStatus === "active"
                                                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                              : plc.placementStatus === "planned"
                                                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                                          }`}
                                                        >
                                                          {plc.placementStatusLabel}
                                                        </span>
                                                      </div>

                                                      <p
                                                        className="font-bold text-zinc-900 dark:text-white mt-1 text-[11px] leading-tight line-clamp-1"
                                                        title={plc.productName}
                                                      >
                                                        {plc.productName}
                                                      </p>
                                                      {plc.brandName && (
                                                        <span className="text-[10px] text-zinc-400 block truncate">
                                                          {plc.brandName}
                                                        </span>
                                                      )}
                                                      <span className="text-[10px] font-mono text-zinc-500 block">
                                                        SKU: {plc.sku}
                                                      </span>
                                                    </div>
                                                  </div>

                                                  {/* Slot Capacity & Facings Footer + Actions */}
                                                  <div className="flex items-center justify-between pt-1 border-t border-zinc-150 dark:border-zinc-800 text-[10px]">
                                                    <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                                                      <span className="font-semibold">{plc.facingCount}F</span>
                                                      <span>·</span>
                                                      <span>Cap: {plc.capacityUnits}u</span>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenEditPlacementModal(fixture, plc)}
                                                        data-testid={`btn-edit-placement-${plc.id}`}
                                                        className="px-1.5 py-0.5 rounded text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-700 transition-all cursor-pointer font-medium"
                                                      >
                                                        Edit
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleOpenUnassignConfirm(fixture, plc)}
                                                        data-testid={`btn-unassign-placement-${plc.id}`}
                                                        className="px-1.5 py-0.5 rounded text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer font-medium"
                                                      >
                                                        Unassign
                                                      </button>
                                                    </div>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            /* Empty Shelf Position State (UI-only, No DB writes per Prompt requirement) */
                                            <div
                                              data-testid={`empty-shelf-${fixture.id}-b${activeBay}-s${shelfNum}`}
                                              className="p-2.5 rounded border border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400"
                                            >
                                              <span className="text-[11px]">
                                                Empty shelf — No products assigned to Shelf {shelfNum}.
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleOpenAssignPlacementModal(fixture, activeBay, shelfNum)
                                                }
                                                data-testid={`btn-empty-shelf-assign-${fixture.id}-b${activeBay}-s${shelfNum}`}
                                                className="px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-[10px] font-bold transition-all cursor-pointer"
                                              >
                                                + Place Product Here
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: STORE ACTIVITIES */}
          {activeTab === "activities" && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4" data-testid="tab-content-activities">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                  Future Phase Planned
                </span>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Store Field Visits & On-Site Activities
                </h3>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-2xl">
                Field representative store inspections, photo logs, and assigned operational tasks will be tracked here in future phases. Retailer support tickets linked to this store can be viewed under Retailer 360°.
              </p>
              <div className="pt-2">
                <Link
                  href={`/admin/retailers/${selectedStore.companyId}?tab=support`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs"
                >
                  <span>View Store Support Inquiries in Retailer 360° ↗</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* STORE LIST VIEW (Default) */
        <div className="space-y-4" data-testid="store-list-view">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-400">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by store name, code, retailer, city, state..."
                  data-testid="store-search-input"
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white transition-all"
                />
              </div>

              {/* Retailer Filter */}
              <select
                value={retailerFilter}
                onChange={(e) => setRetailerFilter(e.target.value)}
                data-testid="retailer-filter-select"
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Retailers</option>
                {data.retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.companyCode ? `(${r.companyCode})` : ""}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="status-filter-select"
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearFilters}
                data-testid="clear-filters-btn"
                className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer shrink-0"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Stores Table */}
          <div className="rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs" data-testid="stores-table">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/50 text-[10px] font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 uppercase tracking-wider">
                    <th className="px-4 py-3">Store Name & Code</th>
                    <th className="px-4 py-3">Parent Retailer</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Contact & Manager</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {filteredStores.length > 0 ? (
                    filteredStores.map((store) => (
                      <tr
                        key={store.id}
                        data-testid={`store-row-${store.id}`}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-850/20 transition-colors"
                      >
                        {/* 1. Store Name & Code */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-900 dark:text-white text-xs">
                              {store.name}
                            </span>
                            {store.storeCode ? (
                              <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {store.storeCode}
                              </span>
                            ) : (
                              <span className="text-[9px] text-zinc-400 italic mt-0.5">
                                No Store Code
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Parent Retailer */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/retailers/${store.companyId}`}
                              className="font-semibold text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                            >
                              {store.companyName}
                            </Link>
                            {store.companyCode && (
                              <span className="font-mono text-[9px] text-zinc-400">
                                {store.companyCode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. Location */}
                        <td className="px-4 py-3 text-zinc-650 dark:text-zinc-350">
                          {store.city || store.state ? (
                            <div>
                              <span>{[store.city, store.state].filter(Boolean).join(", ")}</span>
                              {store.zip && <span className="text-zinc-400 font-mono text-[10px] ml-1">({store.zip})</span>}
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Location Not Set</span>
                          )}
                        </td>

                        {/* 4. Contact & Manager */}
                        <td className="px-4 py-3 text-zinc-650 dark:text-zinc-350">
                          <div>
                            {store.managerName ? (
                              <span className="font-medium text-zinc-900 dark:text-white">
                                {store.managerName}
                              </span>
                            ) : (
                              <span className="text-zinc-400 italic">No Manager</span>
                            )}
                            {store.phone && (
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                📞 {store.phone}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold border ${
                              store.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/40 dark:text-emerald-300"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                            }`}
                          >
                            {store.status.toUpperCase()}
                          </span>
                        </td>

                        {/* 6. Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleSelectStore(store.id)}
                            data-testid={`view-store-btn-${store.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <span>View Details</span>
                            <span>→</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-zinc-400 text-xs italic">
                        {isFilterActive
                          ? "No stores match the selected search and filter criteria."
                          : "No authorized store records found in the database."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-150 dark:border-zinc-800 text-[11px] text-zinc-500 bg-zinc-50/50 dark:bg-zinc-900/50">
              <span>
                Showing {filteredStores.length} of {data.totalStoresCount} stores
              </span>
              <span>Authoritative Source: public.stores</span>
            </div>
          </div>
        </div>
      )}

      {/* Fixture Modal (Register / Edit) */}
      {isFixtureModalOpen && (
        <div
          data-testid="fixture-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
        >
          <div
            data-testid="fixture-modal-card"
            className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150 my-8"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white" data-testid="fixture-modal-title">
                  {fixtureModalMode === "edit" ? `Edit Fixture: ${editingFixture?.fixtureCode}` : "Register New Display Fixture"}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Store: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{selectedStore?.name}</span> ({selectedStore?.id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFixtureModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div
                data-testid="fixture-modal-error"
                className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300 text-xs font-medium"
              >
                ⚠ {formError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveFixture} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fixture Code */}
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Fixture Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LA01-W01, VOOR-EC01"
                    value={formFixtureCode}
                    onChange={(e) => setFormFixtureCode(e.target.value.toUpperCase())}
                    data-testid="input-fixture-code"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Unique store identifier</span>
                </div>

                {/* Fixture Name */}
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Fixture Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Perimeter Wall Display"
                    value={formFixtureName}
                    onChange={(e) => setFormFixtureName(e.target.value)}
                    data-testid="input-fixture-name"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Descriptive display title</span>
                </div>
              </div>

              {/* Fixture Type Preset */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Hardware Model / Preset <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formFixtureType}
                  onChange={(e) => handleFormTypeChange(e.target.value as FixtureType)}
                  data-testid="select-fixture-type"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white cursor-pointer"
                >
                  <option value="wall_4ft">4ft Modular Wall (1 Bay)</option>
                  <option value="wall_8ft">8ft Modular Wall (2 Bays)</option>
                  <option value="wall_12ft">12ft Modular Wall (3 Bays)</option>
                  <option value="endcap_3ft">3ft Feature Endcap</option>
                  <option value="countertop">Countertop Display</option>
                  <option value="custom">Custom Display Unit</option>
                </select>
              </div>

              {/* Bay Count & Shelf Count */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Modular Bays <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    required
                    value={formBayCount}
                    onChange={(e) => setFormBayCount(parseInt(e.target.value) || 1)}
                    data-testid="input-bay-count"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">4ft=1, 8ft=2, 12ft=3</span>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Shelves per Bay <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    required
                    value={formShelfCount}
                    onChange={(e) => setFormShelfCount(parseInt(e.target.value) || 5)}
                    data-testid="input-shelf-count"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Physical shelf levels</span>
                </div>
              </div>

              {/* Header Signage Checkbox */}
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-800/40">
                <input
                  type="checkbox"
                  id="hasHeaderSignage"
                  checked={formHasHeaderSignage}
                  onChange={(e) => setFormHasHeaderSignage(e.target.checked)}
                  data-testid="checkbox-header-signage"
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
                <label htmlFor="hasHeaderSignage" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                  Fixture includes illuminated top header signage or branded lightbox banner
                </label>
              </div>

              {/* Location in Store */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Location within Store
                </label>
                <input
                  type="text"
                  placeholder="e.g. Front Entrance Wall, Section A"
                  value={formInStoreLocation}
                  onChange={(e) => setFormInStoreLocation(e.target.value)}
                  data-testid="input-store-location"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                />
              </div>

              {/* Statuses: Operational & Installation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formOperationalStatus}
                    onChange={(e) => setFormOperationalStatus(e.target.value as FixtureOperationalStatus)}
                    data-testid="select-operational-status"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="active">Active / Operational</option>
                    <option value="needs_maintenance">Needs Maintenance</option>
                    <option value="damaged">Damaged</option>
                    <option value="retired">Retired / Out of Service</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Installation Status
                  </label>
                  <select
                    value={formInstallationStatus}
                    onChange={(e) => setFormInstallationStatus(e.target.value as FixtureInstallationStatus)}
                    data-testid="select-installation-status"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="planned">Planned (Pending Delivery)</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered to Store</option>
                    <option value="installed">Installed</option>
                    <option value="inspected">Inspected & Verified</option>
                    <option value="retired">Retired / Decommissioned</option>
                  </select>
                </div>
              </div>

              {/* Installation Date & Installer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Installation Date
                  </label>
                  <input
                    type="date"
                    value={formInstallationDate}
                    onChange={(e) => setFormInstallationDate(e.target.value)}
                    data-testid="input-installation-date"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Installed By
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Fixture Solutions"
                    value={formInstalledBy}
                    onChange={(e) => setFormInstalledBy(e.target.value)}
                    data-testid="input-installed-by"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Fixture Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional hardware details, lighting wattage, or maintenance history..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  data-testid="input-fixture-notes"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsFixtureModalOpen(false)}
                  data-testid="btn-cancel-fixture"
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  data-testid="btn-submit-fixture"
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <span>
                    {formSubmitting
                      ? "Saving..."
                      : fixtureModalMode === "register"
                      ? "Register Fixture"
                      : "Save Changes"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Placement Modal (Assign / Edit) — ADM-STORE-OPS-P3-003 */}
      {isPlacementModalOpen && targetFixtureForPlacement && (
        <div
          data-testid="placement-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            data-testid="placement-modal-card"
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white" data-testid="placement-modal-title">
                  {placementModalMode === "edit" ? "Edit Shelf Placement" : "Assign Product to Shelf"}
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Fixture: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{targetFixtureForPlacement.fixtureCode}</span> ({targetFixtureForPlacement.fixtureName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlacementModalOpen(false)}
                data-testid="btn-close-placement-modal"
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {placementFormError && (
              <div
                data-testid="placement-modal-error"
                className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-300 text-xs font-medium"
              >
                ⚠ {placementFormError}
              </div>
            )}

            {/* Placement Form */}
            <form onSubmit={handleSavePlacement} className="space-y-4 text-xs" data-testid="form-placement">
              {/* Coordinates: Bay, Shelf, Position */}
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Fixture Slot Coordinates
                </span>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* Bay Selection */}
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Bay <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={placementBayNumber}
                      onChange={(e) => setPlacementBayNumber(Number(e.target.value))}
                      data-testid="select-placement-bay"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                    >
                      {Array.from({ length: targetFixtureForPlacement.bayCount || 1 }, (_, i) => i + 1).map((b) => (
                        <option key={b} value={b}>
                          Bay {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Shelf Level */}
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Shelf Level <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={placementShelfLevel}
                      onChange={(e) => setPlacementShelfLevel(Number(e.target.value))}
                      data-testid="select-placement-shelf"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                    >
                      {Array.from({ length: targetFixtureForPlacement.shelfCount || 5 }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>
                          Shelf {s} {s === targetFixtureForPlacement.shelfCount ? "(Top)" : s === 1 ? "(Base)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Position Slot */}
                  <div>
                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Slot # <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={25}
                      required
                      value={placementPositionSlot}
                      onChange={(e) => setPlacementPositionSlot(Number(e.target.value))}
                      data-testid="input-placement-slot"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Product Selection (Filtered strictly to Store Assortment) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Product (Store Assortment) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-zinc-400">
                    {filteredAssortmentProducts.length} carried SKU{filteredAssortmentProducts.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Product Search Input */}
                <input
                  type="text"
                  placeholder="Search carried products by name, brand, SKU..."
                  value={placementProductSearch}
                  onChange={(e) => setPlacementProductSearch(e.target.value)}
                  data-testid="input-placement-product-search"
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                />

                {/* Product Selector Dropdown */}
                <select
                  required
                  value={placementProductId}
                  onChange={(e) => setPlacementProductId(e.target.value)}
                  data-testid="select-placement-product"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                >
                  <option value="" disabled>
                    -- Select Store Product --
                  </option>
                  {filteredAssortmentProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      [{prod.sku}] {prod.brandName ? `${prod.brandName} - ` : ""}{prod.name}
                    </option>
                  ))}
                </select>

                {filteredAssortmentProducts.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    No matching products found in this store's carried assortment.
                  </p>
                )}
              </div>

              {/* Facing Count & Capacity Units */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Facing Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    required
                    value={placementFacingCount}
                    onChange={(e) => setPlacementFacingCount(Number(e.target.value))}
                    data-testid="input-placement-facings"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Number of visual facings (1–10)</span>
                </div>

                <div>
                  <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Capacity Units <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    required
                    value={placementCapacityUnits}
                    onChange={(e) => setPlacementCapacityUnits(Number(e.target.value))}
                    data-testid="input-placement-capacity"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Max display shelf depth capacity</span>
                </div>
              </div>

              {/* Placement Status */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Placement Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={placementStatus}
                  onChange={(e) => setPlacementStatus(e.target.value as "active" | "planned" | "clearance")}
                  data-testid="select-placement-status"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white"
                >
                  <option value="active">Active (On Shelf Now)</option>
                  <option value="planned">Planned (Reset / Upcoming)</option>
                  <option value="clearance">Clearance (Promotional Sell-through)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Placement Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Eye level feature position, reset approved by regional lead"
                  value={placementNotes}
                  onChange={(e) => setPlacementNotes(e.target.value)}
                  data-testid="input-placement-notes"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-white resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPlacementModalOpen(false)}
                  data-testid="btn-cancel-placement"
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={placementSubmitting || !placementProductId}
                  data-testid="btn-submit-placement"
                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <span>
                    {placementSubmitting
                      ? "Saving..."
                      : placementModalMode === "assign"
                      ? "Assign Placement"
                      : "Save Changes"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unassign Confirmation Modal — ADM-STORE-OPS-P3-003 */}
      {unassignTarget && (
        <div
          data-testid="unassign-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div
            data-testid="unassign-modal-card"
            className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl text-amber-500">⚠</span>
              <div>
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white" data-testid="unassign-modal-title">
                  Unassign Product from Shelf?
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                  Are you sure you want to unassign <span className="font-semibold text-zinc-900 dark:text-white">{unassignTarget.placement.productName}</span> from Bay {unassignTarget.placement.bayNumber}, Shelf {unassignTarget.placement.shelfLevel}, Slot #{unassignTarget.placement.positionSlot}?
                </p>
                <p className="text-[11px] text-zinc-400 mt-2">
                  This sets the placement status to "removed" and frees up the slot for reassignment. No physical inventory quantities will be altered.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setUnassignTarget(null)}
                data-testid="btn-cancel-unassign"
                className="px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={unassignSubmitting}
                onClick={handleExecuteUnassign}
                data-testid="btn-confirm-unassign"
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {unassignSubmitting ? "Unassigning..." : "Unassign Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
