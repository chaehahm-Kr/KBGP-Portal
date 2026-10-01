const { ROLE_PRESETS, normalizePermissions } = require("../lib/permissions/brand-portal-acl");

function runQA() {
  console.log("=== ADM-ACL-001-R7 / PORT-ACL-001-R7 Local & Model QA ===");

  // Test 1: Check Viewer Preset
  console.log("\n1. Checking Viewer Preset...");
  const viewerPreset = ROLE_PRESETS.viewer;
  console.log("   - agreements level:", viewerPreset.agreements);
  console.log("   - bank_info level:", viewerPreset.bank_info);
  if (viewerPreset.agreements !== "none" || viewerPreset.bank_info !== "none") {
    throw new Error(`FAIL: Viewer preset agreements should be 'none', got '${viewerPreset.agreements}'`);
  }
  console.log("   PASS: Viewer preset sensitive permissions are 'none'.");

  // Test 2: Check Staff Preset
  console.log("\n2. Checking Staff Preset...");
  const staffPreset = ROLE_PRESETS.staff;
  console.log("   - application level:", staffPreset.application);
  console.log("   - agreements level:", staffPreset.agreements);
  console.log("   - bank_info level:", staffPreset.bank_info);
  if (staffPreset.application !== "write" || staffPreset.agreements !== "none" || staffPreset.bank_info !== "none") {
    throw new Error(`FAIL: Staff preset application should be 'write' and agreements 'none'`);
  }
  console.log("   PASS: Staff preset permissions updated correctly.");

  // Test 3: Check Manager Preset
  console.log("\n3. Checking Manager Preset...");
  const managerPreset = ROLE_PRESETS.manager;
  console.log("   - application level:", managerPreset.application);
  console.log("   - agreements level:", managerPreset.agreements);
  console.log("   - bank_info level:", managerPreset.bank_info);
  if (managerPreset.application !== "write" || managerPreset.agreements !== "read" || managerPreset.bank_info !== "read") {
    throw new Error(`FAIL: Manager preset permissions incorrect`);
  }
  console.log("   PASS: Manager preset permissions verified.");

  // Test 4: Check normalizePermissions legacy elevation removal
  console.log("\n4. Checking normalizePermissions Legacy Fallback Removal...");
  const normViewer = normalizePermissions({}, "viewer");
  console.log("   - Normalized Viewer agreements:", normViewer.agreements);
  console.log("   - Normalized Viewer bank_info:", normViewer.bank_info);
  if (normViewer.agreements !== "none" || normViewer.bank_info !== "none") {
    throw new Error(`FAIL: Normalized Viewer should have 'none' for sensitive tabs`);
  }

  const normCustomCompanyInfo = normalizePermissions({ company_info: "read" }, "viewer");
  console.log("   - Normalized company_info='read' agreements:", normCustomCompanyInfo.agreements);
  console.log("   - Normalized company_info='read' bank_info:", normCustomCompanyInfo.bank_info);
  if (normCustomCompanyInfo.agreements !== "none" || normCustomCompanyInfo.bank_info !== "none") {
    throw new Error(`FAIL: company_info='read' elevated agreements/bank_info automatically!`);
  }
  console.log("   PASS: Legacy fallback elevation completely removed.");

  console.log("\nALL R7 QA CHECKS PASSED SUCCESSFULLY!");
}

try {
  runQA();
} catch (err) {
  console.error("\nQA ERROR:", err.message);
  process.exit(1);
}
