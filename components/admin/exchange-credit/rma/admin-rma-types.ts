/**
 * Option B: Return & RMA Admin UI Types & Configurations
 * Task ID: EXCHANGE-CREDIT-PH3-002
 * Location: components/admin/exchange-credit/rma/admin-rma-types.ts
 */

import type {
  RmaStatus,
  RmaItemLine,
  RmaBox,
  RmaBoxInput,
  InspectionRecord,
  ProposedSettlementInstruction,
  RmaException,
  RmaAggregate,
  InspectorActor,
  BoxPhysicalCondition,
  WarehouseInspectionInput,
} from "@/lib/retailer/rma";

export type AdminRmaFilterCategory =
  | "all"
  | "pending_approval"
  | "awaiting_shipment"
  | "in_transit"
  | "warehouse_inspection"
  | "exceptions"
  | "resolution_ready"
  | "completed_cancelled";

export interface RmaStatusBadgeConfig {
  label: string;
  badgeClass: string;
  dotColor: string;
}

export const RMA_STATUS_UI_CONFIG: Record<RmaStatus, RmaStatusBadgeConfig> = {
  awaiting_admin_approval: {
    label: "Awaiting Admin Approval",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    dotColor: "bg-amber-400",
  },
  approved: {
    label: "Approved · Awaiting Handoff",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    dotColor: "bg-blue-400",
  },
  shipped: {
    label: "Shipped · In Transit",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    dotColor: "bg-cyan-400",
  },
  delivered: {
    label: "Delivered to Warehouse",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    dotColor: "bg-indigo-400",
  },
  inspection_in_progress: {
    label: "Inspection in Progress",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dotColor: "bg-purple-400",
  },
  inspection_completed: {
    label: "Inspection Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotColor: "bg-emerald-400",
  },
  resolution_ready: {
    label: "Resolution Ready (Settlement Proposed)",
    badgeClass: "bg-teal-500/10 text-teal-300 border-teal-500/30",
    dotColor: "bg-teal-300",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-zinc-800 text-zinc-400 border-zinc-700",
    dotColor: "bg-zinc-500",
  },
  expired: {
    label: "Expired (Unshipped)",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dotColor: "bg-rose-400",
  },
  exception: {
    label: "Exception · Admin Review Required",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/40",
    dotColor: "bg-rose-500 animate-pulse",
  },
};

export interface AdminRmaOverviewProps {
  rmas: RmaAggregate[];
  isLoading?: boolean;
  onSelectRma?: (rma: RmaAggregate) => void;
  // Future action callback slots (disabled in Phase 3)
  onApproveRma?: (rmaId: string) => Promise<void>;
  onCancelRma?: (rmaId: string, reason: string) => Promise<void>;
}

export interface AdminRmaDetailProps {
  rma: RmaAggregate;
  onBack: () => void;
  onOpenInspection?: () => void;
  // Future action callback slots (disabled in Phase 3)
  onApproveRma?: () => Promise<void>;
  onAddBox?: (box: RmaBoxInput) => Promise<void>;
  onSaveInspectionDraft?: (input: WarehouseInspectionInput) => Promise<void>;
  onCompleteInspection?: (input: WarehouseInspectionInput) => Promise<void>;
  onResolveException?: (exceptionId: string, notes: string) => Promise<void>;
}

export interface AdminRmaBoxesProps {
  boxes: RmaBox[];
  lines: RmaItemLine[];
  rmaNumber: string;
  isEditable?: boolean;
  onAddBox?: (box: RmaBoxInput) => Promise<void>;
}

export interface AdminRmaInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  rma: RmaAggregate;
  existingRecord?: InspectionRecord | null;
  onSaveDraft?: (input: WarehouseInspectionInput) => void;
  onCompleteInspection?: (input: WarehouseInspectionInput) => void;
}

export interface AdminRmaExceptionsProps {
  exceptions: RmaException[];
  onResolveException?: (exceptionId: string, resolutionNotes: string) => void;
}
