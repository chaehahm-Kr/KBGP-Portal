import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { sourceRegistry } from '../lib/brand-sourcing/source-registry';
import { createBlankManualDraft } from '../lib/brand-sourcing/manual-entry';
import { IndieBeautyShowAdapter } from '../lib/brand-sourcing/adapters/indie-beauty-show.adapter';
import { saveSourcingDraft, findDuplicateCandidates } from '../lib/brand-sourcing/data-access';
import type { NormalizedCompanyDraft } from '../lib/brand-sourcing/types';

// Read .env.qa.local safely
const envPath = path.resolve(__dirname, '../.env.qa.local');
const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';
let qaSupabaseUrl = '';
let qaAnonKey = '';
let qaServiceRoleKey = '';

for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('QA_SUPABASE_URL=')) {
    qaSupabaseUrl = line.substring('QA_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('QA_SUPABASE_PUBLISHABLE_KEY=')) {
    qaAnonKey = line.substring('QA_SUPABASE_PUBLISHABLE_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('QA_SUPABASE_SECRET_KEY=')) {
    qaServiceRoleKey = line.substring('QA_SUPABASE_SECRET_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

// Security Guard against Production DB
if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu') || qaSupabaseUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: QA script cannot run on Production ref shzfrppdobpmrstcjfqu! Aborting.');
  process.exit(1);
}

const pgClient = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

const qaSupabase = createClient(qaSupabaseUrl, qaServiceRoleKey || qaAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function main() {
  await pgClient.connect();
  console.log('================================================================================');
  console.log('ADM-BSRC-014: Multi-Source Sourcing & Manual Registration Full QA Suite');
  console.log('Target QA Database: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Centralized Source Registry
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 1: Centralized Source Registry ---');
    const allSources = sourceRegistry.getAllSources();
    assert(allSources.length >= 2, `Registry has at least 2 sources registered (found: ${allSources.length})`);
    assert(allSources.some((s) => s.id === 'INTERCHARM'), 'InterCHARM Korea is registered');
    assert(allSources.some((s) => s.id === 'INDIE_BEAUTY_SHOW'), 'Indie Beauty Show 2026 is registered');

    // Test URL auto-detection
    const intercharmUrl = 'https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html';
    const ibsUrl = 'https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410507&t=board';
    const unknownUrl = 'https://unknown-expo.com/exhibitors/123';

    const detected1 = sourceRegistry.detectSourceByUrl(intercharmUrl);
    const detected2 = sourceRegistry.detectSourceByUrl(ibsUrl);
    const detected3 = sourceRegistry.detectSourceByUrl(unknownUrl);

    assert(detected1?.id === 'INTERCHARM', `InterCHARM URL detected as INTERCHARM (got: ${detected1?.id})`);
    assert(detected2?.id === 'INDIE_BEAUTY_SHOW', `Indie Beauty Show URL detected as INDIE_BEAUTY_SHOW (got: ${detected2?.id})`);
    assert(!detected3, `Unknown URL detected as falsy/undefined (got: ${detected3})`);

    const adapter1 = sourceRegistry.resolveAdapter(intercharmUrl);
    const adapter2 = sourceRegistry.resolveAdapter(ibsUrl);
    assert(adapter1.provider === 'INTERCHARM', 'Resolved adapter for InterCHARM has provider INTERCHARM');
    assert(adapter2.provider === 'INDIE_BEAUTY_SHOW', 'Resolved adapter for IBS has provider INDIE_BEAUTY_SHOW');
    passedTests++;
    console.log('TEST 1 PASSED!\n');

    // --------------------------------------------------------------------------
    // TEST 2: Manual Entry Generator
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 2: Manual Entry Blank Draft Generator ---');
    const blankDraft = createBlankManualDraft();
    assert(blankDraft.source.provider === 'MANUAL', `Draft source provider is MANUAL (got: ${blankDraft.source.provider})`);
    assert(blankDraft.source.sourceUrl === '', `Draft sourceUrl is empty string (got: "${blankDraft.source.sourceUrl}")`);
    assert(blankDraft.source.sourceIdentifier.startsWith('manual-'), `Draft sourceIdentifier starts with manual- (got: ${blankDraft.source.sourceIdentifier})`);
    assert(blankDraft.company.nameKr === '', 'Draft company nameKr is empty string');
    assert(blankDraft.company.businessTypes.length === 1 && blankDraft.company.businessTypes[0] === 'BRAND_OWNER', 'Draft default businessType is BRAND_OWNER');
    assert(blankDraft.brands.length === 1 && blankDraft.brands[0].source === 'MANUAL', 'Draft has 1 blank brand with source MANUAL');
    assert(blankDraft.contacts.length === 1 && blankDraft.contacts[0].isPrimary === true, 'Draft has 1 blank contact marked as primary');
    assert(Array.isArray(blankDraft.websites) && blankDraft.websites.length === 0, 'Draft starts with empty websites array');
    passedTests++;
    console.log('TEST 2 PASSED!\n');

    // --------------------------------------------------------------------------
    // TEST 3: Indie Beauty Show 2026 HTML Extraction on 3 Samples
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 3: Indie Beauty Show 2026 Extraction (Samples 1, 2, 3) ---');
    const ibsAdapter = new IndieBeautyShowAdapter();

    // Sample 1: 언리시아 (Unleashia)
    const sample1Path = path.resolve(__dirname, '../../sample1.html');
    const sample1Html = fs.readFileSync(sample1Path, 'utf8');
    const draft1 = await (ibsAdapter as any).parseHtml(sample1Html, 'https://indiebeautyshow.com/exhibitor-list2026/?bmode=view&idx=170410507', '170410507', { enrichWebsite: false });
    assert(draft1.company.nameKr === '언리시아', `Sample 1 nameKr = 언리시아 (got: ${draft1.company.nameKr})`);
    assert(draft1.company.representativeName === '최은영', `Sample 1 CEO = 최은영 (got: ${draft1.company.representativeName})`);
    assert(draft1.company.address.formattedKr?.includes('용산구'), `Sample 1 address contains 용산구 (got: ${draft1.company.address.formattedKr})`);
    assert(draft1.contacts.some((c: any) => c.email === 'sales@unleashiacosmetics.com'), `Sample 1 contact email extracted (got: ${draft1.contacts[0]?.email})`);
    assert(draft1.websites.some((w: any) => w.url.includes('unleashiacosmetics.com')), `Sample 1 website extracted (got: ${draft1.websites[0]?.url})`);
    assert(draft1.companyProducts.length >= 3, `Sample 1 products extracted >= 3 (got: ${draft1.companyProducts.length})`);
    assert(draft1.source.provider === 'INDIE_BEAUTY_SHOW', `Sample 1 provider = INDIE_BEAUTY_SHOW`);
    assert(draft1.source.sourceIdentifier === 'ibs-2026-170410507', `Sample 1 sourceIdentifier = ibs-2026-170410507`);

    // Sample 2: 에필로우 (Efilow)
    const sample2Path = path.resolve(__dirname, '../../sample2.html');
    const sample2Html = fs.readFileSync(sample2Path, 'utf8');
    const draft2 = await (ibsAdapter as any).parseHtml(sample2Html, 'https://indiebeautyshow.com/exhibitor-list2026/?bmode=view&idx=170410597', '170410597', { enrichWebsite: false });
    assert(draft2.company.nameKr === '에필로우', `Sample 2 nameKr = 에필로우 (got: ${draft2.company.nameKr})`);
    assert(draft2.company.representativeName === '차재형', `Sample 2 CEO = 차재형 (got: ${draft2.company.representativeName})`);
    assert(draft2.company.address.formattedKr?.includes('용산구'), `Sample 2 address contains 용산구 (got: ${draft2.company.address.formattedKr})`);
    assert(draft2.contacts.some((c: any) => c.email === 'jaycha@rvl.kr'), `Sample 2 contact email extracted (got: ${draft2.contacts[0]?.email})`);
    assert(draft2.contacts.some((c: any) => c.phone === '02-6261-3361'), `Sample 2 contact phone extracted (got: ${draft2.contacts[0]?.phone})`);
    assert(draft2.companyProducts.length >= 3, `Sample 2 products extracted >= 3 (got: ${draft2.companyProducts.length})`);

    // Sample 3: 허스텔러 (Hersteller)
    const sample3Path = path.resolve(__dirname, '../../sample3.html');
    const sample3Html = fs.readFileSync(sample3Path, 'utf8');
    const draft3 = await (ibsAdapter as any).parseHtml(sample3Html, 'https://indiebeautyshow.com/exhibitor-list2026/?bmode=view&idx=170410669', '170410669', { enrichWebsite: false });
    assert(draft3.company.nameKr === '허스텔러', `Sample 3 nameKr = 허스텔러 (got: ${draft3.company.nameKr})`);
    assert(draft3.company.representativeName === '김빛나', `Sample 3 CEO = 김빛나 (got: ${draft3.company.representativeName})`);
    assert(draft3.company.address.formattedKr?.includes('영동대로'), `Sample 3 address contains 영동대로 (got: ${draft3.company.address.formattedKr})`);
    assert(draft3.contacts.some((c: any) => c.email === 'herstellerbeauty@gmail.com'), `Sample 3 contact email extracted (got: ${draft3.contacts[0]?.email})`);
    assert(draft3.contacts.some((c: any) => c.phone === '1833-2087'), `Sample 3 contact phone extracted (got: ${draft3.contacts[0]?.phone})`);
    assert(draft3.companyProducts.length >= 2, `Sample 3 products extracted >= 2 (got: ${draft3.companyProducts.length})`);
    passedTests++;
    console.log('TEST 3 PASSED!\n');

    // --------------------------------------------------------------------------
    // TEST 4: Real QA Database Persistence (Indie Beauty Show Draft)
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 4: Real QA DB Persistence (Indie Beauty Show) ---');
    const testIbsCompanyKr = `QA_IBS_테스트_${Date.now()}`;
    const testIbsDraft: NormalizedCompanyDraft = {
      ...draft1,
      company: {
        ...draft1.company,
        nameKr: testIbsCompanyKr,
      },
      source: {
        ...draft1.source,
        sourceUrl: `https://indiebeautyshow.com/exhibitor-list2026/?idx=qa-test-${Date.now()}`,
        sourceIdentifier: `ibs-2026-qa-${Date.now()}`,
      },
    };

    const saveRes1 = await saveSourcingDraft(testIbsDraft, {
      grade: 'B',
      status: 'REVIEWED',
      businessTypes: ['BRAND_OWNER'],
      businessTypeEvidence: testIbsDraft.company.businessTypeEvidence,
      primaryProductCategories: ['MAKEUP'],
      primaryCategoriesConfirmed: true,
      categories: testIbsDraft.categories,
      documents: [],
      internalNotes: 'QA Test for Indie Beauty Show multi-source adapter',
      marketingConsentStatus: 'UNCONFIRMED',
    }, undefined, qaSupabase);

    assert(saveRes1.success === true && !!saveRes1.companyId, `IBS Draft saved successfully with ID: ${saveRes1.companyId}`);

    // Verify in QA Postgres
    const ibsDbRes = await pgClient.query(
      `SELECT c.id, c.company_name_kr, c.grade, c.status, s.provider, s.source_identifier
       FROM public.sourcing_companies c
       JOIN public.sourcing_sources s ON s.company_id = c.id
       WHERE c.id = $1`,
      [saveRes1.companyId]
    );
    assert(ibsDbRes.rows.length === 1, 'Company and Source joined row found in QA DB');
    assert(ibsDbRes.rows[0].provider === 'INDIE_BEAUTY_SHOW', `sourcing_sources.provider is INDIE_BEAUTY_SHOW (got: ${ibsDbRes.rows[0].provider})`);
    assert(ibsDbRes.rows[0].source_identifier === testIbsDraft.source.sourceIdentifier, 'source_identifier matches draft');

    // Clean up test record
    await pgClient.query('DELETE FROM public.sourcing_companies WHERE id = $1', [saveRes1.companyId]);
    console.log('  ✓ Cleaned up test IBS record from QA DB');
    passedTests++;
    console.log('TEST 4 PASSED!\n');

    // --------------------------------------------------------------------------
    // TEST 5: Real QA Database Persistence (Manual Entry Draft)
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 5: Real QA DB Persistence (Manual Registration) ---');
    const testManualCompanyKr = `QA_수동등록_테스트_${Date.now()}`;
    const testManualDraft: NormalizedCompanyDraft = {
      ...blankDraft,
      company: {
        ...blankDraft.company,
        nameKr: testManualCompanyKr,
        nameEn: 'QA Manual Company Test',
        representativeName: '홍길동',
        address: {
          ...blankDraft.company.address,
          formattedKr: '서울시 강남구 테헤란로 100',
        },
      },
      brands: [
        {
          nameKr: `QA브랜드_${Date.now()}`,
          nameEn: 'QA Brand',
          description: '수동 등록 테스트 브랜드',
          categories: ['Skin Care'],
          keyProducts: [],
          source: 'MANUAL',
        },
      ],
      contacts: [
        {
          name: '김담당',
          email: `qa_manual_${Date.now()}@example.com`,
          phone: '010-1234-5678',
          isPrimary: true,
          source: 'MANUAL',
          sourceUrl: null,
          department: '마케팅팀',
          jobTitle: '팀장',
        },
      ],
      websites: [
        {
          url: 'https://qa-manual-brand.example.com',
          label: 'OFFICIAL',
          source: 'MANUAL',
        },
      ],
    };

    const saveRes2 = await saveSourcingDraft(testManualDraft, {
      grade: 'A',
      status: 'SAVED',
      businessTypes: ['BRAND_OWNER'],
      businessTypeEvidence: testManualDraft.company.businessTypeEvidence,
      primaryProductCategories: ['SKINCARE'],
      primaryCategoriesConfirmed: true,
      categories: ['Skin Care'],
      documents: [],
      internalNotes: 'QA Test for Manual Entry registration without scraper or fake URL',
      marketingConsentStatus: 'UNCONFIRMED',
    }, undefined, qaSupabase);

    assert(saveRes2.success === true && !!saveRes2.companyId, `Manual Draft saved successfully with ID: ${saveRes2.companyId}`);

    // Verify in QA Postgres
    const manualDbRes = await pgClient.query(
      `SELECT id, company_name_kr, grade, status, raw_payload_snapshot
       FROM public.sourcing_companies
       WHERE id = $1`,
      [saveRes2.companyId]
    );
    assert(manualDbRes.rows.length === 1, 'Manual company row found in QA DB');
    assert(manualDbRes.rows[0].company_name_kr === testManualCompanyKr, 'Company name matches');

    // Verify sourcing_sources was cleanly skipped (no fake URL, no constraint failure)
    const sourcesCountRes = await pgClient.query(
      `SELECT count(*) FROM public.sourcing_sources WHERE company_id = $1`,
      [saveRes2.companyId]
    );
    assert(parseInt(sourcesCountRes.rows[0].count, 10) === 0, 'No sourcing_sources row inserted for pure manual entry (clean provenance)');

    // Verify contacts & brands
    const brandsCountRes = await pgClient.query(
      `SELECT count(*) FROM public.sourcing_brands WHERE company_id = $1`,
      [saveRes2.companyId]
    );
    assert(parseInt(brandsCountRes.rows[0].count, 10) === 1, 'Brand row inserted properly');

    const contactsCountRes = await pgClient.query(
      `SELECT count(*) FROM public.sourcing_contacts WHERE company_id = $1`,
      [saveRes2.companyId]
    );
    assert(parseInt(contactsCountRes.rows[0].count, 10) === 1, 'Contact row inserted properly');

    // Clean up test record
    await pgClient.query('DELETE FROM public.sourcing_companies WHERE id = $1', [saveRes2.companyId]);
    console.log('  ✓ Cleaned up test Manual Entry record from QA DB');
    passedTests++;
    console.log('TEST 5 PASSED!\n');

    // --------------------------------------------------------------------------
    // TEST 6: Multi-Vector Duplicate Detection (ADM-BSRC-012-R2 Compliance)
    // --------------------------------------------------------------------------
    totalTests++;
    console.log('--- TEST 6: Multi-Vector Duplicate Detection Check ---');

    // Insert a base company for duplicate testing
    const baseNameKr = `QA_중복검사_기저_${Date.now()}`;
    const baseBrandKr = `QA_중복브랜드_${Date.now()}`;
    const baseEmail = `qa_dup_${Date.now()}@testdup.com`;

    const baseDraft: NormalizedCompanyDraft = {
      ...blankDraft,
      company: {
        ...blankDraft.company,
        nameKr: baseNameKr,
        nameEn: 'Base Duplicate Test Corp',
      },
      brands: [{ nameKr: baseBrandKr, nameEn: '', description: '', categories: [], keyProducts: [], source: 'MANUAL' }],
      contacts: [{ name: 'Base Contact', email: baseEmail, phone: null, isPrimary: true, source: 'MANUAL', sourceUrl: null, department: null, jobTitle: null }],
    };

    const baseSaveRes = await saveSourcingDraft(baseDraft, undefined, undefined, qaSupabase);
    const baseCompanyId = baseSaveRes.companyId;

    try {
      // 1. Exact Company Name match triggers duplicate
      const dup1 = await findDuplicateCandidates({ companyNameKr: baseNameKr }, qaSupabase);
      assert(dup1.isDuplicate === true, 'Duplicate detected on exact Korean company name');
      assert(dup1.matches.some((m) => m.matchedField === '회사명'), 'Matched field is 회사명');

      // 2. Exact Brand Name match triggers duplicate
      const dup2 = await findDuplicateCandidates({ brands: [{ nameKr: baseBrandKr }] }, qaSupabase);
      assert(dup2.isDuplicate === true, 'Duplicate detected on exact brand name');
      assert(dup2.matches.some((m) => m.matchedField === '브랜드명'), 'Matched field is 브랜드명');

      // 3. Exact Email match triggers duplicate
      const dup3 = await findDuplicateCandidates({ emails: [baseEmail] }, qaSupabase);
      assert(dup3.isDuplicate === true, 'Duplicate detected on exact contact email');
      assert(dup3.matches.some((m) => m.matchedField === '담당자 이메일'), 'Matched field is 담당자 이메일');

      // 4. Unrelated company does NOT trigger duplicate
      const noDup = await findDuplicateCandidates({
        companyNameKr: `완전다른회사_${Date.now()}`,
        brands: [{ nameKr: `완전다른브랜드_${Date.now()}` }],
        emails: [`completely_different_${Date.now()}@unique.com`],
      }, qaSupabase);
      assert(noDup.isDuplicate === false, 'No duplicate false positive on unique company');

      passedTests++;
      console.log('TEST 6 PASSED!\n');
    } finally {
      await pgClient.query('DELETE FROM public.sourcing_companies WHERE id = $1', [baseCompanyId]);
      console.log('  ✓ Cleaned up duplicate test base record from QA DB');
    }

    console.log('================================================================================');
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} (100%)`);
    console.log('================================================================================');
  } catch (err: any) {
    console.error('QA SUITE ERROR:', err);
    process.exit(1);
  } finally {
    await pgClient.end();
  }
}

main();
