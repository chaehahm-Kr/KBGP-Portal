# MAN-B-RET-001: Retail Placement & Application Workflow Maps

---

## 1. End-to-End Application Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Draft: 1. 새 신청서 작성 (createDraftApplication)
    
    state Draft {
        [*] --> SelectProducts: 제품 선택 (다중 브랜드)
        SelectProducts --> EvaluateReadiness: 6대 준비사항 응답 (🟢/🟡)
        EvaluateReadiness --> SaveDraft: 임시저장 (saveDraftApplication)
        SaveDraft --> SelectProducts
    }

    Draft --> Submitted: 2. 신청서 제출 (submitApplication, >=1 제품 필수)
    note right of Submitted
        - 신청번호 자동 생성 (generate_application_number)
        - 담당자/어드민 이메일 및 B2B 알림 발송
        - 편집 잠금
    end note

    Submitted --> Assigned: 3. 심사역 배정 (Admin/MD Assignment)
    Assigned --> UnderReview: 4. MD 심사 개시 (reviewApplicationProduct)
    Submitted --> UnderReview: (배정 생략 시 직무 심사)

    state UnderReview {
        [*] --> ProductReview: 제품별 개별 심사
        ProductReview --> InfoRequested: 추가 자료/성분/단가 요청
        InfoRequested --> ReReview: 브랜드 회신 및 증빙 제출 (replyToInfoRequest)
        ReReview --> ProductReview
    }

    UnderReview --> Approved: 100% 제품 승인 (computeAggregatedStatus)
    UnderReview --> PartialApproved: 일부 제품 승인 + 일부 반려/보류
    UnderReview --> OnHold: 승인 0건 + 일부 보류
    UnderReview --> Rejected: 100% 제품 반려

    state PostApproval {
        Approved --> InvitationSent: 파트너 정식 초대 / 계정 활성화
        PartialApproved --> InvitationSent: 승인 제품 대상 파트너 초대
        InvitationSent --> Onboarding: 온보딩 진행
        Onboarding --> Onboarded: 리테일 네트워크 입점 완료
    }

    Approved --> [*]
    PartialApproved --> [*]
    Rejected --> [*]
    OnHold --> [*]
    Onboarded --> [*]
```

> **📌 Boundary Notice (Retail Application vs Purchase Order)**:  
> `Retail Application Approval ≠ Automatic PO Creation`  
> 입점 신청 승인은 K SELECT 리테일 네트워크 입점 자격 획득 및 포털 온보딩 활성화를 의미하며, 발주는 `MAN-B-ORD-001`의 Brand PO Request 또는 Admin 직접 발주 생성을 통해 독립적으로 체결됩니다.

---

## 2. Brand User Application Drafting & Submission Flow

```mermaid
flowchart TD
    A["/portal/applications (입점 신청 목록)"] -->|클릭: 새 신청서 작성| B["createDraftApplication() 실행"]
    B -->|DB: applications 테이블에 draft 생성| C["/portal/applications/[id] 드래프트 화면 진입"]
    
    subgraph DraftSection ["신청서 작성 단계"]
        C --> D["등록된 브랜드별 제품 목록 확인"]
        D --> E["신청할 제품 체크박스 선택 (다중 브랜드 지원)"]
        E --> F["6대 프로그램 참여 준비 사항 (Readiness) 응답"]
        F --> G{"사용자 액션"}
        G -->|임시저장 클릭| H["saveDraftApplication() 실행<br/>- application_products 동기화<br/>- readiness/self_check 저장"]
        H --> C
    end

    G -->|신청서 제출 클릭| I{"제품 1개 이상<br/>선택 여부 검증"}
    I -->|0개 선택| J["에러: 제품을 최소 1개 선택해야 제출할 수 있습니다."]
    J --> C
    I -->|1개 이상 선택| K["RPC: generate_application_number 호출"]
    K --> L["applications 상태를 'submitted'로 업데이트"]
    L --> M["알림 발송:<br/>1. 신청자 확인 이메일 + 포털 알림<br/>2. 심사팀 수신 이메일 + Admin 알림"]
    M --> N["/portal/applications/[id] 상세/심사 모니터링 화면 전환"]
```

---

## 3. Granular Multi-Product Review & Status Aggregation

```mermaid
flowchart TD
    subgraph AdminMD ["어드민 MD 심사 프로세스"]
        A1["Admin: /admin/applications/[id] 접속"] --> A2["신청 제품 목록 개별 검토"]
        A2 --> A3["제품별 심사 결정:<br/>1. 승인 (approved)<br/>2. 보류 (on_hold, 사유 필수)<br/>3. 반려 (rejected, 사유 필수)"]
        A3 --> A4["reviewApplicationProduct() 실행"]
        A4 --> A5["DB: application_products 상태 & 사유 업데이트"]
        A5 --> A6["activity_logs에 감사 로그 기록"]
    end

    subgraph AggregationEngine ["자동 상태 집계 엔진 (computeAggregatedStatus)"]
        A6 --> B1{"아직 심사 중인<br/>제품이 있는가?"}
        B1 -->|Yes (pending/reviewing/info_requested)| B2["전체 상태 = 'under_review' (심사중)"]
        B1 -->|No| B3{"승인된 제품 수 비율"}
        B3 -->|100% 승인| B4["전체 상태 = 'approved' (최종 승인)"]
        B3 -->|100% 반려| B5["전체 상태 = 'rejected' (심사 반려)"]
        B3 -->|승인 0건, 일부 보류| B6["전체 상태 = 'on_hold' (심사 보류)"]
        B3 -->|일부 승인 + 일부 반려/보류| B7["전체 상태 = 'partial_approved' (부분 승인)"]
    end

    subgraph BrandPortalSync ["브랜드 포털 실시간 반영"]
        B2 --> C1["포털 타임라인 갱신"]
        B4 --> C2["결과 통보 이메일 발송 + 승인 안내"]
        B5 --> C2
        B6 --> C2
        B7 --> C2
    end
```

---

## 4. Additional Info Request & Reply Sequence

```mermaid
sequenceDiagram
    autonumber
    actor MD as K SELECT MD / Reviewer
    participant AdminSys as K SELECT Admin
    participant DB as Supabase DB & Storage
    participant Mail as Notification Service
    participant BrandSys as K SELECT Brand Portal
    actor Brand as Brand Manager

    MD->>AdminSys: 추가 자료 요청 생성 (requestContent, replyDueAt, productId)
    AdminSys->>DB: INSERT additional_info_requests
    AdminSys->>DB: UPDATE applications status = 'info_requested'
    AdminSys->>DB: INSERT partner_inquiries (is_action_required = true)
    AdminSys->>Mail: sendTemplatedEmail("info_request_created")
    AdminSys->>BrandSys: createNotification() 실시간 B2B 알림
    
    Mail-->>Brand: 이메일 수신 (요청 내용 및 회신 기한 안내)
    Brand->>BrandSys: /portal/applications/[id] 접속
    BrandSys->>Brand: 노란색 자료 요청 패널 및 기한 표시
    
    Brand->>BrandSys: 회신 내용 작성 + 첨부파일 선택
    Brand->>BrandSys: '회신 제출' 클릭 (replyToInfoRequest)
    BrandSys->>DB: Storage 업로드 (company-uploads bucket)
    BrandSys->>DB: UPDATE additional_info_requests (status = 'replied')
    BrandSys->>DB: UPDATE applications status = 're_review'
    BrandSys->>Mail: sendTemplatedEmail("info_request_replied") to MD
    
    BrandSys-->>Brand: 패널 닫힘 및 '추가 자료 요청 및 회신 내역' 카드에 등록
    Mail-->>MD: 회신 완료 알림 수신
    MD->>AdminSys: 신청서 재심사 진행
```
