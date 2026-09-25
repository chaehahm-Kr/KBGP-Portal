# PORT-PROD-NEW-003 Task Report
**Brand Product Logistics Required Validation, Duplicate Category Section Removal & Navigation Lock / Stuck Saving State Fix**

## Executive Summary
This task resolved two primary issues and a critical production regression in the Brand Portal product registration and detail management workflows:
1. **Authoritative Logistics Completeness Rule:** Expanded `evaluateProductRegistrationStatus` in `lib/product/registration-status.ts` to require Item Spec (`item_width/depth/height/weight`), Package Spec (`package_width/depth/height/weight`), and Carton Box Specs (`carton_pack_qty/width/depth/height/weight`). Missing or zero values in any group transition the product to `Draft / 보완 대기` with explicit warnings (`단품 규격`, `단품 포장 패키지 규격`, `아웃 카톤 규격`). Derived fields such as CBM remain non-required.
2. **Duplicate Category UI Removal:** Removed the redundant `<CategoryAttributeForm>` instance mounted inside `components/product/product-detail-tabs.tsx` so the `카테고리 & 속성` tab displays exactly ONE set of Category Assignment, Common Attributes, and Product Profile Attributes.
3. **Numeric Editing & Label Integrity:** Added required `*` indicators to Item and Carton labels in `components/product/product-detail-tabs.tsx` and converted Carton inputs to `inputMode="decimal"` text controls with regex sanitize on change, preserving intermediate numeric editing and auto-select-on-focus UX.
4. **Critical Production Regression Fix (Navigation Lock & Stuck Saving State):**
   - **Stuck Saving State Root Cause & Fix:** `ProductDetailTabs` relied solely on React 19 / Next 15 `useTransition`'s `isPending` state for save buttons while executing async server actions and `router.refresh()`. If `router.refresh()` or async state sync didn't conclude immediately, `isPending` remained `true`, leaving save buttons stuck on `"저장 중..."` even after the success banner appeared. Fixed by introducing an explicit `isSaving` boolean state managed inside a `try ... finally { setIsSaving(false) }` block, guaranteeing save buttons immediately reset to `"변경사항 저장"` upon response.
   - **Navigation Lock Root Cause & Fix:** `CategoryAttributeForm`'s `checkIsDirty()` was evaluating unnormalized `null` vs `""` or `undefined` attribute values, causing false positive dirty states on initial load or after save when snapshot refs mutated without triggering state updates. As a result, `useUnsavedChangesGuard` remained active and intercepted link clicks (`<a>` tags including "목록으로 돌아가기" and all sidebar items) via `document.addEventListener("click", handleClickCapture, true)`. Fixed by normalizing empty attribute values in `checkIsDirty()`, ensuring `isDirty` evaluates to `false` when clean, and preventing link click capture listeners from mounting when `isDirty` is `false`.

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
- `components/product/product-detail-tabs.tsx`:
  - Removed duplicate `CategoryAttributeForm` block.
  - Added required red asterisks to Item and Carton labels.
  - Converted carton inputs to decimal text inputs.
  - Introduced explicit `isSaving` state with `try ... finally { setIsSaving(false) }` lifecycle.
  - Aligned top and bottom save buttons to `isSaving`.
- `components/product/category-attribute-form.tsx`: Normalized empty/null value checks in `checkIsDirty()` to prevent false positive dirty states.
- `hooks/use-unsaved-changes-guard.tsx`: Conditionally attached `handleClickCapture` listener only when `isDirty` is true.

---

## Required QA Matrix
| QA Scenario | Result |
| :--- | :--- |
| Initial List Button (`목록으로 돌아가기`) | PASS |
| Sidebar Navigation Before Edit | PASS |
| Save Starts Loading (`저장 중...`) | PASS |
| Save Success Persists | PASS |
| Saving State Clears | PASS |
| Top Save Button Returns to Idle (`변경사항 저장`) | PASS |
| Bottom Save Button Returns to Idle (`변경사항 저장`) | PASS |
| List Button After Save | PASS |
| Sidebar After Save | PASS |
| Repeated Save 3x | PASS |
| No Invisible Overlay | PASS |
| No Stale Global Event Listener | PASS |
| Pending Media Warning | PASS |
| Continue Editing | PASS |
| Leave Without Upload | PASS |
| Uploaded Media Clears Guard | PASS |
| All Product Tabs Clickable | PASS |
| Save Failure Restores UI | PASS |
| Category Regression | PASS |
| Completion Regression | PASS |
| Numeric Input Regression | PASS |
| Media Regression | PASS |
| TypeScript (`npx tsc --noEmit`) | PASS (0 Errors) |
| Production Build (`npm run build`) | PASS (Success) |
