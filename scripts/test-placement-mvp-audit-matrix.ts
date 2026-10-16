// scripts/test-placement-mvp-audit-matrix.ts
// Comprehensive Bounded Code-Level and Validation Test Suite
// Task ID: ADM-STORE-OPS-P3-003: Shelf & SKU Placement Management MVP
// NOTE: SAFE WRITE-PATH TESTING — Uses mocked client / isolated tests with ZERO writes to Production DB.

const Module = require('module');
const origRequire = Module.prototype.require;

let mockAdminSessionShouldFail = false;
let mockAdminClientInstance: any = null;

Module.prototype.require = function (id: string) {
  if (id.includes('server-only')) return {};
  if (id === 'next/cache') {
    return {
      revalidatePath: (path: string) => {},
      revalidateTag: () => {},
    };
  }
  if (id.includes('/lib/auth/dal') || id.includes('\\lib\\auth\\dal')) {
    return {
      verifyAdminSession: async () => {
        if (mockAdminSessionShouldFail) {
          throw new Error("Unauthorized: Admin session required.");
        }
        return { userId: "mock-admin-1", email: "admin@kselect.com", role: "admin" };
      },
    };
  }
  if (id.includes('/lib/supabase/admin') || id.includes('\\lib\\supabase\\admin')) {
    return {
      createAdminClient: () => mockAdminClientInstance,
    };
  }
  return origRequire.apply(this, arguments);
};

// Require production modules after require hook
const fixtureActions = require("../lib/retailer/admin-fixture-actions");
const storeOps = require("../lib/retailer/admin-store-operations");

const {
  assignStoreFixturePlacementAction,
  updateStoreFixturePlacementAction,
  unassignStoreFixturePlacementAction,
  registerStoreFixtureAction,
} = fixtureActions;

const {
  formatPlacementStatus,
  formatFixtureType,
} = storeOps;

// Isolated Mock Supabase Database Engine
class MockSupabasePlacementEngine {
  public stores = [
    { id: "store-la-01", name: "K-Beauty LA Store 01", company_id: "comp-la-01" },
    { id: "store-voor-02", name: "K-Beauty Voorhees Store 02", company_id: "comp-voor-02" },
  ];

  public products = [
    { id: "prod-skn-001", name: "Barrier Repair Ceramide Serum", letusto_sku: "TEST-SKN-001", status: "selling" },
    { id: "prod-skn-002", name: "Brightening Triple-Vitamin Toner Pads", letusto_sku: "TEST-SKN-002", status: "selling" },
    { id: "prod-skn-003", name: "Cooling Hydrogel Eye Patches", letusto_sku: "TEST-SKN-003", status: "selling" },
    { id: "prod-unauthorized", name: "Unauthorized Catalog Item", letusto_sku: "UNAUTH-999", status: "selling" },
  ];

  public retailerStoreProducts = [
    { id: "rsp-1", store_id: "store-la-01", product_id: "prod-skn-001", is_active: true },
    { id: "rsp-2", store_id: "store-la-01", product_id: "prod-skn-002", is_active: true },
    { id: "rsp-3", store_id: "store-la-01", product_id: "prod-skn-003", is_active: true },
    // store-voor-02 has only prod-skn-001
    { id: "rsp-4", store_id: "store-voor-02", product_id: "prod-skn-001", is_active: true },
  ];

  public weeklyChecks: any[] = [];
  public retailerOrders: any[] = [];
  public storeInventory: any[] = [
    { id: "inv-1", store_id: "store-la-01", product_id: "prod-skn-001", current_stock: 45 },
  ];

  public fixtures = [
    {
      id: "fix-la-modular-8ft",
      store_id: "store-la-01",
      company_id: "comp-la-01",
      fixture_code: "LA01-W01",
      fixture_name: "Main 8ft Perimeter Wall",
      fixture_type: "wall_8ft",
      bay_count: 2,
      shelf_count: 5,
      operational_status: "active",
      installation_status: "installed",
    },
    {
      id: "fix-voor-4ft",
      store_id: "store-voor-02",
      company_id: "comp-voor-02",
      fixture_code: "VOOR-W01",
      fixture_name: "Single Bay Wall",
      fixture_type: "wall_4ft",
      bay_count: 1,
      shelf_count: 4,
      operational_status: "active",
      installation_status: "installed",
    },
  ];

  public placements: any[] = [];

  public from(tableName: string) {
    const self = this;
    let selectedCols = "*";
    let isHead = false;
    let isCount = false;
    let filters: Array<{ type: string; col: string; val: any }> = [];

    const builder: any = {
      select: (cols: string = "*", opts?: any) => {
        selectedCols = cols;
        if (opts?.head) isHead = true;
        if (opts?.count) isCount = true;
        return builder;
      },
      eq: (col: string, val: any) => {
        filters.push({ type: "eq", col, val });
        return builder;
      },
      neq: (col: string, val: any) => {
        filters.push({ type: "neq", col, val });
        return builder;
      },
      limit: (n: number) => {
        return builder;
      },
      maybeSingle: async () => {
        const rows = self.getRows(tableName, filters);
        return { data: rows[0] || null, error: null };
      },
      single: async () => {
        const rows = self.getRows(tableName, filters);
        return { data: rows[0] || null, error: null };
      },
      insert: (data: any) => {
        const item = {
          id: data.id || `plc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...data,
        };
        if (tableName === "store_fixture_placements") {
          self.placements.push(item);
        }
        return {
          select: (cols: string = "*") => ({
            single: async () => ({ data: item, error: null }),
            maybeSingle: async () => ({ data: item, error: null }),
          }),
          then: (resolve: any) => resolve({ data: item, error: null }),
        };
      },
      update: (data: any) => {
        return {
          eq: async (col: string, val: any) => {
            if (tableName === "store_fixture_placements") {
              const row = self.placements.find((p) => p[col] === val);
              if (row) {
                Object.assign(row, data, { updated_at: new Date().toISOString() });
              }
              return { error: null };
            }
            return { error: null };
          },
        };
      },
      delete: () => {
        return {
          eq: async (col: string, val: any) => {
            if (tableName === "store_fixture_placements") {
              const idx = self.placements.findIndex((p) => p[col] === val);
              if (idx !== -1) self.placements.splice(idx, 1);
            }
            return { error: null };
          },
        };
      },
      then: (resolve: any) => {
        const rows = self.getRows(tableName, filters);
        if (isCount) {
          resolve({ count: rows.length, data: isHead ? null : rows, error: null });
        } else {
          resolve({ data: rows, error: null });
        }
      },
    };

    return builder;
  }

  private getRows(tableName: string, filters: any[]) {
    let source: any[] = [];
    if (tableName === "stores") source = this.stores;
    else if (tableName === "products") source = this.products;
    else if (tableName === "store_fixtures") source = this.fixtures;
    else if (tableName === "store_fixture_placements") source = this.placements;
    else if (tableName === "retailer_store_products") source = this.retailerStoreProducts;
    else if (tableName === "retailer_weekly_checks") source = this.weeklyChecks;
    else if (tableName === "retailer_orders") source = this.retailerOrders;
    else if (tableName === "store_inventory") source = this.storeInventory;

    let res = [...source];
    for (const f of filters) {
      if (f.type === "eq") res = res.filter((it: any) => it[f.col] === f.val);
      if (f.type === "neq") res = res.filter((it: any) => it[f.col] !== f.val);
    }
    return res;
  }
}

// Test Runner
async function runMatrix() {
  console.log("================================================================================");
  console.log("ADM-STORE-OPS-P3-003: Shelf & SKU Placement Management MVP — Test Matrix");
  console.log("Safe Write-Path Testing (Zero writes to Production DB)");
  console.log("================================================================================\n");

  const mockDb = new MockSupabasePlacementEngine();
  mockAdminClientInstance = mockDb;

  let passed = 0;
  let failed = 0;

  function assert(title: string, condition: boolean, detail: string = "") {
    if (condition) {
      console.log(`  ✓ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${title} -> ${detail}`);
      failed++;
    }
  }

  // Group 1: Server Authentication & Authorization
  console.log("Group 1: Server Authentication & Session Guard");
  mockAdminSessionShouldFail = true;
  const authFail = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "assignStoreFixturePlacementAction rejects unauthenticated call",
    authFail.success === false && authFail.error?.includes("Unauthorized"),
    JSON.stringify(authFail)
  );

  const authUpdateFail = await updateStoreFixturePlacementAction({
    placementId: "dummy-id",
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "updateStoreFixturePlacementAction rejects unauthenticated call",
    authUpdateFail.success === false && authUpdateFail.error?.includes("Unauthorized"),
    JSON.stringify(authUpdateFail)
  );

  const authUnassignFail = await unassignStoreFixturePlacementAction({
    placementId: "dummy-id",
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
  });
  assert(
    "unassignStoreFixturePlacementAction rejects unauthenticated call",
    authUnassignFail.success === false && authUnassignFail.error?.includes("Unauthorized"),
    JSON.stringify(authUnassignFail)
  );
  mockAdminSessionShouldFail = false;

  // Group 2: Cross-Store & Fixture Isolation
  console.log("\nGroup 2: Cross-Store & Fixture Isolation");
  const crossStoreFail = await assignStoreFixturePlacementAction({
    fixtureId: "fix-voor-4ft", // belongs to store-voor-02
    storeId: "store-la-01",    // mismatched store
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "Rejects assignment when fixture does not belong to specified store",
    crossStoreFail.success === false && crossStoreFail.error?.includes("Fixture does not belong"),
    JSON.stringify(crossStoreFail)
  );

  // Group 3: Coordinate Boundaries (Bay, Shelf, Slot, Facings, Capacity)
  console.log("\nGroup 3: Physical Fixture Coordinate Limits & Validation");
  // fix-la-modular-8ft has bayCount = 2, shelfCount = 5
  const bayOverflow = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 3, // exceeds bayCount=2
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "Rejects bayNumber exceeding fixture bayCount limit",
    bayOverflow.success === false && bayOverflow.error?.includes("Bay number must be between 1 and 2"),
    JSON.stringify(bayOverflow)
  );

  const shelfOverflow = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 6, // exceeds shelfCount=5
    positionSlot: 1,
  });
  assert(
    "Rejects shelfLevel exceeding fixture shelfCount limit",
    shelfOverflow.success === false && shelfOverflow.error?.includes("Shelf level must be between 1 and 5"),
    JSON.stringify(shelfOverflow)
  );

  const slotOverflow = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 26, // exceeds 25 limit
  });
  assert(
    "Rejects positionSlot exceeding maximum (25)",
    slotOverflow.success === false && slotOverflow.error?.includes("between 1 and 25"),
    JSON.stringify(slotOverflow)
  );

  const facingInvalid = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
    facingCount: 15,
  });
  assert(
    "Rejects facingCount > 10",
    facingInvalid.success === false && facingInvalid.error?.includes("between 1 and 10"),
    JSON.stringify(facingInvalid)
  );

  const capacityNegative = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
    capacityUnits: -5,
  });
  assert(
    "Rejects negative capacityUnits",
    capacityNegative.success === false && capacityNegative.error?.includes("between 0 and 200"),
    JSON.stringify(capacityNegative)
  );

  // Group 4: Store Assortment Eligibility Enforcement
  console.log("\nGroup 4: Store Assortment Eligibility Validation");
  // store-la-01 carries prod-skn-001, prod-skn-002, prod-skn-003. prod-unauthorized is NOT carried!
  const unauthProd = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-unauthorized",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "Rejects assignment of product not carried in store's assortment",
    unauthProd.success === false && unauthProd.error?.includes("not carried in this store's eligible assortment"),
    JSON.stringify(unauthProd)
  );

  // store-voor-02 carries ONLY prod-skn-001. Trying to assign prod-skn-002 to Voorhees should fail!
  const crossAssortment = await assignStoreFixturePlacementAction({
    fixtureId: "fix-voor-4ft",
    storeId: "store-voor-02",
    productId: "prod-skn-002",
    bayNumber: 1,
    shelfLevel: 1,
    positionSlot: 1,
  });
  assert(
    "Rejects product carried by another store but not this store",
    crossAssortment.success === false && crossAssortment.error?.includes("not carried in this store's eligible assortment"),
    JSON.stringify(crossAssortment)
  );

  // Group 5: Placement Creation & Duplicate Coordinate Prevention
  console.log("\nGroup 5: Placement Assignment & Collision Rules");
  const initialStock = mockDb.storeInventory[0].current_stock;

  const assignOk1 = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 2,
    positionSlot: 1,
    facingCount: 2,
    capacityUnits: 12,
    placementStatus: "active",
    notes: "Eye level anchor placement",
  });
  assert("Successfully assigns eligible product to Bay 1, Shelf 2, Slot 1", assignOk1.success === true && !!assignOk1.placementId);

  // Check that physical store inventory was NOT touched
  assert(
    "Assigning placement does NOT alter physical inventory stock (Zero stock mutation invariant)",
    mockDb.storeInventory[0].current_stock === initialStock,
    `Stock changed from ${initialStock} to ${mockDb.storeInventory[0].current_stock}`
  );

  // Attempt to assign another product to the exact same slot
  const collisionAssign = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-002",
    bayNumber: 1,
    shelfLevel: 2,
    positionSlot: 1,
  });
  assert(
    "Rejects assignment to already occupied slot coordinate",
    collisionAssign.success === false && collisionAssign.error?.includes("already occupied"),
    JSON.stringify(collisionAssign)
  );

  // Assign product to different Bay with same shelf and position (multi-bay independence)
  const assignBay2 = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-002",
    bayNumber: 2, // Bay 2 (different bay)
    shelfLevel: 2,
    positionSlot: 1,
  });
  assert(
    "Multi-bay independence: Assigning Bay 2, Shelf 2, Slot 1 succeeds without colliding with Bay 1",
    assignBay2.success === true && !!assignBay2.placementId
  );

  // Group 6: Edit Existing Placement
  console.log("\nGroup 6: Placement Editing & Coordinate Moves");
  const editOk = await updateStoreFixturePlacementAction({
    placementId: assignOk1.placementId!,
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-003", // change product
    bayNumber: 1,
    shelfLevel: 2,
    positionSlot: 1,
    facingCount: 3,
    capacityUnits: 18,
    placementStatus: "clearance",
    notes: "Updated note",
  });
  assert("Successfully updates product, facings, capacity, and status", editOk.success === true);

  const updatedRecord = mockDb.placements.find((p) => p.id === assignOk1.placementId);
  assert("Persistence check: product_id updated to prod-skn-003", updatedRecord?.product_id === "prod-skn-003");
  assert("Persistence check: facing_count updated to 3", updatedRecord?.facing_count === 3);
  assert("Persistence check: placement_status updated to clearance", updatedRecord?.placement_status === "clearance");

  // Attempt to move placement to Bay 2, Shelf 2, Slot 1 (which is occupied by assignBay2)
  const editCollision = await updateStoreFixturePlacementAction({
    placementId: assignOk1.placementId!,
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-003",
    bayNumber: 2,
    shelfLevel: 2,
    positionSlot: 1,
  });
  assert(
    "Rejects moving placement to a coordinate already occupied by another placement",
    editCollision.success === false && editCollision.error?.includes("already occupied"),
    JSON.stringify(editCollision)
  );

  // Group 7: Reversible Unassign & Position Reuse
  console.log("\nGroup 7: Reversible Unassign & Position Reuse (Constraint Safety)");
  const unassignRes = await unassignStoreFixturePlacementAction({
    placementId: assignOk1.placementId!,
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
  });
  assert("Unassign action succeeds", unassignRes.success === true);
  assert(
    "Placement status set to 'removed' (Reversible, not destructively deleted)",
    updatedRecord?.placement_status === "removed"
  );

  // Now assign a NEW product into the unassigned slot (Bay 1, Shelf 2, Slot 1)
  const reuseAssign = await assignStoreFixturePlacementAction({
    fixtureId: "fix-la-modular-8ft",
    storeId: "store-la-01",
    productId: "prod-skn-001",
    bayNumber: 1,
    shelfLevel: 2,
    positionSlot: 1,
    facingCount: 2,
    capacityUnits: 10,
    placementStatus: "active",
  });
  assert(
    "Reassigning to previously unassigned slot reactivates and updates slot without unique constraint collision",
    reuseAssign.success === true && reuseAssign.placementId === assignOk1.placementId
  );
  assert(
    "Reactivated slot is now 'active'",
    updatedRecord?.placement_status === "active" && updatedRecord?.product_id === "prod-skn-001"
  );

  // Group 8: Format Helpers
  console.log("\nGroup 8: Display Formatting Helpers");
  assert("formatPlacementStatus('active') === 'Active'", formatPlacementStatus("active") === "Active");
  assert("formatPlacementStatus('planned') === 'Planned'", formatPlacementStatus("planned") === "Planned");
  assert("formatPlacementStatus('clearance') === 'Clearance'", formatPlacementStatus("clearance") === "Clearance");
  assert("formatPlacementStatus('removed') === 'Removed'", formatPlacementStatus("removed") === "Removed");

  console.log("\n================================================================================");
  console.log(`Audit Matrix Result: ${passed} PASSED / ${failed} FAILED (Total: ${passed + failed})`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runMatrix().catch((e) => {
  console.error("Matrix execution error:", e);
  process.exit(1);
});
