# Task Report: PORT-PROD-LIST-002

## 1. Summary
- **Task ID**: `PORT-PROD-LIST-002`
- **Task Name**: Redesign Product List Columns & Add Checkbox Bulk Delete
- **Platform**: Brand Portal (`https://portal.kselectnetwork.com`)
- **Area**: Product Management > Product List (`app/portal/products/page.tsx`, `components/product/portal-products-list.tsx`)

## 2. Key Changes
1. **Merged Category & Attribute Completion Column**:
   - Combined separate "카테고리" and "속성 완성도" columns into a unified `카테고리 / 속성` column (`min-w-[140px] max-w-[170px]`).
   - Line 1: Category Name (`text-xs font-semibold text-slate-700 dark:text-slate-200 truncate`).
   - Line 2: Compact attribute progress bar with percentage badge (`text-[10px] font-bold text-slate-500 dark:text-slate-400`).
   - Line 3: Urgent warning indicator (`⚠ 카테고리/속성 입력 필요`) when category is missing or completion is low.
2. **Replaced Per-Row Delete Button with Checkbox Selection**:
   - Added select-all checkbox `[☐]` in header with indeterminate support and selection count badge (`N개 선택됨`).
   - Added per-row checkboxes for active/non-deleted products.
   - Simplified row action column (`관리`): Removed row-level delete button; retained clean `수정/상세` action.
3. **Safe Checkbox Bulk Delete with Custom Confirmation Modal**:
   - Added `선택 삭제 (N)` button in the top action/filter bar.
   - Built an interactive, custom branded modal displaying:
     - Warning header and total count of selected items.
     - Scrollable preview list showing product name, SKU, and category for each selected item.
     - Confirmation and cancellation buttons with loading state. No native browser alert/confirm used.
   - Server Action `bulkDeleteProducts` in `lib/product/actions.ts`:
     - Strictly enforces tenant isolation (`company_id` check).
     - Dual-persistence soft-deletion (`deleted_at` timestamp + `price_additional_info.deleted_at`).
     - Updates status flags (`selection_status = "NOT_SELECTED"`, `sales_status = "ENDED"`).
     - Logs audit trail via `recordProductChangeLog` for each product.
     - Revalidates paths on both Brand Portal and Admin.
4. **Table Rebalancing & Responsiveness**:
   - Expanded Product Name column (`min-w-[240px]` with `line-clamp-2` and clear SKU subtext) preventing truncation.
   - Rebalanced widths across all columns (Thumbnail, Name, Category/Attr, Barcode, FOB Price, MOQ, Lead Time, Status, Actions).
   - Entire table and rightmost action column (`관리`) render completely without cutoffs on standard desktop resolutions.

## 3. Files Modified
- `lib/product/actions.ts`: Added `bulkDeleteProducts` server action with company security checks, soft delete dual persistence, and audit logging.
- `components/product/portal-products-list.tsx`: Overhauled list table UI with merged column, row selection, bulk delete modal, and balanced column layout.
- `components/admin/product-override-tabs.tsx`: Type casting resolution for lead time unit helper.
- `lib/product/types.ts`: Volume and lead time parsing helpers.
- `reports/PORT-PROD-LIST-002.md`: Task documentation.

## 4. Verification & QA
- TypeScript Check: `npx tsc --noEmit` -> 0 errors.
- Production Build: `npm run build` -> Success.
