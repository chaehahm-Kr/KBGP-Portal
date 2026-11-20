export type AnnouncementCategory =
  | "GENERAL"
  | "IMPORTANT"
  | "COMPLIANCE_REGULATIONS"
  | "US_MARKET_INTELLIGENCE"
  | "PRODUCT_OPERATIONS"
  | "LOGISTICS_FULFILLMENT"
  | "COMPANY_SPECIFIC";

export type AnnouncementPriority = "NORMAL" | "IMPORTANT" | "ACTION_REQUIRED";

export type AudienceMode = "ALL_COMPANIES" | "SELECTED_COMPANIES";

export type PublicationStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ResourceCategory =
  | "FDA_COMPLIANCE"
  | "BRAND_ONBOARDING"
  | "PRODUCT_REGISTRATION"
  | "IMPORT_LOGISTICS"
  | "MARKETING_MARKET"
  | "FORMS_TEMPLATES";

export type ResourceFileType = "PDF" | "XLSX" | "DOCX";
export type ResourceSourceType = "UPLOADED_FILE" | "LINKED_INSIGHT_PDF";
export type ResourceLanguage = "KO" | "EN" | "KO_EN";

export const ANNOUNCEMENT_CATEGORIES: {
  value: AnnouncementCategory;
  labelKo: string;
  labelEn: string;
}[] = [
  { value: "GENERAL", labelKo: "일반 공지", labelEn: "General" },
  { value: "IMPORTANT", labelKo: "중요 공지", labelEn: "Important" },
  {
    value: "COMPLIANCE_REGULATIONS",
    labelKo: "규제·컴플라이언스",
    labelEn: "Compliance & Regulations",
  },
  {
    value: "US_MARKET_INTELLIGENCE",
    labelKo: "미국 시장 인텔리전스",
    labelEn: "U.S. Market Intelligence",
  },
  {
    value: "PRODUCT_OPERATIONS",
    labelKo: "제품·운영 안내",
    labelEn: "Product & Operations",
  },
  {
    value: "LOGISTICS_FULFILLMENT",
    labelKo: "물류·풀필먼트",
    labelEn: "Logistics & Fulfillment",
  },
  {
    value: "COMPANY_SPECIFIC",
    labelKo: "기업 개별 안내",
    labelEn: "Company-Specific",
  },
];

export const ANNOUNCEMENT_PRIORITIES: {
  value: AnnouncementPriority;
  labelKo: string;
  labelEn: string;
}[] = [
  { value: "NORMAL", labelKo: "일반", labelEn: "Normal" },
  { value: "IMPORTANT", labelKo: "중요", labelEn: "Important" },
  { value: "ACTION_REQUIRED", labelKo: "조치 필요", labelEn: "Action Required" },
];

export const RESOURCE_CATEGORIES: {
  value: ResourceCategory;
  labelKo: string;
  labelEn: string;
}[] = [
  { value: "FDA_COMPLIANCE", labelKo: "FDA & 컴플라이언스", labelEn: "FDA & Compliance" },
  { value: "BRAND_ONBOARDING", labelKo: "브랜드 온보딩", labelEn: "Brand Onboarding" },
  { value: "PRODUCT_REGISTRATION", labelKo: "제품 등록", labelEn: "Product Registration" },
  { value: "IMPORT_LOGISTICS", labelKo: "수입·물류", labelEn: "Import & Logistics" },
  {
    value: "MARKETING_MARKET",
    labelKo: "마케팅·시장 자료",
    labelEn: "Marketing & Market Resources",
  },
  { value: "FORMS_TEMPLATES", labelKo: "양식·템플릿", labelEn: "Forms & Templates" },
];

export const RESOURCE_LANGUAGES: {
  value: ResourceLanguage;
  labelKo: string;
  labelEn: string;
}[] = [
  { value: "KO", labelKo: "한국어 (KO)", labelEn: "Korean (KO)" },
  { value: "EN", labelKo: "영어 (EN)", labelEn: "English (EN)" },
  { value: "KO_EN", labelKo: "한/영 병기 (KO/EN)", labelEn: "Bilingual (KO/EN)" },
];

export function getAnnouncementCategoryLabel(
  category: string,
  locale: "ko" | "en" = "ko"
): string {
  const found = ANNOUNCEMENT_CATEGORIES.find((c) => c.value === category);
  if (!found) return category;
  return locale === "en" ? found.labelEn : found.labelKo;
}

export function getAnnouncementPriorityLabel(
  priority: string,
  locale: "ko" | "en" = "ko"
): string {
  const found = ANNOUNCEMENT_PRIORITIES.find((p) => p.value === priority);
  if (!found) return priority;
  return locale === "en" ? found.labelEn : found.labelKo;
}

export function getResourceCategoryLabel(
  category: string,
  locale: "ko" | "en" = "ko"
): string {
  const found = RESOURCE_CATEGORIES.find((c) => c.value === category);
  if (!found) return category;
  return locale === "en" ? found.labelEn : found.labelKo;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isValidAnnouncementCategory(v: unknown): v is AnnouncementCategory {
  return ANNOUNCEMENT_CATEGORIES.some((c) => c.value === v);
}

export function isValidAnnouncementPriority(v: unknown): v is AnnouncementPriority {
  return ANNOUNCEMENT_PRIORITIES.some((p) => p.value === v);
}

export function isValidResourceCategory(v: unknown): v is ResourceCategory {
  return RESOURCE_CATEGORIES.some((c) => c.value === v);
}

export function isValidAudienceMode(v: unknown): v is AudienceMode {
  return v === "ALL_COMPANIES" || v === "SELECTED_COMPANIES";
}

export function isValidPublicationStatus(v: unknown): v is PublicationStatus {
  return v === "DRAFT" || v === "PUBLISHED" || v === "ARCHIVED";
}

export const PUBLIC_WEBSITE_BASE_URL =
  process.env.NEXT_PUBLIC_WEBSITE_URL || "https://www.kselectnetwork.com";

/**
 * Pure server-side audience check helper for announcements & resources.
 */
export function isCompanyAuthorizedForAudience(params: {
  status: string;
  audienceMode: string;
  targetCompanyIds: string[];
  companyId: string;
}): boolean {
  if (params.status !== "PUBLISHED") return false;
  if (params.audienceMode === "ALL_COMPANIES") return true;
  if (params.audienceMode === "SELECTED_COMPANIES") {
    return params.targetCompanyIds.includes(params.companyId);
  }
  return false;
}
