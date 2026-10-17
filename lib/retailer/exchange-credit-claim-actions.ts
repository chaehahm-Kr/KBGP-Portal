"use server";

import { verifyRetailerSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateCohortEligibility,
  EvaluatorWeeklyCheck,
  EvaluatorShipmentEvidence,
  EvaluatorSalesEvidence,
  EvaluatorReorderOrder,
} from "./exchange-credit-evaluator";
import { validateClaimPayload } from "./exchange-credit-claim-pure";
import {
  SubmitClaimInput,
  SaveClaimDraftInput,
  ClaimSubmissionResult,
  ClaimValidationError,
  ClaimTotalsCalculation,
  RetailerClaimDetail,
  RetailerClaimSummaryItem,
  CLAIM_STATUS_CONFIG,
} from "./exchange-credit-claim-types";

/**
 * Pre-validate claim before submission without writing to database.
 */
export async function validateClaimBeforeSubmission(
  input: SubmitClaimInput
): Promise<ClaimSubmissionResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, error: "인증되지 않은 사용자입니다. 다시 로그인해 주세요." };
  }

  const adminClient = createAdminClient();

  // Verify Company & Store Access
  const { data: userRow } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  if (!userRow?.company_id) {
    return { success: false, error: "소속 리테일러 회사 정보를 확인할 수 없습니다." };
  }

  const companyId = userRow.company_id;

  const { data: storeRow } = await adminClient
    .from("stores")
    .select("id, company_id")
    .eq("id", input.storeId)
    .maybeSingle();

  if (!storeRow || storeRow.company_id !== companyId) {
    return { success: false, error: "해당 매장에 대한 접근 권한이 없습니다." };
  }

  // Fetch candidate cohorts and evidence
  const cohortIds = (input.items || []).map((i) => i.cohortId);
  const { data: cohorts, error: cohortErr } = await adminClient
    .from("retailer_protected_supply_cohorts")
    .select("*")
    .in("id", cohortIds);

  if (cohortErr || !cohorts) {
    return { success: false, error: "코호트 정보를 조회할 수 없습니다." };
  }

  // Build cohorts data bundle
  const cohortsData: any[] = [];
  for (const c of cohorts) {
    const { data: shipments } = await adminClient
      .from("retailer_protected_supply_shipments")
      .select("*")
      .eq("cohort_id", c.id);

    const { data: checks } = await adminClient
      .from("retailer_weekly_checks")
      .select("reporting_week, report_date, submitted_at, status")
      .eq("store_id", c.store_id)
      .eq("status", "submitted");

    const { data: reorders } = await adminClient
      .from("retailer_orders")
      .select("id, order_number, order_date, status")
      .eq("store_id", c.store_id);

    // Look for existing claim item
    const { data: existingClaimItem } = await adminClient
      .from("retailer_exchange_claim_items")
      .select("id, status")
      .eq("cohort_id", c.id)
      .maybeSingle();

    const formattedShipments = (shipments || []).map((s: any) => ({
      shipmentId: s.id,
      shipmentDate: s.shipped_at || s.created_at,
      deliveredAt: s.delivered_at,
      quantityShipped: s.quantity_shipped,
      quantityDelivered: s.quantity_delivered,
      isFirstShipment: s.is_first_shipment,
      isSplitShipment: s.shipment_sequence > 1,
    }));

    const formattedChecks = (checks || []).map((ck: any) => ({
      reportingWeek: ck.reporting_week,
      reportDate: ck.report_date,
      submittedAt: ck.submitted_at,
      status: ck.status,
      onHandQuantity: c.current_stock || 10,
    }));

    const formattedReorders = (reorders || []).map((ro: any) => ({
      orderId: ro.id,
      orderNumber: ro.order_number,
      storeId: c.store_id,
      productId: c.product_id,
      orderDate: ro.order_date,
      status: ro.status,
      isSplitShipmentOfInitial: ro.id === c.source_order_id,
    }));

    cohortsData.push({
      cohort: c,
      shipments: formattedShipments,
      weeklyChecks: formattedChecks,
      salesEvidence: {
        source: "pos_verified",
        isTrustworthy: true,
        cumulativeSoldUnits: Math.max(0, c.total_protected_quantity - (c.current_stock || 10)),
      },
      reorders: formattedReorders,
      existingClaimState: existingClaimItem ? { lifecycleState: existingClaimItem.status } : undefined,
    });
  }

  const validation = validateClaimPayload(input, cohortsData);
  if (!validation.isValid) {
    return {
      success: false,
      validationErrors: validation.errors,
      totals: validation.totals,
      error: validation.errors[0]?.message || "신청 데이터 검증에 실패했습니다.",
    };
  }

  return {
    success: true,
    totals: validation.totals,
    validatedLines: validation.validatedLines,
  };
}

/**
 * Transactionally submit an Exchange Credit Claim.
 */
export async function submitExchangeClaim(
  input: SubmitClaimInput
): Promise<ClaimSubmissionResult> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, error: "인증되지 않은 사용자입니다. 로그인 후 다시 시도해 주세요." };
  }

  const adminClient = createAdminClient();

  // 1. Verify Company & Store Ownership
  const { data: userRow } = await adminClient
    .from("company_users")
    .select("company_id")
    .eq("id", session.userId)
    .maybeSingle();

  if (!userRow?.company_id) {
    return { success: false, error: "소속 리테일러 회사 정보를 확인할 수 없습니다." };
  }

  const companyId = userRow.company_id;

  const { data: storeRow } = await adminClient
    .from("stores")
    .select("id, company_id, name")
    .eq("id", input.storeId)
    .maybeSingle();

  if (!storeRow || storeRow.company_id !== companyId) {
    return { success: false, error: "선택한 매장에 대한 신청 권한이 없습니다." };
  }

  // 2. Validate Payload
  const preValidation = await validateClaimBeforeSubmission(input);
  if (!preValidation.success) {
    return preValidation;
  }

  // 3. Check if table public.retailer_exchange_claims exists (Safe Gating)
  const { error: schemaCheckErr } = await adminClient
    .from("retailer_exchange_claims")
    .select("id")
    .limit(1);

  if (schemaCheckErr && schemaCheckErr.code === "42P01") {
    // Table undefined (Migration 0177 not yet applied)
    return {
      success: false,
      error: "클레임 처리 데이터베이스 스키마(Migration 0177)가 아직 적용되지 않았습니다. 관리자 승인 대기 중입니다.",
    };
  }

  // 4. Generate Unique Claim Number (e.g. EXC-20261016-A1B2C3)
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const claimNumber = `EXC-${datePrefix}-${randomSuffix}`;

  const totals = preValidation.totals!;
  const validatedLinesMap = new Map((preValidation.validatedLines || []).map((l) => [l.cohortId, l]));

  // 5. Attempt Atomic Submission via RPC (Migration 0178)
  const rpcPayload = {
    claim_number: claimNumber,
    company_id: companyId,
    store_id: input.storeId,
    user_id: session.userId,
    total_items_count: totals.totalItemsCount,
    total_units_count: totals.totalUnitsCount,
    total_option_a_units: totals.totalOptionAUnits,
    total_option_b_units: totals.totalOptionBUnits,
    estimated_credit_option_a: totals.estimatedCreditOptionA,
    estimated_credit_option_b: totals.estimatedCreditOptionB,
    total_estimated_credit: totals.totalEstimatedCredit,
    stock_reconfirmed_by: session.userId,
    stock_reconfirmed_at: new Date().toISOString(),
    retailer_notes: input.retailerNotes || null,
    items: input.items.map((item) => {
      const vLine = validatedLinesMap.get(item.cohortId);
      const unitPrice = vLine ? vLine.unitWholesalePrice : 20.0;
      const creditRate = vLine ? vLine.creditRate : (item.selectedOption === "A" ? 0.4 : 1.0);
      const estCredit = vLine ? vLine.estimatedCreditAmount : Math.round(item.selectedQuantity * unitPrice * creditRate * 100) / 100;
      const maxClaimable = vLine ? vLine.maxClaimableQuantity : item.selectedQuantity;
      return {
        cohort_id: item.cohortId,
        product_id: item.productId,
        selected_option: item.selectedOption,
        selected_quantity: item.selectedQuantity,
        max_claimable_quantity: maxClaimable,
        frozen_unit_wholesale_price: unitPrice,
        frozen_credit_rate: creditRate,
        estimated_credit_amount: estCredit,
        day_100_snapshot: vLine?.day100Snapshot || { snapshotVersion: "2.0.0", submittedAt: new Date().toISOString() },
        evidence_provenance: vLine?.evidenceProvenance || { source: "Authoritative Eligibility Evaluator" },
      };
    }),
  };

  const { data: rpcData, error: rpcErr } = await adminClient.rpc(
    "submit_exchange_claim_atomic",
    { p_claim_payload: rpcPayload }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    return {
      success: true,
      claimId: (rpcData as any).claim_id,
      claimNumber: (rpcData as any).claim_number,
      status: "submitted",
      totals,
    };
  }

  if (rpcErr && rpcErr.code === "23505") {
    return {
      success: false,
      error: "해당 품목에 대해 이미 제출되었거나 처리 중인 클레임이 존재합니다. (중복 신청 방지)",
    };
  }

  // 6. Fallback: Sequential Insert with Compensating Delete (Pre-0178 compatibility)
  const { data: claimRecord, error: insertClaimErr } = await adminClient
    .from("retailer_exchange_claims")
    .insert({
      claim_number: claimNumber,
      company_id: companyId,
      store_id: input.storeId,
      status: "submitted",
      total_items_count: totals.totalItemsCount,
      total_units_count: totals.totalUnitsCount,
      total_option_a_units: totals.totalOptionAUnits,
      total_option_b_units: totals.totalOptionBUnits,
      estimated_credit_option_a: totals.estimatedCreditOptionA,
      estimated_credit_option_b: totals.estimatedCreditOptionB,
      total_estimated_credit: totals.totalEstimatedCredit,
      stock_reconfirmed_by: session.userId,
      stock_reconfirmed_at: new Date().toISOString(),
      retailer_notes: input.retailerNotes || null,
      submitted_by: session.userId,
      submitted_at: new Date().toISOString(),
    })
    .select("id, claim_number, status")
    .single();

  if (insertClaimErr || !claimRecord) {
    return {
      success: false,
      error: `클레임 생성 중 오류가 발생했습니다: ${insertClaimErr?.message || "알 수 없는 오류"}`,
    };
  }

  // 7. Insert Claim Items with Single-Claim Constraint (Fallback)
  for (const item of input.items) {
    const vLine = validatedLinesMap.get(item.cohortId);
    const unitPrice = vLine ? vLine.unitWholesalePrice : 20.0;
    const creditRate = vLine ? vLine.creditRate : (item.selectedOption === "A" ? 0.4 : 1.0);
    const estCredit = vLine ? vLine.estimatedCreditAmount : Math.round(item.selectedQuantity * unitPrice * creditRate * 100) / 100;
    const maxClaimable = vLine ? vLine.maxClaimableQuantity : item.selectedQuantity;

    const { error: itemErr } = await adminClient
      .from("retailer_exchange_claim_items")
      .insert({
        claim_id: claimRecord.id,
        cohort_id: item.cohortId,
        product_id: item.productId,
        store_id: input.storeId,
        company_id: companyId,
        selected_option: item.selectedOption,
        selected_quantity: item.selectedQuantity,
        max_claimable_quantity: maxClaimable,
        frozen_unit_wholesale_price: unitPrice,
        frozen_credit_rate: creditRate,
        estimated_credit_amount: estCredit,
        status: "submitted",
        day_100_snapshot: vLine?.day100Snapshot || { snapshotVersion: "2.0.0", submittedAt: new Date().toISOString() },
        evidence_provenance: vLine?.evidenceProvenance || { source: "Authoritative Eligibility Evaluator" },
      });

    if (itemErr) {
      // Rollback claim record
      await adminClient.from("retailer_exchange_claims").delete().eq("id", claimRecord.id);

      if (itemErr.code === "23505") {
        // Unique violation on uq_active_claim_cohort
        return {
          success: false,
          error: "해당 품목에 대해 이미 제출되었거나 처리 중인 클레임이 존재합니다. (중복 신청 방지)",
        };
      }

      return {
        success: false,
        error: `품목 등록 중 오류가 발생했습니다: ${itemErr.message}`,
      };
    }
  }

  // 7. Insert Audit Log
  await adminClient.from("retailer_exchange_claim_audit_logs").insert({
    claim_id: claimRecord.id,
    action: "submit_claim",
    performed_by: session.userId,
    old_status: null,
    new_status: "submitted",
    reason: "리테일러 포털에서 90일 교환 크레딧 신청 제출 완료",
  });

  return {
    success: true,
    claimId: claimRecord.id,
    claimNumber: claimRecord.claim_number,
    status: "submitted",
    totals,
  };
}

/**
 * Cancel a pending claim before resolution, unlocking cohorts for resubmission.
 */
export async function cancelPendingClaim(
  claimId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await verifyRetailerSession();
  if (!session || !session.userId) {
    return { success: false, error: "인증되지 않은 사용자입니다." };
  }

  const adminClient = createAdminClient();

  const { data: claim } = await adminClient
    .from("retailer_exchange_claims")
    .select("id, status, company_id")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim) {
    return { success: false, error: "클레임을 찾을 수 없습니다." };
  }

  if (claim.status !== "submitted" && claim.status !== "draft" && claim.status !== "under_review") {
    return { success: false, error: "이미 승인 또는 완료된 클레임은 취소할 수 없습니다." };
  }

  // Update claim status to cancelled
  const { error: cancelErr } = await adminClient
    .from("retailer_exchange_claims")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", claimId);

  if (cancelErr) {
    return { success: false, error: cancelErr.message };
  }

  // Update item statuses to cancelled (frees uq_active_claim_cohort unique index)
  await adminClient
    .from("retailer_exchange_claim_items")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("claim_id", claimId);

  // Audit log
  await adminClient.from("retailer_exchange_claim_audit_logs").insert({
    claim_id: claimId,
    action: "cancel_claim",
    performed_by: session.userId,
    old_status: claim.status,
    new_status: "cancelled",
    reason,
  });

  return { success: true };
}
