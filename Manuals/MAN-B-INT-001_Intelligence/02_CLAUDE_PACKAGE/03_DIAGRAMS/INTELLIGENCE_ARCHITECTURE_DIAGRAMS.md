# MAN-B-INT-001 — Intelligence & Insights Architecture Diagrams
## Production Architecture, Data Flows, Quota Rules & Security Guardrails

---

## Diagram 1: Three-Surface Intelligence Architecture Overview

```mermaid
flowchart TD
    subgraph BrandPortal["Brand Portal Surface (portal.kselectnetwork.com)"]
        A["Brand User"] -->|Navigate| B["/portal/help/ask (Grounded Knowledge Assistant)"]
        B -->|Query| C["Deterministic Matching Engine (lib/knowledge/ask-engine.ts)"]
        C -->|Cite| D["Published Knowledge Articles (knowledge_articles, is_published=true)"]
    end

    subgraph AutoEngine["Auto-Engine Pipeline (lib/insights/auto-engine/*)"]
        E["Cron 05:00 ET"] --> F["Market Researcher (Live HTTP Scan: FDA/USITC/Customs)"]
        F --> G["Topic Evaluator (Score 0-100 on 6 Weights)"]
        G --> H["Quota Manager (NETWORK 3 + HUB 3 Target)"]
        H --> I["Claim Risk Auditor & Safe Downgrades"]
        I --> J["Draft Generator (status = 'AI_DRAFT')"]
    end

    subgraph AdminEditorial["Admin Editorial Control Center (/admin/insights/*)"]
        J --> K["Moderation Queue (/admin/insights/queue)"]
        K -->|Human Review| L["Article Editor (/admin/insights/[id])"]
        L -->|Manual Approve| M["Status: PUBLISHED (Live to Network & Hub)"]
        M --> N["Reader Feedback (/api/insights/feedback)"]
        N -->|HMAC Deduplication| O["insights_reader_feedback"]
        O -->|Analytics| L
    end

    subgraph OperationalBoundary["Operational Reporting Boundary (RPT / ONB Domain)"]
        P["/portal Dashboard"] -->|Deterministic SQL| Q["Products, POs, Invoices, Inquiries"]
        note["Excluded from Intelligence Domain"]
    end
```

---

## Diagram 2: Grounded Knowledge Assistant Request Flow & Security Guardrails

```mermaid
sequenceDiagram
    autonumber
    actor BrandUser as Brand User
    participant View as AskKSelectView (/portal/help/ask)
    participant API as API Route (/api/knowledge/ask)
    participant Engine as Ask Engine (lib/knowledge/ask-engine.ts)
    participant DB as Knowledge DB (knowledge_articles)

    BrandUser->>View: Enter Policy Question (e.g. "Brand deletion rule?")
    View->>API: POST /api/knowledge/ask { question, audience: 'BRAND' }
    API->>Engine: Resolve Server Audience & Validate Context
    Engine->>Engine: 1. Prompt Injection & Security Check
    Engine->>Engine: 2. General Out-of-Scope Filter
    Engine->>Engine: 3. Read-Only Mutation Check
    Engine->>DB: Query eligible items (is_published = true, audience = BRAND)
    DB-->>Engine: Return published knowledge items
    Engine->>Engine: Deterministic Token, Tag & Intent Matching (Score >= 50)
    alt Candidate Found (Score >= 50)
        Engine->>Engine: Build Grounded Markdown Answer + Rule Bullets + Citations
        Engine-->>API: 200 OK (directAnswer, sources, actions, isUnknown: false)
    else Insufficient Evidence / No Match
        Engine-->>API: 200 OK (No Fabrication Notice + Support Link, isUnknown: true)
    end
    API-->>View: JSON Response
    View-->>BrandUser: Render Answer, Policy Bullets, Source Cards & Support Links
```

---

## Diagram 3: Auto-Engine 4-Stage Pipeline & 3+3 Quota Rule

```mermaid
flowchart LR
    subgraph Stage1["1. Live Market Research"]
        A1["FDA MoCRA Portal"] & A2["USITC Trade Matrix"] & A3["Korea Customs Stats"] & A4["Retail Trade Feeds"] --> B["Accepted Sources (Tier A/B/C/SIGNAL)"]
        B --> C["Generate Topic Candidates"]
    end

    subgraph Stage2["2. Topic Evaluation"]
        C --> D["Evaluate 6 Weights (0-100)"]
        D --> E{"Topic Score >= 80 & 5 Conditions PASS?"}
        E -->|NO| F["Critical Reject (Logged)"]
        E -->|YES| G["Qualified Candidates Pool"]
    end

    subgraph Stage3["3. Quota Management"]
        G --> H["Allocate Channels"]
        H --> I["Target: NETWORK 3 Drafts"]
        H --> J["Target: HUB 3 Drafts"]
        H --> K["Shared Core Topics (Both Channels)"]
        H --> L{"Channel < 3?"}
        L -->|YES| M["2nd-Pass Research Triggered"]
        M --> G
    end

    subgraph Stage4["4. Draft & Quality Audit"]
        I & J & K --> N["Claim Risk Audit & Safe Downgrades"]
        N --> O["Generate Dual-Language Drafts (KO/EN)"]
        O --> P["Save insights_articles (status = 'AI_DRAFT')"]
    end
```

---

## Diagram 4: 6-Weight Topic Scoring Architecture

```mermaid
pie title 6-Weight Topic Scoring Distribution (Max 100 Points)
    "Audience Relevance (25)" : 25
    "Actionability & Impact (25)" : 25
    "Evidence Strength (20)" : 20
    "Timeliness & Urgency (15)" : 15
    "Originality & Depth (10)" : 10
    "Strategic Fit (5)" : 5
```

---

## Diagram 5: Claim Risk Auditing & Safe Downgrade Flow

```mermaid
flowchart TD
    A["Raw Extracted Claims"] --> B{"Classify Claim Risk"}
    
    B -->|HIGH: Regulatory, %, $, Profit Guarantee| C{"Check Source Tier"}
    C -->|Tier A (Gov) or Tier B (Media)| D["Status: VERIFIED / Risk: HIGH / Action: PASS"]
    C -->|Tier C or Signal| E["Action: DOWNGRADE / Status: SIGNAL"]
    E --> F["Safe Phrasing: Convert to Moderated Tone ('Signals suggest...')"]

    B -->|MEDIUM: Market Trend, Category Surge| G{"Check Signal Source"}
    G -->|Tier B Media| H["Status: VERIFIED / Risk: MEDIUM / Action: PASS"]
    G -->|Search/Social Signal| I["Status: SIGNAL / Risk: MEDIUM / Action: DOWNGRADE"]

    B -->|LOW: K SELECT Advice, Checklist| J["Status: INTERNAL / Risk: LOW / Action: PASS"]

    D & F & H & I & J --> K["Check Universal Critical Failures (Fabricated URL, False FDA Approval)"]
    K -->|Detected| L["fact_check_status = 'NEEDS_ATTENTION'"]
    K -->|Clean| M["fact_check_status = 'PASS'"]

    L & M --> N["Assemble 4 Content Layers (market_facts, market_signals, k_select_views, k_select_actions)"]
```

---

## Diagram 6: Editorial Moderation & Mandatory Human Approval Gate

```mermaid
stateDiagram-v2
    [*] --> AI_DRAFT: Auto-Engine Generated
    AI_DRAFT --> IN_REVIEW: Editor Opens in /admin/insights/[id]
    
    state IN_REVIEW {
        [*] --> InspectRiskSummary: Check High/Med/Low Claims
        InspectRiskSummary --> ReviewContentLayers: Fact vs Signal vs View
        ReviewContentLayers --> EditMetadata: Edit Categories, Authors, Featured
    }

    IN_REVIEW --> REVISION_REQUESTED: Record insights_revision_requests
    REVISION_REQUESTED --> IN_REVIEW: Editor Re-audits & Updates Text
    
    IN_REVIEW --> PUBLISHED: Editor Clicks [Publish Article]
    PUBLISHED --> ARCHIVED: Deprecated / Superseded

    note right of AI_DRAFT
        Mandatory Human Gate:
        auto_publish = false
        No automatic external release
    end note
```

---

## Diagram 7: Reader Usefulness Feedback Collection & HMAC Deduplication

```mermaid
flowchart LR
    A["Reader Clicks [Helpful 👍] or [Not Helpful 👎]"] --> B["POST /api/insights/feedback"]
    B --> C["Server Reads INSIGHTS_FEEDBACK_HASH_SECRET"]
    C --> D["Generate One-Way HMAC-SHA256 (IP + UserAgent + ArticleId)"]
    D --> E{"Check client_hash in Last 24 Hours"}
    E -->|Exists| F["Return 200 (Duplicate Ignored, Thank you)"]
    E -->|New| G["Insert insights_reader_feedback (article_id, feedback, client_hash)"]
    G --> H["Aggregated Useful Rate (%) Displayed on /admin/insights/[id]"]
    
    note2["Strict Boundary: Feedback does NOT retrain AI models automatically"]
```

---
*End of INTELLIGENCE_ARCHITECTURE_DIAGRAMS.md*
