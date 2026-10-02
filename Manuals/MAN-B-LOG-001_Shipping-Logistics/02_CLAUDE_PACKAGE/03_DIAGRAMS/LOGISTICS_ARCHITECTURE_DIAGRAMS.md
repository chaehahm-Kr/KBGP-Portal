# LOGISTICS ARCHITECTURE DIAGRAMS: MAN-B-LOG-001
## K SELECT Brand Portal Shipping & Logistics Manual

본 문서는 `MAN-B-LOG-001` 공식 매뉴얼에 수록될 **7개의 공식 아키텍처 및 워크플로우 다이어그램 명세서**입니다.
모든 다이어그램은 프로덕션 시스템 검증을 마쳤으며, Claude Design에서 현대적인 고대비 카드형 다이어그램으로 렌더링하도록 작성되었습니다.

---

## Diagram 1. End-to-End International Logistics Process (전체 국제 물류 라이프사이클)

```mermaid
flowchart TD
    subgraph ORD["[MAN-B-ORD-001] 발주 및 계약 도메인"]
        A[정식 발주서 PO 수신] --> B{공급사 수락 검토}
        B -->|수락 확정| C["공식 발주 확정<br/>(po_status: APPROVED/SENT<br/>supplier_confirmation: CONFIRMED)"]
    end

    subgraph LOG_READY["[MAN-B-LOG-001] 출고 준비 등록"]
        C --> D[상품 생산 & 패킹 완료]
        D --> E[Brand Portal: 새 출고 준비 등록]
        E --> F[준비 수량 Ready Qty 입력]
        F --> G[박스수 Cartons / 중량 Weight / CBM 실측 입력]
        G --> H[P/L 및 C/I 서류 첨부]
        H --> I{저장 모드 선택}
        I -->|임시저장| J[상태: DRAFT]
        J -->|추후 수정| E
        I -->|제출| K[상태: READY_SUBMITTED<br/>PO fulfillment_status: READY_TO_SHIP]
    end

    subgraph LOG_BRANCH["[MAN-B-LOG-001] 운송 책임별 선적 분기"]
        K --> L{운송 책임 확인<br/>shipping_responsibility}
        
        %% Track 1: Letusto Arranged
        L -->|LETUSTO_ARRANGED| M1[Letusto 지정 포워더 배정]
        M1 --> M2[공장/창고 화물 픽업 Pickup]
        M2 --> M3[브랜드사: 물품 인계 완료 Handed Over 클릭]
        M3 --> M4[Letusto: Inbound Shipment 생성 및 해상/항공 선적]
        
        %% Track 2: Supplier Arranged
        L -->|SUPPLIER_ARRANGED| N1[브랜드사 자체 계약 운송사 출고]
        N1 --> N2[물류 액션 패널: Carrier / Tracking / BL 입력]
        N2 --> N3[브랜드사: 배송 출발 및 선적 등록 클릭]
        N3 --> N4[Inbound Shipment 자동 생성 및 IN_TRANSIT 전환]
    end

    subgraph LOG_TRACK["[MAN-B-LOG-001] 선적 운송 및 미국 도착"]
        M4 --> O[국제 운송 중 IN_TRANSIT / ETD·ETA 추적]
        N4 --> O
        O --> P[미국 세관 통관 & 현지 내륙 운송]
        P --> Q[미국 물류센터 도착 ARRIVED / DELIVERED]
    end

    subgraph WHS_RCV["[창고 도메인] 입고 검수 인계 (Receiving Handoff)"]
        Q --> R[화물 실물 인계 및 입고 검수 개시]
        R --> S{실물 바코드 스캔 검수}
        S -->|정상 입고| T1[received_qty 확정]
        S -->|파손 / 보류| T2[damaged_qty / hold_qty 격리]
        T1 & T2 --> T3[입고 전표 종결 및 PO 실적 갱신]
    end

    subgraph FIN_REF["[MAN-B-FIN-001] 재무 & 정산 (병렬 도메인)"]
        C -.->|계약 조건에 따른 청구| F1[인보이스 발행 및 정산 프로세스]
    end

    style ORD fill:#f8fafc,stroke:#94a3b8
    style LOG_READY fill:#eff6ff,stroke:#3b82f6
    style LOG_BRANCH fill:#f5f3ff,stroke:#8b5cf6
    style LOG_TRACK fill:#f0fdf4,stroke:#22c55e
    style WHS_RCV fill:#fffbeb,stroke:#f59e0b
    style FIN_REF fill:#fdf2f8,stroke:#ec4899,stroke-dasharray: 5 5
```

---

## Diagram 2. Track 1: `LETUSTO_ARRANGED` (본사 지정 운송 / FOB) Detailed Flow

```mermaid
sequenceDiagram
    autonumber
    actor Brand as 브랜드사 (Brand Portal)
    participant Portal as Portal Server / DB
    actor Letusto as Letusto 물류팀 (Admin)
    actor Forwarder as Letusto 지정 포워더

    Note over Brand, Letusto: 전제 조건: po_status IN ('APPROVED', 'SENT') & supplier_confirmation_status = 'CONFIRMED'
    Brand->>Portal: 출고 준비 등록 (Ready Qty, Cartons, Weight, CBM, P/L, C/I)
    Portal->>Portal: goods_readiness 레코드 생성 (상태: READY_SUBMITTED)
    Portal->>Portal: PO fulfillment_status -> READY_TO_SHIP 갱신
    Letusto->>Portal: 출고 준비 내역 확인 및 포워더 픽업 예약 (Booking)
    Letusto->>Forwarder: 화물 픽업 지시서 전달 (출고지 주소, 현장 담당자 연락처)
    Forwarder->>Brand: 공장/창고 방문하여 실물 화물 수거 (Pickup)
    Brand->>Portal: 출고 상세 화면(/portal/orders/shipping/[id])에서 [물품 인계 완료] 클릭
    Portal->>Portal: goods_readiness.handover_status -> HANDED_OVER 갱신
    Letusto->>Portal: Admin에서 Inbound Shipment 생성 (SHP-XXXX) & 선적 진행
    Note over Brand, Portal: 브랜드사는 [선적 추적 내역] 탭에서 ETD/ETA 및 선적 상태 모니터링
```

---

## Diagram 3. Track 2: `SUPPLIER_ARRANGED` (공급사 자체 운송 / DDP) Detailed Flow

```mermaid
sequenceDiagram
    autonumber
    actor Brand as 브랜드사 (Brand Portal)
    participant Portal as Portal Server / DB
    actor Courier as 브랜드사 자체 특송/운송사 (FedEx/DHL 등)
    actor Warehouse as 미국 물류센터 (Letusto Warehouse)

    Note over Brand, Courier: 전제 조건: po_status IN ('APPROVED', 'SENT') & supplier_confirmation_status = 'CONFIRMED'
    Brand->>Portal: 출고 준비 등록 (Ready Qty, Cartons, Weight, CBM, P/L, C/I)
    Portal->>Portal: goods_readiness 생성 (상태: READY_SUBMITTED)
    Brand->>Courier: 화물 발송 및 B/L 또는 Tracking Number 발급
    Brand->>Portal: 출고 상세 화면의 [물류 액션 패널]에 배송 정보 입력<br/>(Carrier, Tracking Number, BL, ETD, ETA)
    Brand->>Portal: [배송 출발 및 선적 등록] 클릭
    Portal->>Portal: inbound_shipments 생성 (상태: IN_TRANSIT)
    Portal->>Portal: goods_readiness.handover_status -> HANDED_OVER 갱신
    Portal->>Portal: PO fulfillment_status -> SHIPPED 갱신
    Courier->>Warehouse: 미국 물류센터로 화물 배송 및 도착 (ARRIVED)
    Warehouse->>Portal: Admin 창고 입고 검수(Receiving) 개시
```

---

## Diagram 4. Goods Readiness State Machine (출고 준비 상태 전이도)

```mermaid
stateDiagram-v2
    [*] --> DRAFT : 임시저장 (Save Draft)
    [*] --> READY_SUBMITTED : 출고 완료 제출 (Submit)
    
    DRAFT --> READY_SUBMITTED : 수정 후 제출
    DRAFT --> [*] : 삭제 / 취소
    
    READY_SUBMITTED --> READY_SUBMITTED : 출고 정보 수정 (수량/스펙 재제출)
    READY_SUBMITTED --> HANDOVER_PENDING : 포워더 배정 및 픽업 대기
    
    HANDOVER_PENDING --> HANDED_OVER : [LETUSTO] 물품 인계 완료 클릭
    READY_SUBMITTED --> HANDED_OVER : [SUPPLIER] 배송 출발 및 선적 등록
    
    HANDED_OVER --> [*] : 선적 및 운송 단계로 전이
```

---

## Diagram 5. Inbound Shipment State Machine (선적 추적 상태 전이도)

```mermaid
stateDiagram-v2
    state "MAN-B-LOG-001: 물류 & 선적 관할 (Logistics Transport)" as LOGISTICS {
        [*] --> CREATED : 선적 생성 (Draft/Booking)
        CREATED --> IN_TRANSIT : 출항 / 운송 개시 (Shipped)
        IN_TRANSIT --> ARRIVED : 미국 물류센터 도착 (Delivered)
        CREATED --> CANCELLED : 선적 취소
        IN_TRANSIT --> CANCELLED : 운송 사고 / 선적 취소
    }

    state "Warehouse Receiving: 창고 입고 검수 관할 (Admin/창고)" as WAREHOUSE_RECEIVING {
        ARRIVED --> PARTIALLY_RECEIVED : 일부 품목 실물 검수
        ARRIVED --> RECEIVED : 전체 품목 전수 실물 검수 완료
        PARTIALLY_RECEIVED --> RECEIVED : 잔여 품목 입고 검수 완료
        RECEIVED --> COMPLETED : 최종 입고 승인 및 행정 종결
    }
```

---

## Diagram 6. Shipping to Warehouse Receiving Handoff Boundary (물류 ↔ 창고 입고 경계)

```mermaid
flowchart LR
    subgraph LOG_SCOPE["[MAN-B-LOG-001] 선적 및 물류 관할"]
        L1[화물 운송 IN_TRANSIT] --> L2[컨테이너 양하 / 세관 통관]
        L2 --> L3[창고 입하 도크 도착 ARRIVED]
    end

    subgraph RC_BOUNDARY["물리적 및 시스템 Handoff 지점"]
        L3 --> B1{화물 실물 인계 확인}
        B1 --> B2[인바운드 선적 번호 SHP-XXXX 대조]
    end

    subgraph WHS_SCOPE["[창고 도메인] 입고 검수 관할 (Warehouse Receiving)"]
        B2 --> W1[카톤 바코드 스캔 & 외관 파손 검사]
        W1 --> W2[실물 피스 카운팅 Piece Count]
        W2 --> W3[정상 입고 received_qty 기록]
        W2 --> W4[파손 damaged_qty 격리]
        W2 --> W5[오배송/미달 hold_qty 보류]
        W3 & W4 & W5 --> W6[입고 전표 확정 및 PO 실적 갱신]
    end

    style LOG_SCOPE fill:#eff6ff,stroke:#3b82f6
    style RC_BOUNDARY fill:#fef2f2,stroke:#ef4444
    style WHS_SCOPE fill:#f0fdf4,stroke:#22c55e
```

---

## Diagram 7. Multi-Manual Architecture & Domain Relationship (`MAN-B-ORD-001` $\leftrightarrow$ `MAN-B-LOG-001` $\leftrightarrow$ `MAN-B-FIN-001`)

```mermaid
flowchart TD
    subgraph ORD["MAN-B-ORD-001: 발주 및 계약 도메인"]
        O1[PO 발행 및 내부 승인] --> O2[공급사 발주 수락]
        O2 --> O3["공식 발주 확정<br/>(po_status: APPROVED/SENT<br/>supplier_confirmation: CONFIRMED)"]
    end

    subgraph LOG_TRACK["MAN-B-LOG-001: 물류 & 선적 도메인"]
        O3 --> L1[출고 준비 등록 ready_qty / CBM / 중량]
        L1 --> L2[패킹 서류 P/L & C/I 등록]
        L2 --> L3[운송 책임 분기 LETUSTO vs SUPPLIER]
        L3 --> L4[국제 운송 및 선적 추적 IN_TRANSIT]
        L4 --> L5[미국 창고 도착 ARRIVED]
    end

    subgraph WHS_RCV["창고 도메인: 실물 입고 검수"]
        L5 --> R1[실물 검수 piece count]
        R1 --> R2["검수 결과 기록<br/>(received_qty / damaged_qty / hold_qty)"]
        R2 --> R3[입고 확정 종결 RECEIVED]
    end

    subgraph FIN_TRACK["MAN-B-FIN-001: 재무 & 인보이스 도메인"]
        O3 -.->|상업 계약 조건에 따른 청구| F1[인보이스 발행 작성]
        F1 --> F2[청구 승인 및 대금 정산/송금]
    end

    style ORD fill:#f8fafc,stroke:#64748b
    style LOG_TRACK fill:#eff6ff,stroke:#2563eb
    style WHS_RCV fill:#fffbeb,stroke:#d97706
    style FIN_TRACK fill:#fdf2f8,stroke:#ec4899
```
