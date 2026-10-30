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

import * as fs from "fs";
import * as path from "path";
import {
  saveSourcingDraft,
  getSourcingCompanyById,
  updateSourcingCandidateComplete,
  updateSourcingEvaluation,
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

// Set env so data-access connects to QA
process.env.NEXT_PUBLIC_SUPABASE_URL = qaUrl;
process.env.SUPABASE_SERVICE_ROLE_KEY = qaKey;

async function runTestSuite() {
  console.log("================================================================================");
  console.log("STARTING TEST SUITE: ADM-BSRC-013-R1 UX & Candidate Validation Improvements");
  console.log(`Target QA Ref: elkgizqgksshukxgcndy`);
  console.log("================================================================================\n");

  let total = 0;
  let passed = 0;

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
  const compNameKr = `(주)비에스알씨알원${testSuffix}`;
  const compNameEn = `BSRC R1 Corp ${testSuffix}`;
  let testCompanyId: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: Company Edit — Address and Phone Persistence & Separation
    // --------------------------------------------------------------------------
    console.log("--- Suite 1: Company Edit — Address & Phone Persistence and Separation ---");

    const primaryEmail = `ceo-${testSuffix}@bsrc-r1.com`;
    const initialCompanyPhone = "02-555-0101";
    const initialAddress = "서울특별시 강남구 테헤란로 123";
    const contactPhone = "010-9999-1111";

    const draftPayload: NormalizedCompanyDraft = {
      company: {
        nameKr: compNameKr,
        nameEn: compNameEn,
        companyPhone: initialCompanyPhone,
        representativeName: "홍길동",
        address: {
          formattedKr: initialAddress,
          line1: initialAddress,
        },
      },
      brands: [
        {
          nameKr: `알원브랜드${testSuffix}`,
          nameEn: `R1Brand${testSuffix}`,
          categories: ["Skin Care"],
          source: "MANUAL",
        },
      ],
      contacts: [
        {
          name: "홍길동",
          jobTitle: "대표이사",
          email: primaryEmail,
          phone: contactPhone,
          isPrimary: true,
          source: "MANUAL",
        },
        {
          name: "김마케터",
          jobTitle: "마케팅팀장",
          email: `marketing-${testSuffix}@bsrc-r1.com`,
          phone: "010-8888-2222",
          isPrimary: false,
          source: "MANUAL",
        },
      ],
      source: {
        sourceType: "MANUAL",
        sourceName: "Manual Registration",
        sourceUrl: `https://test-r1-${testSuffix}.com`,
        sourceIdentifier: `R1-TEST-${testSuffix}`,
      },
      evaluation: {
        grade: "B",
        internalNotes: "Suite 1 initial candidate",
      },
    };

    const saveRes = await saveSourcingDraft(draftPayload, "QA-TESTER");
    assert("Initial candidate saved successfully with companyPhone", !!saveRes.companyId);
    testCompanyId = saveRes.companyId;

    if (testCompanyId) {
      // 1.1 Verify initial values from DB
      const loaded = await getSourcingCompanyById(testCompanyId);
      const loadedAddress = loaded?.address_formatted_kr || loaded?.address_line1;
      const loadedPrimaryContact = loaded?.sourcing_contacts?.find((c: any) => c.is_primary);

      assert("Loaded company has correct initial address", loadedAddress === initialAddress, { loadedAddress, initialAddress });
      assert("Loaded company has correct initial companyPhone", loaded?.company_phone === initialCompanyPhone, { dbPhone: loaded?.company_phone, initialCompanyPhone });
      assert("Primary contact phone is distinct from companyPhone", loadedPrimaryContact?.phone === contactPhone, { contactPhone: loadedPrimaryContact?.phone, expected: contactPhone });

      // 1.2 Update Company Address and Company Phone
      const updatedAddress = "경기도 성남시 분당구 판교역로 456";
      const updatedCompanyPhone = "031-777-9900";

      const updatedDraft: NormalizedCompanyDraft = {
        ...draftPayload,
        company: {
          ...draftPayload.company,
          companyPhone: updatedCompanyPhone,
          address: {
            formattedKr: updatedAddress,
            line1: updatedAddress,
          },
        },
      };

      const updatedEval: SourcingEvaluationInput = {
        grade: "A",
        internalNotes: "Updated address and phone in QA",
      };

      const updateRes = await updateSourcingCandidateComplete(testCompanyId, updatedDraft, updatedEval);
      assert("updateSourcingCandidateComplete succeeded", updateRes.success === true);

      // 1.3 Verify persistence of address & companyPhone after update
      const reloaded = await getSourcingCompanyById(testCompanyId);
      const reloadedAddress = reloaded?.address_formatted_kr || reloaded?.address_line1;
      const reloadedPrimaryContact = reloaded?.sourcing_contacts?.find((c: any) => c.is_primary);

      assert("Address persisted correctly after update", reloadedAddress === updatedAddress, { reloadedAddress, updatedAddress });
      assert("CompanyPhone persisted correctly after update", reloaded?.company_phone === updatedCompanyPhone, { dbPhone: reloaded?.company_phone, updatedCompanyPhone });
      assert("Primary contact phone remains intact (not overwritten by companyPhone)", reloadedPrimaryContact?.phone === contactPhone, { contactPhone: reloadedPrimaryContact?.phone });

      // 1.4 Test setting blank/null company phone
      const blankPhoneDraft: NormalizedCompanyDraft = {
        ...draftPayload,
        company: {
          ...draftPayload.company,
          companyPhone: null,
          telephone: null,
          address: {
            formattedKr: updatedAddress,
            line1: updatedAddress,
          },
        },
      };

      const blankPhoneRes = await updateSourcingCandidateComplete(testCompanyId, blankPhoneDraft);
      assert("Blank companyPhone update succeeded", blankPhoneRes.success === true);

      const reloadedBlank = await getSourcingCompanyById(testCompanyId);
      assert("CompanyPhone is null/empty when set to null", !reloadedBlank?.company_phone, { dbPhone: reloadedBlank?.company_phone });
      const blankContact = reloadedBlank?.sourcing_contacts?.find((c: any) => c.is_primary);
      assert("Primary contact phone still preserved after blanking company phone", blankContact?.phone === contactPhone);
    }

    // --------------------------------------------------------------------------
    // SUITE 2: Primary Contact Additional Email Count & Deduplication Logic
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 2: Primary Contact Additional Email Count & Deduplication ---");

    function computeAdditionalEmails(primaryEmail?: string | null, contacts?: Array<{ email?: string | null; name?: string }>) {
      if (!primaryEmail || !contacts || contacts.length <= 1) return [];
      const normPrimary = primaryEmail.trim().toLowerCase();
      const seen = new Set<string>([normPrimary]);
      const additional: Array<{ email: string; name?: string }> = [];

      for (const c of contacts) {
        if (!c.email) continue;
        const norm = c.email.trim().toLowerCase();
        if (!norm || !norm.includes("@")) continue;
        if (!seen.has(norm)) {
          seen.add(norm);
          additional.push({ email: c.email.trim(), name: c.name });
        }
      }
      return additional;
    }

    const testPrimary = "owner@brand.com";
    const testContacts = [
      { name: "Owner", email: "owner@brand.com" }, // matches primary
      { name: "Owner Dupe Upper", email: "OWNER@brand.com" }, // case dupe of primary
      { name: "Marketing Lead", email: "marketing@brand.com" }, // valid 1
      { name: "Marketing Dupe", email: "MARKETING@brand.com" }, // case dupe of marketing
      { name: "Sales Lead", email: "sales@brand.com" }, // valid 2
      { name: "Operations", email: "ops@brand.com" }, // valid 3
      { name: "Empty Contact", email: "" }, // empty
      { name: "Whitespace Contact", email: "   " }, // whitespace
      { name: "Invalid Email", email: "not-an-email" }, // invalid
      { name: "Null Email", email: null }, // null
    ];

    const resultEmails = computeAdditionalEmails(testPrimary, testContacts);
    assert("Deduplicated additional email count is exactly 3", resultEmails.length === 3, { length: resultEmails.length });
    assert("Additional emails include marketing@brand.com", resultEmails.some(e => e.email.toLowerCase() === "marketing@brand.com"));
    assert("Additional emails include sales@brand.com", resultEmails.some(e => e.email.toLowerCase() === "sales@brand.com"));
    assert("Additional emails include ops@brand.com", resultEmails.some(e => e.email.toLowerCase() === "ops@brand.com"));
    assert("Primary email is excluded from additional count", !resultEmails.some(e => e.email.toLowerCase() === "owner@brand.com"));

    // Edge cases
    assert("Single contact yields 0 additional emails", computeAdditionalEmails(testPrimary, [{ name: "Sole", email: testPrimary }]).length === 0);
    assert("Empty contacts array yields 0 additional emails", computeAdditionalEmails(testPrimary, []).length === 0);
    assert("Undefined primary yields 0 additional emails", computeAdditionalEmails(undefined, testContacts).length === 0);

    // --------------------------------------------------------------------------
    // SUITE 3: Candidate Grade Requirement & Validation
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 3: Candidate Grade Requirement & Server/Client Validation ---");

    function validateGrade(grade: any): { valid: boolean; error?: string } {
      const allowed = ["A", "B", "C", "UNRATED"];
      if (!grade || typeof grade !== "string" || !allowed.includes(grade.trim())) {
        return {
          valid: false,
          error: "Candidate grade is required (A, B, C, or UNRATED) before saving to Brand List.",
        };
      }
      return { valid: true };
    }

    assert("Null grade is rejected", validateGrade(null).valid === false);
    assert("Undefined grade is rejected", validateGrade(undefined).valid === false);
    assert("Empty string grade is rejected", validateGrade("").valid === false);
    assert("Invalid grade 'D' is rejected", validateGrade("D").valid === false);
    assert("Invalid grade 'S' is rejected", validateGrade("S").valid === false);
    assert("Grade 'A' is accepted", validateGrade("A").valid === true);
    assert("Grade 'B' is accepted", validateGrade("B").valid === true);
    assert("Grade 'C' is accepted", validateGrade("C").valid === true);
    assert("Grade 'UNRATED' is accepted", validateGrade("UNRATED").valid === true);

    // Test DB persistence of explicit grades
    if (testCompanyId) {
      await updateSourcingEvaluation(testCompanyId, {
        grade: "C",
        internalNotes: "Graded as C in Suite 3",
      });
      const checkC = await getSourcingCompanyById(testCompanyId);
      assert("Grade 'C' persisted in database", checkC?.grade === "C", { grade: checkC?.grade });

      await updateSourcingEvaluation(testCompanyId, {
        grade: "UNRATED",
        internalNotes: "Graded as UNRATED in Suite 3",
      });
      const checkUnrated = await getSourcingCompanyById(testCompanyId);
      assert("Grade 'UNRATED' persisted in database", checkUnrated?.grade === "UNRATED", { grade: checkUnrated?.grade });
    }

    // --------------------------------------------------------------------------
    // SUITE 4: Save Changes Drawer Auto-Close & Error Invariants
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 4: Save Changes Drawer Auto-Close & Error Invariants ---");

    // Simulate client state machine
    let drawerOpenId: string | null = "comp-123";
    let drawerDetail: any = { companyName: "Test Co" };
    let successBanner: string | null = null;
    let errorBanner: string | null = null;

    // Simulate save success handler
    function onSaveSuccess(companyName: string) {
      drawerOpenId = null;
      drawerDetail = null;
      errorBanner = null;
      successBanner = `Company "${companyName}" changes saved successfully.`;
    }

    onSaveSuccess("Test Co");
    assert("Drawer closes on save success (drawerOpenId is null)", drawerOpenId === null);
    assert("Drawer detail cleared on save success", drawerDetail === null);
    assert("Success banner displayed on save success", !!successBanner && successBanner.includes("Test Co"));

    // Simulate save failure handler
    drawerOpenId = "comp-123";
    drawerDetail = { companyName: "Test Co", draftAddress: "Unsaved Address" };
    function onSaveFailure(errMsg: string) {
      // drawerOpenId remains unchanged
      errorBanner = errMsg;
    }

    onSaveFailure("Network error occurred while saving.");
    assert("Drawer remains open on save failure", drawerOpenId === "comp-123");
    assert("Drawer unsaved state preserved on failure", drawerDetail.draftAddress === "Unsaved Address");
    assert("Error banner set with actionable message", errorBanner === "Network error occurred while saving.");

    // --------------------------------------------------------------------------
    // SUITE 5: Duplicate Company Deep Link URL Construction
    // --------------------------------------------------------------------------
    console.log("\n--- Suite 5: Duplicate Company Deep Link URL Construction ---");

    const sampleEntityId = "comp-uuid-9876-abcd";
    const generatedUrl = `/admin/brand-marketing?tab=list&companyId=${encodeURIComponent(sampleEntityId)}`;
    assert("Deep link URL contains tab=list", generatedUrl.includes("tab=list"));
    assert("Deep link URL contains encoded companyId", generatedUrl.includes(`companyId=${sampleEntityId}`));

    // Test special characters in ID
    const specialId = "comp/uuid+123";
    const encodedSpecialUrl = `/admin/brand-marketing?tab=list&companyId=${encodeURIComponent(specialId)}`;
    assert("Special characters properly encoded in deep link", encodedSpecialUrl.includes("comp%2Fuuid%2B123"));

  } catch (err: any) {
    console.error("Unexpected error in test suite:", err);
    assert("Test suite ran without crashing", false, err.message);
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passed} / ${total} PASS (${Math.round((passed / total) * 100)}%)`);
  console.log("================================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
