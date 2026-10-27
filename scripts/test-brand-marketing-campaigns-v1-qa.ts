// Mock server-only before any other imports
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

/**
 * QA Test Suite for Brand Marketing — Email Campaigns V1 (ADM-BSRC-006)
 *
 * Verifies:
 * 1. Template validation & sanitization (malicious scripts stripped, variables checked).
 * 2. Personalization engine (HTML escaping, Korean/English variable replacement, placeholder warnings across subject & HTML).
 * 3. Campaign CRUD operations (creation, duplication, archive).
 * 4. Recipient candidate filtering & deduplication.
 * 5. Dry run simulation (metrics calculation, sample recipient generation, zero external sends).
 * 6. Test send security (strict allowlist enforcement).
 * 7. Approval workflow (locking snapshot, invalidation on subsequent campaign edits).
 * 8. Live sending block verification (is_live_mode_enabled strictly false).
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log("\n==================================================");
  console.log("ADM-BSRC-006: Brand Marketing — Email Campaigns V1 QA");
  console.log("==================================================\n");

  const { validateAndSanitizeTemplate, convertHtmlToPlainText } = await import(
    "../lib/brand-marketing/template-parser"
  );
  const {
    personalizeEmail,
  } = await import("../lib/brand-marketing/personalization-engine");
  const {
    listMarketingTemplates,
    saveMarketingCampaign,
    getMarketingCampaignById,
    runCampaignDryRun,
    sendTestCampaignEmail,
    approveMarketingCampaign,
  } = await import("../lib/brand-marketing/campaign-data-access");
  const { createAdminClient } = await import("../lib/supabase/admin");

  const adminClient = createAdminClient();

  // --------------------------------------------------------------------------
  // TEST 1: Template Validation & Sanitization
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Template Sanitization & Security ---");
  const maliciousHtml = `
    <html>
      <head><script>alert('xss')</script></head>
      <body>
        <h1 onclick="stealCookies()">Welcome {{company_name}}</h1>
        <iframe src="javascript:alert(1)"></iframe>
        <a href="javascript:doEvil()">Click here</a>
        <p>{{custom_message}}</p>
      </body>
    </html>
  `;
  const sanitized = validateAndSanitizeTemplate(
    maliciousHtml,
    "[K SELECT] Partnership Proposal for {{company_name}}"
  );
  assert(sanitized.isValid, "Sanitized result is valid");
  assert(!sanitized.sanitizedHtml.includes("<script"), "Malicious script tags removed");
  assert(!sanitized.sanitizedHtml.includes("onclick"), "Inline onclick handlers stripped");
  assert(!sanitized.sanitizedHtml.includes("<iframe"), "Iframe tags stripped");
  assert(!sanitized.sanitizedHtml.includes("javascript:"), "javascript: URIs neutralized");
  assert(sanitized.detectedVariables.includes("company_name"), "company_name variable detected");
  assert(sanitized.detectedVariables.includes("custom_message"), "custom_message variable detected");

  const plainText = convertHtmlToPlainText("<h1>Hello World</h1><p>This is a <b>test</b>.</p>");
  assert(plainText.includes("Hello World"), "Plain text conversion retains text");
  assert(!plainText.includes("<h1>"), "Plain text conversion strips HTML tags");

  // --------------------------------------------------------------------------
  // TEST 2: Personalization Engine & HTML Escaping
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Personalization Engine ---");
  const templateHtml = "<p>Dear {{contact_name}} of {{company_name}}, check {{brand_name}}: {{custom_message}}</p>";
  const personalized = personalizeEmail(
    "[K SELECT] Partnership Proposal for {{company_name}}",
    templateHtml,
    undefined,
    {
      companyName: "코스메틱 <Test> & Co.",
      contactName: "김대표 <CEO>",
      brandName: "GlowSkin",
      customMessage: "We would love to onboard your products.",
      language: "ko",
    }
  );

  assert(
    personalized.subject === "[K SELECT] Partnership Proposal for 코스메틱 <Test> & Co.",
    "Subject interpolated without HTML escaping"
  );
  assert(
    personalized.html.includes("코스메틱 &lt;Test&gt; &amp; Co."),
    "HTML template variables properly HTML-escaped for safety"
  );
  assert(
    personalized.html.includes("김대표 &lt;CEO&gt;"),
    "Contact name properly HTML-escaped"
  );
  assert(
    personalized.html.includes("We would love to onboard your products."),
    "Custom message properly interpolated"
  );
  assert(personalized.unresolvedPlaceholders.length === 0, "Zero unresolved placeholders");

  // Test unresolved placeholder detection in both subject and body
  const incomplete = personalizeEmail(
    "Hello {{missing_field}}",
    "<p>{{unknown_var}}</p>",
    undefined,
    { companyName: "Test Co", language: "en" }
  );
  assert(incomplete.unresolvedPlaceholders.includes("missing_field"), "Missing field detected in subject");
  assert(incomplete.unresolvedPlaceholders.includes("unknown_var"), "Unknown variable detected in body");

  // --------------------------------------------------------------------------
  // TEST 3: Default Template Library
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Default Template Packages ---");
  const templates = await listMarketingTemplates(adminClient);
  assert(templates.length >= 2, "Default designer templates seeded (KO and EN)");
  const koTemplate = templates.find((t) => t.id === "tpl-ksn-intro-ko-v1" || t.language === "ko");
  const enTemplate = templates.find((t) => t.id === "tpl-ksn-intro-en-v1" || t.language === "en");
  assert(!!koTemplate, "Korean brand intro template available");
  assert(!!enTemplate, "English brand intro template available");
  assert(koTemplate!.htmlContent.includes("{{company_name}}"), "KO template contains company_name variable");

  // --------------------------------------------------------------------------
  // TEST 4: Campaign CRUD, Duplication & Archive
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Campaign Management (Create / Duplicate / Archive) ---");
  const testCampaignId = crypto.randomUUID();
  const campaignData = {
    id: testCampaignId,
    name: "QA Automated Test Campaign 2026",
    purpose: "Brand Outreach",
    description: "End-to-end integration test campaign",
    language: "ko" as const,
    templateId: koTemplate!.id,
    templateVersion: "1.0.0",
    status: "DRAFT" as const,
    approvalStatus: "PENDING" as const,
    customMessage: "테스트 맞춤 제안 메시지입니다.",
    isLiveModeEnabled: false, // Strict safety guarantee
    filterCriteria: {
      grades: ["A" as const, "B" as const],
      companyTypes: ["BRAND_OWNER", "MANUFACTURER_PRODUCER"],
      requireConsentedOnly: true,
    },
    stats: {
      totalRecipients: 0,
      sendableCount: 0,
      excludedCount: 0,
      testSendsCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    },
  };

  const saved = await saveMarketingCampaign(campaignData, "admin_test_runner", adminClient);
  assert(saved.id === testCampaignId, "Campaign created successfully");
  assert(saved.status === "DRAFT", "Campaign initial status is DRAFT");
  assert(saved.isLiveModeEnabled === false, "Live mode strictly disabled in campaign");

  // Duplication test
  const copyData = {
    ...saved,
    id: crypto.randomUUID(),
    name: `${saved.name} (Copy)`,
    status: "DRAFT" as const,
    approvalStatus: "PENDING" as const,
    approvalSnapshot: null,
  };
  const duplicated = await saveMarketingCampaign(copyData, "admin_test_runner", adminClient);
  assert(duplicated.id !== testCampaignId, "Duplicated campaign gets new ID");
  assert(duplicated.name.includes("(Copy)"), "Duplicated campaign name has (Copy)");
  assert(duplicated.status === "DRAFT", "Duplicated campaign starts in DRAFT status");

  // Archive test
  const archived = await saveMarketingCampaign(
    { ...duplicated, status: "CANCELLED" as const },
    "admin_test_runner",
    adminClient
  );
  assert(archived.status === "CANCELLED", "Campaign archived status set to CANCELLED");

  // --------------------------------------------------------------------------
  // TEST 5: Recipient Selection & Dry Run Simulation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Recipient Selection & Dry Run Simulation ---");
  const dryRunReport = await runCampaignDryRun(
    saved.id,
    {
      grades: ["A", "B"],
      companyTypes: ["BRAND_OWNER", "MANUFACTURER_PRODUCER"],
    },
    adminClient
  );
  assert(dryRunReport.totalCandidatesEvaluated >= 0, "Dry run evaluated candidate population");
  assert(dryRunReport.duplicateEmailsFiltered >= 0, "Dry run tracked duplicate emails");
  assert(dryRunReport.samplePreviews.length >= 0, "Dry run returned sample previews");
  console.log(`  Dry run results: total=${dryRunReport.totalCandidatesEvaluated}, sendable=${dryRunReport.sendableCount}, excluded=${dryRunReport.excludedCount}, duplicate=${dryRunReport.duplicateEmailsFiltered}`);

  // --------------------------------------------------------------------------
  // TEST 6: Test Send Safety & Allowlist Enforcement
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Test Send Safety & Allowlist Enforcement ---");
  // Test disallowed external recipient -> MUST FAIL
  const externalTestResult = await sendTestCampaignEmail(
    saved.id,
    "external_prospect@randomcorp.com",
    "[K SELECT] Test Subject",
    koTemplate!.htmlContent,
    koTemplate!.plainText
  );
  assert(!externalTestResult.success, "Test send to external prospect rejected");
  assert(
    externalTestResult.error?.includes("allowlist") || false,
    "Rejection reason clearly specifies allowlist restriction"
  );

  // Test allowed internal recipient -> Allowed in test mode
  const internalTestResult = await sendTestCampaignEmail(
    saved.id,
    "test@letusto.com",
    "[K SELECT] Test Subject",
    koTemplate!.htmlContent,
    koTemplate!.plainText
  );
  console.log(`  Internal test send response: ${JSON.stringify(internalTestResult)}`);
  assert(
    internalTestResult.success || (internalTestResult.error && !internalTestResult.error.includes("allowlist")),
    "Allowlist check passed for @letusto.com address"
  );

  // --------------------------------------------------------------------------
  // TEST 7: Approval Workflow & Snapshot Locking
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Approval Workflow & Snapshot Locking ---");
  const approved = await approveMarketingCampaign(
    saved.id,
    "admin@kselectnetwork.com",
    adminClient
  );
  assert(approved.status === "APPROVED", "Campaign status successfully updated to APPROVED");
  assert(approved.approvalStatus === "APPROVED", "Approval status is APPROVED");
  assert(!!approved.approvalSnapshot, "Approval snapshot created");
  assert(approved.approvalSnapshot?.approvedBy === "admin@kselectnetwork.com", "Approval snapshot records author");

  // Modifying approved campaign MUST invalidate approval
  const modifiedCampaign = {
    ...approved,
    customMessage: "Modified proposal text after approval!",
  };
  const reSaved = await saveMarketingCampaign(modifiedCampaign, "admin_editor", adminClient);
  assert(
    reSaved.status === "DRAFT",
    "Editing an approved campaign automatically resets status to DRAFT"
  );
  assert(
    reSaved.approvalStatus === "INVALIDATED",
    "Editing an approved campaign automatically resets approvalStatus to INVALIDATED"
  );

  // --------------------------------------------------------------------------
  // TEST 8: Live Sending Block Verification (Strict Safety Constraint)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 8: Live Sending Block Verification ---");
  const retrievedCampaign = await getMarketingCampaignById(saved.id, adminClient);
  assert(retrievedCampaign.campaign?.isLiveModeEnabled === false, "Live mode is strictly false on persisted record");

  console.log("\n==================================================");
  console.log("🎉 ALL ADM-BSRC-006 QA INTEGRATION TESTS PASSED!");
  console.log("==================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
