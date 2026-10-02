# MAN-B-FIN-001 — Screenshot Annotation Guide
## K SELECT Brand Portal & Admin: Finance & Settlement (스크린샷 주석 가이드)

---

## 1. Executive Overview

본 문서는 **MAN-B-FIN-001 (Finance & Settlement Guide)** 매뉴얼에 수록된 13종의 프로덕션 스크린샷(`SCR-B-FIN-001.png` ~ `SCR-B-FIN-013.png`)에 대한 주석, 번호별 콜아웃 목표, 가시 상태 및 기술적 설명을 정리한 명세서이다.

---

## 2. Screenshot Annotation Mapping Inventory

### 2.1 Asset 1: `SCR-B-FIN-001.png`
- **Title**: Finance Hub — Invoices Tab
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance`
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 1. 정산 관리 개요 & Finance Hub Navigation
- **Visible State**: Invoices 탭 활성화, 상단 지표 카드 3종 산출 완료 상태.
- **Callout Annotations**:
  1. `[1] Top Metric Cards`: 총 인보이스 금액, 총 지급 금액 (Paid), 총 잔액 (Balance Due) 수치.
  2. `[2] Tab Navigation`: '인보이스', '정산', '지급 내역' 3대 탭 전환 버튼.
  3. `[3] Filter Controls`: 키워드 검색, 기간 지정(시작/종료일), 지급 상태/문서 상태 드롭다운.
  4. `[4] New Invoice Button`: '+ 새 인보이스 발행' 작성 페이지 진입 CTA 버튼.

---

### 2.2 Asset 2: `SCR-B-FIN-002.png`
- **Title**: New Invoice — PO Selection
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/new`
- **User Role**: Brand Portal User (`finance:write`)
- **Manual Chapter**: Chapter 2.1 자격 부여 발주서(PO) 선택
- **Visible State**: 자격 부여 조건(`CONFIRMED` & `APPROVED/SENT`)을 만족하는 발주서 선택 드롭다운.
- **Callout Annotations**:
  1. `[1] PO Select Dropdown`: 발행 대상 발주서(PO) 목록 선택 드롭다운.
  2. `[2] Auto-bound Snapshot`: 선택 시 자동 로드되는 통화(Currency), 결제 조건(Payment Terms), 인도 조건(Incoterms).

---

### 2.3 Asset 3: `SCR-B-FIN-003.png`
- **Title**: New Invoice — Line & Adjustment Entry
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/new`
- **User Role**: Brand Portal User (`finance:write`)
- **Manual Chapter**: Chapter 2.2 품목 청구 수량/단가 입력 및 증빙 첨부
- **Visible State**: 품목 청구 수량/단가입력 폼, 정산 조정 (+/-) 작성란 및 파일 첨부 영역.
- **Callout Annotations**:
  1. `[1] Invoiced Qty & Unit Price`: 품목별 청구 수량 및 단가 입력란.
  2. `[2] Adjustments Section`: 정산 감액(- CREDIT) / 증액(+ CHARGE) 작성 항목.
  3. `[3] Final Invoice Total`: 자동 합산된 최종 청구 금액 (`invoice_total`).
  4. `[4] File Attachment`: PDF 송장 증빙 파일 업로드 버튼 (`company-uploads`).

---

### 2.4 Asset 4: `SCR-B-FIN-004.png`
- **Title**: Invoice Detail — Draft State
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/[id]`
- **User Role**: Brand Portal User (`finance:write`)
- **Manual Chapter**: Chapter 3.1 임시저장(DRAFT) 인보이스 조회, 수정 및 제출
- **Visible State**: `DRAFT` 상태 인보이스 상세 조회 화면.
- **Callout Annotations**:
  1. `[1] Document Status Tag`: '임시저장' 문서 상태 표시.
  2. `[2] Action Buttons`: '수정하기', '제출하기', '삭제' 3대 초안 전용 액션 버튼.
  3. `[3] Line Items Table`: 입력된 청구 품목 명세 및 금액.

---

### 2.5 Asset 5: `SCR-B-FIN-005.png`
- **Title**: Invoice Edit — Draft State
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/[id]/edit`
- **User Role**: Brand Portal User (`finance:write`)
- **Manual Chapter**: Chapter 3.2 임시저장 인보이스 수정 (DRAFT 한정)
- **Visible State**: `DRAFT` 인보이스의 기존 내용 수정 폼.
- **Callout Annotations**:
  1. `[1] Editable Fields`: 기존 수량, 단가, 비고 수정 가능 입력란.
  2. `[2] Save Changes Button`: '임시저장 수정' 실행 버튼.

---

### 2.6 Asset 6: `SCR-B-FIN-006.png`
- **Title**: Invoice Detail — Submitted State
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/[id]`
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 3.3 제출 완료(SUBMITTED) 인보이스 조회 (Read-Only)
- **Visible State**: `SUBMITTED` 제출 완료 인보이스 (읽기 전용).
- **Callout Annotations**:
  1. `[1] Document Status Tag`: '제출됨' 문서 상태 표시.
  2. `[2] Read-Only Layout`: 수정/삭제 버튼이 숨겨진 안전 읽기 전용 레이아웃.

---

### 2.7 Asset 7: `SCR-B-FIN-007.png`
- **Title**: Invoice Detail — Approved & Paid State
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/[id]`
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 4.1 승인 완료(APPROVED) 및 완납(PAID) 수령 확인
- **Visible State**: `APPROVED` 승인 및 `PAID` 대금 완납 상태 상세 화면.
- **Callout Annotations**:
  1. `[1] Approval Badge`: '승인됨' 문서 상태 태그.
  2. `[2] Payment Status Badge`: '지급 완료 (Paid)' 실시간 갱신 태그.
  3. `[3] Payment History`: 본사 송금 일자, 지급 수단 및 마스킹 수령 계좌 (`**** 1234`).

---

### 2.8 Asset 8: `SCR-B-FIN-008.png`
- **Title**: Invoice Detail — Rejected State
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance/[id]`
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 4.2 반려 완료(REJECTED) 인보이스 사유 확인 및 재작성
- **Visible State**: `REJECTED` 반려 인보이스 및 본사 사유 노출 상태.
- **Callout Annotations**:
  1. `[1] Rejection Badge`: '반려됨' 종결 상태 태그.
  2. `[2] Rejection Reason Box`: 본사 담당자가 입력한 명확한 반려 사유 박스 (`rejection_reason`).

---

### 2.9 Asset 9: `SCR-B-FIN-009.png`
- **Title**: Finance Hub — Settlements Tab
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance` (Settlements Tab)
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 5.1 정산 조정 내역 추적 (Settlements Tab)
- **Visible State**: 수량부족, 파손, 단가차액 조정 목록 탭.
- **Callout Annotations**:
  1. `[1] Adjustment Type`: SHORTAGE / DAMAGE / PRICE_DIFFERENCE / OTHER 사유.
  2. `[2] Direction & Amount`: - CREDIT (감액) / + CHARGE (증액) 수량 및 금액.

---

### 2.10 Asset 10: `SCR-B-FIN-010.png`
- **Title**: Finance Hub — Payments Tab
- **Production Route**: `https://portal.kselectnetwork.com/portal/finance` (Payments Tab)
- **User Role**: Brand Portal User (`finance:read`)
- **Manual Chapter**: Chapter 5.2 대금 송금 및 지급 완료 내역 확인 (Payments Tab)
- **Visible State**: 본사 이체 완료 대금 내역 목록 탭.
- **Callout Annotations**:
  1. `[1] Payment Info`: 지급 번호, 관련 인보이스 번호, 이체 일자.
  2. `[2] Remittance Details`: 송금 금액, 지급 방법 (WIRE/ACH), 송금 은행 및 마스킹 계좌.

---

### 2.11 Asset 11: `SCR-B-FIN-011.png` [Admin Reference]
- **Title**: Admin Invoices List
- **Production Route**: `https://admin.kselectnetwork.com/admin/finance/invoices`
- **User Role**: Admin User (Internal Staff Reference)
- **Manual Chapter**: Appendix A.1 관리자 인보이스 전체 목록 조회
- **Visible State**: 어드민 전체 공급사 인보이스 관리 목록.
- **Callout Annotations**:
  1. `[1] Admin Filter Bar`: 공급사별/상태별 필터 바.
  2. `[2] Internal AP Number`: 시스템 자동 생성 AP 번호 및 공급사 송장 번호.

---

### 2.12 Asset 12: `SCR-B-FIN-012.png` [Admin Reference]
- **Title**: Admin Invoice Approval & Rejection
- **Production Route**: `https://admin.kselectnetwork.com/admin/finance/invoices/[id]`
- **User Role**: Admin User (Internal Staff Reference)
- **Manual Chapter**: Appendix A.2 본사 검토 및 승인/반려 처리
- **Visible State**: 어드민 인보이스 검토 및 승인/반려 액션 화면.
- **Callout Annotations**:
  1. `[1] Approval Actions`: '승인 (Approve)', '반려 (Reject)', '무효화 (Void)' 버튼.
  2. `[2] Rejection Reason Modal`: 반려 사유 작성 모달 폼.

---

### 2.13 Asset 13: `SCR-B-FIN-013.png` [Admin Reference]
- **Title**: Admin Payment Execution Form
- **Production Route**: `https://admin.kselectnetwork.com/admin/finance/payments/new`
- **User Role**: Admin User (Internal Staff Reference)
- **Manual Chapter**: Appendix A.3 본사 대금 송금 집행 및 정산 종결
- **Visible State**: 어드민 신규 대금 지급 생성 및 집행 확정 폼.
- **Callout Annotations**:
  1. `[1] Payment Input`: 대상 인보이스, 이체 금액, 지급 수단 선택 폼.
  2. `[2] Execution Action`: '지급 확정 (COMPLETED)' 버튼 및 Bank Reference 첨부.

---
