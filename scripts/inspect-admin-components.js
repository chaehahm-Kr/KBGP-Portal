const fs = require("fs");
const path = require("path");

const files = [
  "components/admin/company-detail-manager.tsx",
  "components/admin/invoice-detail.tsx",
  "components/admin/retailer-360-view.tsx",
  "components/admin/purchase-order-detail.tsx",
  "components/admin/po-request-detail.tsx",
  "components/admin/payment-form.tsx",
  "components/admin/admin-partner-inquiries.tsx",
  "components/admin/header.tsx",
  "components/admin/knowledge/detail-view.tsx",
  "components/admin/knowledge/review-view.tsx",
  "components/admin/settings/attribute-list.tsx",
  "components/admin/settings/category-tree-list.tsx",
  "components/admin/settings/profile-list.tsx",
  "components/admin/pricing/saved-calculations-tab.tsx",
  "components/admin/pricing/scenario-settings-tab.tsx",
  "components/admin/pricing/calculator-tab.tsx",
];

files.forEach((f) => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, "utf8");
  const lines = content.split("\n");
  console.log(`\n=== File: ${f} ===`);
  lines.forEach((l, i) => {
    // Check if line contains destructive button/element or alert or secondary button without dark styles
    if (
      (l.includes("bg-rose-50") || l.includes("bg-red-50") || l.includes("bg-rose-100") || l.includes("bg-red-100") || l.includes("border-red-200") || l.includes("border-rose-200") || l.includes("border-red-100") || l.includes("border-rose-100")) &&
      (!l.includes("dark:bg-") || !l.includes("dark:border-") || !l.includes("dark:text-"))
    ) {
      console.log(`  L${i + 1}: ${l.trim().slice(0, 140)}`);
    }
  });
});
