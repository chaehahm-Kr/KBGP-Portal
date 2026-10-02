# MAN-B-ORD-001: Order Architecture & Workflow Diagrams

---

## 1. Dual-Track Purchase Order Architecture

K SELECT 플랫폼의 모든 발주는 단일한 **공식 발주서 (Official Purchase Order)** 체계로 수렴되며, 생성 경로는 2가지 트랙으로 운영됩니다.

```mermaid
flowchart TD
    subgraph NonPOFlow["독립 워크플로우 (Non-PO Flow)"]
        RA["입점 신청 (Retail Application)"] -->|승인 및 초대| PA["파트너사 등록 완료 (Partner Active)"]
        PA -.->|※ 발주서 자동 발행 없음| NO_AUTO["독립적인 오더 진행 필요"]
    end

    subgraph TrackA["Track A: 공급사 발주 요청 (Brand PO Request)"]
        R1["공급사 발주 요청 작성 (Draft)"] -->|제출| R2["본사 심사 (Submitted / Under Review)"]
        R2 -->|승인 및 PO 변환| PO_CONVERT["공식 발주서 자동 생성 (Converted to PO)"]
        R2 -->|보완 지시| R3["수정 요청 (Change Requested)"]
        R3 -->|수정 후 재제출| R2
    end

    subgraph TrackB["Track B: 본사 직접 발주 (Admin Direct PO)"]
        A1["본사 MD 직접 발주서 작성"] -->|발주 승인 및 발송| PO_DIRECT["공식 발주서 발행 (PO Sent)"]
    end

    PO_CONVERT --> OFFICIAL_PO["공식 발주서 (Official Purchase Order)"]
    PO_DIRECT --> OFFICIAL_PO

    subgraph FulfillmentFlow["공식 발주서 이행 프로세스"]
        OFFICIAL_PO --> STEP1["Step 1: 발주 검토 및 수락 (Supplier Confirmed)"]
        STEP1 --> STEP2["Step 2: 출고 준비 등록 (Goods Ready)"]
        STEP2 --> STEP3["Step 3: 선적 및 화물 인계 (Shipped / In Transit)"]
        STEP3 --> STEP4["Step 4: 미국 물류센터 입고 검수 (Received / Inspected)"]
        STEP4 --> STEP5["Step 5: 오더 이행 완료 (Completed)"]
    end
```

> **[핵심 경계 원칙]**
> - **Retail Application Approval ≠ Automatic Purchase Order Creation**: 입점 신청 승인은 브랜드와 상품의 판매 적격성을 승인하는 절차이며, 발주서(PO)를 자동으로 발행하지 않습니다.
> - **Official Purchase Order Single Source**: 발주 요청(Track A)이 승인되거나 본사가 직접 발주(Track B)할 때 생성되는 발주서는 완전히 동일한 `purchase_orders` 엔티티로 관리됩니다.

---

## 2. PO Request Lifecycle State Machine (발주 요청 상태 전이도)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: 신규 발주 요청 작성
    DRAFT --> SUBMITTED: 발주 요청 제출 (Submit)
    DRAFT --> CANCELLED: 공급사 자체 취소
    
    SUBMITTED --> UNDER_REVIEW: 본사 MD 배정 및 검토 착수
    SUBMITTED --> CANCELLED: 공급사 취소 (심사 전)
    
    UNDER_REVIEW --> CHANGE_REQUESTED: 조건 수정/보완 요청
    CHANGE_REQUESTED --> SUBMITTED: 내용 수정 후 재제출
    
    UNDER_REVIEW --> CONVERTED_TO_PO: 승인 및 공식 발주서 생성
    UNDER_REVIEW --> REJECTED: 요청 최종 반려
    
    CONVERTED_TO_PO --> [*]: 공식 발주서(PO)로 연계 진행
    REJECTED --> [*]
    CANCELLED --> [*]
```

---

## 3. Official Purchase Order 6-Step Integrated Lifecycle

공식 발주서(`purchase_orders`)는 생성부터 정산/완료까지 6단계 라이프사이클로 추적됩니다.

```mermaid
graph LR
    S1["1. PO Sent<br/>(발주서 발송)"] --> S2["2. Supplier Confirmed<br/>(공급사 수락)"]
    S2 --> S3["3. Goods Ready<br/>(출고 준비 완료)"]
    S3 --> S4["4. In Transit<br/>(선적/운송 중)"]
    S4 --> S5["5. Delivered<br/>(물류센터 입고)"]
    S5 --> S6["6. Completed<br/>(검수 및 정산 완료)"]

    classDef active fill:#059669,stroke:#047857,color:#fff;
    classDef transit fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef pending fill:#f59e0b,stroke:#d97706,color:#fff;
```

---

## 4. Logistics Responsibility Split (선적 책임별 물류 처리 분기)

발주서에 지정된 `shipping_responsibility`에 따라 공급사의 출고 처리 방식이 달라집니다.

```mermaid
flowchart TD
    GR["공급사 출고 준비 등록 (Goods Ready)<br/>실측 CBM, 중량, 카톤수, P/L, C/I 업로드"] --> CHECK_RESP{"선적 책임 구분<br/>(shipping_responsibility)"}

    CHECK_RESP -->|LETUSTO_ARRANGED<br/>(본사/포워더 지정 운송)| LETUSTO_FLOW["1. 본사 지정 포워더 픽업 예약<br/>2. 포워더 화물 인계 보고 (Submit Handover)<br/>3. 본사 물류팀 B/L 및 운송 추적 관리"]
    
    CHECK_RESP -->|SUPPLIER_ARRANGED<br/>(공급사 자체 운송)| SUPPLIER_FLOW["1. 공급사 운송사 직접 섭외<br/>2. 선적 정보 입력 (선사, B/L, 추적번호, ETD/ETA)<br/>3. 선적 완료 보고 및 서류 등록"]

    LETUSTO_FLOW --> INBOUND["미국 물류센터 입고 검수 진행"]
    SUPPLIER_FLOW --> INBOUND
```

---

## 5. Finance Handoff Sequence Diagram (정산 연계 흐름)

```mermaid
sequenceDiagram
    autonumber
    actor Brand as 공급사 (Brand)
    participant Portal as Brand Portal
    participant System as K SELECT System
    participant Admin as 본사 물류/정산팀

    Admin->>Portal: 공식 발주서 발송 (PO Sent)
    Brand->>Portal: 발주 내용 검토 및 수락 (Confirm PO)
    Portal->>System: supplier_confirmation_status = 'CONFIRMED'
    Note over Portal, System: [Finance Handoff Trigger]<br/>이 시점부터 Supplier Invoice 생성 대상(Eligible)으로 등록됨
    
    Brand->>Portal: Goods Ready 등록 및 출고/선적 보고
    System->>Admin: 선적 및 운송 상태 동기화
    Admin->>System: 미국 창고 입고 검수 결과 등록 (Accepted, Damaged)
    
    Note over Brand, Portal: 정산 및 대금 지급은 MAN-B-FIN-001 (Finance Guide)에서 진행
    Brand->>Portal: 확정된 발주서 기준 Supplier Invoice 생성 및 제출
```
