# MAN-B-RPT-001: Reports & Performance Guide
## 브랜드 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드

- **문서 ID:** `MAN-B-RPT-001`
- **적용 대상:** K SELECT Brand Portal 사용자 (회사 관리자, 실무 담당자)
- **최종 검증일:** 2026-10-01
- **버전:** 1.0 (Production Verified)

---

## 1. 시스템 개요 및 지표 측정 원칙 (Overview & Measurement Principles)

### 1.1 K SELECT Reports & Performance 모듈의 역할
K SELECT 성과 분석 및 지표 모듈은 브랜드 파트너사가 플랫폼을 통해 진행하는 비즈니스 활동—발주 이행, 대금 정산, 제품 카탈로그 등록, 고객지원 문의 처리—의 현황을 종합 집계하여 한눈에 파악할 수 있도록 돕는 **통합 측정 및 분석 계층(Measurement & Reporting Layer)**입니다.

파트너사는 별도의 복잡한 데이터 취합 없이 포털 메인 대시보드 및 각 기능별 허브를 통해 브랜드의 일일 운영 건전성(Operational Health)을 진단하고, 긴급하게 조치해야 할 업무 병목을 사전에 파악하여 처리할 수 있습니다.

### 1.2 핵심 데이터 거버넌스 원칙
1. **단일 원천 운영 데이터 집계 (Single Authoritative Operational Data)**:
   - 본 매뉴얼에서 다루는 검증된 운영 지표는 발주서(PO), 정산 인보이스, 등록 제품 및 1:1 지원 티켓 등의 최신 운영 데이터를 페이지 조회 시점에 직접 집계·연산하여 제공합니다.
2. **엄격한 테넌트 격리 (Multi-Tenant Isolation)**:
   - 브랜드사는 자사에 배정된 고유 회사 ID(`company_id`)의 데이터만 독립적으로 조회할 수 있으며, 타 파트너사의 거래 내역이나 기밀 정보는 철저히 격리됩니다.
3. **분석 계층과 운영 계층의 분리 (Reporting vs Operational Boundary)**:
   - Reports 모듈은 운영 데이터의 현황을 측정·표시하는 분석 계층이며, 발주 승인이나 인보이스 결제 등의 실제 상태 전이는 각 전용 운영 메뉴(발주 관리, 정산 관리 등)에서 수행됩니다.

---

## 2. 브랜드 포털 메인 대시보드 및 실행 필요 큐 (Operational Dashboard & Action Queue)

브랜드 포털에 로그인하면 가장 먼저 나타나는 메인 화면(`/portal`)은 브랜드의 일일 운영 상태를 4대 영역으로 요약하여 보여줍니다.

![브랜드 포털 메인 운영 대시보드](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-001.png)

### 2.1 4대 도메인 핵심 KPI 카드
메인 대시보드 상단에는 브랜드 운영의 4대 핵심 축을 나타내는 요약 카드가 배치되어 있습니다:

1. **발주 파이프라인 지표 (Orders)**:
   - **진행 중 발주서**: 현재 활성 진행 중인 전체 발주 건수
   - **출고 준비 완료**: 생산을 마치고 출고 서류(패킹리스트) 등록을 대기 중인 건수
   - **입고/검수 진행 중**: 미국 물류센터로 운송 중이거나 현장 입고 검수가 진행 중인 건수
2. **재무 및 정산 지표 (Finance)**:
   - **총 청구 금액**: 누적 발행된 공급사 인보이스 총액
   - **총 정산 완료액**: K SELECT로부터 실제 입금 완료된 누적 정산액
   - **미지급 잔액**: 아직 정산이 완료되지 않은 잔여 청구액
   - **지급 기한 초과**: 계약 지급일을 경과한 연체 잔액 (0원 이상 시 긴급 조치 대상)
3. **카탈로그 완성도 지표 (Products)**:
   - **등록 완료 (Complete)**: 28대 등록 완성도 기준을 충족한 COMPLETE 상태의 SKU 수
   - **보완 필요 (Draft)**: 필수 규격이나 인증 정보가 누락되어 보완이 필요한 SKU 수
4. **고객지원 문의 현황 (Support)**:
   - **미종결 문의**: 현재 처리가 진행 중인 1:1 문의 건수
   - **파트너 회신 대기**: K SELECT 운영팀의 요청에 대해 브랜드사의 추가 답변이 필요한 긴급 건수

![긴급 조치 큐](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-002.png)

### 2.2 실행 필요 큐 (Action Required Queue)
대시보드 상단의 **[실행 필요(Action Required)]** 영역은 업무 병목을 방지하기 위해 최신 운영 데이터를 바탕으로 감지된 긴급 작업 목록을 우선순위별로 표시합니다:

- **🔴 URGENT (빨간색 뱃지)**:
  - 공급사 수락이 필요한 신규 발주서 (`발주서 확인` 버튼 클릭 시 즉시 수락 화면 이동)
  - 지급 기한이 초과된 연체 인보이스
  - 운영팀이 추가 서류나 확인을 요청한 1:1 지원 문의
- **🟠 DUE_SOON (주황색 뱃지)**:
  - 생산이 완료되어 출고 패킹 정보 입력이 필요한 발주서
  - 미결제 잔액이 남아있는 인보이스
- **🔵 NORMAL (회색/파란색 뱃지)**:
  - 필수 스펙이 미비하여 등록 완료되지 않은 Draft 상태의 제품

각 카드의 우측 액션 버튼을 클릭하면 해당 업무를 즉시 처리할 수 있는 상세 화면으로 바로 이동하며, 처리가 완료되면 페이지 재조회 및 캐시 재검증 시 큐에서 자동 제거됩니다.

---

## 3. 발주 성과 및 파이프라인 분석 (PO Pipeline Performance & Filtering)

좌측 메뉴의 **[발주 관리] > [발주서 목록]** (`/portal/orders/purchase-orders`) 메뉴에서는 발주 진행 현황을 공정 단계별로 분석할 수 있습니다.

![발주 파이프라인 성과 요약 카드](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-003.png)

### 3.1 5대 성과 집계 요약 카드 (PO Reporting Aggregation)
발주 관리 상단에는 발주 데이터를 5대 주요 진행 구간으로 그룹화한 성과 요약 카드가 제공됩니다 (이는 ORD의 권위적 6단계 상태 전이 라이프사이클을 파트너사 관점에서 집계한 리포팅 그룹입니다):
- **전체 진행 중 (Total Open)**: 현재 완료 또는 취소되지 않은 활성 발주서 합계
- **생산 중 (In Production)**: 발주서 발송, 수락 및 공장 생산 진행 단계의 건수
- **출고 준비 (Ready to Ship)**: 생산이 완료되어 수출 선적 서류 준비 단계인 건수
- **입고/검수 (Receiving)**: 운송 중이거나 미국 현지 물류창고 입고/검수 단계인 건수
- **완료 (Completed)**: 입고 및 검수가 성공적으로 종료된 누적 건수

![발주 상태 필터 칩 및 테이블 정렬](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-004.png)

### 3.2 다차원 필터링 및 테이블 정렬
- **기간 선택기 (Date Preset)**: 기본값으로 최근 90일(`Last 90 Days`)이 적용되며, 커스텀 시작일/종료일 지정이 가능합니다.
- **상태 카테고리 칩 (Filter Chips)**: `생산 중`, `출고 준비`, `선적 운송`, `입고 검수`, `완료`, `취소` 칩을 클릭하여 원하는 상태의 발주서만 필터링합니다.
- **다양한 정렬 옵션**: 최신 등록순, 과거순, 발주 금액 높은순, 금액 낮은순 정렬을 지원하여 대형 발주 건을 우선적으로 모니터링할 수 있습니다.

---

## 4. 재무 정산 및 자금 흐름 모니터링 (Finance & Cash Flow Tracking)

좌측 메뉴의 **[정산 및 재무]** (`/portal/finance`) 메뉴에서는 브랜드사의 매출 채권과 정산 지급 실적을 종합 관리합니다.

![정산 및 인보이스 실적 요약](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-005.png)

### 4.1 정산 요약 지표
- **총 청구액 (Total Invoiced)**: 발행된 인보이스 총 청구 금액 합계
- **지급 완료액 (Total Paid)**: 인보이스 정산 완료 처리된 누적 지급액
- **미지급 잔액 (Balance Due)**: 지급 처리 대기 중인 잔여 인보이스 잔액
- **지급 기한(Due Date) 초과 건수**: 계약된 여신 지급 기한을 넘긴 인보이스 건수

각 인보이스 상세 페이지로 이동하면 발주서(PO) 번호 매칭 여부, 품목별 단가/수량 및 물류 손실·차액 공제 내역(Adjustments)을 투명하게 대조할 수 있습니다.

---

## 5. 제품 카탈로그 완성도 감사 (Product Catalog Completeness Audit)

좌측 메뉴의 **[상품 관리]** (`/portal/products`) 메뉴에서는 브랜드사의 전체 상품 SKU에 대한 필수 규격 및 등록 완성도 상태를 진단합니다.

![제품 등록 완성도 지표 및 보완 알림](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-006.png)

### 5.1 완성도 판정 체계
K SELECT의 제품 등록 평가 엔진은 다음 28대 기준을 자동 검증합니다:
- **🟢 COMPLETE (등록 완료)**: 기본 식별 정보, 수출 공급가(USD FOB), 단품/포장/카톤 규격(mm/g), 유효한 12~13자리 표준 바코드(UPC/EAN) 및 고해상도 대표 이미지가 모두 입력된 상태.
- **🟠 Draft (보완 대기)**: 필수 물류 규격이나 바코드 규격 등이 누락된 상태.

목록 상단의 보완 알림 배너를 통해 누락된 항목을 즉시 확인하고, 수정 페이지에서 해당 스펙을 입력하여 `COMPLETE` 등급으로 승격시킬 수 있습니다.

---

## 6. 고객지원 성과 및 어드민 연계 (Support & Admin Sync)

### 6.1 1:1 고객지원 처리 현황 모니터링
**[도움말 및 지원]** (`/portal/support`) 메뉴에서는 브랜드 운영 중 접수된 1:1 문의 티켓의 처리 속도와 현황을 추적합니다.

![1:1 고객지원 문의 처리 현황](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-007.png)

- **전체 / 답변 대기 / 처리 중 / 완료** 탭 필터를 통해 운영팀의 회신 여부와 처리 진행 상태를 점검합니다.
- 운영팀의 추가 자료 요청이 있을 경우 대시보드의 `URGENT` 큐에 반영되어 신속한 확인을 돕습니다.

### 6.2 어드민 발주 대시보드 동기화 (Admin Purchasing Dashboard)
브랜드 포털의 발주, 출고 및 인보이스 운영 데이터는 데이터베이스를 통해 K SELECT 운영팀의 어드민 콘솔(`/admin/purchasing/dashboard`)과 동기화되어 집계됩니다.

![어드민 전사 발주 대시보드](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-RPT-001_Reports-Performance/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-RPT-008.png)

- 운영팀은 전사 발주 총액, 미입고 수량, 공급사별 실적(Supplier Summary) 및 SKU별 미입고 잔량(Product Summary)을 종합 모니터링하여 파트너사의 원활한 발주 이행을 지원합니다.

> [!NOTE]
> **시스템 기능 범위 안내 (System Boundary Notice)**:
> - 현재 K SELECT 포털은 대시보드 및 각 전용 모듈에서 운영 지표 분석을 제공하며, 별도의 독립 메뉴(`/portal/reports`)는 제공되지 않습니다.
> - 개별 발주서 PDF 및 인보이스 명세서는 각 상세 페이지에서 다운로드할 수 있으며, 일괄 대량 보고서 생성 기능 및 AI 성과 예측 기능은 지원되지 않습니다.
> - 어드민 리포트 다운로드 센터(`/admin/reports`)는 현재 준비 중인 플레이스홀더 화면입니다.

---
*End of MAN-B-RPT-001_Manual_Content.md*
