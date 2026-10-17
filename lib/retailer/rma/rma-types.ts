/**
 * Option B: Return & RMA Domain Engine Types
 * Task ID: EXCHANGE-CREDIT-PH3-001
 * Location: lib/retailer/rma/rma-types.ts
 *
 * Strict, framework-independent pure type definitions for Option B Returns & RMA lifecycle.
 */

/**
 * Valid lifecycle states for an RMA
 */
export type RmaStatus =
  | "awaiting_admin_approval" // Initial state: Claim submitted with Option B lines, awaiting Admin review and label creation
  | "approved"                // Admin approved RMA, box labels generated, awaiting retailer handoff to carrier
  | "shipped"                 // Carrier scanned first event (pickup / in-transit)
  | "delivered"               // Delivered to warehouse
  | "inspection_in_progress"  // Warehouse staff unboxed parcel and commenced inspection
  | "inspection_completed"    // Inspection finalized, counts reconciled
  | "resolution_ready"        // Settlement proposal calculated, ready for financial issuance (Phase 4)
  | "cancelled"               // Cancelled before shipment or by Admin
  | "expired"                 // 14-day shipping deadline lapsed without carrier scan or exception approval
  | "exception";              // Flagged with an exception (late carrier scan, lost parcel, mismatch) requiring Admin review

/**
 * Event types driving RMA state transitions
 */
export type RmaEventType =
  | "RMA_CREATED"
  | "RMA_APPROVED"
  | "CARRIER_PICKUP"
  | "CARRIER_IN_TRANSIT"
  | "CARRIER_DELIVERED"
  | "INSPECTION_STARTED"
  | "INSPECTION_RECORDED"
  | "SETTLEMENT_PROPOSED"
  | "EXCEPTION_FLAGGED"
  | "EXCEPTION_RESOLVED"
  | "RMA_CANCELLED"
  | "RMA_EXPIRED";

/**
 * Shipping Carrier options
 */
export type RmaShippingCarrier = "UPS" | "USPS" | "FEDEX" | "OTHER";

/**
 * Individual product line item within an RMA
 */
export interface RmaItemLine {
  id: string;                      // Line UUID
  claimId: string;                 // Parent claim UUID
  claimItemId: string;             // Claim item UUID
  cohortId: string;                // Protected cohort UUID
  productId: string;               // Product UUID
  productName: string;             // Product name
  productSku: string;              // Product SKU
  selectedOption: "B";             // Strictly Option B
  quantityRequested: number;       // Positive integer units claimed
  quantityAuthorized: number;      // Units authorized by Admin for return
  frozenUnitWholesalePrice: number;// Frozen original wholesale unit price in dollars (e.g. 14.50)
  frozenWholesalePriceCents: number;// Frozen unit price in integer cents (e.g. 1450)
  boxId?: string | null;           // Assigned return box ID (if pre-allocated)
}

/**
 * Carrier tracking event
 */
export interface RmaCarrierEvent {
  id: string;
  trackingNumber: string;
  eventType: "pre_transit" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "lost";
  timestamp: string; // ISO 8601 string
  location?: string | null;
  description?: string | null;
  rawStatus?: string | null;
}

/**
 * Physical return box associated with an RMA
 */
export interface RmaBox {
  id: string;                      // Box UUID or code ("BOX-1")
  boxNumber: number;               // 1, 2, 3...
  carrier: RmaShippingCarrier;
  trackingNumber: string;
  labelUrl?: string | null;
  status: "label_created" | "in_transit" | "delivered" | "exception" | "lost";
  shippedAt?: string | null;       // ISO timestamp of first scan
  deliveredAt?: string | null;     // ISO timestamp of delivery scan
  carrierEvents: RmaCarrierEvent[];
  assignedLines: Array<{
    lineId: string;
    quantity: number;
  }>;
}

/**
 * Box input during Admin RMA approval
 */
export interface RmaBoxInput {
  boxNumber: number;
  carrier: RmaShippingCarrier;
  trackingNumber: string;
  labelUrl?: string | null;
  assignedLines: Array<{
    lineId: string;
    quantity: number;
  }>;
}

/**
 * Rejection reason classifications for warehouse inspection
 */
export type InspectionRejectionReason =
  | "damaged"           // Physical damage to product / crushed
  | "expired"           // Expired or past shelf-life threshold
  | "opened_unsealed"   // Tampered seal, opened packaging, hygiene violation
  | "wrong_sku"         // Received product does not match authorized SKU
  | "counterfeit"       // Suspected unauthorized unit
  | "missing_parts"     // Incomplete item / missing accessory
  | "other";            // Other specific warehouse note

/**
 * Discrepancy classifications
 */
export type InspectionDiscrepancyType =
  | "exact_match"          // 100% received and accepted resaleable
  | "partial_acceptance"   // Received all units, but some rejected
  | "partial_receipt"      // Received fewer units than authorized (missing items)
  | "over_receipt"         // Received more units than authorized
  | "wrong_sku"            // One or more items returned as wrong SKU
  | "total_rejection";     // 100% of received units rejected

/**
 * Line-by-line reconciliation output from warehouse inspection
 */
export interface InspectionLineReconciliation {
  lineId: string;
  productId: string;
  productSku: string;
  productName: string;
  quantityAuthorized: number;
  quantityReceived: number;
  quantityAcceptedResaleable: number;
  quantityRejected: number;
  quantityMissing: number;
  rejectionReason?: InspectionRejectionReason | null;
  discrepancyType: InspectionDiscrepancyType;
  discrepancyNotes?: string | null;
}

/**
 * Actor performing an inspection
 */
export interface InspectorActor {
  userId: string;
  name: string;
  role: "warehouse_staff" | "admin" | "inspector";
}

/**
 * Box physical condition on warehouse receipt
 */
export type BoxPhysicalCondition = "intact" | "damaged" | "crushed" | "tampered" | "water_damaged";

/**
 * Immutable inspection record created by warehouse staff
 */
export interface InspectionRecord {
  id: string;                      // Inspection UUID
  rmaId: string;
  inspectedBy: InspectorActor;
  inspectedAt: string;             // ISO 8601 timestamp
  boxCondition: BoxPhysicalCondition;
  lines: InspectionLineReconciliation[];
  totalAuthorized: number;
  totalReceived: number;
  totalAcceptedResaleable: number;
  totalRejected: number;
  totalMissing: number;
  hasDiscrepancies: boolean;
  isDraft?: boolean;
  overallNotes?: string | null;
}

/**
 * Input supplied by warehouse during inspection
 */
export interface WarehouseInspectionLineInput {
  lineId: string;
  quantityReceived: number;
  quantityAcceptedResaleable: number;
  quantityRejected: number;
  rejectionReason?: InspectionRejectionReason | null;
  discrepancyNotes?: string | null;
}

export interface WarehouseInspectionInput {
  inspectedBy: InspectorActor;
  inspectedAt?: string;            // Default: current time
  boxCondition: BoxPhysicalCondition;
  lineInspections: WarehouseInspectionLineInput[];
  isDraft?: boolean;
  overallNotes?: string | null;
}

/**
 * Exception codes supported by the RMA engine
 */
export type RmaExceptionCode =
  | "UNSHIPPED_OVERDUE"             // No carrier handoff within 14 days
  | "LATE_CARRIER_SCAN"             // Carrier first scan occurred after Day 14 deadline
  | "PARTIAL_RECEIPT"               // Fewer units received than authorized
  | "OVER_RECEIPT"                  // More units received than authorized
  | "DAMAGED_UNITS"                 // Units rejected due to damage
  | "WRONG_SKU_RETURNED"            // Returned item does not match authorized SKU
  | "CARRIER_LOST_PARCEL"           // Carrier lost parcel in transit (prepaid label)
  | "MISSING_TRACKING"              // Claimed shipped but tracking number invalid/missing
  | "MULTIPLE_BOXES_SPLIT_DELIVERY" // Some boxes arrived, other boxes delayed
  | "ADMIN_MANUAL_HOLD";            // Admin manually flagged for review

export type RmaExceptionSeverity = "low" | "medium" | "high" | "critical";

/**
 * Structured exception entry
 */
export interface RmaException {
  id: string;
  code: RmaExceptionCode;
  severity: RmaExceptionSeverity;
  description: string;
  flaggedAt: string;               // ISO 8601
  requiresAdminReview: boolean;
  flagCarrierClaim: boolean;       // True if Letusto prepaid label carrier claim applies
  resolved: boolean;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

/**
 * Line item detail in proposed settlement
 */
export interface SettlementLineDetail {
  lineId: string;
  productId: string;
  productSku: string;
  acceptedResaleableUnits: number;
  frozenWholesalePriceCents: number;
  settlementAmountCents: number;
  settlementAmountDollars: number;
}

/**
 * Proposed settlement instruction (strictly Phase 3 contract; no financial issuance)
 */
export interface ProposedSettlementInstruction {
  idempotencyKey: string;          // Deterministic hash preventing duplicate settlement
  rmaId: string;
  claimId: string;
  storeId: string;
  companyId: string;
  calculatedAt: string;            // ISO 8601
  lines: SettlementLineDetail[];
  totalAcceptedUnits: number;
  totalSettlementAmountCents: number;
  totalSettlementAmountDollars: number;
  creditRate: 1.0;                 // 100% of frozen wholesale price for accepted units
  status: "settlement_proposed";
  disclaimer: string;              // "Proposed settlement instruction only. No credit ledger entry created."
  auditProvenance: {
    inspectionRecordId: string;
    inspectedAt: string;
    calculatedBy: string;
  };
}

/**
 * Event history entry for auditability
 */
export interface RmaAuditLogEntry {
  id: string;
  rmaId: string;
  eventType: RmaEventType;
  oldStatus: RmaStatus | null;
  newStatus: RmaStatus;
  actor: {
    userId: string;
    role: string;
    name?: string;
  };
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  timestamp: string;               // ISO 8601
}

/**
 * Full RMA Aggregate Model
 */
export interface RmaAggregate {
  id: string;                      // RMA UUID
  rmaNumber: string;               // e.g. "RMA-2026-000001"
  claimId: string;                 // Source Claim UUID
  claimNumber: string;             // Source Claim Number (e.g. "CLM-2026-00001")
  storeId: string;                 // Retailer Store UUID (single store only)
  companyId: string;               // Retailer Company UUID
  status: RmaStatus;
  lines: RmaItemLine[];
  boxes: RmaBox[];
  approvalDate: string | null;     // Date-only YYYY-MM-DD in America/New_York
  shippingDeadlineDate: string | null; // Date-only YYYY-MM-DD in America/New_York (Day 14)
  inspectionRecord: InspectionRecord | null;
  settlementInstruction: ProposedSettlementInstruction | null;
  exceptions: RmaException[];
  eventHistory: RmaAuditLogEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Shipping deadline calculation result
 */
export interface ShippingDeadlineResult {
  approvalDate: string;            // YYYY-MM-DD
  deadlineDate: string;            // YYYY-MM-DD (approvalDate + 14 days)
  asOfDate: string;                // YYYY-MM-DD
  daysElapsed: number;
  daysRemaining: number;
  isOverdue: boolean; // true if asOfDate > deadlineDate
  status: "active" | "deadline_day" | "overdue";
  businessTimezone: string;        // "America/New_York"
}

/**
 * Transition input event
 */
export interface RmaTransitionEvent {
  eventType: RmaEventType;
  actor: {
    userId: string;
    role: string;
    name?: string;
  };
  reason?: string;
  asOfDate?: string;               // YYYY-MM-DD or ISO timestamp
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

/**
 * Transition evaluation result
 */
export interface RmaTransitionResult {
  success: boolean;
  rma?: RmaAggregate;
  oldStatus?: RmaStatus;
  newStatus?: RmaStatus;
  error?: string;
  errorCode?: string;
  isDuplicate?: boolean;
}
