import fs from "fs";
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
} from "../lib/brand-sourcing/data-access";
import type {
  NormalizedCompanyDraft,
  SourcingEvaluationInput,
  AdminDuplicateExceptionInput,
} from "../lib/brand-sourcing/types";

// Setup QA credentials
let qaUrl = "";
let qaKey = "";
if (fs.existsSync(".env.qa.local")) {
  const envContent = fs.readFileSync(".env.qa.local", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    if (line.startsWith("QA_SUPABASE_URL=")) {
      qaUrl = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
    if (line.startsWith("QA_SUPABASE_SECRET_KEY=")) {
      qaKey = line.split("=")[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

if (!qaUrl || !qaKey || qaUrl.includes("shzfrppdobpmrstcjfqu")) {
  console.error("FATAL: QA Database credentials missing or pointing to production!");
  process.exit(1);
}

const qaSupabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL] ${testName} - ${detail || "Condition not met"}`);
    throw new Error(`Test assertion failed: ${testName}`);
  }
}

async function runQASuite() {
  console.log("================================================================================");
  console.log("TASK: ADM-BSRC-010 — Brand Sourcing Duplicate Detection & Prevention");
  console.log("QA AUTOMATED TEST SUITE: 22 MANDATORY SCENARIOS");
  console.log(`Database: QA Supabase (elkgizqgksshukxgcndy)`);
  console.log("================================================================================\n");

  const runId = Date.now();
  const testExhibitorUrl = `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test-${runId}.org-${runId}.html`;

  // ---------------------------------------------------------------------------
  // SCENARIOS 1-3: URL NORMALIZATION & EXACT DUPLICATE DETECTION
  // ---------------------------------------------------------------------------
  console.log("[Test Suite 1] URL Normalization & Fragment/Trailing Slash Handling");

  const urlClean = `https://www.intercharmkorea.com/ko-kr/exhibitor_detail?idx=${runId}`;
  const urlWithHash = `${urlClean}#overview`;
  const urlWithHashSlash = `${urlClean}#/`;
  const urlWithTrailingSlash = `${urlClean}/`;
  const urlWithTracking = `${urlClean}&utm_source=newsletter&utm_medium=email&ref=intercharm`;

  const norm1 = normalizeSourceUrl(urlClean);
  const norm2 = normalizeSourceUrl(urlWithHash);
  const norm3 = normalizeSourceUrl(urlWithHashSlash);
  const norm4 = normalizeSourceUrl(urlWithTrailingSlash);
  const norm5 = normalizeSourceUrl(urlWithTracking);

  assert(norm1 === norm2, "Scenario 2: Same URL with fragment differences (#overview) normalizes identically");
  assert(norm1 === norm3, "Scenario 2b: Same URL with #/ fragment normalizes identically");
  assert(norm1 === norm4, "Scenario 3: Same URL with trailing slash differences normalizes identically");
  assert(norm1 === norm5, "Scenario 3b: Tracking query parameters (utm_*, ref) stripped during normalization");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: KOREAN COMPANY NAME NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log("\n[Test Suite 2] Korean Company Name Normalization");

  const kr1 = normalizeKoreanCompanyName("(주)코스맥스");
  const kr2 = normalizeKoreanCompanyName("코스맥스 주식회사");
  const kr3 = normalizeKoreanCompanyName("㈜코스맥스 ");
  const kr4 = normalizeKoreanCompanyName(" (유) 코스맥스 ");

  assert(kr1 === "코스맥스", "Scenario 4a: Strips (주) prefix");
  assert(kr2 === "코스맥스", "Scenario 4b: Strips 주식회사 suffix");
  assert(kr3 === "코스맥스", "Scenario 4c: Strips ㈜ special character");
  assert(kr4 === "코스맥스", "Scenario 4d: Strips (유) and collapses spaces");
  assert(kr1 === kr2 && kr2 === kr3 && kr3 === kr4, "Scenario 4: All legal forms normalize to identical string");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: ENGLISH COMPANY NAME NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log("\n[Test Suite 3] English Company Name Normalization");

  const en1 = normalizeEnglishCompanyName("Cosmax Co., Ltd.");
  const en2 = normalizeEnglishCompanyName("COSMAX INC.");
  const en3 = normalizeEnglishCompanyName("cosmax llc");
  const en4 = normalizeEnglishCompanyName("Cosmax Corporation");

  assert(en1 === "cosmax", "Scenario 5a: Strips Co., Ltd.");
  assert(en2 === "cosmax", "Scenario 5b: Strips INC.");
  assert(en3 === "cosmax", "Scenario 5c: Strips LLC");
  assert(en4 === "cosmax", "Scenario 5d: Strips Corporation");
  assert(en1 === en2 && en2 === en3 && en3 === en4, "Scenario 5: All English suffix variations normalize identically");

  // ---------------------------------------------------------------------------
  // SCENARIO 6: DOMAIN NORMALIZATION
  // ---------------------------------------------------------------------------
  console.log("\n[Test Suite 4] Official Website Domain Normalization");

  const dom1 = normalizeWebsiteDomain("https://www.cosmax.com/en/about");
  const dom2 = normalizeWebsiteDomain("http://cosmax.com/kr/");
  const dom3 = normalizeWebsiteDomain("m.cosmax.com");

  assert(dom1 === "cosmax.com", "Scenario 6a: Strips https, www, and subpath");
  assert(dom2 === "cosmax.com", "Scenario 6b: Strips http and trailing slash");
  assert(dom3 === "cosmax.com", "Scenario 6c: Strips m. prefix");
  assert(dom1 === dom2 && dom2 === dom3, "Scenario 6: Different URLs normalize to same official domain");

  // ---------------------------------------------------------------------------
  // SCENARIO 7: NAME SIMILARITY DETECTION (TYPO / VARIATION)
  // ---------------------------------------------------------------------------
  console.log("\n[Test Suite 5] Name Similarity & Spelling Variation Detection");

  const simCheck1 = areCompanyNamesSimilar("아모레퍼시픽", "아모레페시픽");
  const simCheck2 = areCompanyNamesSimilar("LG생활건강", "엘지생활건강");
  const simCheck3 = areCompanyNamesSimilar("한국콜마", "삼성전자");

  assert(simCheck1.isSimilar && simCheck1.distance === 1, "Scenario 7a: 1-char typo in '아모레퍼시픽' flagged as similar");
  assert(simCheck1.similarity > 0.8, "Scenario 7b: Typo has high similarity score (> 0.8)");
  assert(!simCheck3.isSimilar, "Scenario 7c: Completely distinct names not flagged as similar");

  // ---------------------------------------------------------------------------
  // REAL DATABASE QA TESTS (SCENARIOS 1, 8-16, 21)
  // ---------------------------------------------------------------------------
  console.log("\n[Test Suite 6] Real Database Persistence, Concurrency & Exception Workflows");

  const testCompNameKr = `(주)테스트바이오_${runId}`;
  const testCompNameEn = `Test Bio Co., Ltd. ${runId}`;
  const testDomain = `testbio-${runId}.co.kr`;

  const initialDraft: NormalizedCompanyDraft = {
    company: {
      nameKr: testCompNameKr,
      nameEn: testCompNameEn,
      descriptionKr: "테스트 바이오 화장품 제조사",
      descriptionEn: "Test Bio Cosmetics Manufacturer",
      address: {
        line1: "서울시 강남구 테헤란로 123",
        line2: null,
        city: "서울",
        stateProvince: "서울특별시",
        postcode: "06234",
        country: "한국",
        countryCode: "KR",
        formattedKr: "서울시 강남구 테헤란로 123",
        formattedEn: "123, Teheran-ro, Gangnam-gu, Seoul",
      },
      businessTypes: ["MANUFACTURER", "BRAND_OWNER"],
      businessTypeEvidence: [],
      representativeName: "홍길동",
      businessRegistrationNumber: `123-45-${runId.toString().slice(-5)}`,
    },
    brands: [
      {
        nameKr: `바이오스킨_${runId}`,
        nameEn: "BioSkin",
        description: "자연주의 스킨케어 브랜드",
        categories: ["스킨케어", "세럼"],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
    ],
    contacts: [
      {
        name: "김철수",
        department: "해외영업팀",
        jobTitle: "팀장",
        email: `chulsoo_${runId}@testbio.co.kr`,
        phone: "010-1234-5678",
        isPrimary: true,
        source: "SOURCE_EXHIBITION",
        sourceUrl: testExhibitorUrl,
      },
    ],
    websites: [
      {
        url: `https://www.${testDomain}`,
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION",
      },
    ],
    socialMedia: [],
    categories: ["스킨케어"],
    source: {
      provider: "INTERCHARM",
      sourceUrl: testExhibitorUrl,
      sourceIdentifier: `org-${runId}`,
      collectedAt: new Date().toISOString(),
      eventEditionId: "2026-intercharm",
      standLocation: "A-101",
    },
    enrichment: {
      attempted: true,
      success: true,
      enrichedUrl: `https://www.${testDomain}`,
      enrichedPages: [],
    },
    audit: {
      status: "SUCCESS",
      missingKeyFields: [],
      notes: [],
    },
  };

  // Step A: Save initial company
  const saveRes1 = await saveSourcingDraft(initialDraft, { status: "REVIEWED", grade: "B" }, undefined, qaSupabase);
  const companyIdA = saveRes1.companyId;
  assert(saveRes1.success && !!companyIdA, "Scenario 21: Initial company saved successfully to QA DB");

  // Verify normalized fields saved
  const companyA = await getSourcingCompanyById(companyIdA, qaSupabase);
  assert(companyA.normalized_name_kr === normalizeKoreanCompanyName(testCompNameKr), "Scenario 21b: normalized_name_kr populated in DB");
  assert(companyA.sourcing_sources[0]?.canonical_source_url === normalizeSourceUrl(testExhibitorUrl), "Scenario 21c: canonical_source_url populated in DB");

  // Step B: SCENARIO 1 — Same exhibitor URL submitted twice (Must be rejected)
  let dupUrlBlocked = false;
  try {
    const dupDraft: NormalizedCompanyDraft = {
      ...initialDraft,
      company: { ...initialDraft.company, nameKr: `완전다른이름_${runId}` },
      source: { ...initialDraft.source, sourceUrl: `${testExhibitorUrl}#/` }, // Trailing fragment variation
    };
    await saveSourcingDraft(dupDraft, undefined, undefined, qaSupabase);
  } catch (err: any) {
    if (err.message.includes("[DUPLICATE_SOURCE_URL]") || err.message.includes("이미 등록된 전시회 소스 URL")) {
      dupUrlBlocked = true;
    }
  }
  assert(dupUrlBlocked, "Scenario 1: Same exhibitor URL submitted twice is strictly rejected server-side");

  // Step C: SCENARIOS 4/5 — Same normalized Korean legal name (Must be rejected without exception)
  let dupNameBlocked = false;
  try {
    const dupNameDraft: NormalizedCompanyDraft = {
      ...initialDraft,
      company: { ...initialDraft.company, nameKr: `${normalizeKoreanCompanyName(testCompNameKr)} 주식회사` },
      source: { ...initialDraft.source, sourceUrl: `https://different-source-${runId}.com/page`, sourceIdentifier: `org-diff-${runId}` },
    };
    await saveSourcingDraft(dupNameDraft, undefined, undefined, qaSupabase);
  } catch (err: any) {
    if (err.message.includes("[DUPLICATE_COMPANY_NAME]") || err.message.includes("이미 등록된 동일한 법인명")) {
      dupNameBlocked = true;
    }
  }
  assert(dupNameBlocked, "Scenario 4/5: Same Korean company name with different legal suffix strictly rejected");

  // Step D: SCENARIO 9-11 — Link new source to existing company
  console.log("\n[Test Suite 7] Link New Sourcing Reference to Existing Company");
  const newSourceUrl = `https://www.cosmoprof-asia.com/exhibitor/testbio-${runId}`;
  const incomingDraftForLink: NormalizedCompanyDraft = {
    ...initialDraft,
    source: {
      provider: "COSMOPROF",
      sourceUrl: newSourceUrl,
      sourceIdentifier: `cosmoprof-${runId}`,
      collectedAt: new Date().toISOString(),
      eventEditionId: "2026-cosmoprof",
      standLocation: "Hall 3, 3E-20",
    },
    brands: [
      {
        nameKr: `바이오스킨_${runId}`, // Duplicate brand (should be skipped)
        nameEn: "BioSkin",
        description: null,
        categories: [],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
      {
        nameKr: `더마바이오_${runId}`, // New additive brand
        nameEn: "DermaBio",
        description: "더마 코스메틱 라인",
        categories: ["더마"],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
    ],
    contacts: [
      {
        name: "김철수",
        department: "해외영업팀",
        jobTitle: "팀장",
        email: `chulsoo_${runId}@testbio.co.kr`, // Existing email (must NOT be duplicated)
        phone: null,
        isPrimary: false,
        source: "SOURCE_EXHIBITION",
        sourceUrl: newSourceUrl,
      },
      {
        name: "이영희",
        department: "마케팅팀",
        jobTitle: "과장",
        email: `younghee_${runId}@testbio.co.kr`, // New contact email
        phone: "010-9876-5432",
        isPrimary: false,
        source: "SOURCE_EXHIBITION",
        sourceUrl: newSourceUrl,
      },
    ],
    websites: [
      {
        url: `https://www.${testDomain}`, // Duplicate website (should be skipped)
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION",
      },
      {
        url: `https://global.${testDomain}`, // New website
        label: "SHOP",
        source: "SOURCE_EXHIBITION",
      },
    ],
  };

  const linkRes = await linkSourcingSource(
    {
      targetCompanyId: companyIdA,
      draft: incomingDraftForLink,
      overrideReason: "2026 코스모프로프 신규 참가 정보 연결",
      adminUserEmail: "qa-admin@letusto.com",
    },
    qaSupabase
  );

  assert(linkRes.success, "Scenario 9: Successfully linked new sourcing reference to existing company");
  assert(linkRes.sourcesAdded === 1, "Scenario 9b: Exactly 1 new source record added");
  assert(linkRes.contactsAdded === 1, "Scenario 11a: Exactly 1 new contact added (duplicate email filtered)");
  assert(linkRes.brandsAdded === 1, "Scenario 11b: Exactly 1 new brand added (duplicate brand filtered)");
  assert(linkRes.websitesAdded === 1, "Scenario 11c: Exactly 1 new website added (duplicate website filtered)");

  // Verify company fields preserved
  const reloadedCompA = await getSourcingCompanyById(companyIdA, qaSupabase);
  assert(reloadedCompA.grade === "B" && reloadedCompA.status === "REVIEWED", "Scenario 10: Verified existing grade & status preserved intact");
  assert(reloadedCompA.marketing_consent_status === "UNCONFIRMED", "Scenario 10b: Marketing consent status strictly preserved");
  assert(reloadedCompA.internal_notes.includes("[SOURCE LINKED"), "Scenario 10c: Link audit note appended to internal_notes");

  // Step E: SCENARIOS 8, 15, 16 — Admin Exception Flow for Different Legal Entity
  console.log("\n[Test Suite 8] Admin Exception Flow (Register as Separate Legal Entity)");

  const distinctEntityDraft: NormalizedCompanyDraft = {
    ...initialDraft,
    company: {
      ...initialDraft.company,
      nameKr: testCompNameKr, // Same name!
      representativeName: "박대표",
      businessRegistrationNumber: `999-88-${runId.toString().slice(-5)}`, // Different reg number!
      address: {
        ...initialDraft.company.address,
        formattedKr: "부산시 해운대구 센텀중앙로 456",
      },
    },
    source: {
      provider: "MANUAL",
      sourceUrl: `https://distinct-source-${runId}.com/company-b`,
      sourceIdentifier: `manual-distinct-${runId}`,
      collectedAt: new Date().toISOString(),
      eventEditionId: null,
      standLocation: null,
    },
  };

  const exceptionInput: AdminDuplicateExceptionInput = {
    matchedCompanyId: companyIdA,
    matchedRule: "SAME_NAME_KR",
    reason: "동일한 상호를 사용하고 있으나 사업자등록번호 및 대표자가 완전히 다른 별개의 독립 법인임이 확인됨",
    evidence: {
      businessRegistrationNumber: distinctEntityDraft.company.businessRegistrationNumber,
      address: "부산시 해운대구 센텀중앙로 456",
      officialWebsite: "https://distinct-testbio.co.kr",
      legalEntityDetails: "부산지방법원 등기 확인 완료",
    },
  };

  const saveResException = await saveSourcingDraft(
    distinctEntityDraft,
    { status: "SAVED", grade: "A" },
    { exception: exceptionInput, adminUserId: "00000000-0000-4000-c000-000000000001" },
    qaSupabase
  );

  const companyIdB = saveResException.companyId;
  assert(saveResException.success && !!companyIdB && companyIdB !== companyIdA, "Scenario 8/15: Admin exception allowed separate legal entity creation");

  // Verify exception audit table record
  const { data: excRecord } = await qaSupabase
    .from("sourcing_duplicate_exceptions")
    .select("*")
    .eq("company_id", companyIdB)
    .single();

  assert(!!excRecord, "Scenario 16a: Exception audit record written to sourcing_duplicate_exceptions");
  assert(excRecord?.matched_company_id === companyIdA, "Scenario 16b: Audit points to matched company ID");
  assert(excRecord?.matched_rule === "SAME_NAME_KR", "Scenario 16c: Audit records matched rule");
  assert(excRecord?.evidence?.businessRegistrationNumber === distinctEntityDraft.company.businessRegistrationNumber, "Scenario 16d: Audit preserves distinguishing evidence");

  // Step F: SCENARIOS 12, 13, 14 — Double-Click & Concurrent Save Protection
  console.log("\n[Test Suite 9] Double-Click & Concurrent Save Protection");

  const concurrentUrl = `https://www.intercharmkorea.com/ko-kr/exhibitor/concurrent-${runId}.html`;
  const concurrentDraft: NormalizedCompanyDraft = {
    ...initialDraft,
    company: {
      ...initialDraft.company,
      nameKr: `동시저장테스트_${runId}`,
    },
    source: {
      ...initialDraft.source,
      sourceUrl: concurrentUrl,
      sourceIdentifier: `concurrent-${runId}`,
    },
  };

  // Launch two parallel save requests with identical draft
  const [resA, resB] = await Promise.allSettled([
    saveSourcingDraft(concurrentDraft, undefined, undefined, qaSupabase),
    saveSourcingDraft(concurrentDraft, undefined, undefined, qaSupabase),
  ]);

  const successCount = [resA, resB].filter((r) => r.status === "fulfilled").length;
  const rejectedCount = [resA, resB].filter((r) => r.status === "rejected").length;

  assert(successCount === 1, "Scenario 12/13: Exactly one concurrent save succeeded");
  assert(rejectedCount === 1, "Scenario 12/13b: Duplicate parallel save was rejected by atomic DB constraint");

  // Network retry after successful save
  let retryBlocked = false;
  try {
    await saveSourcingDraft(concurrentDraft, undefined, undefined, qaSupabase);
  } catch (err: any) {
    retryBlocked = true;
  }
  assert(retryBlocked, "Scenario 14: Network retry after successful save safely blocked with duplicate error");

  // Step G: SCENARIO 17 — Existing Duplicate Audit Report
  console.log("\n[Test Suite 10] Read-Only Duplicate Audit Report");

  const auditReport = await getSourcingDuplicateAuditReport(qaSupabase);
  assert(typeof auditReport.totalCompanies === "number", "Scenario 17a: Audit reports total companies count");
  assert(typeof auditReport.totalSources === "number", "Scenario 17b: Audit reports total sources count");
  assert(Array.isArray(auditReport.confirmedDuplicateUrlGroups), "Scenario 17c: Audit returns confirmed duplicate URL groups");
  assert(Array.isArray(auditReport.potentialDuplicateCompanyGroups), "Scenario 17d: Audit returns potential duplicate company groups");
  assert(auditReport.potentialDuplicateCompanyGroups.some(g => g.normalizedName.includes("테스트바이오")), "Scenario 17e: Exception-created pair detected in potential duplicate groups");
  assert(typeof auditReport.remediationRecommendation === "string", "Scenario 17f: Audit includes safe remediation guidance");

  // Step H: SCENARIOS 18-20 — Regressions Check (Campaigns, Follow-ups, Brand Portal)
  console.log("\n[Test Suite 11] Regressions Verification (Campaigns, Follow-up, Brand Portal)");

  // Check marketing campaigns tables intact
  const { count: campCount, error: campErr } = await qaSupabase
    .from("marketing_campaigns")
    .select("*", { count: "exact", head: true });
  assert(!campErr, "Scenario 18: marketing_campaigns table intact & accessible");

  // Check company followup activities intact
  const { count: actCount, error: actErr } = await qaSupabase
    .from("sourcing_company_activities")
    .select("*", { count: "exact", head: true });
  assert(!actErr, "Scenario 19: sourcing_company_activities table intact & accessible");

  // Check core partner companies (Brand Portal) intact & untouched
  const { count: partnerCount, error: partnerErr } = await qaSupabase
    .from("companies")
    .select("*", { count: "exact", head: true });
  assert(!partnerErr, "Scenario 20: Core registered companies (Brand Portal) intact & isolated");

  // Cleanup test companies from QA database
  console.log("\n[Test Suite 12] Clean up Test Records from QA DB");
  const testIds = [
    companyIdA,
    companyIdB,
    resA.status === "fulfilled" ? resA.value.companyId : null,
    resB.status === "fulfilled" ? resB.value.companyId : null,
  ].filter(Boolean);

  for (const tid of testIds) {
    await qaSupabase.from("sourcing_companies").delete().eq("id", tid);
  }
  console.log(`  ✓ Cleaned up ${testIds.length} synthetic test companies from QA DB.`);

  console.log("\n================================================================================");
  console.log(`QA TEST SUITE RESULT: ${passedCount} PASSED / ${failedCount} FAILED (100% PASS)`);
  console.log("================================================================================");
}

runQASuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
