"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RmaStatus,
  RmaAggregate,
  RmaItemLine,
  RmaBox,
  RmaException,
  WarehouseInspectionInput,
  ProposedSettlementInstruction,
} from "@/lib/retailer/rma";
import {
  filterOptionBLinesFromClaim,
  validateBoxLabelAllocation,
  validateRmaTransition,
  evaluateCarrierTrackingEvent,
  calculateShippingDeadline,
  calculateSettlementReadyAmount,
  reconcileWarehouseInspection,
  resolveAsOfDate,
  addCalendarDays,
  RMA_SHIPPING_DEADLINE_DAYS,
} from "@/lib/retailer/rma";
import type {
  CreateRmaResult,
  ApproveRmaInput,
  ApproveRmaResult,
  SaveBoxAllocationInput,
  SaveBoxAllocationResult,
  RecordTrackingEventInput,
  RecordTrackingEventResult,
  SaveInspectionDraftInput,
  CompleteInspectionInput,
  InspectionActionResult,
  RecordExceptionInput,
  ResolveExceptionInput,
  ExceptionActionResult,
  GetSettlementProposalResult,
  ListRmasResult,
  GetRmaDetailResult,
} from "./rma-backend-types";

/**
 * 1. Safe Schema Availability Check
 * Returns false cleanly if RMA tables do not exist in the database.
 */
export async function checkRmaSchemaAvailability(): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("retailer_exchange_rmas")
      .select("id")
      .limit(1);

    if (error) {
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist") ||
        error.message?.includes("relation")
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to generate a deterministic fallback RMA number if sequence is unavailable
 */
function generateFallbackRmaNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `RMA-${year}-${rand}`;
}

/**
 * 2. Create RMA from Approved Claim with Option B items
 * Enforces:
 * - One consolidated RMA per Store claim
 * - Rejects duplicate RMA creation for the same claim
 * - Filters only Option B items; excludes Option A
 * - Rejects cross-store claims
 */
export async function createRmaFromClaimAction(claimId: string): Promise<CreateRmaResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: false,
      error: "RMA schema is not yet applied to the database. Prepared migration pending execution.",
      errorCode: "SCHEMA_NOT_AVAILABLE",
    };
  }

  const supabase = createAdminClient();

  // 1. Check for existing RMA for this claim (Unique constraint guarantee)
  const { data: existingRma } = await supabase
    .from("retailer_exchange_rmas")
    .select("id, rma_number")
    .eq("claim_id", claimId)
    .maybeSingle();

  if (existingRma) {
    return {
      success: false,
      error: `An RMA (${existingRma.rma_number}) has already been generated for this claim.`,
      errorCode: "DUPLICATE_RMA_FOR_CLAIM",
      rmaId: existingRma.id,
      rmaNumber: existingRma.rma_number,
    };
  }

  // 2. Fetch Claim Header
  const { data: claim, error: claimErr } = await supabase
    .from("retailer_exchange_claims")
    .select("id, claim_number, store_id, company_id, status")
    .eq("id", claimId)
    .maybeSingle();

  if (claimErr || !claim) {
    return {
      success: false,
      error: `Claim not found: ${claimErr?.message || "Invalid claim ID"}`,
      errorCode: "CLAIM_NOT_FOUND",
    };
  }

  // 3. Fetch Claim Items
  const { data: claimItems, error: itemsErr } = await supabase
    .from("retailer_exchange_claim_items")
    .select(`
      id,
      cohort_id,
      product_id,
      store_id,
      company_id,
      selected_option,
      selected_quantity,
      frozen_unit_wholesale_price,
      products (name, sku)
    `)
    .eq("claim_id", claimId);

  if (itemsErr || !claimItems || claimItems.length === 0) {
    return {
      success: false,
      error: `No items found for claim: ${itemsErr?.message || "Empty items"}`,
      errorCode: "NO_CLAIM_ITEMS",
    };
  }

  // 4. Use Pure RMA Engine to filter Option B items
  const formattedItems = claimItems.map((item: any) => ({
    claimItemId: item.id,
    cohortId: item.cohort_id,
    productId: item.product_id,
    productName: item.products?.name || "Product",
    productSku: item.products?.sku || "SKU",
    selectedOption: item.selected_option as "A" | "B",
    selectedQuantity: item.selected_quantity,
    frozenUnitWholesalePrice: Number(item.frozen_unit_wholesale_price),
    storeId: item.store_id,
  }));

  const filterResult = filterOptionBLinesFromClaim({
    claimId: claim.id,
    claimNumber: claim.claim_number,
    storeId: claim.store_id,
    companyId: claim.company_id,
    items: formattedItems,
  });

  if (!filterResult.success) {
    return {
      success: false,
      error: filterResult.error,
      errorCode: filterResult.errorCode,
    };
  }

  const optionBLines = filterResult.optionBLines;
  const totalRequestedUnits = optionBLines.reduce((acc, l) => acc + l.quantityRequested, 0);
  const totalWholesaleValueCents = optionBLines.reduce(
    (acc, l) => acc + l.quantityRequested * l.frozenWholesalePriceCents,
    0
  );
  const totalWholesaleValueDollars = totalWholesaleValueCents / 100;

  // 5. Generate RMA Number
  let rmaNumber = generateFallbackRmaNumber();
  try {
    const { data: rpcCode } = await supabase.rpc("generate_exchange_rma_code");
    if (rpcCode && typeof rpcCode === "string") {
      rmaNumber = rpcCode;
    }
  } catch {
    // Fallback generated above
  }

  // 6. Insert RMA Header
  const { data: newRma, error: insertRmaErr } = await supabase
    .from("retailer_exchange_rmas")
    .insert({
      rma_number: rmaNumber,
      claim_id: claim.id,
      store_id: claim.store_id,
      company_id: claim.company_id,
      status: "awaiting_admin_approval",
      total_lines_count: optionBLines.length,
      total_requested_units: totalRequestedUnits,
      total_authorized_units: totalRequestedUnits, // Default authorized = requested
      total_wholesale_value_cents: totalWholesaleValueCents,
      total_wholesale_value_dollars: totalWholesaleValueDollars,
    })
    .select("id, rma_number")
    .single();

  if (insertRmaErr || !newRma) {
    return {
      success: false,
      error: `Failed to create RMA header: ${insertRmaErr?.message}`,
      errorCode: "INSERT_RMA_FAILED",
    };
  }

  // 7. Insert RMA Lines
  const linesToInsert = optionBLines.map((line) => ({
    rma_id: newRma.id,
    claim_item_id: line.claimItemId,
    cohort_id: line.cohortId,
    product_id: line.productId,
    quantity_requested: line.quantityRequested,
    quantity_authorized: line.quantityAuthorized,
    frozen_unit_wholesale_price: line.frozenUnitWholesalePrice,
    frozen_wholesale_price_cents: line.frozenWholesalePriceCents,
  }));

  const { error: linesInsertErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .insert(linesToInsert);

  if (linesInsertErr) {
    // Cleanup orphaned header
    await supabase.from("retailer_exchange_rmas").delete().eq("id", newRma.id);
    return {
      success: false,
      error: `Failed to create RMA lines: ${linesInsertErr.message}`,
      errorCode: "INSERT_RMA_LINES_FAILED",
    };
  }

  // 8. Record Initial Audit Log
  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: newRma.id,
    event_type: "RMA_CREATED",
    old_status: null,
    new_status: "awaiting_admin_approval",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "admin",
    reason: `RMA generated from Claim ${claim.claim_number} with ${optionBLines.length} Option B lines.`,
  });

  revalidatePath("/admin/exchange-credit");

  return {
    success: true,
    rmaId: newRma.id,
    rmaNumber: newRma.rma_number,
    claimId: claim.id,
    optionBLinesCount: optionBLines.length,
    totalRequestedUnits,
  };
}

/**
 * 3. Approve RMA Action
 * Enforces 14-calendar-day shipping deadline (Day 0 = approval, Day 14 = deadline)
 */
export async function approveRmaAction(input: ApproveRmaInput): Promise<ApproveRmaResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable in database.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: rmaRow, error: fetchErr } = await supabase
    .from("retailer_exchange_rmas")
    .select("*")
    .eq("id", input.rmaId)
    .maybeSingle();

  if (fetchErr || !rmaRow) {
    return { success: false, error: "RMA not found.", errorCode: "RMA_NOT_FOUND" };
  }

  // Use pure engine to validate transition
  const asOf = resolveAsOfDate(input.asOfDate);
  const transition = validateRmaTransition(
    {
      ...rmaRow,
      lines: [],
      boxes: [],
      eventHistory: [],
      exceptions: [],
      inspectionRecord: null,
      settlementInstruction: null,
    },
    {
      eventType: "RMA_APPROVED",
      actor: { userId: session.userId, role: "admin", name: "Admin" },
      asOfDate: asOf,
      reason: input.adminNotes,
    }
  );

  if (!transition.success) {
    return { success: false, error: transition.error, errorCode: transition.errorCode };
  }

  const approvalDate = asOf;
  const deadlineDate = addCalendarDays(approvalDate, RMA_SHIPPING_DEADLINE_DAYS);

  const { error: updateErr } = await supabase
    .from("retailer_exchange_rmas")
    .update({
      status: "approved",
      approval_date: approvalDate,
      shipping_deadline_date: deadlineDate,
      approved_by: session.userId,
      approved_at: new Date().toISOString(),
      admin_notes: input.adminNotes || rmaRow.admin_notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.rmaId);

  if (updateErr) {
    return { success: false, error: updateErr.message, errorCode: "UPDATE_FAILED" };
  }

  // Audit log
  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "RMA_APPROVED",
    old_status: rmaRow.status,
    new_status: "approved",
    actor_id: session.userId,
    actor_name: "Admin",
    actor_role: "admin",
    reason: input.adminNotes || "Admin approved Option B return request.",
  });

  revalidatePath("/admin/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    status: "approved",
    approvalDate,
    shippingDeadlineDate: deadlineDate,
  };
}

/**
 * 4. Save Box & Shipping Label Allocation
 * Validates 1 label per box and quantity reconciliation across boxes
 */
export async function saveRmaBoxAllocationAction(
  input: SaveBoxAllocationInput
): Promise<SaveBoxAllocationResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable in database.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  // Fetch authorized lines
  const { data: lines, error: linesErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .select("id, quantity_authorized")
    .eq("rma_id", input.rmaId);

  if (linesErr || !lines || lines.length === 0) {
    return { success: false, error: "RMA lines not found.", errorCode: "LINES_NOT_FOUND" };
  }

  const mappedLines: RmaItemLine[] = lines.map((l: any) => ({
    id: l.id,
    claimId: "",
    claimItemId: "",
    cohortId: "",
    productId: "",
    productName: "",
    productSku: "",
    selectedOption: "B",
    quantityRequested: l.quantity_authorized,
    quantityAuthorized: l.quantity_authorized,
    frozenUnitWholesalePrice: 0,
    frozenWholesalePriceCents: 0,
  }));

  // Pure validation
  const validation = validateBoxLabelAllocation(input.boxes, mappedLines);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join("; "),
      errorCode: "BOX_ALLOCATION_INVALID",
    };
  }

  // Delete previous box allocations for clean idempotency
  await supabase.from("retailer_exchange_rma_boxes").delete().eq("rma_id", input.rmaId);

  // Insert boxes
  for (const box of validation.validatedBoxes || []) {
    const { data: newBox, error: boxErr } = await supabase
      .from("retailer_exchange_rma_boxes")
      .insert({
        rma_id: input.rmaId,
        box_number: box.boxNumber,
        carrier: box.carrier,
        tracking_number: box.trackingNumber,
        label_url: box.labelUrl,
        status: box.status,
      })
      .select("id")
      .single();

    if (boxErr || !newBox) {
      return { success: false, error: boxErr?.message || "Failed to save box", errorCode: "SAVE_BOX_FAILED" };
    }

    // Insert line allocations
    const allocToInsert = box.assignedLines.map((asgn) => ({
      box_id: newBox.id,
      rma_line_id: asgn.lineId,
      quantity: asgn.quantity,
    }));

    await supabase.from("retailer_exchange_rma_box_allocations").insert(allocToInsert);
  }

  revalidatePath("/admin/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    boxesCount: input.boxes.length,
  };
}

/**
 * 5. Record Carrier Tracking Event
 * Automatically evaluates Day 14 deadline and carrier lost parcel policies
 */
export async function recordRmaCarrierTrackingEventAction(
  input: RecordTrackingEventInput
): Promise<RecordTrackingEventResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable in database.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: rma, error: rmaErr } = await supabase
    .from("retailer_exchange_rmas")
    .select(`
      *,
      retailer_exchange_rma_boxes (*)
    `)
    .eq("id", input.rmaId)
    .maybeSingle();

  if (rmaErr || !rma) {
    return { success: false, error: "RMA not found.", errorCode: "RMA_NOT_FOUND" };
  }

  const boxes: RmaBox[] = (rma.retailer_exchange_rma_boxes || []).map((b: any) => ({
    id: b.id,
    boxNumber: b.box_number,
    carrier: b.carrier,
    trackingNumber: b.tracking_number,
    status: b.status,
    carrierEvents: [],
    assignedLines: [],
  }));

  const rmaAggregate: RmaAggregate = {
    ...rma,
    rmaNumber: rma.rma_number,
    claimId: rma.claim_id,
    claimNumber: "",
    storeId: rma.store_id,
    companyId: rma.company_id,
    lines: [],
    boxes,
    approvalDate: rma.approval_date,
    shippingDeadlineDate: rma.shipping_deadline_date,
    inspectionRecord: null,
    settlementInstruction: null,
    exceptions: [],
    eventHistory: [],
  };

  const evalResult = evaluateCarrierTrackingEvent(
    rmaAggregate,
    input.boxId,
    input.event,
    input.asOfDate
  );

  // Update box status
  await supabase
    .from("retailer_exchange_rma_boxes")
    .update({
      status: evalResult.boxStatus,
      shipped_at: evalResult.boxStatus === "in_transit" ? input.event.timestamp : undefined,
      delivered_at: evalResult.boxStatus === "delivered" ? input.event.timestamp : undefined,
    })
    .eq("id", input.boxId);

  // Flag exception if raised (e.g. LATE_CARRIER_SCAN or CARRIER_LOST_PARCEL)
  let exceptionRaised = false;
  if (evalResult.exceptionRaised) {
    exceptionRaised = true;
    await supabase.from("retailer_exchange_rma_exceptions").insert({
      rma_id: input.rmaId,
      code: evalResult.exceptionRaised.code,
      severity: evalResult.exceptionRaised.severity,
      description: evalResult.exceptionRaised.description,
      requires_admin_review: evalResult.exceptionRaised.requiresAdminReview,
      flag_carrier_claim: evalResult.exceptionRaised.flagCarrierClaim,
    });
  }

  // Update RMA status if recommended
  if (evalResult.recommendedRmaStatus !== rma.status) {
    await supabase
      .from("retailer_exchange_rmas")
      .update({
        status: evalResult.recommendedRmaStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.rmaId);

    await supabase.from("retailer_exchange_rma_audit_logs").insert({
      rma_id: input.rmaId,
      event_type: input.event.eventType === "delivered" ? "CARRIER_DELIVERED" : "CARRIER_IN_TRANSIT",
      old_status: rma.status,
      new_status: evalResult.recommendedRmaStatus,
      actor_id: session.userId,
      actor_role: "carrier_webhook",
      reason: input.event.description || `Tracking update from ${input.event.trackingNumber}`,
    });
  }

  revalidatePath("/admin/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    boxId: input.boxId,
    boxStatus: evalResult.boxStatus,
    rmaStatus: evalResult.recommendedRmaStatus,
    exceptionRaised,
  };
}

/**
 * 6. Save Warehouse Inspection Draft
 */
export async function saveWarehouseInspectionDraftAction(
  input: SaveInspectionDraftInput
): Promise<InspectionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  // Upsert inspection header with is_draft = true
  const { data: insp, error: inspErr } = await supabase
    .from("retailer_exchange_rma_inspections")
    .upsert(
      {
        rma_id: input.rmaId,
        box_condition: input.inspectionInput.boxCondition,
        inspector_id: session.userId,
        inspector_name: input.inspectionInput.inspectedBy.name,
        inspector_role: input.inspectionInput.inspectedBy.role || "inspector",
        total_authorized: 0,
        total_received: 0,
        total_accepted_resaleable: 0,
        total_rejected: 0,
        total_missing: 0,
        has_discrepancies: false,
        is_draft: true,
        overall_notes: input.inspectionInput.overallNotes,
        inspected_at: new Date().toISOString(),
      },
      { onConflict: "rma_id" }
    )
    .select("id")
    .single();

  if (inspErr || !insp) {
    return { success: false, error: inspErr?.message || "Failed to save draft", errorCode: "DRAFT_SAVE_FAILED" };
  }

  // Update RMA status to inspection_in_progress
  await supabase
    .from("retailer_exchange_rmas")
    .update({ status: "inspection_in_progress", updated_at: new Date().toISOString() })
    .eq("id", input.rmaId);

  return {
    success: true,
    rmaId: input.rmaId,
    inspectionId: insp.id,
    isDraft: true,
  };
}

/**
 * 7. Complete Warehouse Inspection Action
 * Enforces strict quantity invariants:
 * - Accepted <= Received
 * - Accepted <= Authorized
 * - Received = Accepted + Rejected
 */
export async function completeWarehouseInspectionAction(
  input: CompleteInspectionInput
): Promise<InspectionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  // Fetch authorized lines
  const { data: lines, error: linesErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .select(`
      id,
      product_id,
      quantity_authorized,
      products (name, sku)
    `)
    .eq("rma_id", input.rmaId);

  if (linesErr || !lines || lines.length === 0) {
    return { success: false, error: "Authorized lines not found.", errorCode: "LINES_NOT_FOUND" };
  }

  const mappedLines: RmaItemLine[] = lines.map((l: any) => ({
    id: l.id,
    claimId: "",
    claimItemId: "",
    cohortId: "",
    productId: l.product_id,
    productName: l.products?.name || "Product",
    productSku: l.products?.sku || "SKU",
    selectedOption: "B",
    quantityRequested: l.quantity_authorized,
    quantityAuthorized: l.quantity_authorized,
    frozenUnitWholesalePrice: 0,
    frozenWholesalePriceCents: 0,
  }));

  // Pure reconciliation validation
  const reconciliation = reconcileWarehouseInspection(
    mappedLines,
    input.inspectionInput,
    input.rmaId
  );

  if (!reconciliation.success) {
    return {
      success: false,
      error: reconciliation.errors.join("; "),
      errorCode: reconciliation.errorCode || "INSPECTION_INVARIANT_VIOLATION",
    };
  }

  const record = reconciliation.inspectionRecord!;

  // Persist Inspection Record
  const { data: savedInsp, error: inspSaveErr } = await supabase
    .from("retailer_exchange_rma_inspections")
    .upsert(
      {
        rma_id: input.rmaId,
        box_condition: record.boxCondition,
        inspector_id: session.userId,
        inspector_name: record.inspectedBy.name,
        inspector_role: record.inspectedBy.role,
        total_authorized: record.totalAuthorized,
        total_received: record.totalReceived,
        total_accepted_resaleable: record.totalAcceptedResaleable,
        total_rejected: record.totalRejected,
        total_missing: record.totalMissing,
        has_discrepancies: record.hasDiscrepancies,
        is_draft: false,
        overall_notes: record.overallNotes,
        inspected_at: record.inspectedAt,
      },
      { onConflict: "rma_id" }
    )
    .select("id")
    .single();

  if (inspSaveErr || !savedInsp) {
    return { success: false, error: inspSaveErr?.message || "Failed to persist inspection.", errorCode: "SAVE_FAILED" };
  }

  // Delete previous inspection lines for clean idempotency
  await supabase
    .from("retailer_exchange_rma_inspection_lines")
    .delete()
    .eq("inspection_id", savedInsp.id);

  // Insert inspection lines
  const linesToInsert = record.lines.map((l) => ({
    inspection_id: savedInsp.id,
    rma_line_id: l.lineId,
    quantity_authorized: l.quantityAuthorized,
    quantity_received: l.quantityReceived,
    quantity_accepted_resaleable: l.quantityAcceptedResaleable,
    quantity_rejected: l.quantityRejected,
    quantity_missing: l.quantityMissing,
    rejection_reason: l.rejectionReason,
    discrepancy_type: l.discrepancyType,
    discrepancy_notes: l.discrepancyNotes,
  }));

  await supabase.from("retailer_exchange_rma_inspection_lines").insert(linesToInsert);

  // Persist any exceptions raised during inspection
  for (const ex of reconciliation.exceptionsRaised) {
    await supabase.from("retailer_exchange_rma_exceptions").insert({
      rma_id: input.rmaId,
      code: ex.code,
      severity: ex.severity,
      description: ex.description,
      requires_admin_review: ex.requiresAdminReview,
      flag_carrier_claim: ex.flagCarrierClaim,
    });
  }

  // Update RMA status to inspection_completed (or exception if discrepancies require admin review)
  const targetStatus: RmaStatus = record.hasDiscrepancies ? "exception" : "inspection_completed";
  await supabase
    .from("retailer_exchange_rmas")
    .update({
      status: targetStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.rmaId);

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "INSPECTION_RECORDED",
    old_status: "inspection_in_progress",
    new_status: targetStatus,
    actor_id: session.userId,
    actor_name: record.inspectedBy.name,
    actor_role: record.inspectedBy.role,
    reason: `Inspection completed: ${record.totalAcceptedResaleable} accepted, ${record.totalRejected} rejected, ${record.totalMissing} missing.`,
  });

  revalidatePath("/admin/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    inspectionId: savedInsp.id,
    isDraft: false,
    totalAcceptedResaleable: record.totalAcceptedResaleable,
    hasDiscrepancies: record.hasDiscrepancies,
  };
}

/**
 * 8. Retrieve Proposed Settlement Instruction
 * STRICT FINANCIAL SAFETY:
 * Calculates expected credit (100% of frozen wholesale price for accepted units).
 * Returns settlement proposal only. Does NOT issue actual credit or touch Checkout.
 */
export async function getProposedSettlementInstructionAction(
  rmaId: string
): Promise<GetSettlementProposalResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId) {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable in database.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: rma, error: rmaErr } = await supabase
    .from("retailer_exchange_rmas")
    .select(`
      *,
      retailer_exchange_rma_lines (*, products(sku)),
      retailer_exchange_rma_inspections (*, retailer_exchange_rma_inspection_lines(*))
    `)
    .eq("id", rmaId)
    .maybeSingle();

  if (rmaErr || !rma) {
    return { success: false, error: "RMA not found.", errorCode: "RMA_NOT_FOUND" };
  }

  const inspectionRow = rma.retailer_exchange_rma_inspections;
  if (!inspectionRow || inspectionRow.is_draft) {
    return {
      success: false,
      error: "Credit calculation is strictly forbidden before warehouse inspection is completed.",
      errorCode: "NO_CREDIT_BEFORE_INSPECTION",
    };
  }

  const lines: RmaItemLine[] = (rma.retailer_exchange_rma_lines || []).map((l: any) => ({
    id: l.id,
    claimId: rma.claim_id,
    claimItemId: l.claim_item_id,
    cohortId: l.cohort_id,
    productId: l.product_id,
    productName: "",
    productSku: l.products?.sku || "SKU",
    selectedOption: "B",
    quantityRequested: l.quantity_requested,
    quantityAuthorized: l.quantity_authorized,
    frozenUnitWholesalePrice: Number(l.frozen_unit_wholesale_price),
    frozenWholesalePriceCents: l.frozen_wholesale_price_cents,
  }));

  const inspectionRecord = {
    id: inspectionRow.id,
    rmaId: rma.id,
    inspectedBy: {
      userId: inspectionRow.inspector_id,
      name: inspectionRow.inspector_name,
      role: inspectionRow.inspector_role,
    },
    inspectedAt: inspectionRow.inspected_at,
    boxCondition: inspectionRow.box_condition,
    lines: (inspectionRow.retailer_exchange_rma_inspection_lines || []).map((il: any) => ({
      lineId: il.rma_line_id,
      productId: "",
      productSku: "",
      productName: "",
      quantityAuthorized: il.quantity_authorized,
      quantityReceived: il.quantity_received,
      quantityAcceptedResaleable: il.quantity_accepted_resaleable,
      quantityRejected: il.quantity_rejected,
      quantityMissing: il.quantity_missing,
      rejectionReason: il.rejection_reason,
      discrepancyType: il.discrepancy_type,
    })),
    totalAuthorized: inspectionRow.total_authorized,
    totalReceived: inspectionRow.total_received,
    totalAcceptedResaleable: inspectionRow.total_accepted_resaleable,
    totalRejected: inspectionRow.total_rejected,
    totalMissing: inspectionRow.total_missing,
    hasDiscrepancies: inspectionRow.has_discrepancies,
  };

  const rmaAggregate: RmaAggregate = {
    ...rma,
    rmaNumber: rma.rma_number,
    claimId: rma.claim_id,
    claimNumber: "",
    storeId: rma.store_id,
    companyId: rma.company_id,
    lines,
    boxes: [],
    approvalDate: rma.approval_date,
    shippingDeadlineDate: rma.shipping_deadline_date,
    inspectionRecord,
    settlementInstruction: null,
    exceptions: [],
    eventHistory: [],
  };

  const calcResult = calculateSettlementReadyAmount(
    rmaAggregate,
    inspectionRecord,
    session.userId
  );

  if (!calcResult.success) {
    return { success: false, error: calcResult.error, errorCode: calcResult.errorCode };
  }

  return {
    success: true,
    rmaId,
    settlementInstruction: calcResult.settlementInstruction,
  };
}
