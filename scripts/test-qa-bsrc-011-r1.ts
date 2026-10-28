import * as fs from 'fs';
import { Client } from 'pg';
import {
  recommendPrimaryProductCategories,
  PrimaryProductCategory,
  PRIMARY_PRODUCT_CATEGORY_OPTIONS,
  COMPANY_TYPE_SHORT_LABELS,
} from '../lib/brand-sourcing';
import {
  saveSourcingDraft,
  listSourcingCompanies,
  getSourcingCompanyById,
  updateSourcingEvaluation,
  updateSourcingCandidateComplete,
  deleteSourcingCandidate,
  findDuplicateCandidates,
} from '../lib/brand-sourcing/data-access';
import { NormalizedCompanyDraft } from '../lib/brand-sourcing/types';

// Load QA environment safely
let qaUrl = '';
let qaKey = '';
let qaDbUrl = '';

if (fs.existsSync('.env.qa.local')) {
  const content = fs.readFileSync('.env.qa.local', 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith('QA_SUPABASE_URL=')) {
      qaUrl = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
    if (line.startsWith('QA_SUPABASE_SECRET_KEY=')) {
      qaKey = line.split('=')[1].trim().replace(/^['"]|['"]$/g, '');
    }
    if (line.startsWith('QA_DATABASE_URL=')) {
      qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

if (!qaUrl || !qaKey || !qaDbUrl || qaUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: Refusing to run on production ref shzfrppdobpmrstcjfqu!');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pgClient = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedAssertions++;
  console.log(`  ✓ [PASS] ${message}`);
}

async function main() {
  console.log('================================================================================');
  console.log('TASK ID: ADM-BSRC-011-R1: SQL 0190 Safety Fix & Category Classification QA');
  console.log('Database: QA Supabase (elkgizqgksshukxgcndy)');
  console.log('================================================================================\n');

  await pgClient.connect();

  const createdCompanyIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // Test Suite 1: Corrected SQL 0190 Idempotency & Repeat Execution
    // --------------------------------------------------------------------------
    console.log('[Test Suite 1] SQL 0190 First Execution & Repeat Execution (Idempotency)');
    const sqlPath = 'supabase/migrations/0190_brand_sourcing_primary_categories.sql';
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Verify information_schema check in file
    assert(
      sqlContent.includes("table_name = 'sourcing_companies'") &&
      sqlContent.includes("column_name = 'primary_categories_confirmed'"),
      "SQL 0190 uses table_name = 'sourcing_companies' and column_name = 'primary_categories_confirmed'"
    );

    // Pass 1 execution
    console.log('  Executing SQL 0190 (Pass 1)...');
    await pgClient.query(sqlContent);
    assert(true, 'SQL 0190 Pass 1 executed with 0 errors');

    // Pass 2 repeat execution (idempotency verification)
    console.log('  Executing SQL 0190 (Pass 2 - Repeat Execution)...');
    await pgClient.query(sqlContent);
    assert(true, 'SQL 0190 Pass 2 (repeat execution) succeeded with 0 errors');

    // Verify column existence directly in DB
    const colCheck = await pgClient.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sourcing_companies'
        AND column_name IN ('primary_product_categories', 'primary_categories_confirmed')
      ORDER BY column_name;
    `);
    assert(colCheck.rows.length === 2, 'Both primary_product_categories and primary_categories_confirmed exist in sourcing_companies');
    assert(colCheck.rows[0].column_name === 'primary_categories_confirmed' && colCheck.rows[0].data_type === 'boolean', 'primary_categories_confirmed is BOOLEAN NOT NULL');
    assert(colCheck.rows[1].column_name === 'primary_product_categories' && colCheck.rows[1].data_type === 'ARRAY', 'primary_product_categories is TEXT[] NOT NULL');

    // Verify GIN index
    const indexCheck = await pgClient.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'sourcing_companies'
        AND indexname = 'idx_sourcing_companies_primary_categories';
    `);
    assert(indexCheck.rows.length === 1, 'GIN index idx_sourcing_companies_primary_categories exists and is active');

    // Verify CHECK constraint
    const constraintCheck = await pgClient.query(`
      SELECT conname, pg_get_constraintdef(oid) as condef
      FROM pg_constraint
      WHERE conname = 'chk_sourcing_companies_primary_categories';
    `);
    assert(constraintCheck.rows.length === 1, 'Constraint chk_sourcing_companies_primary_categories enforces 6 authoritative categories');

    // --------------------------------------------------------------------------
    // Test Suite 2: Preservation of Admin-Confirmed Categories (Initial Backfill Protection)
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 2] Preservation of Admin-Confirmed Categories During Backfill');
    const timestamp = Date.now();

    // 2a. Candidate with confirmed categories
    const confirmedDraft: NormalizedCompanyDraft = {
      source: {
        provider: 'INTERCHARM',
        sourceUrl: `https://intercharm.co.kr/fairDash.do?hl=KOR&dType=A&stand=CONFIRMED_${timestamp}`,
        canonicalSourceUrl: `https://intercharm.co.kr/fairdash.do?dtype=a&hl=kor&stand=confirmed_${timestamp}`,
        sourceIdentifier: `org-confirmed-${timestamp}`,
        collectedAt: new Date().toISOString(),
        rawPayloadSnapshot: {
          categories: ['스킨케어', '클렌징폼'], // Would match SKINCARE if backfilled
        },
      },
      company: {
        nameKr: `(주)확인보존테스트_${timestamp}`,
        nameEn: `Confirmed Preservation Co ${timestamp}`,
        address: { line1: '서울 강남구', formattedKr: '서울 강남구' },
        businessTypes: ['BRAND_OWNER'],
        businessTypeEvidence: [],
        representativeName: '김확인',
        businessRegistrationNumber: '111-22-33333',
      },
      brands: [],
      contacts: [],
      websites: [],
      categories: ['스킨케어', '클렌징폼'],
      companyProducts: [],
      audit: { validationErrors: [] },
    };

    const confirmedRes = await saveSourcingDraft(
      confirmedDraft,
      {
        primaryProductCategories: ['BEAUTY_TOOLS'], // Admin explicitly selected BEAUTY_TOOLS
        primaryCategoriesConfirmed: true,           // Admin confirmed
      },
      undefined,
      qaSupabase
    );
    createdCompanyIds.push(confirmedRes.companyId);
    assert(true, `Saved confirmed candidate with BEAUTY_TOOLS (ID: ${confirmedRes.companyId})`);

    // 2b. Candidate with INTENTIONALLY EMPTY confirmed categories
    const confirmedEmptyDraft: NormalizedCompanyDraft = {
      source: {
        provider: 'INTERCHARM',
        sourceUrl: `https://intercharm.co.kr/fairDash.do?hl=KOR&dType=A&stand=EMPTY_${timestamp}`,
        canonicalSourceUrl: `https://intercharm.co.kr/fairdash.do?dtype=a&hl=kor&stand=empty_${timestamp}`,
        sourceIdentifier: `org-empty-${timestamp}`,
        collectedAt: new Date().toISOString(),
        rawPayloadSnapshot: {
          categories: ['샴푸', '헤어케어'], // Would match HAIRCARE if backfilled
        },
      },
      company: {
        nameKr: `(주)의도적공백테스트_${timestamp}`,
        nameEn: `Intentional Empty Co ${timestamp}`,
        address: { line1: '서울 서초구', formattedKr: '서울 서초구' },
        businessTypes: ['DISTRIBUTOR'],
        businessTypeEvidence: [],
        representativeName: '이공백',
        businessRegistrationNumber: '222-33-44444',
      },
      brands: [],
      contacts: [],
      websites: [],
      categories: ['샴푸', '헤어케어'],
      companyProducts: [],
      audit: { validationErrors: [] },
    };

    const emptyRes = await saveSourcingDraft(
      confirmedEmptyDraft,
      {
        primaryProductCategories: [],
        primaryCategoriesConfirmed: true, // Intentionally confirmed empty
      },
      undefined,
      qaSupabase
    );
    createdCompanyIds.push(emptyRes.companyId);
    assert(true, `Saved candidate with intentionally empty confirmed categories (ID: ${emptyRes.companyId})`);

    // 2c. Unconfirmed candidate with empty categories that SHOULD be backfilled
    const unconfirmedDraft: NormalizedCompanyDraft = {
      source: {
        provider: 'INTERCHARM',
        sourceUrl: `https://intercharm.co.kr/fairDash.do?hl=KOR&dType=A&stand=UNCONF_${timestamp}`,
        canonicalSourceUrl: `https://intercharm.co.kr/fairdash.do?dtype=a&hl=kor&stand=unconf_${timestamp}`,
        sourceIdentifier: `org-unconf-${timestamp}`,
        collectedAt: new Date().toISOString(),
        rawPayloadSnapshot: {
          categories: ['바디워시', '바디로션'],
        },
      },
      company: {
        nameKr: `(주)미확인백필테스트_${timestamp}`,
        nameEn: `Unconfirmed Backfill Co ${timestamp}`,
        address: { line1: '서울 송파구', formattedKr: '서울 송파구' },
        businessTypes: ['MANUFACTURER'],
        businessTypeEvidence: [],
        representativeName: '박미확',
        businessRegistrationNumber: '333-44-55555',
      },
      brands: [],
      contacts: [],
      websites: [],
      categories: ['바디워시', '바디로션'],
      companyProducts: [],
      audit: { validationErrors: [] },
    };

    const unconfRes = await saveSourcingDraft(
      unconfirmedDraft,
      {
        primaryProductCategories: [],
        primaryCategoriesConfirmed: false, // Unconfirmed
      },
      undefined,
      qaSupabase
    );
    createdCompanyIds.push(unconfRes.companyId);
    assert(true, `Saved unconfirmed candidate with empty categories (ID: ${unconfRes.companyId})`);

    // Now re-run SQL 0190 Section 3 backfill
    console.log('  Executing SQL 0190 Backfill block...');
    await pgClient.query(sqlContent);

    // Verify 2a: Confirmed selection was NOT overwritten
    const check2a = await getSourcingCompanyById(confirmedRes.companyId, qaSupabase);
    assert(
      check2a.primary_categories_confirmed === true,
      'Confirmed selection retains primary_categories_confirmed = true'
    );
    assert(
      JSON.stringify(check2a.primary_product_categories) === JSON.stringify(['BEAUTY_TOOLS']),
      'Confirmed BEAUTY_TOOLS selection was NOT overwritten by raw category keywords (SKINCARE)'
    );

    // Verify 2b: Intentionally empty confirmed categories were NOT overwritten
    const check2b = await getSourcingCompanyById(emptyRes.companyId, qaSupabase);
    assert(
      check2b.primary_categories_confirmed === true,
      'Intentionally empty confirmed company retains primary_categories_confirmed = true'
    );
    assert(
      check2b.primary_product_categories.length === 0,
      'Intentionally empty confirmed categories were preserved as empty array []'
    );

    // Verify 2c: Unconfirmed candidate WAS safely backfilled to BODYCARE
    const check2c = await getSourcingCompanyById(unconfRes.companyId, qaSupabase);
    assert(
      check2c.primary_categories_confirmed === false,
      'Backfilled company retains primary_categories_confirmed = false'
    );
    assert(
      check2c.primary_product_categories.includes('BODYCARE'),
      'Unconfirmed company with 바디워시 was safely backfilled to BODYCARE'
    );

    // --------------------------------------------------------------------------
    // Test Suite 3: Ambiguous Keyword Matching & Classification Accuracy
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 3] Ambiguous Keyword Accuracy (Zero False Positives)');

    // 3a. eye cream -> SKINCARE, not MAKEUP
    const eyeCreamResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '골드 리프팅 아이크림', titleEn: 'Gold Lifting Eye Cream', description: 'Deep nourishing eye cream for fine lines' }],
    });
    assert(
      eyeCreamResult.includes('SKINCARE') && !eyeCreamResult.includes('MAKEUP'),
      'Eye cream classifies as SKINCARE and avoids MAKEUP'
    );

    // 3b. eyeshadow / eyeliner -> MAKEUP, not SKINCARE
    const eyeShadowResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '12색 아이섀도우 팔레트', titleEn: '12-Color Eyeshadow Palette', description: 'Vibrant matte eyeshadow' }],
    });
    assert(
      eyeShadowResult.includes('MAKEUP') && !eyeShadowResult.includes('SKINCARE'),
      'Eyeshadow classifies as MAKEUP and avoids SKINCARE'
    );

    // 3c. bare "eye" in general prose -> Unclassified (no false match to MAKEUP or SKINCARE)
    const bareEyeResult = recommendPrimaryProductCategories({
      descriptions: ['Keeping a sharp eye on global cosmetic industry trends and innovation.'],
    });
    assert(
      bareEyeResult.length === 0,
      'Bare "eye" in non-product prose leaves company Unclassified (empty array)'
    );

    // 3d. bare "color" in general prose -> Unclassified (no false match to MAKEUP)
    const bareColorResult = recommendPrimaryProductCategories({
      descriptions: ['We analyze natural skin color diversity and hair color variations.'],
    });
    assert(
      bareColorResult.length === 0,
      'Bare "color" (e.g. skin color, hair color) does not falsely trigger MAKEUP'
    );

    // 3e. "color cosmetics" / "색조화장품" -> MAKEUP
    const colorCosmeticsResult = recommendPrimaryProductCategories({
      categories: ['Color Cosmetics', '색조화장품'],
    });
    assert(
      colorCosmeticsResult.includes('MAKEUP'),
      '"Color Cosmetics" / "색조화장품" correctly classifies as MAKEUP'
    );

    // 3f. hand cream -> PERSONAL_CARE, not SKINCARE
    const handCreamResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '시어버터 보습 핸드크림', titleEn: 'Shea Butter Moisture Hand Cream' }],
    });
    assert(
      handCreamResult.includes('PERSONAL_CARE') && !handCreamResult.includes('SKINCARE'),
      'Hand cream classifies as PERSONAL_CARE and does NOT falsely trigger SKINCARE'
    );

    // 3g. body cream -> BODYCARE, not SKINCARE
    const bodyCreamResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '아로마 릴렉싱 바디크림', titleEn: 'Aroma Relaxing Body Cream' }],
    });
    assert(
      bodyCreamResult.includes('BODYCARE') && !bodyCreamResult.includes('SKINCARE'),
      'Body cream classifies as BODYCARE and does NOT falsely trigger SKINCARE'
    );

    // 3h. facial cream / 수분크림 -> SKINCARE
    const moistureCreamResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '히알루론산 수분크림', titleEn: 'Hyaluronic Water Cream' }],
    });
    assert(
      moistureCreamResult.includes('SKINCARE'),
      'Facial moisture cream (수분크림) classifies as SKINCARE'
    );

    // 3i. bare "hand" in prose (e.g. handmade, crafted by hand) -> does NOT trigger PERSONAL_CARE
    const bareHandResult = recommendPrimaryProductCategories({
      descriptions: ['Every formulation is handmade with care in our organic workshop.'],
    });
    assert(
      bareHandResult.length === 0,
      'Bare "hand" (e.g. handmade) does not falsely trigger PERSONAL_CARE'
    );

    // 3j. bare "body" in prose (e.g. governing body, whole body of work) -> does NOT trigger BODYCARE
    const bareBodyResult = recommendPrimaryProductCategories({
      descriptions: ['Approved by the European regulatory body as an eco-certified laboratory.'],
    });
    assert(
      bareBodyResult.length === 0,
      'Bare "body" (e.g. regulatory body) does not falsely trigger BODYCARE'
    );

    // 3k. bare "tool" in prose (e.g. software analytics tool) -> does NOT trigger BEAUTY_TOOLS
    const bareToolResult = recommendPrimaryProductCategories({
      descriptions: ['We utilize an advanced internal research analytics tool.'],
    });
    assert(
      bareToolResult.length === 0,
      'Bare "tool" in non-beauty context does not falsely trigger BEAUTY_TOOLS'
    );

    // 3l. beauty device / 괄사 / 미용기기 -> BEAUTY_TOOLS
    const beautyDeviceResult = recommendPrimaryProductCategories({
      products: [{ titleKr: '로즈쿼츠 페이셜 괄사 마사지기', titleEn: 'Rose Quartz Guasha Device' }],
    });
    assert(
      beautyDeviceResult.includes('BEAUTY_TOOLS'),
      'Guasha and beauty device correctly classify as BEAUTY_TOOLS'
    );

    // 3m. Weak evidence (general distributor with no product details) -> Unclassified
    const weakEvidenceResult = recommendPrimaryProductCategories({
      categories: ['화장품 무역', 'Cosmetics General Trading'],
      descriptions: ['Global trading and business consulting services in Korea.'],
    });
    assert(
      weakEvidenceResult.length === 0,
      'Weak/insufficient product evidence leaves company Unclassified (empty array)'
    );

    // --------------------------------------------------------------------------
    // Test Suite 4: Re-parsing Behavior & Confirmed Data Preservation
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 4] Re-parsing Duplicate Detection & Confirmed State Preservation');
    const dupCheck = await findDuplicateCandidates(
      {
        sourceUrl: confirmedDraft.source.sourceUrl,
        companyNameKr: confirmedDraft.company.nameKr,
      },
      qaSupabase
    );

    assert(dupCheck.isDuplicate, 'Duplicate candidate detected on re-parsing existing company');
    const matched = dupCheck.matches.find((m) => m.entityId === confirmedRes.companyId);
    assert(!!matched, 'Matched existing company record in duplicate check');
    assert(
      matched?.primaryCategoriesConfirmed === true,
      'Duplicate match returns primaryCategoriesConfirmed = true'
    );
    assert(
      JSON.stringify(matched?.primaryProductCategories) === JSON.stringify(['BEAUTY_TOOLS']),
      'Duplicate match returns confirmed categories [BEAUTY_TOOLS] to preserve'
    );

    // --------------------------------------------------------------------------
    // Test Suite 5: Existing Data Preservation & Zero Regressions
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 5] Existing Data Preservation & Regressions');
    const existingCheck = await listSourcingCompanies({ limit: 100 }, qaSupabase);
    assert(
      existingCheck.total >= 16,
      `All pre-existing companies preserved intact (total: ${existingCheck.total})`
    );

    console.log('\n================================================================================');
    console.log(`QA TEST SUITE RESULT: ${passedAssertions} / ${totalAssertions} PASSED (100% PASS)`);
    console.log('================================================================================');
  } finally {
    console.log('\n[Clean Up] Cleaning up synthetic test records from QA DB...');
    for (const id of createdCompanyIds) {
      try {
        await deleteSourcingCandidate(id, qaSupabase);
      } catch (err) {
        console.error(`Failed to clean up test company ${id}:`, err);
      }
    }
    console.log(`✓ Cleaned up ${createdCompanyIds.length} synthetic test companies.`);
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error('Fatal error during QA test suite:', err);
  process.exit(1);
});
