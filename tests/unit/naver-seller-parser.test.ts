import { describe, it, expect } from "vitest";
import {
  parseNaverSellerInfo,
  convertNaverSellerInfoToDraft,
  validateNaverStoreUrl,
  normalizeBusinessRegistrationNumber,
  normalizePhoneNumber,
  extractEmail,
  parseKoreanAddress,
} from "../../lib/brand-sourcing/naver-seller-parser";

describe("Naver Smart Store Seller Parser (ADM-BSRC-NAVER-001)", () => {
  const SAMPLE_SELLER_TEXT = `
상호명 주식회사 앨리스루움
대표자 함채형
사업자등록번호 123-45-67890 [사업자정보확인]
통신판매업번호 2024-부산연제-0123
사업장 소재지 부산광역시 연제구 연산동 123-45 (우 : 47306)
고객센터 051-868-1234 잘못된 번호 신고
e-mail alice@wizardjoseon.com (인증)
`;

  const SAMPLE_STORE_URL = "https://smartstore.naver.com/wizardjoseon";

  describe("URL Validation & Brand Slug Extraction", () => {
    it("validates smartstore.naver.com and extracts brand slug", () => {
      const res = validateNaverStoreUrl("https://smartstore.naver.com/wizardjoseon");
      expect(res.isValid).toBe(true);
      expect(res.channelSlug).toBe("wizardjoseon");
      expect(res.inferredBrandName).toBe("WIZARDJOSEON");
    });

    it("validates brand.naver.com and extracts brand slug", () => {
      const res = validateNaverStoreUrl("https://brand.naver.com/innisfree?param=1");
      expect(res.isValid).toBe(true);
      expect(res.channelSlug).toBe("innisfree");
      expect(res.inferredBrandName).toBe("INNISFREE");
    });

    it("handles hyphens and underscores in brand slug", () => {
      const res = validateNaverStoreUrl("https://smartstore.naver.com/wizard-joseon");
      expect(res.isValid).toBe(true);
      expect(res.inferredBrandName).toBe("WIZARD JOSEON");
    });

    it("rejects non-Naver URLs", () => {
      const res = validateNaverStoreUrl("https://coupang.com/vp/products/123");
      expect(res.isValid).toBe(false);
    });
  });

  describe("Field Normalization & Noise Cleaning", () => {
    it("normalizes business registration number to 10 digits", () => {
      expect(normalizeBusinessRegistrationNumber("123-45-67890").normalized).toBe("1234567890");
      expect(normalizeBusinessRegistrationNumber("123 45 67890 [확인]").normalized).toBe("1234567890");
      expect(normalizeBusinessRegistrationNumber("").isValid).toBe(false);
    });

    it("normalizes phone numbers", () => {
      expect(normalizePhoneNumber("051-868-1234 잘못된 번호 신고").normalized).toBe("051-868-1234");
      expect(normalizePhoneNumber("02.1234.5678").normalized).toBe("02-1234-5678");
      expect(normalizePhoneNumber("01012345678").normalized).toBe("010-1234-5678");
      expect(normalizePhoneNumber("+82-2-1234-5678").normalized).toBe("02-1234-5678");
    });

    it("extracts email and strips noise", () => {
      expect(extractEmail("e-mail alice@wizardjoseon.com (인증)").email).toBe("alice@wizardjoseon.com");
      expect(extractEmail("contact_support@domain.co.kr").email).toBe("contact_support@domain.co.kr");
    });

    it("parses Korean address and extracts postal code and city", () => {
      const parsed = parseKoreanAddress("부산광역시 연제구 연산동 123-45 (우 : 47306)");
      expect(parsed.postcode).toBe("47306");
      expect(parsed.city).toBe("연제구");
      expect(parsed.stateProvince).toBe("부산광역시");
      expect(parsed.line1).toContain("연산동 123-45");
    });
  });

  describe("parseNaverSellerInfo Parsing Engine", () => {
    it("parses all seller fields and cleans Korean noise phrases", () => {
      const result = parseNaverSellerInfo(SAMPLE_SELLER_TEXT, SAMPLE_STORE_URL);

      expect(result.missingFields).toHaveLength(0);

      // Legal Company Name vs Store Brand Name strictly decoupled
      expect(result.legalCompanyName).toBe("주식회사 앨리스루움");
      expect(result.inferredBrandName).toBe("WIZARDJOSEON");

      expect(result.representativeName).toBe("함채형");
      expect(result.businessRegistrationNumberFormatted).toBe("123-45-67890");
      expect(result.businessRegistrationNumber).toBe("1234567890");
      expect(result.onlineSalesRegistrationNumber).toBe("2024-부산연제-0123");
      expect(result.phone).toBe("051-868-1234");
      expect(result.email).toBe("alice@wizardjoseon.com");
      expect(result.address.postcode).toBe("47306");
      expect(result.address.city).toBe("연제구");
      expect(result.address.stateProvince).toBe("부산광역시");
      expect(result.address.country).toBe("한국");
    });

    it("handles key:value colon syntax and alternative headers", () => {
      const colonText = `
상호: (주)네오뷰티
대표자명: 홍길동
사업자등록번호: 220-81-12345 (법인 사업자)
통신판매신고: 제 2023-서울서초-0987 호
사업장 소재지: 서울특별시 서초구 반포대로 100, 3층
고객센터: 1588-0000
이메일: support@neobeauty.com
`;
      const result = parseNaverSellerInfo(colonText, "https://smartstore.naver.com/neobeauty_official");

      expect(result.missingFields).toHaveLength(0);
      expect(result.legalCompanyName).toBe("(주)네오뷰티");
      expect(result.inferredBrandName).toBe("NEOBEAUTY OFFICIAL");
      expect(result.representativeName).toBe("홍길동");
      expect(result.businessRegistrationNumberFormatted).toBe("220-81-12345");
      expect(result.businessRegistrationNumber).toBe("2208112345");
      expect(result.email).toBe("support@neobeauty.com");
      expect(result.address.city).toBe("서초구");
      expect(result.address.stateProvince).toBe("서울특별시");
    });

    it("records missing fields when company name is missing", () => {
      const invalidText = `
대표자: 홍길동
고객센터: 02-123-4567
e-mail: test@test.com
`;
      const result = parseNaverSellerInfo(invalidText);
      expect(result.missingFields).toContain("상호명 (Company Name)");
    });
  });

  describe("convertNaverSellerInfoToDraft Draft Conversion", () => {
    it("converts parsed seller info into a valid NormalizedCompanyDraft", () => {
      const parsed = parseNaverSellerInfo(SAMPLE_SELLER_TEXT, SAMPLE_STORE_URL);
      const draft = convertNaverSellerInfoToDraft(parsed);

      // Source specification
      expect(draft.source.provider).toBe("NAVER_SMARTSTORE");
      expect(draft.source.sourceIdentifier).toBe("naver-wizardjoseon");
      expect(draft.source.sourceUrl).toBe(SAMPLE_STORE_URL);

      // Decoupled Company vs Brand
      expect(draft.company.nameKr).toBe("주식회사 앨리스루움");
      expect(draft.company.representativeName).toBe("함채형");
      expect(draft.company.businessRegistrationNumber).toBe("123-45-67890");
      expect(draft.company.telephone).toBe("051-868-1234");
      expect(draft.company.address.city).toBe("연제구");
      expect(draft.company.address.postcode).toBe("47306");

      // Brand Line
      expect(draft.brands).toHaveLength(1);
      expect(draft.brands[0].nameKr).toBe("WIZARDJOSEON");

      // Contact
      expect(draft.contacts).toHaveLength(1);
      expect(draft.contacts[0].email).toBe("alice@wizardjoseon.com");
      expect(draft.contacts[0].name).toBe("함채형");
      expect(draft.contacts[0].phone).toBe("051-868-1234");
      expect(draft.contacts[0].isPrimary).toBe(true);

      // Website
      expect(draft.websites).toHaveLength(1);
      expect(draft.websites[0].url).toBe(SAMPLE_STORE_URL);
      expect(draft.websites[0].label).toBe("SHOP");
    });
  });
});
