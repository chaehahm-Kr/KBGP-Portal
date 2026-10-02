# MAN-B-INT-001 — Design & Layout Structure Guide
## Technical Design System, Typography & Grid Blueprints for Intelligence Manual

---

## 1. Document Geometry & Grid Specifications

- **Page Size**: Standard A4 (210mm × 297mm) / Digital Landscape (16:9 1920×1080 optimized).
- **Margins**: Top 28mm, Bottom 24mm, Left 24mm, Right 24mm.
- **Grid Structure**: 12-Column Flexible Grid System with 16px Gutters.
- **Header & Footer**:
  - Top Header: Left `K SELECT NETWORK` | Center `MAN-B-INT-001 Intelligence & Insights Guide` | Right `v1.0`
  - Bottom Footer: Left `Confidential & Authoritative` | Right `Page {PAGE_NUM} of {TOTAL_PAGES}`

---

## 2. Typography Hierarchy

| Level | Font Family | Size / Weight | Line Height | Color Token | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Doc Title** | Clear Sans / Inter | 26pt Bold | 1.2 | `#1E1B4B` (Indigo 950) | Manual Front Cover Title |
| **H1 (Chapter)** | Clear Sans / Inter | 18pt Bold | 1.3 | `#312E81` (Indigo 900) | Major Chapter Titles |
| **H2 (Section)** | Clear Sans / Inter | 13pt SemiBold | 1.4 | `#3730A3` (Indigo 800) | Section Headings |
| **H3 (Sub)** | Clear Sans / Inter | 10.5pt SemiBold | 1.4 | `#4338CA` (Indigo 700) | Subsections & Panels |
| **Body Text** | Clear Sans / Inter | 9pt Regular | 1.5 | `#1E293B` (Slate 800) | Standard Explanatory Text |
| **Caption / Meta**| Clear Sans / Inter | 7.5pt Medium | 1.4 | `#64748B` (Slate 500) | Tables, Footnotes, Source Meta |
| **Code / Monospace**| JetBrains Mono | 8pt Regular | 1.4 | `#0F172A` (Slate 900) | IDs, URLs, Status Enums |

---

## 3. Color Palette & Component Tokens

- **Brand Primary**: Indigo `#4F46E5` (Action buttons, primary highlights)
- **Brand Deep**: Dark Indigo `#3730A3` (Section titles, header bands)
- **Verification Green**: Emerald `#10B981` (Verified claims, Published status)
- **Inference Blue**: Blue `#3B82F6` (Inferred claims, Review status)
- **Signal Amber**: Amber `#F59E0B` (Signal claims, Draft status, Quota alerts)
- **High Risk Rose**: Rose `#E11D48` (High risk alerts, Downgrades, Critical rejects)
- **Neutral Dark**: Slate `#0F172A` (Headings, primary data values)
- **Neutral Light**: Slate `#F8FAFC` (Card backgrounds, code callouts)
- **Border Subtle**: Slate `#E2E8F0` (Dividers, container borders)

---

## 4. Chapter Layout Blueprint (7 Chapters)

### Chapter 01: System Overview & Three Intelligence Principles
- 2-Column Overview: Intelligence scope vs Operational reporting baseline.
- Architecture Summary Card: Three operational pillars (Knowledge Assistant, Auto-Engine, Editorial Governance).
- Domain Boundary Matrix: Strict separation of INT from RPT and FAQ search.

### Chapter 02: Brand Grounded Knowledge Assistant & Policy Guidance
- Full-Width Hero Section: `SCR-B-INT-001.png` (Search Interface & Read-Only Guard).
- Split View: `SCR-B-INT-002.png` with 4-Pin Callout Map (Direct Answer, Summary Bullets, Official Citations, Actions).
- No Fabrication & Security Fallbacks Table.

### Chapter 03: Admin Insights Platform & Dashboard Overview
- Top Dashboard Panel: `SCR-B-INT-003.png` (Insights Overview Metrics & Quick Actions).
- Bottom Library Table: `SCR-B-INT-006.png` (All Articles Library, Filters & Featured Status).

### Chapter 04: Auto-Engine Research Pipeline & 3+3 Quota Rules
- 4-Stage Horizontal Pipeline: Live Market Research ➔ Topic Scoring ➔ Quota Allocation ➔ 2nd-Pass Research.
- Execution Log Panel: `SCR-B-INT-008.png` (Automation Runs Log & Quality Metrics).
- Editorial Rules Configuration: `SCR-B-INT-009.png` (80-Point Quality Gate & Quota Settings).

### Chapter 05: Claim Risk Auditing, Safe Downgrades & Content Layers
- Split Screen Panel: `SCR-B-INT-005.png` (Claim Risk Audit Summary & Fact-Check Breakdown).
- Article Editor Preview: `SCR-B-INT-007.png` (Dual-Language Blocks, 4 Content Layers, Visuals).
- Claim Status & Risk Level Reference Matrix.

### Chapter 06: Editorial Moderation Queue & Publishing Governance
- Queue Screen: `SCR-B-INT-004.png` (Moderation Queue & Revision Tracking).
- Categories & Authors: `SCR-B-INT-010.png` (Taxonomy & Author Profiles).
- Step-by-Step Moderation & Human Approval Workflow.

### Chapter 07: Reader Usefulness Feedback, System Gaps & Appendix
- Feedback Analytics Panel: `SCR-B-INT-011.png` (Reader Helpfulness Rate % & Duplicate Prevention).
- System Gaps & Non-Implemented Boundaries Table.
- Database Schema Quick Reference.

---
*End of MAN-B-INT-001_Design_Structure.md*
