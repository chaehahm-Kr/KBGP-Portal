# K SELECT Manual Design Package: MAN-B-ORD-001

## Package Overview

| Attribute | Specification |
| :--- | :--- |
| **Manual ID** | `MAN-B-ORD-001` |
| **Manual Title (EN)** | Brand Portal Purchase Orders & Order Management Guide |
| **Manual Title (KO)** | 브랜드 포털 발주 요청 & 오더 관리 공식 가이드 |
| **Audience** | `B — Brand Portal User` (Brand Owner, Operations / Logistics Manager, Finance Team) |
| **Topic Category** | `topic-orders` (발주 요청 & 오더 / Purchase Orders & Order Management) |
| **Topic Sequence** | Order 6 (Follows `topic-retail` / `MAN-B-RET-001`) |
| **Visual Design Standard** | **`MAN-BRAND-001 Brand Policy.pdf`** (Authoritative Master Style Reference) |
| **Content Source of Truth** | `01_SOURCE` & `01_CONTENT/MAN-B-ORD-001_Manual_Content.md` |
| **Current Status** | `PACKAGE CREATED — READY FOR CHATGPT PACKAGE QA & CHAE EXPLORER CONFIRMATION` |

---

## Package Directory Structure

```text
MAN-B-ORD-001_Order-Management/
└── 02_CLAUDE_PACKAGE/
    ├── PACKAGE_README.md                                 # Package overview & manifest
    ├── CLAUDE_DESIGN_MASTER_PROMPT.md                    # Detailed Claude Design prompts & styling rules
    ├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                   # Concise copy-paste prompt for Claude Handoff session
    ├── MAN-B-ORD-001_Design_Structure.md                 # Page-by-page layout & visual composition blueprint
    │
    ├── 01_CONTENT/
    │   └── MAN-B-ORD-001_Manual_Content.md               # 100% Production-Grounded Manual Content & FAQ
    │
    ├── 02_SCREENSHOTS/
    │   ├── SCREENSHOT_ANNOTATION_GUIDE.md                # Annotation & mapping guide for production screenshots
    │   ├── SCR-B-ORD-001.png                             # PO Request List View (/portal/orders/requests)
    │   ├── SCR-B-ORD-002.png                             # New PO Request Form Header (/portal/orders/requests/new)
    │   ├── SCR-B-ORD-003.png                             # Product Selection Modal & FOB Tiers
    │   ├── SCR-B-ORD-004.png                             # PO Request Summary & Submission
    │   ├── SCR-B-ORD-005.png                             # PO Request Detail & Change Requested Banner
    │   ├── SCR-B-ORD-006.png                             # PO Request Converted to PO View
    │   ├── SCR-B-ORD-007.png                             # Official PO List View (/portal/orders/purchase-orders)
    │   ├── SCR-B-ORD-008.png                             # Official PO Detail Overview & Confirmation Action
    │   ├── SCR-B-ORD-009.png                             # PO Detail Item Flow & Variance Table
    │   ├── SCR-B-ORD-010.png                             # Shipments Tab & Goods Ready Entry
    │   ├── SCR-B-ORD-011.png                             # Goods Ready Registration Modal
    │   ├── SCR-B-ORD-012.png                             # Forwarder Handover & Supplier Arranged Shipment Form
    │   ├── SCR-B-ORD-013.png                             # Warehouse Receiving & Inspection Tab
    │   ├── SCR-B-ORD-014.png                             # PO Documents Management Tab
    │   └── SCR-B-ORD-015.png                             # Global Shipping & Inbound Hub (/portal/orders/shipping)
    │
    ├── 03_DIAGRAMS/
    │   └── ORDER_ARCHITECTURE_DIAGRAMS.md                # Dual-Track PO Architecture & Workflow Diagrams
    │
    └── 04_REFERENCE/
        └── REFERENCE_GUIDE.md                            # Status Enums, RBAC Matrix, Field Inventory & Rules
```

---

## Instructions for Claude Design Execution

1. **Visual Style Master Reference**: Strictly emulate the design system, typography hierarchy, margins, badge styling, color tokens, and table aesthetics defined in **`MAN-BRAND-001 Brand Policy.pdf`**. Do NOT invent new design themes.
2. **Text Authority**: Use only the verified text and structured data in `01_CONTENT/MAN-B-ORD-001_Manual_Content.md`.
3. **Core Domain Rules**:
   - **Dual-Track PO Architecture**:
     - *Track A (Brand PO Request)*: Brand Request $\rightarrow$ Admin Review $\rightarrow$ Convert to PO $\rightarrow$ Official PO.
     - *Track B (Admin Direct PO)*: Admin Direct PO $\rightarrow$ Official PO.
   - **Independence of Retail Application**: `Retail Application Approval ≠ Automatic Purchase Order Creation`.
   - **Post-PO Fulfillment Flow**: `Supplier Confirmation` $\rightarrow$ `Goods Ready` $\rightarrow$ `Shipping/Handover` $\rightarrow$ `Receiving/Inspection` $\rightarrow$ `Completed`.
   - **Inquiry & MOQ Grounding**: Inquiry is a separate support channel (not auto-triggered); MOQ is a guideline warning (not a blocking error).
4. **Cross-Manual Separation**: Keep logistics execution details referenced to `MAN-B-LOG-001` and invoice/settlement details referenced to `MAN-B-FIN-001`.
5. **Screenshots**: Place and annotate the physical screenshot PNG files from `02_SCREENSHOTS/` according to `SCREENSHOT_ANNOTATION_GUIDE.md`.
