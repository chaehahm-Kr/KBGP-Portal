import { NormalizedCompanyDraft } from "./types";

/**
 * Creates a blank NormalizedCompanyDraft for operator manual registration.
 * No exhibition URL or automatic scraping is involved.
 */
export function createBlankManualDraft(): NormalizedCompanyDraft {
  const now = new Date().toISOString();
  const manualId = `manual-${Date.now()}`;

  return {
    company: {
      nameKr: "",
      nameEn: null,
      descriptionKr: null,
      descriptionEn: null,
      address: {
        line1: null,
        line2: null,
        city: null,
        stateProvince: null,
        postcode: null,
        country: "한국",
        countryCode: "KR",
        formattedKr: null,
        formattedEn: null,
      },
      businessTypes: ["BRAND_OWNER"],
      businessTypeEvidence: [
        {
          type: "BRAND_OWNER",
          text: "관리자 직접 등록 (Manual Registration by Operator)",
          source: "MANUAL",
          status: "ADMIN_EDIT",
        },
      ],
      primaryProductCategories: [],
      primaryCategoriesConfirmed: false,
      representativeName: null,
      businessRegistrationNumber: null,
    },
    brands: [
      {
        nameKr: "",
        nameEn: null,
        description: null,
        categories: [],
        keyProducts: [],
        source: "MANUAL",
      },
    ],
    contacts: [
      {
        name: "",
        department: null,
        jobTitle: null,
        email: "",
        phone: null,
        isPrimary: true,
        source: "MANUAL",
        sourceUrl: null,
      },
    ],
    websites: [],
    socialMedia: [],
    categories: [],
    companyProducts: [],
    companyDocuments: [],
    source: {
      provider: "MANUAL",
      sourceUrl: "",
      sourceIdentifier: manualId,
      collectedAt: now,
      eventEditionId: null,
      standLocation: null,
      rawPayloadSnapshot: {
        provenance: "MANUAL_ENTRY",
        createdAt: now,
      },
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
      notes: ["직접 등록된 회사 데이터 (Manual Registration)."],
    },
  };
}
