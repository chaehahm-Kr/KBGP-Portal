# KNOWLEDGE & FAQ ARCHITECTURE DIAGRAMS: MAN-B-FAQ-001
## K SELECT Knowledge System Architecture, Workflows & Data Pipelines

- **Manual ID:** `MAN-B-FAQ-001`
- **Topic:** `Knowledge Center FAQ (도움말 센터, 자주 묻는 질문 및 지식 검색)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## Diagram 1: End-to-End Manual ↔ FAQ Governance Lifecycle

```mermaid
flowchart TD
    subgraph Phase1["1. Canonical Manual Finalization"]
        M1["Domain Codebase & DB Architecture"] --> M2["01_SOURCE Package Audit"]
        M2 --> M3["02_CLAUDE_PACKAGE Creation"]
        M3 --> M4["Official PDF Manual Finalized"]
    end

    subgraph Phase2["2. Knowledge Center Publishing"]
        M4 --> K1["Register to knowledge_items"]
        K1 --> K2["Bind PDF Document & Category (PUBLISHED)"]
    end

    subgraph Phase3["3. FAQ Generation & Review"]
        K2 --> F1["Draft FAQs Grounded 1:1 in Manual Chapters"]
        F1 --> F2["Admin Review (/admin/knowledge/topics-faq)"]
        F2 --> F3["Review Status: APPROVED & Set is_featured"]
    end

    subgraph Phase4["4. Production Discovery & Search"]
        F3 --> S1["Save to DB (knowledge_faqs) & In-Memory Store"]
        S1 --> S2["Help Center Topic Accordion (/portal/help)"]
        S1 --> S3["Search Engine Multi-Tier Matching (lib/knowledge/search.ts)"]
        S1 --> S4["Ask K SELECT Grounded Citation (/api/knowledge/ask)"]
    end
```

---

## Diagram 2: 12-Domain Ownership & Cross-Domain Isolation Matrix

```mermaid
graph TD
    subgraph Core6["Published FAQ Domains (63 Active FAQs)"]
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

---

## Diagram 3: Help Center User Inquiry & Navigation Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Brand Portal User
    participant HelpUI as /portal/help (HelpCenterMainView)
    participant TopicView as Topic Detail & Accordion
    participant AskEngine as /api/knowledge/ask
    participant SupportUI as /portal/support (Support Desk)

    User->>HelpUI: Access Help Center (/portal/help)
    HelpUI-->>User: Render Hero Search + 6 Topic Cards + 26 Featured FAQs

    alt Scenario A: Topic-based Exploration
        User->>TopicView: Click Topic Card (e.g. topic-orders)
        TopicView-->>User: Expand 12 Order FAQs in Accordion
        User->>TopicView: Click Question -> Read Grounded Answer
    else Scenario B: Natural Language Ask Engine
        User->>HelpUI: Type Natural Language Question in Search Bar
        HelpUI->>AskEngine: POST /api/knowledge/ask (query, audience="BRAND")
        AskEngine-->>HelpUI: Return Grounded Direct Answer + Source Citations
        HelpUI-->>User: Render Direct Answer Card & Source Links
    else Scenario C: Unresolved Issue Escalation
        User->>HelpUI: Click [1:1 문의하기] CTA Button
        HelpUI->>HelpUI: Save 'kselect_support_handoff' Context to SessionStorage
        HelpUI->>SupportUI: Redirect to /portal/support
        SupportUI-->>User: Pre-populate Inquiry Form with Search Question Context
    end
```

---

## Diagram 4: Search Engine Multi-Tier Scoring & Matching Pipeline

```mermaid
flowchart TD
    Q["Raw User Query (e.g. '발주 수정 규정')"] --> N["Query Normalizer (lowercase, trim, strip special chars)"]
    N --> A["Alias & Synonym Expander (ALIAS_DICTIONARY)"]
    A --> P["Security & Audience Gate (Audience: BRAND, Status: PUBLISHED)"]
    
    P --> S_Intent["Intent Pattern Boost (+120 / +150 score)"]
    P --> S_Canonical["Canonical Term Match (Title +80, Type +70, Category +50, Tag +60)"]
    P --> S_Token["Expanded Token Match (Title +40, Tag +35, Summary +20, Content +10)"]
    P --> S_Fuzzy["Fuzzy String Match (Levenshtein distance <= 2 -> +50)"]
    P --> S_Type["Content Hierarchy Priority (MANUAL +20, SOP +15, POLICY +15, FAQ +10)"]

    S_Intent & S_Canonical & S_Token & S_Fuzzy & S_Type --> R["Aggregated Score Calculation"]
    R --> O["Sort by Score DESC & is_featured Priority"]
    O --> Out["Final Search Result List & Suggestions"]
```

---

## Diagram 5: 1:1 Support Ticket Escalation Handoff Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Brand Portal User
    participant Browser as Browser Client
    participant Session as SessionStorage
    participant SupportDesk as /portal/support (1:1 Desk)
    actor Admin as K SELECT Support Staff

    User->>Browser: Submit Question in Help Center ("발주 수량 변경 및 납기 연장 요청")
    Browser->>Browser: Generate Ask Answer / No Direct Solution
    User->>Browser: Click [1:1 문의하기] Handoff Button
    Browser->>Session: setItem('kselect_support_handoff', JSON.stringify({ question, askResult, sources }))
    Browser->>SupportDesk: Navigate to /portal/support?new=1&category=po_change
    SupportDesk->>Session: getItem('kselect_support_handoff')
    SupportDesk-->>User: Render Pre-filled Title & Description Modal
    User->>SupportDesk: Attach Files & Submit Case
    SupportDesk-->>Admin: Case Created with Complete Inquiry Context
```

---
*End of KNOWLEDGE_FAQ_ARCHITECTURE_DIAGRAMS.md*
