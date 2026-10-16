/**
 * Option B: Return & RMA Database Persistence Types
 * Task ID: EXCHANGE-CREDIT-PH3-003
 * Location: lib/retailer/rma-backend/rma-backend-types.ts
 */

import type {
  RmaStatus,
  RmaShippingCarrier,
  InspectionRejectionReason,
  InspectionDiscrepancyType,
  BoxPhysicalCondition,
  RmaExceptionCode,
  RmaExceptionSeverity,
  RmaBoxInput,
  WarehouseInspectionInput,
  RmaCarrierEvent,
  RmaAggregate,
  ProposedSettlementInstruction,
} from "@/lib/retailer/rma";

export interface CreateRmaResult {
  success: boolean;
  rmaId?: string;
  rmaNumber?: string;
  claimId?: string;
  optionBLinesCount?: number;
  totalRequestedUnits?: number;
  error?: string;
  errorCode?: string;
}

export interface ApproveRmaInput {
  rmaId: string;
  adminNotes?: string;
  asOfDate?: string; // Optional override for testing
}

export interface ApproveRmaResult {
  success: boolean;
  rmaId?: string;
  status?: RmaStatus;
  approvalDate?: string;
  shippingDeadlineDate?: string;
  error?: string;
  errorCode?: string;
}

export interface SaveBoxAllocationInput {
  rmaId: string;
  boxes: RmaBoxInput[];
}

export interface SaveBoxAllocationResult {
  success: boolean;
  rmaId?: string;
  boxesCount?: number;
  error?: string;
  errorCode?: string;
}

export interface RecordTrackingEventInput {
  rmaId: string;
  boxId: string;
  event: RmaCarrierEvent;
  asOfDate?: string;
}

export interface RecordTrackingEventResult {
  success: boolean;
  rmaId?: string;
  boxId?: string;
  boxStatus?: string;
  rmaStatus?: RmaStatus;
  exceptionRaised?: boolean;
  error?: string;
  errorCode?: string;
}

export interface SaveInspectionDraftInput {
  rmaId: string;
  inspectionInput: WarehouseInspectionInput;
}

export interface CompleteInspectionInput {
  rmaId: string;
  inspectionInput: WarehouseInspectionInput;
}

export interface InspectionActionResult {
  success: boolean;
  rmaId?: string;
  inspectionId?: string;
  isDraft?: boolean;
  totalAcceptedResaleable?: number;
  hasDiscrepancies?: boolean;
  error?: string;
  errorCode?: string;
}

export interface RecordExceptionInput {
  rmaId: string;
  code: RmaExceptionCode;
  severity: RmaExceptionSeverity;
  description: string;
  requiresAdminReview?: boolean;
  flagCarrierClaim?: boolean;
}

export interface ResolveExceptionInput {
  rmaId: string;
  exceptionId: string;
  resolutionNotes: string;
  targetStatus?: RmaStatus;
}

export interface ExceptionActionResult {
  success: boolean;
  rmaId?: string;
  exceptionId?: string;
  rmaStatus?: RmaStatus;
  error?: string;
  errorCode?: string;
}

export interface GetSettlementProposalResult {
  success: boolean;
  rmaId?: string;
  settlementInstruction?: ProposedSettlementInstruction;
  error?: string;
  errorCode?: string;
}

export interface ListRmasResult {
  success: boolean;
  isSchemaAvailable: boolean;
  rmas: RmaAggregate[];
  totalCount: number;
  error?: string;
}

export interface GetRmaDetailResult {
  success: boolean;
  isSchemaAvailable: boolean;
  rma?: RmaAggregate;
  error?: string;
  errorCode?: string;
}
