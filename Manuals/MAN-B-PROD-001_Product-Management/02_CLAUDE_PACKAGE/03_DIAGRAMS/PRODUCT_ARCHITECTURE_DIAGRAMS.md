# MAN-B-PROD-001: Product Architecture & Workflow Diagrams

**Document ID:** `MAN-B-PROD-001-DIA`  
**Topic:** 상품 등록 & 관리 / Product Registration & Management  
**Manual ID:** `MAN-B-PROD-001`  
**Audience:** `B — Brand`  
**Location:** `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/03_DIAGRAMS/`  

---

## 1. Diagram A: Product Registration Journey (전체 상품 라이프사이클)

사용자가 신규 상품을 등록하고, 상세 6대 탭 정보를 보완하여 등록 완료(`COMPLETE`) 후 K SELECT MD 검토 및 채널 판매로 이어지는 전체 엔드투엔드 여정입니다.

```mermaid
flowchart TD
    subgraph List["1. 상품 목록 화면 (/portal/products)"]
        L1["상품 목록 진입"] --> L2["'+ 새 제품 등록' 버튼 클릭"]
    end

    subgraph Phase1["2. Phase 1: 신규 상품 등록 (/portal/products/new)"]
        L2 --> P1["기본 정보 / 바코드 / 가격 / 채널 / 패키지 규격 입력"]
        P1 --> BRANCH{"제출 방식 선택"}
        BRANCH -->|"임시 저장 후 나중에 등록<br>(최소 4개 필수값 충족)"| DRAFT_SAVE["Draft 상품 생성<br>(/portal/products?saved=draft 이동)"]
        BRANCH -->|"제품 등록 및 계속<br>(정식 필수값 검증 완료)"| CONT_SAVE["정식 상품 레코드 생성<br>(/portal/products/[id] 로 즉시 이동)"]
    end

    subgraph Phase2["3. Phase 2: 상품 상세 관리 6대 탭 (/portal/products/[id])"]
        CONT_SAVE --> TABS["6대 전문 관리 탭"]
        DRAFT_SAVE -.->|"목록에서 선택하여 상세 진입"| TABS
        
        TABS --> T1["탭 1: 기본 정보 (Basic Info)"]
        TABS --> T2["탭 2: 카테고리 & 속성 (Category & Attributes)"]
        TABS --> T3["탭 3: 가격 정보 (Pricing Info)"]
        TABS --> T4["탭 4: 로지스틱스 3단계 규격 (Logistics Specs)"]
        TABS --> T5["탭 5: 미디어 (Media & Images)"]
        TABS --> T6["탭 6: 인허가 & 보증서 (Certificates & Documents)"]
    end

    subgraph Engine["4. 등록 완료 판정 엔진 (evaluateProductRegistrationStatus)"]
        T1 & T2 & T3 & T4 & T5 --> EVAL{"10대 필수 영역<br>완전성 평가"}
        EVAL -->|"누락 항목 존재"| STATUS_DRAFT["등록 상태: DRAFT (보완 대기)<br>상단 로즈색 배너 & 클릭 시 해당 필드 자동 포커스"]
        EVAL -->|"10개 영역 100% 충족"| STATUS_COMP["등록 상태: COMPLETE (등록 완료)"]
    end

    subgraph Review["5. K SELECT MD 검토 & 판매 운영 (Operations)"]
        STATUS_COMP --> MD_REV["K SELECT MD 검토 시작<br>(selection_status: UNREVIEWED → UNDER_REVIEW)"]
        MD_REV --> DECISION{"MD 선정 여부"}
        DECISION -->|"선정 승인 (SELECTED)"| ON_SALE["미국 온/오프라인 판매 준비 & 개시<br>(sales_status: PREPARING → ON_SALE)"]
        DECISION -->|"정보 요청 (INFO_REQUESTED)"| REQ_MORE["브랜드사에 서류/스펙 추가 요청"]
        REQ_MORE -.-> TABS
        DECISION -->|"미선정 (NOT_SELECTED)"| NOT_SEL["미선정 보관"]
    end
```

---

## 2. Diagram B: Product Detail Tabs Architecture (6대 전문 탭 아키텍처)

상품 상세 화면(`/portal/products/[id]`)에서 제공하는 6대 전문 관리 탭의 기능 구조도입니다.

```mermaid
graph TD
    ROOT["상품 상세 관리 시스템<br>/portal/products/[id]"]

    ROOT --> TAB1["탭 1: 기본 정보<br>(Basic Info)"]
    ROOT --> TAB2["탭 2: 카테고리 & 속성<br>(Category & Attributes)"]
    ROOT --> TAB3["탭 3: 가격 정보<br>(Pricing Info)"]
    ROOT --> TAB4["탭 4: 로지스틱스<br>(Logistics Specs)"]
    ROOT --> TAB5["탭 5: 미디어<br>(Media & Images)"]
    ROOT --> TAB6["탭 6: 인허가 & 보증서<br>(Certificates & Documents)"]

    TAB1 --> T1_1["국문 / 영문 제품명"]
    TAB1 --> T1_2["원산지, 용량, 납기(리드타임)"]
    TAB1 --> T1_3["식별 바코드 (UPC 12자리 / EAN 13자리)"]
    TAB1 --> T1_4["온라인 판매 링크 1, 2"]
    TAB1 --> T1_5["영문 불릿 포인트 (Bullet Points)"]
    TAB1 --> T1_6["전성분 텍스트 & 실시간 영문 번역기"]

    TAB2 --> T2_1["3-Depth 카테고리 선택기 (대 → 중 → 소)"]
    TAB2 --> T2_2["동의어 / 연관 검색어 자동 완성 사전"]
    TAB2 --> T2_3["공통 속성 (Common Scope)"]
    TAB2 --> T2_4["제품군 프로필 속성 (Profile Scope)"]
    TAB2 --> T2_5["필수 속성 실시간 완성도 지표"]

    TAB3 --> T3_1["4대 기준 가격 (KRW소비자가, FOB USD, MSRP USD, Retail USD)"]
    TAB3 --> T3_2["실시간 FOB 대비 MSRP 배수 산출 (MSRP ÷ FOB)"]
    TAB3 --> T3_3["실시간 FOB 마진율 및 공급 지표 산출"]
    TAB3 --> T3_4["수량별 B2B 공급 가격 (Tiered Pricing) 테이블"]

    TAB4 --> T4_1["Tier 1: 단품 본품 규격 (Unit W, D, H, Wt)"]
    TAB4 --> T4_2["Tier 2: 단품 포장 패키지 규격 (Package W, D, H, Wt, cm/inch, g/lb/oz)"]
    TAB4 --> T4_3["Tier 3: 마스터 카톤 규격 (Carton Pack Qty, W, D, H, Wt, CBM 자동연산)"]
    TAB4 --> T4_4["선적 시뮬레이터 (20FT=28CBM, 40FT=58CBM, 40HQ=68CBM)"]

    TAB5 --> T5_1["최대 5장 이미지 업로드 (최대 10MB/장)"]
    TAB5 --> T5_2["Position 0 대표 썸네일 자동 지정"]
    TAB5 --> T5_3["드래그 앤 드롭 순서 변경 & 실시간 DB 자동 저장"]
    TAB5 --> T5_4["고해상도 라이트박스 줌(Zoom) 뷰어"]
    TAB5 --> T5_5["홍보 동영상 연동 (URL / MP4 파일)"]

    TAB6 --> T6_1["국문 / 영문 전성분표 원본 파일 업로드"]
    TAB6 --> T6_2["상표권 / 시험성적서 / 인증 서류 자동 버전 관리 (v1, v2...)"]
```

---

## 3. Diagram C: Logistics 3-Tier Hierarchy (로지스틱스 3단계 규격 계층)

수출 물류와 컨테이너 적재 최적화를 위한 3계층 물리 규격 체계입니다.

```mermaid
flowchart LR
    subgraph Tier1["Tier 1: 단품 본품 (Unit Spec)"]
        U["포장재 없는 순수 제품 본품<br>• 가로 / 세로 / 높이 (mm/cm)<br>• 본품 순중량 (g)"]
    end

    subgraph Tier2["Tier 2: 단품 포장 패키지 (Package Spec)"]
        P["소비자 판매용 개별 단상자<br>• 가로 / 세로 / 높이 (cm ↔ inch)<br>• 총 포장 중량 (g ↔ lb ↔ oz)<br>• 바코드(UPC/EAN) 부착 단위"]
    end

    subgraph Tier3["Tier 3: 마스터 카톤 (Master Carton Spec)"]
        C["공장 출고 수출용 아웃박스<br>• 카톤 입수량 (Carton Pack Qty)<br>• 카톤 가로 / 세로 / 높이 (cm)<br>• 카톤 총중량 (kg)<br>• 카톤 CBM = (W×D×H)/1,000,000"]
    end

    subgraph Container["컨테이너 선적 시뮬레이션 (Container Loading)"]
        SIM["• 20FT 컨테이너: 기준 28 CBM<br>• 40FT 컨테이너: 기준 58 CBM<br>• 40HQ 컨테이너: 기준 68 CBM<br><br>👉 최대 카톤 수 / 총 제품 수 / 총 중량 자동 연산"]
    end

    Tier1 -->|"개별 박스 포장"| Tier2
    Tier2 -->|"N개 입수 포장"| Tier3
    Tier3 -->|"컨테이너 적재"| Container
```

---

## 4. Diagram D: 3 Independent Status Dimensions Matrix (3대 독립 상태 차원)

등록 상태, 선정 상태, 판매 상태의 상호 독립적인 상태 전이 매트릭스입니다.

```mermaid
stateDiagram-v2
    state "1. 등록 상태 (Registration Status)" as Reg {
        [*] --> DRAFT : 필수 항목 미비 또는 임시저장
        DRAFT --> COMPLETE : 10대 필수 영역 100% 충족
        COMPLETE --> DRAFT : 필수 필드 삭제 시 자동 강등
        DRAFT --> DELETED : 소프트 삭제
        COMPLETE --> DELETED : 소프트 삭제
    }

    state "2. 선정 상태 (Selection Status - MD 심사)" as Sel {
        [*] --> UNREVIEWED : COMPLETE 달성 후 자동 대기
        UNREVIEWED --> UNDER_REVIEW : MD 심사 착수
        UNDER_REVIEW --> INFO_REQUESTED : 브랜드사에 추가 보완 요청
        INFO_REQUESTED --> UNDER_REVIEW : 브랜드 보완 완료
        UNDER_REVIEW --> SELECTED : 수출/입점 승인
        UNDER_REVIEW --> NOT_SELECTED : 미선정 또는 보류
    }

    state "3. 판매 상태 (Sales Status - 유통 운영)" as Sale {
        [*] --> PREPARING : SELECTED 승인 후 선적/입고 준비
        PREPARING --> ON_SALE : 미국 온/오프라인 판매 개시
        ON_SALE --> PAUSED : 일시 품절 / 시즌 일시 중단
        PAUSED --> ON_SALE : 판매 재개
        ON_SALE --> ENDED : 상품 단종 / 계약 종료
        PAUSED --> ENDED : 상품 단종 / 계약 종료
    }
```
