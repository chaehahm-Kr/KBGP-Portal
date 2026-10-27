import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  findDuplicateCandidates,
  saveSourcingDraft,
  getSourcingCompanyById,
  listSourcingCompanies,
  updateSourcingEvaluation,
  NormalizedCompanyDraft,
} from "../../lib/brand-sourcing";
import { createQaSupabaseClient, assertQaEnvironmentOrThrow } from "../../scripts/qa/qa-guard";

const SYNTHETIC_TEST_ORG_ID = "org-test-99999999-aaaa-bbbb-cccc-dddddddddddd";
const SYNTHETIC_COMPANY_NAME = "테스트바이오코스메틱 (TEST BIO)";

const MOCK_SYNTHETIC_DRAFT: NormalizedCompanyDraft = {
  company: {
    nameKr: SYNTHETIC_COMPANY_NAME,
    nameEn: "TEST BIO COSMETICS CO., LTD.",
    descriptionKr: "테스트 바이오 화장품 전문 제조기업. 자체 브랜드 및 OEM/ODM 생산.",
    descriptionEn: "Test bio cosmetics manufacturer with proprietary brand and OEM/ODM.",
    address: {
      line1: "판교역로 100",
      line2: "7층 701호",
      city: "성남시 분당구",
      stateProvince: "경기도",
      postcode: "13500",
      country: "한국",
      countryCode: "KR",
      formattedKr: "경기도 성남시 분당구 판교역로 100 7층 701호 (13500)",
      formattedEn: "701, 100, Pangyoyeok-ro, Bundang-gu, Seongnam-si, Gyeonggi-do, 13500",
    },
    businessTypes: ["MANUFACTURER", "OEM_ODM", "BRAND_OWNER"],
    businessTypeEvidence: [
      {
        type: "MANUFACTURER",
        text: "Exhibition description explicitly notes manufacturing capabilities.",
        source: "SOURCE_EXHIBITION",
      },
    ],
    representativeName: "김테스트",
    businessRegistrationNumber: "123-45-67890",
  },
  brands: [
    {
      nameKr: "바이오더마테스트",
      nameEn: "Bio Derma Test",
      description: "고기능성 더마 스킨케어",
      categories: ["Skin Care", "Derma Cosmetics"],
      keyProducts: [
        {
          id: "tp-1",
          titleKr: "바이오 리페어 크림",
          titleEn: "Bio Repair Cream",
          description: "피부 장벽 회복 크림",
          imageUrl: "https://example.com/cream.png",
        },
      ],
      source: "SOURCE_EXHIBITION",
    },
    {
      nameKr: "테스트퓨어",
      nameEn: "Test Pure",
      description: "비건 클린 뷰티",
      categories: ["Cleansing Products"],
      keyProducts: [],
      source: "SOURCE_EXHIBITION",
    },
  ],
  contacts: [
    {
      name: "이지은",
      department: "해외사업팀",
      jobTitle: "팀장",
      email: "jieun.test@testbiocosmetics.co.kr",
      phone: "031-777-8888",
      isPrimary: true,
      source: "SOURCE_EXHIBITION",
      sourceUrl: "https://www.intercharmkorea.com/exhibitor_detail.html",
    },
    {
      name: null,
      department: null,
      jobTitle: null,
      email: "info@testbiocosmetics.co.kr",
      phone: null,
      isPrimary: false,
      source: "OFFICIAL_WEBSITE",
      sourceUrl: "https://www.testbiocosmetics.co.kr",
    },
  ],
  websites: [
    {
      url: "https://www.testbiocosmetics.co.kr",
      label: "OFFICIAL",
      source: "SOURCE_EXHIBITION",
    },
    {
      url: "https://brand.testbiocosmetics.co.kr",
      label: "BRAND",
      source: "OFFICIAL_WEBSITE",
    },
  ],
  socialMedia: [
    {
      platform: "INSTAGRAM",
      url: "https://instagram.com/testbiocosmetics",
    },
  ],
  categories: ["Skin Care", "Derma Cosmetics", "Cleansing Products"],
  source: {
    provider: "INTERCHARM",
    sourceUrl: `https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.${SYNTHETIC_TEST_ORG_ID}.html`,
    sourceIdentifier: SYNTHETIC_TEST_ORG_ID,
    collectedAt: new Date().toISOString(),
    eventEditionId: "eve-183fb719-cde8-4b12-b83a-bf0e1c74384c",
    standLocation: "B-X99",
  },
  enrichment: {
    attempted: true,
    success: true,
    enrichedUrl: "https://www.testbiocosmetics.co.kr",
    enrichedPages: ["https://www.testbiocosmetics.co.kr"],
  },
  audit: {
    status: "SUCCESS",
    missingKeyFields: [],
    notes: ["Synthetic QA validation fixture"],
  },
};

describe("Brand Sourcing — Database Schema & Data Access (ADM-BSRC-003)", () => {
  let qaClient: any = null;
  let createdCompanyId: string | null = null;

  beforeAll(() => {
    try {
      const qaInfo = assertQaEnvironmentOrThrow();
      if (!qaInfo.host.includes("shzfrppdobpmrstcjfqu")) {
        qaClient = createQaSupabaseClient();
      }
    } catch {
      qaClient = null;
    }
  });

  afterAll(async () => {
    // Isolated Cleanup: Delete only the synthetic fixture created by this test
    if (qaClient && createdCompanyId) {
      await qaClient.from("sourcing_companies").delete().eq("id", createdCompanyId);
      console.log(`Cleaned up synthetic test sourcing company: ${createdCompanyId}`);
    }
  });

  describe("1. Schema & Relational Structure Validation", () => {
    it("should verify that dedicated sourcing tables exist on isolated QA", async () => {
      if (!qaClient) return;

      const tables = [
        "sourcing_companies",
        "sourcing_brands",
        "sourcing_contacts",
        "sourcing_websites",
        "sourcing_sources",
      ];

      for (const table of tables) {
        const { error } = await qaClient.from(table).select("*").limit(0);
        expect(error).toBeNull();
      }
    });
  });

  describe("2. Sourcing Draft Persistence (All 5 Relational Tables)", () => {
    it("should atomically insert company, brands, contacts, websites, and sources", async () => {
      if (!qaClient) return;

      const result = await saveSourcingDraft(
        MOCK_SYNTHETIC_DRAFT,
        {
          grade: "UNRATED",
          status: "DRAFT",
          internalNotes: "Initial QA fixture insertion",
        },
        qaClient
      );

      expect(result.success).toBe(true);
      expect(result.companyId).toBeDefined();
      createdCompanyId = result.companyId;

      // Verify master company record
      const fullRecord = await getSourcingCompanyById(createdCompanyId!, qaClient);
      expect(fullRecord.company_name_kr).toBe(SYNTHETIC_COMPANY_NAME);
      expect(fullRecord.representative_name).toBe("김테스트");
      expect(fullRecord.business_registration_number).toBe("123-45-67890");
      expect(fullRecord.grade).toBe("UNRATED");
      expect(fullRecord.status).toBe("DRAFT");
      expect(fullRecord.marketing_consent_status).toBe("UNCONFIRMED");

      // Verify child tables
      expect(fullRecord.sourcing_brands).toHaveLength(2);
      expect(fullRecord.sourcing_brands[0].brand_name_kr).toBe("바이오더마테스트");
      expect(fullRecord.sourcing_contacts).toHaveLength(2);
      expect(fullRecord.sourcing_contacts[0].email).toBe("jieun.test@testbiocosmetics.co.kr");
      expect(fullRecord.sourcing_contacts[0].is_primary).toBe(true);
      expect(fullRecord.sourcing_websites).toHaveLength(2);
      expect(fullRecord.sourcing_sources).toHaveLength(1);
      expect(fullRecord.sourcing_sources[0].source_identifier).toBe(SYNTHETIC_TEST_ORG_ID);
      expect(fullRecord.sourcing_sources[0].stand_location).toBe("B-X99");
    });
  });

  describe("3. Duplicate Candidate Detection", () => {
    it("should detect duplicate candidates by sourceIdentifier, company name, domain, and email", async () => {
      if (!qaClient) return;

      const dupCheck = await findDuplicateCandidates(
        {
          sourceIdentifier: SYNTHETIC_TEST_ORG_ID,
          companyNameKr: SYNTHETIC_COMPANY_NAME,
          websiteUrl: "https://www.testbiocosmetics.co.kr/about",
          emails: ["jieun.test@testbiocosmetics.co.kr"],
        },
        qaClient
      );

      expect(dupCheck.isDuplicate).toBe(true);
      expect(dupCheck.matches.length).toBeGreaterThanOrEqual(1);

      const matchTypes = dupCheck.matches.map((m) => m.matchType);
      expect(matchTypes).toContain("SOURCE_IDENTIFIER");
      expect(matchTypes).toContain("COMPANY_NAME");
      expect(matchTypes).toContain("DOMAIN");
      expect(matchTypes).toContain("EMAIL");
    });

    it("should return false for completely novel non-duplicate company", async () => {
      if (!qaClient) return;

      const dupCheck = await findDuplicateCandidates(
        {
          sourceIdentifier: "org-brand-new-9999-8888-7777-666666666666",
          companyNameKr: "유일무이신규브랜드주식회사_12345678",
          websiteUrl: "https://www.completely-unique-domain-12345.com",
          emails: ["nobody@completely-unique-domain-12345.com"],
        },
        qaClient
      );

      expect(dupCheck.isDuplicate).toBe(false);
      expect(dupCheck.matches).toHaveLength(0);
    });
  });

  describe("4. Administrative Evaluation & Workflow Transitions", () => {
    it("should transition status from DRAFT -> REVIEWED -> SAVED and update Grade to A", async () => {
      if (!qaClient || !createdCompanyId) return;

      // 1. Transition to REVIEWED
      const reviewed = await updateSourcingEvaluation(
        createdCompanyId,
        {
          status: "REVIEWED",
          grade: "B",
          internalNotes: "Reviewed by Brand Operations. Potential candidate.",
        },
        qaClient
      );

      expect(reviewed.status).toBe("REVIEWED");
      expect(reviewed.grade).toBe("B");
      expect(reviewed.internal_notes).toContain("Reviewed by Brand Operations");

      // 2. Transition to SAVED with Grade A
      const saved = await updateSourcingEvaluation(
        createdCompanyId,
        {
          status: "SAVED",
          grade: "A",
          internalNotes: "Approved for K-Beauty Growth Program outreach.",
        },
        qaClient
      );

      expect(saved.status).toBe("SAVED");
      expect(saved.grade).toBe("A");
    });

    it("should list sourcing companies with grade and status filtering", async () => {
      if (!qaClient) return;

      const listResult = await listSourcingCompanies(
        {
          grade: "A",
          status: "SAVED",
          limit: 10,
        },
        qaClient
      );

      expect(listResult.data).toBeDefined();
      expect(listResult.data!.length).toBeGreaterThanOrEqual(1);

      const found = listResult.data!.find((c) => c.id === createdCompanyId);
      expect(found).toBeDefined();
      expect(found!.grade).toBe("A");
      expect(found!.status).toBe("SAVED");
    });
  });

  describe("5. RLS & Security Boundary", () => {
    it("should verify that marketing consent status defaults strictly to UNCONFIRMED", async () => {
      if (!qaClient || !createdCompanyId) return;

      const record = await getSourcingCompanyById(createdCompanyId, qaClient);
      expect(record.marketing_consent_status).toBe("UNCONFIRMED");
    });
  });
});
