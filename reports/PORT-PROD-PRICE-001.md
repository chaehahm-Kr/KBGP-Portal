# PORT-PROD-PRICE-001: Brand Portal Tiered Supply Price Default Row UX Improvement

## Task Information
- **Task ID**: PORT-PROD-PRICE-001
- **Task Name**: Brand Portal Tiered Supply Price Default Row UX Improvement
- **Target Project**: `chaehahm-Kr/KBGP-Portal`
- **Target Route**: `/portal/products/[id]` (Price Tab -> Tiered Supply Prices Section)

## Implementation Summary
- **Default Rows Display**: Modified `components/product/product-detail-tabs.tsx` so that products with 0 stored tiered prices automatically display 2 default blank rows (`{ qty: "", price: "" }`). Products with 1 stored tier display 1 stored row + 1 default blank row. Products with >= 2 stored tiers display all stored rows.
- **Initial Dirty & Guard Protection**: Added `normalizePriceTiers(tiers)` logic to strip pure blank rows when comparing against baseline snapshot (`initialSnapshotRef.current.priceTiers`). Fresh loads with 2 default blank starter rows evaluate `isPriceDirty = false` and do NOT trigger unsaved warning badges, dirty state, navigation guards, or modal alerts.
- **Row Deletion & Row Count Guard**: Updated `removePriceTier(idx)` to maintain a minimum of 2 visible rows in the table. If deleting a row drops the visible row count below 2, a blank row (`{ qty: "", price: "" }`) is automatically appended.
- **Validation & Persistence**: Added partial input validation in `getCriticalErrors()` (`"수량별 B2B 공급가 항목에서 최소 주문 수량과 구간별 공급 단가를 모두 입력해 주세요."`). Fully blank rows are automatically stripped on save via `normalizePriceTiers()`.

## Modified Files
- `components/product/product-detail-tabs.tsx`

## Migration Files
- Migration Files: N/A
- New Production Migration: None
- Schema Change: None
