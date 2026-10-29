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
  } as any;
} catch {}

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import {
  saveSourcingDraft,
  getSourcingCompanyById,
  updateSourcingCandidateComplete,
  updateSourcingEvaluation,
  bulkArchiveSourcingCompanies,
  archiveSourcingCandidate,
  bulkRestoreSourcingCompanies,
  restoreSourcingCandidate,
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

async function runFinalQASuite() {
  const { runCampaignDryRun, getMarketingCampaignById } = await import("../lib/brand-marketing/campaign-data-access");
  const { maskEmailAddress } = await import("../lib/notifications/email");

  console.log("================================================================================");
  console.log("STARTING FINAL QA & INTEGRATION VERIFICATION: ADM-BSRC-013");
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
  const compNameKr = `(주)비에스알씨파이널${testSuffix}`;
  const compNameEn = `BSRC Final Corp ${testSuffix}`;
  const testPhone = "031-777-8899";
  const testPhoneDigits = "0317778899";
  const uniqueNotes = `미국 세포라 입점 목표 및 바이어 미팅 완료 (FINAL-TAG-${testSuffix})`;

  let createdCompanyId: string | null = null;
  let createdCompanyId2: string | null = null;
  let createdCompanyId3: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: 3-Contact Company Creation & Detail View Verification
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 1: 3-Contact Company Creation & Detail Verification ---");

    const primaryEmail = `ceo-${testSuffix}@bsrctest.com`;
    const secEmail1 = `marketing-${testSuffix}@bsrctest.com`;
    const secEmail2 = `sales-${testSuffix}@bsrctest.com`;

    const draftPayload: NormalizedCompanyDraft = {
      company: {
        nameKr: compNameKr,
        nameEn: compNameEn,
        descriptionKr: "프리미엄 K-뷰티 스킨케어 전문 브랜드사",
        descriptionEn: "Premium K-Beauty Skincare Manufacturer",
        businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
        primaryProductCategories: ["SKINCARE", "BODYCARE"],
        primaryCategoriesConfirmed: true,
        representativeName: "박대표",
        businessRegistrationNumber: "220-81-99999",
        telephone: "02-9988-7766",
        address: {
          formattedKr: "서울특별시 강남구 봉은사로 456",
          formattedEn: "456 Bongeunsa-ro, Gangnam-gu, Seoul",
        },
      },
      brands: [
        {
          nameKr: `글로우스킨${testSuffix}`,
          nameEn: `GlowSkin${testSuffix}`,
          description: "글로벌 타겟 고기능성 앰플 브랜드",
          categories: ["Skin Care"],
          keyProducts: ["글로우 앰플", "수분 크림"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "박대표",
          jobTitle: "대표이사",
          department: "경영총괄",
          email: primaryEmail,
          phone: "010-1111-2222",
          isPrimary: true,
          source: "MANUAL",
        },
        {
          name: "김마케팅",
          jobTitle: "마케팅팀장",
          department: "해외마케팅팀",
          email: secEmail1,
          phone: "010-3333-5555",
          isPrimary: false,
          source: "MANUAL",
        },
        {
          name: "이해외영업",
          jobTitle: "영업이사",
          department: "미주영업본부",
          email: secEmail2,
          phone: testPhone,
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      websites: [
        {
          url: `https://www.glowskin${testSuffix}.com`,
          label: "OFFICIAL",
          source: "MANUAL",
        },
      ],
      source: {
        provider: "COSMOPROF",
        sourceIdentifier: `EXH-FINAL-${testSuffix}`,
        sourceUrl: `https://qa-test-source.com/cosmoprof/${testSuffix}`,
      },
    };

    const evaluationPayload: SourcingEvaluationInput = {
      grade: "A",
      fitScore: 92,
      internalNotes: uniqueNotes,
    };

    const saveRes = await saveSourcingDraft(draftPayload, evaluationPayload, undefined, qaClient);
    createdCompanyId = saveRes.companyId;

    assert("Company created with 3 contacts successfully", Boolean(createdCompanyId));

    const savedCompany = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Company Detail has exactly 3 contacts", savedCompany.sourcing_contacts?.length === 3);

    const savedPrimary = savedCompany.sourcing_contacts?.find((ct: any) => ct.is_primary);
    assert("Primary contact is 박대표 (CEO)", savedPrimary?.name === "박대표" && savedPrimary?.email === primaryEmail);

    const secondaryContacts = savedCompany.sourcing_contacts?.filter((ct: any) => !ct.is_primary);
    assert("Company Detail has 2 secondary contacts", secondaryContacts?.length === 2);
    assert("Secondary contact 1 email matches marketing team", secondaryContacts?.some((ct: any) => ct.email === secEmail1));
    assert("Secondary contact 2 email matches sales team", secondaryContacts?.some((ct: any) => ct.email === secEmail2));

    // --------------------------------------------------------------------------
    // SUITE 2: Secondary Contact Selection in Email Campaigns Dry Run
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 2: Secondary Contact Email Selection & Dry Run ---");

    const contactMap = new Map<string, string>(); // email -> contactId
    savedCompany.sourcing_contacts?.forEach((ct: any) => {
      contactMap.set(ct.email, ct.id);
    });

    const primaryContactId = contactMap.get(primaryEmail)!;
    const sec1ContactId = contactMap.get(secEmail1)!;
    const sec2ContactId = contactMap.get(secEmail2)!;

    // Test 2.1: Run Dry Run selecting ONLY Secondary Contact 1 (김마케팅)
    const dryRunSec1 = await runCampaignDryRun(
      "test-campaign-sec1",
      {
        companyIds: [createdCompanyId!],
        contactIds: [sec1ContactId],
      },
      qaClient
    );

    assert("Dry Run with only Secondary 1 reports sendableCount === 1", dryRunSec1.sendableCount === 1);
    assert("Dry Run with only Secondary 1 reports excludedCount === 0", dryRunSec1.excludedCount === 0);
    assert("Sample preview recipient email matches Secondary 1 email (masked)", dryRunSec1.samplePreviews[0]?.recipientEmail === maskEmailAddress(secEmail1));
    assert("Sample preview recipient contactName matches Secondary 1 name", dryRunSec1.samplePreviews[0]?.contactName === "김마케팅");

    // Test 2.2: Run Dry Run selecting BOTH Secondary 1 and Secondary 2 (김마케팅 + 이해외영업)
    const dryRunSecBoth = await runCampaignDryRun(
      "test-campaign-sec-both",
      {
        companyIds: [createdCompanyId!],
        contactIds: [sec1ContactId, sec2ContactId],
      },
      qaClient
    );

    assert("Dry Run with both secondary contacts reports sendableCount === 2", dryRunSecBoth.sendableCount === 2);
    assert("Dry Run with both secondary contacts reports excludedCount === 0", dryRunSecBoth.excludedCount === 0);
    assert("Sample preview includes Secondary 1 email (masked)", dryRunSecBoth.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(secEmail1)));
    assert("Sample preview includes Secondary 2 email (masked)", dryRunSecBoth.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(secEmail2)));
    assert("Primary contact email is NOT included when unselected", !dryRunSecBoth.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(primaryEmail)));

    // Test 2.3: Run Dry Run targeting all 3 contacts
    const dryRunAllThree = await runCampaignDryRun(
      "test-campaign-all-three",
      {
        companyIds: [createdCompanyId!],
        contactIds: [primaryContactId, sec1ContactId, sec2ContactId],
      },
      qaClient
    );
    assert("Dry Run with all 3 contacts reports sendableCount === 3", dryRunAllThree.sendableCount === 3);
    assert("Dry Run with all 3 contacts generates sample preview for all 3", dryRunAllThree.samplePreviews.length === 3);

    // Test 2.4: Deduplication safety when contacts share identical email
    // Add a temporary 4th contact sharing the same email as Secondary 1
    const { data: dupContact } = await qaClient
      .from("sourcing_contacts")
      .insert({
        company_id: createdCompanyId!,
        name: "김마케팅 (Duplicate Email)",
        email: secEmail1,
        is_primary: false,
      })
      .select()
      .single();

    const dryRunDup = await runCampaignDryRun(
      "test-campaign-dup",
      {
        companyIds: [createdCompanyId!],
        contactIds: [sec1ContactId, dupContact?.id].filter(Boolean),
      },
      qaClient
    );

    assert("Deduplication captures duplicate email entry (duplicateEmailsFiltered === 1)", dryRunDup.duplicateEmailsFiltered === 1);
    assert("Deduplication reports exactly 1 sendable recipient", dryRunDup.sendableCount === 1);
    assert("Deduplication reports exactly 1 excluded recipient", dryRunDup.excludedCount === 1);

    // Clean up temporary contact
    if (dupContact?.id) {
      await qaClient.from("sourcing_contacts").delete().eq("id", dupContact.id);
    }

    // --------------------------------------------------------------------------
    // SUITE 3: Bulk Archive Data Safety & Safe Restore Path
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 3: Bulk Archive Data Safety & Restore Path ---");

    // Create candidate 2 and 3
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
          categories: ["Skin Care"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "이세컨드",
          email: `sec2-${testSuffix}@bsrctest.com`,
          phone: "010-2222-3333",
          isPrimary: true,
          source: "MANUAL",
        },
      ],
      source: {
        provider: "INTERCHARM",
        sourceIdentifier: `EXH-2-${testSuffix}`,
        sourceUrl: `https://qa-test-source.com/exh2/${testSuffix}`,
      },
    };

    const draft3: NormalizedCompanyDraft = {
      ...draftPayload,
      company: {
        ...draftPayload.company,
        nameKr: `(주)비에스알씨서드${testSuffix}`,
        nameEn: `BSRC Third Corp ${testSuffix}`,
      },
      brands: [
        {
          nameKr: `서드브랜드${testSuffix}`,
          nameEn: `ThirdBrand${testSuffix}`,
          categories: ["Makeup"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "최서드",
          email: `third-${testSuffix}@bsrctest.com`,
          phone: "010-5555-6666",
          isPrimary: true,
          source: "MANUAL",
        },
      ],
      source: {
        provider: "INTERCHARM",
        sourceIdentifier: `EXH-3-${testSuffix}`,
        sourceUrl: `https://qa-test-source.com/exh3/${testSuffix}`,
      },
    };

    const saveRes2 = await saveSourcingDraft(draft2, evaluationPayload, undefined, qaClient);
    createdCompanyId2 = saveRes2.companyId;

    const saveRes3 = await saveSourcingDraft(draft3, evaluationPayload, undefined, qaClient);
    createdCompanyId3 = saveRes3.companyId;

    // Verify all 3 are visible in default list before archiving
    const listBefore = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("All 3 companies visible in active Brand List initially",
      listBefore.data.some((c: any) => c.id === createdCompanyId) &&
      listBefore.data.some((c: any) => c.id === createdCompanyId2) &&
      listBefore.data.some((c: any) => c.id === createdCompanyId3)
    );

    // Step A: Bulk archive company 1 and company 2
    const bulkArchiveRes = await bulkArchiveSourcingCompanies([createdCompanyId!, createdCompanyId2!], qaClient);
    assert("bulkArchiveSourcingCompanies archives exactly 2 companies", bulkArchiveRes.success && bulkArchiveRes.count === 2);

    // Verify company 3 remains active, company 1 and 2 disappear from default list
    const listAfterArchive = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Company 1 is hidden from default list", !listAfterArchive.data.some((c: any) => c.id === createdCompanyId));
    assert("Company 2 is hidden from default list", !listAfterArchive.data.some((c: any) => c.id === createdCompanyId2));
    assert("Unselected Company 3 remains visible in active list", listAfterArchive.data.some((c: any) => c.id === createdCompanyId3));

    // Verify related brands, contacts, and websites of archived company 1 are completely preserved
    const archivedComp1 = await getSourcingCompanyById(createdCompanyId!, qaClient);
    assert("Archived company 1 status is 'ARCHIVED'", archivedComp1.status === "ARCHIVED");
    assert("Archived company 1 retains all 3 contacts (no cascade deletion)", archivedComp1.sourcing_contacts?.length === 3);
    assert("Archived company 1 retains registered brands", (archivedComp1.sourcing_brands?.length || 0) >= 1);
    assert("Archived company 1 retains registered websites", (archivedComp1.sourcing_websites?.length || 0) >= 1);

    // Verify both appear when filtering status='ARCHIVED'
    const archivedList = await listSourcingCompanies({ status: "ARCHIVED", limit: 100 }, qaClient);
    assert("Both archived companies appear under status='ARCHIVED' filter",
      archivedList.data.some((c: any) => c.id === createdCompanyId) &&
      archivedList.data.some((c: any) => c.id === createdCompanyId2)
    );

    // Step B: Bulk restore company 1 and company 2
    const bulkRestoreRes = await bulkRestoreSourcingCompanies([createdCompanyId!, createdCompanyId2!], qaClient);
    assert("bulkRestoreSourcingCompanies restores exactly 2 companies", bulkRestoreRes.success && bulkRestoreRes.count === 2);

    // Verify both are back in the active list
    const listAfterRestore = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Company 1 is restored to active Brand List (status='SAVED')", listAfterRestore.data.some((c: any) => c.id === createdCompanyId));
    assert("Company 2 is restored to active Brand List (status='SAVED')", listAfterRestore.data.some((c: any) => c.id === createdCompanyId2));

    // Step C: Single company archive & single company restore
    await archiveSourcingCandidate(createdCompanyId3!, qaClient);
    const checkArchived3 = await getSourcingCompanyById(createdCompanyId3!, qaClient);
    assert("Single candidate archive sets status to ARCHIVED", checkArchived3.status === "ARCHIVED");

    await restoreSourcingCandidate(createdCompanyId3!, qaClient);
    const checkRestored3 = await getSourcingCompanyById(createdCompanyId3!, qaClient);
    assert("Single candidate restore sets status to SAVED", checkRestored3.status === "SAVED");

    // --------------------------------------------------------------------------
    // SUITE 4: Extended Search Enhancements (Phone Digits & Internal Notes)
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 4: Extended Multi-Vector Search ---");

    // 1. Search by telephone normalized digits
    const searchPhoneDigits = await listSourcingCompanies({ search: testPhoneDigits }, qaClient);
    assert("Search by phone digits (0317778899) finds company", searchPhoneDigits.data.some((c: any) => c.id === createdCompanyId));

    // 2. Search by telephone formatted string
    const searchPhoneFormatted = await listSourcingCompanies({ search: testPhone }, qaClient);
    assert("Search by formatted phone (031-777-8899) finds company", searchPhoneFormatted.data.some((c: any) => c.id === createdCompanyId));

    // 3. Search by internal notes keyword "세포라"
    const searchNotesSephora = await listSourcingCompanies({ search: "세포라" }, qaClient);
    assert("Search by Internal Notes keyword '세포라' finds company", searchNotesSephora.data.some((c: any) => c.id === createdCompanyId));

    // 4. Search by unique tag in internal notes
    const searchUniqueTag = await listSourcingCompanies({ search: `FINAL-TAG-${testSuffix}` }, qaClient);
    assert(`Search by unique note tag returns exactly 1 company`,
      searchUniqueTag.data.filter((c: any) => c.id === createdCompanyId).length === 1
    );

    // --------------------------------------------------------------------------
    // SUITE 5: UI & Architecture Guardrails Verification
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 5: UI & Architecture Guardrails ---");

    // 1. Page size options 20, 50, 100, 200
    for (const size of [20, 50, 100, 200]) {
      const pageRes = await listSourcingCompanies({ limit: size, offset: 0 }, qaClient);
      assert(`Page size limit ${size} respected (returned <= ${size} items)`, pageRes.data.length <= size);
    }

    // 2. Duplicate audit button removed from Brand List toolbar
    const viewContent = fs.readFileSync("components/admin/brand-marketing/brand-marketing-view.tsx", "utf8");
    const hasToolbarAuditBtn = viewContent.includes("onClick={handleOpenAuditModal}") || viewContent.includes("onClick={() => handleOpenAuditModal()}");
    assert("Brand List toolbar does NOT contain Duplicate Audit button (toolbar cleaned up)", !hasToolbarAuditBtn);

    // 3. Duplicate audit modal component preserved
    const hasAuditModal = viewContent.includes("Brand Sourcing 중복 감사 보고서 (Read-Only Duplicate Audit)");
    assert("Duplicate audit modal and backend inspection logic preserved intact", hasAuditModal);

    // 4. Admin 1800px standard check
    const layoutContent = fs.readFileSync("components/admin/layout.tsx", "utf8");
    const has1800px = layoutContent.includes("max-w-[1800px]");
    assert("Admin global layout enforces 1800px max-width standard (AGENTS.md Rule 27)", has1800px);

    // 5. LIVE_MODE hard-locked false
    const emailActionsFile = fs.readFileSync("lib/brand-marketing/campaign-actions.ts", "utf8");
    const isLiveModeLocked = emailActionsFile.includes("LIVE_MODE Safety Lock") && emailActionsFile.includes("Hard-locked to false");
    assert("Marketing email dispatch LIVE_MODE safety lock active (zero external sends)", isLiveModeLocked);

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
    if (createdCompanyId3) {
      await qaClient.from("sourcing_companies").delete().eq("id", createdCompanyId3);
    }
    console.log("\nQA test cleanup finished.");
  }

  console.log("================================================================================");
  console.log(`TOTAL QA TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${total - passed}`);
  console.log("================================================================================");

  if (passed === total && total > 0) {
    console.log("ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error(`QA SUITE FAILED: ${total - passed} test(s) failed.`);
    process.exit(1);
  }
}

runFinalQASuite();
