"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
 * Helper to verify Retailer Company and Store Scope
 * Enforces active membership in company_users.
 */
export async function verifyRetailerCompanyAccess(
  companyId: string,
  storeId?: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: "Unauthorized: Active user session required.", errorCode: "UNAUTHORIZED" };
    }

    const adminClient = createAdminClient();
    const { data: companyUser, error: cuErr } = await adminClient
      .from("company_users")
      .select("id, company_id, status")
      .eq("email", user.email)
      .eq("company_id", companyId)
      .maybeSingle();

    if (cuErr || !companyUser) {
      return { success: false, error: "Forbidden: Not a member of the specified company.", errorCode: "FORBIDDEN" };
    }

    if (companyUser.status !== "active") {
      return {
        success: false,
        error: `Forbidden: Company membership is ${companyUser.status}. Active status required.`,
        errorCode: "INACTIVE_MEMBERSHIP",
      };
    }

    if (storeId) {
      const { data: store, error: storeErr } = await adminClient
        .from("stores")
        .select("id, company_id")
        .eq("id", storeId)
        .maybeSingle();

      if (storeErr || !store || store.company_id !== companyId) {
        return { success: false, error: "Forbidden: Store does not belong to your company.", errorCode: "CROSS_STORE_FORBIDDEN" };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Authorization check failed.", errorCode: "AUTH_CHECK_FAILED" };
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
 * - Executes via atomic stored procedure create_exchange_rma_atomic (or fallback)
 */
export async function createRmaFromClaimAction(claimId: string): Promise<CreateRmaResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
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

  // 1. Check for existing RMA for this claim (Idempotency / Unique constraint check)
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

  // 5. Attempt Atomic Creation via PostgreSQL Stored Procedure (create_exchange_rma_atomic)
  const rpcPayload = {
    claim_id: claim.id,
    company_id: claim.company_id,
    store_id: claim.store_id,
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    idempotency_key: `rma_create:${claim.id}`,
    total_requested_units: totalRequestedUnits,
    total_wholesale_value_cents: totalWholesaleValueCents,
    total_wholesale_value_dollars: totalWholesaleValueDollars,
    lines: optionBLines.map((line) => ({
      claim_item_id: line.claimItemId,
      cohort_id: line.cohortId,
      product_id: line.productId,
      quantity_requested: line.quantityRequested,
      quantity_authorized: line.quantityAuthorized,
      frozen_unit_wholesale_price: line.frozenUnitWholesalePrice,
      frozen_wholesale_price_cents: line.frozenWholesalePriceCents,
    })),
  };

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "create_exchange_rma_atomic",
    { p_payload: rpcPayload }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    revalidatePath("/admin/retail-network/exchange-credit");
    return {
      success: true,
      rmaId: (rpcData as any).rma_id,
      rmaNumber: (rpcData as any).rma_number,
      claimId: claim.id,
      optionBLinesCount: optionBLines.length,
      totalRequestedUnits,
    };
  }

  if (rpcErr && (rpcErr.message?.includes("DUPLICATE_RMA_FOR_CLAIM") || rpcErr.code === "23505")) {
    return {
      success: false,
      error: `An RMA has already been generated for this claim.`,
      errorCode: "DUPLICATE_RMA_FOR_CLAIM",
    };
  }

  // 6. Development Fallback: Sequential Insert with Compensating Delete (Pre-Migration Compatibility)
  let rmaNumber = generateFallbackRmaNumber();
  try {
    const { data: rpcCode } = await supabase.rpc("generate_exchange_rma_code");
    if (rpcCode && typeof rpcCode === "string") {
      rmaNumber = rpcCode;
    }
  } catch {
    // Fallback generated above
  }

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
      total_authorized_units: totalRequestedUnits,
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
    await supabase.from("retailer_exchange_rmas").delete().eq("id", newRma.id);
    return {
      success: false,
      error: `Failed to insert RMA lines: ${linesInsertErr.message}`,
      errorCode: "INSERT_LINES_FAILED",
    };
  }

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: newRma.id,
    event_type: "RMA_CREATED_FROM_CLAIM",
    new_status: "awaiting_admin_approval",
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    actor_role: "admin",
    reason: "RMA created from Option B items on approved claim",
    metadata: { claim_id: claim.id, rma_number: newRma.rma_number },
    idempotency_key: `rma_create:${claim.id}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

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
 * Enforces 14-calendar-day shipping deadline
 */
export async function approveRmaAction(input: ApproveRmaInput): Promise<ApproveRmaResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: rma, error: rmaErr } = await supabase
    .from("retailer_exchange_rmas")
    .select("id, rma_number, claim_id, store_id, company_id, status, created_at, updated_at")
    .eq("id", input.rmaId)
    .maybeSingle();

  if (rmaErr || !rma) {
    return { success: false, error: "RMA not found.", errorCode: "RMA_NOT_FOUND" };
  }

  const rmaAggregate: RmaAggregate = {
    id: rma.id,
    rmaNumber: rma.rma_number || "",
    claimId: rma.claim_id || "",
    claimNumber: "",
    storeId: rma.store_id || "",
    companyId: rma.company_id || "",
    status: rma.status as RmaStatus,
    lines: [],
    boxes: [],
    approvalDate: null,
    shippingDeadlineDate: null,
    inspectionRecord: null,
    settlementInstruction: null,
    exceptions: [],
    eventHistory: [],
    createdAt: rma.created_at || new Date().toISOString(),
    updatedAt: rma.updated_at || new Date().toISOString(),
  };

  const transitionCheck = validateRmaTransition(rmaAggregate, {
    eventType: "RMA_APPROVED",
    actor: { userId: session.userId, role: "admin", name: session.email || "Admin" },
    asOfDate: input.asOfDate,
  });

  if (!transitionCheck.success) {
    return {
      success: false,
      error: transitionCheck.error,
      errorCode: transitionCheck.errorCode || "INVALID_STATE_TRANSITION",
    };
  }

  const approvalDate = input.asOfDate || resolveAsOfDate();
  const deadlineCalc = calculateShippingDeadline(approvalDate, approvalDate);

  const { error: updateErr } = await supabase
    .from("retailer_exchange_rmas")
    .update({
      status: "approved",
      approval_date: approvalDate,
      shipping_deadline_date: deadlineCalc.deadlineDate,
      approved_by: session.userId,
      approved_at: new Date().toISOString(),
      admin_notes: input.adminNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.rmaId);

  if (updateErr) {
    return { success: false, error: updateErr.message, errorCode: "UPDATE_FAILED" };
  }

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "RMA_APPROVED",
    old_status: rma.status,
    new_status: "approved",
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    actor_role: "admin",
    reason: input.adminNotes || "RMA approved with 14-day return window",
    metadata: {
      approvalDate,
      shippingDeadlineDate: deadlineCalc.deadlineDate,
      windowDays: RMA_SHIPPING_DEADLINE_DAYS,
    },
    idempotency_key: `rma_approve:${input.rmaId}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    status: "approved",
    approvalDate,
    shippingDeadlineDate: deadlineCalc.deadlineDate,
  };
}

/**
 * 4. Save Multi-Box & Shipping Label Allocation
 * Enforces 1 label per box and complete quantity allocation
 */
export async function saveRmaBoxAllocationsAction(
  input: SaveBoxAllocationInput
): Promise<SaveBoxAllocationResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: lines, error: linesErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .select("id, quantity_authorized, product_id, products(sku)")
    .eq("rma_id", input.rmaId);

  if (linesErr || !lines || lines.length === 0) {
    return { success: false, error: "RMA lines not found.", errorCode: "LINES_NOT_FOUND" };
  }

  const mappedLines: RmaItemLine[] = lines.map((l: any) => ({
    id: l.id,
    claimId: "",
    claimItemId: "",
    cohortId: "",
    productId: l.product_id,
    productName: "",
    productSku: l.products?.sku || "SKU",
    selectedOption: "B",
    quantityRequested: l.quantity_authorized,
    quantityAuthorized: l.quantity_authorized,
    frozenUnitWholesalePrice: 0,
    frozenWholesalePriceCents: 0,
    boxId: null,
  }));

  const validation = validateBoxLabelAllocation(input.boxes, mappedLines);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join("; "),
      errorCode: "INVALID_BOX_ALLOCATION",
    };
  }

  // 1. Attempt Atomic Save via PostgreSQL Stored Procedure (save_rma_box_allocations_atomic)
  const rpcPayload = {
    rma_id: input.rmaId,
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    idempotency_key: `box_alloc:${input.rmaId}:${input.boxes.length}`,
    boxes: input.boxes.map((b) => ({
      box_number: b.boxNumber,
      carrier: b.carrier,
      tracking_number: b.trackingNumber,
      label_url: b.labelUrl || null,
      status: "label_created",
      assigned_lines: b.assignedLines.map((al) => ({
        line_id: al.lineId,
        quantity: al.quantity,
      })),
    })),
  };

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "save_rma_box_allocations_atomic",
    { p_payload: rpcPayload }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    revalidatePath("/admin/retail-network/exchange-credit");
    return {
      success: true,
      rmaId: input.rmaId,
      boxesCount: input.boxes.length,
    };
  }

  // 2. Fallback: Sequential Box Insertion
  await supabase.from("retailer_exchange_rma_boxes").delete().eq("rma_id", input.rmaId);

  for (const box of input.boxes) {
    const { data: insertedBox, error: boxErr } = await supabase
      .from("retailer_exchange_rma_boxes")
      .insert({
        rma_id: input.rmaId,
        box_number: box.boxNumber,
        carrier: box.carrier,
        tracking_number: box.trackingNumber,
        label_url: box.labelUrl || null,
        status: "label_created",
      })
      .select("id")
      .single();

    if (boxErr || !insertedBox) {
      return { success: false, error: `Failed to save box: ${boxErr?.message}`, errorCode: "SAVE_BOX_FAILED" };
    }

    if (box.assignedLines && box.assignedLines.length > 0) {
      const allocRows = box.assignedLines.map((al) => ({
        box_id: insertedBox.id,
        rma_line_id: al.lineId,
        quantity: al.quantity,
      }));
      await supabase.from("retailer_exchange_rma_box_allocations").insert(allocRows);
    }
  }

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "BOX_ALLOCATION_UPDATED",
    new_status: "approved",
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    actor_role: "admin",
    reason: "Shipping boxes and SKU allocations saved",
    metadata: { boxes_count: input.boxes.length },
    idempotency_key: `box_alloc:${input.rmaId}:${input.boxes.length}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

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
  if (!session || !session.userId || session.role !== "admin") {
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
    createdAt: rma.created_at || new Date().toISOString(),
    updatedAt: rma.updated_at || new Date().toISOString(),
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

  // Flag exception if raised
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

    const idempotencyKey = `tracking:${input.boxId}:${input.event.trackingNumber}:${input.event.eventType}`;
    await supabase.from("retailer_exchange_rma_audit_logs").insert({
      rma_id: input.rmaId,
      event_type: input.event.eventType === "delivered" ? "CARRIER_DELIVERED" : "CARRIER_IN_TRANSIT",
      old_status: rma.status,
      new_status: evalResult.recommendedRmaStatus,
      actor_id: session.userId,
      actor_role: "carrier_webhook",
      reason: input.event.description || `Tracking update from ${input.event.trackingNumber}`,
      idempotency_key: idempotencyKey,
    });
  }

  revalidatePath("/admin/retail-network/exchange-credit");

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
 * 6. Save Warehouse Inspection Draft Action
 * Permits unclassified received units (Draft Mode)
 * Rejects if inspection is already finalized (Immutability guarantee)
 */
export async function saveWarehouseInspectionDraftAction(
  input: SaveInspectionDraftInput
): Promise<InspectionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin/Inspector session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  // 1. Check if inspection is already finalized (IMMUTABLE)
  const { data: existingInsp } = await supabase
    .from("retailer_exchange_rma_inspections")
    .select("id, is_draft")
    .eq("rma_id", input.rmaId)
    .maybeSingle();

  if (existingInsp && existingInsp.is_draft === false) {
    return {
      success: false,
      error: "Finalized warehouse inspection is immutable and cannot be overwritten with a draft.",
      errorCode: "FINALIZED_INSPECTION_IMMUTABLE",
    };
  }

  // 2. Fetch authorized lines for draft validation
  const { data: lines, error: linesErr } = await supabase
    .from("retailer_exchange_rma_lines")
    .select("id, product_id, quantity_authorized, products(sku, name)")
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
    boxId: null,
  }));

  // 3. Draft Reconciliation Validation (Allows unclassified units)
  const draftValidation = reconcileWarehouseInspection(
    mappedLines,
    input.inspectionInput,
    input.rmaId,
    { isDraft: true }
  );

  if (!draftValidation.success) {
    return {
      success: false,
      error: draftValidation.errors.join("; "),
      errorCode: draftValidation.errorCode || "DRAFT_INVARIANT_VIOLATION",
    };
  }

  const record = draftValidation.inspectionRecord!;

  // 4. Attempt Atomic Stored Procedure (save_warehouse_inspection_draft_atomic)
  const rpcPayload = {
    rma_id: input.rmaId,
    inspector_id: session.userId,
    inspector_name: record.inspectedBy.name,
    inspector_role: record.inspectedBy.role || "inspector",
    box_condition: record.boxCondition,
    overall_notes: record.overallNotes,
    total_authorized: record.totalAuthorized,
    total_received: record.totalReceived,
    total_accepted_resaleable: record.totalAcceptedResaleable,
    total_rejected: record.totalRejected,
    total_missing: record.totalMissing,
    has_discrepancies: record.hasDiscrepancies,
    idempotency_key: `draft_insp:${input.rmaId}:${Date.now()}`,
    lines: record.lines.map((l) => ({
      line_id: l.lineId,
      quantity_authorized: l.quantityAuthorized,
      quantity_received: l.quantityReceived,
      quantity_accepted_resaleable: l.quantityAcceptedResaleable,
      quantity_rejected: l.quantityRejected,
      quantity_missing: l.quantityMissing,
      rejection_reason: l.rejectionReason,
      discrepancy_type: l.discrepancyType,
      discrepancy_notes: l.discrepancyNotes,
    })),
  };

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "save_warehouse_inspection_draft_atomic",
    { p_payload: rpcPayload }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    revalidatePath("/admin/retail-network/exchange-credit");
    return {
      success: true,
      rmaId: input.rmaId,
      inspectionId: (rpcData as any).inspection_id,
      isDraft: true,
      totalAcceptedResaleable: record.totalAcceptedResaleable,
      hasDiscrepancies: record.hasDiscrepancies,
    };
  }

  if (rpcErr && rpcErr.message?.includes("FINALIZED_INSPECTION_IMMUTABLE")) {
    return {
      success: false,
      error: "Finalized warehouse inspection is immutable and cannot be overwritten with a draft.",
      errorCode: "FINALIZED_INSPECTION_IMMUTABLE",
    };
  }

  // 5. Fallback: Upsert draft inspection header
  const { data: insp, error: inspErr } = await supabase
    .from("retailer_exchange_rma_inspections")
    .upsert(
      {
        rma_id: input.rmaId,
        box_condition: record.boxCondition,
        inspector_id: session.userId,
        inspector_name: record.inspectedBy.name,
        inspector_role: record.inspectedBy.role || "inspector",
        total_authorized: record.totalAuthorized,
        total_received: record.totalReceived,
        total_accepted_resaleable: record.totalAcceptedResaleable,
        total_rejected: record.totalRejected,
        total_missing: record.totalMissing,
        has_discrepancies: record.hasDiscrepancies,
        is_draft: true,
        overall_notes: record.overallNotes,
        inspected_at: new Date().toISOString(),
      },
      { onConflict: "rma_id" }
    )
    .select("id")
    .single();

  if (inspErr || !insp) {
    return { success: false, error: inspErr?.message || "Failed to save draft", errorCode: "DRAFT_SAVE_FAILED" };
  }

  // Upsert lines
  const linesToUpsert = record.lines.map((l) => ({
    inspection_id: insp.id,
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

  await supabase.from("retailer_exchange_rma_inspection_lines").upsert(linesToUpsert, {
    onConflict: "inspection_id,rma_line_id",
  });

  await supabase
    .from("retailer_exchange_rmas")
    .update({ status: "inspection_in_progress", updated_at: new Date().toISOString() })
    .eq("id", input.rmaId);

  revalidatePath("/admin/retail-network/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    inspectionId: insp.id,
    isDraft: true,
    totalAcceptedResaleable: record.totalAcceptedResaleable,
    hasDiscrepancies: record.hasDiscrepancies,
  };
}

/**
 * 7. Complete Warehouse Inspection Action
 * Enforces strict complete reconciliation:
 * - Accepted <= Received
 * - Accepted <= Authorized
 * - Received = Accepted + Rejected (zero unclassified units)
 * - Rejection reasons required for all rejected units
 * - Rejects if inspection is already finalized (Immutability guarantee)
 */
export async function completeWarehouseInspectionAction(
  input: CompleteInspectionInput
): Promise<InspectionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin/Inspector session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  // 1. Check if already finalized (IMMUTABLE)
  const { data: existingInsp } = await supabase
    .from("retailer_exchange_rma_inspections")
    .select("id, is_draft")
    .eq("rma_id", input.rmaId)
    .maybeSingle();

  if (existingInsp && existingInsp.is_draft === false) {
    return {
      success: false,
      error: "Finalized warehouse inspection is immutable and cannot be overwritten.",
      errorCode: "FINALIZED_INSPECTION_IMMUTABLE",
    };
  }

  // 2. Fetch authorized lines
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
    boxId: null,
  }));

  // 3. Strict Pure Reconciliation Validation (Complete Mode: isDraft = false)
  const reconciliation = reconcileWarehouseInspection(
    mappedLines,
    input.inspectionInput,
    input.rmaId,
    { isDraft: false }
  );

  if (!reconciliation.success) {
    return {
      success: false,
      error: reconciliation.errors.join("; "),
      errorCode: reconciliation.errorCode || "INSPECTION_INVARIANT_VIOLATION",
    };
  }

  const record = reconciliation.inspectionRecord!;

  // 4. Attempt Atomic Finalization via PostgreSQL Stored Procedure (finalize_warehouse_inspection_atomic)
  const rpcPayload = {
    rma_id: input.rmaId,
    inspector_id: session.userId,
    inspector_name: record.inspectedBy.name,
    inspector_role: record.inspectedBy.role || "inspector",
    box_condition: record.boxCondition,
    overall_notes: record.overallNotes,
    total_authorized: record.totalAuthorized,
    total_received: record.totalReceived,
    total_accepted_resaleable: record.totalAcceptedResaleable,
    total_rejected: record.totalRejected,
    total_missing: record.totalMissing,
    has_discrepancies: record.hasDiscrepancies,
    idempotency_key: `final_insp:${input.rmaId}`,
    lines: record.lines.map((l) => ({
      line_id: l.lineId,
      quantity_authorized: l.quantityAuthorized,
      quantity_received: l.quantityReceived,
      quantity_accepted_resaleable: l.quantityAcceptedResaleable,
      quantity_rejected: l.quantityRejected,
      quantity_missing: l.quantityMissing,
      rejection_reason: l.rejectionReason,
      discrepancy_type: l.discrepancyType,
      discrepancy_notes: l.discrepancyNotes,
    })),
    exceptions: reconciliation.exceptionsRaised.map((ex) => ({
      code: ex.code,
      severity: ex.severity,
      description: ex.description,
      requires_admin_review: ex.requiresAdminReview,
      flag_carrier_claim: ex.flagCarrierClaim,
      resolved: ex.resolved,
      resolution_notes: ex.resolutionNotes,
    })),
  };

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    "finalize_warehouse_inspection_atomic",
    { p_payload: rpcPayload }
  );

  if (!rpcErr && rpcData && (rpcData as any).success) {
    revalidatePath("/admin/retail-network/exchange-credit");
    return {
      success: true,
      rmaId: input.rmaId,
      inspectionId: (rpcData as any).inspection_id,
      isDraft: false,
      totalAcceptedResaleable: record.totalAcceptedResaleable,
      hasDiscrepancies: record.hasDiscrepancies,
    };
  }

  if (rpcErr && rpcErr.message?.includes("FINALIZED_INSPECTION_IMMUTABLE")) {
    return {
      success: false,
      error: "Finalized warehouse inspection is immutable and cannot be overwritten.",
      errorCode: "FINALIZED_INSPECTION_IMMUTABLE",
    };
  }

  // 5. Fallback: Sequential Finalization with Idempotency Key
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

  await supabase
    .from("retailer_exchange_rma_inspection_lines")
    .delete()
    .eq("inspection_id", savedInsp.id);

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
    event_type: "INSPECTION_FINALIZED",
    new_status: targetStatus,
    actor_id: session.userId,
    actor_name: record.inspectedBy.name,
    actor_role: record.inspectedBy.role || "inspector",
    reason: "Warehouse inspection finalized and fully reconciled",
    metadata: {
      inspection_id: savedInsp.id,
      has_discrepancies: record.hasDiscrepancies,
      total_accepted: record.totalAcceptedResaleable,
    },
    idempotency_key: `final_insp:${input.rmaId}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

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
 * 8. Record Manual RMA Exception
 */
export async function recordRmaExceptionAction(
  input: RecordExceptionInput
): Promise<ExceptionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { data: ex, error: exErr } = await supabase
    .from("retailer_exchange_rma_exceptions")
    .insert({
      rma_id: input.rmaId,
      code: input.code,
      severity: input.severity,
      description: input.description,
      requires_admin_review: input.requiresAdminReview ?? true,
      flag_carrier_claim: input.flagCarrierClaim ?? false,
    })
    .select("id")
    .single();

  if (exErr || !ex) {
    return { success: false, error: exErr?.message || "Failed to record exception.", errorCode: "SAVE_FAILED" };
  }

  await supabase
    .from("retailer_exchange_rmas")
    .update({ status: "exception", updated_at: new Date().toISOString() })
    .eq("id", input.rmaId);

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "EXCEPTION_FLAGGED",
    new_status: "exception",
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    actor_role: "admin",
    reason: input.description,
    metadata: { code: input.code, severity: input.severity, exception_id: ex.id },
    idempotency_key: `ex_flag:${input.rmaId}:${ex.id}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    exceptionId: ex.id,
    rmaStatus: "exception",
  };
}

/**
 * 9. Resolve RMA Exception
 */
export async function resolveRmaExceptionAction(
  input: ResolveExceptionInput
): Promise<ExceptionActionResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: false, error: "RMA schema unavailable.", errorCode: "SCHEMA_NOT_AVAILABLE" };
  }

  const supabase = createAdminClient();

  const { error: exErr } = await supabase
    .from("retailer_exchange_rma_exceptions")
    .update({
      resolved: true,
      resolution_notes: input.resolutionNotes,
      resolved_by: session.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.exceptionId);

  if (exErr) {
    return { success: false, error: exErr.message, errorCode: "UPDATE_FAILED" };
  }

  // Check remaining unresolved exceptions for this RMA
  const { data: remaining } = await supabase
    .from("retailer_exchange_rma_exceptions")
    .select("id")
    .eq("rma_id", input.rmaId)
    .eq("resolved", false);

  let newStatus: RmaStatus = input.targetStatus || "resolution_ready";
  if (remaining && remaining.length > 0) {
    newStatus = "exception";
  }

  await supabase
    .from("retailer_exchange_rmas")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", input.rmaId);

  await supabase.from("retailer_exchange_rma_audit_logs").insert({
    rma_id: input.rmaId,
    event_type: "EXCEPTION_RESOLVED",
    new_status: newStatus,
    actor_id: session.userId,
    actor_name: session.email ? session.email.split("@")[0] : "Admin",
    actor_role: "admin",
    reason: input.resolutionNotes,
    metadata: { exception_id: input.exceptionId, remaining_unresolved: remaining?.length || 0 },
    idempotency_key: `ex_resolve:${input.rmaId}:${input.exceptionId}`,
  });

  revalidatePath("/admin/retail-network/exchange-credit");

  return {
    success: true,
    rmaId: input.rmaId,
    exceptionId: input.exceptionId,
    rmaStatus: newStatus,
  };
}

/**
 * 10. Propose Settlement Instruction (Read-Only Preview for Phase 4)
 * Strict Invariants:
 * - NO credit calculation before inspection is completed
 * - Integer cents accuracy
 * - Rejects overflow safely
 * - ZERO database writes, zero credit ledger issuance
 */
export async function getProposedSettlementInstructionAction(
  rmaId: string
): Promise<GetSettlementProposalResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
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
      quantityMissing: il.quantityMissing,
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
    createdAt: rma.created_at || new Date().toISOString(),
    updatedAt: rma.updated_at || new Date().toISOString(),
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

/**
 * 11. List RMAs for Admin
 */
export async function listRmasAction(): Promise<ListRmasResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, isSchemaAvailable: false, rmas: [], totalCount: 0, error: "Unauthorized" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return {
      success: true,
      isSchemaAvailable: false,
      rmas: [],
      totalCount: 0,
    };
  }

  const supabase = createAdminClient();

  const { data: rows, error } = await supabase
    .from("retailer_exchange_rmas")
    .select(`
      *,
      retailer_exchange_rma_lines (*, products(sku)),
      retailer_exchange_rma_boxes (*),
      retailer_exchange_rma_exceptions (*)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, isSchemaAvailable: true, rmas: [], totalCount: 0, error: error.message };
  }

  const rmas: RmaAggregate[] = (rows || []).map((row: any) => ({
    id: row.id,
    rmaNumber: row.rma_number,
    claimId: row.claim_id,
    claimNumber: "",
    storeId: row.store_id,
    companyId: row.company_id,
    status: row.status as RmaStatus,
    approvalDate: row.approval_date,
    shippingDeadlineDate: row.shipping_deadline_date,
    lines: (row.retailer_exchange_rma_lines || []).map((l: any) => ({
      id: l.id,
      claimId: row.claim_id,
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
      boxId: l.box_id,
    })),
    boxes: (row.retailer_exchange_rma_boxes || []).map((b: any) => ({
      id: b.id,
      boxNumber: b.box_number,
      carrier: b.carrier,
      trackingNumber: b.tracking_number,
      labelUrl: b.label_url,
      status: b.status,
      carrierEvents: [],
      assignedLines: [],
    })),
    inspectionRecord: null,
    settlementInstruction: null,
    exceptions: (row.retailer_exchange_rma_exceptions || []).map((e: any) => ({
      id: e.id,
      code: e.code,
      severity: e.severity,
      description: e.description,
      flaggedAt: e.created_at,
      requiresAdminReview: e.requires_admin_review,
      flagCarrierClaim: e.flag_carrier_claim,
      resolved: e.resolved,
      resolutionNotes: e.resolution_notes,
    })),
    eventHistory: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    success: true,
    isSchemaAvailable: true,
    rmas,
    totalCount: rmas.length,
  };
}

/**
 * 12. Get Detailed RMA by ID
 */
export async function getRmaDetailAction(rmaId: string): Promise<GetRmaDetailResult> {
  const session = await verifyAdminSession();
  if (!session || !session.userId || session.role !== "admin") {
    return { success: false, isSchemaAvailable: false, error: "Unauthorized: Admin session required.", errorCode: "UNAUTHORIZED" };
  }

  const isSchemaAvailable = await checkRmaSchemaAvailability();
  if (!isSchemaAvailable) {
    return { success: true, isSchemaAvailable: false, error: "RMA schema is not yet available." };
  }

  const supabase = createAdminClient();

  const { data: row, error } = await supabase
    .from("retailer_exchange_rmas")
    .select(`
      *,
      retailer_exchange_rma_lines (*, products(sku, name)),
      retailer_exchange_rma_boxes (*),
      retailer_exchange_rma_inspections (*, retailer_exchange_rma_inspection_lines(*)),
      retailer_exchange_rma_exceptions (*),
      retailer_exchange_rma_audit_logs (*)
    `)
    .eq("id", rmaId)
    .maybeSingle();

  if (error || !row) {
    return { success: false, isSchemaAvailable: true, error: error?.message || "RMA not found.", errorCode: "NOT_FOUND" };
  }

  let inspectionRecord = null;
  if (row.retailer_exchange_rma_inspections) {
    const insp = row.retailer_exchange_rma_inspections;
    inspectionRecord = {
      id: insp.id,
      rmaId: row.id,
      inspectedBy: {
        userId: insp.inspector_id,
        name: insp.inspector_name,
        role: insp.inspector_role,
      },
      inspectedAt: insp.inspected_at,
      boxCondition: insp.box_condition,
      lines: (insp.retailer_exchange_rma_inspection_lines || []).map((il: any) => ({
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
      totalAuthorized: insp.total_authorized,
      totalReceived: insp.total_received,
      totalAcceptedResaleable: insp.total_accepted_resaleable,
      totalRejected: insp.total_rejected,
      totalMissing: insp.total_missing,
      hasDiscrepancies: insp.has_discrepancies,
      isDraft: insp.is_draft,
      overallNotes: insp.overall_notes,
    };
  }

  const rma: RmaAggregate = {
    id: row.id,
    rmaNumber: row.rma_number,
    claimId: row.claim_id,
    claimNumber: "",
    storeId: row.store_id,
    companyId: row.company_id,
    status: row.status as RmaStatus,
    approvalDate: row.approval_date,
    shippingDeadlineDate: row.shipping_deadline_date,
    lines: (row.retailer_exchange_rma_lines || []).map((l: any) => ({
      id: l.id,
      claimId: row.claim_id,
      claimItemId: l.claim_item_id,
      cohortId: l.cohort_id,
      productId: l.product_id,
      productName: l.products?.name || "Product",
      productSku: l.products?.sku || "SKU",
      selectedOption: "B",
      quantityRequested: l.quantity_requested,
      quantityAuthorized: l.quantity_authorized,
      frozenUnitWholesalePrice: Number(l.frozen_unit_wholesale_price),
      frozenWholesalePriceCents: l.frozen_wholesale_price_cents,
      boxId: l.box_id,
    })),
    boxes: (row.retailer_exchange_rma_boxes || []).map((b: any) => ({
      id: b.id,
      boxNumber: b.box_number,
      carrier: b.carrier,
      trackingNumber: b.tracking_number,
      labelUrl: b.label_url,
      status: b.status,
      carrierEvents: [],
      assignedLines: [],
    })),
    inspectionRecord,
    settlementInstruction: null,
    exceptions: (row.retailer_exchange_rma_exceptions || []).map((e: any) => ({
      id: e.id,
      code: e.code,
      severity: e.severity,
      description: e.description,
      flaggedAt: e.created_at,
      requiresAdminReview: e.requires_admin_review,
      flagCarrierClaim: e.flag_carrier_claim,
      resolved: e.resolved,
      resolutionNotes: e.resolution_notes,
    })),
    eventHistory: (row.retailer_exchange_rma_audit_logs || []).map((a: any) => ({
      id: a.id,
      eventType: a.event_type,
      oldStatus: a.old_status,
      newStatus: a.new_status,
      actorName: a.actor_name || "System",
      actorRole: a.actor_role,
      reason: a.reason,
      timestamp: a.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    success: true,
    isSchemaAvailable: true,
    rma,
  };
}
