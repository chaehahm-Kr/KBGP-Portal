# PORT-PROD-NEW-005: Brand Portal Logistics Container Simulator Explanation, Container Types & Product Quantity Expansion

## Task Information
- **Task ID**: PORT-PROD-NEW-005
- **Task Name**: Brand Portal Logistics Container Simulator Explanation, Container Types & Product Quantity Expansion
- **Target Project**: `chaehahm-Kr/KBGP-Portal`
- **Target Route**: `/portal/products/[id]` (Logistics Tab -> Section 5 Container Simulator)

## Implementation Summary
- **Section 5 Explanation & Title**: Added clear guidance alert in Section 5 emphasizing that the simulator provides a **theoretical estimation (이론적 적재 추정치)** based on package and carton specs, and does NOT account for actual loading loss, orientation, mixed loading, empty spaces, or master carton/pallet constraints.
- **3 Container Types**: Updated container simulator from 2 containers to 3 standardized containers:
  1. **20FT Container** = **28 CBM**
  2. **40FT Container** = **58 CBM**
  3. **40HQ Container** = **68 CBM** (renamed from `40ft HC`).
- **Product Quantity & Metrics Expansion**: Each container card now displays:
  - Expected Product Quantity (예상 상품 수량, 개)
  - Expected Carton Quantity (예상 카톤 수량, 카톤)
  - Expected Total Weight (예상 총중량, kg)
  - Expected Total CBM (예상 총 CBM)
  - Container Max CBM (28 / 58 / 68 CBM)
- **Missing Data UX Guidance**: If required specs (Out Carton CBM, Pack Qty, or Carton Weight) are missing or zero, a clear warning banner (`getMissingContainerSimFields`) informs the user which fields need to be entered in Section 3, and card metrics show `-` instead of misleading `0` values.
- **Override Input Alignment**: Aligned manual override inputs for all 3 containers (20FT, 40FT, 40HQ) allowing manual customization and persistence.

## Modified Files
- `components/product/product-detail-tabs.tsx`
- `lib/product/actions.ts`
- `lib/product/audit.ts`
- `reports/PORT-PROD-NEW-005.md`

## Migration Files
- Migration Files: N/A
- New Production Migration: None
- Schema Change: None (40FT manual override values stored in `price_additional_info`)
