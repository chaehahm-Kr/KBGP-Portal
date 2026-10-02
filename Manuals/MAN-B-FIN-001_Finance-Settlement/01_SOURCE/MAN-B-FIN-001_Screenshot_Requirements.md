# MAN-B-FIN-001 — Screenshot Requirements
## K SELECT Brand Portal & Admin: Finance & Settlement (스크린샷 촬영 명세서)

---

## 1. Executive Overview

본 문서는 **MAN-B-FIN-001 (Finance & Settlement Guide)** 매뉴얼 제작 시 포함되어야 할 브랜드 포털(주 대상) 및 어드민 포털(참조 대상) 스크린샷 요구사항 목록이다. 각 스크린샷은 프로덕션 실제 UI, 정확한 URL, 사용자 권한, 필수 가시 상태, 필요 요소/액션, 매뉴얼 챕터 및 촬영 우선순위(Priority)를 정의한다.

---

## 2. Screenshot Capture Inventory

### 2.1 Brand Portal Screens (`portal.kselectnetwork.com`) — Primary Audience Scope

| ID | Title / View Name | Production URL | User Role | Required Visible State | Required Fields / Actions | Manual Chapter | Priority | Recommended File Name |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-FIN-001` | Finance Hub — Invoices Tab | `/portal/finance` | Brand Portal User (`finance:read`) | 3개 지표 카드가 계산된 목록 상태, Invoices 탭 활성화 | - 요약 지표 카드가 (총 인보이스, 총 지급, 미지급 잔액)<br/>- 탭 3종 (Invoices/Settlements/Payments)<br/>- 키워드/기간/상태 필터 바<br/>- '+ 새 인보이스 발행' 버튼 | Ch 1. 정산 관리 개요 및 허브 Navigation | **P0** | `FIN_01_Portal_Finance_Hub_Invoices.png` |
| `SCR-FIN-002` | New Invoice — PO Selection | `/portal/finance/new` | Brand Portal User (`finance:write`) | 자격 있는 PO 선택 드롭다운 펼침 상태 (`CONFIRMED` & `APPROVED/SENT`) | - PO 선택 드롭다운 (`po_number`, `order_date`)<br/>- 자동 로드된 PO 계약 스냅샷 (Payment Terms, Incoterms) | Ch 2.1 발주서 선택 및 청구 기본정보 수립 | **P0** | `FIN_02_Portal_Invoice_New_PO_Select.png` |
| `SCR-FIN-003` | New Invoice — Line & Adjustment Entry | `/portal/finance/new` | Brand Portal User (`finance:write`) | 품목 수량/단가 입력 및 정산 조정 (+/-) 추가 작성 상태 | - 품목 청구 수량/단가/소계 폼<br/>- 정산 조정 (+/-) 추가 항목 폼<br/>- 최종 청구 총액 (`invoice_total`) 자동 계산 영역<br/>- PDF 파일 첨부 영역 (`attachment_path`) | Ch 2.2 품목 청구액, 조정항목 및 증빙 첨부 | **P0** | `FIN_03_Portal_Invoice_New_Form.png` |
| `SCR-FIN-004` | Invoice Detail — Draft State | `/portal/finance/[id]` | Brand Portal User (`finance:write`) | `DRAFT` 상태 인보이스 상세 조회 화면 | - '임시저장' 문서 상태 태그<br/>- '수정하기', '제출하기', '삭제' 액션 버튼<br/>- 청구 품목 명세 및 첨부 증빙 다운로드 | Ch 3.1 인보이스 임시저장, 수정 및 제출 | **P0** | `FIN_04_Portal_Invoice_Detail_Draft.png` |
| `SCR-FIN-005` | Invoice Edit — Draft State | `/portal/finance/[id]/edit` | Brand Portal User (`finance:write`) | `DRAFT` 인보이스의 기존 내용 수정 폼 화면 | - 기존 입력값 폼 로딩 상태<br/>- 수량/단가/조정 항목 수정 가능 폼<br/>- '임시저장 수정' 및 '취소' 버튼 | Ch 3.2 인보이스 초안 수정 (`DRAFT` 한정) | **P1** | `FIN_05_Portal_Invoice_Edit_Draft.png` |
| `SCR-FIN-006` | Invoice Detail — Submitted State | `/portal/finance/[id]` | Brand Portal User (`finance:read`) | `SUBMITTED` 상태 인보이스 상세 조회 (읽기 전용) | - '제출됨' 문서 상태 태그<br/>- 수정/삭제 버튼 숨김 (Read-Only)<br/>- 제출 일시 및 상세 청구 명세 | Ch 3.3 제출 완료 인보이스 조회 및 대기 | **P1** | `FIN_06_Portal_Invoice_Detail_Submitted.png` |
| `SCR-FIN-007` | Invoice Detail — Approved & Paid State | `/portal/finance/[id]` | Brand Portal User (`finance:read`) | `APPROVED` 문서 상태 및 `PAID` 지급 상태 상세 화면 | - '승인됨' 문서 상태 태그<br/>- '지급 완료 (Paid)' 지급 상태 태그<br/>- 집행 완료된 대금 송금 이력 및 마스킹 계좌 | Ch 4.1 승인 완료 인보이스 및 대금 수령 확인 | **P0** | `FIN_07_Portal_Invoice_Detail_Approved_Paid.png` |
| `SCR-FIN-008` | Invoice Detail — Rejected State | `/portal/finance/[id]` | Brand Portal User (`finance:read`) | `REJECTED` 상태 및 반려 사유 노출 화면 | - '반려됨' 문서 상태 태그<br/>- 본사 담당자가 입력한 반려 사유 박스 (`rejection_reason`)<br/>- 안내 메시지 (새 인보이스 작성 가능) | Ch 4.2 인보이스 반려 사유 확인 및 조치 | **P1** | `FIN_08_Portal_Invoice_Detail_Rejected.png` |
| `SCR-FIN-009` | Finance Hub — Settlements Tab | `/portal/finance` (탭 2) | Brand Portal User (`finance:read`) | Settlements (Adjustments) 탭 활성화 목록 화면 | - 수량부족/파손/단가차액 조정 목록<br/>- 조정 타입 (SHORTAGE/DAMAGE/PRICE_DIFFERENCE)<br/>- 구분 (- 감액 / + 증액) 및 발생 금액 | Ch 5.1 정산 조정 내역 추적 (Settlements) | **P1** | `FIN_09_Portal_Settlements_Tab.png` |
| `SCR-FIN-010` | Finance Hub — Payments Tab | `/portal/finance` (탭 3) | Brand Portal User (`finance:read`) | Payments 탭 활성화 목록 화면 | - 대금 지급 집행 내역 목록<br/>- 지급 번호, 지급일, 송금액, 지급수단 (WIRE/ACH)<br/>- 송금 은행 및 마스킹 계좌번호 (`**** 1234`) | Ch 5.2 대금 송금 및 지급 완료 내역 확인 | **P0** | `FIN_10_Portal_Payments_Tab.png` |

---

### 2.2 Admin System Screens (`admin.kselectnetwork.com`) — Reference Scope Only

| ID | Title / View Name | Production URL | User Role | Required Visible State | Required Fields / Actions | Manual Chapter | Priority | Recommended File Name |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-FIN-ADM-001` | Admin Invoices List | `/admin/finance/invoices` | Admin Manager | 전체 공급사 인보이스 검토 목록 | - 공급사별/상태별 필터 바<br/>- AP 번호 및 공급사 인보이스 번호<br/>- 문서 상태 태그 및 검토 상세 진입 링크 | Appendix A.1 [참조] 본사 인보이스 검토 절차 | **P2** | `FIN_ADM_01_Admin_Invoices_List.png` |
| `SCR-FIN-ADM-002` | Admin Invoice Approval & Rejection | `/admin/finance/invoices/[id]` | Admin Manager | 인보이스 검토 및 승인/반려 액션 화면 | - '승인 (Approve)', '반려 (Reject)', '무효화 (Void)' 버튼<br/>- 반려 사유 작성 모달 폼 | Appendix A.2 [참조] 본사 승인/반려 처리 | **P2** | `FIN_ADM_02_Admin_Invoice_Approval.png` |
| `SCR-FIN-ADM-003` | Admin Payment Execution | `/admin/finance/payments/new` | Admin Manager | 대금 지급 등록 및 지급 확정 (`COMPLETED`) | - 지급 대상 인보이스 및 미지급 잔액<br/>- 지급 금액 및 지급 수단 (WIRE/ACH/CHECK)<br/>- Bank Reference & '지급 확정' 액션 | Appendix A.3 [참조] 본사 대금 송금 집행 | **P2** | `FIN_ADM_04_Admin_Payment_Complete.png` |

---

## 3. Formatting & Annotation Guidelines

1. **뷰포트 및 그래픽 사양**:
   - 브라우저 표준 1920x1080 뷰포트 (16:9) 레티나/HD 캡처.
2. **개인정보 및 보안 민감정보 보호**:
   - 실 계좌번호, 실제 서명 URL 및 테넌트 토큰 노출 차단 (마스킹 처리 확인).
3. **주석 콜아웃 (Callouts)**:
   - 각 스크린샷 내 주요 제어 영역에 주황색(#F97316) 또는 인디고(#6366F1) 번호 서클을 표기하여 매뉴얼 본문의 단계별 설명과 1:1 바인딩함.

---
