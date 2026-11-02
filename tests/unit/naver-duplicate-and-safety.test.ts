import { describe, it, expect, vi } from "vitest";

// Mock server-only before any other imports
vi.mock("server-only", () => ({}));

import { sourceRegistry } from "../../lib/brand-sourcing/source-registry";
import { findDuplicateCandidates } from "../../lib/brand-sourcing/data-access";
import { evaluateCampaignRecipientCandidates } from "../../lib/brand-marketing/campaign-data-access";

describe("Naver Source Adapter & Safety Enforcement (ADM-BSRC-NAVER-001)", () => {
  describe("Source Registry & Adapter Contract", () => {
    it("registers NAVER_SMARTSTORE provider in source registry", () => {
      const def = sourceRegistry.getSourceById("NAVER_SMARTSTORE");
      expect(def).toBeDefined();
      expect(def?.displayName).toContain("Naver Smart Store");
      expect(def?.shortName).toBe("Naver Smart Store");
      expect(def?.sampleUrls).toHaveLength(1);
    });

    it("detects NAVER_SMARTSTORE provider from URL", () => {
      const detected = sourceRegistry.detectSourceByUrl("https://smartstore.naver.com/wizardjoseon");
      expect(detected).toBeDefined();
      expect(detected?.id).toBe("NAVER_SMARTSTORE");

      const brandDetected = sourceRegistry.detectSourceByUrl("https://brand.naver.com/mediheal");
      expect(brandDetected).toBeDefined();
      expect(brandDetected?.id).toBe("NAVER_SMARTSTORE");
    });

    it("rejects automated crawling attempts on Naver Smart Store", async () => {
      const def = sourceRegistry.getSourceById("NAVER_SMARTSTORE");
      const adapter = def!.getAdapter();

      await expect(
        adapter.extract("https://smartstore.naver.com/wizardjoseon")
      ).rejects.toThrow("자동 웹 크롤링이 허용되지 않습니다");
    });
  });

  describe("Duplicate Detection Multi-Vector BRN & Phone Matching", () => {
    it("detects duplicate company by Business Registration Number (Primary Matching Key)", async () => {
      // Mock full Supabase fluent chain
      const createChainable = (resolveData: any) => {
        const obj: any = {};
        const methods = ["select", "not", "in", "ilike", "eq", "neq", "order", "limit", "range"];
        methods.forEach((m) => {
          obj[m] = vi.fn().mockImplementation(() => obj);
        });
        obj.then = (onfulfilled: any) => Promise.resolve({ data: resolveData, error: null }).then(onfulfilled);
        obj.maybeSingle = vi.fn().mockResolvedValue({ data: resolveData?.[0] || null, error: null });
        obj.single = vi.fn().mockResolvedValue({ data: resolveData?.[0] || null, error: null });
        return obj;
      };

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "sourcing_companies") {
            return createChainable([
              {
                id: "comp-existing-123",
                company_name_kr: "주식회사 앨리스루움",
                company_name_en: "Alice Room Co.",
                business_registration_number: "123-45-67890",
                address_city: "부산광역시",
                grade: "B",
                status: "SAVED",
              },
            ]);
          }
          return createChainable([]);
        },
      };

      const result = await findDuplicateCandidates(
        {
          companyNameKr: "새로운 브랜드 법인명",
          businessRegistrationNumber: "1234567890", // Normalized 10 digits
        },
        mockSupabase
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.hasStrongDuplicate).toBe(true);
      const brnMatch = result.matches.find((m) => m.matchType === "BUSINESS_REGISTRATION_NUMBER");
      expect(brnMatch).toBeDefined();
      expect(brnMatch?.matchedField).toBe("사업자등록번호");
      expect(brnMatch?.entityId).toBe("comp-existing-123");
      expect(brnMatch?.severity).toBe("STRONG");
    });
  });

  describe("Marketing Safety Server-Side Enforcement (Section 10)", () => {
    it("strictly excludes Naver Smart Store contacts from marketing outreach", async () => {
      const createChainable = (resolveData: any) => {
        const obj: any = {};
        const methods = ["select", "not", "in", "ilike", "eq", "neq", "order", "limit", "range"];
        methods.forEach((m) => {
          obj[m] = vi.fn().mockImplementation(() => obj);
        });
        obj.then = (onfulfilled: any) => Promise.resolve({ data: resolveData, error: null }).then(onfulfilled);
        obj.maybeSingle = vi.fn().mockResolvedValue({ data: resolveData?.[0] || null, error: null });
        obj.single = vi.fn().mockResolvedValue({ data: resolveData?.[0] || null, error: null });
        return obj;
      };

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === "sourcing_companies") {
            return createChainable([
              {
                id: "naver-comp-1",
                company_name_kr: "주식회사 앨리스루움",
                company_name_en: "Alice Room Co.",
                business_types: ["MANUFACTURER"],
                grade: "B",
                status: "SAVED",
                marketing_consent_status: "UNCONFIRMED",
                raw_payload_snapshot: {
                  provenance: "NAVER_SMARTSTORE_SELLER_INFO",
                  storeUrl: "https://smartstore.naver.com/wizardjoseon",
                },
                sourcing_brands: [{ id: "b1", brand_name_kr: "WIZARD JOSEON", categories: ["스킨케어"] }],
                sourcing_contacts: [
                  {
                    id: "c1",
                    name: "함채형",
                    email: "alice@wizardjoseon.com",
                    is_primary: true,
                    source: "NAVER_SMARTSTORE",
                    source_url: "https://smartstore.naver.com/wizardjoseon",
                  },
                ],
                sourcing_sources: [
                  {
                    id: "s1",
                    provider: "NAVER_SMARTSTORE",
                    source_url: "https://smartstore.naver.com/wizardjoseon",
                    raw_payload: {},
                  },
                ],
              },
            ]);
          }
          if (table === "marketing_suppression_list") {
            return createChainable([]); // Not suppressed
          }
          return createChainable([]);
        },
      };

      const result = await evaluateCampaignRecipientCandidates(
        "test-campaign-id",
        {
          requireConsentedOnly: false, // Even if requireConsentedOnly is false, Naver must be excluded!
          companyIds: ["naver-comp-1"],
        },
        mockSupabase
      );

      expect(result.recipientItems).toHaveLength(1);
      const recipient = result.recipientItems[0];

      // Verifies Marketing Safety: EXCLUDED_UNCONFIRMED_CONSENT
      expect(recipient.sendEligibility).toBe("EXCLUDED_UNCONFIRMED_CONSENT");
      expect(recipient.exclusionReason).toContain("네이버 스마트스토어 출처 판매자 정보");
      expect(result.unconfirmedConsentCount).toBe(1);
    });
  });
});
