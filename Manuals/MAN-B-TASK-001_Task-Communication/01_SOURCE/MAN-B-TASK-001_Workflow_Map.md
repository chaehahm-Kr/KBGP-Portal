# WORKFLOW MAP: MAN-B-TASK-001
## Task & Communication Lifecycle & Architecture Diagrams

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## Diagram 1. End-to-End Case Management Lifecycle (전체 케이스 라이프사이클)

```mermaid
flowchart TD
    subgraph INITIATION["1. 케이스 생성 및 인바운드 접수"]
        A1[브랜드사: 지원 센터 접속 /portal/support] --> A2{문의 경로 선택}
        A2 -->|직접 등록| A3[카테고리 선택 및 문의 작성]
        A2 -->|도메인 딥링크| A4["타 화면에서 '문의하기' 클릭<br/>(PO / 정산 / 계약 컨텍스트 자동 바인딩)"]
        A3 & A4 --> A5[첨부파일 업로드 P/L, C/I, 캡처 - 최대 20MB]
        A5 --> A6["문의 제출 (Submit Case)<br/>상태: RECEIVED (접수됨)"]
    end

    subgraph TRIAGE["2. 어드민 분류 및 검토 (Admin Triage)"]
        A6 --> B1[K SELECT 어드민 인앱 알림 수신]
        B1 --> B2[담당 팀 및 담당자 배정 assigned_to]
        B2 --> B3["케이스 검토 개시<br/>상태: UNDER_REVIEW (검토중)"]
    end

    subgraph ACTION_LOOP["3. 양방향 소통 및 조치 루프 (Communication Loop)"]
        B3 --> C1{추가 정보/조치 필요 여부?}
        
        %% Action Required Branch
        C1 -->|조치 필요| C2["어드민: 조치 요청 발송 (isActionRequired=true, sendEmail)<br/>상태: ACTION_REQUIRED (조치필요)"]
        C2 --> C3[브랜드사: 인앱 알림 및 조건부 이메일 수신]
        C3 --> C4[브랜드사: 보완 서류 제출 및 답변 등록]
        C4 --> C5["조치 완료 처리 (resolvePartnerInquiryAction)<br/>상태: UNDER_REVIEW (검토중)"]
        C5 --> B3
        
        %% Normal Resolution Branch
        C1 -->|일반 답변 / 문제 해결| D1[어드민: 일반 스레드 답변 작성]
        D1 --> D2[브랜드사: 인앱 알림 확인 및 답변 열람]
    end

    subgraph CLOSURE["4. 케이스 종결 및 만족도 평가 (Closure & CSAT)"]
        D2 --> E1{추가 문의 사항 존재?}
        E1 -->|추가 질문 있음| E2[브랜드사: 추가 메시지 작성]
        E2 --> B3
        
        E1 -->|해결 완료| E3["케이스 종결 (Close Case)<br/>상태: CLOSED (종료됨)"]
        E3 --> E4[브랜드사: 5점 만족도 별점 및 코멘트 제출]
        E4 --> E5[감사 로그 및 케이스 마감 완료]
    end

    style INITIATION fill:#eff6ff,stroke:#3b82f6
    style TRIAGE fill:#f5f3ff,stroke:#8b5cf6
    style ACTION_LOOP fill:#fff1f2,stroke:#f43f5e
    style CLOSURE fill:#f0fdf4,stroke:#22c55e
```

---

## Diagram 2. Cross-Domain Context & Prefill Inflow (도메인 간 컨텍스트 연계 워크플로우)

```mermaid
flowchart LR
    subgraph DOMAINS["발주 / 물류 / 정산 / 계약 도메인 화면"]
        D1["[MAN-B-ORD-001]<br/>PO 상세 화면<br/>(/portal/orders/id)"]
        D2["[MAN-B-FIN-001]<br/>정산/인보이스 화면<br/>(/portal/settlement)"]
        D3["[MAN-B-PERM-001]<br/>계약 및 약관 화면<br/>(/portal/agreements)"]
    end

    subgraph BUTTONS["원클릭 문의 액션"]
        B1["[PO 변경 요청] 클릭"]
        B2["[정산 내역 문의] 클릭"]
        B3["[계약 수정 문의] 클릭"]
    end

    subgraph PREFILL_URL["URL 파라미터 사전 입력 (Prefill Engine)"]
        U1["/portal/support?new=1<br/>&category=po_change<br/>&po_id=...&po_no=PO-2026-0008"]
        U2["/portal/support?new=1<br/>&category=settlement<br/>&invoice_id=...&ap_no=AP-2026-0012"]
        U3["/portal/support?new=1<br/>&category=agreement_change<br/>&agreement_id=..."]
    end

    subgraph SUPPORT_PORTAL["[MAN-B-TASK-001] 1:1 케이스 센터"]
        S1["새 문의 모달 자동 오픈<br/>• 관련 발주서 FK 배지 자동 바인딩<br/>• 카테고리 자동 설정<br/>• 관련 전표 식별자 즉시 연동"]
    end

    D1 --> B1 --> U1 --> S1
    D2 --> B2 --> U2 --> S1
    D3 --> B3 --> U3 --> S1

    style DOMAINS fill:#f8fafc,stroke:#64748b
    style BUTTONS fill:#eff6ff,stroke:#3b82f6
    style PREFILL_URL fill:#f5f3ff,stroke:#8b5cf6
    style SUPPORT_PORTAL fill:#f0fdf4,stroke:#22c55e
```

---

## Diagram 3. Brand ↔ Admin Communication & Action Required Loop (스레드 소통 시퀀스)

```mermaid
sequenceDiagram
    autonumber
    actor Brand as 브랜드사 (Brand Portal)
    participant Portal as Portal Server / DB
    actor Admin as K SELECT 운영팀 (Admin Console)
    participant Resend as 이메일 알림 (Resend Engine)

    Brand->>Portal: 1:1 문의 등록 (제목, 본문, 첨부파일)
    Portal->>Portal: partner_inquiries 생성 (status: open, CASE-XXXX)
    Portal->>Admin: 어드민 인앱 알림 발생 (notifications)
    Admin->>Portal: 문의 확인 및 검토중 전환 (status -> in_review)
    
    rect rgb(254, 242, 242)
        Note over Admin, Brand: 조치 필요 (Action Required) 시나리오
        Admin->>Portal: 조치 요청 메시지 작성 (isActionRequired=true, sendEmail=true)
        Portal->>Portal: partner_inquiry_messages 기록 (message_type: action_required)
        Portal->>Portal: partner_inquiries.status -> action_required
        Portal->>Brand: 인앱 알림 발생 (헤더 알림 센터 배지)
        Portal->>Resend: 주 담당자(Primary Contact)에게 이메일 알림 전송
        Resend-->>Brand: 이메일 도착 ("조치가 필요한 문의가 있습니다")
        Brand->>Portal: 포털 접속 후 추가 서류 업로드 및 답변 제출
        Portal->>Portal: resolvePartnerInquiryAction 실행 -> status: in_review (조치 완료 복귀)
    end

    rect rgb(240, 253, 244)
        Note over Admin, Brand: 케이스 해결 및 종결 시나리오
        Admin->>Portal: 최종 해결 답변 등록 및 케이스 종결 (closeCaseAdmin)
        Portal->>Portal: partner_inquiries.status -> closed
        Brand->>Portal: 해결 내용 확인 및 만족도 평가 제출 (submitSatisfactionRating)
        Portal->>Portal: satisfaction_score 기록 및 satisfaction 메시지 스레드 추가
    end
```

---

## Diagram 4. Official Case Status State Machine (케이스 상태 전이도)

```mermaid
stateDiagram-v2
    [*] --> RECEIVED : 신규 문의 제출 (open / pending)
    
    RECEIVED --> UNDER_REVIEW : 어드민 담당자 배정 및 검토 개시 (in_review)
    
    UNDER_REVIEW --> ACTION_REQUIRED : 어드민 조치 요청 (isActionRequired = true)
    ACTION_REQUIRED --> UNDER_REVIEW : 브랜드사 보완 답변 제출 (resolvePartnerInquiryAction)
    
    UNDER_REVIEW --> CLOSED : 문제 해결 및 케이스 종결 (closeCase / closeCaseAdmin)
    RECEIVED --> CLOSED : 단순 확인 후 즉시 종결
    
    CLOSED --> UNDER_REVIEW : 추가 질문 등록으로 케이스 재오픈 (reopened)
    
    CLOSED --> [*] : 만족도 평가 제출 및 영구 마감
```

---

## Diagram 5. Notification & Primary Contact Email Routing (알림 라우팅 구조)

```mermaid
flowchart TD
    A[이벤트 발생: 조치 요청 isActionRequired=true] --> B{"회사 6대 업무 라우팅 매핑<br/>(company_task_assignments)"}
    
    B -->|해당 카테고리 task_code 조회| C["주 담당자(is_primary=true) 식별<br/>(company_apply, contract, product_cert,<br/>pricing_quote, logistics_inventory, settlement_inquiry)"]
    B -->|추가 알림 수신 동의자 email_notify=true 조회| D[동의 직원 목록 추출]
    
    C & D --> E[Resend Transactional Email 엔진 호출]
    E --> F["담당자 업무 이메일 수신<br/>(제목: [K SELECT] 조치 요청 안내 - CASE-XXXX)"]
    
    A --> G[인앱 알림 notifications 레코드 생성]
    G --> H["브랜드 포털 헤더 알림 센터 피드 노출<br/>(read_notification_ids 기준 읽음 추적)"]

    style A fill:#f8fafc,stroke:#64748b
    style B fill:#eff6ff,stroke:#3b82f6
    style E fill:#f5f3ff,stroke:#8b5cf6
    style F fill:#f0fdf4,stroke:#22c55e
    style H fill:#fffbeb,stroke:#f59e0b
```

---

## Diagram 6. Support Menu ACL Permission Boundary (권한 제어 경계)

```mermaid
flowchart TD
    User[브랜드사 사용자 접속] --> Check{support 권한 레벨 확인}
    
    Check -->|none / 0단계| P0["접근 차단 (Access Denied)<br/>• /portal/support 접속 시 경고 화면<br/>• 사이드바 메뉴 잠금"]
    
    Check -->|read / 1단계| P1["조회 전용 모드 (View Only)<br/>• 소속 회사 문의 목록 및 대화 스레드 열람<br/>• [+ 새 문의 등록] 버튼 비표시<br/>• 답변 입력창 비활성화"]
    
    Check -->|write / 2단계| P2["생성 및 대화 참여 모드 (Standard Staff)<br/>• 신규 1:1 문의 작성 및 첨부파일 업로드<br/>• 스레드 답변 작성 및 조치 보완 제출"]
    
    Check -->|manage / 3단계| P3["관리 및 종결 모드 (Full Admin/Manager)<br/>• 케이스 직접 종결 (closeCase)<br/>• 만족도 평가 제출 (CSAT)<br/>• 전 기능 제어 권한"]

    style P0 fill:#fef2f2,stroke:#ef4444
    style P1 fill:#f8fafc,stroke:#94a3b8
    style P2 fill:#eff6ff,stroke:#3b82f6
    style P3 fill:#f0fdf4,stroke:#22c55e
```

---

## Diagram 7. Multi-Manual Domain Architecture & Relationship Map

```mermaid
flowchart TD
    subgraph ORD["MAN-B-ORD-001: 발주 관리"]
        O1[PO 발행 및 확정]
        O2[PO 변경 필요 발생]
    end

    subgraph LOG["MAN-B-LOG-001: 선적 & 물류"]
        L1[출고 준비 및 스펙 등록]
        L2[운송 지연 / 통관 특이사항]
    end

    subgraph FIN["MAN-B-FIN-001: 재무 & 정산"]
        F1[인보이스 발행 및 지급]
        F2[정산 금액 / 세금계산서 불일치]
    end

    subgraph PERM["MAN-B-PERM-001: 권한 & 조직"]
        P1["회사 6대 업무별 주 담당자 지정<br/>(company_apply, contract, product_cert,<br/>pricing_quote, logistics_inventory, settlement_inquiry)"]
    end

    subgraph TASK["MAN-B-TASK-001: 할 일 & 1:1 소통 (본 매뉴얼)"]
        T1["1:1 문의 센터 (/portal/support)"]
        T2[양방향 스레드 대화 & 파일 첨부]
        T3[조치 요구 Action Item 처리]
        T4[케이스 종결 및 만족도 평가]
    end

    O2 -.->|po_change 카테고리 딥링크 & FK 연동| T1
    L2 -.->|logistics 카테고리 문의| T1
    F2 -.->|settlement 카테고리 딥링크| T1
    P1 ==>|시스템 이메일 알림 수신인 라우팅 제공| T1

    T1 --> T2 --> T3 --> T4

    style ORD fill:#f8fafc,stroke:#64748b
    style LOG fill:#eff6ff,stroke:#2563eb
    style FIN fill:#fdf2f8,stroke:#ec4899
    style PERM fill:#fffbeb,stroke:#f59e0b
    style TASK fill:#f0fdf4,stroke:#16a34a,stroke-width:2px
```

---
*End of MAN-B-TASK-001_Workflow_Map.md*
