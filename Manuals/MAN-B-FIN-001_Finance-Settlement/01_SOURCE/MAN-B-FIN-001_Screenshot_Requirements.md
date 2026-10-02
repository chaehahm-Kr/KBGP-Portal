# MAN-B-FIN-001 — Screenshot Requirements
## K SELECT Brand Portal & Admin: Finance & Settlement (스크린샷 촬영 명세서)

---

## 1. Executive Overview

본 문서는 **MAN-B-FIN-001 (Finance & Settlement Guide)** 매뉴얼 제작을 위해 Brand Portal 및 Admin System에서 촬영해야 할 스크린샷 요구사항과 콜아웃 가이드를 명세한다.

---

## 2. Screenshot Capture Inventory

### 2.1 Brand Portal Screen Inventory (`portal.kselectnetwork.com`)

| ID | Title / View Name | Route / Modal | Purpose & Target UI Elements | Recommended File Name | Callout / Annotation Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-FIN-001` | 정산 메인 허브 인보이스 탭 | `/portal/finance` | 정산 상단 지표 카드 3종 (총 인보이스, 총 지급, 미지급 잔액), 3개 탭 전환 버튼, 신규 발행 버튼, 검색/필터 바, 인보이스 테이블 | `FIN_01_Portal_Finance_Hub_Invoices.png` | 1. 상단 요약 카드 3종<br/>2. 탭 전환 버튼 (Invoices/Settlements/Payments)<br/>3. 검색 & 기간/상태 필터 바<br/>4. '+ 새 인보이스 발행' 버튼 |
| `SCR-FIN-002` | 신규 인보이스 발행 - PO 선택 | `/portal/finance/new` | 발행 자격이 부여된 PO 목록 선택 드롭다운, PO 기본 정보(통화, 결제조건, 인도조건) 스냅샷 표시 영역 | `FIN_02_Portal_Invoice_New_PO_Select.png` | 1. 발주서(PO) 선택 드롭다운<br/>2. 자동 연동된 PO 계약 스냅샷 |
| `SCR-FIN-003` | 신규 인보이스 발행 - 품목 및 조정 입력 | `/portal/finance/new` | 품목별 계약 수량 대비 청구 수량/단가 입력란, 정산 조정 항목 (+/-) 추가 폼, 최종 청구 총액 자동 계산 영역 | `FIN_03_Portal_Invoice_New_Form.png` | 1. 품목별 청구수량/단가 입력 폼<br/>2. 정산 조정 (+/-) 추가 항목<br/>3. 최종 청구 금액 자동 산출란<br/>4. PDF 송장 증빙 첨부파일 |
| `SCR-FIN-004` | 인보이스 상세 조회 (DRAFT 상태) | `/portal/finance/[id]` | 초안 상태 인보이스 헤더, 수정/제출/삭제 액션 버튼, 청구 품목 명세, 증빙 다운로드 버튼 | `FIN_04_Portal_Invoice_Detail_Draft.png` | 1. 문서 상태 태그 ('임시저장')<br/>2. '수정하기', '제출하기', '삭제' 액션 버튼<br/>3. 청구 품목 테이블 |
| `SCR-FIN-005` | 인보이스 상세 조회 (SUBMITTED / APPROVED 상태) | `/portal/finance/[id]` | 제출/승인 완료된 읽기 전용 상세 화면, 승인 태그, 정산 조정 내역, 지급 집행 이력 | `FIN_05_Portal_Invoice_Detail_Approved.png` | 1. 문서 상태 태그 ('승인됨')<br/>2. 지급 상태 태그 ('미지급' / '지급 완료')<br/>3. 지급 내역 및 은행 마스킹 계좌 |
| `SCR-FIN-006` | 정산 조정 탭 (Settlements) | `/portal/finance` (탭 2) | 수량 부족, 파손, 단가 차액 등에 의한 정산 감액/증액 조정 항목 종합 목록 | `FIN_06_Portal_Settlements_Tab.png` | 1. 조정 타입 (SHORTAGE/DAMAGE/PRICE_DIFFERENCE)<br/>2. 구분 (- 감액 / + 증액)<br/>3. 발생 수량 및 조정 금액 |
| `SCR-FIN-007` | 지급 내역 탭 (Payments) | `/portal/finance` (탭 3) | 본사 송금 집행 완료 내역 목록 (지급일, 금액, 지급수단, 송금은행, 마스킹 계좌번호) | `FIN_07_Portal_Payments_Tab.png` | 1. 지급 번호 및 인보이스 연동<br/>2. 송금 집행 금액 및 지급 수단<br/>3. 마스킹 처리된 송금 계좌 정보 |

---

### 2.2 Admin System Screen Inventory (`admin.kselectnetwork.com`)

| ID | Title / View Name | Route / Modal | Purpose & Target UI Elements | Recommended File Name | Callout / Annotation Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-FIN-ADM-001` | 관리자 인보이스 목록 | `/admin/finance/invoices` | 어드민 인보이스 검토/관리 메인, 공급사별/상태별 필터링, AP 번호 생성 현황 | `FIN_ADM_01_Admin_Invoices_List.png` | 1. 공급사 및 문서/지급 상태 필터<br/>2. AP 번호 및 공급사 인보이스 번호<br/>3. 검토 상세 진입 버튼 |
| `SCR-FIN-ADM-002` | 관리자 인보이스 검토 및 승인/반려 | `/admin/finance/invoices/[id]` | 인보이스 검토 상세, '승인 (Approve)', '반려 (Reject)', '무효화 (Void)' 액션 버튼, 반려 사유 팝업 | `FIN_ADM_02_Admin_Invoice_Approval.png` | 1. '승인' 및 '반려' 액션 버튼<br/>2. 반려 사유 입력 모달 폼<br/>3. AP 번호 부여 현황 |
| `SCR-FIN-ADM-003` | 대금 지급 등록 및 집행 | `/admin/finance/payments/new` | 신규 대금 지급 생성 (지급 대상 인보이스 선택, 송금액, 지급 수단, 은행 참조번호, 송금증 첨부) | `FIN_ADM_03_Admin_Payment_New.png` | 1. 대상 인보이스 및 미지급 잔액<br/>2. 지급 금액 및 수단(WIRE/ACH/CHECK)<br/>3. Bank Reference & 송금증 첨부 |
| `SCR-FIN-ADM-004` | 대금 지급 확정 및 상태 변경 | `/admin/finance/payments/[id]` | 지급 내역 상세, '지급 확정 (COMPLETED)' 버튼 실행, 잔액 자동 재계산 결과 | `FIN_ADM_04_Admin_Payment_Complete.png` | 1. '지급 확정' 버튼<br/>2. 인보이스 잔액(balance_due) 0원 차감 확인 |

---

## 3. Image Formatting & Capture Rules

1. **해상도 및 비율**:
   - 데스크톱 표준 1920x1080 (16:9) 브라우저 뷰포트 기준 capture.
2. **테스트 데이터 기준**:
   - 마스킹된 더미 데이터 사용, 개인정보(실제 브라우저 쿠키/실제 은행 계좌) 노출 금지.
3. **하이라이트 콜아웃 서식**:
   - 주황색(#F97316) 또는 인디고(#6366F1) 테두리로 번호가 표기된 서클 콜아웃 적용.

---
