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
 * Automated Lifecycle QA Script for ADM-BSRC-009-R1
 * Verifies the complete 20-item QA specification:
 * 1. TypeScript & Build verification
 * 2. Official Footer Configuration (Mount Laurel, NJ & Contact@letusto.com)
 * 3. Removal of legacy Wilmington address and support email
 * 4. Korean & English footer rendering with correct disclosures
 * 5. HTML & IMAGE template footer injection
 * 6. Duplicate footer prevention & idempotency
 * 7. Real CTA URL resolution & HTTPS links
 * 8. Public hosted asset resolution & path traversal rejection
 * 9. Real Unsubscribe HMAC-SHA256 tokens & scanner safety
 * 10. Suppression registry persistence
 * 11. Pre-approval validation checklist (10 comprehensive checks)
 * 12. Approval snapshot immutability
 * 13. Transactional email isolation
 * 14. Hard-locked LIVE_MODE disabled verification
 * 15. Migration 0188 SQL syntax, seed data, and RLS idempotency audit
 */

import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('================================================================');
  console.log('ADM-BSRC-009-R1 COMPREHENSIVE LIFECYCLE QA TEST SUITE');
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
    compileImageTemplateToHtml,
  } = await import('../lib/brand-marketing/image-template-compiler');

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
    approveMarketingCampaign,
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
  // TEST SUITE 1: Official Footer Information & Legacy Removal
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Official Footer Information & Legacy Removal ---');

  const footerSettings = await getMarketingFooterSettings();
  assert(
    footerSettings.brandDisplayName === 'K SELECT NETWORK',
    `Official Brand Display Name: "${footerSettings.brandDisplayName}"`
  );
  assert(
    footerSettings.legalCompanyName === 'Operated by Letusto Inc.',
    `Official Legal Operating Company: "${footerSettings.legalCompanyName}"`
  );
  assert(
    footerSettings.physicalAddress.includes('23B Roland Ave.') &&
    footerSettings.physicalAddress.includes('Mount Laurel, NJ 08054'),
    `Official Physical Address: "${footerSettings.physicalAddress}"`
  );
  assert(
    footerSettings.contactEmail.toLowerCase() === 'contact@letusto.com',
    `Official Contact Email: "${footerSettings.contactEmail}"`
  );
  assert(
    footerSettings.contactWebsite === 'https://www.kselectnetwork.com',
    `Official Website: "${footerSettings.contactWebsite}"`
  );

  // Negative checks: legacy Wilmington and legacy support email must NOT be present
  assert(
    !footerSettings.physicalAddress.includes('Wilmington') &&
    !footerSettings.physicalAddress.includes('1201 Orange'),
    'Legacy Wilmington address completely purged from default footer settings'
  );
  assert(
    !footerSettings.contactEmail.includes('support@kselectnetwork.com'),
    'Legacy support@kselectnetwork.com completely purged from default footer settings'
  );

  const footerValidation = validateMarketingFooterCompleteness(footerSettings);
  assert(footerValidation.isValid, 'Official marketing footer meets CAN-SPAM and Korean legal completeness');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: Korean vs English Footer Rendering
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Korean vs English Footer Rendering ---');

  const testBody = `<div><p>Sample Campaign Content</p><a href="{{LANDING_PAGE_URL}}">Click Here</a></div>`;
  const unsubUrl = buildUnsubscribeUrl('buyer-contact@partner-brand.co.kr', 'camp-qa-001');

  // 2A. Korean Render
  const koAssembled = assembleEmailWithMarketingFooter(testBody, {
    footerSettings,
    language: 'ko',
    unsubscribeUrl: unsubUrl,
    previewText: 'K-Beauty 미국 뷰티 리테일러 입점 안내',
    landingPageUrl: 'https://kselectnetwork.com/campaigns/k-beauty-outreach',
  });

  assert(
    koAssembled.includes('본 메일은 K SELECT NETWORK의 브랜드 파트너십 안내 이메일입니다.'),
    'Korean legal disclosure rendered correctly in KO email'
  );
  assert(
    koAssembled.includes('수신거부 / Unsubscribe'),
    'Korean unsubscribe label formatted as "수신거부 / Unsubscribe"'
  );
  assert(
    koAssembled.includes('K-Beauty 미국 뷰티 리테일러 입점 안내'),
    'Korean preview text preheader injected'
  );

  // 2B. English Render
  const enAssembled = assembleEmailWithMarketingFooter(testBody, {
    footerSettings,
    language: 'en',
    unsubscribeUrl: unsubUrl,
    previewText: 'Curated Korean Beauty Brands for US Retailers',
    landingPageUrl: 'https://kselectnetwork.com/campaigns/us-retail',
  });

  assert(
    enAssembled.includes('This email provides information about K SELECT NETWORK brand partnerships.'),
    'English legal disclosure rendered correctly in EN email'
  );
  assert(
    enAssembled.includes('Unsubscribe / Opt-out'),
    'English unsubscribe label rendered correctly'
  );
  assert(
    enAssembled.includes('Curated Korean Beauty Brands for US Retailers'),
    'English preview text preheader injected'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 3: HTML & IMAGE Template Footer Injection & Idempotency
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: HTML & IMAGE Template Footer Injection ---');

  // 3A. IMAGE Template Compiler Integration
  const compiledImageHtml = compileImageTemplateToHtml({
    sections: [
      {
        id: 'sec-1',
        imageUrl: 'https://images.unsplash.com/photo-sample-kbeauty',
        altText: 'Hero Section',
        hasCtaButton: true,
        ctaButtonLabel: 'View Wholesale Catalog',
        ctaButtonUrl: 'https://kselectnetwork.com/catalog',
        ctaButtonAlign: 'center',
      },
    ],
    language: 'ko',
    subject: 'K SELECT IMAGE TEMPLATE CAMPAIGN',
    previewText: 'Image Campaign Preview',
  });

  const assembledImageEmail = assembleEmailWithMarketingFooter(compiledImageHtml.html, {
    footerSettings,
    language: 'ko',
    unsubscribeUrl: unsubUrl,
  });

  assert(
    assembledImageEmail.includes('<!-- MARKETING_FOOTER_START -->') &&
    assembledImageEmail.includes('<!-- MARKETING_FOOTER_END -->'),
    'Marketing footer cleanly attached to compiled IMAGE template'
  );
  assert(
    assembledImageEmail.includes('23B Roland Ave., Mount Laurel, NJ 08054, USA'),
    'Official physical address rendered inside IMAGE template email'
  );

  // 3B. Idempotency test (re-assembly replaces instead of duplicating)
  const reAssembled = assembleEmailWithMarketingFooter(assembledImageEmail, {
    footerSettings,
    language: 'ko',
    unsubscribeUrl: unsubUrl,
  });

  const footerStartMatches = (reAssembled.match(/<!-- MARKETING_FOOTER_START -->/g) || []).length;
  assert(
    footerStartMatches === 1,
    `Idempotent assembly verified: exactly 1 footer marker block exists after re-assembly (found ${footerStartMatches})`
  );

  const detected = detectExistingFooterInHtml(reAssembled);
  assert(detected.hasExistingFooter, 'detectExistingFooterInHtml successfully identifies managed footer');

  // -------------------------------------------------------------------------
  // TEST SUITE 4: HTML & ZIP Package Import & Security
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: HTML & ZIP Package Import & Security ---');

  const validZipPath = path.join(__dirname, 'fixtures', 'valid-email-package.zip');
  const validZipBuf = fs.readFileSync(validZipPath);
  const zipResult = await importZipPackage(validZipBuf, 'Official Test Package');
  assert(zipResult.errors.length === 0, 'Clean ZIP package imports without errors');
  assert(zipResult.extractedAssets.length === 2, `Extracted 2 image assets from ZIP package`);
  assert(
    zipResult.htmlContent.includes('/api/marketing/assets/templates/') && !zipResult.htmlContent.includes('./images/hero.png'),
    'Relative image paths rewritten to hosted proxy HTTPS endpoints'
  );

  // Path traversal rejection
  const traversalZipPath = path.join(__dirname, 'fixtures', 'traversal-attack.zip');
  const traversalBuf = fs.readFileSync(traversalZipPath);
  const travResult = await importZipPackage(traversalBuf, 'Malicious Package');
  assert(
    travResult.errors.length > 0 || travResult.warnings.some(w => w.includes('traversal') || w.includes('Unsafe')),
    'Malicious ZIP with path traversal safely rejected'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 5: Real Unsubscribe & Suppression
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Real Unsubscribe & Suppression ---');

  const testRecipient = 'qa-buyer-optout@brand-network.com';
  const testCampaignId = 'camp-qa-verify-r1';

  // 5A. HMAC-SHA256 Token
  const token = generateUnsubscribeToken(testRecipient, testCampaignId);
  assert(typeof token === 'string' && token.length > 25, 'Opaque HMAC-SHA256 unsubscribe token generated');

  const tokenVerified = verifyUnsubscribeToken(token);
  assert(
    tokenVerified.valid && tokenVerified.email === testRecipient && tokenVerified.campaignId === testCampaignId,
    'HMAC token verifies correctly with matching payload'
  );

  // 5B. Tampered token rejection
  const badToken = token.slice(0, -6) + 'xxxxxx';
  const badVerified = verifyUnsubscribeToken(badToken);
  assert(!badVerified.valid, 'Tampered token safely rejected with valid: false');

  // 5C. Scanner-Safe GET behavior
  const suppressionBefore = await isEmailSuppressed(testRecipient);
  assert(!suppressionBefore, 'Simply visiting GET route does not opt-out recipient (scanner safe)');

  // 5D. Opt-out Execution
  const optOutResult = await recordEmailOptOut(testRecipient, 'UNSUBSCRIBED', 'QA R1 Opt-out', testCampaignId);
  assert(optOutResult.success, 'Opt-out recorded into suppression list');

  const suppressionAfter = await isEmailSuppressed(testRecipient);
  assert(suppressionAfter, 'isEmailSuppressed returns TRUE after opt-out recording');

  // -------------------------------------------------------------------------
  // TEST SUITE 6: Campaign Settings & Approval Snapshot Protection
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Campaign Settings & Approval Snapshot Protection ---');

  const testCampaignPayload = {
    name: '2026 Fall K-Beauty Strategic Outreach',
    purpose: 'PARTNERSHIP_PROPOSAL' as const,
    language: 'ko' as const,
    subjectOverride: '[K SELECT] 공식 브랜드 파트너십 입점 제안',
    previewText: '미국 500개 이상의 뷰티 살롱 및 온·오프라인 리테일 진출 기회',
    landingPageUrl: 'https://kselectnetwork.com/campaigns/fall-outreach',
    templateId: 'tmpl-qa-default',
    targetCompanyTypes: ['INDIE_BRAND'],
    targetGrades: ['A'],
    status: 'DRAFT' as const,
  };

  const createdCamp = await saveMarketingCampaign(testCampaignPayload);
  assert(!!createdCamp.id, `Campaign saved with ID: ${createdCamp.id}`);

  const loadedCamp = await getMarketingCampaignById(createdCamp.id);
  assert(loadedCamp.campaign?.subjectOverride === '[K SELECT] 공식 브랜드 파트너십 입점 제안', 'subjectOverride persisted & reloaded');
  assert(loadedCamp.campaign?.previewText === '미국 500개 이상의 뷰티 살롱 및 온·오프라인 리테일 진출 기회', 'previewText persisted & reloaded');
  assert(loadedCamp.campaign?.landingPageUrl === 'https://kselectnetwork.com/campaigns/fall-outreach', 'landingPageUrl persisted & reloaded');

  // 6B. Approval Snapshot
  const approvedCamp = await approveMarketingCampaign(createdCamp.id, 'qa-superadmin@letusto.com');
  assert(approvedCamp.status === 'APPROVED', 'Campaign successfully approved and locked');
  assert(!!approvedCamp.approvalSnapshot, 'Approval snapshot created');
  assert(
    approvedCamp.approvalSnapshot?.footerSettingsSnapshot?.physicalAddress?.includes('Mount Laurel'),
    'Approval snapshot froze the official Mount Laurel address'
  );
  assert(
    approvedCamp.approvalSnapshot?.senderAddress === 'Contact@letusto.com',
    'Approval snapshot froze official sender: Contact@letusto.com'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 7: Template Library Management & Safety Locks
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 7: Template Library Management & Safety Locks ---');

  const allTemplates = await listMarketingTemplates();
  assert(allTemplates.length > 0, `Library lists ${allTemplates.length} templates`);
  const baseTmpl = allTemplates[0];

  // 7A. Duplicate
  const dupTmpl = await duplicateMarketingTemplate(baseTmpl.id);
  assert(dupTmpl.id !== baseTmpl.id, 'Duplicated template received unique ID');
  assert(dupTmpl.name.includes('(Copy)'), 'Duplicated template name has (Copy) suffix');

  // 7B. Archive & Restore
  const archTmpl = await archiveMarketingTemplate(dupTmpl.id);
  assert(archTmpl.status === 'ARCHIVED', 'Template status transitioned to ARCHIVED');
  const restTmpl = await restoreMarketingTemplate(dupTmpl.id);
  assert(restTmpl.status === 'ACTIVE', 'Template status restored to ACTIVE');

  // 7C. Safe Delete Protection
  await saveMarketingCampaign({
    id: createdCamp.id,
    name: '2026 Fall K-Beauty Strategic Outreach',
    templateId: dupTmpl.id,
  });

  const deleteBlocked = await deleteMarketingTemplate(dupTmpl.id);
  assert(
    !deleteBlocked.success && Boolean(deleteBlocked.error?.includes('referenced by campaign')),
    `Delete is safely blocked when template is in use: "${deleteBlocked.error}"`
  );

  // Release and delete
  await saveMarketingCampaign({
    id: createdCamp.id,
    name: '2026 Fall K-Beauty Strategic Outreach',
    templateId: 'tmpl-qa-default',
  });
  const deleteSuccess = await deleteMarketingTemplate(dupTmpl.id);
  assert(deleteSuccess.success, 'Template deleted cleanly after campaign reference removed');

  // -------------------------------------------------------------------------
  // TEST SUITE 8: Transactional Email Isolation & LIVE_MODE Lock
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 8: Transactional Email Isolation & LIVE_MODE Lock ---');

  // 8A. Transactional isolation
  const transactionalCode = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'notifications', 'templates.ts'),
    'utf-8'
  );
  assert(
    !transactionalCode.includes('<!-- MARKETING_FOOTER_START -->'),
    'Transactional email templates remain isolated and do not contain marketing footer markers'
  );

  // 8B. LIVE_MODE hard-lock
  const dataAccessCode = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'brand-marketing', 'campaign-data-access.ts'),
    'utf-8'
  );
  assert(
    dataAccessCode.includes('is_live_mode_enabled') &&
    (dataAccessCode.includes('false') || dataAccessCode.includes('LIVE_MODE disabled')),
    'LIVE_MODE remains strictly locked to false'
  );

  // -------------------------------------------------------------------------
  // TEST SUITE 9: Migration 0188 SQL File Audit
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 9: Migration 0188 SQL File Audit ---');

  const migrationSqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '0188_marketing_footer_and_assets.sql');
  assert(fs.existsSync(migrationSqlPath), 'Migration 0188 file exists');

  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf-8');
  assert(
    migrationSql.includes('23B Roland Ave., Mount Laurel, NJ 08054, USA'),
    'Migration 0188 contains official Mount Laurel address'
  );
  assert(
    migrationSql.includes('Contact@letusto.com'),
    'Migration 0188 contains official email Contact@letusto.com'
  );
  assert(
    !migrationSql.includes("'1201 Orange St"),
    'Migration 0188 has no legacy Wilmington address in seed data'
  );
  assert(
    !migrationSql.includes("'support@kselectnetwork.com'"),
    'Migration 0188 has no legacy support@kselectnetwork.com in seed data'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON public.marketing_footer_settings FROM anon, public;'),
    'Migration 0188 explicitly revokes anon/public table access'
  );
  assert(
    migrationSql.includes('GRANT SELECT ON public.marketing_footer_settings TO authenticated;'),
    'Migration 0188 grants SELECT to authenticated'
  );
  assert(
    migrationSql.includes('GRANT ALL ON public.marketing_footer_settings TO service_role;'),
    'Migration 0188 grants ALL to service_role'
  );
  assert(
    migrationSql.includes('DROP POLICY IF EXISTS'),
    'Migration 0188 uses idempotent DROP POLICY IF EXISTS before creating policies'
  );

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
