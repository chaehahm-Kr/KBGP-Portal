// Mock 'server-only' for standalone node/tsx execution
import Module from "module";
// @ts-ignore
const origRequire = Module.prototype.require;
// @ts-ignore
Module.prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return origRequire.apply(this, arguments);
};

import {
  DEFAULT_MARKETING_FOOTER,
  buildMarketingFooterHtml,
  validateMarketingFooterCompleteness,
  assembleEmailWithMarketingFooter,
  MarketingFooterSettings,
  MarketingFooterStyle,
  FOOTER_START_MARKER,
  FOOTER_END_MARKER,
} from "../lib/brand-marketing/marketing-footer";
import {
  saveMarketingCampaign,
  getMarketingCampaignById,
  approveMarketingCampaign,
  listMarketingCampaigns,
} from "../lib/brand-marketing/campaign-data-access";

async function runFooterTests() {
  console.log("=================================================================");
  console.log("RUNNING MARKETING FOOTER STYLES TEST SUITE (ADM-EMAIL-FTR-001)");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      if (detail) console.error(`  Detail: ${detail}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Footer Completeness Validation
  // --------------------------------------------------------------------------
  console.log("--- Group 1: Footer Completeness Validation ---");

  const validCheck = validateMarketingFooterCompleteness(DEFAULT_MARKETING_FOOTER);
  assert(validCheck.isValid && validCheck.missingFields.length === 0, "Default footer settings are valid");

  const incompleteSettings: MarketingFooterSettings = {
    ...DEFAULT_MARKETING_FOOTER,
    physicalAddress: "",
    contactEmail: "invalid-email",
  };
  const invalidCheck = validateMarketingFooterCompleteness(incompleteSettings);
  assert(!invalidCheck.isValid && invalidCheck.missingFields.length === 2, "Incomplete footer settings properly detected");

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Footer Style Rendering (Classic, Minimal, Dark)
  // --------------------------------------------------------------------------
  console.log("\n--- Group 2: Footer Style HTML Generation ---");

  const sampleUnsubUrl = "https://admin.kselectnetwork.com/unsubscribe?token=test-unsub-token-123";

  // 2.1 Classic Style
  const classicHtmlKo = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
    style: "classic",
  });
  assert(classicHtmlKo.includes(FOOTER_START_MARKER) && classicHtmlKo.includes(FOOTER_END_MARKER), "Classic footer has proper start/end markers");
  assert(classicHtmlKo.includes("#FBF8F5") && classicHtmlKo.includes("#ECE7DF"), "Classic footer has warm background #FBF8F5 and border #ECE7DF");
  assert(classicHtmlKo.includes("text-align:center"), "Classic footer is center-aligned");
  assert(classicHtmlKo.includes(DEFAULT_MARKETING_FOOTER.brandDisplayName), "Classic footer includes Brand Display Name");
  assert(classicHtmlKo.includes(DEFAULT_MARKETING_FOOTER.physicalAddress), "Classic footer includes Physical Mailing Address");
  assert(classicHtmlKo.includes(`mailto:${DEFAULT_MARKETING_FOOTER.contactEmail}`), "Classic footer includes Contact Email mailto");
  assert(classicHtmlKo.includes(sampleUnsubUrl), "Classic footer includes working Unsubscribe URL");
  assert(classicHtmlKo.includes("수신거부 / Unsubscribe"), "Classic footer (ko) has Korean unsubscribe label");
  assert(classicHtmlKo.includes(DEFAULT_MARKETING_FOOTER.disclosureKo), "Classic footer (ko) has Korean disclosure text");

  const classicHtmlEn = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
    language: "en",
    unsubscribeUrl: sampleUnsubUrl,
    style: "classic",
  });
  assert(classicHtmlEn.includes("Unsubscribe / Opt-out"), "Classic footer (en) has English unsubscribe label");
  assert(classicHtmlEn.includes(DEFAULT_MARKETING_FOOTER.disclosureEn), "Classic footer (en) has English disclosure text");

  // 2.2 Minimal Style
  const minimalHtml = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
    style: "minimal",
  });
  assert(minimalHtml.includes(FOOTER_START_MARKER) && minimalHtml.includes(FOOTER_END_MARKER), "Minimal footer has proper start/end markers");
  assert(minimalHtml.includes("#FFFFFF") && minimalHtml.includes("#E4E4E7"), "Minimal footer has white background #FFFFFF and border #E4E4E7");
  assert(minimalHtml.includes("text-align:left"), "Minimal footer is left-aligned");
  assert(minimalHtml.includes(DEFAULT_MARKETING_FOOTER.brandDisplayName), "Minimal footer includes Brand Display Name");
  assert(minimalHtml.includes(DEFAULT_MARKETING_FOOTER.physicalAddress), "Minimal footer includes Physical Mailing Address");
  assert(minimalHtml.includes(`mailto:${DEFAULT_MARKETING_FOOTER.contactEmail}`), "Minimal footer includes Contact Email");
  assert(minimalHtml.includes(sampleUnsubUrl), "Minimal footer includes working Unsubscribe URL");

  // 2.3 Dark Style
  const darkHtml = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
    style: "dark",
  });
  assert(darkHtml.includes(FOOTER_START_MARKER) && darkHtml.includes(FOOTER_END_MARKER), "Dark footer has proper start/end markers");
  assert(darkHtml.includes("#18181B") && darkHtml.includes("#27272A"), "Dark footer has dark background #18181B and border #27272A");
  assert(darkHtml.includes("#FAFAFA"), "Dark footer has high-contrast light brand name #FAFAFA");
  assert(darkHtml.includes("#818CF8"), "Dark footer has high-contrast light indigo unsubscribe link #818CF8");
  assert(darkHtml.includes(DEFAULT_MARKETING_FOOTER.brandDisplayName), "Dark footer includes Brand Display Name");
  assert(darkHtml.includes(DEFAULT_MARKETING_FOOTER.physicalAddress), "Dark footer includes Physical Mailing Address");
  assert(darkHtml.includes(sampleUnsubUrl), "Dark footer includes working Unsubscribe URL");

  // 2.4 Default Style Fallback
  const defaultFallbackHtml = buildMarketingFooterHtml(DEFAULT_MARKETING_FOOTER, {
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
  });
  assert(defaultFallbackHtml.includes("#FBF8F5"), "Omitted style defaults to Classic (#FBF8F5)");

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Email Assembly & Idempotent Replacement
  // --------------------------------------------------------------------------
  console.log("\n--- Group 3: Email Assembly & Idempotence ---");

  const mockBaseEmail = `
<!DOCTYPE html>
<html>
<head><title>Test Proposal</title></head>
<body>
  <h1>Welcome to K SELECT</h1>
  <p>Here is our partnership proposal.</p>
</body>
</html>
`.trim();

  // Assemble with Minimal
  const assembledMinimal = assembleEmailWithMarketingFooter(mockBaseEmail, {
    footerSettings: DEFAULT_MARKETING_FOOTER,
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
    footerStyle: "minimal",
  });
  assert(assembledMinimal.includes("#FFFFFF") && assembledMinimal.includes("text-align:left"), "Email assembled with Minimal style");
  assert(
    (assembledMinimal.match(new RegExp(FOOTER_START_MARKER, "g")) || []).length === 1,
    "Exactly one FOOTER_START_MARKER in assembled email"
  );
  assert(
    (assembledMinimal.match(new RegExp(FOOTER_END_MARKER, "g")) || []).length === 1,
    "Exactly one FOOTER_END_MARKER in assembled email"
  );

  // Re-assemble (switch style to Dark)
  const reAssembledDark = assembleEmailWithMarketingFooter(assembledMinimal, {
    footerSettings: DEFAULT_MARKETING_FOOTER,
    language: "ko",
    unsubscribeUrl: sampleUnsubUrl,
    footerStyle: "dark",
  });
  assert(reAssembledDark.includes("#18181B"), "Re-assembled email switched to Dark style");
  assert(!reAssembledDark.includes("#E4E4E7"), "Old Minimal border removed without lingering duplicates");
  assert(
    (reAssembledDark.match(new RegExp(FOOTER_START_MARKER, "g")) || []).length === 1,
    "Exactly one FOOTER_START_MARKER after style re-assembly (idempotence verified)"
  );
  assert(
    (reAssembledDark.match(new RegExp(FOOTER_END_MARKER, "g")) || []).length === 1,
    "Exactly one FOOTER_END_MARKER after style re-assembly (idempotence verified)"
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Campaign Persistence & Lifecycle
  // --------------------------------------------------------------------------
  console.log("\n--- Group 4: Campaign-Level Persistence & Lifecycle ---");

  // 4.1 Save campaign with explicit Minimal footer style
  const campMinimal = await saveMarketingCampaign({
    name: "Test Minimal Footer Campaign",
    purpose: "Brand Outreach",
    language: "ko",
    footerStyle: "minimal",
    filterCriteria: {
      grades: ["A"],
    },
  });
  assert(campMinimal.footerStyle === "minimal", "Saved campaign has footerStyle === 'minimal'");

  // 4.2 Fetch back from store
  const fetchedMinimal = await getMarketingCampaignById(campMinimal.id);
  assert(fetchedMinimal.campaign?.footerStyle === "minimal", "Fetched campaign preserves footerStyle === 'minimal'");

  // 4.3 Save campaign with Dark footer style
  const campDark = await saveMarketingCampaign({
    name: "Test Dark Footer Campaign",
    purpose: "Brand Outreach",
    language: "ko",
    footerStyle: "dark",
  });
  assert(campDark.footerStyle === "dark", "Saved campaign has footerStyle === 'dark'");

  const fetchedDark = await getMarketingCampaignById(campDark.id);
  assert(fetchedDark.campaign?.footerStyle === "dark", "Fetched campaign preserves footerStyle === 'dark'");

  // 4.4 Historical campaign backward compatibility (no footerStyle provided)
  const campDefault = await saveMarketingCampaign({
    name: "Test Historical Campaign Without Style",
    purpose: "Brand Outreach",
    language: "ko",
  });
  assert(campDefault.footerStyle === "classic", "Campaign without explicit footerStyle defaults to 'classic'");

  const fetchedDefault = await getMarketingCampaignById(campDefault.id);
  assert(fetchedDefault.campaign?.footerStyle === "classic", "Historical campaign fetched returns 'classic'");

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`TEST RESULTS: ${passed}/${total} PASS (${Math.round((passed / total) * 100)}%)`);
  console.log("=================================================================");

  if (passed === total) {
    console.log("All Marketing Footer Style tests passed with 100% success!");
    process.exit(0);
  } else {
    console.error(`Failed ${total - passed} tests.`);
    process.exit(1);
  }
}

runFooterTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
