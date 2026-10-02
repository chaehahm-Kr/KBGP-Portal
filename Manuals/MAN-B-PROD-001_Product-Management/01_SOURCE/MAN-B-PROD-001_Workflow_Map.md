# MAN-B-PROD-001: Brand Portal Product Registration & Management — Workflow Map

> **Document ID:** `MAN-B-PROD-001-WFM`  
> **Topic:** 상품 등록 & 관리 / Product Registration & Management  
> **Source Target:** Production Brand Portal Architecture  
> **Phase:** `01_SOURCE — WORKFLOW SPECIFICATION`  
> **Audited Date:** 2026-10-01  

---

## 1. 전체 상품 관리 라이프사이클 (2-Phase Lifecycle)

K SELECT Brand Portal의 상품 등록 및 관리는 **Phase 1 (신규 진입)** 과 **Phase 2 (상세 다중 탭 관리 및 운영)** 의 2단계 파이프라인으로 구성됩니다.

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: 신규 상품 등록 (/portal/products/new)"]
        P1_ENTRY["상품 등록 시작 (+ 새 제품 등록)"] --> P1_FORM["신규 등록 폼 작성<br>(기본정보, 바코드, 가격, 채널, 패키지규격)"]
        P1_FORM --> P1_CHOICE{"제출 액션 선택"}
        P1_CHOICE -->|"임시 저장 후 나중에 등록<br>(최소 4개 필드 충족)"| P1_DRAFT["Draft 상품 생성<br>(/portal/products?saved=draft 이동)"]
        P1_CHOICE -->|"제품 등록 및 계속<br>(정식 필수값 검증 완료)"| P1_CONTINUE["정식 상품 레코드 생성<br>(/portal/products/[id] 로 즉시 이동)"]
    end

    subgraph Phase2["Phase 2: 상품 상세 관리 (/portal/products/[id])"]
        P1_CONTINUE --> P2_TABS["6개 관리 탭 진입"]
        P1_DRAFT -.->|"목록에서 선택하여 보완"| P2_TABS

        P2_TABS --> TAB_BASIC["탭 1: 기본 정보 (Basic Info)"]
        P2_TABS --> TAB_CAT["탭 2: 카테고리 & 속성 (Category & Attributes)"]
        P2_TABS --> TAB_PRICE["탭 3: 가격 정보 (Pricing Info)"]
        P2_TABS --> TAB_LOGIS["탭 4: 로지스틱스 3단계 규격 (Logistics)"]
        P2_TABS --> TAB_MEDIA["탭 5: 미디어 (Media - 이미지 & 동영상)"]
        P2_TABS --> TAB_CERTS["탭 6: 인증 및 서류 (Certificates)"]
        P2_TABS --> TAB_AUDIT["탭 7: 변경 이력 (Audit Change Log)"]
    end

    subgraph Eval["상태 자동 판정 엔진 (evaluateProductRegistrationStatus)"]
        TAB_BASIC & TAB_CAT & TAB_PRICE & TAB_LOGIS & TAB_MEDIA --> EVAL_ENGINE{"10대 필수 영역<br>완전성 평가"}
        EVAL_ENGINE -->|"누락 항목 존재"| STATUS_DRAFT["등록 상태: Draft (보완 대기)<br>누락 뱃지 클릭 시 해당 필드 자동 포커스"]
        EVAL_ENGINE -->|"모든 필수값 충족"| STATUS_COMPLETE["등록 상태: COMPLETE (등록 완료)"]
    end

    subgraph Operations["Admin 검토 & 채널 매칭 (Selection & Sales)"]
        STATUS_COMPLETE --> ADMIN_REVIEW["K SELECT MD 검토<br>(selection_status: UNREVIEWED → UNDER_REVIEW)"]
        ADMIN_REVIEW --> MD_DECISION{"MD 선정 여부"}
        MD_DECISION -->|"선정 승인 (SELECTED)"| SALES_READY["판매 채널 바인딩 및 판매 준비<br>(sales_status: PREPARING → ON_SALE)"]
        MD_DECISION -->|"정보 요청 (INFO_REQUESTED)"| INFO_REQ["브랜드사에 추가 정보 요청"]
        INFO_REQ -.-> P2_TABS
        MD_DECISION -->|"미선정 (NOT_SELECTED)"| NOT_SEL["미선정 보관"]
    end
```

---

## 2. Phase 1: 신규 상품 진입 경로 및 검증 분기 (Creation Paths)

```mermaid
flowchart LR
    START([사용자 입력 시작]) --> INPUT[폼 필드 입력]
    
    INPUT --> VALIDATE_DUP{실시간 고유성 검증}
    VALIDATE_DUP -->|제조사 SKU 중복| ERR_SKU[오류: 파트너사 내 중복된 SKU]
    VALIDATE_DUP -->|UPC / EAN 중복| ERR_BAR[오류: 시스템 내 등록된 바코드]
    VALIDATE_DUP -->|고유성 통과| ACTION_CHECK{버튼 클릭}

    ACTION_CHECK -->|"임시 저장 후 나중에 등록"| DRAFT_VAL{최소 4대 필드 검증<br>1. 브랜드<br>2. 카테고리<br>3. 제조사 SKU<br>4. 영문 제품명}
    DRAFT_VAL -->|누락| DRAFT_ERR[에러 메시지 표시]
    DRAFT_VAL -->|통과| DRAFT_SAVE[DB 저장: status=DRAFT<br>목록 페이지로 이동]

    ACTION_CHECK -->|"제품 등록 및 계속"| FULL_VAL{정식 필수값 종합 검증<br>+ 소비자가 > 0<br>+ FOB 가격 > 0<br>+ UPC 또는 EAN 필수<br>+ 온라인 판매시 링크1 필수}
    FULL_VAL -->|검증 실패| FULL_ERR[필드별 에러 하이라이트]
    FULL_VAL -->|검증 성공| FULL_SAVE[DB 저장<br>상세 페이지 /portal/products/[id] 로 전환]
```

---

## 3. 독립적 3대 상태 차원 매트릭스 (3 Status Dimensions)

K SELECT 시스템의 상품은 단일 상태값이 아닌 **3개의 상호 독립적인 차원(Dimension)** 으로 관리됩니다.

```mermaid
stateDiagram-v2
    state "1. 등록 상태 (Registration Status)" as RegStatus {
        [*] --> DRAFT : 필수 항목 미비 / 임시저장
        DRAFT --> COMPLETE : 10대 필수 영역 입력 완료
        COMPLETE --> DRAFT : 필수 필드 삭제 또는 속성 변경
        DRAFT --> DELETED : 상품 삭제 (Soft Delete)
        COMPLETE --> DELETED : 상품 삭제 (Soft Delete)
    }

    state "2. 선정 상태 (Selection Status - 어드민/MD)" as SelectStatus {
        [*] --> UNREVIEWED : 등록 완료 후 대기
        UNREVIEWED --> UNDER_REVIEW : MD 검토 시작
        UNDER_REVIEW --> INFO_REQUESTED : 브랜드 추가 서류/정보 요청
        INFO_REQUESTED --> UNDER_REVIEW : 브랜드 정보 보완
        UNDER_REVIEW --> SELECTED : 바이어 매칭 / 채널 선정
        UNDER_REVIEW --> NOT_SELECTED : 반려 또는 미선정
    }

    state "3. 판매 상태 (Sales Status - 유통 운영)" as SaleStatus {
        [*] --> PREPARING : 선정 완료 후 선적/입고 준비
        PREPARING --> ON_SALE : 미국 온/오프라인 판매 중
        ON_SALE --> PAUSED : 일시 품절 / 시즌 일시 중지
        PAUSED --> ON_SALE : 판매 재개
        ON_SALE --> ENDED : 상품 단종 / 계약 종료
        PAUSED --> ENDED : 상품 단종 / 계약 종료
    }
```

---

## 4. 카테고리 3-Depth 선택 및 동적 속성 바인딩 흐름 (Category & Attributes)

```mermaid
flowchart TD
    subgraph CatSelection["3-Depth 카테고리 선택"]
        SEARCH["카테고리 연관 검색어 입력<br>(동의어/유사어 사전 적용)"] -.->|직접 선택| LEAF_SELECT
        D1["1Depth 대분류 선택 (예: 스킨케어)"] --> D2["2Depth 중분류 선택 (예: 선케어)"]
        D2 --> D3["3Depth 소분류 선택 (예: 선크림)"]
        D3 --> LEAF_SELECT["리프 카테고리(is_final=true) 확정"]
    end

    subgraph DynamicProfile["프로필 속성 동적 로드"]
        LEAF_SELECT --> LOAD_PROFILE["해당 카테고리의 속성 프로필 조회<br>(getCategoryAttributes)"]
        LOAD_PROFILE --> COMMON_ATTRS["공통 속성 로드 (COMMON Scope)<br>예: 피부타입, 사용대상, 용기형태"]
        LOAD_PROFILE --> PROFILE_ATTRS["제품군 전용 속성 로드 (PROFILE Scope)<br>예: 자외선 차단지수(SPF/PA), 백탁여부, 워터프루프"]
    end

    subgraph ValueEntry["값 입력 및 실시간 완성도 검증"]
        COMMON_ATTRS & PROFILE_ATTRS --> INPUT_ATTRS["속성값 입력 (단일선택, 다중선택, 수치, 텍스트)"]
        INPUT_ATTRS --> EVAL_ATTRS{"필수 속성(isRequired)<br>모두 입력되었는가?"}
        EVAL_ATTRS -->|미완료| ATTR_INCOMPLETE["완료율 계산 (예: 67%)<br>누락된 필수 속성 태그 노출"]
        EVAL_ATTRS -->|완료| ATTR_COMPLETE["속성 완성도 100% 충족<br>CategoryComplete = True"]
    end
```

---

## 5. 소프트 삭제 및 일괄 삭제 라이프사이클 (Soft Delete Lifecycle)

```mermaid
sequenceDiagram
    autonumber
    actor BrandUser as 브랜드 사용자 (Brand User)
    participant UI as 포털 UI (목록 / 상세)
    participant Action as Server Action (deleteProduct / bulkDeleteProducts)
    participant Auth as 권한 및 소속사 검증 (requirePortalPermission)
    participant DB as Supabase DB (products & audit_logs)
    participant Cache as Next.js Cache & Revalidation

    BrandUser->>UI: 삭제 버튼 클릭 (단일 또는 다중 선택 일괄 삭제)
    UI->>BrandUser: 삭제 확인 팝업 (경고 메시지 확인)
    BrandUser->>UI: 최종 삭제 확인 (Confirm)

    UI->>Action: deleteProduct(productId) 호출
    Action->>Auth: 쓰기 권한('products', 'write') 및 회사 소속 일치 검증
    Auth-->>Action: 검증 성공

    Action->>DB: 이중 지속성(Dual Persistence) 업데이트<br>1. deleted_at = NOW()<br>2. selection_status = 'NOT_SELECTED'<br>3. sales_status = 'ENDED'<br>4. price_additional_info.deleted_at 동기화
    DB-->>Action: 업데이트 성공

    Action->>DB: 불변 감사 로그 기록 (recordProductChangeLog)<br>section='삭제/복구', actionType='DELETE'
    DB-->>Action: 감사 로그 기록 완료

    Action->>Cache: revalidatePath('/portal/products') & ('/admin/products')
    Action-->>UI: { success: true }
    UI->>BrandUser: 목록에서 자동 제외 / Deleted 필터로 이동
```
