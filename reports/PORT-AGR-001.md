# Implementation Report: Agreement System R1 Enhancements

## Task Summary
- **Task IDs**: `PORT-AGR-001-R1`, `ADM-AGR-001-R1`, `ADM-CASE-004-R1`
- **Task Name**: Agreement Signing UX, Recipient Records, Execution Fix & Distribution History
- **Repository**: `chaehahm-Kr/KBGP-Portal`

## Key Improvements & Bug Fixes

### 1. Root Cause & Fix for Step 4 Execution Failure ("계약서 정보를 찾을 수 없습니다.")
- **Root Cause**: `getCompanyAgreement` queried `company_users` with `.eq("user_id", user.id)`. However, the primary key column referencing `auth.users(id)` in `public.company_users` is `id`, NOT `user_id`. This caused `company_id` to evaluate to undefined, failing the `company_agreements` initial record lookup/creation and passing an empty/invalid agreement ID to `signCompanyAgreementAction`.
- **Fix**:
  1. Updated `company_users` query in `getCompanyAgreement` to use `.eq("id", user.id)`.
  2. Enhanced `signCompanyAgreementAction` with fallback company lookup via `company_users` and auto-creation of missing pending agreement records so `company_agreements` lookup never fails.

### 2. Step 1 Info Edit Shortcuts & Prerequisite Check
- Added clear notice: `"회사 정보 또는 담당자 정보가 정확하지 않은 경우 계약 진행 전에 수정해 주세요."`
- Added direct shortcut buttons:
  - `[회사 정보 수정 ↗]` -> opens `/portal/company/info?tab=basic`
  - `[내 정보 수정 ↗]` -> opens `/portal/account`
- Maintained minimum required prerequisite: Company Name and Business Address required before proceeding.

### 3. Additional Recipient Function & Normalized Recipient Schema
- Added optional section in Step 2: `"계약서 사본을 함께 받을 사람"`
- Signer can add 1 or multiple additional recipients (Name, Title, Email required per row).
- Created `public.company_agreement_recipients` table (Migration 0114) storing normalized records for Signer (`recipient_type: 'signer'`) and Additional Recipients (`recipient_type: 'additional_recipient'`).
- Integrated email dispatch via `sendEmail` helper. Email delivery errors do not invalidate the executed Agreement (Requirement 8: separation of Agreement Execution from Agreement Distribution).

### 4. Recipient Distribution History (Brand Portal & Admin)
- **Brand Portal**: Added `"계약서 수신 기록"` section to Agreement card in Settings > 회사 정보, listing Name, Title, Email, Role, Sent Date, Delivery Status, and manual resend button (`resendAgreementRecipientEmailAction`). Enforced tenant isolation.
- **Admin**: Added `"수신자/배포 이력 (Recipients)"` button and modal to Company Agreements tab in Admin > Companies, displaying exact distribution history per agreement ID.

### 5. Guidance Wording & Support Link Cleanup
- Completely removed confusing terms such as `"계약 수정"`, `"계약서 수정"`, `"Modify Agreement"`.
- Added clear guidance in Step 3 and Step 4:
  - `"계약 내용에 문의사항이 있는 경우 계약을 완료하기 전에 '문의 지원' 메뉴를 통해 문의해 주세요."`
  - `"계약서 내용은 전자서명 과정에서 직접 수정할 수 없습니다."`
  - Direct shortcut: `[문의 지원 바로가기 ↗]` (routes to `/portal/support?new=1&category=agreement_change`).

### 6. Step 4 Completion UX
- Upon successful execution, modal transitions to a clean completion screen:
  - Title: `"계약이 성공적으로 완료되었습니다."`
  - Displays: Agreement ID, Version, Executed Date, Signer, and total recipient count (`"계약서 사본이 총 N명에게 전달되었습니다."`).
  - Action buttons: `[📄 계약서 보기]`, `[📥 PDF 다운로드]`, `[닫기]`.
