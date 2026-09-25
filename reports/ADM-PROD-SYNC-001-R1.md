# ADM-PROD-SYNC-001-R1: Admin Product Full Field Parity & Cross-Portal Data Integrity Verification

## Task Information
- **Task ID**: `ADM-PROD-SYNC-001-R1`
- **Task Name**: Admin Product Full Field Parity & Cross-Portal Data Integrity Verification
- **Platforms**: Brand Portal (`https://portal.kselectnetwork.com`) & Admin (`https://admin.kselectnetwork.com`)
- **Status**: COMPLETE

---

## Executive Summary
This R1 task verifies and confirms the complete field, structural, mathematical, and status parity across K SELECT NETWORK Brand Portal and Admin. Both platforms utilize a shared, authoritative Product domain model, single-source-of-truth evaluator logic, identical database schemas, and synced real-time UI representations.

---

## Key Audit & Verification Points

### 1. Full Field Parity
- **Basic Info**: Manufacture SKU, Letusto SKU, English Product Name, Korean Product Name, Brand, Category, Origin, Volume/Size, Lead Time (value + unit), Color, Color Map, Description, Ingredients (Korean & English text and document attachments), UPC, EAN.
- **Admin Overrides**: Admin can override display values while preserving original portal inputs in `price_additional_info.admin_overrides`, with direct promotion of `letusto_sku`, `brand_id`, `selection_status`, `sales_status`, and `trading_status` to first-class table columns.

### 2. Category & Dynamic Attribute Parity
- Both Brand Portal and Admin render `<CategoryAttributeForm />` using identical 3-depth category selection (`1Depth > 2Depth > 3Depth`), active common attributes (`scope = COMMON`), and profile attributes (`profile_attributes`).
- Attribute values are persisted in `product_attribute_values` with JSON values (`value_json`) and shared validation rules.

### 3. Attribute Completion Single Source of Truth
- Unified calculation via `lib/product/attribute-completion.ts`:
  - `getProductCategoryCompletion`: Evaluates single product category leaf check (`is_final`) and required dynamic attributes completeness.
  - `getBatchProductCategoryCompletions`: High-performance batch evaluation for Product List views without N+1 query overhead.
- Display consistency: Percentages and warning badges match 1:1 between Header, Category Tab, and Product Lists across Brand Portal and Admin.

### 4. Media & Image Parity
- Shared table `product_images` with signed storage URLs (`company-uploads`).
- Representative image logic: Lowest position (index 0) is universally used as thumbnail across Brand and Admin.
- Full drag-and-drop reordering, multi-upload, and deletion capabilities on both platforms.

### 5. Pricing & Tiered B2B Price Parity
- Reference Prices: Retail KRW, Wholesale KRW, Estimated Retail USD (MSRP), Export USD (FOB).
- Tiered Prices: Shared data in `price_additional_info.price_tiers` with `qty` and `price`.
- Admin Override Price Tiers: Admin can override individual tier prices while showing original portal values alongside.

### 6. 4-Layer Logistics Specs & Container Simulator
- Standardized 4-layer structure:
  1. Item Spec (`item_width`, `item_depth`, `item_height`, `item_weight`)
  2. Package Spec (`package_width`, `package_depth`, `package_height`, `package_weight`)
  3. Master Carton Specs (`carton_pack_qty`, `carton_width`, `carton_depth`, `carton_height`, `carton_weight`, `carton_cbm`) - *Standardized from obsolete "Out Carton" naming*
  4. Pallet Specs (`palette_carton_qty`, `palette_width`, `palette_depth`, `palette_height`, `palette_weight`)
- Container Simulator: Evaluates direct carton loading for 20FT (28 CBM), 40FT (58 CBM), and 40HQ (68 CBM) without double calculation.

### 7. Registration Status & Draft Logic
- Unified evaluation via `evaluateProductRegistrationStatus` in `lib/product/registration-status.ts`.
- Required fields for `COMPLETE`: Brand, Category, Category Required Attributes, English Name, Manufacture SKU, Origin, Retail Price KRW, FOB Price USD, Item Specs, Package Specs, Master Carton Specs, at least one Barcode (UPC or EAN), and Representative Image.
- Missing fields dynamically populate `missingFields` array with standardized Korean labels (`마스터 카톤 규격`, etc.).

---

## Verification & QA
- **TypeScript**: Passed (`tsc --noEmit` -> 0 errors)
- **Production Build**: Passed (`npm run build` -> 0 errors)
- **Terminology Alignment**: Replaced all remaining occurrences of `아웃 카톤` with `마스터 카톤` across `registration-status.ts` and `product-detail-tabs.tsx`.
