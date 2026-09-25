# PORT-PROD-NEW-003 Task Report
**Brand Product Logistics Required Validation & Duplicate Category Section Removal**

## Executive Summary
This task resolved two critical issues in the Brand Portal product registration and detail management workflows:
1. **Authoritative Logistics Completeness Rule:** Expanded `evaluateProductRegistrationStatus` in `lib/product/registration-status.ts` to require Item Spec (`item_width/depth/height/weight`), Package Spec (`package_width/depth/height/weight`), and Carton Box Specs (`carton_pack_qty/width/depth/height/weight`). Missing or zero values in any group transition the product to `Draft / 보완 대기` with explicit warnings (`단품 규격`, `단품 포장 패키지 규격`, `아웃 카톤 규격`). Derived fields such as CBM remain non-required.
2. **Duplicate Category UI Removal:** Removed the redundant `<CategoryAttributeForm>` instance mounted inside `components/product/product-detail-tabs.tsx` so the `카테고리 & 속성` tab displays exactly ONE set of Category Assignment, Common Attributes, and Product Profile Attributes.
3. **Numeric Editing & Label Integrity:** Added required `*` indicators to Item and Carton labels in `components/product/product-detail-tabs.tsx` and converted Carton inputs to `inputMode="decimal"` text controls with regex sanitize on change, preserving intermediate numeric editing and auto-select-on-focus UX.

---

## Audit of Existing Supabase Products Impact
- Total Database Products Audited: 19
- Products Remaining COMPLETE: 17
- Products Transitioned to DRAFT (Missing Item/Carton Specs): 2
  1. `CHAE FOOT CREAM` (Lacks Item and Carton dimensions)
  2. `REALLY GOOD SHAMPOO` (Lacks Item and Carton dimensions)

---

## File Modification Log
- `lib/product/registration-status.ts`: Updated `ProductRegistrationEvaluationInput` and `evaluateProductRegistrationStatus` to validate Item Spec, Package Spec, and Carton Spec.
- `app/portal/products/page.tsx`: Updated Supabase query select list to fetch item and carton specs and pass to evaluator.
- `app/admin/products/page.tsx`: Updated `evaluateProductRegistrationStatus` invocation to include item and carton fields.
- `lib/retailer/products.ts`: Updated query `.select()` and evaluator call for catalog filtering.
- `components/admin/product-override-tabs.tsx`: Updated `currentOverrides` and evaluator call.
- `components/product/product-detail-tabs.tsx`: Removed duplicate `CategoryAttributeForm` block, updated labels with required red asterisks, and converted carton inputs to decimal text inputs.

---

## Verification Matrix
- **TypeScript:** 0 Errors (`npx tsc --noEmit` PASS)
- **Production Build:** SUCCESS (`npm run build` PASS)
- **3-Way Completion Percentage Alignment:** Verified Header % === Category Tab % === Product List %
