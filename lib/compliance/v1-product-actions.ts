"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStaffContext, getCallerAppRole } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import {
  COMPLIANCE_VERIFICATION_STATUSES,
  IMPORT_READINESS_STATUSES,
  isManufacturingCapableLocation,
  type CompanyLocationRecord,
  type ComplianceVerificationStatus,
  type ImportReadinessStatus,
  type ManufacturingFacilityComplianceRecord,
  type ProductRegulatoryComplianceRecord,
} from "./v1-types";
import {
  isProductComplianceCriticalChange,
  validateProductRegulatoryDeclaration,
  type ProductRegulatoryDeclarationInput,
} from "./v1-validators";
import { requireComplianceV1MutationAllowed } from "./v1-feature-gate";

async function resolveProductActor(productId: string) {
  const admin = createAdminClient();
  const { data: prod } = await admin
    .from("products")
    .select("id, brand_id, compliance_facility_grandfathered, brands!inner(company_id)")
    .eq("id", productId)
    .maybeSingle();

  if (!prod) throw new Error("제품을 찾을 수 없습니다.");
  const productCompanyId = (prod as any).brands?.company_id as string;

  const role = await getCallerAppRole();
  if (role === "admin") {
    const staffCtx = await getAdminStaffContext();
    return {
      isAdmin: true as const,
      actorId: staffCtx.staffId,
      actorRole: staffCtx.baseRole || "admin",
      canVerify:
        staffCtx.isSuperAdmin ||
        staffCtx.hasPermission("products", "approve") ||
        staffCtx.hasPermission("products", "edit"),
      companyId: productCompanyId,
      isGrandfathered: Boolean((prod as any).compliance_facility_grandfathered),
    };
  }
  if (role === "portal") {
    const membership = await requireCompanyMembership();
    if (membership.companyId !== productCompanyId) {
      throw new Error("타 회사 제품에 접근할 수 없습니다.");
    }
    return {
      isAdmin: false as const,
      actorId: membership.userId,
      actorRole: membership.companyRole || "company_staff",
      canVerify: false,
      companyId: productCompanyId,
      isGrandfathered: Boolean((prod as any).compliance_facility_grandfathered),
    };
  }
  throw new Error("Unauthorized: Authentication required.");
}

async function recordProductAudit(params: {
  companyId: string;
  productId: string;
  action: string;
  actorId: string;
  actorRole: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("compliance_audit_logs").insert({
      company_id: params.companyId,
      target_type: "PRODUCT",
      product_id: params.productId,
      action: params.action,
      actor_id: params.actorId,
      actor_role: params.actorRole,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      reason: params.reason || null,
    });
  } catch (err) {
    console.warn("[KSN-CMP-001-R1] Product audit log warning:", err);
  }
}

/**
 * Loads linked Primary & Additional Manufacturing Facilities for a product
 * along with each facility's authoritative compliance record.
 */
export async function getProductManufacturingFacilitiesAction(productId: string): Promise<
  | {
      ok: true;
      primaryFacilityId: string | null;
      additionalFacilityIds: string[];
      facilities: Array<{
        link_id: string;
        facility_id: string;
        is_primary: boolean;
        location: CompanyLocationRecord;
        compliance: ManufacturingFacilityComplianceRecord | null;
      }>;
    }
  | { ok: false; error: string }
> {
  try {
    await resolveProductActor(productId);
    const admin = createAdminClient();

    const { data: links, error } = await admin
      .from("product_manufacturing_facilities")
      .select("id, facility_id, is_primary")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { ok: true, primaryFacilityId: null, additionalFacilityIds: [], facilities: [] };
      }
      return { ok: false, error: error.message };
    }

    const facilityIds = (links || []).map((l: any) => l.facility_id);
    if (facilityIds.length === 0) {
      return { ok: true, primaryFacilityId: null, additionalFacilityIds: [], facilities: [] };
    }

    const [locRes, compRes] = await Promise.all([
      admin.from("company_shipping_origins").select("*").in("id", facilityIds),
      admin.from("manufacturing_facility_compliance").select("*").in("facility_id", facilityIds),
    ]);

    const locMap = new Map((locRes.data || []).map((l: any) => [l.id, l as CompanyLocationRecord]));
    const compMap = new Map(
      (compRes.data || []).map((c: any) => [c.facility_id, c as ManufacturingFacilityComplianceRecord])
    );

    const facilities = (links || [])
      .map((l: any) => {
        const loc = locMap.get(l.facility_id);
        if (!loc) return null;
        return {
          link_id: l.id,
          facility_id: l.facility_id,
          is_primary: Boolean(l.is_primary),
          location: loc,
          compliance: compMap.get(l.facility_id) || null,
        };
      })
      .filter(Boolean) as any[];

    const primary = facilities.find((f) => f.is_primary);
    const additional = facilities.filter((f) => !f.is_primary).map((f) => f.facility_id);

    return {
      ok: true,
      primaryFacilityId: primary?.facility_id || null,
      additionalFacilityIds: additional,
      facilities,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제품 제조시설 조회 실패" };
  }
}

/**
 * Atomically sets Primary (at most 1) and Additional (N) Manufacturing Facilities for a product.
 * - Enforces same-company ownership & manufacturing location_type server-side AND via DB trigger.
 * - Uses atomic Postgres RPC replace_product_manufacturing_facilities.
 * - Triggers RE_REVIEW_REQUIRED on verified product compliance if facilities change.
 */
export async function setProductManufacturingFacilitiesAction(
  productId: string,
  input: {
    primaryFacilityId: string | null;
    additionalFacilityIds?: string[];
  }
): Promise<{ ok: true } | { ok: false; error: string; errorCode?: string }> {
  try {
    const gate = requireComplianceV1MutationAllowed();
    if (!gate.allowed) return { ok: false, error: gate.error, errorCode: gate.errorCode };

    const actor = await resolveProductActor(productId);
    const admin = createAdminClient();

    const cleanAdditional = Array.from(
      new Set(
        (input.additionalFacilityIds || []).filter(
          (id) => Boolean(id) && id !== input.primaryFacilityId
        )
      )
    );
    const allIds = [
      ...(input.primaryFacilityId ? [input.primaryFacilityId] : []),
      ...cleanAdditional,
    ];

    if (allIds.length > 0) {
      const { data: locs, error: locErr } = await admin
        .from("company_shipping_origins")
        .select("id, company_id, location_type, status")
        .in("id", allIds);

      if (locErr) return { ok: false, error: locErr.message };
      if (!locs || locs.length !== allIds.length) {
        return { ok: false, error: "선택한 제조시설 중 존재하지 않는 항목이 있습니다." };
      }
      for (const loc of locs) {
        if (loc.company_id !== actor.companyId) {
          return { ok: false, error: "타 회사의 제조시설은 연결할 수 없습니다." };
        }
        if (!isManufacturingCapableLocation(loc.location_type)) {
          return { ok: false, error: "출고지 전용 장소는 제조시설로 연결할 수 없습니다." };
        }
        if (loc.status === "inactive") {
          return { ok: false, error: "비활성화된 제조시설은 새로 연결할 수 없습니다." };
        }
      }
    }

    const { data: prevLinks } = await admin
      .from("product_manufacturing_facilities")
      .select("facility_id, is_primary")
      .eq("product_id", productId);

    const { error: rpcErr } = await admin.rpc("replace_product_manufacturing_facilities", {
      p_product_id: productId,
      p_company_id: actor.companyId,
      p_primary_facility_id: input.primaryFacilityId,
      p_additional_facility_ids: cleanAdditional,
      p_actor_id: actor.actorId,
    });

    if (rpcErr) return { ok: false, error: rpcErr.message };

    // If product compliance was VERIFIED/UNDER_REVIEW and facility links changed, trigger RE_REVIEW_REQUIRED
    const prevSig = JSON.stringify(
      (prevLinks || []).sort((a: any, b: any) => a.facility_id.localeCompare(b.facility_id))
    );
    const nextSig = JSON.stringify(
      [
        ...(input.primaryFacilityId ? [{ facility_id: input.primaryFacilityId, is_primary: true }] : []),
        ...cleanAdditional.map((id) => ({ facility_id: id, is_primary: false })),
      ].sort((a, b) => a.facility_id.localeCompare(b.facility_id))
    );

    if (prevSig !== nextSig) {
      await admin
        .from("product_regulatory_compliance")
        .update({ verification_status: "RE_REVIEW_REQUIRED", updated_at: new Date().toISOString() })
        .eq("product_id", productId)
        .in("verification_status", ["VERIFIED", "UNDER_REVIEW"]);
    }

    await recordProductAudit({
      companyId: actor.companyId,
      productId,
      action: "PRODUCT_FACILITIES_UPDATED",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: prevLinks || [],
      newValues: { primaryFacilityId: input.primaryFacilityId, additionalFacilityIds: cleanAdditional },
    });

    revalidatePath(`/portal/products/${productId}`);
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products/compliance");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제조시설 연결 저장 실패" };
  }
}

/**
 * Loads Product Regulatory Compliance record (shared Portal + Admin).
 * Private admin notes are stored in separate Admin-only table compliance_admin_notes
 * and NEVER returned by this shared reader.
 */
export async function getProductRegulatoryComplianceAction(productId: string): Promise<
  | { ok: true; compliance: ProductRegulatoryComplianceRecord | null; isGrandfathered: boolean }
  | { ok: false; error: string }
> {
  try {
    const actor = await resolveProductActor(productId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("product_regulatory_compliance")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { ok: true, compliance: null, isGrandfathered: actor.isGrandfathered };
      }
      return { ok: false, error: error.message };
    }
    return {
      ok: true,
      compliance: (data as ProductRegulatoryComplianceRecord) || null,
      isGrandfathered: actor.isGrandfathered,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제품 규제 정보 조회 실패" };
  }
}

/**
 * Brand Portal or Admin saves Product Regulatory declaration.
 * - Brand Portal cannot directly mutate verification_status, import_readiness_status, or drug_facts_status='VERIFIED'.
 * - Critical changes automatically invalidate VERIFIED/UNDER_REVIEW -> RE_REVIEW_REQUIRED.
 */
export async function saveProductRegulatoryDeclarationAction(
  productId: string,
  input: ProductRegulatoryDeclarationInput
): Promise<{ ok: true; compliance: ProductRegulatoryComplianceRecord } | { ok: false; error: string; errorCode?: string }> {
  try {
    const gate = requireComplianceV1MutationAllowed();
    if (!gate.allowed) return { ok: false, error: gate.error, errorCode: gate.errorCode };

    const actor = await resolveProductActor(productId);
    const validation = validateProductRegulatoryDeclaration(input, { isAdmin: actor.isAdmin });
    if (!validation.valid) {
      return { ok: false, error: validation.errors[0] };
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("product_regulatory_compliance")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();

    const now = new Date().toISOString();
    const criticalChanged = isProductComplianceCriticalChange(existing, input);
    const shouldReReview =
      criticalChanged &&
      existing &&
      (existing.verification_status === "VERIFIED" || existing.verification_status === "UNDER_REVIEW");

    const upsertRow = {
      product_id: productId,
      company_id: actor.companyId,
      us_classification: input.us_classification,
      otc_applicability: input.otc_applicability ?? existing?.otc_applicability ?? "UNKNOWN",
      otc_dual_mocra_applicable:
        input.otc_dual_mocra_applicable !== undefined
          ? input.otc_dual_mocra_applicable
          : existing?.otc_dual_mocra_applicable ?? null,
      classification_rationale: input.classification_rationale?.trim() || null,
      mocra_listing_status: input.mocra_listing_status,
      mocra_listing_number: input.mocra_listing_number?.trim() || null,
      mocra_exemption_reason: input.mocra_exemption_reason?.trim() || null,
      mocra_listed_at: input.mocra_listed_at || null,
      mocra_next_renewal_date: input.mocra_next_renewal_date || null,
      otc_listing_status: input.otc_listing_status,
      otc_ndc_number: input.otc_ndc_number?.trim() || null,
      otc_na_reason: input.otc_na_reason?.trim() || null,
      otc_listed_at: input.otc_listed_at || null,
      otc_next_renewal_date: input.otc_next_renewal_date || null,
      drug_facts_status: input.drug_facts_status,
      ...(shouldReReview ? { verification_status: "RE_REVIEW_REQUIRED" } : {}),
      last_brand_submitted_at: actor.isAdmin ? existing?.last_brand_submitted_at ?? null : now,
      updated_by: actor.actorId,
      updated_at: now,
    };

    const { data: saved, error } = await admin
      .from("product_regulatory_compliance")
      .upsert(upsertRow, { onConflict: "product_id" })
      .select()
      .single();

    if (error || !saved) return { ok: false, error: error?.message || "제품 규제 정보 저장 실패" };

    await recordProductAudit({
      companyId: actor.companyId,
      productId,
      action: shouldReReview ? "PRODUCT_DECLARE_RE_REVIEW" : "PRODUCT_DECLARE",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: existing,
      newValues: saved,
    });

    revalidatePath(`/portal/products/${productId}`);
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products/compliance");
    return { ok: true, compliance: saved as ProductRegulatoryComplianceRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제품 규제 정보 저장 오류" };
  }
}

/**
 * Admin-only verification mutation for Product Regulatory Compliance.
 */
export async function adminVerifyProductComplianceAction(
  productId: string,
  input: {
    verification_status: ComplianceVerificationStatus;
    import_readiness_status?: ImportReadinessStatus;
    verification_method?: string | null;
    verification_basis?: string | null;
    public_review_comment?: string | null;
    private_admin_note?: string | null;
    correction_request?: string | null;
  }
): Promise<{ ok: true; compliance: ProductRegulatoryComplianceRecord } | { ok: false; error: string; errorCode?: string }> {
  try {
    const gate = requireComplianceV1MutationAllowed();
    if (!gate.allowed) return { ok: false, error: gate.error, errorCode: gate.errorCode };

    const actor = await resolveProductActor(productId);
    if (!actor.isAdmin || !actor.canVerify) {
      return { ok: false, error: "권한이 없습니다. 승인 권한이 있는 ADMIN만 검증 상태를 변경할 수 있습니다." };
    }
    if (!COMPLIANCE_VERIFICATION_STATUSES.includes(input.verification_status)) {
      return { ok: false, error: "유효하지 않은 검증 상태입니다." };
    }
    if (input.import_readiness_status && !IMPORT_READINESS_STATUSES.includes(input.import_readiness_status)) {
      return { ok: false, error: "유효하지 않은 수입 준비 상태입니다." };
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("product_regulatory_compliance")
      .select("*")
      .eq("product_id", productId)
      .maybeSingle();

    const now = new Date().toISOString();
    const { data: saved, error } = await admin
      .from("product_regulatory_compliance")
      .upsert(
        {
          product_id: productId,
          company_id: actor.companyId,
          verification_status: input.verification_status,
          ...(input.import_readiness_status ? { import_readiness_status: input.import_readiness_status } : {}),
          verified_by: actor.actorId,
          verified_at: now,
          verification_method: input.verification_method?.trim() || null,
          verification_basis: input.verification_basis?.trim() || null,
          public_review_comment: input.public_review_comment?.trim() || null,
          updated_by: actor.actorId,
          updated_at: now,
        },
        { onConflict: "product_id" }
      )
      .select()
      .single();

    if (error || !saved) return { ok: false, error: error?.message || "검증 저장 실패" };

    if (input.private_admin_note?.trim() || input.correction_request?.trim()) {
      await admin.from("compliance_admin_notes").insert({
        company_id: actor.companyId,
        target_type: "PRODUCT",
        product_id: productId,
        private_note: input.private_admin_note?.trim() || "(보완 요청 기록)",
        correction_request: input.correction_request?.trim() || null,
        created_by: actor.actorId,
      });
    }

    await recordProductAudit({
      companyId: actor.companyId,
      productId,
      action: "ADMIN_VERIFY_PRODUCT",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: { verification_status: existing?.verification_status || "UNREVIEWED" },
      newValues: {
        verification_status: saved.verification_status,
        import_readiness_status: saved.import_readiness_status,
      },
      reason: input.verification_basis?.trim() || undefined,
    });

    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/admin/products/compliance");
    return { ok: true, compliance: saved as ProductRegulatoryComplianceRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제품 검증 저장 오류" };
  }
}

/**
 * Admin-only reader for private compliance notes (strictly blocked for Brand Portal).
 */
export async function getComplianceAdminNotesAction(params: {
  targetType: "FACILITY" | "PRODUCT";
  targetId: string;
}): Promise<{ ok: true; notes: any[] } | { ok: false; error: string }> {
  try {
    const role = await getCallerAppRole();
    if (role !== "admin") {
      return { ok: false, error: "권한이 없습니다. 내부 메모는 ADMIN 전용입니다." };
    }
    await getAdminStaffContext();
    const admin = createAdminClient();
    const col = params.targetType === "FACILITY" ? "facility_id" : "product_id";
    const { data, error } = await admin
      .from("compliance_admin_notes")
      .select("id, private_note, correction_request, created_by, created_at")
      .eq("target_type", params.targetType)
      .eq(col, params.targetId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { ok: true, notes: [] };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, notes: data || [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || "내부 메모 조회 실패" };
  }
}

/**
 * Loads compliance evidence documents for a product.
 */
export async function getProductComplianceDocumentsAction(productId: string): Promise<
  | { ok: true; documents: any[] }
  | { ok: false; error: string }
> {
  try {
    await resolveProductActor(productId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("compliance_evidence_documents")
      .select("id, target_type, facility_id, product_id, document_category, file_name, mime_type, file_size, sha256, created_at")
      .eq("product_id", productId)
      .eq("target_type", "PRODUCT")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return { ok: true, documents: [] };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, documents: data || [] };
  } catch (err: any) {
    return { ok: true, documents: [] };
  }
}
