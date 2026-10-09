/**
 * Standard Inventory Adjustment Reason Presets (Task: ADM-TRD-INV-001)
 * Presets are strictly ordered with English first + Korean in parentheses.
 */
export const INVENTORY_ADJUSTMENT_REASONS = [
  "Physical Count Adjustment (실사 재고 조정)",
  "New Receiving (신규 입고)",
  "Lost / Missing Inventory (분실 / 재고 누락)",
  "Damaged / Defective Inventory (파손 / 불량)",
  "Warehouse Transfer Correction (창고 간 이동 정정)",
  "Other (기타)",
] as const;

export type InventoryAdjustmentReason = (typeof INVENTORY_ADJUSTMENT_REASONS)[number];

export const DEFAULT_INVENTORY_ADJUSTMENT_REASON: InventoryAdjustmentReason =
  "Physical Count Adjustment (실사 재고 조정)";

export const OTHER_INVENTORY_ADJUSTMENT_REASON: InventoryAdjustmentReason =
  "Other (기타)";

/**
 * Format effective reason string for storage and audit logging.
 */
export function formatInventoryAdjustmentReason(
  selectedReason: string,
  customReason?: string | null
): string {
  if (selectedReason === OTHER_INVENTORY_ADJUSTMENT_REASON) {
    const trimmed = customReason?.trim();
    return trimmed ? `Other (기타): ${trimmed}` : "Other (기타)";
  }
  return selectedReason?.trim() || DEFAULT_INVENTORY_ADJUSTMENT_REASON;
}
