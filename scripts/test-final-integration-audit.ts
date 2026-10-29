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
import { IntercharmAdapter } from "../lib/brand-sourcing/adapters/intercharm.adapter";
import { IndieBeautyShowAdapter } from "../lib/brand-sourcing/adapters/indie-beauty-show.adapter";
import { createBlankManualDraft } from "../lib/brand-sourcing/manual-entry";
import {
  saveSourcingDraft,
  getSourcingCompanyById,
  updateSourcingCandidateComplete,
  bulkArchiveSourcingCompanies,
  bulkRestoreSourcingCompanies,
  listSourcingCompanies,
} from "../lib/brand-sourcing/data-access";
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
  console.error("FATAL: QA Database environment not properly configured or attempting to target Production!");
  process.exit(1);
}

const qaClient = createClient(qaUrl, qaKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runAudit() {
  const { runCampaignDryRun } = await import("../lib/brand-marketing/campaign-data-access");
  const { maskEmailAddress } = await import("../lib/notifications/email");

  console.log("================================================================================");
  console.log("FINAL INTEGRATION INTEGRITY AUDIT: ADM-BSRC-013 + ADM-BSRC-014-R1");
  console.log(`Target Database: elkgizqgksshukxgcndy (${qaUrl})`);
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] Test ${total}: ${title}`);
    } else {
      console.error(`  [FAIL] Test ${total}: ${title}${details ? ` -> ${details}` : ""}`);
      throw new Error(`Assertion failed: ${title}`);
    }
  }

  const testSuffix = `audit_${Date.now()}`;
  const createdCompanyIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // PART A: Company with 3 Contacts -> Select ONLY ONE Secondary Contact -> Safe Dry Run
    // --------------------------------------------------------------------------
    console.log("--- PART A: Targeted Contact Selection & Safe Dry Run ---");
    const primaryEmail = `ceo-${testSuffix}@audit-corp.kr`;
    const sec1Email = `marketing-${testSuffix}@audit-corp.kr`;
    const sec2Email = `sales-${testSuffix}@audit-corp.kr`;

    const threeContactDraft: NormalizedCompanyDraft = {
      source: {
        provider: "MANUAL",
        sourceUrl: "",
        sourceIdentifier: `manual-audit-a-${testSuffix}`,
        rawPayloadSnapshot: {},
      },
      company: {
        nameKr: `(주)오딧테스트A_${testSuffix}`,
        nameEn: "Audit Test A Inc.",
        descriptionKr: "3개 연락처 대상 캠페인 타겟팅 테스트",
        descriptionEn: "Testing campaign targeting with 3 contacts",
        businessTypes: ["BRAND_OWNER"],
        primaryProductCategories: ["SKINCARE"],
        primaryCategoriesConfirmed: true,
        representativeName: "홍길동",
        telephone: "02-1234-5678",
        businessRegistrationNumber: null,
        address: {
          line1: "서울 강남구 테헤란로 1",
          line2: null,
          city: "서울",
          stateProvince: "서울특별시",
          postcode: "06123",
          country: "한국",
          countryCode: "KR",
          formattedKr: "서울시 강남구 테헤란로 1",
          formattedEn: "1 Teheran-ro, Gangnam-gu, Seoul",
        },
      },
      brands: [
        {
          nameKr: `오딧브랜드A_${testSuffix}`,
          nameEn: "AuditBrandA",
          description: "스킨케어 라인",
          categories: ["Skincare"],
          keyProducts: ["세럼"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "홍대표",
          email: primaryEmail,
          phone: "010-1111-2222",
          jobTitle: "대표이사",
          department: "임원",
          isPrimary: true,
          source: "MANUAL",
        },
        {
          name: "김마케팅",
          email: sec1Email,
          phone: "010-3333-4444",
          jobTitle: "마케팅팀장",
          department: "마케팅",
          isPrimary: false,
          source: "MANUAL",
        },
        {
          name: "박영업",
          email: sec2Email,
          phone: "010-5555-6666",
          jobTitle: "영업과장",
          department: "국내영업",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      websites: [],
      categories: ["기초화장품"],
      companyProducts: [],
      companyDocuments: [],
      audit: {
        status: "SUCCESS",
        missingKeyFields: [],
        notes: ["Part A test draft"],
      },
    };

    const saveResA = await saveSourcingDraft(threeContactDraft, { grade: "A", marketingConsentStatus: "CONSENTED" }, undefined, qaClient);
    createdCompanyIds.push(saveResA.companyId);

    const savedCompA = await getSourcingCompanyById(saveResA.companyId, qaClient);
    assert("Company A created with 3 contacts", savedCompA.sourcing_contacts?.length === 3);

    const pContact = savedCompA.sourcing_contacts.find((c: any) => c.is_primary);
    const s1Contact = savedCompA.sourcing_contacts.find((c: any) => c.email === sec1Email);
    const s2Contact = savedCompA.sourcing_contacts.find((c: any) => c.email === sec2Email);

    assert("Primary contact exists", Boolean(pContact && pContact.email === primaryEmail));
    assert("Secondary contact 1 exists", Boolean(s1Contact));
    assert("Secondary contact 2 exists", Boolean(s2Contact));

    // Execute Dry Run targeting ONLY secondary contact 1
    const dryRunA = await runCampaignDryRun(
      `camp-audit-a-${testSuffix}`,
      {
        companyIds: [saveResA.companyId],
        contactIds: [s1Contact.id], // Only secondary 1
      },
      qaClient
    );

    assert("Dry Run reports exactly 1 sendable recipient", dryRunA.sendableCount === 1, `Got ${dryRunA.sendableCount}`);
    assert("Dry Run reports 0 excluded recipients", dryRunA.excludedCount === 0);
    assert("Sample preview includes Secondary 1 email (masked)", dryRunA.samplePreviews.some((p) => p.recipientEmail === maskEmailAddress(sec1Email)));
    assert("Sample preview contact name is 김마케팅", dryRunA.samplePreviews[0]?.contactName === "김마케팅");
    assert("Primary contact is excluded (NOT present in dry run)", !dryRunA.samplePreviews.some((p) => p.recipientEmail === maskEmailAddress(primaryEmail)));
    assert("Secondary 2 contact is excluded (NOT present in dry run)", !dryRunA.samplePreviews.some((p) => p.recipientEmail === maskEmailAddress(sec2Email)));

    // Consent check verification: change company consent to REFUSED and require consented
    const { error: updErr } = await qaClient.from("sourcing_companies").update({ marketing_consent_status: "REFUSED" }).eq("id", saveResA.companyId);
    if (updErr) console.error("Update consent error:", updErr);

    const dryRunConsentCheck = await runCampaignDryRun(
      `camp-consent-${testSuffix}`,
      {
        companyIds: [saveResA.companyId],
        contactIds: [s1Contact.id],
        requireConsentedOnly: true,
      },
      qaClient
    );
    assert("Consent filter excludes REFUSED consent company", dryRunConsentCheck.sendableCount === 0);
    assert("REFUSED consent company counted in excludedCount", dryRunConsentCheck.excludedCount === 1);

    // --------------------------------------------------------------------------
    // PART B: Bulk Archive & Restore Integrity
    // --------------------------------------------------------------------------
    console.log("\n--- PART B: Bulk Archive and Restore Data Integrity ---");
    // Create Company B1 & B2
    const draftB1 = createBlankManualDraft();
    draftB1.company.nameKr = `(주)오딧아카이브B1_${testSuffix}`;
    draftB1.contacts = [
      { name: "담당B1", email: `b1-${testSuffix}@test.com`, phone: "010-1111-0001", jobTitle: "팀장", isPrimary: true, source: "MANUAL" },
    ];
    draftB1.brands = [
      { nameKr: `브랜드B1_${testSuffix}`, nameEn: "B1Brand", description: null, categories: [], keyProducts: [], source: "MANUAL" },
    ];

    const draftB2 = createBlankManualDraft();
    draftB2.company.nameKr = `(주)오딧아카이브B2_${testSuffix}`;
    draftB2.contacts = [
      { name: "담당B2", email: `b2-${testSuffix}@test.com`, phone: "010-1111-0002", jobTitle: "이사", isPrimary: true, source: "MANUAL" },
    ];
    draftB2.brands = [
      { nameKr: `브랜드B2_${testSuffix}`, nameEn: "B2Brand", description: null, categories: [], keyProducts: [], source: "MANUAL" },
    ];

    const saveB1 = await saveSourcingDraft(draftB1, { grade: "B" }, undefined, qaClient);
    const saveB2 = await saveSourcingDraft(draftB2, { grade: "B" }, undefined, qaClient);
    createdCompanyIds.push(saveB1.companyId, saveB2.companyId);

    // Archive both
    const archiveRes = await bulkArchiveSourcingCompanies([saveB1.companyId, saveB2.companyId], qaClient);
    assert("bulkArchiveSourcingCompanies succeeded with count 2", archiveRes.success && archiveRes.count === 2);

    // Verify contacts and brands remain intact in DB (no cascade deletion)
    const { data: contactsB1 } = await qaClient.from("sourcing_contacts").select("id").eq("company_id", saveB1.companyId);
    const { data: brandsB1 } = await qaClient.from("sourcing_brands").select("id").eq("company_id", saveB1.companyId);
    assert("Archived Company B1 retains its contacts (zero cascade deletion)", (contactsB1?.length || 0) === 1);
    assert("Archived Company B1 retains its brands (zero cascade deletion)", (brandsB1?.length || 0) === 1);

    // Verify hidden from default active list
    const activeListBeforeRestore = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Archived companies hidden from active Brand List", !activeListBeforeRestore.data.some((c: any) => c.id === saveB1.companyId || c.id === saveB2.companyId));

    // Verify present in ARCHIVED filter
    const archivedList = await listSourcingCompanies({ status: "ARCHIVED", limit: 100 }, qaClient);
    assert("Archived companies appear under ARCHIVED filter", archivedList.data.some((c: any) => c.id === saveB1.companyId) && archivedList.data.some((c: any) => c.id === saveB2.companyId));

    // Restore both
    const restoreRes = await bulkRestoreSourcingCompanies([saveB1.companyId, saveB2.companyId], qaClient);
    assert("bulkRestoreSourcingCompanies succeeded with count 2", restoreRes.success && restoreRes.count === 2);

    // Verify restored companies reappear in active Brand List
    const activeListAfterRestore = await listSourcingCompanies({ limit: 100 }, qaClient);
    assert("Restored Company B1 reappears in active Brand List", activeListAfterRestore.data.some((c: any) => c.id === saveB1.companyId));
    assert("Restored Company B2 reappears in active Brand List", activeListAfterRestore.data.some((c: any) => c.id === saveB2.companyId));

    // --------------------------------------------------------------------------
    // PART C: Manual Entry & Indie Beauty Show Detail Reopen & Contact ID Stability
    // --------------------------------------------------------------------------
    console.log("\n--- PART C: Multi-Source Detail Reopen & ID Stability ---");
    // 1. IBS extraction & save
    const ibsSampleHtml = `
      <table>
        <tr>
          <td><img src="https://sample.cdn/logo.png" /></td>
          <td><span style="font-size: 22px;">언리시아</span></td>
        </tr>
        <tr>
          <td>
            <li>대표자</li><li>사업자등록번호</li><li>주소</li><li>이메일</li><li>홈페이지</li>
          </td>
          <td>
            <li>최은영</li><li>123-45-67890</li><li>서울시 용산구 이태원로 55가길 40, 2층</li><li>sales@unleashia.com</li><li>https://unleashiacosmetics.com</li>
          </td>
        </tr>
      </table>
      <table><tr><td>브랜드소개</td></tr></table>
      <table><tr><td>글리터 전문 비건 뷰티 브랜드 언리시아</td></tr></table>
      <table><tr><td><img src="p1.jpg" /></td><td>글리터 젤</td><td>오로라 샤워</td></tr></table>
      <table><tr><td><img src="p2.jpg" /></td><td>립밤</td><td>글래시 밤</td></tr></table>
    `;

    const ibsAdapter = new IndieBeautyShowAdapter();
    const ibsCandidate = await (ibsAdapter as any).parseHtml(
      ibsSampleHtml,
      "https://indiebeautyshow.com/exhibitor-list2026/?bmode=view&idx=170410507",
      "170410507",
      { enrichWebsite: false }
    );
    assert("IBS adapter extracts company correctly", ibsCandidate.company.nameKr === "언리시아");

    // Add secondary contact to IBS draft
    const ibsDraft: NormalizedCompanyDraft = {
      ...ibsCandidate,
      company: {
        ...ibsCandidate.company,
        nameKr: `(주)언리시아_IBS테스트_${testSuffix}`,
      },
      contacts: [
        ...(ibsCandidate.contacts || []),
        {
          name: "해외영업팀",
          email: `global-${testSuffix}@unleashia.com`,
          phone: "010-8888-7777",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
    };

    const saveIbs = await saveSourcingDraft(ibsDraft, { grade: "A" }, undefined, qaClient);
    createdCompanyIds.push(saveIbs.companyId);

    // Reopen Company Detail
    const reopenedIbs = await getSourcingCompanyById(saveIbs.companyId, qaClient);
    assert("Reopened IBS company has 2 contacts", (reopenedIbs.sourcing_contacts?.length || 0) === 2);
    assert("Reopened IBS company has 1 brand", (reopenedIbs.sourcing_brands?.length || 0) === 1);
    const initialIbsContactIds = reopenedIbs.sourcing_contacts.map((c: any) => c.id).sort();
    const initialIbsBrandId = reopenedIbs.sourcing_brands[0]?.id;

    // Simulate drawer update (change name & grade)
    const updateIbsDraft: NormalizedCompanyDraft = {
      ...ibsDraft,
      company: {
        ...ibsDraft.company,
        nameKr: `(주)언리시아_IBS수정_${testSuffix}`,
      },
      contacts: reopenedIbs.sourcing_contacts.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        department: c.department,
        jobTitle: c.job_title,
        isPrimary: c.is_primary,
        source: c.source,
      })),
      brands: reopenedIbs.sourcing_brands.map((b: any) => ({
        id: b.id,
        nameKr: b.brand_name_kr,
        nameEn: b.brand_name_en,
        categories: b.categories,
        keyProducts: b.key_products,
        source: b.source,
      })),
    };

    await updateSourcingCandidateComplete(saveIbs.companyId, updateIbsDraft, { grade: "A" }, qaClient);

    // Verify contact IDs and brand links remain stable
    const reloadedAfterEdit = await getSourcingCompanyById(saveIbs.companyId, qaClient);
    const postEditContactIds = reloadedAfterEdit.sourcing_contacts.map((c: any) => c.id).sort();
    const postEditBrandId = reloadedAfterEdit.sourcing_brands[0]?.id;

    assert("Contact IDs remain 100% stable after edit", JSON.stringify(initialIbsContactIds) === JSON.stringify(postEditContactIds));
    assert("Brand ID remains 100% stable after edit", initialIbsBrandId === postEditBrandId);

    // --------------------------------------------------------------------------
    // PART D: InterCHARM Backward Compatibility
    // --------------------------------------------------------------------------
    console.log("\n--- PART D: InterCHARM Compatibility Verification ---");
    const intercharmAdapter = new IntercharmAdapter();
    assert("IntercharmAdapter instantiated successfully", Boolean(intercharmAdapter));
    assert("IntercharmAdapter provider is INTERCHARM", intercharmAdapter.provider === "INTERCHARM");

    const intercharmUrl = "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.3%EC%9D%BC%EC%95%A0.org-b4fa5886-d5fd-490e-92bf-0c0b65d0a79e.html";
    assert("IntercharmAdapter canHandle validates Intercharm URL", intercharmAdapter.canHandle(intercharmUrl));

    const mockGqlResponse = {
      data: {
        exhibitingOrganisation: {
          organisationId: "b4fa5886-d5fd-490e-92bf-0c0b65d0a79e",
          companyName: "(주)3일애",
          multilingual: [
            {
              locale: "ko-KR",
              displayName: "3일애",
              description: "3일애 뷰티 브랜드",
              address: {
                line1: "경기도 성남시 분당구 판교로 1",
                city: "성남",
                country: "한국",
                countryCode: "KR",
              },
            },
          ],
          contactEmail: "3days@love.com",
          phone: "031-123-4567",
          website: "https://3dayslove.co.kr",
        },
      },
    };

    const parsedIntercharm = await intercharmAdapter.extract(intercharmUrl, {
      customFetch: async (url: string) => {
        return {
          ok: true,
          json: async () => mockGqlResponse,
        } as any;
      },
    });

    assert("IntercharmAdapter parses Korean company name", parsedIntercharm.company.nameKr === "(주)3일애" || parsedIntercharm.company.nameKr === "3일애");
    assert("IntercharmAdapter extracts primary contact email", parsedIntercharm.contacts.some((c) => c.email === "3days@love.com"));
    assert("IntercharmAdapter provider is INTERCHARM", parsedIntercharm.source.provider === "INTERCHARM");

  } catch (err: any) {
    console.error("AUDIT ERROR:", err);
  } finally {
    // Cleanup created test records
    console.log("\nCleaning up audit test records from QA database...");
    for (const id of createdCompanyIds) {
      await qaClient.from("sourcing_companies").delete().eq("id", id);
    }
    console.log(`Cleaned up ${createdCompanyIds.length} test record(s).`);
  }

  console.log("================================================================================");
  console.log(`FINAL INTEGRATION AUDIT SUMMARY:`);
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${total - passed}`);
  console.log("================================================================================");

  if (passed === total && total > 0) {
    console.log("ALL FINAL AUDIT TESTS PASSED SUCCESSFULLY (100%)!");
    process.exit(0);
  } else {
    console.error(`AUDIT SUITE FAILED: ${total - passed} test(s) failed.`);
    process.exit(1);
  }
}

runAudit();
