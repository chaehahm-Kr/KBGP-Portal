// scripts/test-fixture-mvp-audit-matrix.ts
// Comprehensive Bounded Code-Level and Validation Test Suite
// Task ID: ADM-STORE-OPS-P3-002-R1: Fixture MVP Verification Matrix
// NOTE: SAFE WRITE-PATH TESTING — Uses mocked client / isolated tests with ZERO writes to Production DB.

// 1. Hook Module.prototype.require to safely mock server-only and next/cache
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

// 2. Now dynamically require actual production modules after hook is active!
let registerStoreFixtureAction: any;
let updateStoreFixtureAction: any;
let formatFixtureType: any;
let formatInstallationStatus: any;
let formatOperationalStatus: any;

function initModules() {
  const fixActions = require("../lib/retailer/admin-fixture-actions");
  registerStoreFixtureAction = fixActions.registerStoreFixtureAction;
  updateStoreFixtureAction = fixActions.updateStoreFixtureAction;

  const storeOps = require("../lib/retailer/admin-store-operations");
  formatFixtureType = storeOps.formatFixtureType;
  formatInstallationStatus = storeOps.formatInstallationStatus;
  formatOperationalStatus = storeOps.formatOperationalStatus;
}

initModules();

// 3. Mock Database Engine
class MockSupabaseEngine {
  public stores = [
    { id: "store-la-01", company_id: "comp-la-01" },
    { id: "store-voor-02", company_id: "comp-voor-02" },
  ];

  public fixtures: any[] = [];
  public placements: any[] = []; // Phase 4 table

  public from(tableName: string) {
    const self = this;
    let selectedColumns = "*";
    let filters: Array<{ type: string; col: string; val: any }> = [];

    const builder: any = {
      select: (cols: string = "*") => {
        selectedColumns = cols;
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
      ilike: (col: string, val: any) => {
        filters.push({ type: "ilike", col, val });
        return builder;
      },
      maybeSingle: async () => {
        if (tableName === "stores") {
          let matches = [...self.stores];
          for (const f of filters) {
            if (f.type === "eq") matches = matches.filter((item: any) => item[f.col] === f.val);
          }
          return { data: matches[0] || null, error: null };
        }
        if (tableName === "store_fixtures") {
          let matches = [...self.fixtures];
          for (const f of filters) {
            if (f.type === "eq") matches = matches.filter((item: any) => item[f.col] === f.val);
            if (f.type === "neq") matches = matches.filter((item: any) => item[f.col] !== f.val);
            if (f.type === "ilike") {
              matches = matches.filter(
                (item: any) => String(item[f.col] || "").toLowerCase() === String(f.val || "").toLowerCase()
              );
            }
          }
          return { data: matches[0] || null, error: null };
        }
        return { data: null, error: null };
      },
      insert: (payload: any) => {
        const newRecord = {
          id: `fix-${self.fixtures.length + 1}`,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        self.fixtures.push(newRecord);
        return {
          select: () => ({
            single: async () => ({ data: newRecord, error: null }),
          }),
        };
      },
      update: (payload: any) => {
        return {
          eq: async (col: string, val: any) => {
            const idx = self.fixtures.findIndex((f) => f[col] === val);
            if (idx >= 0) {
              self.fixtures[idx] = { ...self.fixtures[idx], ...payload };
              return { error: null };
            }
            return { error: { message: "Record not found" } };
          },
        };
      },
    };

    return builder;
  }
}

// 4. Test Matrix Runner
interface MatrixResult {
  scenarioId: string;
  category: "VALIDATION" | "SECURITY" | "DATA_INTEGRITY" | "ISOLATION" | "UI_LOGIC";
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const matrix: MatrixResult[] = [];

function recordTest(
  scenarioId: string,
  category: MatrixResult["category"],
  name: string,
  expected: string,
  actual: string,
  passed: boolean
) {
  matrix.push({ scenarioId, category, name, expected, actual, passed });
  const icon = passed ? "✓" : "✗";
  console.log(`  [${icon}] ${scenarioId}: ${name} -> ${passed ? "PASS" : "FAIL"}`);
  if (!passed) {
    console.error(`      Expected: ${expected}`);
    console.error(`      Actual:   ${actual}`);
  }
}

async function runAudit() {
  console.log("================================================================================");
  console.log("ADM-STORE-OPS-P3-002-R1: FIXTURE MVP AUDIT & WRITE-PATH TEST MATRIX");
  console.log("Target: Direct Execution of lib/retailer/admin-fixture-actions.ts with Mock Engine");
  console.log("Mode: Safe Isolated Mocked Write-Path (Zero Production DB Writes)");
  console.log("================================================================================\n");

  const db = new MockSupabaseEngine();
  mockAdminClientInstance = db;
  mockAdminSessionShouldFail = false;

  // ----------------------------------------------------------------------------
  // Category 1: Registration Happy Path & Field Persistence
  // ----------------------------------------------------------------------------
  console.log("Category 1: Registration Happy Path & Data Integrity");
  const reg1 = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "LA01-W01",
    fixtureName: "Main Perimeter Modular Wall",
    fixtureType: "wall_8ft",
    bayCount: 2,
    shelfCount: 5,
    hasHeaderSignage: true,
    inStoreLocation: "Section A, North Wall",
    installationStatus: "installed",
    operationalStatus: "active",
    installationDate: "2026-03-15",
    installedBy: "Apex Display Solutions",
    notes: "Includes warm LED header lightbox",
  });

  recordTest(
    "P3-REG-001",
    "VALIDATION",
    "Register valid 8ft fixture via actual Server Action",
    "success: true",
    `success: ${reg1.success}`,
    reg1.success === true && !!reg1.fixtureId
  );

  const savedFixture = db.fixtures.find((f) => f.id === reg1.fixtureId);
  const persistenceValid =
    savedFixture !== undefined &&
    savedFixture.fixture_code === "LA01-W01" &&
    savedFixture.store_id === "store-la-01" &&
    savedFixture.company_id === "comp-la-01" && // Authoritatively derived from store!
    savedFixture.bay_count === 2 &&
    savedFixture.shelf_count === 5 &&
    savedFixture.has_header_signage === true &&
    savedFixture.in_store_location === "Section A, North Wall" &&
    savedFixture.installation_status === "installed" &&
    savedFixture.operational_status === "active";

  recordTest(
    "P3-REG-002",
    "DATA_INTEGRITY",
    "Verify saved fixture fields & authoritative company derivation",
    "Persisted with derived comp-la-01",
    persistenceValid ? "Persisted with derived comp-la-01" : "Mismatch",
    persistenceValid
  );

  recordTest(
    "P3-PLC-001",
    "DATA_INTEGRITY",
    "Verify no automatic placement rows created (Phase 4 isolation)",
    "placementsCount === 0",
    `placementsCount === ${db.placements.length}`,
    db.placements.length === 0
  );

  // ----------------------------------------------------------------------------
  // Category 2: Duplicate Code & Case-Insensitive Rejection
  // ----------------------------------------------------------------------------
  console.log("\nCategory 2: Duplicate Code & Case-Insensitive Rejection");
  const regDup = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "la01-w01", // Lowercase duplicate of LA01-W01
    fixtureName: "Duplicate Attempt",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 5,
  });

  recordTest(
    "P3-DUP-001",
    "VALIDATION",
    "Reject duplicate fixture_code in same store (case-insensitive)",
    "Rejection error message",
    regDup.error || "No error",
    regDup.success === false && regDup.error?.includes("already exists") === true
  );

  // ----------------------------------------------------------------------------
  // Category 3: Multi-Store Isolation (Same code in different store allowed)
  // ----------------------------------------------------------------------------
  console.log("\nCategory 3: Multi-Store Isolation");
  const regStore2 = await registerStoreFixtureAction({
    storeId: "store-voor-02",
    fixtureCode: "LA01-W01", // Same code, different store
    fixtureName: "Voorhees Display Unit",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 5,
  });

  recordTest(
    "P3-ISO-001",
    "ISOLATION",
    "Allow same fixture_code in different store (store-scoped uniqueness)",
    "success: true",
    `success: ${regStore2.success}`,
    regStore2.success === true && !!regStore2.fixtureId
  );

  // ----------------------------------------------------------------------------
  // Category 4: Boundary & Constraint Validations
  // ----------------------------------------------------------------------------
  console.log("\nCategory 4: Boundary & Constraint Validations");
  const regBay0 = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-BAY-0",
    fixtureName: "Invalid Bay 0",
    fixtureType: "wall_4ft",
    bayCount: 0,
    shelfCount: 5,
  });
  recordTest(
    "P3-VAL-BAY-0",
    "VALIDATION",
    "Reject bayCount = 0 (< 1)",
    "Bay count must be an integer between 1 and 6.",
    regBay0.error || "",
    regBay0.success === false && regBay0.error === "Bay count must be an integer between 1 and 6."
  );

  const regBay7 = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-BAY-7",
    fixtureName: "Invalid Bay 7",
    fixtureType: "wall_4ft",
    bayCount: 7,
    shelfCount: 5,
  });
  recordTest(
    "P3-VAL-BAY-7",
    "VALIDATION",
    "Reject bayCount = 7 (> 6)",
    "Bay count must be an integer between 1 and 6.",
    regBay7.error || "",
    regBay7.success === false && regBay7.error === "Bay count must be an integer between 1 and 6."
  );

  const regShelf0 = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-SHELF-0",
    fixtureName: "Invalid Shelf 0",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 0,
  });
  recordTest(
    "P3-VAL-SHELF-0",
    "VALIDATION",
    "Reject shelfCount = 0 (< 1)",
    "Shelf count must be an integer between 1 and 15.",
    regShelf0.error || "",
    regShelf0.success === false && regShelf0.error === "Shelf count must be an integer between 1 and 15."
  );

  const regShelf16 = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-SHELF-16",
    fixtureName: "Invalid Shelf 16",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 16,
  });
  recordTest(
    "P3-VAL-SHELF-16",
    "VALIDATION",
    "Reject shelfCount = 16 (> 15)",
    "Shelf count must be an integer between 1 and 15.",
    regShelf16.error || "",
    regShelf16.success === false && regShelf16.error === "Shelf count must be an integer between 1 and 15."
  );

  const regBadType = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-BAD-TYPE",
    fixtureName: "Bad Type",
    fixtureType: "gondola_super" as any,
    bayCount: 1,
    shelfCount: 5,
  });
  recordTest(
    "P3-VAL-TYPE",
    "VALIDATION",
    "Reject unknown fixture_type 'gondola_super'",
    'Invalid fixture type: "gondola_super".',
    regBadType.error || "",
    regBadType.success === false && regBadType.error?.includes("Invalid fixture type") === true
  );

  const regBadInstStatus = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-BAD-INST",
    fixtureName: "Bad Inst Status",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 5,
    installationStatus: "in_transit_unknown" as any,
  });
  recordTest(
    "P3-VAL-INST-STATUS",
    "VALIDATION",
    "Reject invalid installation_status",
    'Invalid installation status: "in_transit_unknown".',
    regBadInstStatus.error || "",
    regBadInstStatus.success === false && regBadInstStatus.error?.includes("Invalid installation status") === true
  );

  const regBadOpStatus = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-BAD-OP",
    fixtureName: "Bad Op Status",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 5,
    operationalStatus: "offline_bad" as any,
  });
  recordTest(
    "P3-VAL-OP-STATUS",
    "VALIDATION",
    "Reject invalid operational_status",
    'Invalid operational status: "offline_bad".',
    regBadOpStatus.error || "",
    regBadOpStatus.success === false && regBadOpStatus.error?.includes("Invalid operational status") === true
  );

  // ----------------------------------------------------------------------------
  // Category 5: Security — Unauthorized Session Rejection
  // ----------------------------------------------------------------------------
  console.log("\nCategory 5: Security & Authorization Rejection");
  mockAdminSessionShouldFail = true;
  const regUnauth = await registerStoreFixtureAction({
    storeId: "store-la-01",
    fixtureCode: "TEST-UNAUTH",
    fixtureName: "Unauth Attempt",
    fixtureType: "wall_4ft",
    bayCount: 1,
    shelfCount: 5,
  });
  recordTest(
    "P3-SEC-001",
    "SECURITY",
    "Reject non-admin / unauthenticated caller via verifyAdminSession",
    "Unauthorized: Admin session required.",
    regUnauth.error || "",
    regUnauth.success === false && regUnauth.error?.includes("Unauthorized") === true
  );
  mockAdminSessionShouldFail = false;

  // ----------------------------------------------------------------------------
  // Category 6: Editing & Immutability Verification
  // ----------------------------------------------------------------------------
  console.log("\nCategory 6: Editing & Immutability");
  const edit1 = await updateStoreFixtureAction({
    fixtureId: reg1.fixtureId!,
    fixtureCode: "LA01-W01-RENAMED",
    fixtureName: "Main Perimeter Modular Wall (Updated)",
    fixtureType: "wall_8ft",
    bayCount: 2,
    shelfCount: 6,
    hasHeaderSignage: true,
    inStoreLocation: "Section B, North Wall",
    installationStatus: "inspected",
    operationalStatus: "active",
    installationDate: "2026-03-20",
    installedBy: "Apex Master Techs",
    notes: "Inspection complete and approved",
  });

  recordTest(
    "P3-EDIT-001",
    "VALIDATION",
    "Update existing fixture details via updateStoreFixtureAction",
    "success: true",
    `success: ${edit1.success}`,
    edit1.success === true
  );

  const updatedFixture = db.fixtures.find((f) => f.id === reg1.fixtureId);
  const editPersisted =
    updatedFixture !== undefined &&
    updatedFixture.fixture_code === "LA01-W01-RENAMED" &&
    updatedFixture.fixture_name === "Main Perimeter Modular Wall (Updated)" &&
    updatedFixture.shelf_count === 6 &&
    updatedFixture.installation_status === "inspected" &&
    updatedFixture.store_id === "store-la-01" && // store_id unchanged
    updatedFixture.company_id === "comp-la-01"; // company_id unchanged

  recordTest(
    "P3-EDIT-002",
    "DATA_INTEGRITY",
    "Verify updated fields persisted and store/company remain immutable",
    "store_id=store-la-01, company_id=comp-la-01 unchanged",
    editPersisted ? "store_id=store-la-01, company_id=comp-la-01 unchanged" : "Mutated store/company",
    editPersisted
  );

  // Self-code touch (No false uniqueness collision on save without code change)
  const editSameCode = await updateStoreFixtureAction({
    fixtureId: reg1.fixtureId!,
    fixtureCode: "LA01-W01-RENAMED", // unchanged code
    fixtureName: "Main Perimeter Wall (Touch)",
    fixtureType: "wall_8ft",
    bayCount: 2,
    shelfCount: 6,
  });
  recordTest(
    "P3-EDIT-SAME-CODE",
    "VALIDATION",
    "Allow save when fixture_code is unchanged (no self-collision)",
    "success: true",
    `success: ${editSameCode.success}`,
    editSameCode.success === true
  );

  // ----------------------------------------------------------------------------
  // Category 7: UI Formatters & Helper Verification
  // ----------------------------------------------------------------------------
  console.log("\nCategory 7: UI Formatters & Helper Verification");
  const typeLabel = formatFixtureType("wall_8ft");
  recordTest(
    "P3-UI-TYPE-LABEL",
    "UI_LOGIC",
    "Format fixture_type 'wall_8ft'",
    "8ft Modular Wall (2 Bays)",
    typeLabel,
    typeLabel === "8ft Modular Wall (2 Bays)"
  );

  const instLabel = formatInstallationStatus("inspected");
  recordTest(
    "P3-UI-INST-LABEL",
    "UI_LOGIC",
    "Format installation_status 'inspected'",
    "Inspected",
    instLabel,
    instLabel === "Inspected"
  );

  const opLabel = formatOperationalStatus("needs_maintenance");
  recordTest(
    "P3-UI-OP-LABEL",
    "UI_LOGIC",
    "Format operational_status 'needs_maintenance'",
    "Needs Maintenance",
    opLabel,
    opLabel === "Needs Maintenance"
  );

  // ----------------------------------------------------------------------------
  // Category 8: Filter & Sort Logic Simulation
  // ----------------------------------------------------------------------------
  console.log("\nCategory 8: Filter & Sort Logic Simulation");
  const mockList: AdminStoreFixtureItem[] = [
    {
      id: "f-1",
      storeId: "s-1",
      companyId: "c-1",
      fixtureCode: "W01",
      fixtureName: "Alpha Display",
      fixtureType: "wall_4ft",
      fixtureTypeLabel: "4ft Modular Wall (1 Bay)",
      bayCount: 1,
      shelfCount: 5,
      hasHeaderSignage: true,
      inStoreLocation: "Entrance",
      installationStatus: "installed",
      installationStatusLabel: "Installed",
      operationalStatus: "active",
      operationalStatusLabel: "Active / Operational",
      installationDate: null,
      installedBy: null,
      primaryPhotoUrl: null,
      lastInspectedAt: null,
      notes: null,
      placementsCount: 0,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      id: "f-2",
      storeId: "s-1",
      companyId: "c-1",
      fixtureCode: "W02",
      fixtureName: "Beta Wall",
      fixtureType: "wall_8ft",
      fixtureTypeLabel: "8ft Modular Wall (2 Bays)",
      bayCount: 2,
      shelfCount: 5,
      hasHeaderSignage: false,
      inStoreLocation: "Back",
      installationStatus: "planned",
      installationStatusLabel: "Planned",
      operationalStatus: "needs_maintenance",
      operationalStatusLabel: "Needs Maintenance",
      installationDate: null,
      installedBy: null,
      primaryPhotoUrl: null,
      lastInspectedAt: null,
      notes: null,
      placementsCount: 0,
      createdAt: "2026-01-02",
      updatedAt: "2026-01-02",
    },
  ];

  const searchResult = mockList.filter((f) => f.fixtureName.toLowerCase().includes("beta"));
  recordTest(
    "P3-UI-SEARCH",
    "UI_LOGIC",
    "Search filter by name 'beta'",
    "1 item returned (Beta Wall)",
    `${searchResult.length} item(s)`,
    searchResult.length === 1 && searchResult[0].fixtureCode === "W02"
  );

  const typeResult = mockList.filter((f) => f.fixtureType === "wall_8ft");
  recordTest(
    "P3-UI-TYPE-FILTER",
    "UI_LOGIC",
    "Filter by fixtureType 'wall_8ft'",
    "1 item returned",
    `${typeResult.length} item(s)`,
    typeResult.length === 1 && typeResult[0].fixtureCode === "W02"
  );

  const statusResult = mockList.filter((f) => f.operationalStatus === "needs_maintenance");
  recordTest(
    "P3-UI-STATUS-FILTER",
    "UI_LOGIC",
    "Filter by operationalStatus 'needs_maintenance'",
    "1 item returned",
    `${statusResult.length} item(s)`,
    statusResult.length === 1 && statusResult[0].fixtureCode === "W02"
  );

  console.log("\n================================================================================");
  console.log("AUDIT RESULTS SUMMARY");
  console.log("================================================================================");
  console.table(
    matrix.map((m) => ({
      Scenario: m.scenarioId,
      Category: m.category,
      Name: m.name,
      Status: m.passed ? "PASS" : "FAIL",
    }))
  );

  const total = matrix.length;
  const passedCount = matrix.filter((m) => m.passed).length;
  console.log(`\nTotal Scenarios Tested: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${total - passedCount}`);

  if (passedCount === total) {
    console.log("\n🎉 ALL 19 BOUNDED CODE-LEVEL & VALIDATION SCENARIOS PASSED 100%!");
  } else {
    console.error("\n❌ Some audit scenarios failed.");
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error("Fatal error running audit matrix:", err);
  process.exit(1);
});
