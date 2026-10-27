/**
 * Brand Sourcing & Marketing Domain Types
 * ADM-BSRC-001 & ADM-BSRC-002: Normalized Company Draft Contract
 *
 * This contract is intentionally decoupled from database implementations (Phase 1 / ADM-BSRC-003)
 * and UI view components (Phase 1 / ADM-BSRC-004).
 */

export type SourcingProvider = "INTERCHARM" | "COSMOPROF" | "MANUAL" | "OTHER";

export type FieldOrigin =
  | "SOURCE_EXHIBITION"
  | "OFFICIAL_WEBSITE"
  | "INFERRED"
  | "MANUAL";

export type BusinessType =
  | "BRAND_OWNER"
  | "MANUFACTURER"
  | "DISTRIBUTOR"
  | "IMPORTER_EXPORTER"
  | "OEM_ODM"
  | "OTHER";

export const COMPANY_TYPE_OPTIONS: Array<{ value: BusinessType; labelKr: string; labelEn: string }> = [
  { value: "BRAND_OWNER", labelKr: "브랜드 보유사", labelEn: "Brand Owner" },
  { value: "MANUFACTURER", labelKr: "제조사", labelEn: "Manufacturer" },
  { value: "DISTRIBUTOR", labelKr: "유통사", labelEn: "Distributor" },
  { value: "IMPORTER_EXPORTER", labelKr: "수출입업체", labelEn: "Importer / Exporter" },
  { value: "OEM_ODM", labelKr: "위탁생산 / 개발생산", labelEn: "OEM / ODM" },
  { value: "OTHER", labelKr: "기타", labelEn: "Other" },
];

export interface BusinessTypeEvidence {
  type: BusinessType;
  text: string;
  source: FieldOrigin;
}

export interface SourcingAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  stateProvince: string | null;
  postcode: string | null;
  country: string | null;
  countryCode: string | null;
  formattedKr: string | null;
  formattedEn: string | null;
}

export interface SourcingProductItem {
  id?: string;
  titleKr: string | null;
  titleEn: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface SourcingBrand {
  nameKr: string;
  nameEn: string | null;
  description: string | null;
  categories: string[];
  keyProducts: SourcingProductItem[];
  source: FieldOrigin;
}

export interface SourcingContact {
  name: string | null;
  department: string | null;
  jobTitle: string | null;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  source: FieldOrigin;
  sourceUrl: string | null;
}

export interface SourcingWebsite {
  url: string;
  label: "OFFICIAL" | "BRAND" | "SHOP" | "OTHER";
  source: FieldOrigin;
}

export interface SourcingSocialMedia {
  platform: "INSTAGRAM" | "YOUTUBE" | "FACEBOOK" | "TWITTER" | "LINKEDIN" | "OTHER";
  url: string;
}

export interface SourcingSourceMetadata {
  provider: SourcingProvider;
  sourceUrl: string;
  sourceIdentifier: string; // e.g. org-ec0b85bc-960d-49d4-9dca-146c10ae59cb
  collectedAt: string; // ISO 8601 string
  eventEditionId: string | null;
  standLocation: string | null;
  rawPayloadSnapshot?: unknown;
}

export interface SourcingEnrichmentSummary {
  attempted: boolean;
  success: boolean;
  enrichedUrl: string | null;
  enrichedPages: string[];
  error?: string;
}

export interface SourcingAuditSummary {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  missingKeyFields: string[]; // e.g. ['contactEmail', 'website']
  notes: string[];
}

export interface NormalizedCompanyDraft {
  company: {
    nameKr: string;
    nameEn: string | null;
    descriptionKr: string | null;
    descriptionEn: string | null;
    address: SourcingAddress;
    businessTypes: BusinessType[];
    businessTypeEvidence: BusinessTypeEvidence[];
    representativeName: string | null; // CEO name from enrichment
    businessRegistrationNumber: string | null; // e.g. 123-45-67890
  };
  brands: SourcingBrand[];
  contacts: SourcingContact[];
  websites: SourcingWebsite[];
  socialMedia: SourcingSocialMedia[];
  categories: string[]; // Deduplicated list of product categories
  companyProducts?: SourcingProductItem[]; // Extracted company-level products
  source: SourcingSourceMetadata;
  enrichment: SourcingEnrichmentSummary;
  audit: SourcingAuditSummary;
}

export interface ExtractionOptions {
  enrichWebsite?: boolean; // Default true
  timeoutMs?: number; // Default 10000ms
  customFetch?: typeof fetch;
}

export interface SourcingEvaluationInput {
  grade?: "A" | "B" | "C" | "UNRATED";
  status?: "DRAFT" | "REVIEWED" | "SAVED" | "ARCHIVED";
  businessTypes?: BusinessType[];
  companyTypeOtherExplanation?: string | null;
  categories?: string[];
  assignedTo?: string | null;
  internalNotes?: string | null;
  marketingConsentStatus?: "UNCONFIRMED" | "CONSENTED" | "REFUSED" | "EXCLUDED";
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  isExistingPartner: boolean;
  matches: Array<{
    matchType: "SOURCE_IDENTIFIER" | "COMPANY_NAME" | "DOMAIN" | "EMAIL";
    matchedValue: string;
    entityType: "SOURCING_CANDIDATE" | "PARTNER_COMPANY";
    entityId: string;
    entityName: string;
  }>;
}

export interface DuplicateCheckCriteria {
  sourceIdentifier?: string | null;
  companyNameKr?: string | null;
  companyNameEn?: string | null;
  websiteUrl?: string | null;
  domains?: string[];
  emails?: string[];
}

