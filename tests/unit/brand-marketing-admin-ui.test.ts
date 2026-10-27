/**
 * Brand Marketing Admin UI & Server Actions Test Suite (ADM-BSRC-004)
 * Target QA Environment: elkgizqgksshukxgcndy.supabase.co
 *
 * SCOPE:
 * 1. Pre-check: Isolated QA environment & Production database protection.
 * 2. Extraction Server Action:
 *    - Valid InterCHARM URL -> draft extracted with duplicate detection
 *    - SSRF / invalid URL -> rejected with safe error
 * 3. Duplicate Candidate Protection:
 *    - Multi-vector detection before save
 * 4. Sourcing Candidate Persistence:
 *    - Save candidate to QA DB
 *    - Retrieve candidate details with all relational children
 *    - Update candidate details & evaluation
 *    - Cascade delete candidate
 * 5. Brand List Search, Filtering, and Pagination
 * 6. Active Staff Discovery
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock server-only and next/cache before importing any server modules
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  extractSourcingDraftAction,
  checkDuplicatesAction,
  saveSourcingCandidateAction,
  listSourcingCandidatesAction,
  getSourcingCandidateDetailAction,
  updateSourcingCandidateAction,
  deleteSourcingCandidateAction,
  getActiveStaffMembersAction,
} from "../../lib/brand-sourcing/actions";
import {
  assertQaEnvironmentOrThrow,
  createQaSupabaseClient,
  resolveQaConfig,
} from "../../scripts/qa/qa-guard";
import { NormalizedCompanyDraft } from "../../lib/brand-sourcing";

// Mock auth DAL so server actions run as an authorized Brand staff member in tests
vi.mock("@/lib/auth/dal", () => ({
  verifyAdminSession: vi.fn().mockResolvedValue({
    userId: "00000000-0000-4000-a000-000000000001",
    email: "qa-admin@kselect-test.local",
    role: "admin",
  }),
  getAdminStaffContext: vi.fn().mockResolvedValue({
    session: {
      userId: "00000000-0000-4000-a000-000000000001",
      email: "qa-admin@kselect-test.local",
      role: "admin",
    },
    staffMember: {
      id: "00000000-0000-4000-a000-000000000001",
      name: "QA Admin Staff",
      email: "qa-admin@kselect-test.local",
      status: "active",
      base_role: "admin",
      menu_permissions: { applications: { view: true, create: true, edit: true, delete: true } },
    },
    isSuperAdmin: true,
    canAccessFinance: true,
    canAccessExecutiveKPIs: true,
    canManageStaff: true,
    hasPermission: () => true,
  }),
}));

describe("ADM-BSRC-004: Brand Marketing Admin UI & Server Actions", () => {
  let createdCompanyId: string | null = null;
  const TEST_SOURCE_ID = "org-ui-test-9999-aaaa-bbbb-ccccddddffff";
  const TEST_COMPANY_NAME = "UI검증용바이오코스메틱";

  const SYNTHETIC_DRAFT: NormalizedCompanyDraft = {
    company: {
      nameKr: TEST_COMPANY_NAME,
      nameEn: "UI VERIFIED BIO COSMETICS CO., LTD.",
      descriptionKr: "어드민 UI 및 서버액션 통합 테스트용 제조사.",
      descriptionEn: "Manufacturer for Admin UI integration tests.",
      address: {
        line1: "테헤란로 123",
        line2: "10층",
        city: "강남구",
        stateProvince: "서울특별시",
        postcode: "06234",
        country: "한국",
        countryCode: "KR",
        formattedKr: "서울특별시 강남구 테헤란로 123 10층 (06234)",
        formattedEn: "10F, 123, Teheran-ro, Gangnam-gu, Seoul, 06234",
      },
      businessTypes: ["BRAND_OWNER", "MANUFACTURER"],
      businessTypeEvidence: [
        { type: "MANUFACTURER", text: "Verified manufacturer", source: "SOURCE_EXHIBITION" },
      ],
      representativeName: "박대표",
      businessRegistrationNumber: "111-22-33333",
    },
    brands: [
      {
        nameKr: "더마글로우",
        nameEn: "Derma Glow",
        description: "고기능성 스킨케어 브랜드",
        categories: ["Skin Care", "Derma"],
        keyProducts: [
          {
            id: "p1",
            titleKr: "더마 카밍 세럼",
            titleEn: "Derma Calming Serum",
            description: "진정 세럼",
            imageUrl: "https://example.com/serum.jpg",
          },
        ],
        source: "SOURCE_EXHIBITION",
      },
    ],
    contacts: [
      {
        name: "이지은 팀장",
        department: "해외영업팀",
        jobTitle: "팀장",
        email: "jieun.test@uibiocosmetics.co.kr",
        phone: "010-9876-5432",
        isPrimary: true,
        source: "SOURCE_EXHIBITION",
        sourceUrl: null,
      },
    ],
    websites: [
      {
        url: "https://www.uibiocosmetics.co.kr",
        label: "OFFICIAL",
        source: "SOURCE_EXHIBITION",
      },
    ],
    socialMedia: [],
    categories: ["Skin Care", "Derma"],
    source: {
      provider: "INTERCHARM",
      sourceUrl: "https://intercharm.co.kr/fairDash.do?hl=KOR&dType=A&hl=ENG&fairSeq=75&hl=KOR#none",
      sourceIdentifier: TEST_SOURCE_ID,
      collectedAt: new Date().toISOString(),
      eventEditionId: "75",
      standLocation: "HALL-1-A01",
    },
    enrichment: {
      attempted: false,
      success: false,
      enrichedUrl: null,
      enrichedPages: [],
    },
    audit: {
      status: "SUCCESS",
      missingKeyFields: [],
      notes: ["Automated UI Test Fixture"],
    },
  };

  beforeAll(async () => {
    process.env.ENABLE_QA_ENVIRONMENT = "true";
    // 1. Assert isolated QA environment
    const qaInfo = assertQaEnvironmentOrThrow();
    expect(qaInfo.host).toBe("elkgizqgksshukxgcndy.supabase.co");

    const qaConfig = resolveQaConfig();
    if (qaConfig.QA_SUPABASE_URL) process.env.QA_SUPABASE_URL = qaConfig.QA_SUPABASE_URL;
    if (qaConfig.QA_SUPABASE_SERVICE_ROLE_KEY) process.env.QA_SUPABASE_SERVICE_ROLE_KEY = qaConfig.QA_SUPABASE_SERVICE_ROLE_KEY;
    if (qaConfig.QA_SUPABASE_ANON_KEY) process.env.QA_SUPABASE_ANON_KEY = qaConfig.QA_SUPABASE_ANON_KEY;

    // Clean up any residual test records
    const supabase = createQaSupabaseClient();
    await supabase.from("sourcing_companies").delete().eq("company_name_kr", TEST_COMPANY_NAME);
  });

  afterAll(async () => {
    if (createdCompanyId) {
      const supabase = createQaSupabaseClient();
      await supabase.from("sourcing_companies").delete().eq("id", createdCompanyId);
    }
  });

  // =========================================================================
  // 1. EXTRACTION SERVER ACTION & SSRF GUARD
  // =========================================================================
  describe("1. Extraction Server Action & SSRF Protection", () => {
    it("rejects SSRF and private network URLs safely with error message", async () => {
      const ssrfRes = await extractSourcingDraftAction("http://169.254.169.254/latest/meta-data");
      expect(ssrfRes.success).toBe(false);
      expect(ssrfRes.error).toContain("Blocked request to private or reserved host");

      const localRes = await extractSourcingDraftAction("http://localhost:3000/api");
      expect(localRes.success).toBe(false);
      expect(localRes.error).toContain("Blocked request to private or reserved host");
    });

    it("rejects invalid URL protocols and non-whitelisted domains", async () => {
      const invalidRes = await extractSourcingDraftAction("ftp://unknown-domain.com/page");
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toBeDefined();
    });
  });

  // =========================================================================
  // 2. CANDIDATE PERSISTENCE & EVALUATION (SAVE, GET, UPDATE)
  // =========================================================================
  describe("2. Sourcing Candidate Save, Retrieve & Update", () => {
    it("saves a new sourcing candidate draft with Grade B and SAVED status", async () => {
      const saveRes = await saveSourcingCandidateAction(SYNTHETIC_DRAFT, {
        grade: "B",
        status: "SAVED",
        internalNotes: "Initial QA review notes",
        marketingConsentStatus: "UNCONFIRMED",
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.companyId).toBeDefined();
      createdCompanyId = saveRes.companyId!;
    });

    it("retrieves full candidate details with brands, contacts, websites and source", async () => {
      expect(createdCompanyId).not.toBeNull();

      const detailRes = await getSourcingCandidateDetailAction(createdCompanyId!);
      expect(detailRes.success).toBe(true);
      expect(detailRes.candidate).toBeDefined();

      const c = detailRes.candidate;
      expect(c.company_name_kr).toBe(TEST_COMPANY_NAME);
      expect(c.grade).toBe("B");
      expect(c.status).toBe("SAVED");
      expect(c.marketing_consent_status).toBe("UNCONFIRMED");

      expect(c.sourcing_brands.length).toBe(1);
      expect(c.sourcing_brands[0].brand_name_kr).toBe("더마글로우");

      expect(c.sourcing_contacts.length).toBe(1);
      expect(c.sourcing_contacts[0].email).toBe("jieun.test@uibiocosmetics.co.kr");

      expect(c.sourcing_websites.length).toBe(1);
      expect(c.sourcing_sources.length).toBe(1);
      expect(c.sourcing_sources[0].source_identifier).toBe(TEST_SOURCE_ID);
    });

    it("updates candidate evaluation to Grade A and adds notes", async () => {
      expect(createdCompanyId).not.toBeNull();

      const updatedDraft = {
        ...SYNTHETIC_DRAFT,
        company: {
          ...SYNTHETIC_DRAFT.company,
          descriptionKr: "수정된 상세 설명: 유럽 및 미주 바이어 타겟 고기능성 라인.",
        },
      };

      const updateRes = await updateSourcingCandidateAction(createdCompanyId!, updatedDraft, {
        grade: "A",
        status: "REVIEWED",
        internalNotes: "Upgraded to Grade A after verification",
      });

      expect(updateRes.success).toBe(true);

      const check = await getSourcingCandidateDetailAction(createdCompanyId!);
      expect(check.candidate.grade).toBe("A");
      expect(check.candidate.status).toBe("REVIEWED");
      expect(check.candidate.description_kr).toContain("유럽 및 미주 바이어 타겟");
    });
  });

  // =========================================================================
  // 3. DUPLICATE CANDIDATE DETECTION
  // =========================================================================
  describe("3. Duplicate Candidate Detection", () => {
    it("detects existing candidate by sourceIdentifier and company name", async () => {
      const dupRes = await checkDuplicatesAction({
        sourceIdentifier: TEST_SOURCE_ID,
        companyNameKr: TEST_COMPANY_NAME,
        websiteUrl: "https://www.uibiocosmetics.co.kr",
        emails: ["jieun.test@uibiocosmetics.co.kr"],
      });

      expect(dupRes.success).toBe(true);
      expect(dupRes.duplicateCheck?.isDuplicate).toBe(true);
      expect(dupRes.duplicateCheck?.matches.length).toBeGreaterThanOrEqual(1);

      const matchTypes = dupRes.duplicateCheck?.matches.map((m) => m.matchType) || [];
      expect(matchTypes).toContain("SOURCE_IDENTIFIER");
      expect(matchTypes).toContain("COMPANY_NAME");
    });

    it("returns false for a brand new non-conflicting company", async () => {
      const dupRes = await checkDuplicatesAction({
        sourceIdentifier: "org-completely-new-99999999",
        companyNameKr: "완전신규유일무이기업_98765",
        websiteUrl: "https://www.unique-domain-test-12345.com",
        emails: ["info@unique-domain-test-12345.com"],
      });

      expect(dupRes.success).toBe(true);
      expect(dupRes.duplicateCheck?.isDuplicate).toBe(false);
    });
  });

  // =========================================================================
  // 4. BRAND LIST SEARCH, FILTERING & ACTIVE STAFF
  // =========================================================================
  describe("4. Brand List Search, Filtering & Staff Discovery", () => {
    it("queries brand list with search term matching company name", async () => {
      const listRes = await listSourcingCandidatesAction({
        search: "UI검증용바이오",
        limit: 10,
        offset: 0,
      });

      expect(listRes.success).toBe(true);
      expect(listRes.candidates).toBeDefined();
      expect(listRes.candidates!.length).toBeGreaterThanOrEqual(1);
      expect(listRes.candidates![0].company_name_kr).toBe(TEST_COMPANY_NAME);
    });

    it("filters brand list by Grade A", async () => {
      const listRes = await listSourcingCandidatesAction({
        grade: "A",
        limit: 10,
        offset: 0,
      });

      expect(listRes.success).toBe(true);
      expect(listRes.candidates!.every((c) => c.grade === "A")).toBe(true);
    });

    it("retrieves active staff members list", async () => {
      const staffRes = await getActiveStaffMembersAction();
      expect(staffRes.success).toBe(true);
      expect(staffRes.staff).toBeDefined();
      expect(Array.isArray(staffRes.staff)).toBe(true);
    });
  });

  // =========================================================================
  // 5. CASCADING DELETION
  // =========================================================================
  describe("5. Sourcing Candidate Removal", () => {
    it("deletes sourcing candidate and cascades child records", async () => {
      expect(createdCompanyId).not.toBeNull();

      const delRes = await deleteSourcingCandidateAction(createdCompanyId!);
      expect(delRes.success).toBe(true);

      // Verify deletion from QA DB
      const supabase = createQaSupabaseClient();
      const { data: compCheck } = await supabase
        .from("sourcing_companies")
        .select("id")
        .eq("id", createdCompanyId!)
        .maybeSingle();

      expect(compCheck).toBeNull();

      const { data: brandCheck } = await supabase
        .from("sourcing_brands")
        .select("id")
        .eq("company_id", createdCompanyId!);
      expect(brandCheck?.length).toBe(0);

      createdCompanyId = null; // Cleaned up
    });
  });
});
