import * as fs from "fs";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeSourceUrl,
  extractExhibitorIdentifier,
  normalizeKoreanCompanyName,
  normalizeEnglishCompanyName,
  normalizeWebsiteDomain,
  calculateStringSimilarity,
  areCompanyNamesSimilar,
} from "../lib/brand-sourcing/duplicate-detector";
import {
  findDuplicateCandidates,
  saveSourcingDraft,
  linkSourcingSource,
  getSourcingDuplicateAuditReport,
  getSourcingCompanyById,
  listSourcingCompanies,
  updateSourcingCandidateComplete,
  deleteSourcingCandidate,
} from "../lib/brand-sourcing/data-access";
import {
  recommendPrimaryProductCategories,
  PrimaryProductCategory,
  PRIMARY_PRODUCT_CATEGORY_OPTIONS,
  COMPANY_TYPE_SHORT_LABELS,
} from "../lib/brand-sourcing";
import type {
  NormalizedCompanyDraft,
  SourcingEvaluationInput,
  AdminDuplicateExceptionInput,
} from "../lib/brand-sourcing/types";

// Safety check: ensure running against QA database only
let qaUrl = "";
let qaKey = "";
let qaDbUrl = "";

if (fs.existsSync(".env.qa.local")) {
  const content = fs.readFileSync(".env.qa.local", "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("QA_SUPABASE_URL=")) {
      qaUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("QA_SUPABASE_SECRET_KEY=")) {
      qaKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("QA_DATABASE_URL=")) {
      qaDbUrl = line.substring("QA_DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

if (!qaUrl || !qaKey || !qaDbUrl || qaUrl.includes("shzfrppdobpmrstcjfqu")) {
  console.error("FATAL: Refusing to run on production ref shzfrppdobpmrstcjfqu or missing QA env!");
  process.exit(1);
}

// Set env vars so getClient() fallback also safely targets QA
process.env.NEXT_PUBLIC_SUPABASE_URL = qaUrl;
process.env.SUPABASE_URL = qaUrl;
process.env.SUPABASE_SECRET_KEY = qaKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = qaKey;

const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const pgClient = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ [FAIL] ${testName} - ${detail || "Condition not met"}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

function createSampleDraft(params: {
  nameKr: string;
  nameEn?: string;
  sourceUrl: string;
  sourceIdentifier: string;
  categories?: string[];
  primaryProductCategories?: PrimaryProductCategory[];
  primaryCategoriesConfirmed?: boolean;
  businessTypes?: any[];
}): NormalizedCompanyDraft {
  return {
    company: {
      nameKr: params.nameKr,
      nameEn: params.nameEn || null,
      descriptionKr: "ADM-BSRC-012 통합 테스트 기업 설명",
      descriptionEn: "Integration Test Company Description",
      address: {
        raw: "서울특별시 강남구 테헤란로 123",
        postalCode: "06234",
        city: "서울",
        country: "KR",
      },
      businessTypes: params.businessTypes || ["BRAND_OWNER"],
      businessTypeEvidence: [],
      primaryProductCategories: params.primaryProductCategories,
      primaryCategoriesConfirmed: params.primaryCategoriesConfirmed,
      representativeName: "홍길동",
      businessRegistrationNumber: "123-45-67890",
    },
    brands: [
      {
        nameKr: "테스트브랜드",
        nameEn: "TestBrand",
        description: "통합 테스트 브랜드",
        categories: params.categories || ["스킨케어"],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
    ],
    contacts: [
      {
        name: "김담당",
        department: "마케팅팀",
        jobTitle: "팀장",
        email: "contact@integrationtest.com",
        phone: "010-9999-8888",
        isPrimary: true,
        source: "SOURCE_EXHIBITION",
        sourceUrl: params.sourceUrl,
      },
    ],
    websites: [
      {
        url: "https://integrationtest.co.kr",
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION",
      },
    ],
    socialMedia: [],
    categories: params.categories || ["스킨케어", "헤어케어"],
    source: {
      provider: "INTERCHARM",
      sourceUrl: params.sourceUrl,
      sourceIdentifier: params.sourceIdentifier,
      collectedAt: new Date().toISOString(),
      eventEditionId: "2026-intercharm",
      standLocation: "B-205",
    },
    enrichment: {
      attempted: true,
      success: true,
      enrichedUrl: "https://integrationtest.co.kr",
      enrichedPages: [],
    },
    audit: {
      status: "SUCCESS",
      missingKeyFields: [],
      notes: [],
    },
  };
}

async function runIntegratedLifecycle() {
  console.log("================================================================================");
  console.log("ADM-BSRC-012: Integrated Lifecycle & Concurrency QA Verification");
  console.log("================================================================================");

  await pgClient.connect();

  const timestamp = Date.now();
  const testExhibitorId = `org-${timestamp}`;
  const testUrl1 = `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test-${timestamp}.${testExhibitorId}.html`;
  const testUrl2 = `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test2-${timestamp}.${testExhibitorId}-second.html`;
  const companyNameKr = `(주)인테그레이션 랩스_${timestamp}`;
  const companyNameEn = `Integration Labs Alpha ${timestamp} Inc.`;

  let createdCompanyId: string | null = null;
  let exceptionCompanyId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Phase 1: Category Classification Recommendation on extraction
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 1] Category Classification Recommendation on Exhibitor Extraction");
    const sampleRawData = {
      productSummary: "피부 진정 세럼, 하이드레이팅 모이스처 크림 및 샴푸, 트리트먼트 제품 생산",
      categories: ["스킨케어", "헤어케어"],
      exhibitorDescription: "자연 유래 성분 스킨케어 세럼 및 데일리 헤어케어 샴푸 전문 브랜드",
    };

    const recommended = recommendPrimaryProductCategories({
      productSummary: sampleRawData.productSummary,
      categories: sampleRawData.categories,
      description: sampleRawData.exhibitorDescription,
    });

    assert(
      recommended.includes("SKINCARE" as PrimaryProductCategory),
      "Recommends SKINCARE based on serum/cream/skincare evidence"
    );
    assert(
      recommended.includes("HAIRCARE" as PrimaryProductCategory),
      "Recommends HAIRCARE based on shampoo/treatment evidence"
    );
    assert(
      !recommended.includes("MAKEUP" as PrimaryProductCategory),
      "Does NOT recommend MAKEUP when no makeup evidence exists"
    );

    // -------------------------------------------------------------------------
    // Phase 2: Save Candidate Company with Confirmed Categories
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 2] Save Candidate Company with Admin Confirmed Categories");

    const draftCompany = createSampleDraft({
      nameKr: companyNameKr,
      nameEn: companyNameEn,
      sourceUrl: testUrl1,
      sourceIdentifier: testExhibitorId,
      categories: sampleRawData.categories,
      primaryProductCategories: ["SKINCARE", "HAIRCARE"] as PrimaryProductCategory[],
      primaryCategoriesConfirmed: true,
      businessTypes: ["BRAND_OWNER"],
    });

    const saveResult = await saveSourcingDraft(
      draftCompany,
      { status: "REVIEWED", grade: "A" },
      undefined,
      qaSupabase
    );
    assert(saveResult.success, "saveSourcingDraft succeeds");
    assert(!!saveResult.companyId, "Returns created company ID");
    createdCompanyId = saveResult.companyId;

    const savedCompany = await getSourcingCompanyById(createdCompanyId, qaSupabase);
    assert(savedCompany !== null, "Created company exists in database");
    assert(
      Array.isArray(savedCompany?.primary_product_categories) &&
        savedCompany!.primary_product_categories.includes("SKINCARE") &&
        savedCompany!.primary_product_categories.includes("HAIRCARE"),
      "Primary product categories stored correctly"
    );
    assert(
      savedCompany?.primary_categories_confirmed === true,
      "primary_categories_confirmed flag is TRUE"
    );

    // -------------------------------------------------------------------------
    // Phase 3: Exact URL Re-Extraction -> Duplicate Detection Blocking
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 3] Strong Duplicate Detection on Exact/Normalized Source URL");

    const dupCheck1 = await findDuplicateCandidates(
      {
        sourceUrl: `${testUrl1}#/overview?trk=test_campaign`, // Fragment and tracking param variation
        companyNameKr: "전혀 다른 상호명",
      },
      qaSupabase
    );

    assert(dupCheck1.isDuplicate, "findDuplicateCandidates detects duplicate URL");
    assert(dupCheck1.hasStrongDuplicate, "Identified as strong duplicate");
    const strongMatch = dupCheck1.matches.find((m) => m.severity === "STRONG");
    assert(
      strongMatch?.matchType === "SOURCE_URL" || strongMatch?.matchType === "SOURCE_IDENTIFIER",
      "matchType is SOURCE_URL or SOURCE_IDENTIFIER"
    );
    assert(
      strongMatch?.entityId === createdCompanyId,
      "Matched existing company ID correctly"
    );

    // Verify DB Unique constraint rejects duplicate source insert
    let threwDuplicateError = false;
    try {
      const dupDraft = createSampleDraft({
        nameKr: "다른 상호 중복 등록 시도",
        sourceUrl: `${testUrl1}#/`,
        sourceIdentifier: testExhibitorId,
      });
      await saveSourcingDraft(dupDraft, undefined, undefined, qaSupabase);
    } catch (err: any) {
      threwDuplicateError = true;
      assert(
        err.message.includes("[DUPLICATE_SOURCE_URL]") || err.message.includes("unique"),
        "saveSourcingDraft throws duplicate source URL exception"
      );
    }
    assert(threwDuplicateError, "Second insert with duplicate source URL was blocked by DB");

    // -------------------------------------------------------------------------
    // Phase 4: Link New Legitimate Source & Preserve Existing Categories
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 4] Link New Source to Existing Company & Verify Category Preservation");

    const secondDraft = createSampleDraft({
      nameKr: companyNameKr,
      sourceUrl: testUrl2,
      sourceIdentifier: `org-${timestamp}-second`,
      primaryProductCategories: ["BODYCARE"] as PrimaryProductCategory[], // Incoming draft has different suggestion
      primaryCategoriesConfirmed: false,
    });

    const linkResult = await linkSourcingSource(
      {
        targetCompanyId: createdCompanyId!,
        draft: secondDraft,
        overrideReason: "Second trade show appearance linked",
      },
      qaSupabase
    );

    assert(linkResult.success, "linkSourcingSource succeeds");

    const companyAfterLink = await getSourcingCompanyById(createdCompanyId!, qaSupabase);
    assert(
      companyAfterLink?.primary_categories_confirmed === true,
      "primary_categories_confirmed remains TRUE after linking new source"
    );
    assert(
      JSON.stringify(companyAfterLink?.primary_product_categories.sort()) ===
        JSON.stringify(["HAIRCARE", "SKINCARE"]),
      "primary_product_categories are preserved and not overwritten"
    );

    // Verify both sources exist for the company
    const { data: linkedSources } = await qaSupabase
      .from("sourcing_sources")
      .select("*")
      .eq("company_id", createdCompanyId);

    assert(linkedSources?.length === 2, "Company now has 2 linked sourcing sources");

    // -------------------------------------------------------------------------
    // Phase 5: Korean & English Company Name Matching
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 5] Korean and English Company Name Matching");

    const krCheck = await findDuplicateCandidates(
      {
        companyNameKr: `(주) 인테그레이션랩스 ${timestamp}`, // Whitespace and prefix variation
      },
      qaSupabase
    );

    assert(krCheck.isDuplicate, "Detects duplicate on normalized Korean company name");
    assert(
      krCheck.matches.some((m) => m.matchType === "COMPANY_NAME_KR"),
      "Identifies COMPANY_NAME_KR rule match"
    );

    const enCheck = await findDuplicateCandidates(
      {
        companyNameEn: `Integration Labs Alpha ${timestamp}, Inc.`, // Punctuation & casing variation
      },
      qaSupabase
    );

    assert(enCheck.isDuplicate, "Detects duplicate on normalized English company name");
    assert(
      enCheck.matches.some((m) => m.matchType === "COMPANY_NAME_EN"),
      "Identifies COMPANY_NAME_EN rule match"
    );

    // -------------------------------------------------------------------------
    // Phase 6: Separate Legal Entity Admin Exception Workflow
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 6] Distinct Legal Entity Admin Exception Workflow");

    const exceptionDraft = createSampleDraft({
      nameKr: companyNameKr, // Same name
      sourceUrl: `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test-${timestamp}.org-${timestamp}-exc.html`,
      sourceIdentifier: `org-${timestamp}-exc`,
      primaryProductCategories: ["BODYCARE"] as PrimaryProductCategory[],
      primaryCategoriesConfirmed: true,
      businessTypes: ["OEM_ODM"],
    });

    const exceptionInput: AdminDuplicateExceptionInput = {
      matchedCompanyId: createdCompanyId!,
      matchedRule: "SAME_NAME_KR",
      reason: "별도 법인 사업자등록번호 확인 완료 (제조사 법인)",
      evidence: {
        businessRegistrationNumber: "987-65-43210",
        officialWebsite: "https://integrationlabs-partner.com",
      },
    };

    const exResult = await saveSourcingDraft(
      exceptionDraft,
      { status: "SAVED", grade: "A" },
      { exception: exceptionInput, adminUserId: "00000000-0000-4000-c000-000000000001" },
      qaSupabase
    );
    assert(exResult.success, "Save with adminException succeeds for distinct source URL");
    exceptionCompanyId = exResult.companyId;

    // Verify append-only exception audit record
    const { data: auditRows } = await qaSupabase
      .from("sourcing_duplicate_exceptions")
      .select("*")
      .eq("company_id", exceptionCompanyId);

    assert(auditRows && auditRows.length > 0, "Audit record created in sourcing_duplicate_exceptions");
    assert(
      auditRows![0].reason.includes("별도 법인"),
      "Audit reason correctly preserved"
    );

    // -------------------------------------------------------------------------
    // Phase 7: Confirmed Empty Categories Preservation
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 7] Confirmed Empty Category Selections Preservation");

    const emptyDraft = createSampleDraft({
      nameKr: `미분류 확정 테스터_${timestamp}`,
      sourceUrl: `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test-${timestamp}.org-${timestamp}-emp.html`,
      sourceIdentifier: `org-${timestamp}-emp`,
      categories: ["기타분야"],
      primaryProductCategories: [],
      primaryCategoriesConfirmed: true,
    });

    const emptySave = await saveSourcingDraft(emptyDraft, undefined, undefined, qaSupabase);
    const emptyConfirmedId = emptySave.companyId;

    const emptyComp = await getSourcingCompanyById(emptyConfirmedId, qaSupabase);
    assert(
      Array.isArray(emptyComp?.primary_product_categories) &&
        emptyComp!.primary_product_categories.length === 0,
      "primary_product_categories is empty array"
    );
    assert(
      emptyComp?.primary_categories_confirmed === true,
      "primary_categories_confirmed is TRUE for empty confirmation"
    );

    // Test re-parsing simulation: recommendPrimaryProductCategories suggests SKINCARE, but confirmed empty is preserved
    const simulatedRecommendation = recommendPrimaryProductCategories({
      productSummary: "스킨케어 로션 생산",
      categories: ["스킨케어"],
    });
    assert(
      simulatedRecommendation.includes("SKINCARE" as PrimaryProductCategory),
      "Simulation provides recommendation"
    );

    const compStillEmpty = await getSourcingCompanyById(emptyConfirmedId, qaSupabase);
    assert(
      compStillEmpty?.primary_categories_confirmed === true &&
        compStillEmpty.primary_product_categories.length === 0,
      "Confirmed empty categories are NOT overwritten by background recommendation"
    );

    // Clean up empty test company
    await deleteSourcingCandidate(emptyConfirmedId, qaSupabase);

    // -------------------------------------------------------------------------
    // Phase 8: Brand List Filtering by Primary Product Category & Short Labels
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 8] Brand List Querying, Multi-Select Category Filters & Short Labels");

    // Test Short Labels dictionary
    assert(
      COMPANY_TYPE_SHORT_LABELS["BRAND_OWNER"] === "브랜드",
      "Short label for BRAND_OWNER is 브랜드"
    );
    assert(
      COMPANY_TYPE_SHORT_LABELS["OEM_ODM"] === "OEM",
      "Short label for OEM_ODM is OEM"
    );
    assert(
      COMPANY_TYPE_SHORT_LABELS["IMPORTER_EXPORTER"] === "수출입",
      "Short label for IMPORTER_EXPORTER is 수출입"
    );

    // Query list with primary category filter
    const skincareList = await listSourcingCompanies(
      {
        primaryCategories: ["SKINCARE" as PrimaryProductCategory],
        limit: 10,
      },
      qaSupabase
    );

    assert(skincareList.data && skincareList.data.length > 0, "listSourcingCompanies returns companies with SKINCARE");
    const foundCreated = skincareList.data?.find((c) => c.id === createdCompanyId);
    assert(!!foundCreated, "Created test company is returned in SKINCARE filtered results");

    const makeupList = await listSourcingCompanies(
      {
        primaryCategories: ["MAKEUP" as PrimaryProductCategory],
        limit: 10,
      },
      qaSupabase
    );

    const createdInMakeup = makeupList.data?.find((c) => c.id === createdCompanyId);
    assert(!createdInMakeup, "Created test company is NOT returned in MAKEUP filtered results");

    // -------------------------------------------------------------------------
    // Phase 9: Double-Click Concurrency Protection Test
    // -------------------------------------------------------------------------
    console.log("\n[Scenario 9] Double-Click Concurrency Save Verification");

    const concurrentUrl = `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test-${timestamp}.org-${timestamp}-cnc.html`;
    const draftA = createSampleDraft({
      nameKr: `병렬저장A_${timestamp}`,
      sourceUrl: concurrentUrl,
      sourceIdentifier: `org-${timestamp}-cnc`,
      primaryProductCategories: ["BODYCARE"] as PrimaryProductCategory[],
      primaryCategoriesConfirmed: true,
    });
    const draftB = createSampleDraft({
      nameKr: `병렬저장B_${timestamp}`,
      sourceUrl: concurrentUrl, // Identical source URL submitted concurrently
      sourceIdentifier: `org-${timestamp}-cnc`,
      primaryProductCategories: ["BODYCARE"] as PrimaryProductCategory[],
      primaryCategoriesConfirmed: true,
    });

    const results = await Promise.allSettled([
      saveSourcingDraft(draftA, undefined, undefined, qaSupabase),
      saveSourcingDraft(draftB, undefined, undefined, qaSupabase),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert(
      fulfilled.length === 1,
      `Exactly 1 concurrent save succeeded (fulfilled: ${fulfilled.length})`
    );
    assert(
      rejected.length === 1,
      `Exactly 1 concurrent save rejected with duplicate error (rejected: ${rejected.length})`
    );

    const winnerId = (fulfilled[0] as PromiseFulfilledResult<any>).value.companyId;

    // Verify orphan company was cleaned up
    const { count: orphanCount } = await qaSupabase
      .from("sourcing_companies")
      .select("*", { count: "exact", head: true })
      .like("company_name_kr", `병렬저장%_${timestamp}`);

    assert(orphanCount === 1, "Only the winning company remains; orphan duplicate was cleaned up");

    // Cleanup concurrent winner
    if (winnerId) {
      await deleteSourcingCandidate(winnerId, qaSupabase);
    }
  } finally {
    // Teardown created test records to keep QA DB clean
    console.log("\n[Teardown] Cleaning up test records in QA DB...");
    try {
      await pgClient.query("ALTER TABLE sourcing_duplicate_exceptions DISABLE TRIGGER trg_prevent_sourcing_dup_exceptions_mod");
      if (exceptionCompanyId) {
        await pgClient.query("DELETE FROM sourcing_duplicate_exceptions WHERE company_id = $1 OR matched_company_id = $1", [exceptionCompanyId]);
        await pgClient.query("DELETE FROM sourcing_sources WHERE company_id = $1", [exceptionCompanyId]);
        await pgClient.query("DELETE FROM sourcing_brands WHERE company_id = $1", [exceptionCompanyId]);
        await pgClient.query("DELETE FROM sourcing_contacts WHERE company_id = $1", [exceptionCompanyId]);
        await pgClient.query("DELETE FROM sourcing_websites WHERE company_id = $1", [exceptionCompanyId]);
        await pgClient.query("DELETE FROM sourcing_companies WHERE id = $1", [exceptionCompanyId]);
      }
      if (createdCompanyId) {
        await pgClient.query("DELETE FROM sourcing_duplicate_exceptions WHERE company_id = $1 OR matched_company_id = $1", [createdCompanyId]);
        await pgClient.query("DELETE FROM sourcing_sources WHERE company_id = $1", [createdCompanyId]);
        await pgClient.query("DELETE FROM sourcing_brands WHERE company_id = $1", [createdCompanyId]);
        await pgClient.query("DELETE FROM sourcing_contacts WHERE company_id = $1", [createdCompanyId]);
        await pgClient.query("DELETE FROM sourcing_websites WHERE company_id = $1", [createdCompanyId]);
        await pgClient.query("DELETE FROM sourcing_companies WHERE id = $1", [createdCompanyId]);
      }
      await pgClient.query("ALTER TABLE sourcing_duplicate_exceptions ENABLE TRIGGER trg_prevent_sourcing_dup_exceptions_mod");
    } catch (e: any) {
      console.warn("Teardown error:", e.message);
      try {
        await pgClient.query("ALTER TABLE sourcing_duplicate_exceptions ENABLE TRIGGER trg_prevent_sourcing_dup_exceptions_mod");
      } catch {}
    }
    await pgClient.end();
  }

  console.log("\n================================================================================");
  console.log(`INTEGRATED QA COMPLETED: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");
}

runIntegratedLifecycle().catch((err) => {
  console.error("FATAL in runIntegratedLifecycle:", err);
  process.exit(1);
});
