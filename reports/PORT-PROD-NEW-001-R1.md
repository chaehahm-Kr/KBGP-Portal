# K SELECT DEVELOPMENT HANDOFF REPORT

Task ID: PORT-PROD-NEW-001-R1
Task Name: Brand Portal Product Draft Semantics & Production Integrity Audit
Status: COMPLETED

---

### 1. Git / Production Integrity
- Local HEAD: `52dfdf6f5a526a60400056b3fee7040421dbc17e`
- origin/main: `52dfdf6f5a526a60400056b3fee7040421dbc17e`
- Vercel Production SHA: `52dfdf6f5a526a60400056b3fee7040421dbc17e`
- Custom Domain Runtime SHA: `52dfdf6f5a526a60400056b3fee7040421dbc17e`
- Reconciliation Note: Previous task commit `98dff01` was merged into `main`. Subsequent parallel agent commits (`0029a94`, `a5993da`, `84f929f`, `52dfdf6`) were cleanly integrated. `Local HEAD === origin/main === Vercel Production === 52dfdf6f5a526a60400056b3fee7040421dbc17e`.

---

### 2. Draft Data Model & Field Mapping
For every normally-required field, the draft data semantics and persistence behavior are documented below:

| Field | Form Value | Saved Draft Value when Blank | DB Column Nullability | Publish/Submission Validation |
|---|---|---|---|---|
| **Brand** (`brand_id`) | Select dropdown | Blocked at Draft Save ("브랜드를 선택해주세요") | `uuid NOT NULL` | Required |
| **Manufacture SKU** (`manufacture_sku`) | Input string | `DRAFT-SKU-${timestamp}` (system technical identifier) | `text NOT NULL` | Required. Sanitized in UI form as `""` (no fake text shown); evaluated as missing `"제조사 SKU"` |
| **English Product Name** (`name_en` / `name`) | Input string | `name_en`: `null`, `name`: `"[임시저장] 신규 제품"` | `name_en` NULLABLE, `name` NOT NULL | Required. Form opens as `""` (`name_en`); evaluated as missing `"영문 제품명"` |
| **Category** (`category` / `category_code`) | Select dropdown | `null` | NULLABLE | Required. Evaluated as missing `"카테고리"` |
| **Origin** (`origin`) | Input string | `null` | NULLABLE | Required for registration completeness (`"원산지"`) |
| **Retail KRW Price** (`price_krw_retail`) | Input number | `null` | NULLABLE | Required. Evaluated as missing `"소비자 판매가"` |
| **Export USD FOB Price** (`price_usd_fob`) | Input number | `null` | NULLABLE | Required. Evaluated as missing `"FOB 수출 가격"` |
| **Package Dimensions & Weight** | Input numbers | `null` | NULLABLE | Required for registration completeness (`"패키지 배송 규격"`) |
| **Barcode (UPC / EAN)** (`upc`, `ean`) | Input string | `null` | NULLABLE | Required at final submit (`!upc && !ean` BLOCKED; `upc && ean` BLOCKED) |
| **Online Sales Link 1** (`sales_link_1`) | Input URL | `null` | NULLABLE | Required if `selling_online` is true |
| **Representative Image** (`product_images`) | File upload | 0 rows | NULLABLE | Required for registration completeness (`"대표 이미지"`) |

---

### 3. Draft vs Final State
- Authoritative Evaluator: `evaluateProductRegistrationStatus` in `lib/product/registration-status.ts`.
- `isDraft`: Evaluated dynamically (`missingFields.length > 0`).
- Registration Status Values:
  - `"DRAFT"`: Incomplete product with 1+ missing required fields.
  - `"COMPLETE"`: Fully registered product with 0 missing required fields.
  - `"DELETED"`: Soft-deleted product.

---

### 4. Missing Field Persistence
- No fake business data ("N/A", "Unknown", "000000000000") is presented as real product data.
- System technical fallbacks (`DRAFT-SKU-XXXXXX` and `[임시저장] 신규 제품`) used to satisfy database `NOT NULL` constraints are automatically filtered out when opening product forms and in completeness evaluations, ensuring input fields remain genuinely blank `""`.

---

### 5. Draft Visibility & Isolation
- **Brand Portal**: Visible to owning Brand user with explicit `Draft (보완 대기)` badge in red (`bg-rose-50 text-rose-700`).
- **Retailer Product Catalog / Discovery**: Incomplete drafts are strictly isolated. `getRetailerProducts` requires active `product_curations` with an approved `wholesale_price > 0`. Draft products have no curation and `wholesalePrice = 0`, rendering them non-orderable and hidden from Retailer Discovery.
- **Admin**: Clearly labeled as `Draft (보완 대기)` for operational review.

---

### 6. Draft Save UX
- Brand user may enter partial data and click "임시 저장 후 나중에 등록" (`submitAction === "list"`).
- Bypasses required field and barcode validations.
- No browser `alert()` popups used.
- Displays toast notification after redirect: `✅ 임시 저장되었습니다. 나중에 이어서 등록할 수 있습니다.`.

---

### 7. Draft Reopen & Editing
- Reopening an existing draft pre-populates entered values while leaving missing fields genuinely blank `""`.
- Saving intermediate edits preserves the exact same Product ID without creating duplicate product rows.

---

### 8. Final Validation
- Final submission (`submitAction === "continue"`) enforces server-side and client-side validation for Brand, Category, Manufacture SKU, English Product Name, Retail KRW Price, Export USD FOB Price, Barcode (UPC or EAN), and Online Sales Link.
- Missing required fields trigger inline red border highlighting (`getInputClass`) and top error banner without browser `alert()`.

---

### 9. UPC / EAN Validation
- Authoritative Business Rule: At least ONE barcode (UPC or EAN) must be present for final submission.
  - UPC only -> PASS
  - EAN only -> PASS
  - UPC + EAN -> BLOCKED (`"UPC와 EAN 번호는 동시에 입력할 수 없습니다. 둘 중 하나만 입력해 주세요."`)
  - Both empty on Final Submit -> BLOCKED (`"UPC 또는 EAN 번호 중 하나는 반드시 입력해야 합니다."`)
  - Both empty on Draft Save -> PASS (Saved as draft)

---

### 10. Draft → Final Identity
- Product ID is generated on initial draft creation and retained throughout all subsequent updates.
- Draft Product ID === Final Product ID. No duplicate product is generated upon final registration.

---

### 11. Required Marker Audit
- All `<RequiredAsterisk />` red `*` markers in `product-form.tsx` match authoritative server-side final submission rules.
- Barcode section displays an explicit helper banner: `💡 UPC 또는 EAN 중 하나는 반드시 입력해야 합니다.`

---

### 12. Brand Products List
- `PortalProductsList` displays exposed status tabs (`활성/보완 대기 (기본)`, `등록 완료`, `보완 대기 (Draft)`, `삭제됨`, `전체`).
- Clear visual badges differentiate Draft (`Draft (보완 대기)` with missing fields summary) from registered products (`등록 완료`).

---

### 13. Admin Regression
- Verified Admin products list, trading view, and pricing calculator.
- Admin views correctly display draft statuses without breaking curation or trading sync workflows.

---

### 14. Retailer Regression
- Retailer B2B Catalog (`/retailer/products`) enforces `product_curations` wholesale price checks (`wholesalePrice > 0`), ensuring draft products never leak into Retailer Discovery or order workflows.

---

### 15. Security & Tenant Isolation
- All Server Actions (`createProduct`, `updateProduct`, `deleteProduct`) derive tenant `company_id` authoritatively via `requireCompanyMembership()`.
- Brand A cannot access, edit, or finalize Brand B draft products.

---

### 16. Database / Migration
- Existing database schema in Supabase (`shzfrppdobpmrstcjfqu`) fully supports draft persistence.
- No schema changes or migrations required (`Migration Files: N/A`).

---

### 17. Production Browser QA
- Tested URL: `https://portal.kselectnetwork.com/portal/products/new`
- Test Scenarios & Results:
  - Partial Draft Save -> PASS
  - Draft Toast -> PASS (`✅ 임시 저장되었습니다. 나중에 이어서 등록할 수 있습니다.`)
  - Draft Reopen -> PASS (Missing fields remain blank `""`)
  - Final Submit missing required field -> PASS (Inline red border errors appear; no browser `alert()`)
  - Final Submit UPC only -> PASS
  - Final Submit EAN only -> PASS
  - Final Submit both empty -> BLOCKED (Inline error banner)
  - Draft → Final Identity -> PASS (Product ID preserved)

---

### 18. Required QA Matrix

| Audit Check | Status |
|---|---|
| Partial Draft Save | PASS |
| No Fake Product Fallback Data | PASS |
| Draft State Authoritative | PASS |
| Draft Isolated from Retailer Catalog | PASS |
| Draft Reopen | PASS |
| Entered Values Preserved | PASS |
| Required * Alignment | PASS |
| No browser alert() | PASS |
| Inline Validation | PASS |
| Server Final Validation | PASS |
| UPC Only Final Submit | PASS |
| EAN Only Final Submit | PASS |
| Both Barcode Empty Final Submit | MUST FAIL (PASS) |
| Draft Both Barcode Empty | PASS |
| Draft → Final Same Product ID | PASS |
| Tenant Isolation | PASS |
| Admin Regression | PASS |
| Retailer Regression | PASS |
| TypeScript | PASS (0 Errors) |
| Production Build | PASS (Success) |
| Local HEAD | `52dfdf6f5a526a60400056b3fee7040421dbc17e` |
| origin/main | `52dfdf6f5a526a60400056b3fee7040421dbc17e` |
| Vercel Production | `52dfdf6f5a526a60400056b3fee7040421dbc17e` |
| Custom Domain Runtime | `52dfdf6f5a526a60400056b3fee7040421dbc17e` |

---

### 19. Issues / Risks
- None. System is fully operational and synchronized across Git, Vercel Production, and Supabase Production DB.

---

### 20. Final Status
COMPLETED
