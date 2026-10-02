# MAN-B-ORD-001 — Workflow Map
## K SELECT Brand Portal: Purchase Orders & Order Management (비즈니스 워크플로우 맵)

---

## 1. End-to-End Order & Purchasing Lifecycle

```mermaid
flowchart TD
    subgraph Brand_Portal["Brand Portal (공급사)"]
        A1["발주 요청서 작성<br/>(/portal/orders/requests/new)"]
        A2["요청서 제출 (SUBMITTED)"]
        A3["공식 발주서 수신<br/>(/portal/orders/purchase-orders)"]
        A4["발주 수락 (Confirm PO)"]
        A5["생산 착수 (In Production)"]
        A6["출고 준비 완료 (Goods Ready 등록)<br/>(카톤/중량/CBM/패킹리스트)"]
        A7{"운송 책임 구분<br/>(Shipping Responsibility)"}
        A8["화물 인계 보고 (Handover)"]
        A9["직접 선적 정보 등록 (B/L, AWB)"]
        A10["입고 검수 내역 확인<br/>(/portal/orders/purchase-orders/id?tab=receiving)"]
        A11["공급사 인보이스 발행<br/>(/portal/finance/invoices/new)"]
    end

    subgraph Admin_Portal["Admin Portal (K SELECT 본사)"]
        B1["발주 요청 심사<br/>(/admin/purchasing/requests)"]
        B2["수량/단가 확정 & PO 변환<br/>(Convert to Official PO)"]
        B3["직접 발주서 생성<br/>(/admin/purchasing/new)"]
        B4["발주 승인 및 공급사 전송 (SENT)"]
        B5["포워더 배차 및 픽업 지시"]
        B6["인바운드 선적 관리<br/>(/admin/purchasing/shipments)"]
        B7["미국 창고 입고 검수<br/>(/admin/purchasing/receiving)"]
        B8["발주 완료 종결 (COMPLETED)"]
    end

    A1 --> A2 --> B1
    B1 -->|승인 및 변환| B2 --> B4
    B3 --> B4
    B4 --> A3
    A3 --> A4 --> A5 --> A6 --> A7
    A7 -->|LETUSTO_ARRANGED| A8 --> B5 --> B6
    A7 -->|SUPPLIER_ARRANGED| A9 --> B6
    B6 --> B7 --> B8
    B7 --> A10
    B8 --> A11
```

---

## 2. PO Creation & Dual-Track Origin Flow

```mermaid
flowchart TD
    subgraph Track1["Track 1: Brand PO Request (발주 요청 기반)"]
        T1_1["브랜드사가 공급 희망 품목/수량 선택"] --> T1_2["참고 FOB 단가 및 희망 출고일 입력"]
        T1_2 --> T1_3["발주 요청서 제출 (po_requests: SUBMITTED)"]
        T1_3 --> T1_4["Admin MD 심사 및 수량/단가 조정"]
        T1_4 --> T1_5["공식 발주서로 변환 (Convert to PO)"]
        T1_5 --> T1_6["purchase_orders 레코드 생성 (po_status: APPROVED/SENT)"]
    end

    subgraph Track2["Track 2: Admin Direct PO (본사 직접 발주일반)"]
        T2_1["Admin MD가 공급사 및 입고 창고 지정"] --> T2_2["발주 품목, 확정 수량, 계약 단가 입력"]
        T2_2 --> T2_3["인코텀즈, 결제조건, 선적 책임 설정"]
        T2_3 --> T2_4["발주서 승인 및 공급사 전송 (po_status: SENT)"]
    end

    T1_6 --> SharedPO["공식 발주서 (Official Purchase Order) 활성화"]
    T2_4 --> SharedPO
```

---

## 3. Brand PO Response & Collaboration Flow

```mermaid
flowchart TD
    PO_Received["공식 발주서 접수<br/>(po_status: SENT, confirmation: PENDING)"] --> Review{"발주 조건 검토"}
    
    Review -->|조건 수락| Confirm["발주 수락 (Confirm PO)"]
    Confirm --> SetConfirmed["supplier_confirmation_status = 'CONFIRMED'<br/>진행 단계: Step 2 Supplier Confirmed"]
    SetConfirmed --> Production["생산 진행 (In Production)"]
    
    Review -->|수량/단가/납기 변경 필요| ReqChange["변경 요청 (Request Change via Case)"]
    ReqChange --> OpenCase["1:1 파트너 문의 케이스 생성<br/>(partner_inquiries, category: po_change)"]
    OpenCase --> SetChangeReq["supplier_confirmation_status = 'CHANGE_REQUESTED'"]
    SetChangeReq --> MDNegotiation["Admin MD와 조율 협의"]
    
    MDNegotiation -->|협의 완료| RevisePO["Admin 수정 발주서 발행 (Rev.1)"]
    RevisePO --> PO_Received

    MDNegotiation -->|제안 철회| Withdraw["변경 제안 철회 (Withdraw)"]
    Withdraw --> Review
```

---

## 4. Status Lifecycle State Machine

### 4.1 PO Request State Machine (`po_requests.status`)
```mermaid
stateDiagram-v2
    [*] --> DRAFT: 신규 작성 시작
    DRAFT --> SUBMITTED: 브랜드사 제출
    DRAFT --> CANCELLED: 브랜드사 자체 취소
    
    SUBMITTED --> UNDER_REVIEW: Admin 검토 착수
    SUBMITTED --> CANCELLED: 브랜드사 자체 취소
    
    UNDER_REVIEW --> CHANGE_REQUESTED: Admin 수정 요청 (사유 기재)
    UNDER_REVIEW --> REJECTED: Admin 반려
    UNDER_REVIEW --> CONVERTED_TO_PO: Admin 공식 PO 변환
    
    CHANGE_REQUESTED --> SUBMITTED: 브랜드사 수정 후 재제출
    CHANGE_REQUESTED --> CANCELLED: 브랜드사 취소
    
    CONVERTED_TO_PO --> [*]: 공식 발주서 생성 완료
    REJECTED --> [*]
    CANCELLED --> [*]
```

### 4.2 Purchase Order 6-Step Stepper State Machine
```mermaid
stateDiagram-v2
    [*] --> Draft: Admin 초안 작성
    Draft --> Approved: Admin 내부 승인
    Approved --> Step1_Sent: Admin 전송 (Mark Sent)
    
    state "Step 1: PO Sent / Received" as Step1_Sent
    state "Step 2: Supplier Confirmed" as Step2_Confirmed
    state "Step 3: Ready to Ship" as Step3_Ready
    state "Step 4: Shipped" as Step4_Shipped
    state "Step 5: Receiving / Inspection" as Step5_Receiving
    state "Step 6: Completed" as Step6_Completed
    
    Step1_Sent --> Step2_Confirmed: Brand: Confirm PO
    Step1_Sent --> Cancelled: Admin/Brand 취소 합의
    
    Step2_Confirmed --> Step3_Ready: Brand: Goods Ready 등록 (카톤/중량/CBM/서류)
    
    Step3_Ready --> Step4_Shipped: Letusto 포워더 출항 or 공급사 직접 선적 등록
    
    Step4_Shipped --> Step5_Receiving: 미국 창고 도착 및 입고 검수 개시
    
    Step5_Receiving --> Step6_Completed: 창고 검수 확정 및 발주 종결
    
    Step6_Completed --> [*]
    Cancelled --> [*]
```

---

## 5. Retail Application & PO Independence (Verification Result)

```mermaid
flowchart TD
    subgraph Retail_Application_Flow["Retail Application Domain (MAN-B-RET-001)"]
        RA1["브랜드사 입점 신청 제출"] --> RA2["Admin MD 입점 심사"]
        RA2 -->|승인| RA3["신청서 승인 (status: approved)"]
        RA3 --> RA4["브랜드사 포털 가입 초대 메일 발송"]
        RA4 --> RA5["브랜드사 포털 계정 활성화 (Active)"]
    end

    subgraph Purchase_Order_Domain["Purchase Order Domain (MAN-B-ORD-001)"]
        PO1["Admin 직발행 PO<br/>(/admin/purchasing/new)"]
        PO2["Brand 발주 요청<br/>(/portal/orders/requests/new)"]
        PO3["공식 발주서 생성 & 발송<br/>(purchase_orders)"]
    end

    RA5 -.->|❌ NO AUTOMATIC LINKAGE| PO3
    PO1 --> PO3
    PO2 --> PO3

    style RA5 fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style PO3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

> **검증 결론**: 입점 신청 승인(`approved`) 시 자동 발주서 생성을 트리거하는 DB Trigger 또는 Server Action은 프로덕션에 존재하지 않음 (**NOT VERIFIED / INDEPENDENT**).

---

## 6. Logistics Responsibility & Handoff Flow

```mermaid
flowchart TD
    Ready["출고 준비 완료 (Goods Ready 등록)"] --> ModeCheck{"선적 책임 구분<br/>(shipping_responsibility)"}

    subgraph Letusto_Arranged["LETUSTO_ARRANGED (본사 지정 포워더 운송)"]
        L1["브랜드사: 패킹리스트 & 상업송장 업로드"]
        L2["본사: 포워더 픽업 스케줄링 & 포워더 정보 안내"]
        L3["브랜드사: 창고에서 포워더에게 화물 인계 (Submit Handover)"]
        L4["본사: 인바운드 선적(Inbound Shipment) 생성 및 추적"]
        L1 --> L2 --> L3 --> L4
    end

    subgraph Supplier_Arranged["SUPPLIER_ARRANGED (공급사 직접 운송)"]
        S1["공급사: 자체 지정 포워더를 통한 선적 수배"]
        S2["공급사: 선적 정보 직접 등록<br/>(B/L, AWB, Carrier, Tracking No, ETD, ETA)"]
        S3["공급사: 패킹리스트, 상업송장, 선하증권 보관함 업로드"]
        S4["본사: 도착 예정일 기준 입고 검수 스케줄링"]
        S1 --> S2 --> S3 --> S4
    end

    ModeCheck -->|LETUSTO_ARRANGED| L1
    ModeCheck -->|SUPPLIER_ARRANGED| S1
```

---

## 7. Finance & Invoice Handoff Flow

```mermaid
flowchart TD
    PO_Confirmed["공식 발주서 수락 완료<br/>(supplier_confirmation_status: CONFIRMED)"] --> InvEligible["인보이스 발행 가능 발주로 식별<br/>(getEligiblePosForInvoice)"]
    
    InvEligible --> CreateInv["정산 관리 > 공급사 인보이스 작성 진입<br/>(/portal/finance/invoices/new)"]
    CreateInv --> SelectPO["해당 발주서(PO Number) 선택"]
    SelectPO --> AutoPopulate["발주 품목, 확정 수량, 단가, 결제조건 자동 로드"]
    AutoPopulate --> SubmitInv["공급사 인보이스 제출 (SUBMITTED)"]
    SubmitInv --> AdminAP["Admin 재무팀 AP 심사 및 정산 집행"]
```
