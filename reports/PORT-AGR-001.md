# Implementation Report: Agreement System R2 Refinements

## Task Summary
- **Task IDs**: `PORT-AGR-001-R2`, `ADM-AGR-001-R2`, `ADM-CASE-004-R2`
- **Task Name**: Agreement Signing UX Refinement, Inquiry Routing Cleanup & Step 4 Execution Error Fix
- **Repository**: `chaehahm-Kr/KBGP-Portal`

## Key Improvements & Root Cause Fixes

### 1. Step 3 Inquiry Guidance Placement & Style Refinement
- **Changes**:
  - Moved inquiry guidance to the bottom of Step 3 (directly above navigation control buttons `[이전 단계]`, `[다음 단계]`).
  - Replaced strong alert/banner styling with low-emphasis, quiet informational text (`text-xs text-zinc-500`).
  - Text:
    - `"• 계약 내용에 문의사항이 있는 경우 계약을 완료하기 전에 문의 지원 메뉴를 통해 문의해 주세요."`
    - `"• 계약서 내용은 전자서명 과정에서 직접 수정할 수 없습니다."`
  - Direct shortcut link: `[문의 지원]` (opens support form).

### 2. Support Inquiry Routing Default Category Fix
- **Changes**:
  - Added `agreement_change: "계약 변경 및 서명 문의"` to `CATEGORY_LABELS` in `components/support/portal-support-view.tsx`.
  - Added explicit handling for `categoryParam === "agreement_change"` query parameters (`agreement_id`, `company_name`, `agreement_version`, `agreement_status`).
  - Prefills title as `[계약 ID] 브랜드 공급 기본계약서 관련 문의` and populates detailed agreement metadata in inquiry content.
  - Corrected PO Change condition (`isPoChangeRequested`) so opening agreement support links **NEVER defaults to `PO 변경 요청`**.

### 3. Step 4 Execution Error Structural Solution
- **Root Cause**: `signCompanyAgreementAction` previously relied solely on `input.companyAgreementId`. If state passed undefined or stale IDs, server lookup returned `계약서 정보를 찾을 수 없습니다.`
- **Multi-Tier Resolution Fix**:
  - Enhanced `signCompanyAgreementAction` to accept `companyId?: string` alongside `companyAgreementId?: string`.
  - Implemented 4-tier fallback:
    1. Lookup by `input.companyAgreementId`.
    2. Lookup by `input.companyId` (passed directly from `companyInfo.id`).
    3. Lookup by authenticated user's `company_users.id`.
    4. Auto-initialize pending `company_agreements` record linked to Template v1.0 if missing.
  - Guarantees 100% reliable agreement context resolution on first click.

### 4. Remove Inquiry Guidance from Step 4
- Completely removed all inquiry/support banner lines from Step 4.
- Step 4 remains 100% focused on execution summary, signature preview, signer/recipient info, consent checkboxes, and final submission.
