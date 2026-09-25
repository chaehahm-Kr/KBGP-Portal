# Task Handoff Report: PORT-PROD-NEW-003-R4

## Task Identification
- Task ID: PORT-PROD-NEW-003-R4
- Title: P0 — Remove Product Detail Global Click Interception & Restore Brand Portal Navigation
- Project: `chaehahm-Kr/KBGP-Portal`
- Production Domain: `https://portal.kselectnetwork.com`

---

## 1. Executive Summary & Structural Refactor

### Issue Overview & Root Cause
In previous iterations, `useUnsavedChangesGuard` attached a capture-phase document click listener (`document.addEventListener("click", handleClickCapture, true)`). Because document-level capture listeners intercept all `<a>` element click events across the document before React or Next.js event delegation runs, any subtle dirty-state state evaluation or timing mismatch completely deadlocked all in-app navigation (including sidebar links, breadcrumb back links, and top navigation).

### Architectural Correction Implemented
1. **Complete Removal of Document Click Capture**:
   - Removed `document.addEventListener("click", handleClickCapture, true)` entirely from `hooks/use-unsaved-changes-guard.tsx`.
   - The hook no longer intercepts document-level click events. Next.js App Router client navigation and standard link clicks (`<Link href="...">`, `<a>`) execute naturally without interference.

2. **Explicit Navigation Guarding API**:
   - Retained native browser protection (`beforeunload` for page refresh / tab close and `popstate` for browser back/forward).
   - Provided `confirmNavigation(target)` helper for explicit button and back-link navigation guarding.
   - Connected `confirmNavigation("/portal/products")` and `confirmNavigation("/admin/products")` to the back links (`목록으로 돌아가기`) in `ProductDetailTabs` and `ProductOverrideTabs`.

---

## 2. Corrective Changes Implemented

1. **`hooks/use-unsaved-changes-guard.tsx`**:
   - Deleted the global `document.addEventListener("click", ...)` effect.
   - Retained `beforeunload`, `popstate`, and exposed `confirmNavigation`.

2. **`components/product/product-detail-tabs.tsx`**:
   - Destructured `confirmNavigation` from `useUnsavedChangesGuard`.
   - Added `onClick` handler to `<Link href="/portal/products">` ("목록으로 돌아가기") to prompt with `confirmNavigation` only when `isAnyDirty === true`.

3. **`components/admin/product-override-tabs.tsx`**:
   - Destructured `confirmNavigation` from `useUnsavedChangesGuard`.
   - Added `onClick` handler to `<Link href="/admin/products">` ("← 전체 제품 목록으로 돌아가기") to prompt with `confirmNavigation` only when `isAnyDirty === true`.

---

## 3. QA Verification Checklist

### Local Development QA
- **TypeScript**: `npx tsc --noEmit` -> 0 Errors (PASS)
- **Production Build**: `npm run build` -> Success (PASS)

### Navigation Functional Scenarios
1. **Fresh Load Navigation ("목록으로 돌아가기" & Sidebar Links)**:
   - Fresh load with zero edits -> `isDirty = false`.
   - Navigating via "목록으로 돌아가기", sidebar links ("제품 관리", "주문 관리", "정산 관리", "문의 지원", "입점 신청", "설정"), or header controls works immediately without modal or delay.
2. **Unsaved Edits Guard & Discard Navigation**:
   - Making an edit sets `isDirty = true`.
   - Clicking back link opens warning modal ("저장하지 않은 변경사항이 있습니다.").
   - Clicking "저장하지 않고 나가기" unblocks and navigates immediately to the target route.
3. **Save & Immediate Post-Save Navigation**:
   - Editing and clicking "변경사항 저장" updates baseline snapshot.
   - Post-save `isDirty` resets to `false`.
   - Navigating via links works immediately.

---

## 4. Git & Deployment Record
- **Commit Message**: `fix(navigation): PORT-PROD-NEW-003-R4 remove global click capture guard and restore navigation`
- **Modified Files**:
  - `hooks/use-unsaved-changes-guard.tsx`
  - `components/product/product-detail-tabs.tsx`
  - `components/admin/product-override-tabs.tsx`
  - `reports/PORT-PROD-NEW-003-R4.md`
- **Migration Files**: N/A (No database schema changes required)

---

## 5. Final Status
COMPLETED
