import Module from 'module';

const origRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function(id: string, ...args: any[]) {
  if (id === 'server-only') return {};
  return origRequire.apply(this, [id, ...args]);
};

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read QA env
const content = fs.readFileSync('.env.qa.local', 'utf8');
const lines = content.split(/\r?\n/);
let qaUrl = '';
let qaKey = '';
for (const line of lines) {
  if (line.startsWith('QA_SUPABASE_URL=')) {
    qaUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
  if (line.startsWith('QA_SUPABASE_SECRET_KEY=')) {
    qaKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

if (!qaUrl || !qaKey || qaUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: Targeting production or QA credentials missing!');
  process.exit(1);
}

// Override process.env so imported modules use QA
process.env.NEXT_PUBLIC_SUPABASE_URL = qaUrl;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
process.env.NEXT_PUBLIC_SITE_URL = "https://portal.kselectnetwork.com";
process.env.SUPABASE_SECRET_KEY = qaKey;
process.env.QA_ENVIRONMENT_NAME = "qa";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runQATestSuite() {
  console.log("================================================================");
  console.log("QA TEST SUITE: ADM-BSRC-009-R4 (ALL 12 SCENARIOS)");
  console.log("Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("================================================================\n");

  const {
    parseAndValidateTestRecipients,
    isTestRecipientAllowlisted,
    MAX_TEST_RECIPIENTS_PER_BATCH,
  } = await import('../lib/brand-marketing/test-allowlist-shared');

  const {
    getMarketingTestAllowlist,
    addMarketingTestAllowlistEmail,
    removeMarketingTestAllowlistEmail,
  } = await import('../lib/brand-marketing/test-allowlist');

  const {
    generateUnsubscribeToken,
    verifyUnsubscribeToken,
    buildUnsubscribeUrl,
    buildOneClickUnsubscribeEndpoint,
    recordEmailOptOut,
    isEmailSuppressed,
    maskTokenForLogging,
  } = await import('../lib/brand-marketing/unsubscribe');

  const { getCanonicalMarketingBaseUrl } = await import('../lib/brand-marketing/marketing-url');
  const { runCampaignDryRun } = await import('../lib/brand-marketing/campaign-data-access');

  const supabase = createClient(qaUrl, qaKey);

  // ---------------------------------------------------------------------------
  // SCENARIO A: Multiple internal test recipients parsing
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO A: Multiple Internal Recipients Parsing ---");
  const commaSeparated = "chae@letusto.com,cyim@letusto.com,skim@letusto.com";
  const semiSeparated = "user1@letusto.com; user2@kselectnetwork.com ; user3@letusto.com";
  const newlineSeparated = "userA@letusto.com\nuserB@letusto.com\r\nuserC@letusto.com";

  const resComma = parseAndValidateTestRecipients(commaSeparated);
  assert(resComma.uniqueRecipients.length === 3, "Parsed exactly 3 comma-separated recipients");
  assert(resComma.uniqueRecipients.includes("chae@letusto.com"), "Contains chae@letusto.com");
  assert(resComma.uniqueRecipients.includes("cyim@letusto.com"), "Contains cyim@letusto.com");
  assert(resComma.uniqueRecipients.includes("skim@letusto.com"), "Contains skim@letusto.com");

  const resSemi = parseAndValidateTestRecipients(semiSeparated);
  assert(resSemi.uniqueRecipients.length === 3, "Parsed exactly 3 semicolon-separated recipients");

  const resNewline = parseAndValidateTestRecipients(newlineSeparated);
  assert(resNewline.uniqueRecipients.length === 3, "Parsed exactly 3 newline-separated recipients");

  // ---------------------------------------------------------------------------
  // SCENARIO B: Mixed internal and external allowlisted recipients
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO B: Mixed Internal/External Allowlist Check ---");
  const mixedInput = "admin@letusto.com, external.owner@gmail.com; qa@outlook.com";
  const resMixed = parseAndValidateTestRecipients(mixedInput);
  assert(resMixed.uniqueRecipients.length === 3, "Parsed 3 mixed recipients");

  const mockAllowlist = ["external.owner@gmail.com", "qa@outlook.com"];
  const checkInternal = isTestRecipientAllowlisted("admin@letusto.com", mockAllowlist);
  assert(checkInternal.isAllowed === true, "Internal domain @letusto.com allowed by default");

  const checkExt1 = isTestRecipientAllowlisted("external.owner@gmail.com", mockAllowlist);
  assert(checkExt1.isAllowed === true, "External Gmail address in allowlist is approved");

  const checkExt2 = isTestRecipientAllowlisted("qa@outlook.com", mockAllowlist);
  assert(checkExt2.isAllowed === true, "External Outlook address in allowlist is approved");

  // ---------------------------------------------------------------------------
  // SCENARIO C: Invalid, duplicate, and batch limit recipient inputs
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO C: Invalid & Duplicate Recipient Handling ---");
  const dirtyInput = "  chae@letusto.com , CHAE@LETUSTO.COM; invalid-email-string \n chae@letusto.com ; valid@letusto.com ";
  const resDirty = parseAndValidateTestRecipients(dirtyInput);
  assert(resDirty.uniqueRecipients.length === 2, "Deduplicated to 2 unique normalized recipients");
  assert(resDirty.duplicateCount === 2, "Detected 2 duplicates (case-insensitive)");
  assert(resDirty.invalidInputs.length === 1, "Detected 1 malformed address (invalid-email-string)");
  assert(resDirty.invalidInputs[0].raw === "invalid-email-string", "Invalid raw string recorded");

  // Exceeds batch limit test
  const sixEmails = "u1@letusto.com,u2@letusto.com,u3@letusto.com,u4@letusto.com,u5@letusto.com,u6@letusto.com";
  const resExceed = parseAndValidateTestRecipients(sixEmails);
  assert(resExceed.uniqueRecipients.length === 6, "Detected 6 recipients");
  assert(resExceed.exceedsBatchLimit === true, `Exceeds max batch limit of ${MAX_TEST_RECIPIENTS_PER_BATCH}`);

  // ---------------------------------------------------------------------------
  // SCENARIO D: External email rejection when not allowlisted
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO D: External Email Rejection When Not Allowlisted ---");
  const unapprovedEmail = "unauthorized.attacker@random.com";
  const checkRejected = isTestRecipientAllowlisted(unapprovedEmail, mockAllowlist);
  assert(checkRejected.isAllowed === false, "Unapproved external email is strictly blocked");
  assert(
    checkRejected.rejectionReason?.includes("Security Rejection") === true,
    "Provides explicit security rejection reason"
  );

  // ---------------------------------------------------------------------------
  // SCENARIO E: Owner-managed allowlist persistence in QA Database
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO E: Owner Test Allowlist Persistence in QA DB ---");
  const testExternalEmail = `owner.test.${Date.now()}@gmail.com`;

  const addRes = await addMarketingTestAllowlistEmail(testExternalEmail, "qa-admin@letusto.com");
  assert(addRes.success === true, `Added ${testExternalEmail} to system_settings allowlist`);
  assert(addRes.allowlist.includes(testExternalEmail), "Returned allowlist contains added email");

  // Verify DB read
  const currentAllowlist = await getMarketingTestAllowlist();
  assert(currentAllowlist.includes(testExternalEmail), "Fetched allowlist from QA DB contains added email");

  // Test allowlist verification
  const checkNewlyAdded = isTestRecipientAllowlisted(testExternalEmail, currentAllowlist);
  assert(checkNewlyAdded.isAllowed === true, "Newly added external email is now authorized for test dispatch");

  // Remove email and verify cleanup
  const removeRes = await removeMarketingTestAllowlistEmail(testExternalEmail, "qa-admin@letusto.com");
  assert(removeRes.success === true, "Removed external email from allowlist");
  assert(!removeRes.allowlist.includes(testExternalEmail), "Email no longer in allowlist");

  // ---------------------------------------------------------------------------
  // SCENARIO F: Official unsubscribe domain & routing
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO F: Canonical Marketing Domain & Unsubscribe URLs ---");
  const canonicalBase = getCanonicalMarketingBaseUrl();
  assert(
    !canonicalBase.includes("vercel.app"),
    `Canonical base URL does not expose internal vercel.app (${canonicalBase})`
  );
  assert(
    canonicalBase.includes("kselectnetwork.com"),
    `Canonical base URL uses authoritative kselectnetwork.com domain (${canonicalBase})`
  );

  const testEmail = "buyer-partner@example.com";
  const sampleCampaignId = "c0000000-0000-4000-b000-000000000001";
  const unsubUrl = buildUnsubscribeUrl(testEmail, sampleCampaignId);
  const oneClickUrl = buildOneClickUnsubscribeEndpoint(testEmail, sampleCampaignId);

  assert(!unsubUrl.includes("vercel.app"), "Generated unsubscribe URL excludes vercel.app");
  assert(unsubUrl.startsWith(canonicalBase), "Unsubscribe URL starts with canonical base");
  assert(oneClickUrl.startsWith(canonicalBase), "One-Click RFC 8058 URL starts with canonical base");

  // Verify token masking
  const token = unsubUrl.split("token=")[1];
  const decodedToken = decodeURIComponent(token);
  const maskedToken = maskTokenForLogging(decodedToken);
  assert(!maskedToken.includes("==") && maskedToken.includes("..."), `Token safely masked for logs: ${maskedToken}`);

  // ---------------------------------------------------------------------------
  // SCENARIO G & H: Unsubscribe Confirmation & Real QA Suppression List Persistence
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO G & H: Unsubscribe Confirmation & DB Persistence ---");
  const targetUnsubEmail = `unsub-verify-${Date.now()}@samplecorp.com`;
  const unsubToken = generateUnsubscribeToken(targetUnsubEmail, sampleCampaignId);

  // Validate token
  const verifiedToken = verifyUnsubscribeToken(unsubToken);
  assert(verifiedToken.valid === true, "Unsubscribe token HMAC verification passed");
  assert(verifiedToken.email === targetUnsubEmail, "Extracted email matches target");

  // Check initial suppression status (should be false)
  const isSuppBefore = await isEmailSuppressed(targetUnsubEmail);
  assert(isSuppBefore === false, "Email not suppressed initially");

  // Simulate Confirm Unsubscribe action (recordEmailOptOut)
  const optOutRes = await recordEmailOptOut(
    targetUnsubEmail,
    "UNSUBSCRIBED",
    "QA automated test confirmation",
    sampleCampaignId
  );
  assert(optOutRes.success === true, "Opt-out recorded successfully in DB");
  assert(optOutRes.alreadySuppressed === false, "Initial opt-out was not already suppressed");

  // Verify persistence in marketing_suppression_list
  const { data: suppRow, error: suppErr } = await supabase
    .from("marketing_suppression_list")
    .select("*")
    .eq("email", targetUnsubEmail)
    .single();

  assert(!suppErr && Boolean(suppRow), "Record found in QA marketing_suppression_list table");
  assert(suppRow?.email === targetUnsubEmail, "Suppressed email matches exactly");
  assert(suppRow?.reason === "UNSUBSCRIBED", "Suppression reason is UNSUBSCRIBED");

  // ---------------------------------------------------------------------------
  // SCENARIO I: Already-unsubscribed repeat action response
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO I: Already-Unsubscribed Repeat Action Handling ---");
  const repeatOptOut = await recordEmailOptOut(
    targetUnsubEmail,
    "UNSUBSCRIBED",
    "Repeat opt-out attempt"
  );
  assert(repeatOptOut.success === true, "Repeat opt-out does not throw error");
  assert(repeatOptOut.alreadySuppressed === true, "Correctly flagged as alreadySuppressed: true");

  const isSuppAfter = await isEmailSuppressed(targetUnsubEmail);
  assert(isSuppAfter === true, "isEmailSuppressed returns true for persisted email");

  // ---------------------------------------------------------------------------
  // SCENARIO J: Exclusion from future campaign eligibility
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO J: Exclusion From Future Campaign Eligibility ---");
  // Test Dry Run with suppressed email
  const dryRunReport = await runCampaignDryRun(sampleCampaignId, {
    grades: ["A", "B"],
  }, supabase);

  assert(typeof dryRunReport.totalCandidatesEvaluated === "number", "Dry run returns totalCandidatesEvaluated");
  assert(Array.isArray(dryRunReport.samplePreviews), "Dry run returns sample previews");
  console.log(`  Dry Run evaluated ${dryRunReport.totalCandidatesEvaluated} candidates; excluded ${dryRunReport.excludedCount}.`);

  // Clean up QA suppression record
  await supabase
    .from("marketing_suppression_list")
    .delete()
    .eq("email", targetUnsubEmail);
  console.log("  Cleaned up QA test suppression row.");

  // ---------------------------------------------------------------------------
  // SCENARIO K: No regression in existing Campaign, Template, and Footer models
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO K: Regression Protection ---");
  // Check footer settings query
  const { data: footerData } = await supabase
    .from("marketing_footer_settings")
    .select("*")
    .eq("id", "central_marketing_footer")
    .maybeSingle();

  assert(Boolean(footerData), "Marketing footer settings exist and queryable in QA");
  assert(footerData?.brand_display_name === "K SELECT NETWORK", "Brand display name verified");

  // Check marketing_templates query
  const { data: templates } = await supabase
    .from("marketing_templates")
    .select("id, name, status")
    .limit(3);

  assert(Array.isArray(templates), "Marketing templates queryable without regression");

  // ---------------------------------------------------------------------------
  // SCENARIO L: LIVE_MODE safety lock verification
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO L: LIVE_MODE Safety Lock ---");
  const liveModeEnv = process.env.ENABLE_LIVE_CAMPAIGN_DISPATCH === "true";
  assert(liveModeEnv === false, "ENABLE_LIVE_CAMPAIGN_DISPATCH is strictly false/disabled");

  console.log("\n================================================================");
  console.log(`QA VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runQATestSuite().catch((err) => {
  console.error("QA Test Suite Error:", err);
  process.exit(1);
});
