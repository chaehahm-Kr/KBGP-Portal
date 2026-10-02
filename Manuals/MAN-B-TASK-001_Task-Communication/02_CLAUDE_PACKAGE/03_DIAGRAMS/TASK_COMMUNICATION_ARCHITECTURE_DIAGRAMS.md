# TASK & COMMUNICATION ARCHITECTURE DIAGRAMS: MAN-B-TASK-001
## K SELECT System Architecture, Workflows & Data Pipelines

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## Diagram 1: Two Distinct Task Domains (Operational Routing vs Dynamic Cases)

```mermaid
graph TD
    subgraph DomainA["Domain A: Company Operational Contact Routing (MAN-B-PERM-001)"]
        direction TB
        A1["Table: company_task_assignments"] --> A2["Static 6 Primary Task Owners"]
        A2 --> A3["1. company_apply (회사/신청)"]
        A2 --> A4["2. contract (계약)"]
        A2 --> A5["3. product_cert (제품/인증)"]
        A2 --> A6["4. pricing_quote (가격/견적)"]
        A2 --> A7["5. logistics_inventory (물류/재고)"]
        A2 --> A8["6. settlement_inquiry (정산/문의)"]
        style DomainA fill:#f8fafc,stroke:#64748b,stroke-width:1.5px
    end

    subgraph DomainB["Domain B: 1:1 Dynamic Case Communication (MAN-B-TASK-001)"]
        direction TB
        B1["Table: partner_inquiries"] --> B2["Dynamic Business Case Tickets"]
        B2 --> B3["Table: partner_inquiry_messages"]
        B3 --> B4["Two-Way Discussion Thread"]
        B3 --> B5["Action Required Flags & Supplements"]
        B3 --> B6["Resolution, Closure & CSAT"]
        style DomainB fill:#eef2ff,stroke:#6366f1,stroke-width:2px
    end

    subgraph DomainC["System Gap Note: Early Admin Tasks (public.tasks)"]
        C1["Unlinked Admin Internal Mock Schema<br/>(No Brand Portal Interaction)"]
        style DomainC fill:#fafafa,stroke:#d4d4d8,stroke-dasharray: 5 5
    end

    A1 -. "Independent Schemas" .- B1
    B1 -. "No Direct Link / Unlinked" .- C1
```

---

## Diagram 2: Case Status Normalization Matrix (10 DB Enums → 4 Presentation States)

```mermaid
flowchart LR
    subgraph DBEnums["Internal Database Statuses (partner_inquiries.status)"]
        direction TB
        D1["open"]
        D2["pending"]
        D3["in_review"]
        D4["replied"]
        D5["processing"]
        D6["under_review"]
        D7["action_resolved"]
        D8["awaiting_reply"]
        D9["reopened"]
        D10["action_required"]
        D11["closed"]
        D12["resolved"]
    end

    subgraph Normalizer["getNormalizedStatus() Mapping Engine"]
        direction TB
        N1["Map to RECEIVED"]
        N2["Map to UNDER_REVIEW"]
        N3["Map to ACTION_REQUIRED"]
        N4["Map to CLOSED"]
    end

    subgraph UIStates["4 Official Presentation States (Brand Portal UI)"]
        direction TB
        U1["🟡 RECEIVED (접수됨)"]
        U2["🔵 UNDER_REVIEW (검토중)"]
        U3["🔴 ACTION_REQUIRED (조치필요)"]
        U4["⚫ CLOSED (종료됨)"]
    end

    D1 & D2 --> N1 --> U1
    D3 & D4 & D5 & D6 & D7 & D8 & D9 --> N2 --> U2
    D10 --> N3 --> U3
    D11 & D12 --> N4 --> U4

    style U1 fill:#fef3c7,stroke:#f59e0b,stroke-width:1.5px
    style U2 fill:#dbeafe,stroke:#3b82f6,stroke-width:1.5px
    style U3 fill:#ffe4e6,stroke:#f43f5e,stroke-width:2px
    style U4 fill:#f4f4f5,stroke:#71717a,stroke-width:1.5px
```

---

## Diagram 3: End-to-End Inquiry & Case Communication Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor BrandUser as Brand Portal User (support:write)
    participant PortalUI as Brand Portal UI (/portal/support)
    participant ServerAction as Server Actions (lib/inquiry/actions.ts)
    participant DB as PostgreSQL DB (partner_inquiries)
    participant Storage as Supabase Storage (company-uploads)
    actor AdminStaff as K SELECT Admin Staff

    BrandUser->>PortalUI: Open [+ New Inquiry] & Fill Form
    BrandUser->>PortalUI: Attach File (PNG/JPEG/PDF ≤ 20MB)
    PortalUI->>Storage: Upload to ${companyId}/inquiries/...
    PortalUI->>ServerAction: createPartnerInquiry(data, attachmentPath)
    ServerAction->>DB: INSERT INTO partner_inquiries (status='open')
    DB-->>PortalUI: Case Created (CASE-2026-XXXX)
    Note over PortalUI,DB: In-App Event 1: New Inquiry Notification Dispatched

    AdminStaff->>DB: Admin Reads & Assigns Case (status='under_review')
    AdminStaff->>DB: Admin Replies (INSERT INTO partner_inquiry_messages)
    DB-->>PortalUI: In-App Event 2: Admin Reply Notification Dispatched

    BrandUser->>PortalUI: View Thread & Reply / Close Case
    BrandUser->>ServerAction: closeCase(inquiryId) / submitSatisfactionRating(score)
    ServerAction->>DB: UPDATE partner_inquiries (status='closed', satisfaction_score=5)
    DB-->>PortalUI: Case Closed UI & In-App Event 5 & 6 (Closed / CSAT Logged)
```

---

## Diagram 4: Action Required Escalation & Resolution Flow

```mermaid
stateDiagram-v2
    [*] --> RECEIVED: New Inquiry Created (Event 1)
    RECEIVED --> UNDER_REVIEW: Admin Reviews Case

    UNDER_REVIEW --> ACTION_REQUIRED: Admin Flag: isActionRequired = true (Event 3)
    note right of ACTION_REQUIRED
        • Rose Badge Highlight
        • In-App Event 3: Action Required Generated
        • Transactional Email Sent (Condition: isActionRequired && sendEmail)
    end note

    ACTION_REQUIRED --> UNDER_REVIEW: Brand User Submits Supplement Reply (Event 4)
    note left of UNDER_REVIEW
        • Automatic state transition to UNDER_REVIEW
        • In-App Event 4: Action Resolved sent to Admin
    end note

    UNDER_REVIEW --> CLOSED: Admin or Brand User Closes Case (Event 5)
    CLOSED --> [*]: CSAT Submitted (Event 6)
```

---

## Diagram 5: Cross-Domain Deep Linking Inflow (PO FK vs Context Prefill)

```mermaid
graph TD
    subgraph OutboundPages["Brand Portal Outbound Workspaces"]
        PO["/portal/orders/[id]<br/>PO Details"]
        SETTLE["/portal/settlement<br/>Settlement Invoices"]
        AGREE["/portal/agreements<br/>Agreements & Contracts"]
    end

    subgraph DeepLinkParams["URL Parameter Engine"]
        P1["?new=1&category=po_change&po_id=...&po_no=PO-2026-XXXX"]
        P2["?new=1&category=settlement&ap_no=AP-2026-XXXX"]
        P3["?new=1&category=agreement_change&agreement_id=..."]
    end

    subgraph InflowHandler["/portal/support Modal Prefill Engine"]
        M1["Auto-Select Category: po_change<br/>Auto-Bind DB FK: related_po_id"]
        M2["Auto-Select Category: settlement<br/>Context Prefill (No DB FK): [AP-XXXX] Settlement Inquiry"]
        M3["Auto-Select Category: agreement_change<br/>Context Prefill (No DB FK): Contract Amendment Context"]
    end

    PO --> P1 --> M1
    SETTLE --> P2 --> M2
    AGREE --> P3 --> M3

    M1 & M2 & M3 --> TargetCase["partner_inquiries DB Record"]
```

---

## Diagram 6: Multi-Tenant ACL & Notification Fan-Out Pipeline

```mermaid
flowchart TD
    subgraph UserRequest["Incoming Support Action Request"]
        REQ["User Request: /portal/support"]
    end

    subgraph AuthLayer["Multi-Tenant ACL Verification"]
        AUTH1["requireCompanyMembership()"]
        AUTH2["Check support category ACL level"]
        AUTH1 --> AUTH2
    end

    subgraph AccessDecision["ACL Level Gate"]
        L0["Level 0 (none) --> AccessDeniedView (SCR-B-TASK-010)"]
        L1["Level 1 (read) --> Read-Only View (SCR-B-TASK-009)"]
        L2["Level 2 (write) --> Create / Reply / Resolve Actions Allowed"]
        L3["Level 3 (manage) --> All Write + closeCase() Allowed"]
    end

    subgraph NotificationDispatch["6 Canonical In-App Notification Events & Conditional Email"]
        N_EVENTS["1. New Inquiry<br/>2. Admin Reply<br/>3. Action Required<br/>4. Action Resolved<br/>5. Case Closed<br/>6. CSAT Submission"]
        N_INAPP["Create In-App Notification (public.notifications)"]
        N_READ["Independent User Read Tracking via read_notification_ids"]
        N_EMAIL["Transactional Email via Resend<br/>(Strictly Conditional: isActionRequired && sendEmail, or Admin Case Email)"]
    end

    REQ --> AuthLayer
    AUTH2 --> L0 & L1 & L2 & L3
    L2 & L3 --> NotificationDispatch
    N_EVENTS --> N_INAPP --> N_READ
    N_EVENTS --> N_EMAIL
```

---

## Diagram 7: Attachment Upload & Signed URL Security Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Brand User
    participant Client as Browser (Next.js Client)
    participant Storage as Supabase Private Storage ("company-uploads")
    participant API as Server Action (getSignedFileUrl)
    participant DB as PostgreSQL DB

    User->>Client: Select File (e.g. invoice.pdf, max 20MB)
    Client->>Client: Client MIME & Size Validation (PNG, JPEG, WEBP, PDF)
    Client->>Storage: Upload to ${companyId}/inquiries/${uuid}.${ext}
    Client->>DB: Save attachment_path in partner_inquiries or partner_inquiry_messages

    Note over User,Storage: Download Workflow via Time-Limited Signed URL
    User->>Client: Click Attachment Download Link
    Client->>API: Request Signed URL for attachment_path
    API->>API: Verify User Company Isolation (Tenant Match)
    API->>Storage: getSignedUrl("company-uploads", path, expiresIn=3600)
    Storage-->>API: Return Temporary HTTPS Signed URL
    API-->>Client: Return Signed URL
    Client-->>User: Secure Direct File Download
```

---
*End of TASK_COMMUNICATION_ARCHITECTURE_DIAGRAMS.md*
