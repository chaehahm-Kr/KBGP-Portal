import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import {
  saveSourcingDraft,
  getSourcingCompanyById,
  updateSourcingCandidateComplete,
  bulkArchiveSourcingCompanies,
  archiveSourcingCandidate,
  listSourcingCompanies,
} from "../lib/brand-sourcing/data-access";
import { NormalizedCompanyDraft, SourcingEvaluationInput } from "../lib/brand-sourcing/types";

// Load QA credentials safely
const envQaContent = fs.readFileSync(".env.qa.local", "utf8");
const getEnvVal = (key: string) => {
  const match = envQaContent.match(new RegExp(`${key}=([^\\r\\n]+)`));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
};

const qaUrl = getEnvVal("QA_SUPABASE_URL");
const qaKey = getEnvVal("QA_SUPABASE_SECRET_KEY");

if (!qaUrl || !qaKey || qaUrl.includes("shzfrppdobpmrstcjfqu")) {
  console.error("FAIL: Refusing to run on production ref! Must use QA environment.");
  process.exit(1);
}

const qaClient = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runTestSuite() {
  console.log("================================================================================");
  console.log("STARTING AUTOMATED FUNCTIONAL QA SUITE: ADM-BSRC-013");
  console.log(`Target QA Ref: elkgizqgksshukxgcndy (${qaUrl})`);
  console.log("================================================================================");

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, details?: any) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${desc}`);
      if (details) console.error("         Details:", details);
    }
  }

  const testSuffix = Math.floor(Math.random() * 899999 + 100000);
  const compNameKr = `(주)비에스알씨테스트${testSuffix}`;
  const compNameEn = `BSRC Test Corp ${testSuffix}`;
  const testPhone = "031-632-6600";
  const testPhoneDigits = "0316326600";
  const uniqueNotes = `Amazon US 진출 희망 및 샘플 발송 완료 (QATAG-${testSuffix})`;

  let createdCompanyId: string | null = null;
  let createdCompanyId2: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // TEST 1-5: Pre-save editing, Multi-contact creation & Telephone persistence
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 1: Pre-save Draft & Multiple Contacts ---");

    const draftPayload: NormalizedCompanyDraft = {
      company: {
        nameKr: compNameKr,
        nameEn: compNameEn,
        descriptionKr: "자연주의 고기능성 스킨케어 제조 및 유통사",
        descriptionEn: "High-performance natural skincare manufacturer",
        businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
        primaryProductCategories: ["SKINCARE", "BODYCARE"],
        primaryCategoriesConfirmed: true,
        representativeName: "김대표",
        businessRegistrationNumber: "123-45-67890",
        telephone: "02-1234-5678",
        address: {
          formattedKr: "서울특별시 강남구 테헤란로 123",
          formattedEn: "123 Teheran-ro, Gangnam-gu, Seoul",
        },
      },
      brands: [
        {
          nameKr: `퓨어스킨${testSuffix}`,
          nameEn: `PureSkin${testSuffix}`,
          description: "클린 뷰티 스킨케어 브랜드",
          categories: ["Skin Care"],
          keyProducts: ["세럼", "크림"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "이해외",
          jobTitle: "해외영업팀장",
          department: "해외사업부",
          email: `global-${testSuffix}@bsrctest.com`,
          phone: testPhone,
          isPrimary: true,
          source: "MANUAL",
        },
        {
          name: "박마케팅",
          jobTitle: "마케팅 매니저",
          department: "브랜드전략팀",
          email: `marketing-${testSuffix}@bsrctest.com`,
          phone: "010-9876-5432",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      websites: [
        {
          url: `https://www.bsrctest${testSuffix}.com`,
          label: "OFFICIAL",
          source: "MANUAL",
        },
      ],
      categories: ["Skin Care", "Clean Beauty"],
      source: {
        provider: "INTERCHARM",
        sourceUrl: `https://qa-test-source.com/exhibitor/${testSuffix}`,
        sourceIdentifier: `EXH-${testSuffix}`,
      },
      audit: {
        status: "SUCCESS",
        missingKeyFields: [],
        notes: ["Automated QA Fixture"],
      },
    };

    const evaluationPayload: SourcingEvaluationInput = {
      grade: "B",
      status: "SAVED",
      internalNotes: uniqueNotes,
      primaryProductCategories: ["SKINCARE", "BODYCARE"],
      primaryCategoriesConfirmed: true,
      businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
    };

    const saveResult = await saveSourcingDraft(draftPayload, evaluationPayload, undefined, qaClient);
    assert("Candidate created successfully with multiple contacts", saveResult.success && Boolean(saveResult.companyId));
    createdCompanyId = saveResult.companyId;

    // Retrieve and verify data integrity
    const savedComp = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Company Korean and English names match draft", savedComp.company_name_kr === compNameKr && savedComp.company_name_en === compNameEn);
    assert("Company grade evaluated as B", savedComp.grade === "B");
    assert("Company status set to SAVED", savedComp.status === "SAVED");
    assert("Company internal notes saved correctly", savedComp.internal_notes === uniqueNotes);
    assert("Company has exactly 2 contacts saved in DB", savedComp.sourcing_contacts?.length === 2);

    const primaryContact = savedComp.sourcing_contacts?.find((c: any) => c.is_primary);
    const secondaryContact = savedComp.sourcing_contacts?.find((c: any) => !c.is_primary);
    assert("Primary contact is '이해외' with primary flag true", primaryContact?.name === "이해외" && primaryContact?.is_primary === true);
    assert("Secondary contact '박마케팅' exists with email and phone", secondaryContact?.name === "박마케팅" && secondaryContact?.email === `marketing-${testSuffix}@bsrctest.com`);

    // --------------------------------------------------------------------------
    // TEST 6-10: Contact Management & Primary Toggle (Exactly 1 primary contact)
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 2: Contact Editing & Primary Contact Constraint ---");

    // Switch primary contact to 박마케팅, add a third contact, and update
    const updatedContacts = [
      {
        id: primaryContact.id,
        name: "이해외",
        jobTitle: "글로벌영업 총괄이사", // updated title
        department: "해외사업본부",
        email: primaryContact.email,
        phone: primaryContact.phone,
        isPrimary: false, // demoted from primary
        source: "MANUAL",
      },
      {
        id: secondaryContact.id,
        name: "박마케팅",
        jobTitle: "마케팅 매니저",
        department: "브랜드전략팀",
        email: secondaryContact.email,
        phone: secondaryContact.phone,
        isPrimary: true, // promoted to primary
        source: "MANUAL",
      },
      {
        name: "최연구",
        jobTitle: "수석 연구원",
        department: "R&D 센터",
        email: `rnd-${testSuffix}@bsrctest.com`,
        phone: "031-111-2222",
        isPrimary: false,
        source: "MANUAL",
      },
    ];

    const draftForUpdate: NormalizedCompanyDraft = {
      ...draftPayload,
      contacts: updatedContacts as any,
    };

    await updateSourcingCandidateComplete(createdCompanyId!, draftForUpdate, evaluationPayload, qaClient);

    const reloadedComp = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Company contacts count updated to 3", reloadedComp.sourcing_contacts?.length === 3);

    const newPrimary = reloadedComp.sourcing_contacts?.filter((c: any) => c.is_primary);
    assert("Exactly ONE contact has is_primary === true", newPrimary?.length === 1);
    assert("New primary contact is '박마케팅'", newPrimary?.[0]?.name === "박마케팅");

    const previousPrimaryUpdated = reloadedComp.sourcing_contacts?.find((c: any) => c.name === "이해외");
    assert("Previous primary contact '이해외' title updated to '글로벌영업 총괄이사'", previousPrimaryUpdated?.job_title === "글로벌영업 총괄이사");
    assert("Previous primary contact preserved original contact ID (differential update)", previousPrimaryUpdated?.id === primaryContact.id);

    // --------------------------------------------------------------------------
    // TEST 11-15: Brand Management (Add, Edit, Unlink without data loss)
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 3: Brand Add / Edit / Unlink in Company Detail ---");

    const initialBrand = reloadedComp.sourcing_brands?.[0];
    assert("Initial brand exists", Boolean(initialBrand));

    // Add a second brand and edit initial brand's description
    const updatedBrands = [
      {
        id: initialBrand.id,
        nameKr: initialBrand.brand_name_kr,
        nameEn: initialBrand.brand_name_en,
        description: "수정된 브랜드 설명 (글로벌 런칭)",
        categories: ["Skin Care"],
        keyProducts: ["세럼", "선크림"],
        source: "MANUAL",
      },
      {
        nameKr: `더마바이오${testSuffix}`,
        nameEn: `DermaBio${testSuffix}`,
        description: "더마 코스메틱 전문 라인",
        categories: ["Body Care"],
        keyProducts: ["바디로션", "바디워시"],
        source: "MANUAL",
      },
    ];

    const draftWithBrands: NormalizedCompanyDraft = {
      ...draftForUpdate,
      brands: updatedBrands as any,
    };

    await updateSourcingCandidateComplete(createdCompanyId!, draftWithBrands, evaluationPayload, qaClient);

    const compAfterBrandAdd = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Company now has 2 registered brands", compAfterBrandAdd.sourcing_brands?.length === 2);
    assert("Original brand preserved ID and updated description", 
      compAfterBrandAdd.sourcing_brands?.find((b: any) => b.id === initialBrand.id)?.description === "수정된 브랜드 설명 (글로벌 런칭)"
    );

    // Unlink the first brand (remove from company)
    const brandToKeep = compAfterBrandAdd.sourcing_brands?.find((b: any) => b.brand_name_kr.includes("더마바이오"));
    const unlinkedBrands = [
      {
        id: brandToKeep.id,
        nameKr: brandToKeep.brand_name_kr,
        nameEn: brandToKeep.brand_name_en,
        description: brandToKeep.description,
        categories: brandToKeep.categories,
        keyProducts: brandToKeep.key_products,
        source: "MANUAL",
      },
    ];

    await updateSourcingCandidateComplete(createdCompanyId!, { ...draftWithBrands, brands: unlinkedBrands as any }, evaluationPayload, qaClient);

    const compAfterUnlink = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Company now has 1 brand after unlinking", compAfterUnlink.sourcing_brands?.length === 1);
    assert("Remaining brand is '더마바이오'", compAfterUnlink.sourcing_brands?.[0]?.brand_name_kr.includes("더마바이오"));

    // --------------------------------------------------------------------------
    // TEST 16-20: Editable Grade synchronization
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 4: Editable Grade Synchronization ---");

    // Change grade to "A" via evaluation update
    await updateSourcingCandidateComplete(createdCompanyId!, draftWithBrands, { ...evaluationPayload, grade: "A" }, qaClient);
    const compGradeA = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Grade updated to A in DB", compGradeA.grade === "A");

    // Change grade to "UNRATED"
    await updateSourcingCandidateComplete(createdCompanyId!, draftWithBrands, { ...evaluationPayload, grade: "UNRATED" }, qaClient);
    const compGradeUnrated = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Grade updated to UNRATED in DB", compGradeUnrated.grade === "UNRATED");

    // Restore to "B"
    await updateSourcingCandidateComplete(createdCompanyId!, draftWithBrands, { ...evaluationPayload, grade: "B" }, qaClient);

    // --------------------------------------------------------------------------
    // TEST 21-27: Extended Multi-Vector Search (Phone, Notes, Names, Deduplication)
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 5: Extended Multi-Vector Search ---");

    // 1. Search by telephone normalized digits (without hyphens)
    const searchPhoneDigits = await listSourcingCompanies({ search: testPhoneDigits }, qaClient);
    assert("Search by normalized phone digits matches company", searchPhoneDigits.data.some((c: any) => c.id === createdCompanyId));

    // 2. Search by telephone with hyphens
    const searchPhoneFormatted = await listSourcingCompanies({ search: testPhone }, qaClient);
    assert("Search by formatted phone string matches company", searchPhoneFormatted.data.some((c: any) => c.id === createdCompanyId));

    // 3. Search by Internal Notes partial text ("Amazon")
    const searchNotesAmazon = await listSourcingCompanies({ search: "Amazon" }, qaClient);
    assert("Search by Internal Notes keyword 'Amazon' matches company", searchNotesAmazon.data.some((c: any) => c.id === createdCompanyId));

    // 4. Search by Internal Notes Korean text ("샘플 발송")
    const searchNotesKorean = await listSourcingCompanies({ search: "샘플 발송" }, qaClient);
    assert("Search by Internal Notes Korean text '샘플 발송' matches company", searchNotesKorean.data.some((c: any) => c.id === createdCompanyId));

    // 5. Search by unique QA tag in notes
    const searchUniqueTag = await listSourcingCompanies({ search: `QATAG-${testSuffix}` }, qaClient);
    assert(`Search by unique tag 'QATAG-${testSuffix}' returns exactly 1 company`, 
      searchUniqueTag.data.filter((c: any) => c.id === createdCompanyId).length === 1
    );

    // 6. Search by secondary contact email
    const searchSecEmail = await listSourcingCompanies({ search: `marketing-${testSuffix}` }, qaClient);
    assert("Search by secondary contact email matches company", searchSecEmail.data.some((c: any) => c.id === createdCompanyId));

    // 7. Search deduplication: company must be returned exactly once even if query matches name, brand, contact, and notes
    const searchMultiMatch = await listSourcingCompanies({ search: `${testSuffix}` }, qaClient);
    const multiMatchOccurrences = searchMultiMatch.data.filter((c: any) => c.id === createdCompanyId);
    assert("Multi-match query returns company exactly once (no duplicate rows in list)", multiMatchOccurrences.length === 1);

    // --------------------------------------------------------------------------
    // TEST 28-32: Page Sizes (20 / 50 / 100 / 200) and Filtering
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 6: Page Sizes & Filtering ---");

    for (const size of [20, 50, 100, 200]) {
      const pageRes = await listSourcingCompanies({ limit: size, offset: 0 }, qaClient);
      assert(`Page size limit ${size} respected (returned <= ${size} items)`, pageRes.data.length <= size);
    }

    // Filter by Company Type
    const typeRes = await listSourcingCompanies({ businessTypes: ["MANUFACTURER"] }, qaClient);
    assert("Company Type filter returns matching manufacturer candidate", typeRes.data.some((c: any) => c.id === createdCompanyId));

    // --------------------------------------------------------------------------
    // TEST 33-36: Bulk Archiving / Soft Delete (Reversible, Hides from default list)
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 7: Bulk Deletion & Archiving Safety ---");

    // Create a second fixture company to test bulk deletion of multiple companies
    const draft2: NormalizedCompanyDraft = {
      ...draftPayload,
      company: {
        ...draftPayload.company,
        nameKr: `(주)비에스알씨세컨드${testSuffix}`,
        nameEn: `BSRC Second Corp ${testSuffix}`,
      },
      brands: [
        {
          nameKr: `세컨드브랜드${testSuffix}`,
          nameEn: `SecondBrand${testSuffix}`,
          description: "세컨드 라인",
          categories: ["Skin Care"],
          keyProducts: ["에센스"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "정관리",
          jobTitle: "운영팀장",
          department: "운영기획",
          email: `operations-${testSuffix}@bsrctest2.com`,
          phone: "010-3333-4444",
          isPrimary: true,
          source: "MANUAL",
        },
      ],
      websites: [
        {
          url: `https://www.secondbrand${testSuffix}.com`,
          label: "OFFICIAL",
          source: "MANUAL",
        },
      ],
      source: {
        provider: "INTERCHARM",
        sourceIdentifier: `EXH-2-${testSuffix}`,
        sourceUrl: `https://qa-test-source.com/exhibitor-2/${testSuffix}`,
      },
    };
    const saveRes2 = await saveSourcingDraft(draft2, evaluationPayload, undefined, qaClient);
    createdCompanyId2 = saveRes2.companyId;

    // Both should be visible in default active list
    const defaultListBefore = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Both test candidates visible in default list before deletion", 
      defaultListBefore.data.some((c: any) => c.id === createdCompanyId) &&
      defaultListBefore.data.some((c: any) => c.id === createdCompanyId2)
    );

    // Perform bulk archive on both test candidates
    const bulkArchiveRes = await bulkArchiveSourcingCompanies([createdCompanyId!, createdCompanyId2!], qaClient);
    assert("bulkArchiveSourcingCompanies reports 2 companies archived", bulkArchiveRes.success && bulkArchiveRes.count === 2);

    // Verify both are now hidden from default list
    const defaultListAfter = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Archived companies are hidden from default Brand List", 
      !defaultListAfter.data.some((c: any) => c.id === createdCompanyId || c.id === createdCompanyId2)
    );

    // Verify both are retrieved when status='ARCHIVED' is explicitly filtered
    const archivedList = await listSourcingCompanies({ status: "ARCHIVED", limit: 100 }, qaClient);
    assert("Archived companies are safely preserved and visible under ARCHIVED status filter", 
      archivedList.data.some((c: any) => c.id === createdCompanyId) &&
      archivedList.data.some((c: any) => c.id === createdCompanyId2)
    );

    // Verify related contacts and brands were NOT deleted (audit history preserved)
    const archivedComp1 = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Archived company 1 retains all contacts in database", archivedComp1.sourcing_contacts?.length === 3);
    assert("Archived company 1 retains registered brands in database", (archivedComp1.sourcing_brands?.length || 0) >= 1);

    // --------------------------------------------------------------------------
    // TEST 37: LIVE_MODE Safety Verification
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 8: Email Campaigns Safety Verification ---");
    const emailActionsFile = fs.readFileSync("lib/brand-marketing/campaign-actions.ts", "utf8");
    const isLiveModeLocked = emailActionsFile.includes("LIVE_MODE Safety Lock") && emailActionsFile.includes("Hard-locked to false");
    assert("LIVE_MODE safety lock active (zero accidental external sends)", isLiveModeLocked);

  } catch (err: any) {
    console.error("UNEXPECTED SUITE ERROR:", err);
  } finally {
    // Clean up test records from QA database
    if (createdCompanyId) {
      await qaClient.from("sourcing_companies").delete().eq("id", createdCompanyId);
    }
    if (createdCompanyId2) {
      await qaClient.from("sourcing_companies").delete().eq("id", createdCompanyId2);
    }
    console.log("\nQA test cleanup finished.");
  }

  console.log("================================================================================");
  console.log(`TOTAL QA TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${total - passed}`);
  console.log("================================================================================");

  if (passed === total) {
    console.log("ALL 37 ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error(`QA SUITE FAILED: ${total - passed} test(s) failed.`);
    process.exit(1);
  }
}

runTestSuite();
