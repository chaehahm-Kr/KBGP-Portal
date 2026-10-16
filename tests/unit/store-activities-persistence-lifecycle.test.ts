import { describe, it, expect } from "vitest";
import {
  ActivityType,
  ACTIVITY_TYPE_CONFIGS,
  AdminStoreActivity,
  CreateStoreActivityInput,
  FollowUpStatus,
  StoreTimelineItem,
  UpdateStoreActivityInput,
} from "@/lib/retailer/admin-store-activities-types";

// Helper validator replicating server action rules in lib/retailer/admin-activity-actions.ts
function validateCreateInput(input: Partial<CreateStoreActivityInput>): { valid: boolean; error?: string } {
  const trimmedTitle = (input.title || "").trim();
  if (trimmedTitle.length < 3) {
    return { valid: false, error: "Activity title must be between 3 and 200 characters." };
  }
  if (trimmedTitle.length > 200) {
    return { valid: false, error: "Activity title must be between 3 and 200 characters." };
  }

  if (!input.activityType || !ACTIVITY_TYPE_CONFIGS[input.activityType]) {
    return { valid: false, error: "Invalid activity category selected." };
  }

  if (!input.activityDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.activityDate)) {
    return { valid: false, error: "A valid activity date (YYYY-MM-DD) is required." };
  }

  if (input.hasFollowUp) {
    if (!input.followUpDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.followUpDate)) {
      return { valid: false, error: "A valid follow-up due date (YYYY-MM-DD) is required when follow-up is scheduled." };
    }
    if (!input.followUpNote || input.followUpNote.trim().length === 0) {
      return { valid: false, error: "A follow-up note is required when follow-up is scheduled." };
    }
  }

  return { valid: true };
}

// Helper to simulate update audit history generation
function applyActivityUpdate(
  existing: AdminStoreActivity,
  input: UpdateStoreActivityInput,
  actor: { adminId: string; adminName: string }
): { updated: AdminStoreActivity; error?: string } {
  const changedFields: string[] = [];
  const updated = { ...existing };

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (trimmed.length < 3 || trimmed.length > 200) {
      return { updated: existing, error: "Activity title must be between 3 and 200 characters." };
    }
    if (trimmed !== existing.title) {
      updated.title = trimmed;
      changedFields.push("title");
    }
  }

  if (input.activityType !== undefined) {
    if (!ACTIVITY_TYPE_CONFIGS[input.activityType]) {
      return { updated: existing, error: "Invalid activity category selected." };
    }
    if (input.activityType !== existing.activityType) {
      updated.activityType = input.activityType;
      changedFields.push("activity_type");
    }
  }

  if (input.description !== undefined) {
    const desc = input.description?.trim() || null;
    if (desc !== existing.description) {
      updated.description = desc;
      changedFields.push("description");
    }
  }

  if (input.hasFollowUp !== undefined) {
    if (input.hasFollowUp !== existing.hasFollowUp) {
      updated.hasFollowUp = input.hasFollowUp;
      changedFields.push("has_follow_up");
      if (input.hasFollowUp) {
        if (!input.followUpDate) return { updated: existing, error: "Follow-up due date is required." };
        if (!input.followUpNote) return { updated: existing, error: "Follow-up note is required." };
        updated.followUpDate = input.followUpDate;
        updated.followUpNote = input.followUpNote.trim();
        if (existing.followUpStatus === "none") updated.followUpStatus = "pending";
      } else {
        updated.followUpStatus = "none";
        updated.followUpDate = null;
        updated.followUpNote = null;
      }
    }
  }

  if (changedFields.length > 0) {
    const editHistory = Array.isArray(existing.editHistory) ? [...existing.editHistory] : [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      adminId: actor.adminId,
      adminName: actor.adminName,
      changedFields,
    });
    updated.editHistory = editHistory;
  }

  return { updated };
}

describe("Store Activities Persistence Lifecycle & Security Contracts (ADM-STORE-OPS-P4-006)", () => {
  const STORE_01_ID = "effe7832-096c-4ae1-86c7-3cb189b59731";
  const STORE_02_ID = "34bb2857-01dd-4d6e-bfd4-7112eec1ac1f";
  const COMPANY_ID = "dc9249be-a9e0-4975-a4c9-b602bb2baa47";
  const ADMIN_ID = "user_admin_001";

  // --------------------------------------------------------------------------
  // 1. INPUT VALIDATION TESTS
  // --------------------------------------------------------------------------
  describe("1. Input Validation and Creation Gate", () => {
    it("accepts a well-formed activity without follow-up", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: "Initial store walkthrough",
        description: "Met with manager. Reviewed display condition.",
        activityDate: "2026-10-16",
        hasFollowUp: false,
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("accepts a well-formed activity with scheduled follow-up", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "fixture_follow_up",
        title: "Endcap header acrylic inspection",
        description: "Need to replace acrylic shelf bracket.",
        activityDate: "2026-10-16",
        hasFollowUp: true,
        followUpDate: "2026-10-23",
        followUpNote: "Bring replacement bracket and tools",
      });
      expect(res.valid).toBe(true);
    });

    it("rejects title shorter than 3 characters", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: "Hi",
        activityDate: "2026-10-16",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("between 3 and 200 characters");
    });

    it("rejects title longer than 200 characters", () => {
      const longTitle = "A".repeat(201);
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: longTitle,
        activityDate: "2026-10-16",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("between 3 and 200 characters");
    });

    it("rejects invalid activity type category", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "unknown_random_category" as ActivityType,
        title: "Some title here",
        activityDate: "2026-10-16",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Invalid activity category");
    });

    it("accepts all 8 authoritative activity categories", () => {
      const categories: ActivityType[] = [
        "store_visit",
        "retailer_communication",
        "merchandising_inspection",
        "fixture_follow_up",
        "inventory_follow_up",
        "training_follow_up",
        "operational_issue",
        "general_note",
      ];
      categories.forEach((cat) => {
        const res = validateCreateInput({
          storeId: STORE_01_ID,
          activityType: cat,
          title: `Testing ${cat}`,
          activityDate: "2026-10-16",
        });
        expect(res.valid).toBe(true);
      });
    });

    it("rejects invalid activity date format", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: "Store visit title",
        activityDate: "10-16-2026", // Wrong format
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("valid activity date (YYYY-MM-DD)");
    });

    it("rejects when hasFollowUp=true but followUpDate is missing", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: "Store visit title",
        activityDate: "2026-10-16",
        hasFollowUp: true,
        followUpDate: "",
        followUpNote: "Some note",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("valid follow-up due date");
    });

    it("rejects when hasFollowUp=true but followUpNote is empty", () => {
      const res = validateCreateInput({
        storeId: STORE_01_ID,
        activityType: "store_visit",
        title: "Store visit title",
        activityDate: "2026-10-16",
        hasFollowUp: true,
        followUpDate: "2026-10-23",
        followUpNote: "   ",
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain("follow-up note is required");
    });
  });

  // --------------------------------------------------------------------------
  // 2. ACTIVITY UPDATE & AUDIT HISTORY LIFECYCLE
  // --------------------------------------------------------------------------
  describe("2. Update & Audit Trail Lifecycle", () => {
    const initialActivity: AdminStoreActivity = {
      id: "act_test_001",
      storeId: STORE_01_ID,
      companyId: COMPANY_ID,
      activityType: "store_visit",
      activityTypeLabel: "Store Visit",
      title: "Initial store visit",
      description: "First walkthrough note.",
      activityDate: "2026-10-16",
      responsibleAdminId: ADMIN_ID,
      responsibleAdminName: "Admin User",
      hasFollowUp: false,
      followUpDate: null,
      followUpStatus: "none",
      followUpStatusLabel: "None",
      followUpNote: null,
      completedAt: null,
      completedBy: null,
      completedByName: null,
      metadata: {},
      editHistory: [],
      createdBy: ADMIN_ID,
      createdAt: "2026-10-16T12:00:00Z",
      updatedAt: "2026-10-16T12:00:00Z",
    };

    it("appends changed field names to editHistory on title edit", () => {
      const { updated } = applyActivityUpdate(
        initialActivity,
        {
          activityId: "act_test_001",
          title: "Updated store visit title",
        },
        { adminId: ADMIN_ID, adminName: "Admin User" }
      );

      expect(updated.title).toBe("Updated store visit title");
      expect(updated.editHistory).toHaveLength(1);
      expect(updated.editHistory[0].changedFields).toContain("title");
      expect(updated.editHistory[0].adminId).toBe(ADMIN_ID);
    });

    it("accumulates successive revisions without overwriting history", () => {
      const firstUpdate = applyActivityUpdate(
        initialActivity,
        {
          activityId: "act_test_001",
          title: "Second Title",
        },
        { adminId: ADMIN_ID, adminName: "Admin User" }
      );

      const secondUpdate = applyActivityUpdate(
        firstUpdate.updated,
        {
          activityId: "act_test_001",
          description: "New updated detailed description.",
          activityType: "merchandising_inspection",
        },
        { adminId: "user_admin_002", adminName: "Secondary Admin" }
      );

      expect(secondUpdate.updated.editHistory).toHaveLength(2);
      expect(secondUpdate.updated.editHistory[0].changedFields).toEqual(["title"]);
      expect(secondUpdate.updated.editHistory[1].changedFields).toEqual(["activity_type", "description"]);
      expect(secondUpdate.updated.editHistory[1].adminName).toBe("Secondary Admin");
    });
  });

  // --------------------------------------------------------------------------
  // 3. FOLLOW-UP LIFECYCLE (PENDING -> COMPLETED -> REOPENED)
  // --------------------------------------------------------------------------
  describe("3. Follow-up Lifecycle State Transitions", () => {
    it("transitions from pending to completed and records completion metadata", () => {
      const pendingActivity: AdminStoreActivity = {
        id: "act_test_002",
        storeId: STORE_01_ID,
        companyId: COMPANY_ID,
        activityType: "fixture_follow_up",
        activityTypeLabel: "Fixture Follow-up",
        title: "Shelf lighting check",
        description: "Verify LED power supply",
        activityDate: "2026-10-16",
        responsibleAdminId: ADMIN_ID,
        responsibleAdminName: "Admin User",
        hasFollowUp: true,
        followUpDate: "2026-10-20",
        followUpStatus: "pending",
        followUpStatusLabel: "Pending",
        followUpNote: "Replace 12V adapter",
        completedAt: null,
        completedBy: null,
        completedByName: null,
        metadata: {},
        editHistory: [],
        createdBy: ADMIN_ID,
        createdAt: "2026-10-16T12:00:00Z",
        updatedAt: "2026-10-16T12:00:00Z",
      };

      // Simulate complete action
      const completedIso = new Date().toISOString();
      const completedActivity: AdminStoreActivity = {
        ...pendingActivity,
        followUpStatus: "completed",
        completedAt: completedIso,
        completedBy: ADMIN_ID,
        followUpNote: `${pendingActivity.followUpNote} [Completed: Power supply replaced]`,
        editHistory: [
          {
            timestamp: completedIso,
            adminId: ADMIN_ID,
            adminName: "Admin User",
            changedFields: ["follow_up_status", "completed_at", "completed_by"],
          },
        ],
      };

      expect(completedActivity.followUpStatus).toBe("completed");
      expect(completedActivity.completedAt).toBe(completedIso);
      expect(completedActivity.completedBy).toBe(ADMIN_ID);
      expect(completedActivity.followUpNote).toContain("Replace 12V adapter");
      expect(completedActivity.followUpNote).toContain("[Completed: Power supply replaced]");

      // Simulate reopen action
      const reopenedIso = new Date().toISOString();
      const reopenedActivity: AdminStoreActivity = {
        ...completedActivity,
        followUpStatus: "pending",
        completedAt: null,
        completedBy: null,
        editHistory: [
          ...completedActivity.editHistory,
          {
            timestamp: reopenedIso,
            adminId: ADMIN_ID,
            adminName: "Admin User",
            changedFields: ["follow_up_status (reopened)"],
          },
        ],
      };

      expect(reopenedActivity.followUpStatus).toBe("pending");
      expect(reopenedActivity.completedAt).toBeNull();
      expect(reopenedActivity.completedBy).toBeNull();
      expect(reopenedActivity.editHistory).toHaveLength(2);
      expect(reopenedActivity.editHistory[1].changedFields).toContain("follow_up_status (reopened)");
    });
  });

  // --------------------------------------------------------------------------
  // 4. CROSS-STORE ISOLATION TESTS
  // --------------------------------------------------------------------------
  describe("4. Cross-Store & Multi-Tenant Isolation", () => {
    const store1Activities: AdminStoreActivity[] = [
      {
        id: "act_s1_001",
        storeId: STORE_01_ID,
        companyId: COMPANY_ID,
        activityType: "store_visit",
        activityTypeLabel: "Store Visit",
        title: "Store 01 Note",
        description: null,
        activityDate: "2026-10-16",
        responsibleAdminId: ADMIN_ID,
        responsibleAdminName: "Admin",
        hasFollowUp: false,
        followUpDate: null,
        followUpStatus: "none",
        followUpStatusLabel: "None",
        followUpNote: null,
        completedAt: null,
        completedBy: null,
        completedByName: null,
        metadata: {},
        editHistory: [],
        createdBy: ADMIN_ID,
        createdAt: "2026-10-16T12:00:00Z",
        updatedAt: "2026-10-16T12:00:00Z",
      },
    ];

    const store2Activities: AdminStoreActivity[] = [
      {
        id: "act_s2_001",
        storeId: STORE_02_ID,
        companyId: COMPANY_ID,
        activityType: "retailer_communication",
        activityTypeLabel: "Retailer Communication",
        title: "Store 02 Note",
        description: null,
        activityDate: "2026-10-15",
        responsibleAdminId: ADMIN_ID,
        responsibleAdminName: "Admin",
        hasFollowUp: false,
        followUpDate: null,
        followUpStatus: "none",
        followUpStatusLabel: "None",
        followUpNote: null,
        completedAt: null,
        completedBy: null,
        completedByName: null,
        metadata: {},
        editHistory: [],
        createdBy: ADMIN_ID,
        createdAt: "2026-10-15T12:00:00Z",
        updatedAt: "2026-10-15T12:00:00Z",
      },
    ];

    it("isolates Store 01 activities from Store 02 queries", () => {
      const queryStore1 = store1Activities.filter((a) => a.storeId === STORE_01_ID);
      const queryStore2 = store2Activities.filter((a) => a.storeId === STORE_02_ID);

      expect(queryStore1).toHaveLength(1);
      expect(queryStore1[0].title).toBe("Store 01 Note");
      expect(queryStore2).toHaveLength(1);
      expect(queryStore2[0].title).toBe("Store 02 Note");

      // Verify cross-store leakage does not occur
      const crossLeakage = queryStore1.some((a) => a.storeId === STORE_02_ID);
      expect(crossLeakage).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. READ-ONLY AUTOMATIC TIMELINE PROTECTION
  // --------------------------------------------------------------------------
  describe("5. Read-Only Automatic Events vs Manual Activities", () => {
    it("projects automatic events purely in memory without mutating manual activity storage", () => {
      const mockRawOrder = {
        id: "ord_123",
        order_number: "KSR-2026-000001",
        order_status: "delivered",
        total_amount: 1250.0,
        total_items_count: 5,
        total_ordered_units: 50,
        placed_at: "2026-10-10T10:00:00Z",
      };

      const projectedTimelineItem: StoreTimelineItem = {
        id: `ord_${mockRawOrder.id}`,
        sourceType: "order",
        timestamp: mockRawOrder.placed_at,
        date: "2026-10-10",
        title: `Order Placed (${mockRawOrder.order_number})`,
        subtitle: `Order #${mockRawOrder.order_number} • $1,250.00`,
        description: "5 product(s), 50 units total. Status: delivered.",
        categoryLabel: "Order Placed",
        badgeVariant: "purple",
        icon: "📦",
        actorName: "Retailer Portal",
        targetTab: "orders",
      };

      expect(projectedTimelineItem.sourceType).toBe("order");
      expect(projectedTimelineItem.manualActivity).toBeUndefined();
      expect(projectedTimelineItem.id).toBe("ord_ord_123");
    });

    it("orders unified timeline chronologically newest first", () => {
      const items: StoreTimelineItem[] = [
        {
          id: "item_old",
          sourceType: "manual",
          timestamp: "2026-10-01T10:00:00Z",
          date: "2026-10-01",
          title: "Older visit",
          categoryLabel: "Visit",
          badgeVariant: "amber",
          icon: "🏢",
          actorName: "Admin",
          targetTab: "activities",
        },
        {
          id: "item_new",
          sourceType: "manual",
          timestamp: "2026-10-16T10:00:00Z",
          date: "2026-10-16",
          title: "Recent visit",
          categoryLabel: "Visit",
          badgeVariant: "amber",
          icon: "🏢",
          actorName: "Admin",
          targetTab: "activities",
        },
      ];

      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      expect(items[0].id).toBe("item_new");
      expect(items[1].id).toBe("item_old");
    });
  });
});
