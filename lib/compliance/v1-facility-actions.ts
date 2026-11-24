"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminStaffContext, getCallerAppRole } from "@/lib/auth/dal";
import { requireCompanyMembership } from "@/lib/company/dal";
import {
  isManufacturingCapableLocation,
  isShippingCapableLocation,
  LOCATION_TYPES,
  COMPLIANCE_VERIFICATION_STATUSES,
  IMPORT_READINESS_STATUSES,
  type CompanyLocationRecord,
  type ComplianceVerificationStatus,
  type ImportReadinessStatus,
  type LocationType,
  type ManufacturingFacilityComplianceRecord,
} from "./v1-types";
import {
  isFacilityComplianceCriticalChange,
  validateFacilityComplianceDeclaration,
  type FacilityComplianceDeclarationInput,
} from "./v1-validators";

async function resolveActorContext(requestedCompanyId?: string) {
  const role = await getCallerAppRole();
  if (role === "admin") {
    const staffCtx = await getAdminStaffContext();
    return {
      isAdmin: true as const,
      actorId: staffCtx.staffId,
      actorRole: staffCtx.baseRole || "admin",
      canVerify: staffCtx.isSuperAdmin || staffCtx.hasPermission("products", "approve") || staffCtx.hasPermission("products", "edit"),
      companyId: requestedCompanyId || null,
    };
  }
  if (role === "portal") {
    const membership = await requireCompanyMembership();
    if (requestedCompanyId && requestedCompanyId !== membership.companyId) {
      throw new Error("Cross-company access denied.");
    }
    return {
      isAdmin: false as const,
      actorId: membership.userId,
      actorRole: membership.companyRole || "company_staff",
      canVerify: false,
      companyId: membership.companyId,
    };
  }
  throw new Error("Unauthorized: Authentication required.");
}

async function recordComplianceAudit(params: {
  companyId: string | null;
  targetType: "FACILITY" | "PRODUCT" | "SYSTEM";
  facilityId?: string | null;
  productId?: string | null;
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
      target_type: params.targetType,
      facility_id: params.facilityId || null,
      product_id: params.productId || null,
      action: params.action,
      actor_id: params.actorId,
      actor_role: params.actorRole,
      old_values: params.oldValues ?? null,
      new_values: params.newValues ?? null,
      reason: params.reason || null,
    });
  } catch (err) {
    console.warn("[KSN-CMP-001-R1] Audit log warning:", err);
  }
}

/**
 * Propagates RE_REVIEW_REQUIRED to all VERIFIED products linked to a facility
 * when compliance-critical facility data changes.
 */
async function propagateFacilityReReviewToLinkedProducts(params: {
  facilityId: string;
  companyId: string;
  actorId: string;
  actorRole: string;
  reason: string;
}) {
  const admin = createAdminClient();
  const { data: links } = await admin
    .from("product_manufacturing_facilities")
    .select("product_id")
    .eq("facility_id", params.facilityId);

  const productIds = Array.from(new Set((links || []).map((l: any) => l.product_id)));
  if (productIds.length === 0) return 0;

  const { data: verifiedProducts } = await admin
    .from("product_regulatory_compliance")
    .select("product_id, verification_status")
    .in("product_id", productIds)
    .in("verification_status", ["VERIFIED", "UNDER_REVIEW"]);

  const toInvalidate = (verifiedProducts || []).map((p: any) => p.product_id);
  if (toInvalidate.length === 0) return 0;

  await admin
    .from("product_regulatory_compliance")
    .update({
      verification_status: "RE_REVIEW_REQUIRED",
      updated_at: new Date().toISOString(),
    })
    .in("product_id", toInvalidate);

  for (const pid of toInvalidate) {
    await recordComplianceAudit({
      companyId: params.companyId,
      targetType: "PRODUCT",
      productId: pid,
      facilityId: params.facilityId,
      action: "FACILITY_RE_REVIEW_PROPAGATED",
      actorId: params.actorId,
      actorRole: params.actorRole,
      newValues: { verification_status: "RE_REVIEW_REQUIRED", source_facility_id: params.facilityId },
      reason: params.reason,
    });
  }

  return toInvalidate.length;
}

/**
 * Shared loader for company locations (Shipping Origins, Manufacturing Facilities, or Both).
 * - Filters strictly by canonical company_id (enforced server-side).
 * - Joins 1:1 manufacturing_facility_compliance when manufacturing-capable.
 */
export async function getCompanyLocationsWithCompliance(
  companyId?: string,
  filter?: { capability?: "SHIPPING" | "MANUFACTURING" | "ALL"; includeInactive?: boolean }
): Promise<{
  ok: true;
  locations: (CompanyLocationRecord & {
    compliance: ManufacturingFacilityComplianceRecord | null;
  })[];
} | { ok: false; error: string }> {
  try {
    const actor = await resolveActorContext(companyId);
    const targetCompanyId = actor.companyId;
    if (!targetCompanyId) {
      return { ok: false, error: "회사 ID가 필요합니다." };
    }

    const admin = createAdminClient();
    let query = admin
      .from("company_shipping_origins")
      .select("*")
      .eq("company_id", targetCompanyId)
      .order("is_default_manufacturing", { ascending: false })
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (!filter?.includeInactive) {
      query = query.eq("status", "active");
    }

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message };

    let filtered = (rows || []) as CompanyLocationRecord[];
    if (filter?.capability === "SHIPPING") {
      filtered = filtered.filter((r) => isShippingCapableLocation(r.location_type));
    } else if (filter?.capability === "MANUFACTURING") {
      filtered = filtered.filter((r) => isManufacturingCapableLocation(r.location_type));
    }

    const mfgIds = filtered
      .filter((r) => isManufacturingCapableLocation(r.location_type))
      .map((r) => r.id);

    const compMap = new Map<string, ManufacturingFacilityComplianceRecord>();
    if (mfgIds.length > 0) {
      const { data: compRows } = await admin
        .from("manufacturing_facility_compliance")
        .select("*")
        .in("facility_id", mfgIds);
      for (const c of compRows || []) {
        compMap.set(c.facility_id, c as ManufacturingFacilityComplianceRecord);
      }
    }

    return {
      ok: true,
      locations: filtered.map((loc) => ({
        ...loc,
        compliance: compMap.get(loc.id) || null,
      })),
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "장소 목록 조회에 실패했습니다." };
  }
}

export interface UpsertCompanyLocationInput {
  id?: string;
  company_id?: string;
  name: string;
  location_type: LocationType;
  is_default?: boolean;
  is_default_manufacturing?: boolean;
  manufacturer_legal_name_en?: string | null;
  manufacturer_name_ko?: string | null;
  contact_name?: string | null;
  contact_name_en?: string | null;
  phone?: string | null;
  email?: string | null;
  country: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province?: string | null;
  postal_code: string;
  status?: "active" | "inactive";
  notes?: string | null;
}

/**
 * Shared create/update contract for Company Locations (Shipping Origin / Manufacturing Facility / Both).
 * - Auto-generates immutable MFG-### code via concurrency-safe RPC when manufacturing-capable.
 * - Keeps default shipping origin (is_default) and default manufacturing facility (is_default_manufacturing) separate.
 * - Triggers facility + linked-product RE_REVIEW_REQUIRED ONLY when compliance-critical facility fields change.
 * - Unrelated shipping/Warehouse/notes edits NEVER invalidate facility compliance!
 */
export async function upsertCompanyLocationAction(
  input: UpsertCompanyLocationInput
): Promise<
  | { ok: true; location: CompanyLocationRecord; propagatedProductsCount: number }
  | { ok: false; error: string }
> {
  try {
    const actor = await resolveActorContext(input.company_id);
    const companyId = actor.companyId;
    if (!companyId) return { ok: false, error: "회사 ID가 필요합니다." };

    if (!LOCATION_TYPES.includes(input.location_type)) {
      return { ok: false, error: "유효하지 않은 장소 유형(location_type)입니다." };
    }
    if (!input.name?.trim() || !input.address_line1?.trim() || !input.city?.trim() || !input.postal_code?.trim()) {
      return { ok: false, error: "장소명, 주소, 도시, 우편번호는 필수입니다." };
    }

    const isMfg = isManufacturingCapableLocation(input.location_type);
    const isShip = isShippingCapableLocation(input.location_type);
    if (isMfg && !input.manufacturer_legal_name_en?.trim()) {
      return { ok: false, error: "제조시설 유형은 제조사 정식 영문명(manufacturer_legal_name_en)이 필수입니다." };
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    let existing: CompanyLocationRecord | null = null;

    if (input.id) {
      const { data: row } = await admin
        .from("company_shipping_origins")
        .select("*")
        .eq("id", input.id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (!row) return { ok: false, error: "수정할 장소 정보를 찾을 수 없습니다." };
      existing = row as CompanyLocationRecord;
    }

    // Generate immutable facility_code atomically only when first becoming manufacturing-capable
    let facilityCode = existing?.facility_code || null;
    if (isMfg && !facilityCode) {
      const { data: nextCode, error: codeErr } = await admin.rpc("next_company_facility_code", {
        p_company_id: companyId,
      });
      if (codeErr || !nextCode) {
        return { ok: false, error: `제조시설 코드 생성 실패: ${codeErr?.message || "unknown"}` };
      }
      facilityCode = String(nextCode);
    }

    const willBeDefaultShipping = isShip ? Boolean(input.is_default ?? existing?.is_default ?? false) : false;
    const willBeDefaultMfg = isMfg
      ? Boolean(input.is_default_manufacturing ?? existing?.is_default_manufacturing ?? false)
      : false;

    if (willBeDefaultShipping) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default: false })
        .eq("company_id", companyId)
        .neq("id", input.id || "00000000-0000-0000-0000-000000000000");
    }
    if (willBeDefaultMfg) {
      await admin
        .from("company_shipping_origins")
        .update({ is_default_manufacturing: false })
        .eq("company_id", companyId)
        .neq("id", input.id || "00000000-0000-0000-0000-000000000000");
    }

    const payload = {
      company_id: companyId,
      name: input.name.trim(),
      location_type: input.location_type,
      is_default: willBeDefaultShipping,
      is_default_manufacturing: willBeDefaultMfg,
      facility_code: facilityCode,
      manufacturer_legal_name_en: input.manufacturer_legal_name_en?.trim() || null,
      manufacturer_name_ko: input.manufacturer_name_ko?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      contact_name_en: input.contact_name_en?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      country: input.country.trim(),
      address_line1: input.address_line1.trim(),
      address_line2: input.address_line2?.trim() || null,
      city: input.city.trim(),
      state_province: input.state_province?.trim() || null,
      postal_code: input.postal_code.trim(),
      status: input.status || existing?.status || "active",
      notes: input.notes?.trim() || null,
      updated_by: actor.actorId,
      updated_at: now,
    };

    let saved: CompanyLocationRecord;
    if (existing) {
      const { data, error } = await admin
        .from("company_shipping_origins")
        .update(payload)
        .eq("id", existing.id)
        .eq("company_id", companyId)
        .select()
        .single();
      if (error || !data) return { ok: false, error: error?.message || "장소 수정 실패" };
      saved = data as CompanyLocationRecord;
    } else {
      const { data, error } = await admin
        .from("company_shipping_origins")
        .insert({ ...payload, created_by: actor.actorId, created_at: now })
        .select()
        .single();
      if (error || !data) return { ok: false, error: error?.message || "장소 등록 실패" };
      saved = data as CompanyLocationRecord;
    }

    // Ensure 1:1 compliance record exists for manufacturing locations
    let propagatedProductsCount = 0;
    if (isMfg) {
      const { data: compRow } = await admin
        .from("manufacturing_facility_compliance")
        .select("*")
        .eq("facility_id", saved.id)
        .maybeSingle();

      if (!compRow) {
        await admin.from("manufacturing_facility_compliance").insert({
          facility_id: saved.id,
          company_id: companyId,
          updated_by: actor.actorId,
        });
      } else if (existing && isFacilityComplianceCriticalChange(existing, saved)) {
        if (compRow.verification_status === "VERIFIED" || compRow.verification_status === "UNDER_REVIEW") {
          await admin
            .from("manufacturing_facility_compliance")
            .update({ verification_status: "RE_REVIEW_REQUIRED", updated_at: now })
            .eq("facility_id", saved.id);
        }
        propagatedProductsCount = await propagateFacilityReReviewToLinkedProducts({
          facilityId: saved.id,
          companyId,
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          reason: "제조시설 핵심 정보(영문 법인명 또는 공장 주소) 변경에 따른 재검토 전환",
        });
      }
    }

    await recordComplianceAudit({
      companyId,
      targetType: "FACILITY",
      facilityId: saved.id,
      action: existing ? "LOCATION_UPDATE" : "LOCATION_CREATE",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: existing,
      newValues: saved,
      reason: propagatedProductsCount > 0 ? `영향 제품 ${propagatedProductsCount}건 재검토 전환` : undefined,
    });

    revalidatePath("/portal/company/info");
    revalidatePath(`/admin/companies/${companyId}`);
    revalidatePath("/admin/products/compliance");
    return { ok: true, location: saved, propagatedProductsCount };
  } catch (err: any) {
    return { ok: false, error: err?.message || "장소 저장 중 오류가 발생했습니다." };
  }
}

/**
 * Brand Portal or Admin saves Facility Compliance declaration (FEI, MoCRA, OTC).
 * - Never allows Brand Portal to modify verification_status or import_readiness_status directly.
 * - Automatically invalidates VERIFIED -> RE_REVIEW_REQUIRED and propagates to linked products on critical edits.
 */
export async function saveFacilityComplianceDeclarationAction(
  facilityId: string,
  input: FacilityComplianceDeclarationInput
): Promise<
  | { ok: true; compliance: ManufacturingFacilityComplianceRecord; propagatedProductsCount: number }
  | { ok: false; error: string }
> {
  try {
    const validation = validateFacilityComplianceDeclaration(input);
    if (!validation.valid) {
      return { ok: false, error: validation.errors[0] };
    }

    const admin = createAdminClient();
    const { data: loc } = await admin
      .from("company_shipping_origins")
      .select("id, company_id, location_type")
      .eq("id", facilityId)
      .maybeSingle();

    if (!loc || !isManufacturingCapableLocation(loc.location_type)) {
      return { ok: false, error: "유효한 제조시설을 찾을 수 없습니다." };
    }

    const actor = await resolveActorContext(loc.company_id);

    const { data: existing } = await admin
      .from("manufacturing_facility_compliance")
      .select("*")
      .eq("facility_id", facilityId)
      .maybeSingle();

    const now = new Date().toISOString();
    const criticalChanged = isFacilityComplianceCriticalChange(existing, input);
    const shouldReReview =
      criticalChanged &&
      existing &&
      (existing.verification_status === "VERIFIED" || existing.verification_status === "UNDER_REVIEW");

    const upsertRow = {
      facility_id: facilityId,
      company_id: loc.company_id,
      fei_status: input.fei_status,
      fei_number: input.fei_number?.trim() || null,
      mocra_facility_status: input.mocra_facility_status,
      mocra_exemption_reason: input.mocra_exemption_reason?.trim() || null,
      mocra_registered_at: input.mocra_registered_at || null,
      mocra_next_renewal_date: input.mocra_next_renewal_date || null,
      otc_facility_status: input.otc_facility_status,
      otc_na_reason: input.otc_na_reason?.trim() || null,
      otc_registered_at: input.otc_registered_at || null,
      otc_next_renewal_date: input.otc_next_renewal_date || null,
      ...(shouldReReview ? { verification_status: "RE_REVIEW_REQUIRED" } : {}),
      updated_by: actor.actorId,
      updated_at: now,
    };

    const { data: saved, error } = await admin
      .from("manufacturing_facility_compliance")
      .upsert(upsertRow, { onConflict: "facility_id" })
      .select()
      .single();

    if (error || !saved) {
      return { ok: false, error: error?.message || "제조시설 규제 정보 저장 실패" };
    }

    let propagatedProductsCount = 0;
    if (criticalChanged) {
      propagatedProductsCount = await propagateFacilityReReviewToLinkedProducts({
        facilityId,
        companyId: loc.company_id,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        reason: "제조시설 규제 정보(FEI/MoCRA/OTC) 변경에 따른 연계 제품 재검토 전환",
      });
    }

    await recordComplianceAudit({
      companyId: loc.company_id,
      targetType: "FACILITY",
      facilityId,
      action: shouldReReview ? "FACILITY_DECLARE_RE_REVIEW" : "FACILITY_DECLARE",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: existing,
      newValues: saved,
    });

    revalidatePath("/portal/company/info");
    revalidatePath("/admin/products/compliance");
    return {
      ok: true,
      compliance: saved as ManufacturingFacilityComplianceRecord,
      propagatedProductsCount,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제조시설 규제 정보 저장 오류" };
  }
}

/**
 * Admin-only verification mutation for Manufacturing Facility compliance.
 * Brand Portal callers are strictly rejected server-side.
 */
export async function adminVerifyFacilityComplianceAction(
  facilityId: string,
  input: {
    verification_status: ComplianceVerificationStatus;
    import_readiness_status?: ImportReadinessStatus;
    verification_method?: string | null;
    verification_basis?: string | null;
    public_review_comment?: string | null;
    private_admin_note?: string | null;
    correction_request?: string | null;
  }
): Promise<{ ok: true; compliance: ManufacturingFacilityComplianceRecord } | { ok: false; error: string }> {
  try {
    const actor = await resolveActorContext();
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
      .from("manufacturing_facility_compliance")
      .select("*")
      .eq("facility_id", facilityId)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "제조시설 규제 정보를 찾을 수 없습니다." };
    }

    const now = new Date().toISOString();
    const { data: saved, error } = await admin
      .from("manufacturing_facility_compliance")
      .update({
        verification_status: input.verification_status,
        ...(input.import_readiness_status ? { import_readiness_status: input.import_readiness_status } : {}),
        verified_by: actor.actorId,
        verified_at: now,
        verification_method: input.verification_method?.trim() || null,
        verification_basis: input.verification_basis?.trim() || null,
        public_review_comment: input.public_review_comment?.trim() || null,
        updated_by: actor.actorId,
        updated_at: now,
      })
      .eq("facility_id", facilityId)
      .select()
      .single();

    if (error || !saved) return { ok: false, error: error?.message || "검증 저장 실패" };

    if (input.private_admin_note?.trim() || input.correction_request?.trim()) {
      await admin.from("compliance_admin_notes").insert({
        company_id: existing.company_id,
        target_type: "FACILITY",
        facility_id: facilityId,
        private_note: input.private_admin_note?.trim() || "(보완 요청 기록)",
        correction_request: input.correction_request?.trim() || null,
        created_by: actor.actorId,
      });
    }

    await recordComplianceAudit({
      companyId: existing.company_id,
      targetType: "FACILITY",
      facilityId,
      action: "ADMIN_VERIFY_FACILITY",
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      oldValues: { verification_status: existing.verification_status },
      newValues: {
        verification_status: saved.verification_status,
        import_readiness_status: saved.import_readiness_status,
        verification_method: saved.verification_method,
      },
      reason: input.verification_basis?.trim() || undefined,
    });

    revalidatePath("/admin/products/compliance");
    return { ok: true, compliance: saved as ManufacturingFacilityComplianceRecord };
  } catch (err: any) {
    return { ok: false, error: err?.message || "제조시설 검증 저장 오류" };
  }
}

/**
 * Returns products linked to a manufacturing facility.
 * Used to guard against deletion/incompatible type change and display affected products.
 */
export async function getFacilityLinkedProductsAction(facilityId: string): Promise<{
  ok: true;
  count: number;
  products: Array<{
    id: string;
    sku: string;
    name_ko: string | null;
    name_en: string;
    is_primary: boolean;
  }>;
} | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: links, error } = await admin
      .from("product_manufacturing_facilities")
      .select("product_id, is_primary, products(id, manufacture_sku, name, name_en)")
      .eq("facility_id", facilityId);

    if (error) return { ok: false, error: error.message };

    const products = (links || []).map((l: any) => ({
      id: l.product_id,
      sku: l.products?.manufacture_sku || "",
      name_ko: l.products?.name || null,
      name_en: l.products?.name_en || "",
      is_primary: Boolean(l.is_primary),
    }));

    return { ok: true, count: products.length, products };
  } catch (err: any) {
    return { ok: false, error: err?.message || "연결 제품 조회 실패" };
  }
}
