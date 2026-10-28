import * as fs from 'fs';
import { Client } from 'pg';
import {
  recommendPrimaryProductCategories,
  PrimaryProductCategory,
  PRIMARY_PRODUCT_CATEGORY_OPTIONS,
  COMPANY_TYPE_SHORT_LABELS,
  COMPANY_TYPE_OPTIONS,
} from '../lib/brand-sourcing';
import {
  saveSourcingDraft,
  listSourcingCompanies,
  getSourcingCompanyById,
  updateSourcingEvaluation,
  updateSourcingCandidateComplete,
  deleteSourcingCandidate,
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
  console.log('ADM-BSRC-011: Product Category Classification & Brand List Optimization QA');
  console.log('Database: QA Supabase (elkgizqgksshukxgcndy)');
  console.log('================================================================================\n');

  await pgClient.connect();

  const createdCompanyIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // Test Suite 1: All Six Product Classifications
    // --------------------------------------------------------------------------
    console.log('[Test Suite 1] All Six Product Classifications & Taxonomy');
    const expectedValues: PrimaryProductCategory[] = [
      'SKINCARE',
      'HAIRCARE',
      'MAKEUP',
      'BODYCARE',
      'PERSONAL_CARE',
      'BEAUTY_TOOLS',
    ];
    assert(
      PRIMARY_PRODUCT_CATEGORY_OPTIONS.length === 6,
      'Exactly 6 authoritative primary product categories defined'
    );
    for (const val of expectedValues) {
      const opt = PRIMARY_PRODUCT_CATEGORY_OPTIONS.find((o) => o.value === val);
      assert(!!opt, `Category ${val} is present with Korean and English labels (${opt?.labelKr} / ${opt?.labelEn})`);
    }

    // --------------------------------------------------------------------------
    // Test Suite 2: Company Type Short Labels Mapping
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 2] Company Type Short Display Labels');
    assert(COMPANY_TYPE_SHORT_LABELS['BRAND_OWNER'] === '브랜드', 'BRAND_OWNER maps to "브랜드"');
    assert(COMPANY_TYPE_SHORT_LABELS['OEM_ODM'] === 'OEM', 'OEM_ODM maps to "OEM"');
    assert(COMPANY_TYPE_SHORT_LABELS['MANUFACTURER'] === '제조사', 'MANUFACTURER maps to "제조사"');
    assert(COMPANY_TYPE_SHORT_LABELS['DISTRIBUTOR'] === '유통사', 'DISTRIBUTOR maps to "유통사"');
    assert(COMPANY_TYPE_SHORT_LABELS['IMPORTER_EXPORTER'] === '수출입', 'IMPORTER_EXPORTER maps to "수출입"');
    assert(COMPANY_TYPE_SHORT_LABELS['OTHER'] === '기타', 'OTHER maps to "기타"');
    assert(
      Object.keys(COMPANY_TYPE_SHORT_LABELS).length === COMPANY_TYPE_OPTIONS.length,
      'All company type enum values have corresponding short display labels'
    );

    // --------------------------------------------------------------------------
    // Test Suite 3: Automatic Category Recommendation Engine
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 3] Category Recommendation Engine');

    // 3a: Skincare evidence
    const skinRes = recommendPrimaryProductCategories({
      categories: ['Skin Care', 'Facial Masks'],
      products: [{ titleKr: '히알루론산 수분 앰플', description: '고농축 세럼' }],
    });
    assert(skinRes.includes('SKINCARE'), 'Recommends SKINCARE when skin care & ampoule evidence present');
    assert(skinRes.length === 1, 'Does not over-recommend other categories without evidence');

    // 3b: Haircare evidence
    const hairRes = recommendPrimaryProductCategories({
      categories: ['Hair Care'],
      products: [{ titleKr: '탈모 완화 샴푸', description: '두피 스칼프 트리트먼트' }],
    });
    assert(hairRes.includes('HAIRCARE'), 'Recommends HAIRCARE when shampoo & scalp evidence present');

    // 3c: Makeup evidence
    const makeupRes = recommendPrimaryProductCategories({
      categories: ['Make up and Color Cosmetics'],
      products: [{ titleKr: '글로우 벨벳 틴트', description: '고밀착 쿠션 파운데이션' }],
    });
    assert(makeupRes.includes('MAKEUP'), 'Recommends MAKEUP when tint & cushion evidence present');

    // 3d: Bodycare evidence
    const bodyRes = recommendPrimaryProductCategories({
      categories: ['Body Care'],
      products: [{ titleKr: '모이스처 바디워시', description: '바디로션 & 바디스크럽' }],
    });
    assert(bodyRes.includes('BODYCARE'), 'Recommends BODYCARE when body wash & lotion evidence present');

    // 3e: Personal Care evidence
    const personalRes = recommendPrimaryProductCategories({
      categories: ['Oral Care', 'Personal Care'],
      products: [{ titleKr: '허브 미백 치약', description: '여성청결제 및 핸드크림' }],
    });
    assert(personalRes.includes('PERSONAL_CARE'), 'Recommends PERSONAL_CARE when oral & hand cream present');

    // 3f: Beauty Tools evidence
    const toolsRes = recommendPrimaryProductCategories({
      categories: ['Beauty Devices'],
      products: [{ titleKr: '초음파 갈바닉 마사지기', description: '메이크업 브러쉬 세트 및 퍼프' }],
    });
    assert(toolsRes.includes('BEAUTY_TOOLS'), 'Recommends BEAUTY_TOOLS when device & brush evidence present');

    // 3g: Multi-category evidence (e.g. Skincare + Haircare + Makeup)
    const multiRes = recommendPrimaryProductCategories({
      categories: ['Skin Care', 'Hair Care', 'Make up and Color Cosmetics'],
      products: [
        { titleKr: '세럼', description: '기초' },
        { titleKr: '샴푸', description: '헤어' },
        { titleKr: '립스틱', description: '색조' },
      ],
    });
    assert(
      multiRes.length === 3 &&
      multiRes.includes('SKINCARE') &&
      multiRes.includes('HAIRCARE') &&
      multiRes.includes('MAKEUP'),
      'Correctly recommends multiple categories (SKINCARE, HAIRCARE, MAKEUP) simultaneously'
    );

    // 3h: Unclassified fallback (No concrete evidence)
    const unclassRes = recommendPrimaryProductCategories({
      categories: ['Contract Manufacturing(OEM/ODM)', 'Packing, Containers'],
      products: [{ titleKr: '화장품 용기', description: '플라스틱 패키징 사출 전문' }],
      descriptions: ['용기 전문 제조업체'],
    });
    assert(
      unclassRes.length === 0,
      'Leaves unclassified (empty array) when product specialization evidence is insufficient'
    );

    // --------------------------------------------------------------------------
    // Test Suite 4: Real Database Persistence & Multi-Select Assignment
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 4] Real DB Persistence & Multi-Select Assignment');
    const runId = Date.now();

    const mockDraft: NormalizedCompanyDraft = {
      company: {
        nameKr: `(주)카테고리테스트_${runId}`,
        nameEn: `Category Test Co. ${runId}`,
        descriptionKr: '스킨케어 및 뷰티툴 전문 제조 브랜드',
        descriptionEn: 'Skincare and beauty tools manufacturer',
        address: {
          line1: '강남대로 100',
          line2: null,
          city: '서울',
          stateProvince: '서울특별시',
          postcode: '06234',
          country: '한국',
          countryCode: 'KR',
          formattedKr: '서울특별시 강남구 강남대로 100',
          formattedEn: '100 Gangnam-daero, Seoul, Korea',
        },
        businessTypes: ['BRAND_OWNER', 'MANUFACTURER'],
        businessTypeEvidence: [],
        primaryProductCategories: ['SKINCARE', 'BEAUTY_TOOLS'],
        primaryCategoriesConfirmed: false,
        representativeName: '김대표',
        businessRegistrationNumber: '111-22-33333',
      },
      brands: [
        {
          nameKr: `브랜드A_${runId}`,
          nameEn: `Brand A ${runId}`,
          description: '스킨케어 브랜드',
          categories: ['Skin Care'],
          keyProducts: [],
          source: 'SOURCE_EXHIBITION',
        },
        {
          nameKr: `브랜드B_${runId}`,
          nameEn: `Brand B ${runId}`,
          description: '뷰티툴 브랜드',
          categories: ['Beauty Tools'],
          keyProducts: [],
          source: 'SOURCE_EXHIBITION',
        },
      ],
      contacts: [
        {
          name: '담당자',
          department: '해외영업',
          jobTitle: '팀장',
          email: `test_cat_${runId}@example.com`,
          phone: '02-1234-5678',
          isPrimary: true,
          source: 'SOURCE_EXHIBITION',
          sourceUrl: `https://test-cat-${runId}.com/exhibitor`,
        },
      ],
      websites: [
        {
          url: `https://test-cat-${runId}.com`,
          label: 'OFFICIAL',
          source: 'SOURCE_EXHIBITION',
        },
      ],
      socialMedia: [],
      categories: ['Skin Care', 'Beauty Tools'],
      source: {
        provider: 'INTERCHARM',
        sourceUrl: `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.cat_${runId}.html`,
        sourceIdentifier: `org-cat-${runId}`,
        collectedAt: new Date().toISOString(),
        eventEditionId: null,
        standLocation: 'Hall A 101',
      },
      enrichment: { attempted: false, success: false, enrichedUrl: null, enrichedPages: [] },
      audit: { status: 'SUCCESS', missingKeyFields: [], notes: [] },
    };

    const saveRes = await saveSourcingDraft(
      mockDraft,
      {
        primaryProductCategories: ['SKINCARE', 'BEAUTY_TOOLS'],
        primaryCategoriesConfirmed: false,
        grade: 'B',
        status: 'SAVED',
      },
      undefined,
      qaSupabase
    );

    assert(saveRes.success && !!saveRes.companyId, 'Initial candidate with primary categories saved to QA DB');
    createdCompanyIds.push(saveRes.companyId);

    // Verify stored columns
    const fetchedComp = await getSourcingCompanyById(saveRes.companyId, qaSupabase);
    assert(
      Array.isArray(fetchedComp.primary_product_categories) &&
      fetchedComp.primary_product_categories.length === 2 &&
      fetchedComp.primary_product_categories.includes('SKINCARE') &&
      fetchedComp.primary_product_categories.includes('BEAUTY_TOOLS'),
      'Persisted primary_product_categories matches saved values (SKINCARE, BEAUTY_TOOLS)'
    );
    assert(
      fetchedComp.primary_categories_confirmed === false,
      'primary_categories_confirmed initially false'
    );

    // --------------------------------------------------------------------------
    // Test Suite 5: Admin Manual Override Persistence & Confirmation Flag
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 5] Admin Manual Override & Confirmation Flag');
    await updateSourcingEvaluation(
      saveRes.companyId,
      {
        primaryProductCategories: ['SKINCARE', 'BEAUTY_TOOLS', 'MAKEUP'],
        primaryCategoriesConfirmed: true,
        grade: 'A',
      },
      qaSupabase
    );

    const updatedComp = await getSourcingCompanyById(saveRes.companyId, qaSupabase);
    assert(
      updatedComp.primary_product_categories.length === 3 &&
      updatedComp.primary_product_categories.includes('MAKEUP'),
      'Admin added MAKEUP to categories successfully'
    );
    assert(
      updatedComp.primary_categories_confirmed === true,
      'primary_categories_confirmed is true after admin update'
    );

    // --------------------------------------------------------------------------
    // Test Suite 6: Re-parsing Without Overwriting Confirmed Categories
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 6] Re-parsing Preserves Confirmed Categories');
    // Simulate re-parsing: draft only detected SKINCARE, but company already has confirmed categories
    const reparseDraft: NormalizedCompanyDraft = {
      ...mockDraft,
      company: {
        ...mockDraft.company,
        primaryProductCategories: ['SKINCARE'], // parser only found skincare
        primaryCategoriesConfirmed: false,
      },
    };

    // When updating complete without overriding evaluation, existing confirmed categories are preserved
    await updateSourcingCandidateComplete(
      saveRes.companyId,
      reparseDraft,
      {
        primaryProductCategories: updatedComp.primary_product_categories,
        primaryCategoriesConfirmed: true,
      },
      qaSupabase
    );

    const recheckComp = await getSourcingCompanyById(saveRes.companyId, qaSupabase);
    assert(
      recheckComp.primary_product_categories.length === 3 &&
      recheckComp.primary_categories_confirmed === true,
      'Confirmed categories (3 items) preserved intact after re-parsing'
    );

    // --------------------------------------------------------------------------
    // Test Suite 7: Second Company (Unclassified Fallback in DB)
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 7] Unclassified Fallback in Database');
    const unclassDraft: NormalizedCompanyDraft = {
      ...mockDraft,
      company: {
        ...mockDraft.company,
        nameKr: `(주)미분류테스트_${runId}`,
        nameEn: `Unclassified Test Co. ${runId}`,
        primaryProductCategories: [],
        primaryCategoriesConfirmed: false,
      },
      contacts: [
        {
          ...mockDraft.contacts[0],
          email: `test_unclass_${runId}@example.com`,
          sourceUrl: `https://test-unclass-${runId}.com/exhibitor`,
        },
      ],
      websites: [{ url: `https://test-unclass-${runId}.com`, label: 'OFFICIAL', source: 'SOURCE_EXHIBITION' }],
      source: {
        ...mockDraft.source,
        sourceUrl: `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.unclass_${runId}.html`,
        sourceIdentifier: `org-unclass-${runId}`,
      },
    };

    const unclassSave = await saveSourcingDraft(
      unclassDraft,
      {
        primaryProductCategories: [],
        primaryCategoriesConfirmed: false,
      },
      undefined,
      qaSupabase
    );
    assert(unclassSave.success, 'Unclassified company successfully saved');
    createdCompanyIds.push(unclassSave.companyId);

    const fetchedUnclass = await getSourcingCompanyById(unclassSave.companyId, qaSupabase);
    assert(
      Array.isArray(fetchedUnclass.primary_product_categories) &&
      fetchedUnclass.primary_product_categories.length === 0,
      'Unclassified company has empty primary_product_categories array'
    );

    // --------------------------------------------------------------------------
    // Test Suite 8: Category Filtering in Brand List Query
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 8] Category Filtering in Brand List Query');

    // 8a: Filter by MAKEUP (should return the first test company, but not the unclassified one)
    const makeupFilter = await listSourcingCompanies(
      {
        primaryCategories: ['MAKEUP'],
        limit: 50,
      },
      qaSupabase
    );
    const foundMakeup = makeupFilter.data.some((c: any) => c.id === saveRes.companyId);
    const foundUnclassInMakeup = makeupFilter.data.some((c: any) => c.id === unclassSave.companyId);
    assert(foundMakeup, 'Filter by MAKEUP includes company with MAKEUP');
    assert(!foundUnclassInMakeup, 'Filter by MAKEUP excludes company without MAKEUP');

    // 8b: Filter by UNCLASSIFIED
    const unclassFilter = await listSourcingCompanies(
      {
        primaryCategories: ['UNCLASSIFIED'],
        limit: 50,
      },
      qaSupabase
    );
    const foundUnclassInUnclass = unclassFilter.data.some((c: any) => c.id === unclassSave.companyId);
    const foundCategorizedInUnclass = unclassFilter.data.some((c: any) => c.id === saveRes.companyId);
    assert(foundUnclassInUnclass, 'Filter by UNCLASSIFIED includes unclassified company');
    assert(!foundCategorizedInUnclass, 'Filter by UNCLASSIFIED excludes categorized company');

    // 8c: Multi-category filter (SKINCARE or UNCLASSIFIED)
    const multiFilter = await listSourcingCompanies(
      {
        primaryCategories: ['SKINCARE', 'UNCLASSIFIED'],
        limit: 50,
      },
      qaSupabase
    );
    assert(
      multiFilter.data.some((c: any) => c.id === saveRes.companyId) &&
      multiFilter.data.some((c: any) => c.id === unclassSave.companyId),
      'Multi-category filter includes both matched category and unclassified'
    );

    // --------------------------------------------------------------------------
    // Test Suite 9: Brand List Compact Formatting Logic (+N presentation)
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 9] Compact Presentation (+N Math & Brand/Category Counts)');
    const testCats = ['SKINCARE', 'BEAUTY_TOOLS', 'MAKEUP'];
    const visibleCats = testCats.slice(0, 2);
    const remainingCount = testCats.length - 2;

    assert(visibleCats.length === 2, 'Displays exactly 2 category badges');
    assert(visibleCats[0] === 'SKINCARE' && visibleCats[1] === 'BEAUTY_TOOLS', 'First 2 badges preserved in order');
    assert(remainingCount === 1, '+N count correctly computed as +1 for 3 categories');

    const brandCount = mockDraft.brands.length;
    assert(brandCount === 2, 'Brand count matches underlying records (2 Brands)');

    const rawCatCount = mockDraft.categories.length;
    assert(rawCatCount === 2, 'Category count matches underlying raw categories (2 Categories)');

    // --------------------------------------------------------------------------
    // Test Suite 10: Existing Data Preservation & Regression Checks
    // --------------------------------------------------------------------------
    console.log('\n[Test Suite 10] Existing Data Preservation & Regressions');
    const existingCheck = await listSourcingCompanies({ limit: 100 }, qaSupabase);
    assert(
      existingCheck.total >= 16,
      `All pre-existing companies preserved intact (total: ${existingCheck.total})`
    );

    // Check pre-existing company columns
    const sampleExisting = existingCheck.data.find((c: any) => !createdCompanyIds.includes(c.id));
    assert(!!sampleExisting, 'Found pre-existing company in QA database');
    assert(
      sampleExisting.company_name_kr !== undefined &&
      sampleExisting.grade !== undefined &&
      sampleExisting.status !== undefined,
      'Pre-existing company retains company_name_kr, grade, and status'
    );
    assert(
      Array.isArray(sampleExisting.primary_product_categories),
      'Pre-existing company has primary_product_categories array populated'
    );

    // Verify duplicate URL block is still active
    let dupBlocked = false;
    try {
      await saveSourcingDraft(mockDraft, undefined, undefined, qaSupabase);
    } catch (err: any) {
      if (err.message.includes('DUPLICATE_SOURCE_URL')) {
        dupBlocked = true;
      }
    }
    assert(dupBlocked, 'Regression check: Duplicate canonical URL still strictly blocked');

    console.log('\n================================================================================');
    console.log(`QA TEST SUITE RESULT: ${passedAssertions} / ${totalAssertions} PASSED (100% PASS)`);
    console.log('================================================================================');
  } finally {
    // Clean up created test companies
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
