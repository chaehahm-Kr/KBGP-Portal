import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractSourcingDraft,
  validateSafeExternalUrl,
  validateIntercharmUrl,
  isPrivateOrReservedHost,
  resolveSourceAdapter,
  InvalidSourceUrlError,
  SsrFProtectionError,
  AdapterNotFoundError,
  SourceExtractionError,
} from "../../lib/brand-sourcing";

// Mock GraphQL Responses for the 4 Reference Companies
const MOCK_JCOMO_GRAPHQL = {
  data: {
    exhibitingOrganisation: {
      id: "exh-c1e69f1b-5a77-4512-a2f4-b1881d50b9df",
      companyName: "(주)제이코모",
      contactEmail: "benetus@jcomo.co.kr",
      website: "https://www.benetus.co.kr/",
      phone: "031-8016-8995",
      hideAddress: false,
      organisationId: "org-ec0b85bc-960d-49d4-9dca-146c10ae59cb",
      socialMedia: [
        { name: "INSTAGRAM", url: "https://www.instagram.com/benetus_official/" },
        { name: "YOUTUBE", url: "https://www.youtube.com/@benetus_official" },
      ],
      multilingual: [
        {
          locale: "ko-kr",
          displayName: "(주)제이코모",
          description:
            "㈜제이코모는 스킨케어 브랜드 ‘베네투스’를 운영하는 화장품 기업입니다. 미국 MoCRA, 유럽 CPNP 등록 완료.",
          representedBrands: [{ name: "베네투스" }],
          addressLine1: "금토로 40번길 30 (금토동) 5층",
          city: "성남시 수정구",
          stateProvince: "경기도",
          postcode: "13453",
          country: "한국",
          countryCode: "KR",
        },
        {
          locale: "en-us",
          displayName: "Jcomo Inc.",
          description: "Jcomo Inc. is a Korean company that operates the skincare brand Benetus.",
          representedBrands: [{ name: "benetus" }],
          addressLine1: "30, Geumto-ro 40beon-gil",
          city: "Seongnam-si",
          stateProvince: "Gyeonggi-do",
          postcode: "13453",
          country: "South Korea",
          countryCode: "KR",
        },
      ],
      products: [
        {
          id: "prod-1",
          imageUrl: "https://img.reedexpo.com/sunscreen.jpg",
          multilingual: [
            { locale: "ko-kr", title: "투인원 멀티썬", description: "SPF50+ PA++++ 선크림" },
            { locale: "en-us", title: "Two In One Multi Sunscreen", description: "Sunscreen" },
          ],
        },
        {
          id: "prod-2",
          imageUrl: null,
          multilingual: [
            { locale: "ko-kr", title: "아크니옴 더마 모이스처 크림", description: "수분 진정 크림" },
            { locale: "en-us", title: "Acniome Derma Moisture Cream", description: "Moisture Cream" },
          ],
        },
        {
          id: "prod-3",
          imageUrl: null,
          multilingual: [
            { locale: "ko-kr", title: "락토 클렌저", description: "약산성 클렌저" },
            { locale: "en-us", title: "Lacto Cleanser", description: "Gentle Cleanser" },
          ],
        },
      ],
      filterCategories: [
        {
          multilingual: [{ locale: "ko-kr", name: "상품 카테고리" }, { locale: "en-us", name: "Category" }],
          responses: [
            { answerId: "cat-1", multilingual: [{ locale: "ko-kr", name: "Skin Care" }] },
            { answerId: "cat-2", multilingual: [{ locale: "ko-kr", name: "Cleansing Products" }] },
          ],
        },
      ],
      stands: [{ name: "A-R09" }],
    },
  },
};

const MOCK_JDBIO_GRAPHQL = {
  data: {
    exhibitingOrganisation: {
      id: "exh-jdbio-1",
      companyName: "(주)제이디바이오",
      contactEmail: "jdbio@jdbio.com",
      website: "http://www.jdbio.com",
      phone: "1588-4137",
      hideAddress: false,
      organisationId: "org-a2d35424-a9e1-41c1-b77a-88e839ae0b0f",
      socialMedia: [{ name: "YOUTUBE", url: "https://youtube.com/@JDBIO" }],
      multilingual: [
        {
          locale: "ko-kr",
          displayName: "㈜제이디바이오",
          description: "글로벌 메디컬 에스테틱 전문 제조기업",
          representedBrands: [],
          addressLine1: "경기 성남시 분당구 판교역로 231 803호",
          postcode: "13494",
        },
        {
          locale: "en-us",
          displayName: "JDBIO CO., LTD.",
          description: "Advanced biotechnology medical aesthetics manufacturer and brand owner.",
          representedBrands: [{ name: "RICHESSE™, DEMEI™, JADE™, ONE, TEOFIL" }],
          addressLine1: "231, Pangyoyeok-ro, Bundang-gu",
        },
      ],
      products: [
        { id: "p1", multilingual: [{ locale: "en-us", title: "RICHESSE" }] },
        { id: "p2", multilingual: [{ locale: "en-us", title: "OneTox®" }] },
        { id: "p3", multilingual: [{ locale: "en-us", title: "Red Tox®" }] },
        { id: "p4", multilingual: [{ locale: "en-us", title: "RICHESSE™ TX" }] },
      ],
      filterCategories: [
        {
          responses: [
            { answerId: "c1", multilingual: [{ locale: "ko-kr", name: "Skin Care" }] },
            { answerId: "c2", multilingual: [{ locale: "ko-kr", name: "Facial Masks" }] },
            { answerId: "c3", multilingual: [{ locale: "ko-kr", name: "Cleansing Products" }] },
            { answerId: "c4", multilingual: [{ locale: "ko-kr", name: "Thread Lifts and Fillers" }] },
          ],
        },
      ],
      stands: [{ name: "L-D02" }],
    },
  },
};

const MOCK_LEBELAGE_GRAPHQL = {
  data: {
    exhibitingOrganisation: {
      id: "exh-lebelage-1",
      companyName: "주식회사 동동구리무",
      contactEmail: "lebelage@lebelage.co.kr",
      website: "https://lebelage.co.kr/",
      phone: "+82-2-542-3292",
      hideAddress: false,
      organisationId: "org-18c803be-34f2-4461-bc72-fa5ec798209b",
      multilingual: [
        {
          locale: "ko-kr",
          displayName: "르베라쥬",
          description: null,
          representedBrands: [],
          addressLine1: "강서구 국회대로7길 171 102호",
        },
        {
          locale: "en-us",
          displayName: "LEBELAGE",
          description: "DONGDONGGURIMOO CO., LTD is actively exporting its cosmetic brands, LEBELAGE and HEEYUL.",
          representedBrands: [{ name: "LEBELAGE" }],
        },
      ],
      products: [],
      filterCategories: [],
      stands: [{ name: "A-D21" }],
    },
  },
};

const MOCK_BEAUGANIC_GRAPHQL = {
  data: {
    exhibitingOrganisation: {
      id: "exh-beauganic-1",
      companyName: "(주)동방비앤에이치",
      contactEmail: "james@dongbangbnh.co",
      website: "http://www.dongbangbnh.com",
      phone: "+82-70-4420-6322",
      hideAddress: false,
      organisationId: "org-d14d1a34-e041-400d-9488-88121361b460",
      multilingual: [
        {
          locale: "ko-kr",
          displayName: "뷰가닉",
          description:
            "동방비앤에이치는 1986년 창업 이후 약 40년간 비누 및 고형 화장품 제조에 전념해온 제로플라스틱 바 제품 전문 제조기업입니다. 뷰가닉 샴푸바를 중심으로 바쓰바, 설거지바, 세탁바 등 친환경 고체형 제품을 자체 생산하며 OEM/ODM 사업도 함께 운영하고 있습니다.",
          representedBrands: [{ name: "뷰가닉 BEAUGANIC" }],
          addressLine1: "경기도 화성시 장안면 장안로 480-100",
        },
      ],
      products: [
        {
          id: "p-shampoo",
          multilingual: [{ locale: "ko-kr", title: "뷰가닉 제로플라스틱 샴푸바" }],
        },
      ],
      filterCategories: [
        {
          responses: [
            { answerId: "c-hair", multilingual: [{ locale: "ko-kr", name: "Hair Care Products" }] },
          ],
        },
      ],
      stands: [{ name: "A-N01" }],
    },
  },
};

const MOCK_BENETUS_HOMEPAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Benetus Official</title></head>
<body>
  <div>Welcome to Benetus</div>
  <footer>
    <p>상호: (주)제이코모 | 대표: 윤정용 | 사업자등록번호: 666-88-01277</p>
    <p>고객센터: 031-8016-8995 | 이메일: benetus@naver.com</p>
  </footer>
</body>
</html>
`;

describe("Brand Sourcing — InterCHARM Source Adapter (ADM-BSRC-002)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Security & SSRF Protection", () => {
    it("should correctly identify private and loopback addresses", () => {
      expect(isPrivateOrReservedHost("localhost")).toBe(true);
      expect(isPrivateOrReservedHost("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("172.16.0.5")).toBe(true);
      expect(isPrivateOrReservedHost("192.168.1.100")).toBe(true);
      expect(isPrivateOrReservedHost("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedHost("metadata.google.internal")).toBe(true);
      expect(isPrivateOrReservedHost("intercharmkorea.com")).toBe(false);
      expect(isPrivateOrReservedHost("benetus.co.kr")).toBe(false);
    });

    it("should reject non-HTTP protocols and private hosts in validateSafeExternalUrl", () => {
      expect(() => validateSafeExternalUrl("file:///etc/passwd")).toThrow(InvalidSourceUrlError);
      expect(() => validateSafeExternalUrl("ftp://example.com/file")).toThrow(InvalidSourceUrlError);
      expect(() => validateSafeExternalUrl("http://127.0.0.1/admin")).toThrow(SsrFProtectionError);
      expect(() => validateSafeExternalUrl("http://localhost:3000")).toThrow(SsrFProtectionError);
      expect(() => validateSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toThrow(
        SsrFProtectionError
      );
    });

    it("should enforce InterCHARM domain and org-UUID in validateIntercharmUrl", () => {
      const validUrl =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";
      const result = validateIntercharmUrl(validUrl);
      expect(result.orgId).toBe("org-ec0b85bc-960d-49d4-9dca-146c10ae59cb");

      // Wrong domain
      expect(() =>
        validateIntercharmUrl("https://evil.com/org-ec0b85bc-960d-49d4-9dca-146c10ae59cb")
      ).toThrow(InvalidSourceUrlError);

      // Missing org UUID
      expect(() =>
        validateIntercharmUrl("https://www.intercharmkorea.com/ko-kr/exhibitor_directory/listing.html")
      ).toThrow(InvalidSourceUrlError);
    });

    it("should throw AdapterNotFoundError for non-InterCHARM domains", () => {
      expect(() => resolveSourceAdapter("https://www.cosmoprof.com/exhibitor/123")).toThrow(
        AdapterNotFoundError
      );
    });
  });

  describe("2. Company 1 Validation — 제이코모 (BENETUS)", () => {
    it("should extract normalized company, brands, contacts, products and perform website enrichment", async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.reedexpo.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_JCOMO_GRAPHQL,
          };
        }
        if (url.includes("benetus.co.kr")) {
          return {
            ok: true,
            status: 200,
            text: async () => MOCK_BENETUS_HOMEPAGE_HTML,
          };
        }
        return { ok: false, status: 404 };
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: true,
      });

      // Company info
      expect(draft.company.nameKr).toBe("(주)제이코모");
      expect(draft.company.nameEn).toBe("Jcomo Inc.");
      expect(draft.company.descriptionKr).toContain("스킨케어 브랜드 ‘베네투스’");
      expect(draft.company.representativeName).toBe("윤정용");
      expect(draft.company.businessRegistrationNumber).toBe("666-88-01277");
      expect(draft.company.businessTypes).toContain("BRAND_OWNER");

      // Address
      expect(draft.company.address.line1).toBe("금토로 40번길 30 (금토동) 5층");
      expect(draft.company.address.city).toBe("성남시 수정구");
      expect(draft.company.address.stateProvince).toBe("경기도");
      expect(draft.company.address.postcode).toBe("13453");

      // Contacts
      expect(draft.contacts).toHaveLength(2);
      expect(draft.contacts[0].email).toBe("benetus@jcomo.co.kr");
      expect(draft.contacts[0].isPrimary).toBe(true);
      expect(draft.contacts[0].phone).toBe("031-8016-8995");
      expect(draft.contacts[0].source).toBe("SOURCE_EXHIBITION");

      // Enriched secondary contact
      expect(draft.contacts[1].email).toBe("benetus@naver.com");
      expect(draft.contacts[1].isPrimary).toBe(false);
      expect(draft.contacts[1].source).toBe("OFFICIAL_WEBSITE");

      // Brands & Products
      expect(draft.brands).toHaveLength(1);
      expect(draft.brands[0].nameKr).toBe("베네투스");
      expect(draft.brands[0].keyProducts).toHaveLength(3);
      expect(draft.brands[0].keyProducts[0].titleKr).toBe("투인원 멀티썬");

      // Categories
      expect(draft.categories).toContain("Skin Care");
      expect(draft.categories).toContain("Cleansing Products");

      // Metadata & Audit
      expect(draft.source.standLocation).toBe("A-R09");
      expect(draft.enrichment.success).toBe(true);
      expect(draft.audit.status).toBe("SUCCESS");
    });
  });

  describe("3. Company 2 Validation — 제이디바이오 (JD BIO)", () => {
    it("should extract multiple brands, 4 categories and recognize manufacturer business type", async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.reedexpo.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_JDBIO_GRAPHQL,
          };
        }
        return { ok: false, status: 404 };
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.제이디바이오.org-a2d35424-a9e1-41c1-b77a-88e839ae0b0f.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: false,
      });

      expect(draft.company.nameKr).toBe("(주)제이디바이오");
      expect(draft.company.nameEn).toBe("JDBIO CO., LTD.");
      expect(draft.contacts[0].email).toBe("jdbio@jdbio.com");
      expect(draft.contacts[0].phone).toBe("1588-4137");

      // Multiple represented brands split correctly
      const brandNames = draft.brands.map((b) => b.nameKr);
      expect(brandNames).toContain("RICHESSE™");
      expect(brandNames).toContain("DEMEI™");
      expect(brandNames).toContain("JADE™");
      expect(brandNames).toContain("ONE");
      expect(brandNames).toContain("TEOFIL");

      // 4 Categories
      expect(draft.categories).toHaveLength(4);
      expect(draft.categories).toContain("Skin Care");
      expect(draft.categories).toContain("Facial Masks");
      expect(draft.categories).toContain("Cleansing Products");
      expect(draft.categories).toContain("Thread Lifts and Fillers");

      // Company-level Products (4) and Brand attribution
      expect(draft.companyProducts).toHaveLength(4);
      expect(draft.brands[0].keyProducts).toHaveLength(2); // Attributed RICHESSE products
      expect(draft.brands).toHaveLength(5);

      // Business Type: Manufacturer & Brand Owner
      expect(draft.company.businessTypes).toContain("MANUFACTURER");
      expect(draft.company.businessTypes).toContain("BRAND_OWNER");
    });
  });

  describe("4. Company 3 Validation — 르베라쥬 (LEBELAGE)", () => {
    it("should resolve legal company entity 주식회사 동동구리무 and brand LEBELAGE", async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.reedexpo.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_LEBELAGE_GRAPHQL,
          };
        }
        return { ok: false, status: 404 };
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.르베라쥬.org-18c803be-34f2-4461-bc72-fa5ec798209b.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: false,
      });

      expect(draft.company.nameKr).toBe("주식회사 동동구리무");
      expect(draft.company.nameEn).toBe("LEBELAGE");
      expect(draft.contacts[0].email).toBe("lebelage@lebelage.co.kr");
      expect(draft.contacts[0].phone).toBe("+82-2-542-3292");
      expect(draft.websites[0].url).toBe("https://lebelage.co.kr/");
      expect(draft.brands[0].nameKr).toBe("LEBELAGE");
    });
  });

  describe("5. Company 4 Validation — 뷰가닉 (BEAUGANIC)", () => {
    it("should extract verified email and identify Manufacturer and OEM/ODM business types", async () => {
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.reedexpo.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_BEAUGANIC_GRAPHQL,
          };
        }
        return { ok: false, status: 404 };
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.뷰가닉.org-d14d1a34-e041-400d-9488-88121361b460.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: false,
      });

      expect(draft.company.nameKr).toBe("(주)동방비앤에이치");
      expect(draft.contacts[0].email).toBe("james@dongbangbnh.co");
      expect(draft.contacts[0].phone).toBe("+82-70-4420-6322");
      expect(draft.company.businessTypes).toContain("MANUFACTURER");
      expect(draft.company.businessTypes).toContain("OEM_ODM");
      expect(draft.brands[0].nameKr).toBe("뷰가닉 BEAUGANIC");
      expect(draft.brands[0].keyProducts[0].titleKr).toBe("뷰가닉 제로플라스틱 샴푸바");
    });
  });

  describe("6. Error Handling & Edge Cases", () => {
    it("should throw SourceExtractionError if GraphQL server returns HTTP error", async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";

      await expect(
        extractSourcingDraft(url, { customFetch: customFetch as any })
      ).rejects.toThrow(SourceExtractionError);
    });

    it("should never include organizer footer email in company contacts", async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            exhibitingOrganisation: {
              companyName: "Fake Co",
              contactEmail: "info@intercharmkorea.com", // Organizer footer email
              website: null,
              phone: "02-123-4567",
              organisationId: "org-ec0b85bc-960d-49d4-9dca-146c10ae59cb",
              multilingual: [],
            },
          },
        }),
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: false,
      });

      // Organizer contact should be filtered out
      expect(draft.contacts).toHaveLength(0);
      expect(draft.audit.missingKeyFields).toContain("contactEmail");
      expect(draft.audit.status).toBe("PARTIAL");
    });

    it("should safely intercept and block SSRF redirect attempts during website enrichment", async () => {
      let callCount = 0;
      const customFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("api.reedexpo.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => MOCK_JCOMO_GRAPHQL,
          };
        }
        if (url.includes("benetus.co.kr")) {
          callCount++;
          // Simulate malicious 302 redirect to AWS metadata endpoint
          return {
            status: 302,
            headers: new Headers({
              location: "http://169.254.169.254/latest/meta-data/",
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const url =
        "https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/";

      const draft = await extractSourcingDraft(url, {
        customFetch: customFetch as any,
        enrichWebsite: true,
      });

      // Draft still succeeds from InterCHARM facts, but SSRF redirect is blocked safely
      expect(draft.company.nameKr).toBe("(주)제이코모");
      expect(draft.enrichment.enrichedPages).toHaveLength(0);
      expect(draft.company.representativeName).toBeNull();
    });
  });
});
