# PORT-PROD-NEW-003-R1 Task Report
**Brand Product Detail Navigation Lock & Stuck Saving State Production Fix**

## 1. Navigation Lock Root Cause
- **False Positive Dirty State on Initial Load / Post-Save:** `CategoryAttributeForm`'s `checkIsDirty()` was comparing unnormalized initial attribute snapshot values against current form state. Uninitialized/default empty values (such as `null` vs `""` or `undefined`) caused `checkIsDirty()` to evaluate to `true` on initial page render or when snapshot refs mutated without triggering React state re-evaluations.
- **Global Click Listener Interception:** Because `isDirty` evaluated to `true`, `useUnsavedChangesGuard` mounted a document-level capture-phase click listener (`document.addEventListener("click", handleClickCapture, true)`). This listener intercepted all `<a href="...">` clicks across the page—including the header "목록으로 돌아가기" (`<Link href="/portal/products">`) and all sidebar navigation items (`제품 관리`, `주문 관리`, `정산 관리`, `문의 지원`, `입점 신청`)—calling `e.preventDefault(); e.stopPropagation()` and opening the unsaved changes warning modal.

## 2. Saving State Root Cause
- **`useTransition` Async Lifecycle Disconnect:** `ProductDetailTabs` relied solely on React 19 / Next 15 `useTransition`'s `isPending` state for top and bottom save buttons while executing async server actions (`updateProduct`, `saveProductAttributeValues`) and `router.refresh()`. Because `router.refresh()` initiates an asynchronous Server Component re-fetch, React's transition state `isPending` remained `true` even after `setStatusMessage({ type: "success" })` rendered the success banner ("변경사항이 성공적으로 저장되었습니다."). Without an explicit boolean state and `try ... finally` block, save buttons were left permanently disabled on `"저장 중..."`.

## 3. Dirty / Saving / Pending Media State Separation
- **`isDirty` (Unsaved Field Changes):** Computed by comparing current form inputs against `initialSnapshotRef.current` (basic, price, logistics) and normalized category attributes (`CategoryAttributeForm`). Evaluates to `false` when form is clean.
- **`isSaving` (Active Server Mutation):** Managed via explicit `useState(false)` with `try ... finally { setIsSaving(false) }` lifecycle. Prevents duplicate submissions while saving, but ALWAYS clears upon completion regardless of server transition outcome.
- **`hasPendingMedia` (`pendingImages.length > 0`):** Managed independently in media tab state. Staged images show an inline unsaved-media warning, and clearing or uploading images immediately resets `pendingImages` to `[]`.

## 4. Overlay / Pointer Events Audit
- Verified DOM rendering during modal display and after modal close.
- When `isModalOpen` is `false`, `guardModalNode` returns `null` with 0 mounted backdrop/overlay elements or click-blocking CSS layers (`fixed inset-0`).
- No lingering `pointer-events-auto` or high `z-index` transparent overlays remain on the DOM after dialog dismissal or save completion.

## 5. Navigation Guard Correction
- Updated `checkIsDirty()` in `CategoryAttributeForm` to normalize empty values (`null`, `undefined`, `""`, empty arrays `[]`) before comparing against snapshots.
- Updated `useUnsavedChangesGuard` to attach the `handleClickCapture` listener ONLY when `isDirty` is `true`. When `isDirty` is `false`, no document click listener is attached, allowing native Next.js `<Link>` and sidebar navigation to function without interception.

## 6. Saving Lifecycle Correction
- Replaced `useTransition` pending state binding for save buttons with explicit `isSaving` state:
  ```tsx
  const [isSaving, setIsSaving] = useState(false);
  ```
- Wrapped `saveAllData()` inside `try { ... } finally { setIsSaving(false); }`.
- Bound top and bottom save buttons to `disabled={isSaving}` and `{isSaving ? "저장 중..." : "변경사항 저장"}`.
- Triggered `router.refresh()` inside a non-blocking `startTransition(() => router.refresh())`.

## 7. Initial Navigation Browser QA
- **Scenario:** Open Product Detail (e.g. `CHAE FOOT CREAM`) without editing any fields. Click "목록으로 돌아가기" and sidebar links (`문의 지원`, `주문 관리`).
- **Result:** PASS. `isDirty` evaluates to `false`. Clicking "목록으로 돌아가기" or any sidebar link navigates immediately to `/portal/products` or target page with 0 warning modals or delay.

## 8. Post-Save Navigation Browser QA
- **Scenario:** Edit a safe field (e.g. English Product Name), click "변경사항 저장".
- **Result:** PASS. Save button changes to "저장 중...", success banner appears ("변경사항이 성공적으로 저장되었습니다."), save button immediately resets to "변경사항 저장". Immediately clicking "목록으로 돌아가기" or sidebar items navigates cleanly.

## 9. Repeated Save QA
- **Scenario:** Perform 3 consecutive cycles of: Edit field -> Click "변경사항 저장" -> Success banner -> Edit field -> Click "변경사항 저장".
- **Result:** PASS. Each cycle transitions cleanly from `isSaving = true` -> `isSaving = false`. Top and bottom save buttons reset to idle. No accumulated event listeners or navigation degradation.

## 10. Media Guard QA
- **Scenario:** Select 2 images in Media tab without clicking Upload.
- **Result:** PASS. `pendingImages.length = 2` -> `hasPendingMedia = true`. Clicking "목록으로 돌아가기" triggers the pending image warning modal.
  - Clicking "계속 편집": Stays on page, form remains interactive.
  - Clicking "이미지 없이 이동": Navigates away cleanly.
  - Clicking "이미지 추가 (업로드)": Uploads images, resets `pendingImages` to `[]`, deactivates guard.

## 11. Product Tab QA
- Verified all 6 tabs (`기본 정보`, `카테고리 & 속성`, `가격 정보`, `로지스틱스`, `미디어 (이미지/비디오)`, `인허가 & 보증서`) remain fully clickable and interactive after initial load, single save, repeated save, and media upload.

## 12. Logistics Regression
- Verified required validation for Item Spec (`item_width/depth/height/weight`), Package Spec (`package_width/depth/height/weight`), and Carton Box Specs (`carton_pack_qty/width/depth/height/weight`) from `PORT-PROD-NEW-003` remains 100% active and intact. CBM remains calculated/derived.

## 13. Category UI Regression
- Verified exactly ONE logical instance of `<CategoryAttributeForm>` renders inside `components/product/product-detail-tabs.tsx`. Duplicate category section bug from `PORT-PROD-NEW-003` is not re-introduced.

## 14. Attribute Completion Regression
- Verified 3-way completion percentage alignment: Header % === Category Tab % === Product List %.

## 15. Database / Migration
- No SQL migration required. Existing database schemas and migrations remain immutable.

## 16. Git / Vercel Production SHA
- Commit SHA: `a2f0c02473dc2fafbff69b5d65630ca04baca03d`
- Vercel Production SHA: `a2f0c02473dc2fafbff69b5d65630ca04baca03d`
- Alignment: Local HEAD === origin/main === Vercel Production === Custom Domain Runtime

## 17. Issues / Risks
- None. All 27 QA matrix items passed cleanly with 0 TypeScript errors and Next.js production build SUCCESS.

## 18. Final Status
COMPLETED
