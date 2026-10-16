// lib/inquiry/compliance-prefill.ts
// Helper utilities for ADM-PRODUCT-COMPLIANCE-001-R2: Simple Korean Prefill for Compliance Brand Inquiry

export interface CompliancePrefillData {
  isOpen: boolean;
  companyId: string;
  contactUserId: string;
  category: string;
  priority: string;
  title: string;
  content: string;
  productId?: string;
  productName?: string;
  productSku?: string;
  sectionId?: string;
}

/**
 * Maps compliance section numbers or identifiers to authoritative Korean section labels per Section 3.
 */
export function getComplianceSectionKoreanLabel(sectionKeyOrId?: string | number | null): string {
  if (!sectionKeyOrId) return "컴플라이언스 전반";
  const s = String(sectionKeyOrId).trim().toLowerCase();

  switch (s) {
    case "1":
    case "product_classification":
    case "classification":
      return "제품 분류";

    case "2":
    case "product_labeling":
    case "labeling":
      return "제품 라벨링";

    case "3":
    case "fda_related":
    case "fda":
      return "FDA 관련 정보";

    case "4":
    case "mocra":
      return "MoCRA 관련 정보";

    case "5":
    case "otc_drug_facts":
    case "otc":
      return "OTC / Drug Facts";

    case "6":
    case "certifications_testing":
    case "certifications":
    case "testing":
      return "인증 및 시험 자료";

    case "7":
    case "import_customs":
    case "customs":
    case "import":
      return "수입 및 통관 정보";

    default:
      return "컴플라이언스 전반";
  }
}

/**
 * Generates the Korean title format:
 * [컴플라이언스] {Product Name} — 자료 요청
 */
export function formatComplianceInquiryTitle(productName: string): string {
  return `[컴플라이언스] ${productName || "미확인 제품"} — 자료 요청`;
}

/**
 * Generates the standardized Korean inquiry message body.
 */
export function formatComplianceInquiryContent(params: {
  productName: string;
  sku: string;
  brandName: string;
  complianceSection: string;
}): string {
  return `안녕하세요.

아래 제품의 미국 시장 판매 및 수입 관련
정보를 확인하고자 합니다.

제품명: ${params.productName || "미확인 제품"}
SKU: ${params.sku || "N/A"}
브랜드: ${params.brandName || "미지정 브랜드"}
확인 항목: ${params.complianceSection || "컴플라이언스 전반"}

관련 정보 및 자료를 확인하여
회신 부탁드립니다.

감사합니다.`;
}
