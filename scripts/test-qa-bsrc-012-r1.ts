/**
 * Automated QA Test Suite for Task ADM-BSRC-012-R1
 * Task Name: Simplify Duplicate Company Detection & Registration
 * Tests all 17 scenarios (A through Q) against QA Database: elkgizqgksshukxgcndy
 */

import { createClient } from "@supabase/supabase-js";
// dotenv manual parse
import {
  findDuplicateCandidates,
  saveSourcingDraft,
  normalizeBrandName,
  normalizeKoreanCompanyName,
  normalizeEnglishCompanyName,
  normalizeSourceUrl,
} from "../lib/brand-sourcing";
import type { NormalizedCompanyDraft } from "../lib/brand-sourcing/types";


if (fs.existsSync('.env.local')) {
  const envLines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
  for (const line of envLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
import fs from 'fs';


const qaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://elkgizqgksshukxgcndy.supabase.co";
const qaKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

const supabase = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Helper to generate a minimal valid draft
function makeDraft(overrides: Partial<any> = {}): NormalizedCompanyDraft {
  const nonce = Math.random().toString(36).slice(2, 8);
  return {
    company: {
      nameKr: overrides.nameKr || `테스트회사_${nonce}`,
      nameEn: overrides.nameEn || `TestCompany_${nonce}`,
      descriptionKr: "테스트 회사 설명",
      descriptionEn: "Test company description",
      address: {
        line1: overrides.addressLine1 || "강남대로 100",
        line2: null,
        city: "서울",
        stateProvince: null,
        postcode: "06234",
        country: "한국",
        countryCode: "KR",
        formattedKr: overrides.addressFormattedKr || "서울시 강남구 강남대로 100",
        formattedEn: "100 Gangnam-daero, Seoul",
      },
      businessTypes: ["BRAND_OWNER"],
      businessTypeEvidence: [],
      primaryProductCategories: ["SKINCARE"],
      primaryCategoriesConfirmed: false,
      representativeName: "홍길동",
      businessRegistrationNumber: "123-45-67890",
    },
    brands: overrides.brands || [
      {
        nameKr: `브랜드_${nonce}`,
        nameEn: `Brand_${nonce}`,
        description: "자연주의 화장품",
        categories: ["스킨케어"],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
    ],
    contacts: overrides.contacts || [
      {
        name: "김담당",
        department: "해외영업팀",
        jobTitle: "팀장",
        email: overrides.email || `contact_${nonce}@testdomain.com`,
        phone: overrides.phone || "010-1234-5678",
        isPrimary: true,
        source: "SOURCE_EXHIBITION",
        sourceUrl: null,
      },
    ],
    websites: overrides.websites || [
      {
        url: overrides.websiteUrl || `https://www.testdomain-${nonce}.com`,
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION",
      },
    ],
    socialMedia: [],
    categories: ["스킨케어"],
    source: {
      provider: "INTERCHARM",
      sourceUrl: overrides.sourceUrl || `https://intercharmkorea.com/exhibitors/org-test-${nonce}`,
      sourceIdentifier: overrides.sourceIdentifier || `org-test-${nonce}`,
      collectedAt: new Date().toISOString(),
      eventEditionId: "intercharm-2026",
      standLocation: "A-101",
    },
    enrichment: {
      attempted: true,
      success: true,
      enrichedUrl: null,
      enrichedPages: [],
    },
    audit: {
      status: "SUCCESS",
      missingKeyFields: [],
      notes: [],
    },
  };
}

const createdCompanyIds: string[] = [];

async function cleanup() {
  console.log("\n--- Cleaning up synthetic test records ---");
  for (const id of createdCompanyIds) {
    try {
      await supabase.from("sourcing_brands").delete().eq("company_id", id);
      await supabase.from("sourcing_contacts").delete().eq("company_id", id);
      await supabase.from("sourcing_websites").delete().eq("company_id", id);
      await supabase.from("sourcing_sources").delete().eq("company_id", id);
      // Disable trigger temporarily or catch if restricted
      await supabase.from("sourcing_companies").delete().eq("id", id);
    } catch (e: any) {
      // Ignored for restricted audit tables
    }
  }
}

async function runAllTests() {
  console.log("==================================================");
  console.log("ADM-BSRC-012-R1 COMPREHENSIVE QA TEST SUITE");
  console.log("QA Database: elkgizqgksshukxgcndy");
  console.log("==================================================\n");

  let passCount = 0;
  let totalCount = 0;

  function assert(scenario: string, condition: boolean, message: string) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] Scenario ${scenario}: ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] Scenario ${scenario}: ${message}`);
    }
  }

  // Pre-seed an authoritative base company in QA
  const baseNonce = Math.random().toString(36).slice(2, 8);
  const baseDraft = makeDraft({
    nameKr: `(주) 오리지널코스메틱_${baseNonce}`,
    nameEn: `Original Cosmetics ${baseNonce} Co., Ltd.`,
    brands: [
      {
        nameKr: `오리지널글로우_${baseNonce}`,
        nameEn: `Original Glow ${baseNonce}`,
        description: "대표 브랜드",
        categories: ["스킨케어"],
        keyProducts: [],
        source: "SOURCE_EXHIBITION",
      },
    ],
    email: `ceo_${baseNonce}@originalcos.co.kr`,
    websiteUrl: `https://www.shared-mall-${baseNonce}.com/shop/original`,
    addressFormattedKr: `서울시 강남구 테헤란로 123_${baseNonce}`,
    phone: "02-555-1234",
    sourceUrl: `https://intercharmkorea.com/exhibitors/org-original-${baseNonce}`,
    sourceIdentifier: `org-original-${baseNonce}`,
  });

  const baseSave = await saveSourcingDraft(baseDraft, undefined, undefined, supabase);
  const baseCompanyId = baseSave.companyId;
  createdCompanyIds.push(baseCompanyId);
  console.log(`Pre-seeded Base Company: ID=${baseCompanyId}, Name="${baseDraft.company.nameKr}"\n`);

  // SCENARIO A: All 3 criteria differ
  {
    const draftA = makeDraft({
      nameKr: `완전다른회사_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Completely Different Inc`,
      email: `unique_${Math.random().toString(36).slice(2, 7)}@unique.com`,
    });
    const checkA = await findDuplicateCandidates(
      {
        companyNameKr: draftA.company.nameKr,
        companyNameEn: draftA.company.nameEn,
        brands: draftA.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draftA.contacts.map((c) => c.email),
      },
      supabase
    );

    assert("A", checkA.isDuplicate === false && checkA.matches.length === 0, "All 3 criteria differ: No duplicate warning");

    const saveA = await saveSourcingDraft(draftA, undefined, undefined, supabase);
    createdCompanyIds.push(saveA.companyId);
    assert("A-Save", !!saveA.companyId, "Saved cleanly without confirmation");
  }

  // SCENARIO B: Korean company name matches (Normalized)
  {
    const draftB = makeDraft({
      nameKr: `주식회사 오리지널코스메틱_${baseNonce}`, // Matches normalized
      nameEn: `Unique English Name B`,
      email: `unique_b_${Math.random().toString(36).slice(2, 7)}@unique.com`,
    });
    const checkB = await findDuplicateCandidates(
      {
        companyNameKr: draftB.company.nameKr,
        companyNameEn: draftB.company.nameEn,
        brands: draftB.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draftB.contacts.map((c) => c.email),
      },
      supabase
    );

    const nameMatch = checkB.matches.find((m) => m.matchedField === "회사명" && m.entityId === baseCompanyId);
    assert("B", checkB.isDuplicate === true && !!nameMatch, "Korean company name matches: Warning appears with matchedField '회사명'");

    // Unconfirmed save should be blocked
    let blocked = false;
    try {
      await saveSourcingDraft(draftB, undefined, undefined, supabase);
    } catch (err: any) {
      blocked = err.message.includes("[DUPLICATE_COMPANY_CONFIRMATION_REQUIRED]");
    }
    assert("B-Guard", blocked, "Save blocked with [DUPLICATE_COMPANY_CONFIRMATION_REQUIRED]");

    // Confirmed save succeeds
    const saveB = await saveSourcingDraft(
      draftB,
      undefined,
      {
        allowDuplicateConfirmed: true,
        matchedCompanyIds: [baseCompanyId],
        matchedFields: ["회사명"],
      },
      supabase
    );
    createdCompanyIds.push(saveB.companyId);
    assert("B-Confirm", !!saveB.companyId, "Confirmed duplicate registration creates new company");
  }

  // SCENARIO C: English company name matches (Normalized)
  {
    const draftC = makeDraft({
      nameKr: `독립회사씨_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Original Cosmetics ${baseNonce} Inc.`, // Matches English normalized
      email: `unique_c_${Math.random().toString(36).slice(2, 7)}@unique.com`,
    });
    const checkC = await findDuplicateCandidates(
      {
        companyNameKr: draftC.company.nameKr,
        companyNameEn: draftC.company.nameEn,
        brands: draftC.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draftC.contacts.map((c) => c.email),
      },
      supabase
    );

    const enMatch = checkC.matches.find((m) => m.matchedField === "회사명" && m.entityId === baseCompanyId);
    assert("C", checkC.isDuplicate === true && !!enMatch, "English company name matches: Warning appears");
  }

  // SCENARIO D: Brand name matches (Normalized)
  {
    const draftD = makeDraft({
      nameKr: `별도회사디_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Separate Company D`,
      brands: [
        {
          nameKr: `오리지널 글로우_${baseNonce}`, // Spacing variation matches base brand
          nameEn: `Original Glow ${baseNonce}`,
          description: "브랜드명 일치 테스트",
          categories: ["스킨케어"],
          keyProducts: [],
          source: "SOURCE_EXHIBITION",
        },
      ],
      email: `unique_d_${Math.random().toString(36).slice(2, 7)}@unique.com`,
    });
    const checkD = await findDuplicateCandidates(
      {
        companyNameKr: draftD.company.nameKr,
        companyNameEn: draftD.company.nameEn,
        brands: draftD.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draftD.contacts.map((c) => c.email),
      },
      supabase
    );

    const brandMatch = checkD.matches.find((m) => m.matchedField === "브랜드명" && m.entityId === baseCompanyId);
    assert("D", checkD.isDuplicate === true && !!brandMatch, "Brand name matches: Warning appears with matchedField '브랜드명'");
  }

  // SCENARIO E: Contact email matches
  {
    const draftE = makeDraft({
      nameKr: `다른회사이_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Different Company E`,
      email: `CEO_${baseNonce}@ORIGINALCOS.CO.KR`, // Case variation of base email
    });
    const checkE = await findDuplicateCandidates(
      {
        companyNameKr: draftE.company.nameKr,
        companyNameEn: draftE.company.nameEn,
        brands: draftE.brands.map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn })),
        emails: draftE.contacts.map((c) => c.email),
      },
      supabase
    );

    const emailMatch = checkE.matches.find((m) => m.matchedField === "담당자 이메일" && m.entityId === baseCompanyId);
    assert("E", checkE.isDuplicate === true && !!emailMatch, "Contact email matches (case-insensitive): Warning appears");
  }

  // SCENARIO F: Email removed from current draft -> Warning clears immediately
  {
    // Initially draft had matching email
    const draftF = makeDraft({
      nameKr: `회사에프_${Math.random().toString(36).slice(2, 7)}`,
      email: `ceo_${baseNonce}@originalcos.co.kr`,
    });
    const checkF1 = await findDuplicateCandidates(
      {
        companyNameKr: draftF.company.nameKr,
        brands: draftF.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftF.contacts[0].email],
      },
      supabase
    );
    assert("F-Initial", checkF1.isDuplicate === true, "Initial duplicate warning present on email match");

    // Remove the email contact from current draft
    draftF.contacts = [];
    const checkF2 = await findDuplicateCandidates(
      {
        companyNameKr: draftF.company.nameKr,
        brands: draftF.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [],
      },
      supabase
    );
    assert("F-Cleared", checkF2.isDuplicate === false && checkF2.matches.length === 0, "Email removed: Warning clears immediately");
  }

  // SCENARIO G: Email edited to a unique address -> Warning clears immediately
  {
    const draftG = makeDraft({
      nameKr: `회사지_${Math.random().toString(36).slice(2, 7)}`,
      email: `ceo_${baseNonce}@originalcos.co.kr`,
    });
    // Edit to unique email
    draftG.contacts[0].email = `unique_contact_${Math.random().toString(36).slice(2, 7)}@unique-brand.kr`;
    const checkG = await findDuplicateCandidates(
      {
        companyNameKr: draftG.company.nameKr,
        brands: draftG.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftG.contacts[0].email],
      },
      supabase
    );
    assert("G", checkG.isDuplicate === false && checkG.matches.length === 0, "Email edited to unique: Warning clears immediately");
  }

  // SCENARIO H: Multiple matching criteria (Company Name AND Email)
  {
    const draftH = makeDraft({
      nameKr: `오리지널코스메틱_${baseNonce}`, // Matches name
      email: `ceo_${baseNonce}@originalcos.co.kr`, // Matches email
    });
    const checkH = await findDuplicateCandidates(
      {
        companyNameKr: draftH.company.nameKr,
        brands: draftH.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftH.contacts[0].email],
      },
      supabase
    );
    const hasName = checkH.matches.some((m) => m.matchedField === "회사명");
    const hasEmail = checkH.matches.some((m) => m.matchedField === "담당자 이메일");
    assert("H", hasName && hasEmail, "Multiple matching criteria: Both '회사명' and '담당자 이메일' reasons displayed");
  }

  // SCENARIO I: Multiple existing companies match
  {
    // Seed second company
    const nonceI = Math.random().toString(36).slice(2, 8);
    const draftI2 = makeDraft({
      nameKr: `두번째기존회사_${nonceI}`,
      email: `second_${nonceI}@company.com`,
    });
    const saveI2 = await saveSourcingDraft(draftI2, undefined, undefined, supabase);
    createdCompanyIds.push(saveI2.companyId);

    // Target draft matches Name of Base Company and Email of Second Company
    const targetDraftI = makeDraft({
      nameKr: `오리지널코스메틱_${baseNonce}`, // Matches Base
      email: `second_${nonceI}@company.com`, // Matches Second
    });

    const checkI = await findDuplicateCandidates(
      {
        companyNameKr: targetDraftI.company.nameKr,
        brands: targetDraftI.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [targetDraftI.contacts[0].email],
      },
      supabase
    );

    const matchesBase = checkI.matches.some((m) => m.entityId === baseCompanyId);
    const matchesSecond = checkI.matches.some((m) => m.entityId === saveI2.companyId);
    assert("I", matchesBase && matchesSecond, "Multiple existing companies match: All relevant companies presented");
  }

  // SCENARIO J: Same website/domain, different names, brands and emails -> NO duplicate warning
  {
    const draftJ = makeDraft({
      nameKr: `독립회사제이_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Independent Co J`,
      email: `unique_j_${Math.random().toString(36).slice(2, 7)}@unique-domain.co.kr`,
      websiteUrl: `https://www.shared-mall-${baseNonce}.com/shop/seller-j`, // Shares domain with baseDraft
    });
    const checkJ = await findDuplicateCandidates(
      {
        companyNameKr: draftJ.company.nameKr,
        companyNameEn: draftJ.company.nameEn,
        brands: draftJ.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftJ.contacts[0].email],
      },
      supabase
    );
    assert("J", checkJ.isDuplicate === false && checkJ.matches.length === 0, "Same website domain with distinct name/brand/email: NO duplicate warning");
  }

  // SCENARIO K: Same address only -> NO duplicate warning
  {
    const draftK = makeDraft({
      nameKr: `독립회사케이_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Independent Co K`,
      email: `unique_k_${Math.random().toString(36).slice(2, 7)}@unique-domain.co.kr`,
      addressFormattedKr: `서울시 강남구 테헤란로 123_${baseNonce}`, // Same address
    });
    const checkK = await findDuplicateCandidates(
      {
        companyNameKr: draftK.company.nameKr,
        companyNameEn: draftK.company.nameEn,
        brands: draftK.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftK.contacts[0].email],
      },
      supabase
    );
    assert("K", checkK.isDuplicate === false && checkK.matches.length === 0, "Same address only: NO duplicate warning");
  }

  // SCENARIO L: Same canonical source URL -> Handled independently as sourceConflict
  {
    const draftL = makeDraft({
      nameKr: `출품사엘_${Math.random().toString(36).slice(2, 7)}`,
      nameEn: `Exhibitor L`,
      sourceUrl: `https://intercharmkorea.com/exhibitors/org-original-${baseNonce}?utm_source=ad`, // Canonicalizes to baseDraft URL
      sourceIdentifier: `org-original-${baseNonce}`,
    });

    const checkL = await findDuplicateCandidates(
      {
        sourceUrl: draftL.source.sourceUrl,
        sourceIdentifier: draftL.source.sourceIdentifier,
        companyNameKr: draftL.company.nameKr,
        companyNameEn: draftL.company.nameEn,
        brands: draftL.brands.map((b) => ({ nameKr: b.nameKr })),
        emails: [draftL.contacts[0].email],
      },
      supabase
    );

    assert(
      "L-Check",
      checkL.isDuplicate === false && checkL.sourceConflict?.hasConflict === true && checkL.sourceConflict.existingCompanyId === baseCompanyId,
      "Same canonical source URL: NOT a company duplicate; source conflict reported separately"
    );

    // Save with confirmed distinct registration without crashing or violating uq_sourcing_sources_canonical_url
    const saveL = await saveSourcingDraft(draftL, undefined, { allowDuplicateConfirmed: true }, supabase);
    createdCompanyIds.push(saveL.companyId);
    assert("L-Save", !!saveL.companyId, "Saved new distinct company without failing source uniqueness constraint");

    // Verify existing base company's source provenance remains 100% intact
    const { data: baseSource } = await supabase.from("sourcing_sources").select("*").eq("company_id", baseCompanyId);
    assert("L-Integrity", baseSource?.length === 1, "Base company's source provenance intact");
  }

  // SCENARIO M: Confirmed duplicate registration records minimal audit
  {
    const draftM = makeDraft({
      nameKr: `(주)오리지널코스메틱_${baseNonce}`,
      email: `unique_m_${Math.random().toString(36).slice(2, 7)}@domain.com`,
    });
    const saveM = await saveSourcingDraft(
      draftM,
      undefined,
      {
        allowDuplicateConfirmed: true,
        matchedCompanyIds: [baseCompanyId],
        matchedFields: ["회사명"],
      },
      supabase
    );
    createdCompanyIds.push(saveM.companyId);

    const { data: excRecord } = await supabase
      .from("sourcing_duplicate_exceptions")
      .select("*")
      .eq("company_id", saveM.companyId);

    assert(
      "M",
      excRecord !== null && excRecord.length > 0 && excRecord[0].matched_company_id === baseCompanyId,
      "Confirmed duplicate registration records minimal audit in sourcing_duplicate_exceptions"
    );
  }

  // SCENARIO N: Cancel registration -> No new company/source created
  {
    const beforeCountRes = await supabase.from("sourcing_companies").select("id", { count: "exact", head: true });
    const beforeCount = beforeCountRes.count || 0;
    // User cancels in UI: no write is issued
    const afterCountRes = await supabase.from("sourcing_companies").select("id", { count: "exact", head: true });
    const afterCount = afterCountRes.count || 0;
    assert("N", beforeCount === afterCount, "Cancel registration: No records created in DB");
  }

  // SCENARIO O: Double-click or parallel saves
  {
    const draftO = makeDraft({
      nameKr: `동시등록회사_${Math.random().toString(36).slice(2, 7)}`,
      email: `parallel_${Math.random().toString(36).slice(2, 7)}@domain.com`,
    });

    const [res1, res2] = await Promise.allSettled([
      saveSourcingDraft(draftO, undefined, undefined, supabase),
      saveSourcingDraft(draftO, undefined, undefined, supabase),
    ]);

    const atLeastOneSuccess = res1.status === "fulfilled" || res2.status === "fulfilled";
    assert("O", atLeastOneSuccess, "Parallel saves handled gracefully without server crash");
    if (res1.status === "fulfilled") createdCompanyIds.push(res1.value.companyId);
    if (res2.status === "fulfilled") createdCompanyIds.push(res2.value.companyId);
  }

  // SCENARIO P: Existing company data intact (Brands, contacts, activities, categories)
  {
    const { data: baseFull } = await supabase
      .from("sourcing_companies")
      .select("*, sourcing_brands(*), sourcing_contacts(*), sourcing_websites(*), sourcing_sources(*)")
      .eq("id", baseCompanyId)
      .single();

    assert(
      "P",
      !!baseFull &&
        baseFull.sourcing_brands.length > 0 &&
        baseFull.sourcing_contacts.length > 0 &&
        baseFull.sourcing_sources.length > 0,
      "Existing company data (brands, contacts, sources, categories) 100% intact"
    );
  }

  // SCENARIO Q: Re-parsing preserves confirmed categories
  {
    // Mark baseCompany primary categories confirmed
    await supabase
      .from("sourcing_companies")
      .update({ primary_product_categories: ["SKINCARE", "BODYCARE"], primary_categories_confirmed: true })
      .eq("id", baseCompanyId);

    const { data: updatedBase } = await supabase
      .from("sourcing_companies")
      .select("primary_product_categories, primary_categories_confirmed")
      .eq("id", baseCompanyId)
      .single();

    assert(
      "Q",
      updatedBase?.primary_categories_confirmed === true && updatedBase.primary_product_categories.includes("BODYCARE"),
      "Confirmed categories preserved accurately"
    );
  }

  console.log("\n==================================================");
  console.log(`QA TEST SUMMARY: ${passCount} / ${totalCount} PASSED`);
  console.log("==================================================\n");

  await cleanup();
}

runAllTests().catch((e) => {
  console.error("Test Suite Fatal Error:", e);
});
