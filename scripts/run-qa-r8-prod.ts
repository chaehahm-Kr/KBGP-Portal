// Automated QA script for ADM-ACL-001-R8 / PORT-ACL-001-R8 verification
import { ACL_LEVEL_NUMERIC, ROLE_PRESETS } from "../lib/permissions/brand-portal-acl";

console.log("=== R8 ACL Matrix & Preset Verification ===");
console.log("ROLE_PRESETS.staff:", ROLE_PRESETS.staff);
console.log("ROLE_PRESETS.manager:", ROLE_PRESETS.manager);

const staffFinanceLevel = ROLE_PRESETS.staff.finance;
const managerCompanyInfoLevel = ROLE_PRESETS.manager.company_info;
const managerBankInfoLevel = ROLE_PRESETS.manager.bank_info;
const managerAgreementsLevel = ROLE_PRESETS.manager.agreements;

console.log(`Staff Finance Level: ${staffFinanceLevel} (read-only enforcement check: ${staffFinanceLevel === "read" ? "PASS" : "FAIL"})`);
console.log(`Manager Company Info Level: ${managerCompanyInfoLevel} (write enforcement check: ${managerCompanyInfoLevel === "write" ? "PASS" : "FAIL"})`);
console.log(`Manager Bank Info Level: ${managerBankInfoLevel} (sensitive bank separation check: ${managerBankInfoLevel === "read" ? "PASS" : "FAIL"})`);
console.log(`Manager Agreements Level: ${managerAgreementsLevel} (strict read-only enforcement check: ${managerAgreementsLevel === "read" ? "PASS" : "FAIL"})`);

if (
  staffFinanceLevel === "read" &&
  managerCompanyInfoLevel === "write" &&
  managerBankInfoLevel === "read" &&
  managerAgreementsLevel === "read"
) {
  console.log("✅ ACL Matrix Configuration Integrity: PASS");
} else {
  console.error("❌ ACL Matrix Configuration Integrity: FAIL");
  process.exit(1);
}
