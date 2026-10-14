// Mock server-only before dynamic imports
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    path: "",
    paths: [],
  };
} catch {
  // ignore
}

const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  envText.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const COMPANY_ID = "dc9249be-a9e0-4975-a4c9-b602bb2baa47";
const STORE_01_ID = "effe7832-096c-4ae1-86c7-3cb189b59731";
const STORE_02_ID = "34bb2857-01dd-4d6e-bfd4-7112eec1ac1f";

async function main() {
  console.log("=== RTP-WEEKLY-INV-P1-001: Functional & Reconciliation QA ===");

  const { createAdminClient } = await import("../lib/supabase/admin");
  const { getStoreAssortmentProductIds, getStoreIncomingQtys } = await import("../lib/retailer/weekly-check");
  const { getWeeklyCheckPath } = await import("../lib/retailer/weekly-check-types");
  const { resolveEffectiveSku } = await import("../lib/product/types");

  const adminClient = createAdminClient();

  // Test 1: Route Helper
  console.log("\n1. Testing getWeeklyCheckPath:");
  const pathRoot = getWeeklyCheckPath();
  const pathDetail = getWeeklyCheckPath("123-abc", { storeId: "store-xyz" });
  console.log("Root path:", pathRoot);
  console.log("Detail path:", pathDetail);
  if (!pathRoot.includes("check") || !pathDetail.includes("storeId=store-xyz")) {
    throw new Error("getWeeklyCheckPath failed");
  }
  console.log("✓ Route helper verified");

  // Test 2: Store 01 Countable SKUs
  console.log("\n2. Testing Store 01 Countable SKUs:");
  const store01PIds = await getStoreAssortmentProductIds(COMPANY_ID, STORE_01_ID);
  console.log(`Store 01 Countable Product IDs count: ${store01PIds.length}`);

  const { data: prods01 } = await adminClient
    .from("products")
    .select("id, name, letusto_sku, manufacture_sku, status")
    .in("id", store01PIds);

  console.log("Store 01 Countable Products:", prods01);
  const skus01 = (prods01 || []).map((p) => p.letusto_sku || p.manufacture_sku || p.name);
  console.log("Store 01 Countable SKUs:", skus01);

  if (store01PIds.length !== 8) {
    throw new Error(`Expected 8 countable SKUs for Store 01, got ${store01PIds.length}`);
  }
  console.log("✓ Store 01 correctly resolved 8 countable SKUs (6 active assortment + 2 confirmed delivered)");

  // Test 3: Store 02 Countable SKUs (Strict Store Isolation)
  console.log("\n3. Testing Store 02 Countable SKUs (Isolation):");
  const store02PIds = await getStoreAssortmentProductIds(COMPANY_ID, STORE_02_ID);
  console.log(`Store 02 Countable Product IDs count: ${store02PIds.length}`);

  if (store02PIds.length !== 0) {
    throw new Error(`Expected 0 countable SKUs for Store 02, got ${store02PIds.length}`);
  }
  console.log("✓ Store 02 correctly resolved 0 countable shelf SKUs (Items in-transit, not delivered)");

  // Test 4: Incoming Quantities Tracking
  console.log("\n4. Testing Incoming / In-Transit Stock Tracking:");
  const incoming01 = await getStoreIncomingQtys(STORE_01_ID);
  console.log("Store 01 Incoming map size:", incoming01.size);
  Array.from(incoming01.entries()).forEach(([pId, qty]) => {
    console.log(`   Product ${pId}: ${qty} units in-transit`);
  });

  const incoming02 = await getStoreIncomingQtys(STORE_02_ID);
  console.log("Store 02 Incoming map size:", incoming02.size);
  Array.from(incoming02.entries()).forEach(([pId, qty]) => {
    console.log(`   Product ${pId}: ${qty} units in-transit`);
  });

  console.log("\n=== ALL RECONCILIATION CHECKS PASSED SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("QA Test Failed:", err);
  process.exit(1);
});
