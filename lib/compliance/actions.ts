"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ComplianceReviewStatus,
  ProductComplianceReviewItem,
  SaveComplianceReviewInput,
} from "./types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SECTIONS = new Set([
  "overall",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "product_classification",
  "product_labeling",
  "fda_related",
  "mocra",
  "otc_drug_facts",
  "certifications_testing",
  "import_customs",
]);

const VALID_STATUSES = new Set<ComplianceReviewStatus>([
  "not_started",
  "in_review",
  "info_requested",
  "needs_followup",
  "completed",
]);

/**
 * Save or update an internal Product Compliance Review record for a specific section.
 *
 * Security & Integrity:
 * 1. Strict server-side Admin session verification (verifyAdminSession).
 * 2. Reviewer attribution strictly derived from authenticated session.userId (never client-supplied).
 * 3. Authoritative anti-cross-product check: related_inquiry_id MUST belong to the specified product.
 * 4. Safe upsert on composite unique key (product_id, section_id).
 * 5. Does NOT mutate product catalog or regulatory fields.
 */
export async function saveProductComplianceReview(
  input: SaveComplianceReviewInput
): Promise<{
  success: boolean;
  review?: ProductComplianceReviewItem;
  error?: string;
}> {
  try {
    // 1. Authenticate Admin Session
    const session = await verifyAdminSession();
    if (!session || session.role !== "admin") {
      return {
        success: false,
        error: "권한 오류: 관리자 권한이 필요합니다.",
      };
    }

    // 2. Validate Product ID
    if (!input.productId || !UUID_REGEX.test(input.productId)) {
      return {
        success: false,
        error: "유효하지 않은 제품 식별자(UUID)입니다.",
      };
    }

    const admin = createAdminClient();

    // Verify target product exists in products table
    const { data: product, error: productErr } = await admin
      .from("products")
      .select("id")
      .eq("id", input.productId)
      .maybeSingle();

    if (productErr || !product) {
      return {
        success: false,
        error: "대상 제품을 데이터베이스에서 찾을 수 없습니다.",
      };
    }

    // 3. Validate Section ID
    const sectionId = String(input.sectionId).trim();
    if (!sectionId || !VALID_SECTIONS.has(sectionId)) {
      return {
        success: false,
        error: "유효하지 않은 검토 섹션 식별자입니다.",
      };
    }

    // 4. Validate Review Status
    if (!input.status || !VALID_STATUSES.has(input.status)) {
      return {
        success: false,
        error: "유효하지 않은 검토 상태 값입니다.",
      };
    }

    // 5. Validate & Sanitize Notes (Max 2,000 chars)
    let cleanNotes: string | null = null;
    if (input.notes !== undefined && input.notes !== null) {
      const trimmed = String(input.notes).trim();
      if (trimmed.length > 2000) {
        return {
          success: false,
          error: "검토 메모는 최대 2,000자까지 입력할 수 있습니다.",
        };
      }
      cleanNotes = trimmed.length > 0 ? trimmed : null;
    }

    // 6. Validate & Sanitize Evidence Reference (Max 500 chars)
    let cleanEvidence: string | null = null;
    if (input.evidenceReference !== undefined && input.evidenceReference !== null) {
      const trimmed = String(input.evidenceReference).trim();
      if (trimmed.length > 500) {
        return {
          success: false,
          error: "증빙 참조 내용은 최대 500자까지 입력할 수 있습니다.",
        };
      }
      cleanEvidence = trimmed.length > 0 ? trimmed : null;
    }

    // 7. Validate Related Brand Inquiry & Anti-Cross-Product Isolation
    let cleanInquiryId: string | null = null;
    if (input.relatedInquiryId) {
      const inquiryId = String(input.relatedInquiryId).trim();
      if (!UUID_REGEX.test(inquiryId)) {
        return {
          success: false,
          error: "유효하지 않은 문의 식별자(UUID)입니다.",
        };
      }

      const { data: inquiry, error: inqErr } = await admin
        .from("partner_inquiries")
        .select("id, related_product_id")
        .eq("id", inquiryId)
        .maybeSingle();

      if (inqErr || !inquiry) {
        return {
          success: false,
          error: "지정한 브랜드 문의를 찾을 수 없습니다.",
        };
      }

      if (inquiry.related_product_id !== input.productId) {
        return {
          success: false,
          error: "보안 위반: 선택한 문의가 해당 제품에 귀속되어 있지 않습니다. 타 제품의 문의를 연결할 수 없습니다.",
        };
      }

      cleanInquiryId = inquiry.id;
    }

    // 8. Derive Reviewer Attribution from Server Session
    const reviewerId = session.userId;

    // 9. Safe Upsert into public.product_compliance_reviews
    const nowIso = new Date().toISOString();
    const { data: upserted, error: upsertErr } = await admin
      .from("product_compliance_reviews")
      .upsert(
        {
          product_id: input.productId,
          section_id: sectionId,
          status: input.status,
          reviewer_id: reviewerId,
          notes: cleanNotes,
          evidence_reference: cleanEvidence,
          related_inquiry_id: cleanInquiryId,
          last_reviewed_at: nowIso,
        },
        {
          onConflict: "product_id,section_id",
        }
      )
      .select(
        `
        id,
        product_id,
        section_id,
        status,
        reviewer_id,
        notes,
        evidence_reference,
        related_inquiry_id,
        last_reviewed_at,
        created_at,
        updated_at,
        staff_members:reviewer_id ( id, name, email ),
        partner_inquiries:related_inquiry_id ( id, case_number, title, status )
      `
      )
      .single();

    if (upsertErr || !upserted) {
      console.error("[saveProductComplianceReview DB Error]:", upsertErr);
      return {
        success: false,
        error: `저장 실패: ${upsertErr?.message || "알 수 없는 데이터베이스 오류"}`,
      };
    }

    // 10. Revalidate path
    revalidatePath("/admin/products/compliance");

    const reviewerObj = Array.isArray(upserted.staff_members)
      ? upserted.staff_members[0]
      : upserted.staff_members;
    const inquiryObj = Array.isArray(upserted.partner_inquiries)
      ? upserted.partner_inquiries[0]
      : upserted.partner_inquiries;

    const review: ProductComplianceReviewItem = {
      id: upserted.id,
      product_id: upserted.product_id,
      section_id: upserted.section_id,
      status: upserted.status as ComplianceReviewStatus,
      reviewer_id: upserted.reviewer_id,
      notes: upserted.notes,
      evidence_reference: upserted.evidence_reference,
      related_inquiry_id: upserted.related_inquiry_id,
      last_reviewed_at: upserted.last_reviewed_at,
      created_at: upserted.created_at,
      updated_at: upserted.updated_at,
      reviewer: reviewerObj ? { id: reviewerObj.id, name: reviewerObj.name, email: reviewerObj.email } : null,
      inquiry: inquiryObj
        ? {
            id: inquiryObj.id,
            case_number: inquiryObj.case_number,
            title: inquiryObj.title,
            status: inquiryObj.status,
          }
        : null,
    };

    return {
      success: true,
      review,
    };
  } catch (err: any) {
    console.error("[saveProductComplianceReview Exception]:", err);
    return {
      success: false,
      error: `서버 예외: ${err?.message || "알 수 없는 오류가 발생했습니다."}`,
    };
  }
}

/**
 * Fetch all internal compliance review records for a specific product.
 */
export async function getProductComplianceReviews(
  productId: string
): Promise<{
  success: boolean;
  reviews: ProductComplianceReviewItem[];
  error?: string;
}> {
  try {
    await verifyAdminSession();

    if (!productId || !UUID_REGEX.test(productId)) {
      return {
        success: false,
        reviews: [],
        error: "유효하지 않은 제품 식별자입니다.",
      };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_compliance_reviews")
      .select(
        `
        id,
        product_id,
        section_id,
        status,
        reviewer_id,
        notes,
        evidence_reference,
        related_inquiry_id,
        last_reviewed_at,
        created_at,
        updated_at,
        staff_members:reviewer_id ( id, name, email ),
        partner_inquiries:related_inquiry_id ( id, case_number, title, status )
      `
      )
      .eq("product_id", productId);

    if (error) {
      return {
        success: false,
        reviews: [],
        error: error.message,
      };
    }

    const reviews: ProductComplianceReviewItem[] = (data || []).map((row) => {
      const reviewerObj = Array.isArray(row.staff_members) ? row.staff_members[0] : row.staff_members;
      const inquiryObj = Array.isArray(row.partner_inquiries) ? row.partner_inquiries[0] : row.partner_inquiries;
      return {
        id: row.id,
        product_id: row.product_id,
        section_id: row.section_id,
        status: row.status as ComplianceReviewStatus,
        reviewer_id: row.reviewer_id,
        notes: row.notes,
        evidence_reference: row.evidence_reference,
        related_inquiry_id: row.related_inquiry_id,
        last_reviewed_at: row.last_reviewed_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        reviewer: reviewerObj ? { id: reviewerObj.id, name: reviewerObj.name, email: reviewerObj.email } : null,
        inquiry: inquiryObj
          ? {
              id: inquiryObj.id,
              case_number: inquiryObj.case_number,
              title: inquiryObj.title,
              status: inquiryObj.status,
            }
          : null,
      };
    });

    return {
      success: true,
      reviews,
    };
  } catch (err: any) {
    return {
      success: false,
      reviews: [],
      error: err?.message || "알 수 없는 오류",
    };
  }
}
