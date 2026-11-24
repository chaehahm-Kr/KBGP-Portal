// Bootstrap require interceptor for 'server-only' in standalone node test
import Module from "module";
const origRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string, ...rest: any[]) {
  if (id === "server-only") return {};
  return origRequire.apply(this, [id, ...rest]);
};

async function main() {
  const { isEligibleForAudience } = await import("../lib/knowledge/distribution");
  const { isAuthorizedForAudience } = await import("../lib/knowledge/retrieval");
  const {
    getStoreKnowledgeItems,
    getStoreKnowledgeById,
    saveStoreKnowledgeItem,
    getStoreAuditLogs,
    addStoreAuditLog
  } = await import("../lib/knowledge/store");

  console.log("==================================================");
  console.log("ADM-KNOWLEDGE-DISTRIBUTION-001: Automated QA Suite");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${msg}`);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // Test Section 1: Distribution & Eligibility Matrix across all combinations
  // -------------------------------------------------------------------------
  console.log("\n--- Section 1: Audience Eligibility & Portal Isolation Matrix ---");

  const baseItem: any = {
    id: "test-dist-item",
    title: "Test Item",
    status: "PUBLISHED",
    audience: ["INTERNAL"],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: "APPROVED",
    type: "POLICY",
    source_type: "SYSTEM_SPEC",
    module: "SETTINGS",
    category: "General",
    tags: ["TEST"],
    current_version: "v1.0",
    effective_date: "2026-11-24",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Case 1: INTERNAL only
  const itemInternalOnly = { ...baseItem, audience: ["INTERNAL"] };
  assert(isEligibleForAudience(itemInternalOnly, "INTERNAL") === true, "INTERNAL-only item is eligible for INTERNAL");
  assert(isEligibleForAudience(itemInternalOnly, "BRAND") === false, "INTERNAL-only item is BLOCKED from BRAND portal");
  assert(isEligibleForAudience(itemInternalOnly, "RETAILER") === false, "INTERNAL-only item is BLOCKED from RETAIL portal");

  // Case 2: BRAND only
  const itemBrandOnly = { ...baseItem, audience: ["BRAND"] };
  assert(isEligibleForAudience(itemBrandOnly, "BRAND") === true, "BRAND-only item is eligible for BRAND");
  assert(isEligibleForAudience(itemBrandOnly, "INTERNAL") === false, "BRAND-only item is not in INTERNAL queries");
  assert(isEligibleForAudience(itemBrandOnly, "RETAILER") === false, "BRAND-only item is BLOCKED from RETAIL portal");

  // Case 3: RETAILER only
  const itemRetailerOnly = { ...baseItem, audience: ["RETAILER"] };
  assert(isEligibleForAudience(itemRetailerOnly, "RETAILER") === true, "RETAILER-only item is eligible for RETAIL");
  assert(isEligibleForAudience(itemRetailerOnly, "BRAND") === false, "RETAILER-only item is BLOCKED from BRAND portal");
  assert(isEligibleForAudience(itemRetailerOnly, "INTERNAL") === false, "RETAILER-only item is not in INTERNAL queries");

  // Case 4: BRAND + INTERNAL
  const itemBrandInternal = { ...baseItem, audience: ["BRAND", "INTERNAL"] };
  assert(isEligibleForAudience(itemBrandInternal, "BRAND") === true, "BRAND+INTERNAL item is eligible for BRAND");
  assert(isEligibleForAudience(itemBrandInternal, "INTERNAL") === true, "BRAND+INTERNAL item is eligible for INTERNAL");
  assert(isEligibleForAudience(itemBrandInternal, "RETAILER") === false, "BRAND+INTERNAL item is BLOCKED from RETAIL portal");

  // Case 5: RETAILER + INTERNAL
  const itemRetailInternal = { ...baseItem, audience: ["RETAILER", "INTERNAL"] };
  assert(isEligibleForAudience(itemRetailInternal, "RETAILER") === true, "RETAILER+INTERNAL item is eligible for RETAIL");
  assert(isEligibleForAudience(itemRetailInternal, "INTERNAL") === true, "RETAILER+INTERNAL item is eligible for INTERNAL");
  assert(isEligibleForAudience(itemRetailInternal, "BRAND") === false, "RETAILER+INTERNAL item is BLOCKED from BRAND portal");

  // Case 6: ALL THREE (INTERNAL + BRAND + RETAILER)
  const itemAllThree = { ...baseItem, audience: ["INTERNAL", "BRAND", "RETAILER"] };
  assert(isEligibleForAudience(itemAllThree, "INTERNAL") === true, "ALL-THREE item is eligible for INTERNAL");
  assert(isEligibleForAudience(itemAllThree, "BRAND") === true, "ALL-THREE item is eligible for BRAND");
  assert(isEligibleForAudience(itemAllThree, "RETAILER") === true, "ALL-THREE item is eligible for RETAIL");

  // -------------------------------------------------------------------------
  // Test Section 2: Sensitive Internal Document Leakage Prevention
  // -------------------------------------------------------------------------
  console.log("\n--- Section 2: Sensitive Internal Protection ---");

  const sensitiveItem = {
    ...baseItem,
    audience: ["INTERNAL", "BRAND", "RETAILER"],
    is_sensitive_internal: true
  };
  assert(isEligibleForAudience(sensitiveItem, "INTERNAL") === true, "Sensitive internal item allowed in INTERNAL");
  assert(isEligibleForAudience(sensitiveItem, "BRAND") === false, "Sensitive internal item BLOCKED from BRAND portal even if audience includes BRAND");
  assert(isEligibleForAudience(sensitiveItem, "RETAILER") === false, "Sensitive internal item BLOCKED from RETAILER portal even if audience includes RETAILER");

  // Contextual auth check
  const brandCtx = { userId: "usr-brand-01", role: "brand" as const };
  const retailCtx = { userId: "usr-retail-01", role: "retailer" as const };
  const adminCtx = { userId: "usr-admin-01", role: "admin" as const };

  assert(isAuthorizedForAudience(adminCtx, sensitiveItem) === true, "Admin is authorized for sensitive item");
  assert(isAuthorizedForAudience(brandCtx, sensitiveItem) === false, "Brand user is DENIED access to sensitive item");
  assert(isAuthorizedForAudience(retailCtx, sensitiveItem) === false, "Retailer user is DENIED access to sensitive item");

  // -------------------------------------------------------------------------
  // Test Section 3: Draft Status Exclusion
  // -------------------------------------------------------------------------
  console.log("\n--- Section 3: Draft Status Exclusion ---");

  const draftItem = {
    ...baseItem,
    status: "DRAFT",
    audience: ["INTERNAL", "BRAND", "RETAILER"]
  };
  assert(isEligibleForAudience(draftItem, "BRAND") === false, "DRAFT item is BLOCKED from BRAND portal");
  assert(isEligibleForAudience(draftItem, "RETAILER") === false, "DRAFT item is BLOCKED from RETAILER portal");
  assert(isEligibleForAudience(draftItem, "INTERNAL") === false, "DRAFT item is excluded from published distribution");

  // -------------------------------------------------------------------------
  // Test Section 4: Audit Existing 14 Manuals (Preservation Check)
  // -------------------------------------------------------------------------
  console.log("\n--- Section 4: Existing 14 Manuals Preservation Audit ---");

  const allItems = await getStoreKnowledgeItems();
  const publishedManuals = allItems.filter(i => i.type === "MANUAL" && i.status === "PUBLISHED");
  assert(publishedManuals.length === 14, `Exactly 14 PUBLISHED manuals found in repository (actual: ${publishedManuals.length})`);

  for (const item of publishedManuals) {
    if (item.id === "kno-manual-sop-v10") {
      assert(
        item.is_sensitive_internal === true,
        `[${item.id}] MAN-I-DOC-001 is_sensitive_internal is true`
      );
      assert(
        item.audience.includes("INTERNAL") && !item.audience.includes("BRAND") && !item.audience.includes("RETAILER"),
        `[${item.id}] MAN-I-DOC-001 has INTERNAL audience only`
      );
      assert(isEligibleForAudience(item, "BRAND") === false, `[${item.id}] BLOCKED from Brand portal`);
      assert(isEligibleForAudience(item, "RETAILER") === false, `[${item.id}] BLOCKED from Retailer portal`);
    } else {
      assert(item.audience.includes("BRAND"), `[${item.id}] contains BRAND audience`);
      assert(item.audience.includes("INTERNAL"), `[${item.id}] contains INTERNAL audience`);
      assert(!item.audience.includes("RETAILER"), `[${item.id}] DOES NOT contain RETAILER audience (preserved inactive)`);
      assert(isEligibleForAudience(item, "BRAND") === true, `[${item.id}] Eligible for Brand portal`);
      assert(isEligibleForAudience(item, "RETAILER") === false, `[${item.id}] Not eligible for Retailer portal`);
    }
  }

  // -------------------------------------------------------------------------
  // Test Section 5: Dynamic Mutation & Audit Log Persistence (Isolated Fixture)
  // -------------------------------------------------------------------------
  console.log("\n--- Section 5: Isolated Test Fixture Mutation & Audit Trail ---");

  const testFixtureId = `qa-fixture-${Date.now()}`;
  const now = new Date().toISOString();

  const testFixtureItem: any = {
    id: testFixtureId,
    title: "QA Test Distribution Fixture",
    title_ko: "QA 배포 컨트롤 테스트 픽스처",
    title_en: "QA Distribution Control Test Fixture",
    status: "PUBLISHED",
    audience: ["INTERNAL"],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: "APPROVED",
    type: "POLICY",
    source_type: "SYSTEM_SPEC",
    module: "SETTINGS",
    category: "General",
    tags: ["QA_TEST"],
    current_version: "v1.0",
    effective_date: "2026-11-24",
    created_at: now,
    updated_at: now
  };

  // 5.1 Save initial fixture
  await saveStoreKnowledgeItem(testFixtureItem);
  const loadedFixture = await getStoreKnowledgeById(testFixtureId);
  assert(loadedFixture !== null && loadedFixture.audience.length === 1, "Test fixture created with INTERNAL audience");

  // 5.2 Simulate PATCH to expand audience to ["INTERNAL", "BRAND"]
  const updatedAudiences1 = ["INTERNAL", "BRAND"];
  const patchItem1 = {
    ...loadedFixture!,
    audience: updatedAudiences1,
    updated_at: new Date().toISOString()
  };
  await saveStoreKnowledgeItem(patchItem1);

  // Add audit log
  await addStoreAuditLog({
    id: `log-test-${Date.now()}-1`,
    knowledge_id: testFixtureId,
    user_id: "usr-qa-agent",
    user_name: "QA Test Agent",
    action: "AUDIENCE_UPDATED",
    previous_value: { audience: loadedFixture!.audience },
    new_value: { audience: updatedAudiences1 },
    reason: "QA audience update: added BRAND",
    created_at: new Date().toISOString()
  });

  // Verify reload
  const reloaded1 = await getStoreKnowledgeById(testFixtureId);
  assert(
    reloaded1?.audience.includes("BRAND") && reloaded1?.audience.includes("INTERNAL"),
    "Fixture reloaded: audience successfully updated to INTERNAL + BRAND"
  );
  assert(isEligibleForAudience(reloaded1!, "BRAND") === true, "Fixture is now eligible for BRAND portal");
  assert(isEligibleForAudience(reloaded1!, "RETAILER") === false, "Fixture remains ineligible for RETAILER portal");

  // 5.3 Simulate PATCH to expand to all three ["INTERNAL", "BRAND", "RETAILER"]
  const updatedAudiences2 = ["INTERNAL", "BRAND", "RETAILER"];
  const patchItem2 = {
    ...reloaded1!,
    audience: updatedAudiences2,
    updated_at: new Date().toISOString()
  };
  await saveStoreKnowledgeItem(patchItem2);

  await addStoreAuditLog({
    id: `log-test-${Date.now()}-2`,
    knowledge_id: testFixtureId,
    user_id: "usr-qa-agent",
    user_name: "QA Test Agent",
    action: "AUDIENCE_UPDATED",
    previous_value: { audience: updatedAudiences1 },
    new_value: { audience: updatedAudiences2 },
    reason: "QA audience update: added RETAILER",
    created_at: new Date().toISOString()
  });

  // Verify reload
  const reloaded2 = await getStoreKnowledgeById(testFixtureId);
  assert(
    reloaded2?.audience.includes("RETAILER") && reloaded2?.audience.includes("BRAND"),
    "Fixture reloaded: audience successfully updated to ALL THREE"
  );
  assert(isEligibleForAudience(reloaded2!, "BRAND") === true, "Fixture is eligible for BRAND portal");
  assert(isEligibleForAudience(reloaded2!, "RETAILER") === true, "Fixture is eligible for RETAIL portal");

  // 5.4 Verify audit logs (returned descending by created_at)
  const logs = await getStoreAuditLogs(testFixtureId);
  assert(logs.length === 2, `Recorded 2 audit logs for fixture (actual: ${logs.length})`);
  const newestLog = logs[0];
  const olderLog = logs[1];
  assert(newestLog.action === "AUDIENCE_UPDATED", "Newest audit log is AUDIENCE_UPDATED");
  assert(olderLog.action === "AUDIENCE_UPDATED", "Older audit log is AUDIENCE_UPDATED");
  assert(
    newestLog.previous_value?.audience?.includes("BRAND") && newestLog.new_value?.audience?.includes("RETAILER"),
    "Newest audit log tracks previous and new audience values accurately"
  );

  console.log("\n==================================================");
  console.log(`QA Result: ${passedTests}/${totalTests} tests PASSED`);
  console.log("==================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Audit script failed with error:", err);
  process.exit(1);
});
