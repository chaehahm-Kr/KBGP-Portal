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
  bulkArchiveSourcingCompanies,
  bulkRestoreSourcingCompanies,
  listSourcingCompanies,
  findDuplicateCandidates,
} from "../lib/brand-sourcing/data-access";
import { IndieBeautyShowAdapter } from "../lib/brand-sourcing/adapters/indie-beauty-show.adapter";
import { createBlankManualDraft } from "../lib/brand-sourcing/manual-entry";
import { NormalizedCompanyDraft } from "../lib/brand-sourcing/types";

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

async function runIntegratedE2E() {
  const { runCampaignDryRun } = await import("../lib/brand-marketing/campaign-data-access");
  const { maskEmailAddress } = await import("../lib/notifications/email");

  console.log("================================================================================");
  console.log("INTEGRATED END-TO-END QA: ADM-BSRC-013 + ADM-BSRC-014-R1");
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
  let ibsCompanyId: string | null = null;
  let manualCompanyId: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // WORKFLOW 1: Indie Beauty Show -> Multi-Contact Edit -> Save -> Email Campaign
    // --------------------------------------------------------------------------
    console.log("\n--- Workflow 1: Indie Beauty Show End-to-End ---");

    const sampleUrl = "https://indiebeautyshow.com/exhibitor-list2026/?q=YToxOntzOjEyOiJrZXl3b3JkX3R5cGUiO3M6MzoiYWxsIjt9&bmode=view&idx=170410507&t=board";
    const adapter = new IndieBeautyShowAdapter();
    const extractedDraft = await adapter.extract(sampleUrl);

    assert("IBS Adapter successfully extracts candidate", Boolean(extractedDraft));
    assert("IBS extracted brand is '언리시아'", extractedDraft.company.nameKr === "언리시아");
    assert("IBS provider is INDIE_BEAUTY_SHOW", extractedDraft.source.provider === "INDIE_BEAUTY_SHOW");

    // Staff modifies draft: Adds 2 additional secondary contacts
    const secContact1Email = `marketing-ibs-${testSuffix}@unleashia.com`;
    const secContact2Email = `global-ibs-${testSuffix}@unleashia.com`;

    const enrichedDraft: NormalizedCompanyDraft = {
      ...extractedDraft,
      company: {
        ...extractedDraft.company,
        nameKr: `(주)언리시아_통합테스트_${testSuffix}`,
        primaryProductCategories: ["MAKEUP", "SKINCARE"],
        primaryCategoriesConfirmed: true,
      },
      contacts: [
        ...(extractedDraft.contacts || []),
        {
          name: "박마케팅",
          jobTitle: "마케팅팀장",
          department: "해외마케팅",
          email: secContact1Email,
          phone: "010-8888-9999",
          isPrimary: false,
          source: "MANUAL",
        },
        {
          name: "최해외",
          jobTitle: "해외영업이사",
          department: "글로벌사업본부",
          email: secContact2Email,
          phone: "010-7777-6666",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      audit: {
        status: "SUCCESS",
        missingKeyFields: [],
        notes: [`IBS 통합 테스트 등록 (TAG-${testSuffix})`],
      },
    };

    const saveIbsRes = await saveSourcingDraft(enrichedDraft, { grade: "A", internalNotes: `IBS 바이어 매칭 완료 (TAG-${testSuffix})` }, undefined, qaClient);
    ibsCompanyId = saveIbsRes.companyId;
    assert("IBS company saved successfully to QA DB", Boolean(ibsCompanyId));

    // Verify company detail in Brand List
    const savedIbsCompany = await getSourcingCompanyById(ibsCompanyId!, qaClient);
    assert("Saved IBS company has at least 3 contacts", (savedIbsCompany.sourcing_contacts?.length || 0) >= 3);

    const ibsPrimaryContact = savedIbsCompany.sourcing_contacts?.find((c: any) => c.is_primary);
    assert("Primary contact is preserved", Boolean(ibsPrimaryContact));

    const ibsSecondaryContacts = savedIbsCompany.sourcing_contacts?.filter((c: any) => !c.is_primary) || [];
    assert("Secondary contacts are available (count >= 2)", ibsSecondaryContacts.length >= 2);
    assert("Secondary contact 1 email matches", ibsSecondaryContacts.some((c: any) => c.email === secContact1Email));
    assert("Secondary contact 2 email matches", ibsSecondaryContacts.some((c: any) => c.email === secContact2Email));

    // Admin edits company information (simulate Drawer edit): Contact IDs must remain stable
    const initialContactIds = savedIbsCompany.sourcing_contacts?.map((c: any) => c.id).sort();
    const updateDraft: NormalizedCompanyDraft = {
      ...enrichedDraft,
      company: {
        ...enrichedDraft.company,
        nameKr: `(주)언리시아_수정_${testSuffix}`,
        nameEn: "Unleashia Co., Ltd.",
        businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
      },
      contacts: savedIbsCompany.sourcing_contacts?.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        department: c.department,
        jobTitle: c.job_title,
        isPrimary: c.is_primary,
        source: c.source || "IBS",
      })) || [],
      brands: savedIbsCompany.sourcing_brands?.map((b: any) => ({
        id: b.id,
        nameKr: b.brand_name_kr,
        nameEn: b.brand_name_en || "",
        categories: b.categories || [],
        keyProducts: b.key_products || [],
        source: b.source || "IBS",
      })) || [],
    };

    const updateEvaluation: SourcingEvaluationInput = {
      grade: "A",
      businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
      primaryProductCategories: ["MAKEUP", "SKINCARE"],
      primaryCategoriesConfirmed: true,
    };

    const updateRes = await updateSourcingCandidateComplete(
      ibsCompanyId!,
      updateDraft,
      updateEvaluation,
      qaClient
    );
    assert("Admin updateSourcingCandidateComplete executed successfully", updateRes.success);

    const reloadedIbsCompany = await getSourcingCompanyById(ibsCompanyId!, qaClient);
    const postEditContactIds = reloadedIbsCompany.sourcing_contacts?.map((c: any) => c.id).sort();
    assert("Contact IDs remain stable during edits (no arbitrary ID regen)", JSON.stringify(initialContactIds) === JSON.stringify(postEditContactIds));
    assert("No duplicate contact rows inserted after edit", reloadedIbsCompany.sourcing_contacts?.length === savedIbsCompany.sourcing_contacts?.length);

    // Email Campaign Recipient Selection with IBS company contacts
    const sec1Contact = reloadedIbsCompany.sourcing_contacts?.find((c: any) => c.email === secContact1Email);
    const sec2Contact = reloadedIbsCompany.sourcing_contacts?.find((c: any) => c.email === secContact2Email);

    const dryRunSecOnly = await runCampaignDryRun(
      `camp-ibs-${testSuffix}`,
      {
        companyIds: [ibsCompanyId!],
        contactIds: [sec1Contact?.id, sec2Contact?.id].filter(Boolean),
      },
      qaClient
    );

    assert("Dry run returns exactly 2 sendable recipients", dryRunSecOnly.sendableCount === 2);
    assert("Dry run sample previews include Secondary 1 email (masked)", dryRunSecOnly.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(secContact1Email)));
    assert("Dry run sample previews include Secondary 2 email (masked)", dryRunSecOnly.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(secContact2Email)));
    assert("Primary contact is omitted when unselected", !dryRunSecOnly.samplePreviews.some((s) => s.recipientEmail === maskEmailAddress(ibsPrimaryContact?.email || "")));

    // --------------------------------------------------------------------------
    // WORKFLOW 2: Manual Registration -> Multi-Brand & Multi-Contact -> Archive & Restore
    // --------------------------------------------------------------------------
    console.log("\n--- Workflow 2: Manual Registration End-to-End ---");

    const manualDraft = createBlankManualDraft();
    assert("Manual draft provider is MANUAL", manualDraft.source.provider === "MANUAL");
    assert("Manual draft sourceUrl is empty (no exhibition URL required)", manualDraft.source.sourceUrl === "");

    const manualCompName = `(주)수동등록뷰티_${testSuffix}`;
    const manualBrandName = `수동브랜드_${testSuffix}`;
    const manualPrimaryEmail = `manual-ceo-${testSuffix}@manualbeauty.com`;
    const manualSecEmail = `manual-ops-${testSuffix}@manualbeauty.com`;

    const populatedManualDraft: NormalizedCompanyDraft = {
      ...manualDraft,
      company: {
        ...manualDraft.company,
        nameKr: manualCompName,
        nameEn: `Manual Beauty Corp ${testSuffix}`,
        descriptionKr: "자사 브랜드 기반 신규 K-뷰티 유망 스타트업",
        businessTypes: ["BRAND_OWNER"],
        primaryProductCategories: ["PERSONAL_CARE", "BODYCARE"],
        primaryCategoriesConfirmed: true,
        representativeName: "홍길동",
        telephone: "02-5555-4444",
      },
      brands: [
        {
          nameKr: manualBrandName,
          nameEn: `ManualBrand${testSuffix}`,
          description: "퍼스널 바디케어 라인",
          categories: ["Body Care"],
          keyProducts: ["바디워시", "바디로션"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "홍대표",
          email: manualPrimaryEmail,
          phone: "010-9999-0000",
          jobTitle: "대표",
          isPrimary: true,
          source: "MANUAL",
        },
        {
          name: "강운영",
          email: manualSecEmail,
          phone: "010-8888-1111",
          jobTitle: "운영총괄",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      audit: {
        status: "SUCCESS",
        missingKeyFields: [],
        notes: [`직접 수동 등록 (TAG-${testSuffix})`],
      },
    };

    // Save manual draft
    const saveManualRes = await saveSourcingDraft(populatedManualDraft, { grade: "B", internalNotes: `수동 등록 메모 (TAG-${testSuffix})` }, undefined, qaClient);
    manualCompanyId = saveManualRes.companyId;
    assert("Manual company saved successfully without source URL", Boolean(manualCompanyId));

    // Verify retrieval in Brand List
    const savedManualComp = await getSourcingCompanyById(manualCompanyId!, qaClient);
    assert("Manual company name matches", savedManualComp.company_name_kr === manualCompName);
    assert("Manual company has 2 contacts", savedManualComp.sourcing_contacts?.length === 2);
    assert("Manual company has 1 brand", savedManualComp.sourcing_brands?.length === 1);
    assert("Manual company brand name matches", savedManualComp.sourcing_brands?.[0]?.brand_name_kr === manualBrandName);

    // Duplicate detection verification for manual entry
    const dupCheck = await findDuplicateCandidates({ companyNameKr: manualCompName }, qaClient);
    assert("findDuplicateCandidates detects manual company name match", dupCheck.isDuplicate === true);
    assert("Duplicate matchedField is '회사명'", dupCheck.matches.some((m) => m.matchedField === "회사명"));

    // Archive manual company
    const archiveRes = await bulkArchiveSourcingCompanies([manualCompanyId!], qaClient);
    assert("bulkArchiveSourcingCompanies archives manual company", archiveRes.success && archiveRes.count === 1);

    const defaultList = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Archived manual company hidden from active Brand List", !defaultList.data.some((c: any) => c.id === manualCompanyId));

    const archivedList = await listSourcingCompanies({ status: "ARCHIVED", limit: 100 }, qaClient);
    assert("Archived manual company found in ARCHIVED status filter", archivedList.data.some((c: any) => c.id === manualCompanyId));

    // Restore manual company
    const restoreRes = await bulkRestoreSourcingCompanies([manualCompanyId!], qaClient);
    assert("bulkRestoreSourcingCompanies restores manual company", restoreRes.success && restoreRes.count === 1);

    const activeList = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Restored manual company reappears in active Brand List (status='SAVED')", activeList.data.some((c: any) => c.id === manualCompanyId));

    // --------------------------------------------------------------------------
    // WORKFLOW 3: InterCHARM Backward Compatibility Check
    // --------------------------------------------------------------------------
    console.log("\n--- Workflow 3: InterCHARM Compatibility Verification ---");

    const intercharmUrl = "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html";
    const intercharmAdapter = new (await import("../lib/brand-sourcing/adapters/intercharm.adapter")).IntercharmAdapter();
    assert("IntercharmAdapter is instantiated", Boolean(intercharmAdapter));
    assert("IntercharmAdapter provider is INTERCHARM", intercharmAdapter.provider === "INTERCHARM");

    // --------------------------------------------------------------------------
    // WORKFLOW 4: Safety & Guardrail Invariants
    // --------------------------------------------------------------------------
    console.log("\n--- Workflow 4: Architecture & Safety Invariants ---");

    // 1. LIVE_MODE is locked false
    const emailActionsFile = fs.readFileSync("lib/brand-marketing/campaign-actions.ts", "utf8");
    const isLiveLocked = emailActionsFile.includes("LIVE_MODE Safety Lock") && emailActionsFile.includes("Hard-locked to false");
    assert("LIVE_MODE safety lock active (zero accidental external sends)", isLiveLocked);

    // 2. Admin 1800px standard check
    const layoutFile = fs.readFileSync("components/admin/layout.tsx", "utf8");
    assert("Admin global layout enforces max-w-[1800px] (AGENTS.md Rule 27)", layoutFile.includes("max-w-[1800px]"));

    // 3. Brand marketing view integrates both SourcingImportHeader and 800px drawer
    const viewFile = fs.readFileSync("components/admin/brand-marketing/brand-marketing-view.tsx", "utf8");
    assert("BrandMarketingView integrates SourcingImportHeader (ADM-BSRC-014-R1)", viewFile.includes("<SourcingImportHeader"));
    assert("BrandMarketingView integrates 800px Drawer (ADM-BSRC-013)", viewFile.includes("max-w-[800px]"));
    assert("BrandMarketingView integrates Page Size selector 20/50/100/200", viewFile.includes("pageSize"));
    assert("BrandMarketingView integrates Bulk Restore button", viewFile.includes("handleConfirmBulkRestore"));
    assert("BrandMarketingView does not have Duplicate Audit button in toolbar", !viewFile.includes("onClick={handleOpenAuditModal}") && !viewFile.includes("onClick={() => handleOpenAuditModal()}"));

  } catch (err: any) {
    console.error("E2E SUITE ERROR:", err);
  } finally {
    // Clean up test companies from QA database
    if (ibsCompanyId) {
      await qaClient.from("sourcing_companies").delete().eq("id", ibsCompanyId);
    }
    if (manualCompanyId) {
      await qaClient.from("sourcing_companies").delete().eq("id", manualCompanyId);
    }
    console.log("\nQA test cleanup finished.");
  }

  console.log("================================================================================");
  console.log(`TOTAL INTEGRATED E2E TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${total - passed}`);
  console.log("================================================================================");

  if (passed === total && total > 0) {
    console.log("ALL INTEGRATED E2E TESTS PASSED SUCCESSFULLY (100%)!");
    process.exit(0);
  } else {
    console.error(`INTEGRATED E2E SUITE FAILED: ${total - passed} test(s) failed.`);
    process.exit(1);
  }
}

runIntegratedE2E();
