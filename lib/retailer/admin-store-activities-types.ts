// lib/retailer/admin-store-activities-types.ts
// Store Operations Phase 4: Store Activities & Unified Timeline Types
// Specification: ADM-STORE-OPS-P4-002 / ADM-STORE-OPS-P4-003

export type ActivityType =
  | "store_visit"
  | "retailer_communication"
  | "merchandising_inspection"
  | "fixture_follow_up"
  | "inventory_follow_up"
  | "training_follow_up"
  | "operational_issue"
  | "general_note";

export type FollowUpStatus = "none" | "pending" | "completed" | "cancelled";

export interface ActivityTypeConfig {
  type: ActivityType;
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  badgeVariant: "amber" | "blue" | "purple" | "emerald" | "orange" | "zinc" | "rose" | "teal";
  description: string;
}

export const ACTIVITY_TYPE_CONFIGS: Record<ActivityType, ActivityTypeConfig> = {
  store_visit: {
    type: "store_visit",
    label: "Store Visit",
    shortLabel: "Visit",
    icon: "🏢",
    color: "amber",
    badgeVariant: "amber",
    description: "On-site physical store walkthrough, meeting, or observation.",
  },
  retailer_communication: {
    type: "retailer_communication",
    label: "Retailer Communication",
    shortLabel: "Call/Email",
    icon: "📞",
    color: "blue",
    badgeVariant: "blue",
    description: "Phone call, email, or messaging communication with store manager or owner.",
  },
  merchandising_inspection: {
    type: "merchandising_inspection",
    label: "Merchandising & Display",
    shortLabel: "Display",
    icon: "✨",
    color: "purple",
    badgeVariant: "purple",
    description: "K-Beauty shelf appearance, cleanliness, tester condition, and POP inspection.",
  },
  fixture_follow_up: {
    type: "fixture_follow_up",
    label: "Fixture Follow-up",
    shortLabel: "Fixture",
    icon: "💄",
    color: "teal",
    badgeVariant: "teal",
    description: "Display rack assembly, header graphic lighting, shelf repairs, or maintenance.",
  },
  inventory_follow_up: {
    type: "inventory_follow_up",
    label: "Inventory Follow-up",
    shortLabel: "Inventory",
    icon: "📋",
    color: "emerald",
    badgeVariant: "emerald",
    description: "Weekly count audit, out-of-stock resolution, or urgent reorder support.",
  },
  training_follow_up: {
    type: "training_follow_up",
    label: "Staff Training Follow-up",
    shortLabel: "Training",
    icon: "🎓",
    color: "orange",
    badgeVariant: "orange",
    description: "Store employee knowledge quiz encouragement and educational follow-up.",
  },
  operational_issue: {
    type: "operational_issue",
    label: "Operational Claim/Issue",
    shortLabel: "Issue",
    icon: "⚠️",
    color: "rose",
    badgeVariant: "rose",
    description: "Delivery discrepancy, damaged packaging, customer claim, or operational friction.",
  },
  general_note: {
    type: "general_note",
    label: "General Operations Note",
    shortLabel: "Note",
    icon: "📝",
    color: "zinc",
    badgeVariant: "zinc",
    description: "Store hours adjustment, staff changes, holiday schedules, or general memo.",
  },
};

export interface AdminStoreActivityEditEntry {
  timestamp: string;
  adminId: string;
  adminName: string;
  changedFields: string[];
}

export interface AdminStoreActivity {
  id: string;
  storeId: string;
  companyId: string;
  activityType: ActivityType;
  activityTypeLabel: string;
  title: string;
  description: string | null;
  activityDate: string; // YYYY-MM-DD
  responsibleAdminId: string;
  responsibleAdminName: string;
  hasFollowUp: boolean;
  followUpDate: string | null; // YYYY-MM-DD
  followUpStatus: FollowUpStatus;
  followUpStatusLabel: string;
  followUpNote: string | null;
  completedAt: string | null;
  completedBy: string | null;
  completedByName?: string | null;
  metadata: Record<string, any>;
  editHistory: AdminStoreActivityEditEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type TimelineSourceType =
  | "manual"
  | "order"
  | "fulfillment"
  | "inventory_check"
  | "fixture"
  | "training";

export interface StoreTimelineItem {
  id: string; // Stable unique ID (e.g. `act_${id}`, `ord_${id}`, etc.)
  sourceType: TimelineSourceType;
  timestamp: string; // ISO string for sorting
  date: string; // YYYY-MM-DD for grouping
  title: string;
  subtitle?: string | null;
  description?: string | null;
  categoryLabel: string;
  badgeVariant: "amber" | "blue" | "purple" | "emerald" | "orange" | "zinc" | "rose" | "teal";
  icon: string;
  actorName: string;
  hasFollowUp?: boolean;
  followUpStatus?: FollowUpStatus;
  followUpDate?: string | null;
  followUpNote?: string | null;
  targetTab?: "overview" | "inventory" | "orders" | "sales" | "training" | "fixtures" | "activities";
  manualActivity?: AdminStoreActivity;
}

export interface ActivityKpiSummary {
  totalActivitiesCount: number;
  manualActivitiesCount: number;
  automaticEventsCount: number;
  pendingFollowUpsCount: number;
  overdueFollowUpsCount: number;
  completedFollowUpsCount: number;
}

export interface AdminStoreActivitiesOverview {
  storeId: string;
  storeName: string;
  companyId: string;
  companyName: string;
  isSchemaPending: boolean;
  schemaPendingMessage?: string;
  kpis: ActivityKpiSummary;
  manualActivities: AdminStoreActivity[];
  timelineItems: StoreTimelineItem[];
}

export interface CreateStoreActivityInput {
  storeId: string;
  activityType: ActivityType;
  title: string;
  description?: string | null;
  activityDate: string; // YYYY-MM-DD
  responsibleAdminId: string;
  responsibleAdminName: string;
  hasFollowUp: boolean;
  followUpDate?: string | null;
  followUpNote?: string | null;
  metadata?: Record<string, any>;
}

export interface UpdateStoreActivityInput {
  activityId: string;
  activityType?: ActivityType;
  title?: string;
  description?: string | null;
  activityDate?: string;
  responsibleAdminId?: string;
  responsibleAdminName?: string;
  hasFollowUp?: boolean;
  followUpDate?: string | null;
  followUpNote?: string | null;
}
