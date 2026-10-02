# MAN-B-TASK-001 DESIGN STRUCTURE & LAYOUT GUIDE
## Task & Communication Guide Visual Hierarchy & Component Specifications

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Page Grid & Typography Architecture

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
| `primary-brand` | `#4F46E5` (Indigo 600) | Primary buttons, active tabs, major icons |
| `primary-dark` | `#3730A3` (Indigo 800) | Main section headers, key accents |
| `status-received` | `#F59E0B` / `#FEF3C7` | `RECEIVED` status badge (Amber) |
| `status-review` | `#3B82F6` / `#DBEAFE` | `UNDER_REVIEW` status badge (Blue) |
| `status-action` | `#E11D48` / `#FFE4E6` | `ACTION_REQUIRED` status badge (Rose) |
| `status-closed` | `#71717A` / `#F4F4F5` | `CLOSED` status badge (Zinc) |
| `neutral-border` | `#E2E8F0` (Slate 200) | Table borders, card outlines |
| `neutral-bg` | `#F8FAFC` (Slate 50) | Table header fills, callout box backgrounds |

---

## 3. Chapter Layout Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PAGE LAYOUT BLUEPRINT: 7 CORE CHAPTERS                                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 1: System Overview & Core Principles                                         │
│   - Philosophy of structured 1:1 case communication (official support & changes)       │
│   - Architectural separation: PERM 6 contact tasks vs Dynamic Case Tickets             │
│   - Admin tasks table (public.tasks) note: Internal Admin Task Prototype / Not connected to Brand Portal Support Cases │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 2: Support Hub UI & Case List (SCR-B-TASK-001)                               │
│   - Action bar, 4 normalized status filter tabs, case card items, urgent highlight     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 3: New Inquiry & 9 Standard Categories (SCR-B-TASK-002)                      │
│   - Submission modal, title/description guidelines, 20MB attachment, 9 category matrix │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 4: Threaded Discussion & Status Lifecycle (SCR-B-TASK-003)                   │
│   - Message timeline, system event logs, 10 DB enums to 4 presentation states normalizer│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 5: Action Required & Resolution Lifecycle (SCR-B-TASK-004, SCR-B-TASK-005)   │
│   - Rose alert banner, supplement submission flow, case close, 5-star CSAT rating      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 6: Cross-Domain Deep Linking Inflow (SCR-B-TASK-006, SCR-B-TASK-007)         │
│   - PO details (related_po_id DB FK), settlement AP prefill, agreements prefill (No FK)│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 7: ACL, Storage Security & Notifications (SCR-B-TASK-008 ~ SCR-B-TASK-010)   │
│   - 6 in-app notification events, conditional Resend email, company-uploads signed URLs│
│   - 4-tier ACL matrix (none/read/write/manage)                                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ • Chapter 8: Appendix: Admin Operations Console (SCR-B-TASK-011, SCR-B-TASK-012: Internal Admin Task Prototype / Not connected to Brand Portal Support Cases) │
│   - Admin partner inquiries management vs internal tasks console (Internal Admin Task Prototype / Not connected to Brand Portal Support Cases) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*End of MAN-B-TASK-001_Design_Structure.md*
