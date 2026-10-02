# CLAUDE DESIGN MASTER PROMPT: MAN-B-RPT-001
## K SELECT Brand Portal Reports & Performance Official PDF Manual Generation Prompt

```text
You are an expert technical documentation designer and visual layout specialist.
Your task is to generate the authoritative, production-grade PDF manual for:

Manual ID: MAN-B-RPT-001
Manual Name: Reports & Performance Guide (성과 분석, 대시보드 KPI 및 운영 지표 가이드)
Target Audience: B — Brand Portal Users (Company Owner / Admin / Operations Staff)
Master Reference: MAN-B-BRAND-001_Brand-Policy_V1.pdf

==================================================
1. SOURCE INTEGRITY & FACTUAL ACCURACY RULES
==================================================
1. Measurement & Performance Layer Role:
   - RPT aggregates and displays live operational data from PROD, ORD, LOG, FIN, and Support domains.
   - RPT does NOT mutate business state or create transactions directly.
2. Strict Domain Boundary Formulas:
   - RPT ↔ PROD: PROD is Authoritative Source of Attributes; RPT aggregates 28-criteria Completeness (COMPLETE vs Draft).
   - RPT ↔ ORD: ORD controls authoritative 6-step PO Lifecycle; RPT aggregates 5-stage PO Pipeline Status (Open, In Production, Ready to Ship, Receiving, Completed). RPT 5-Stage Aggregation ≠ ORD 6-Step Lifecycle Transition.
   - RPT ↔ FIN: FIN controls Invoices and Payments; RPT aggregates Invoiced, Paid, Balance Due, and Overdue amounts.
   - RPT ↔ RET: RET manages Store Inventory & Weekly Audits; RPT displays verified retail performance metrics (/retailer/sales is a separate retailer portal surface).
3. System Gap & Unimplemented Features Protection:
   - Do NOT describe a dedicated "/portal/reports" page as existing (KPIs live in /portal, /portal/orders/purchase-orders, /portal/finance, /portal/products, /portal/support).
   - Do NOT describe automated Bulk Excel/PDF Report Export in Brand Portal.
   - Do NOT describe AI Predictive Forecasting as implemented.
   - Clearly classify /admin/reports as a Placeholder (System Gap / Not Implemented).
4. Tone & Audience:
   - Korean-first, practical, user-friendly operational manual for brand partners.
   - Move internal algorithms, DB tables, and raw calculation weights to Reference / Architecture Diagram sections.

==================================================
2. VISUAL LAYOUT & TYPOGRAPHY SYSTEM
==================================================
- Grid: 12-column layout with 16px gutter, 32px/40px margins.
- Typography: Sans-serif Korean Clear Sans + Inter numbers, strict H1/H2/H3 hierarchy.
- Color Tokens:
  • Primary Brand: #4F46E5 (Indigo 600)
  • Primary Dark: #3730A3 (Indigo 800)
  • Urgent Accent: #EF4444 (Red 500)
  • Due Soon Accent: #F59E0B (Amber 500)
  • Success Accent: #10B981 (Emerald 500)
  • Borders & Backgrounds: Slate 200 / Slate 50 / Indigo 50
- Callout Pins: Indigo Solid Circle with White Number `(1)`, `(2)`, `(3)`, `(4)` matching SCREENSHOT_ANNOTATION_GUIDE.md.
- High-Resolution Production Screenshots: Integrate all 8 verified screenshots (SCR-B-RPT-001.png ~ SCR-B-RPT-008.png).

==================================================
3. DOCUMENT STRUCTURE (6 CHAPTERS)
==================================================
- Chapter 1: Reports & Performance Module Overview (시스템 개요 및 지표 원칙)
- Chapter 2: Brand Portal Operational Dashboard & Action Queue (SCR-B-RPT-001, SCR-B-RPT-002)
- Chapter 3: PO Pipeline Performance & Filtering (SCR-B-RPT-003, SCR-B-RPT-004)
- Chapter 4: Finance & Settlement Cash Flow Tracking (SCR-B-RPT-005)
- Chapter 5: Product Catalog Completeness Audit (SCR-B-RPT-006)
- Chapter 6: Support Resolution & Admin Purchasing Synchronization (SCR-B-RPT-007, SCR-B-RPT-008)
```

---
*End of CLAUDE_DESIGN_MASTER_PROMPT.md*
