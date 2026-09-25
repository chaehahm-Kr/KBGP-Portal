# K SELECT DEVELOPMENT HANDOFF REPORT

**Task ID**: RTP-CAS-001-R2  
**Title**: Retailer Support Case Creation Failure & Modal Layout Correction  
**Status**: COMPLETED  
**Date**: 2026-09-25  

---

## 1. Executive Summary
This task resolved two critical production issues in the Retailer Support module (`https://portal.kselecthub.com/support`):
1. **Case Creation Failure**: Fixed the runtime error `Failed to create support inquiry. Please try again.` caused by invalid/non-existent columns (`created_source` and `priority`) being included in the `partner_inquiries` INSERT payload in `lib/retailer/support-actions.ts`.
2. **Modal Desktop Internal Scrollbar Elimination**: Refactored the Create Support Inquiry modal in `components/retailer/support-view.tsx` to a clean, multi-column desktop layout (`max-w-2xl`, 4-column category grid, 3-column store/order/product context row, 2-column priority/attachment row, compact textarea). The entire form fits comfortably on desktop viewports without requiring an internal vertical scrollbar, while retaining fluid responsive scrolling on mobile devices.

---

## 2. Root Cause Analysis & Server Action Resolution
- **Root Cause**:
  - `lib/retailer/support-actions.ts` attempted to insert `created_source: "portal"` and `priority: priority` into `public.partner_inquiries`.
  - The actual production PostgreSQL schema (`partner_inquiries`) does not have `created_source` or `priority` columns on the parent case table (the priority is tracked on thread messages/metadata, and source is `source_type`).
  - This resulted in PostgREST returning `PGRST204: Could not find the 'created_source' column of 'partner_inquiries' in the schema cache`, blocking all case creations.
- **Resolution**:
  - Cleaned the `partner_inquiries` insertion payload to match exact database schema columns:
    `company_id`, `created_by`, `category`, `title`, `content`, `attachment_path`, `attachment_filename`, `status: "open"`, `source_type: "retailer"`, `store_id: storeId || null`, `related_order_id`, `related_product_id`.
  - Added company store ownership validation when a specific `store_id` is supplied.
  - Retained support for `Company General` cases where `store_id` is `null`.
  - Added atomic rollback handling (cleaning up uploaded storage attachments and deleting the created inquiry row if initial message insertion fails).

---

## 3. UI/UX Modal Layout Improvements
- Changed modal dialog container from `max-w-lg` to `max-w-2xl` (672px width).
- **Inquiry Categories**: Displayed as a compact 4-column grid on desktop (`grid-cols-2 sm:grid-cols-4 gap-1.5`) with 8 categories fitting cleanly into 2 short rows.
- **Context Row**: Arranged Store, Related Order, and Related Product in a 3-column horizontal grid (`grid-cols-1 sm:grid-cols-3 gap-2.5`).
- **Priority & Attachment**: Arranged Priority pills and Attachment file picker side-by-side in a 2-column grid (`grid-cols-1 sm:grid-cols-2 gap-3`).
- **Input & Spacing Optimization**: Compacted vertical paddings (`space-y-3`, `py-1.5` inputs/selects, `rows={3}` textarea) so the entire modal fits within standard desktop viewports (<500px height) without an internal scrollbar.

---

## 4. Modified Files
- [`lib/retailer/support-actions.ts`](file:///lib/retailer/support-actions.ts): Fixed schema alignment, store validation, and error rollback for case creation.
- [`components/retailer/support-view.tsx`](file:///components/retailer/support-view.tsx): Refactored Create Support Inquiry modal layout for desktop viewports.
- [`reports/RTP-CAS-001-R2.md`](file:///reports/RTP-CAS-001-R2.md): Task handoff report.

---

## 5. QA Verification Results
- **TypeScript QA (`npx tsc --noEmit`)**: **PASS (0 errors)**
- **Next.js Production Build (`npm run build`)**: **PASS (Success)**
- **Database Schema Validation**: Verified against production Supabase instance (`shzfrppdobpmrstcjfqu`). Both `Company General` and store-scoped inquiries insert cleanly.
- **Admin & Brand Regression**: Brand case creation, Admin Case Management queue, and Admin partner inquiry workflows remain unaffected.
- **English-Only UI Preservation**: All UI chrome in the retailer support view and modal retains 100% English copy.

---

## 6. Verification Checklist
- [x] Case creation succeeds with no schema mismatch error.
- [x] Company General (`store_id === null`) cases create and display correctly.
- [x] Store-specific cases attach to selected stores correctly.
- [x] Desktop modal has no internal right-side scrollbar on standard viewports (>= 768px height).
- [x] Mobile modal scrolls responsively on narrow/short screens.
- [x] English-only UI chrome strictly maintained.
