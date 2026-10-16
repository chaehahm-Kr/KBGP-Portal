import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAdminSession } from "@/lib/auth/dal";
import {
  ActivityType,
  ACTIVITY_TYPE_CONFIGS,
  FollowUpStatus,
  AdminStoreActivity,
  StoreTimelineItem,
  ActivityKpiSummary,
  AdminStoreActivitiesOverview,
} from "./admin-store-activities-types";

/**
 * Resolves the Store Activities and Unified Timeline data for a specific store.
 * Reuses authoritative orders, fulfillments, inventory checks, and fixtures
 * while safely handling the pending store_activities table schema.
 */
export async function getAdminStoreActivitiesData(
  storeId: string
): Promise<AdminStoreActivitiesOverview | null> {
  await verifyAdminSession();
  const adminClient = createAdminClient();

  // 1. Fetch Store and Company metadata
  const { data: store, error: storeErr } = await adminClient
    .from("stores")
    .select(`
      id,
      name,
      company_id,
      companies:companies!stores_company_id_fkey (
        id,
        name,
        company_code
      )
    `)
    .eq("id", storeId)
    .maybeSingle();

  if (storeErr || !store) {
    console.error("[getAdminStoreActivitiesData] Store not found:", storeErr);
    return null;
  }

  const company = Array.isArray(store.companies) ? store.companies[0] : store.companies;
  const companyId = store.company_id;
  const companyName = company?.name || "Unknown Retailer";

  // 2. Fetch Manual Activities (with safe schema detection)
  let isSchemaPending = false;
  let schemaPendingMessage: string | undefined;
  let manualActivities: AdminStoreActivity[] = [];

  try {
    const { data: rawActivities, error: actErr } = await adminClient
      .from("store_activities")
      .select("*")
      .eq("store_id", storeId)
      .order("activity_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (actErr) {
      // Check if table does not exist yet (PostgreSQL error 42P01 or PostgREST error PGRST205)
      const errCode = (actErr as any).code;
      const errMsg = actErr.message || "";
      if (
        errCode === "PGRST205" ||
        errCode === "42P01" ||
        errMsg.includes("store_activities") ||
        errMsg.includes("schema cache")
      ) {
        isSchemaPending = true;
        schemaPendingMessage =
          "The store_activities table schema has not been applied to Production Supabase yet. Live manual activity writes are gated until Owner migration execution.";
      } else {
        console.warn("[getAdminStoreActivitiesData] Error querying store_activities:", actErr);
      }
    } else if (rawActivities) {
      manualActivities = rawActivities.map((row: any) => {
        const typeConfig = ACTIVITY_TYPE_CONFIGS[row.activity_type as ActivityType] || ACTIVITY_TYPE_CONFIGS.general_note;
        return {
          id: row.id,
          storeId: row.store_id,
          companyId: row.company_id,
          activityType: row.activity_type as ActivityType,
          activityTypeLabel: typeConfig.label,
          title: row.title,
          description: row.description || null,
          activityDate: row.activity_date,
          responsibleAdminId: row.responsible_admin_id,
          responsibleAdminName: row.responsible_admin_name || "Admin",
          hasFollowUp: Boolean(row.has_follow_up),
          followUpDate: row.follow_up_date || null,
          followUpStatus: (row.follow_up_status as FollowUpStatus) || "none",
          followUpStatusLabel: formatFollowUpStatus(row.follow_up_status),
          followUpNote: row.follow_up_note || null,
          completedAt: row.completed_at || null,
          completedBy: row.completed_by || null,
          completedByName: row.completed_by_name || null,
          metadata: row.metadata || {},
          editHistory: Array.isArray(row.edit_history) ? row.edit_history : [],
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
    }
  } catch (e: any) {
    isSchemaPending = true;
    schemaPendingMessage = "Database schema for store_activities is pending execution.";
  }

  // 3. Fetch Automatic Timeline Sources (Orders, Fulfillments, Weekly Checks, Fixtures)
  const timelineItems: StoreTimelineItem[] = [];

  // A. Manual activities to timeline items
  manualActivities.forEach((act) => {
    const config = ACTIVITY_TYPE_CONFIGS[act.activityType] || ACTIVITY_TYPE_CONFIGS.general_note;
    timelineItems.push({
      id: `act_${act.id}`,
      sourceType: "manual",
      timestamp: act.createdAt || `${act.activityDate}T12:00:00Z`,
      date: act.activityDate,
      title: act.title,
      subtitle: act.description,
      description: act.description,
      categoryLabel: config.label,
      badgeVariant: config.badgeVariant,
      icon: config.icon,
      actorName: act.responsibleAdminName,
      hasFollowUp: act.hasFollowUp,
      followUpStatus: act.followUpStatus,
      followUpDate: act.followUpDate,
      followUpNote: act.followUpNote,
      targetTab: "activities",
      manualActivity: act,
    });
  });

  // B. Real Orders for this store
  try {
    const { data: rawOrders } = await adminClient
      .from("retailer_orders")
      .select(`
        id,
        order_number,
        order_status,
        total_amount,
        total_items_count,
        total_ordered_units,
        placed_at,
        created_at
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(30);

    (rawOrders || []).forEach((ord: any) => {
      const orderDate = ord.placed_at || ord.created_at;
      const formattedTotal = Number(ord.total_amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      timelineItems.push({
        id: `ord_${ord.id}`,
        sourceType: "order",
        timestamp: orderDate,
        date: orderDate ? orderDate.split("T")[0] : new Date().toISOString().split("T")[0],
        title: `Order Placed (${ord.order_number || "Draft"})`,
        subtitle: `Order #${ord.order_number || "N/A"} • $${formattedTotal}`,
        description: `${ord.total_items_count || 0} product(s), ${ord.total_ordered_units || 0} units total. Status: ${ord.order_status || "Submitted"}.`,
        categoryLabel: "Order Placed",
        badgeVariant: "purple",
        icon: "📦",
        actorName: "Retailer Portal",
        targetTab: "orders",
      });
    });
  } catch (e) {
    console.warn("[getAdminStoreActivitiesData] Error querying orders for timeline:", e);
  }

  // C. Real Deliveries / Fulfillments for this store's orders
  try {
    const { data: rawFulfillments } = await adminClient
      .from("retailer_order_fulfillments")
      .select(`
        id,
        fulfillment_number,
        order_id,
        status,
        carrier,
        tracking_number,
        box_count,
        shipped_at,
        delivered_at,
        created_at,
        retailer_orders!inner (
          id,
          store_id,
          order_number
        )
      `)
      .eq("retailer_orders.store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(30);

    (rawFulfillments || []).forEach((ful: any) => {
      const fulDate = ful.delivered_at || ful.shipped_at || ful.created_at;
      const orderNum = (ful.retailer_orders as any)?.order_number || "Order";
      timelineItems.push({
        id: `ful_${ful.id}`,
        sourceType: "fulfillment",
        timestamp: fulDate,
        date: fulDate ? fulDate.split("T")[0] : new Date().toISOString().split("T")[0],
        title: `Shipment ${ful.status === "delivered" ? "Delivered" : "Dispatched"} (${orderNum})`,
        subtitle: `${ful.carrier || "Carrier"} • Tracking: ${ful.tracking_number || "Pending"}`,
        description: `Fulfillment #${ful.fulfillment_number || "N/A"} with ${ful.box_count || 1} package box(es).`,
        categoryLabel: "Delivery",
        badgeVariant: "teal",
        icon: "🚚",
        actorName: ful.carrier || "Logistics",
        targetTab: "orders",
      });
    });
  } catch (e) {
    console.warn("[getAdminStoreActivitiesData] Error querying fulfillments for timeline:", e);
  }

  // D. Real Weekly Inventory Checks for this store
  try {
    const { data: rawChecks } = await adminClient
      .from("retailer_weekly_checks")
      .select(`
        id,
        reporting_week,
        report_date,
        status,
        created_at
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(30);

    (rawChecks || []).forEach((chk: any) => {
      const chkDate = chk.report_date ? `${chk.report_date}T12:00:00Z` : chk.created_at;
      timelineItems.push({
        id: `chk_${chk.id}`,
        sourceType: "inventory_check",
        timestamp: chkDate,
        date: chk.report_date || (chk.created_at ? chk.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
        title: `Weekly Inventory Check (${chk.reporting_week || "Weekly Report"})`,
        subtitle: `Reporting Week: ${chk.reporting_week || "N/A"} • Status: ${chk.status || "Submitted"}`,
        description: "Official store inventory stock check submitted by on-site retailer personnel.",
        categoryLabel: "Inventory Check",
        badgeVariant: "emerald",
        icon: "📋",
        actorName: "Store Staff",
        targetTab: "inventory",
      });
    });
  } catch (e) {
    console.warn("[getAdminStoreActivitiesData] Error querying weekly checks for timeline:", e);
  }

  // E. Real Fixtures for this store
  try {
    const { data: rawFixtures } = await adminClient
      .from("store_fixtures")
      .select(`
        id,
        fixture_code,
        fixture_name,
        fixture_type,
        installation_status,
        installation_date,
        created_at
      `)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(30);

    (rawFixtures || []).forEach((fix: any) => {
      const fixDate = fix.installation_date ? `${fix.installation_date}T10:00:00Z` : fix.created_at;
      timelineItems.push({
        id: `fix_${fix.id}`,
        sourceType: "fixture",
        timestamp: fixDate,
        date: fix.installation_date || (fix.created_at ? fix.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
        title: `Store Fixture: ${fix.fixture_code}`,
        subtitle: `${fix.fixture_name} (${formatFixtureTypeName(fix.fixture_type)})`,
        description: `Installation status: ${fix.installation_status}. Configured for brand assortment.`,
        categoryLabel: "Store Fixture",
        badgeVariant: "amber",
        icon: "💄",
        actorName: "Admin Fixture Ops",
        targetTab: "fixtures",
      });
    });
  } catch (e) {
    console.warn("[getAdminStoreActivitiesData] Error querying fixtures for timeline:", e);
  }

  // 4. Sort all timeline items chronologically (newest first)
  timelineItems.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
  });

  // 5. Compute KPI Summary
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const pendingFollowUps = manualActivities.filter(
    (a) => a.hasFollowUp && a.followUpStatus === "pending"
  );
  const overdueFollowUps = pendingFollowUps.filter(
    (a) => a.followUpDate && a.followUpDate < todayStr
  );
  const completedFollowUps = manualActivities.filter(
    (a) => a.hasFollowUp && a.followUpStatus === "completed"
  );

  const kpis: ActivityKpiSummary = {
    totalActivitiesCount: timelineItems.length,
    manualActivitiesCount: manualActivities.length,
    automaticEventsCount: timelineItems.length - manualActivities.length,
    pendingFollowUpsCount: pendingFollowUps.length,
    overdueFollowUpsCount: overdueFollowUps.length,
    completedFollowUpsCount: completedFollowUps.length,
  };

  return {
    storeId: store.id,
    storeName: store.name,
    companyId,
    companyName,
    isSchemaPending,
    schemaPendingMessage,
    kpis,
    manualActivities,
    timelineItems,
  };
}

function formatFollowUpStatus(status?: string | null): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "none":
    default:
      return "None";
  }
}

function formatFixtureTypeName(type?: string | null): string {
  switch (type) {
    case "wall_4ft":
      return "4ft Modular Wall";
    case "wall_8ft":
      return "8ft Modular Wall";
    case "wall_12ft":
      return "12ft Modular Wall";
    case "endcap_3ft":
      return "3ft Endcap";
    case "countertop":
      return "Countertop Display";
    case "custom":
      return "Custom Fixture";
    default:
      return type || "Display Fixture";
  }
}
