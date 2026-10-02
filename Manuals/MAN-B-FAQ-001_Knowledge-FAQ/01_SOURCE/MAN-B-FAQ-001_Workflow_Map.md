# MAN-B-FAQ-001: Knowledge Center FAQ Workflow Map & Domain Boundary Matrix

- **문서 번호:** `MAN-B-FAQ-001-WFM-001-R1`  
- **문서 명칭:** FAQ System Lifecycle Workflows & Cross-Domain Isolation Matrix  
- **작성 일자:** 2026-10-02  
- **적용 대상:** K SELECT 12대 업무 도메인 (BRAND, ONB, PROD, REG, RET, ORD, LOG, FIN, PERM, TASK, RPT, INT)  

---

## 1. 매뉴얼 ↔ FAQ 거버넌스 생명주기 (Manual-to-FAQ Lifecycle)

K SELECT 전체 지식 시스템에서 각 FAQ는 독립된 임의 정책이 아니며, 오직 **단 하나의 Authoritative Knowledge Item(발행 정본 매뉴얼)**에 귀속됩니다.

```mermaid
flowchart TD
    subgraph Phase1["1. Canonical Manual Creation"]
        M1["Authoritative Domain Code & DB"] --> M2["01_SOURCE Package Creation"]
        M2 --> M3["02_CLAUDE_PACKAGE Creation"]
        M3 --> M4["Final Official PDF Manual Finalized"]
    end

    subgraph Phase2["2. Knowledge Center Publishing"]
        M4 --> K1["Register Knowledge Item (knowledge_items)"]
        K1 --> K2["Bind PDF Asset & Category (PUBLISHED)"]
    end

    subgraph Phase3["3. FAQ Generation & Review"]
        K2 --> F1["Draft FAQs Grounded 1:1 in Manual Chapters"]
        F1 --> F2["Admin Review (topics-faq console)"]
        F2 --> F3["Review Status: APPROVED / is_featured Flagged"]
    end

    subgraph Phase4["4. Production Discovery & Search"]
        F3 --> S1["Save to DB (knowledge_faqs) & In-Memory Store"]
        S1 --> S2["Help Center Topic Accordion (/portal/help)"]
        S1 --> S3["Search Engine Multi-Tier Matching (lib/knowledge/search.ts)"]
        S1 --> S4["Ask K SELECT Grounded Citation (/api/knowledge/ask)"]
    end
```

---

## 2. 12대 도메인 경계 및 비즈니스 격리 매트릭스 (12-Domain Boundary Matrix)

```mermaid
graph TD
    subgraph Core6["Published FAQ Domains (63 FAQs Active)"]
        BRAND["BRAND (MAN-BRAND-001)<br/>5 FAQs / topic-brand"]
        ONB["ONBOARDING (MAN-B-ONB-001)<br/>9 FAQs / topic-start"]
        PROD["PRODUCTS (MAN-B-PROD-001)<br/>14 FAQs / topic-product"]
        REG["REGULATORY (MAN-B-REG-001)<br/>12 FAQs / topic-regulatory"]
        RET["RETAIL (MAN-B-RET-001)<br/>11 FAQs / topic-retail"]
        ORD["ORDERS (MAN-B-ORD-001)<br/>12 FAQs / topic-orders"]
    end

    subgraph Pending6["Pending FAQ Domains (0 FAQs Published)"]
        LOG["LOGISTICS (MAN-B-LOG-001)<br/>0 FAQs (Pending Publication)"]
        FIN["FINANCE (MAN-B-FIN-001)<br/>0 FAQs (Pending Publication)"]
        PERM["PERMISSIONS (MAN-B-PERM-001)<br/>0 FAQs (Pending Publication)"]
        TASK["COMMUNICATION (MAN-B-TASK-001)<br/>0 FAQs (Pending Publication)"]
        RPT["REPORTS (MAN-B-RPT-001)<br/>0 FAQs (Pending Publication)"]
        INT["INTELLIGENCE (MAN-B-INT-001)<br/>0 FAQs (Pending Publication)"]
    end

    RET -. "Approval ≠ Auto PO" .- ORD
    ORD -. "Confirmed ≠ Warehouse Shipped" .- LOG
    LOG -. "Arrived ≠ Received" .- FIN
    FIN -. "Shipped ≠ Settlement Paid" .- Core6
    PERM -. "Contact Tasks ≠ Case Tickets" .- TASK
```

### 2.1 핵심 비즈니스 경계 수식 (Authoritative Boundary Formulas)

1. **`Retail Application Approval ≠ Automatic Purchase Order Creation`**:
   - 리테일러 입점 신청 승인은 바이어의 상품 취급 승인 결과이며, 발주(PO)를 자동으로 생성하거나 시작하지 않습니다. 발주는 `MAN-B-ORD-001`의 독립 절차로 생성됩니다.
2. **`ARRIVED ≠ RECEIVED ≠ COMPLETED ≠ PAID`**:
   - 물류 센터 도착(`ARRIVED`)은 입고 검수 완료(`RECEIVED`)가 아니며, 대금 정산(`COMPLETED / PAID`)과 명확히 구분됩니다.
3. **`Shipping Complete ≠ Settlement Complete`**:
   - 상품 출고 완료가 즉시 대금 지급을 의미하지 않으며, 정산 주기 및 매입전표(AP) 대조 과정을 거쳐야 합니다.
4. **`협의 필요 ≠ Rejection`**:
   - 리테일러의 '협의 필요' 피드백은 조건부 협의 요청이며 영구 반려(Reject)가 아닙니다.
5. **`PERM Operational Task Assignment ≠ TASK Support Case`**:
   - `company_task_assignments`의 6대 주 담당자 배정은 정적 라우팅이며, `partner_inquiries`의 동적 1:1 케이스 티켓과 독립적으로 동작합니다.
6. **`AI INCI Translation ≠ Regulatory Certificate Upload`**:
   - AI 영문 성분표 번역은 규제 서류 제출(MoCRA, FDA 시설등록)을 대체할 수 없습니다.
7. **`Barcode Validation ≠ Regulatory Approval`**:
   - 바코드 포맷 유효성 검증과 수출 인허가 승인은 별개의 검증 단계입니다.

---

## 3. 브랜드 포털 헬프센터 사용자 탐색 및 질의 워크플로우 (Help Center User Flow)

```mermaid
sequenceDiagram
    autonumber
    actor User as Brand Portal User
    participant HelpUI as /portal/help (HelpCenterMainView)
    participant TopicView as Topic Detail & Accordion
    participant AskEngine as /api/knowledge/ask
    participant SupportUI as /portal/support (Support Desk)

    User->>HelpUI: Access Help Center (/portal/help)
    HelpUI-->>User: Display Hero Search + 6 Topic Grid + 26 Featured FAQs

    alt Scenario A: Topic-based Navigation
        User->>TopicView: Click Topic Card (e.g. topic-orders)
        TopicView-->>User: Expand 12 Order FAQs Accordion
        User->>TopicView: Click Question -> Read Grounded Answer
    else Scenario B: Natural Language Ask / Search
        User->>HelpUI: Type Question in Hero Search Bar
        HelpUI->>AskEngine: POST /api/knowledge/ask (query, audience="BRAND")
        AskEngine-->>HelpUI: Return Grounded Direct Answer + Source Citations
        HelpUI-->>User: Render Direct Answer Box & Related Manual Links
    else Scenario C: Unresolved Issue Escalation
        User->>HelpUI: Click [1:1 문의하기] CTA
        HelpUI->>HelpUI: Save 'kselect_support_handoff' to SessionStorage
        HelpUI->>SupportUI: Redirect to /portal/support
        SupportUI-->>User: Open Support Desk with Pre-populated Question Context
    end
```

---

## 4. 검색 엔진 매칭 및 스코어링 파이프라인 (Search Pipeline Architecture)

```mermaid
flowchart TD
    Q["Raw User Query (e.g. '발주 수정 규정')"] --> N["Query Normalizer (lowercase, trim, strip special chars)"]
    N --> A["Alias & Synonym Expander (ALIAS_DICTIONARY: order, purchase order, po, 발주)"]
    A --> P["Security Filtering (Audience: BRAND, Status: PUBLISHED)"]
    
    P --> S_Intent["Intent Pattern Matching (+120 / +150 boost)"]
    P --> S_Canonical["Canonical Term Match (Title +80, Type +70, Category +50, Tag +60)"]
    P --> S_Token["Expanded Token Match (Title +40, Tag +35, Summary +20, Content +10)"]
    P --> S_Fuzzy["Levenshtein Distance Match (distance <= 2 -> +50)"]
    P --> S_Type["Content Hierarchy Priority (MANUAL +20, SOP +15, POLICY +15, FAQ +10)"]

    S_Intent & S_Canonical & S_Token & S_Fuzzy & S_Type --> R["Aggregated Score Calculation"]
    R --> O["Sort by Score DESC & is_featured Priority"]
    O --> Out["Final Search Result List & Suggestions"]
```

---
*End of MAN-B-FAQ-001_Workflow_Map.md*
