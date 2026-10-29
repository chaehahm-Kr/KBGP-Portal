/**
 * Brand Sourcing & Marketing Domain Types
 * ADM-BSRC-001 & ADM-BSRC-002: Normalized Company Draft Contract
 *
 * This contract is intentionally decoupled from database implementations (Phase 1 / ADM-BSRC-003)
 * and UI view components (Phase 1 / ADM-BSRC-004).
 */

export type SourcingProvider = "INTERCHARM" | "COSMOPROF" | "INDIE_BEAUTY_SHOW" | "MANUAL" | "OTHER";

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

/**
 * ADM-BSRC-011: Compact display labels for Brand List
 */
export const COMPANY_TYPE_SHORT_LABELS: Record<BusinessType, string> = {
  BRAND_OWNER: "브랜드",
  OEM_ODM: "OEM",
  MANUFACTURER: "제조사",
  DISTRIBUTOR: "유통사",
  IMPORTER_EXPORTER: "수출입",
  OTHER: "기타",
};

/**
 * ADM-BSRC-011: Primary Product Category (주력 상품 분야)
 * Six authoritative specialization classifications.
 */
export type PrimaryProductCategory =
  | "SKINCARE"
  | "HAIRCARE"
  | "MAKEUP"
  | "BODYCARE"
  | "PERSONAL_CARE"
  | "BEAUTY_TOOLS";

export interface PrimaryProductCategoryOption {
  value: PrimaryProductCategory;
  labelKr: string;
  labelEn: string;
}

export const PRIMARY_PRODUCT_CATEGORY_OPTIONS: PrimaryProductCategoryOption[] = [
  { value: "SKINCARE", labelKr: "스킨케어", labelEn: "Skincare" },
  { value: "HAIRCARE", labelKr: "헤어케어", labelEn: "Haircare" },
  { value: "MAKEUP", labelKr: "메이크업", labelEn: "Makeup" },
  { value: "BODYCARE", labelKr: "바디케어", labelEn: "Bodycare" },
  { value: "PERSONAL_CARE", labelKr: "퍼스널케어", labelEn: "Personal Care" },
  { value: "BEAUTY_TOOLS", labelKr: "뷰티툴", labelEn: "Beauty Tools" },
];

export type ClassificationStatus = "VERIFIED" | "DEFAULT_UNVERIFIED" | "ADMIN_EDIT";

export interface BusinessTypeEvidence {
  type: BusinessType;
  text: string;
  sourceUrl?: string | null;
  sourceMethod?: string;
  source: FieldOrigin;
  status?: ClassificationStatus;
}

export type SourcingDocumentType =
  | "BROCHURE"
  | "CATALOG"
  | "CERTIFICATE"
  | "COMPANY_PROFILE"
  | "SPEC_SHEET"
  | "OTHER";

export interface SourcingDocumentItem {
  id: string;
  title: string;
  fileUrl: string;
  fileType: SourcingDocumentType;
  fileSize?: number | null;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
  source: FieldOrigin;
  sourceUrl?: string | null;
  uploadedAt?: string;
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
  id?: string;
  nameKr: string;
  nameEn: string | null;
  description: string | null;
  categories: string[];
  keyProducts: SourcingProductItem[];
  source: FieldOrigin;
}

export interface SourcingContact {
  id?: string;
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
    primaryProductCategories?: PrimaryProductCategory[];
    primaryCategoriesConfirmed?: boolean;
    representativeName: string | null; // CEO name from enrichment
    businessRegistrationNumber: string | null; // e.g. 123-45-67890
    telephone?: string | null;
  };
  brands: SourcingBrand[];
  contacts: SourcingContact[];
  websites: SourcingWebsite[];
  socialMedia: SourcingSocialMedia[];
  categories: string[]; // Deduplicated list of product categories
  companyProducts?: SourcingProductItem[]; // Extracted company-level products
  companyDocuments?: SourcingDocumentItem[]; // Extracted exhibitor documents & brochures
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
  businessTypeEvidence?: BusinessTypeEvidence[];
  companyTypeOtherExplanation?: string | null;
  primaryProductCategories?: PrimaryProductCategory[];
  primaryCategoriesConfirmed?: boolean;
  categories?: string[];
  documents?: SourcingDocumentItem[];
  assignedTo?: string | null;
  internalNotes?: string | null;
  marketingConsentStatus?: "UNCONFIRMED" | "CONSENTED" | "REFUSED" | "EXCLUDED";
}

export type DuplicateMatchType =
  | "COMPANY_NAME"
  | "COMPANY_NAME_KR"
  | "COMPANY_NAME_EN"
  | "BRAND_NAME"
  | "EMAIL"
  | "SOURCE_URL"
  | "SOURCE_IDENTIFIER"
  | "DOMAIN"
  | "SIMILAR_NAME";

export type DuplicateSeverity = "STRONG" | "POSSIBLE";

export interface DuplicateMatchItem {
  matchType: DuplicateMatchType;
  severity: DuplicateSeverity;
  matchedField?: "회사명" | "브랜드명" | "담당자 이메일";
  matchedValue: string;
  entityType: "SOURCING_CANDIDATE" | "PARTNER_COMPANY";
  entityId: string;
  entityName: string;
  entityNameEn?: string | null;
  reason: string;
  sourceUrl?: string | null;
  status?: string;
  grade?: string;
  contactsCount?: number;
  brandsCount?: number;
  lastActivityDate?: string | null;
  primaryProductCategories?: PrimaryProductCategory[];
  primaryCategoriesConfirmed?: boolean;
}

export interface SourceConflictInfo {
  hasConflict: boolean;
  existingCompanyId: string;
  existingCompanyName: string;
  sourceUrl: string;
  canonicalSourceUrl?: string;
  reason: string;
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  hasStrongDuplicate: boolean;
  hasPossibleDuplicate: boolean;
  isExistingPartner: boolean;
  matches: DuplicateMatchItem[];
  sourceConflict?: SourceConflictInfo | null;
}

export interface DuplicateCheckCriteria {
  sourceUrl?: string | null;
  canonicalSourceUrl?: string | null;
  sourceIdentifier?: string | null;
  companyNameKr?: string | null;
  companyNameEn?: string | null;
  websiteUrl?: string | null;
  domains?: string[];
  emails?: string[];
  brands?: Array<{ nameKr?: string | null; nameEn?: string | null }>;
}

export interface SaveSourcingOptions {
  allowDuplicateConfirmed?: boolean;
  matchedCompanyIds?: string[];
  matchedFields?: string[];
  exception?: AdminDuplicateExceptionInput;
  adminUserId?: string | null;
}

export interface AdminDuplicateExceptionInput {
  matchedCompanyId: string;
  matchedRule: "SAME_NAME_KR" | "SAME_NAME_EN" | "SAME_DOMAIN" | "SIMILAR_NAME" | "OTHER";
  reason: string;
  evidence: {
    businessRegistrationNumber?: string | null;
    address?: string | null;
    officialWebsite?: string | null;
    legalEntityDetails?: string | null;
    otherNotes?: string | null;
  };
}

export interface LinkSourceResult {
  success: boolean;
  companyId: string;
  companyNameKr: string;
  sourcesAdded: number;
  brandsAdded: number;
  contactsAdded: number;
  websitesAdded: number;
  message: string;
}

export interface DuplicateAuditReport {
  generatedAt: string;
  totalCompanies: number;
  totalSources: number;
  totalWebsites: number;
  confirmedDuplicateUrlGroups: Array<{
    canonicalUrl: string;
    companyIds: string[];
    companyNames: string[];
  }>;
  potentialDuplicateCompanyGroups: Array<{
    normalizedName: string;
    companies: Array<{
      id: string;
      nameKr: string;
      nameEn?: string | null;
      status: string;
      grade: string;
      createdAt: string;
      sourcesCount: number;
      contactsCount: number;
      brandsCount: number;
      campaignsCount: number;
      activitiesCount: number;
    }>;
  }>;
  duplicateDomainGroups: Array<{
    domain: string;
    companies: Array<{ id: string; nameKr: string }>;
  }>;
  remediationRecommendation: string;
}

