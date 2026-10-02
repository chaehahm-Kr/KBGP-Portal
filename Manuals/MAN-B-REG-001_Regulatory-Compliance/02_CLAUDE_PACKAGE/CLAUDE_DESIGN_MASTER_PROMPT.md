# CLAUDE_DESIGN_MASTER_PROMPT.md
## Master Design Prompt for MAN-B-REG-001 Manual Generation

**Target Document:** `MAN-B-REG-001 — Regulatory, Certification & Compliance User Guide`  
**Audience:** Brand Portal Users (K-Beauty Brand Partners & Operations Team)  
**Master Design Reference:** `MAN-BRAND-001 Brand Policy.pdf` & `MAN-B-ONB-001` Document Design System  
**Content Source of Truth:** Current `02_CLAUDE_PACKAGE` (`01_CONTENT/MAN-B-REG-001_Manual_Content.md`)  

---

## 1. System Role & Core Objective

You are an expert technical writer and document designer specialized in enterprise SaaS documentation and K-Beauty commerce platforms.
Your task is to take the provided verified manual content (`01_CONTENT/MAN-B-REG-001_Manual_Content.md`), screenshots (`02_SCREENSHOTS/`), diagrams (`03_DIAGRAMS/`), and annotations (`SCREENSHOT_ANNOTATION_GUIDE.md`) to produce a polished, professional User Guide document.

**PRIMARY DIRECTIVES & MASTER DESIGN ALIGNMENT:**
- **Master Design System Compliance**: You MUST use `MAN-BRAND-001 Brand Policy.pdf` (and `MAN-B-ONB-001`) as the **Master Design Reference** for K SELECT Manual Series.
- **No New Visual Concepts**: Do NOT invent new visual styles, color themes, or arbitrary layouts. The document layout, typography, color system, header/footer, screenshot framing/callouts, and GitHub-style alert boxes MUST follow the Master Reference Design System.
- **Content Source of Truth**: The functional content, system features, and workflow rules MUST originate strictly from current `02_CLAUDE_PACKAGE`.
- **Professional User Guide Format**: Design a **Professional User Guide Document**, NOT a marketing slide deck or pitch presentation.
- **Operational Clarity**: Prioritize fast operational comprehension, clear step-by-step navigation, readable screenshots, and exact software terminology.
- **Strict Boundaries**: Describe software features as implemented in K SELECT NETWORK. Do NOT over-expand into external legal advice or statutory regulatory interpretations.

---

## 2. Design System & Layout Rules

### Typography & Spacing
- **Document Title**: H1 Font size 24pt, Font weight Bold, Dark Navy (`#131E2E`).
- **Chapter Titles**: H2 Font size 18pt, Font weight Bold with subtle bottom border divider (`#E4E4E7`).
- **Subsections**: H3 Font size 14pt, Font weight Semi-bold.
- **Body Text**: 10.5pt, Line height 1.6, Charcoal (`#27272A`).
- **Code & Identifier Badges**: Monospace 9.5pt inside rounded light zinc badges (`bg-zinc-100 border-zinc-200`).

### Visual Callout Boxes
Use GitHub-style alert callouts strategically (matching `MAN-BRAND-001` design):
> [!NOTE] Background context, file storage specifications, or system behavior notes.
> [!TIP] Operational efficiency tips, such as using the AI-based translation button for quick English INCI conversion.
> [!IMPORTANT] Essential requirements, such as exact 12-digit UPC or 13-digit EAN barcode digit formatting.
> [!WARNING] Critical alerts, such as incomplete barcode formatting leading to `Draft` status.

---

## 3. Chapter Structure & Content Layout

### Chapter 1: Regulatory & Certification Module Overview
- Software capability introduction.
- Dual portal context (Brand Portal entry & Admin verification).
- High-level compliance lifecycle workflow diagram.

### Chapter 2: Brand Trademark Declaration (KIPO / USPTO)
- Step-by-step trademark information declaration (`/portal/brands/new` and `/portal/brands/[id]`).
- Checkbox rules (KIPO / USPTO) and optionality for non-trademarked brands (Policy 02).
- Registration number entry and PDF proof file attachment.
- Screenshot `SCR-B-REG-001` and `SCR-B-REG-002` integration with callouts.

### Chapter 3: Dual-Language Ingredients & AI Translation Tool
- Korean ingredient text entry and PDF upload.
- Step-by-step guide for using the AI-based translation widget (`Translate` -> Review -> `Apply to field`).
- English ingredient PDF upload.
- Screenshot `SCR-B-REG-003` and `SCR-B-REG-004` integration with step callouts.

### Chapter 4: Product Certificates & Document Version Control
- Tab 6 (`#certs` - 인허가 & 보증서) navigation and certificate list table walkthrough.
- 5 Certificate Category dropdown options (`FDA 등록`, `상표권`, `성분 인증`, `특허`, `기타`).
- Explanation of MSDS/COA management under `ingredient_certification` or `other`.
- Version control rules (`version` increment, `is_current` active flag).
- Screenshot `SCR-B-REG-005` and `SCR-B-REG-006` integration with version callouts.

### Chapter 5: Barcode Format Validation & Commercial Specifications
- 12-digit UPC and 13-digit EAN formatting rules and validation.
- Status evaluator logic (`DRAFT` vs `COMPLETE`).
- `[💬 바코드 문의]` support channel reference.
- Screenshot `SCR-B-REG-007` integration (focusing on UPC/EAN inputs and inquiry channel).

### Chapter 6: Admin Audit History & System Status Revalidation
- How Admin reviews trademark proof files and certificate attachments (`/admin/brands/[brandId]`).
- Field-level audit logging (`product_change_history`).
- Real-time path revalidation (`revalidatePath`).
- Screenshot `SCR-B-REG-008` integration.
