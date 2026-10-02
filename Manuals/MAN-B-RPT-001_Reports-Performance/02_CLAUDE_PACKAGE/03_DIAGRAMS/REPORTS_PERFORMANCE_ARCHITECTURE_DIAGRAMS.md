# REPORTS & PERFORMANCE ARCHITECTURE DIAGRAMS: MAN-B-RPT-001
## 5 Authoritative Production Architecture & Data Flow Diagrams

- **Manual ID:** `MAN-B-RPT-001`
- **Topic:** `Reports & Performance (성과 분석, 대시보드 KPI 및 운영 지표)`
- **Audience:** `B — Brand Portal Users & Technical Operators`
- **Authoritative Date:** 2026-10-01

---

## 1. Diagram 1: Operational Source vs Reporting Layer Architecture

```mermaid
flowchart TD
    subgraph Operational Domains [Authoritative Operational Domain Layer]
        PROD["MAN-B-PROD-001 Product Domain<br>(28-Spec Completeness, Barcode Regex, Images)"]
        ORD["MAN-B-ORD-001 Order Domain<br>(6-Step PO Lifecycle, Confirmed Qty, Line Cost)"]
        LOG["MAN-B-LOG-001 Logistics Domain<br>(Inbound Shipments, Packing, Warehouse Receivings)"]
        FIN["MAN-B-FIN-001 Finance Domain<br>(Supplier Invoices, Amount Paid, Due Dates)"]
        SUP["Support Domain<br>(1:1 Inquiries, Action Required Status)"]
    end

    subgraph Reporting Layer [MAN-B-RPT-001 Measurement & Reporting Layer]
        RPT_DASH["Brand Portal Dashboard (/portal)<br>• 4-Domain KPI Summary Cards<br>• Action Required Queue Engine"]
        RPT_ORD["PO Performance Hub (/portal/orders/purchase-orders)<br>• 5-Stage Lifecycle Summary<br>• 90-Day Range & Status Chips"]
        RPT_FIN["Finance Performance Hub (/portal/finance)<br>• Total Invoiced / Paid / Balance Due<br>• Overdue Invoice Tracking"]
        RPT_PROD["Product Completeness Hub (/portal/products)<br>• COMPLETE vs Draft Status"]
        RPT_ADM["Admin Order Dashboard (/admin/purchasing/dashboard)<br>• Cross-Supplier & SKU Summaries"]
    end

    PROD -->|28-Criteria Evaluation| RPT_DASH
    PROD -->|Status Badges| RPT_PROD
    ORD -->|Lifecycle Counts & Line Totals| RPT_DASH
    ORD -->|Filtered POs & Summaries| RPT_ORD
    LOG -->|Ready to Ship & In Receiving| RPT_DASH
    LOG -->|Receiving Progress| RPT_ORD
    FIN -->|Invoiced, Paid & Overdue Totals| RPT_DASH
    FIN -->|Payment Schedules| RPT_FIN
    SUP -->|Open & Awaiting Brand Cases| RPT_DASH
    ORD & FIN -->|Supplier Level Metrics| RPT_ADM
```

---

## 2. Diagram 2: Daily Health Check & Action Required Priority Engine

```mermaid
flowchart TD
    START([포털 로그인 /portal]) --> LOAD_DATA[세션 company_id 기준 최신 운영 데이터 로드]
    LOAD_DATA --> SCAN_KPIS[4대 영역 대시보드 KPI 카드 스캔]
    
    SCAN_KPIS --> EVAL_ACTION{긴급 조치 항목 존재 여부}
    
    EVAL_ACTION -- YES --> PRIORITY_ENGINE[우선순위 분류 엔진]
    EVAL_ACTION -- NO --> STABLE_MONITORING[정상 운영 모니터링 상태 유지]
    
    PRIORITY_ENGINE --> URGENT_BOX["🔴 URGENT (빨강)<br>• 미확정 발주서 (PO Confirmation Pending)<br>• 지급 기한 초과 인보이스 (Overdue Balance)<br>• 운영팀 추가 답변 요청 문의 (Action Required)"]
    PRIORITY_ENGINE --> DUE_SOON_BOX["🟠 DUE_SOON (주황)<br>• 생산 완료 후 출고 준비 발주서 (Ready to Ship)<br>• 미결제 인보이스 잔액 존재 (Balance Due > 0)"]
    PRIORITY_ENGINE --> NORMAL_BOX["🔵 NORMAL (파랑)<br>• 필수 스펙 누락 제품 (Draft Status)"]
    
    URGENT_BOX --> ONE_CLICK_ACT[원클릭 액션 버튼 클릭 → 상세 페이지 이동]
    DUE_SOON_BOX --> ONE_CLICK_ACT
    NORMAL_BOX --> ONE_CLICK_ACT
    
    ONE_CLICK_ACT --> TASK_RESOLVE[업무 처리 완료]
    TASK_RESOLVE --> CACHE_REVALIDATE[revalidatePath 실행 → 대시보드 큐에서 자동 제거]
    CACHE_REVALIDATE --> COMPLETE([일일 건강성 진단 완료])
    STABLE_MONITORING --> COMPLETE
```

---

## 3. Diagram 3: 5-Stage PO Pipeline Aggregation & Filter Flow
*(RPT 5-Stage Reporting Aggregation ≠ ORD 6-Step Lifecycle Transition Model)*

```mermaid
flowchart TD
    PO_ENTRY([발주 관리 메뉴 진입 /portal/orders/purchase-orders]) --> DATE_FILTER{기간 필터 적용}
    
    DATE_FILTER -->|Default| D90[최근 90일 (Last 90 Days)]
    DATE_FILTER -->|Custom| DCUST[사용자 지정 시작일 ~ 종료일]
    
    D90 --> STAGE_AGG[5대 파이프라인 단계별 집계 연산]
    DCUST --> STAGE_AGG
    
    STAGE_AGG --> S1["1. 전체 진행 중 (Total Open)<br>overall_status NOT IN ('Completed', 'Cancelled')"]
    STAGE_AGG --> S2["2. 생산 중 (In Production)<br>Sent to Supplier / Supplier Confirmed / In Production"]
    STAGE_AGG --> S3["3. 출고 준비 (Ready to Ship)<br>Ready to Ship (패킹 등록 대기)"]
    STAGE_AGG --> S4["4. 입고/검수 (Receiving)<br>Shipped / Arrived / Receiving"]
    STAGE_AGG --> S5["5. 완료 (Completed)<br>Completed (검수 완료 및 정산 연계)"]
    
    S1 & S2 & S3 & S4 & S5 --> CHIP_FILTER{상태 카테고리 칩 선택}
    CHIP_FILTER --> RENDER_TABLE[필터링된 발주 목록 테이블 렌더링]
    RENDER_TABLE --> SORT_ENGINE[정렬: 최신순 / 과거순 / 금액 높은순 / 금액 낮은순]
    SORT_ENGINE --> PO_DETAIL_VIEW([발주 상세 및 무역 서류 다운로드])
```

---

## 4. Diagram 4: 28-Criteria Product Completeness Audit Flow

```mermaid
flowchart TD
    PROD_LOAD[상품 목록 /portal/products 또는 대시보드] --> EVAL_ENGINE[등록 평가기 evaluateProductRegistrationStatus]
    
    EVAL_ENGINE --> C_BASIC["1. 기본 정보 (6항목)<br>name, name_en, brand_id, category_code, sku, origin"]
    EVAL_ENGINE --> C_PRICE["2. 가격 정보 (2항목)<br>price_krw_retail > 0, price_usd_fob > 0"]
    EVAL_ENGINE --> C_UNIT["3. 단품 규격 (4항목)<br>item_width, depth, height, weight > 0"]
    EVAL_ENGINE --> C_PKG["4. 개별 포장 규격 (4항목)<br>package_width, depth, height, weight > 0"]
    EVAL_ENGINE --> C_CTN["5. 카톤 박스 규격 (4항목)<br>carton_pack_qty >= 1, width, depth, height, weight > 0"]
    EVAL_ENGINE --> C_BAR["6. 식별 바코드 (1항목)<br>12자리 UPC 또는 13자리 EAN 정규식"]
    EVAL_ENGINE --> C_IMG["7. 대표 이미지 (1항목)<br>대표 상품 이미지 >= 1장"]
    
    C_BASIC & C_PRICE & C_UNIT & C_PKG & C_CTN & C_BAR & C_IMG --> CRITERIA_CHECK{28대 기준 전체 충족?}
    
    CRITERIA_CHECK -- YES --> STATUS_COMPLETE["🟢 COMPLETE (등록 완료)<br>28대 등록 완성도 기준 충족"]
    CRITERIA_CHECK -- NO --> STATUS_DRAFT["🟠 Draft (보완 대기)<br>누락 필드 알림 배너 생성 및 Action Required 연계"]
    
    STATUS_DRAFT --> EDIT_PAGE[제품 수정 페이지 진입]
    EDIT_PAGE --> FILL_SPEC[누락 규격/바코드 보완 입력]
    FILL_SPEC --> RE_EVAL[재평가 후 COMPLETE 승격]
```

---

## 5. Diagram 5: Brand Portal to Admin Backoffice Data Synchronization Flow

```mermaid
sequenceDiagram
    autonumber
    actor Brand as 브랜드사 파트너 (Brand User)
    participant Portal as 파트너 포털 (Brand Portal)
    participant Supabase as Supabase Production DB
    participant Admin as 어드민 백오피스 (Admin Portal)
    actor AdminStaff as K SELECT 운영팀 (Admin Staff)

    Brand->>Portal: 발주 수락 / 출고 서류 등록 / 인보이스 발행
    Portal->>Supabase: 트랜잭션 기록 및 RLS 검증
    Supabase-->>Portal: DB 커밋 완료 & revalidatePath()
    Portal-->>Brand: 대시보드 KPI 카드 및 Action Required 큐 갱신

    AdminStaff->>Admin: 어드민 발주 현황 대시보드 진입 (/admin/purchasing/dashboard)
    Admin->>Supabase: getPurchasingDashboardData(filters)
    Supabase-->>Admin: 공급사별 발주액, 미입고 잔량, 지급/미지급 실적 집계
    Admin-->>AdminStaff: 전사 공급사 성과 매트릭스 및 SKU별 주문/미입고 실적 표시
```

---
*End of REPORTS_PERFORMANCE_ARCHITECTURE_DIAGRAMS.md*
