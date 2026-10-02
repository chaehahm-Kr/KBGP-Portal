# MAN-B-FAQ-001 DESIGN STRUCTURE & LAYOUT GUIDE
## Knowledge Center FAQ Visual Hierarchy & Component Specifications

- **Manual ID:** `MAN-B-FAQ-001`
- **Topic:** `Knowledge Center FAQ (도움말 센터, 자주 묻는 질문 및 지식 검색)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Page Grid & Typography Standards

### 1.1 12-Column Grid System
- **Page Canvas**: Standard A4 Landscape / Desktop Web Display (1440px Canvas)
- **Margins**: Top 32px, Bottom 32px, Left 40px, Right 40px
- **Grid Gutters**: 16px horizontal gutter between content columns

### 1.2 Typography Hierarchy
- **Document Title (H1)**: 24pt Bold / Neutral 900 (`#0F172A`)
- **Chapter Heading (H2)**: 18pt Bold / Neutral 800 (`#1E293B`)
- **Section Heading (H3)**: 14pt Semi-Bold / Indigo 700 (`#4338CA`)
- **Body Text**: 10pt Regular / Neutral 700 (`#334155`), Line-height 1.6
- **Captions & Callouts**: 8.5pt Regular / Neutral 500 (`#64748B`)
- **Table Data**: 9pt Regular / Neutral 800 (`#1E293B`)

---

## 2. Color Palette & Component Tokens

| Token Name | Hex Code | Purpose & Application |
| :--- | :--- | :--- |
| `primary-brand` | `#4F46E5` (Indigo 600) | Primary buttons, active topic cards, search highlights |
| `primary-dark` | `#3730A3` (Indigo 800) | Main section headers, key accents |
| `featured-accent`| `#F59E0B` (Amber 500) | `⭐ Featured` FAQ badges, star highlights |
| `topic-bg` | `#EEF2FF` (Indigo 50) | Topic card background, active accordion fill |
| `neutral-border` | `#E2E8F0` (Slate 200) | Table borders, card outlines |
| `neutral-bg` | `#F8FAFC` (Slate 50) | Callout card background, table header fill |

---

## 3. Chapter Layout Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PAGE LAYOUT BLUEPRINT: 7 CORE SECTIONS                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 1: System Overview & Knowledge Governance Principles                         │
│   - Role of Help Center & Grounded First principle                                     │
│   - Strict domain boundary governance across 12 domains                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 2: Help Center Main & 6 Topic Grid (SCR-B-FAQ-001, SCR-B-FAQ-002)            │
│   - Hero search bar, suggested question chips, 6 active topic cards, featured FAQs     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 3: Topic FAQ Discovery & Accordions (SCR-B-FAQ-003)                          │
│   - Topic selection banner, expandable FAQ list, source chapter citations              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 4: Grounded Ask K SELECT Engine (SCR-B-FAQ-004, SCR-B-FAQ-005)               │
│   - Natural language search, direct answer card, source manual links, feedback buttons │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 5: Manual Detail Viewer & Support Handoff (SCR-B-FAQ-006, SCR-B-FAQ-007)     │
│   - In-manual related FAQs, 1:1 support escalation with prefilled context              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 6: Mobile Responsive Help Center (SCR-B-FAQ-008)                             │
│   - Mobile 1-column topic list, touch-friendly accordions                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Section 7: Appendix: Admin Operations Console (SCR-B-FAQ-009, SCR-B-FAQ-010)         │
│   - Admin FAQ candidate review console, knowledge library monitoring                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*End of MAN-B-FAQ-001_Design_Structure.md*
