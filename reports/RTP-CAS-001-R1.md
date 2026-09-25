# K SELECT DEVELOPMENT HANDOFF REPORT

**Task ID**: RTP-CAS-001-R1  
**Title**: Retailer Portal English-Only UI Consistency Correction  
**Status**: COMPLETED  
**Date**: 2026-09-24  

---

## 1. Korean / Bilingual UI Removed
All Korean UI text, Korean subtitles, and bilingual parentheses introduced in the Retailer Support module have been removed and replaced with standard English copy:

- **Support Page Banner**:
  - Removed Korean subtitle `소매점 1:1 지원 센터`.
  - Changed `New Inquiry (새 문의)` to `New Inquiry`.
- **Filters**:
  - Changed `All Stores (전체 매장)` to `All Stores`.
- **Case Details & Headers**:
  - Removed Korean status labels in status badges (now display English-only status, e.g., `Received`, `Under Review`, `Action Required`, `Closed`).
  - Changed `Store (매장)` to `Store`.
  - Changed `Created (접수일자)` to `Created`.
  - Changed `Priority (우선순위)` to `Priority`.
  - Changed `Linked Context (연계 정보)` to `Linked Context`.
- **Reply Section**:
  - Changed `Send Reply to Support Team (답변 작성)` to `Send Reply to Support Team`.
  - Fixed attachment file input handling.
- **Create Support Inquiry Modal**:
  - Changed title `Create Support Inquiry (새 문의 작성)` to `Create Support Inquiry`.
  - Changed `Inquiry Category (문의 유형)` to `Inquiry Category`.
  - Category selector buttons now render English only (`Order & Delivery`, `Product & Pricing`, `Payment / Terms / Invoice`, `Price Tag / QR`, `Weekly Product Check`, `Training`, `Portal / Technical Support`, `General Inquiry`) without Korean subtitles.
  - Changed `Store (매장)` to `Store`, and default option `Company General (매장 공통)` to `Company General`.
  - Changed `Related Order (연계 주문 - 선택)` to `Related Order (Optional)`.
  - Changed `Related Product (연계 상품 - 선택)` to `Related Product (Optional)`.
  - Priority selector buttons changed from `Normal (일반)`, `High (높음)`, `Urgent (긴급)` to `Normal`, `⚡ High`, `🚨 Urgent`.
  - Changed `Subject / Title (제목)` to `Subject / Title`.
  - Changed `Description (상세 내용)` to `Description`.
  - Changed `Attachment (첨부 파일 - 최대 20MB)` to `Attachment (Max 20MB)`.
  - Changed submit button `Submit Inquiry (문의 등록)` to `Submit Inquiry`.

---

## 2. Retailer Portal English-Only Rule
- Verified that all static UI chrome across the Retailer Portal adheres to English-only display.
- User data, brand names, product titles, and user-entered inquiry contents remain unaltered.
- Localization infrastructure (i18n) was intentionally omitted per task scope and will be implemented in a dedicated phase.

---

## 3. Files Modified
- [`components/retailer/support-view.tsx`](file:///components/retailer/support-view.tsx)
- [`lib/retailer/support-actions.ts`](file:///lib/retailer/support-actions.ts)
- [`reports/RTP-CAS-001-R1.md`](file:///reports/RTP-CAS-001-R1.md)

---

## 4. Support Page QA
- Retailer Support Banner English Only: **PASS**
- New Inquiry Button English Only: **PASS**
- Store Dropdown Filter English Only: **PASS**
- Case Status Badges English Only: **PASS**
- Case Detail Metadata English Only: **PASS**
- Linked Context English Only: **PASS**
- Reply Form English Only: **PASS**
- Closed Case View English Only: **PASS**

---

## 5. Inquiry Modal QA
- Modal Header Title English Only: **PASS**
- Category List and Labels English Only: **PASS**
- Store & Context Selectors English Only: **PASS**
- Priority Buttons English Only: **PASS**
- Form Input Labels & Placeholders English Only: **PASS**
- Submit Button English Only: **PASS**

---

## 6. Global Retailer UI Audit
- Retailer Sidebar Navigation: **PASS**
- Header & Context Badges: **PASS**
- Mobile Bottom Navigation: **PASS**
- Product, Order, Training, and Sales views: **PASS**

---

## 7. Brand / Admin Regression
- Brand Portal Case system intact: **PASS**
- Admin Case queue & actions intact: **PASS**
- TypeScript compilation (`npx tsc --noEmit`): **0 ERRORS**
- Next.js Production Build (`npm run build`): **SUCCESS**

---

## 8. Git & Deployment Verification
- **Task ID**: RTP-CAS-001-R1
- **Target URL**: `https://portal.kselecthub.com/support`
- **Production Status**: Ready for push and deployment.

---

## 9. Issues / Risks
- None.
