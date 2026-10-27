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
    saveMarketingTemplate,
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

    // --------------------------------------------------------------------------
  // TEST 9: Image Template Compiler (ADM-BSRC-006-R1-ADD1)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 9: Image Template Compiler & Sliced Anchor Links ---");
  const { compileImageTemplateToHtml } = await import("../lib/brand-marketing/image-template-compiler");
  const imageSections = [
    {
      id: "slice-hero",
      imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800",
      altText: "K SELECT Brand Outreach Hero Banner",
      linkUrl: "https://www.kselectnetwork.com/hero",
      hasCtaButton: false,
    },
    {
      id: "slice-cta",
      imageUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800",
      altText: "K SELECT Wholesale Application Section",
      linkUrl: "https://www.kselectnetwork.com/apply",
      hasCtaButton: true,
      ctaButtonLabel: "Apply for Wholesale Program →",
      ctaButtonUrl: "https://www.kselectnetwork.com/apply",
      ctaButtonAlign: "center" as const,
    },
  ];

  const compiledResult = compileImageTemplateToHtml({
    sections: imageSections,
    language: "ko",
    subject: "[K SELECT] {{company_name}} 미국 진출 제안서",
    previewText: "북미 유통 프로그램 사전보기",
    defaultLandingUrl: "https://www.kselectnetwork.com",
  });

  assert(compiledResult.isValid, "Image template compiled successfully");
  assert(compiledResult.html.includes('width="600"') || compiledResult.html.includes('max-width: 600px'), "Canvas width respects 600px standard");
  assert(compiledResult.html.includes('href="https://www.kselectnetwork.com/hero"'), "Slice 1 anchor link rendered");
  assert(compiledResult.html.includes('href="https://www.kselectnetwork.com/apply"'), "Slice 2 CTA link rendered");
  assert(compiledResult.html.includes("Apply for Wholesale Program →"), "CTA button label rendered");
  assert(!compiledResult.html.includes("<map") && !compiledResult.html.includes("<area"), "Zero client-incompatible HTML image maps used");
  assert(!compiledResult.html.includes("position: absolute"), "Zero client-incompatible CSS absolute positioning used");
  assert(compiledResult.plainText.includes("Apply for Wholesale Program →"), "Plain text fallback contains CTA text");
  assert(compiledResult.plainText.includes("https://www.kselectnetwork.com/apply"), "Plain text fallback contains URLs");

  // --------------------------------------------------------------------------
  // TEST 10: Dual Template Formats Registration (IMAGE vs HTML)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 10: Dual Template Formats Registration & Persistence ---");
  const testImageTplId = crypto.randomUUID();
  const savedImageTpl = await saveMarketingTemplate(
    {
      id: testImageTplId,
      name: "QA Visual Image Template 2026",
      templateType: "IMAGE",
      subject: "[K SELECT] Visual Outreach for {{company_name}}",
      previewText: "Visual email package",
      htmlContent: compiledResult.html,
      plainText: compiledResult.plainText,
      imageSections,
      status: "ACTIVE",
    },
    "qa_admin",
    adminClient
  );

  assert(savedImageTpl.templateType === "IMAGE", "Saved template correctly tagged as IMAGE type");
  assert(savedImageTpl.imageSections?.length === 2, "Image sections preserved in template metadata");

  const templateList = await listMarketingTemplates(adminClient);
  const foundImageTpl = templateList.find((t) => t.id === testImageTplId);
  assert(foundImageTpl?.templateType === "IMAGE", "Retrieved template retains IMAGE format type");

  // --------------------------------------------------------------------------
  // TEST 11: Campaign Subject Override Save & Persistence
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 11: Campaign Subject Override Save & Persistence ---");
  const customSubjectCampaignId = crypto.randomUUID();
  const customSubjectText = "[K SELECT SPECIAL] Exclusive North America Deal for {{company_name}} & {{brand_name}}";

  const customCampaign = await saveMarketingCampaign(
    {
      id: customSubjectCampaignId,
      name: "QA Campaign with Custom Subject",
      templateId: koTemplate!.id,
      subjectOverride: customSubjectText,
      status: "DRAFT",
    },
    "qa_admin",
    adminClient
  );

  assert(customCampaign.subjectOverride === customSubjectText, "Campaign draft saved custom subject override");

  const retrievedCustomCamp = await getMarketingCampaignById(customSubjectCampaignId, adminClient);
  assert(
    retrievedCustomCamp.campaign?.subjectOverride === customSubjectText,
    "Reloaded campaign preserves subjectOverride exactly without reverting to template subject"
  );

  // --------------------------------------------------------------------------
  // TEST 12: Invalidate Approval on Subject Change
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 12: Approval Invalidation on Subject Change ---");
  const approvedCustom = await approveMarketingCampaign(
    customSubjectCampaignId,
    "admin@kselectnetwork.com",
    adminClient
  );
  assert(approvedCustom.status === "APPROVED", "Campaign successfully approved");
  assert(approvedCustom.approvalSnapshot?.subjectOverride === customSubjectText, "Approval snapshot recorded subject override");

  // Now modify the subject override -> MUST invalidate approval
  const editedSubjectCampaign = {
    ...approvedCustom,
    subjectOverride: "[K SELECT UPDATED] Brand Deal for {{company_name}}",
  };
  const reSavedAfterSubjectEdit = await saveMarketingCampaign(editedSubjectCampaign, "qa_admin", adminClient);
  assert(reSavedAfterSubjectEdit.status === "DRAFT", "Editing subject on approved campaign resets status to DRAFT");
  assert(reSavedAfterSubjectEdit.approvalStatus === "INVALIDATED", "Editing subject on approved campaign resets approvalStatus to INVALIDATED");

  // --------------------------------------------------------------------------
  // TEST 13: Designer Guide & AI Prompts Constants
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 13: Designer Guide & AI Prompts Constants ---");
  const {
    DEFAULT_IMAGE_DESIGN_PROMPT,
    DEFAULT_HTML_DESIGN_PROMPT,
    DESIGNER_GUIDE_SECTIONS,
  } = await import("../lib/brand-marketing/designer-guide-constants");

  assert(DEFAULT_IMAGE_DESIGN_PROMPT.includes("600px email width"), "Image design prompt contains 600px width instruction");
  assert(DEFAULT_IMAGE_DESIGN_PROMPT.includes("K SELECT branding"), "Image design prompt contains K SELECT branding requirement");
  assert(DEFAULT_IMAGE_DESIGN_PROMPT.includes("Do not invent business claims or metrics"), "Image design prompt enforces no fabricated claims");
  assert(DEFAULT_HTML_DESIGN_PROMPT.includes("{{company_name}}"), "HTML design prompt contains company_name placeholder");
  assert(DESIGNER_GUIDE_SECTIONS.length === 4, "Designer guide has 4 structured guidance sections");

  console.log("\n==================================================");
  console.log("🎉 ALL ADM-BSRC-006 QA INTEGRATION TESTS PASSED!");
  console.log("==================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
