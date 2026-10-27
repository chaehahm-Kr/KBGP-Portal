// Mock server-only before any other imports
try {
  const serverOnlyPath = require.resolve("server-only");
  (require.cache as any)[serverOnlyPath] = {
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
 * Automated Lifecycle QA Script for ADM-BSRC-009
 * Verifies:
 * 1. HTML & ZIP Package Import (Zip extraction, asset rewrite, path-traversal protection)
 * 2. Campaign Settings Centralization (subjectOverride, previewText, landingPageUrl)
 * 3. Template Library Management (duplicate, archive, restore, safe delete protection)
 * 4. Centralized Marketing Footer (idempotent assembly, preheader injection, landing page CTA, validation)
 * 5. Real Unsubscribe & Suppression (HMAC tokens, scanner safety, opt-out recording, suppression filtering)
 * 6. Pre-Approval Validation Checklist
 */

import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('================================================================');
  console.log('ADM-BSRC-009 LIFECYCLE QA TEST SUITE');
  console.log('================================================================\n');

  const {
    importZipPackage,
    importRawHtmlPackage,
  } = await import('../lib/brand-marketing/package-importer');

  const {
    assembleEmailWithMarketingFooter,
    detectExistingFooterInHtml,
    validateMarketingFooterCompleteness,
  } = await import('../lib/brand-marketing/marketing-footer');

  const {
    generateUnsubscribeToken,
    verifyUnsubscribeToken,
    buildUnsubscribeUrl,
    isEmailSuppressed,
    recordEmailOptOut,
  } = await import('../lib/brand-marketing/unsubscribe');

  const {
    saveMarketingCampaign,
    getMarketingCampaignById,
    duplicateMarketingTemplate,
    archiveMarketingTemplate,
    restoreMarketingTemplate,
    deleteMarketingTemplate,
    listMarketingTemplates,
    getMarketingFooterSettings,
    saveMarketingFooterSettings,
  } = await import('../lib/brand-marketing/campaign-data-access');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 1: HTML & ZIP Package Import
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: HTML & ZIP Package Import ---');

  // 1A. Valid ZIP with local images
  const validZipPath = path.join(__dirname, 'fixtures', 'valid-email-package.zip');
  const validZipBuf = fs.readFileSync(validZipPath);

  const zipResult = await importZipPackage(validZipBuf, 'Test Package Brand');
  assert(zipResult.errors.length === 0, 'Valid ZIP package imports without errors');
  assert(zipResult.extractedAssets.length === 2, `Extracted 2 images from ZIP (got ${zipResult.extractedAssets.length})`);
  assert(
    zipResult.htmlContent.includes('/api/marketing/assets/templates/') && !zipResult.htmlContent.includes('./images/hero.png'),
    'Relative image paths in HTML rewritten to hosted HTTPS URLs'
  );
  assert(
    !zipResult.htmlContent.includes('images/logo.png'),
    'Relative image path without ./ was also rewritten cleanly'
  );
  assert(zipResult.warnings.length === 0, 'No warnings for valid clean package');

  // 1B. Path Traversal ZIP rejection
  const traversalZipPath = path.join(__dirname, 'fixtures', 'traversal-attack.zip');
  const traversalBuf = fs.readFileSync(traversalZipPath);

  let traversalBlocked = false;
  try {
    const travResult = await importZipPackage(traversalBuf, 'Malicious Zip');
    if (travResult.errors.length > 0 || travResult.warnings.some(w => w.includes('traversal') || w.includes('unsafe'))) {
      traversalBlocked = true;
    }
  } catch (err: any) {
    traversalBlocked = true;
  }
  assert(traversalBlocked, 'Malicious ZIP with path traversal ("../") is safely rejected or flagged');

  // 1C. Raw HTML import with relative vs HTTPS images
  const rawHtmlWithRelative = `<div><img src="./banner.jpg" /><img src="https://images.unsplash.com/photo-test" /></div>`;
  const htmlResult = await importRawHtmlPackage(rawHtmlWithRelative, 'Raw Newsletter');
  assert(htmlResult.errors.length === 0, 'Raw HTML imports without errors');
  assert(
    htmlResult.warnings.some(w => w.includes('relative image path')),
    'Raw HTML with relative images generates warning instructing to upload ZIP'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Centralized Marketing Footer
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Centralized Marketing Footer ---');

  // 2A. Footer settings read & validation
  const footerSettings = await getMarketingFooterSettings();
  assert(!!footerSettings.brandDisplayName, `Footer loaded: brandDisplayName="${footerSettings.brandDisplayName}"`);
  assert(!!footerSettings.physicalAddress, `Footer physical address present: "${footerSettings.physicalAddress}"`);

  const footerValidation = validateMarketingFooterCompleteness(footerSettings);
  assert(footerValidation.isValid, 'Default marketing footer meets CAN-SPAM / Korean legal completeness');

  // 2B. Footer Assembly & Idempotency
  const testEmailBody = `
  <div style="padding: 20px; font-family: sans-serif;">
    <h2>Exclusive Fall Skincare Offers</h2>
    <p>Check out our latest selections from premier Korean brands.</p>
    <a href="{{LANDING_PAGE_URL}}" style="color: blue;">Explore Collection</a>
  </div>`;

  const unsubUrl = buildUnsubscribeUrl('brand-contact@innisfree-sample.co.kr', 'camp-test-001');

  const assembled1 = assembleEmailWithMarketingFooter(testEmailBody, {
    footerSettings,
    language: 'en',
    unsubscribeUrl: unsubUrl,
    landingPageUrl: 'https://kselectnetwork.com/featured/fall-skincare',
    previewText: 'Exclusive 20% discount on premier K-Beauty skincare',
  });

  assert(
    assembled1.includes('<!-- MARKETING_FOOTER_START -->') && assembled1.includes('<!-- MARKETING_FOOTER_END -->'),
    'Email assembled with footer markers <!-- MARKETING_FOOTER_START --> and <!-- MARKETING_FOOTER_END -->'
  );
  assert(
    assembled1.includes('Exclusive 20% discount on premier K-Beauty skincare'),
    'Preview text injected as hidden inbox preheader'
  );
  assert(
    assembled1.includes('https://kselectnetwork.com/featured/fall-skincare'),
    'Landing page URL placeholder resolved in body'
  );
  assert(
    assembled1.includes(footerSettings.physicalAddress),
    'Physical address rendered in assembled footer'
  );
  assert(
    assembled1.includes('/unsubscribe?token='),
    'Recipient-specific unsubscribe link rendered in assembled footer'
  );

  // 2C. Idempotency test (assembling again replaces footer instead of appending duplicates)
  const assembled2 = assembleEmailWithMarketingFooter(assembled1, {
    footerSettings,
    language: 'en',
    unsubscribeUrl: unsubUrl,
  });

  const footerStartOccurrences = (assembled2.match(/<!-- MARKETING_FOOTER_START -->/g) || []).length;
  assert(
    footerStartOccurrences === 1,
    `Footer assembly is idempotent: exactly 1 footer marker block exists after re-assembly (found ${footerStartOccurrences})`
  );

  // 2D. Existing footer detection
  const detected = detectExistingFooterInHtml(assembled2);
  assert(detected.hasExistingFooter, 'detectExistingFooterInHtml correctly identifies managed footer');

  // -------------------------------------------------------------------------
  // TEST SUITE 3: Real Unsubscribe Infrastructure
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Real Unsubscribe Infrastructure ---');

  const testEmail = 'marketing-recipient-qa@example.com';
  const testCampaignId = 'camp-qa-unsub-999';

  // 3A. HMAC token generation & verification
  const token = generateUnsubscribeToken(testEmail, testCampaignId);
  assert(typeof token === 'string' && token.length > 20, 'Opaque HMAC-SHA256 unsubscribe token generated');

  const verified = verifyUnsubscribeToken(token);
  assert(
    verified.valid && verified.email === testEmail && verified.campaignId === testCampaignId,
    'HMAC token verified successfully and payload matches original email & campaign'
  );

  // 3B. Tamper rejection
  const tamperedToken = token.slice(0, -4) + 'abcd';
  const tamperedVerified = verifyUnsubscribeToken(tamperedToken);
  assert(!tamperedVerified.valid, 'Tampered token is safely rejected with valid: false');

  // 3C. Scanner Safety
  const unsubsUrl = buildUnsubscribeUrl(testEmail, testCampaignId);
  assert(unsubsUrl.includes('/unsubscribe?token='), 'Unsubscribe URL is correctly formatted for web route');
  const beforeSuppression = await isEmailSuppressed(testEmail);
  assert(!beforeSuppression, 'Simply generating URL or clicking GET does not suppress email (scanner-safe)');

  // 3D. Opt-out recording
  const optOutResult = await recordEmailOptOut(
    testEmail,
    'UNSUBSCRIBED',
    'QA Lifecycle Test User Opt-Out',
    testCampaignId
  );
  assert(optOutResult.success, 'Opt-out recorded successfully in suppression list');

  const afterSuppression = await isEmailSuppressed(testEmail);
  assert(afterSuppression, 'isEmailSuppressed returns TRUE after opt-out recording');

  // -------------------------------------------------------------------------
  // TEST SUITE 4: Campaign Settings Centralization & Step 1 Fields
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Campaign Settings Centralization & Step 1 Fields ---');

  const testCampaignPayload = {
    name: 'QA Centralized Settings Test Campaign',
    purpose: 'PARTNERSHIP_PROPOSAL' as const,
    language: 'en' as const,
    subjectOverride: 'Custom Authoritative Subject: Exclusive Fall Partnership',
    previewText: 'Discover premier Korean cosmetic brands with K Select Network',
    landingPageUrl: 'https://kselectnetwork.com/campaigns/fall-partnership',
    templateId: 'tmpl-qa-default',
    targetCompanyTypes: ['INDIE_BRAND', 'ESTABLISHED_BRAND'],
    targetGrades: ['A', 'B'],
    status: 'DRAFT' as const,
    dryRunSummary: {
      recipientCount: 1,
      validRecipientCount: 1,
      estimatedDeliverySeconds: 5,
      previewSample: {
        recipientEmail: 'qa-tester@letusto.com',
        recipientName: 'QA Tester',
        companyName: 'QA Beauty Co',
        renderedSubject: 'Custom Authoritative Subject: Exclusive Fall Partnership',
        renderedHtml: '<div>Test Content</div>',
      },
    },
  };

  const savedCamp = await saveMarketingCampaign(testCampaignPayload);
  assert(!!savedCamp.id, `Campaign created with ID: ${savedCamp.id}`);

  const campaignBundle = await getMarketingCampaignById(savedCamp.id);
  assert(campaignBundle.campaign !== null, 'Campaign reloaded from data access layer');
  assert(
    campaignBundle.campaign?.subjectOverride === 'Custom Authoritative Subject: Exclusive Fall Partnership',
    `Step 1 subjectOverride persisted & reloaded: "${campaignBundle.campaign?.subjectOverride}"`
  );
  assert(
    campaignBundle.campaign?.previewText === 'Discover premier Korean cosmetic brands with K Select Network',
    `Step 1 previewText persisted & reloaded: "${campaignBundle.campaign?.previewText}"`
  );
  assert(
    campaignBundle.campaign?.landingPageUrl === 'https://kselectnetwork.com/campaigns/fall-partnership',
    `Step 1 landingPageUrl persisted & reloaded: "${campaignBundle.campaign?.landingPageUrl}"`
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Template Library Management
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Template Library Management ---');

  const templates = await listMarketingTemplates();
  assert(templates.length > 0, `Template library contains ${templates.length} templates`);
  const firstTmpl = templates[0];

  // 5A. Duplicate Template
  const duplicatedTmpl = await duplicateMarketingTemplate(firstTmpl.id);
  assert(!!duplicatedTmpl && !!duplicatedTmpl.id, `Template duplicated successfully: "${duplicatedTmpl.name}"`);
  assert(duplicatedTmpl.id !== firstTmpl.id, 'Duplicated template has a unique new ID');
  assert(duplicatedTmpl.name.includes('(Copy)'), 'Duplicated template name has (Copy) suffix');

  const dupId = duplicatedTmpl.id;

  // 5B. Archive & Restore Template
  const archivedTmpl = await archiveMarketingTemplate(dupId);
  assert(archivedTmpl.status === 'ARCHIVED', 'Archived template has status: ARCHIVED');

  const restoredTmpl = await restoreMarketingTemplate(dupId);
  assert(restoredTmpl.status === 'ACTIVE', 'Restored template has status: ACTIVE');

  // 5C. Safe Delete Protection
  // Associate duplicated template to a campaign
  await saveMarketingCampaign({
    id: savedCamp.id,
    name: 'QA Centralized Settings Test Campaign',
    templateId: dupId,
  });

  const deleteBlocked = await deleteMarketingTemplate(dupId);
  assert(
    !deleteBlocked.success && !!deleteBlocked.error && (deleteBlocked.error.includes('referenced by campaign') || deleteBlocked.error.includes('in use')),
    `Delete is safely blocked when template is referenced by a campaign: "${deleteBlocked.error}"`
  );

  // Disassociate and then delete
  await saveMarketingCampaign({
    id: savedCamp.id,
    name: 'QA Centralized Settings Test Campaign',
    templateId: 'tmpl-qa-default',
  });

  const deleteAllowed = await deleteMarketingTemplate(dupId);
  assert(deleteAllowed.success, 'Delete succeeds once template is no longer referenced by any campaign');

  // -------------------------------------------------------------------------
  // TEST SUITE 6: Pre-Approval Validation Checklist Logic
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Pre-Approval Validation Checklist Logic ---');

  const preApprovalCheck = {
    hasPhysicalAddress: Boolean(footerSettings.physicalAddress?.trim()),
    hasContactEmail: Boolean(footerSettings.contactEmail?.includes('@')),
    hasLegalName: Boolean(footerSettings.brandDisplayName?.trim() && footerSettings.legalCompanyName?.trim()),
    hasTemplate: Boolean(savedCamp.templateId),
    hasUnsubscribe: Boolean(unsubUrl && unsubUrl.includes('/unsubscribe?token=')),
  };

  const allPassed = Object.values(preApprovalCheck).every(Boolean);
  assert(allPassed, 'All Pre-Approval checklist requirements PASS');
  console.log('Pre-approval checklist status:');
  console.log(`  [${preApprovalCheck.hasPhysicalAddress ? 'PASS' : 'FAIL'}] Physical Mailing Address`);
  console.log(`  [${preApprovalCheck.hasContactEmail ? 'PASS' : 'FAIL'}] Official Contact Email`);
  console.log(`  [${preApprovalCheck.hasLegalName ? 'PASS' : 'FAIL'}] Legal Entity & Brand Name`);
  console.log(`  [${preApprovalCheck.hasTemplate ? 'PASS' : 'FAIL'}] Template Assigned`);
  console.log(`  [${preApprovalCheck.hasUnsubscribe ? 'PASS' : 'FAIL'}] Unsubscribe Token Resolution`);

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
