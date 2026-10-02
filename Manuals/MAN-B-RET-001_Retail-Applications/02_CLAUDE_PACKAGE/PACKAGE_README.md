# K SELECT Manual Design Package: MAN-B-RET-001

## Package Overview

| Attribute | Specification |
| :--- | :--- |
| **Manual ID** | `MAN-B-RET-001` |
| **Manual Title (EN)** | Brand Portal Retail Placement & Application Guide |
| **Manual Title (KO)** | 브랜드 포털 입점 신청 및 리테일 네트워크 가이드 |
| **Audience** | `B — Brand Portal User` (Brand Owner, Manager, Operations Team) |
| **Topic Category** | `topic-retail` (입점 & 리테일 네트워크 / Retail Network) |
| **Topic Sequence** | Order 5 (Follows `topic-regulatory` / `MAN-B-REG-001`) |
| **Visual Design Standard** | **`MAN-BRAND-001 Brand Policy.pdf`** (Authoritative Master Style Reference) |
| **Content Source of Truth** | `01_SOURCE` & `01_CONTENT/MAN-B-RET-001_Manual_Content.md` |
| **Current Status** | `READY FOR CHATGPT PACKAGE QA` |

---

## Package Directory Structure

```text
Manuals/MAN-B-RET-001_Retail-Applications/02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                                 # This package manifest
├── CLAUDE_DESIGN_MASTER_PROMPT.md                    # Comprehensive Claude Design instructions & styling rules
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                   # Concise copy-paste prompt for Claude Handoff session
├── MAN-B-RET-001_Design_Structure.md                 # Page-by-page layout & visual composition blueprint
├── 01_CONTENT/
│   └── MAN-B-RET-001_Manual_Content.md               # 100% Verified Manual Content & FAQ
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md                # Mapping and callout instructions for 9 screenshots
│   ├── SCR-B-RET-001.png                             # Applications Dashboard (Desktop 1440x900)
│   ├── SCR-B-RET-002.png                             # Draft Mode: Multi-brand Product Selection
│   ├── SCR-B-RET-003.png                             # Draft Mode: 6 Official Readiness Evaluation Cards
│   ├── SCR-B-RET-004.png                             # Draft Mode: Save Draft & Submit Action Bar
│   ├── SCR-B-RET-005.png                             # Application Detail Header & Status Badges
│   ├── SCR-B-RET-006.png                             # Additional Info Request & Reply Upload Panel
│   ├── SCR-B-RET-007.png                             # Granular Product Review Status & Audit Timeline
│   ├── SCR-B-RET-008.png                             # Sidebar Readiness & Self-Check Evaluation Summary
│   └── SCR-B-RET-009.png                             # Applications Dashboard (Mobile 390x844)
├── 03_DIAGRAMS/
│   └── RETAIL_APPLICATION_WORKFLOW_DIAGRAMS.md       # Visual workflow diagrams (Mermaid & structural flow)
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                            # System rules, data dictionary, and RBAC matrix
```

---

## Instructions for Claude Design Execution

1. **Visual Style Reference**: Strictly adopt the visual design system, typography hierarchy, margins, badge styling, and table aesthetics defined in `MAN-BRAND-001 Brand Policy.pdf`. Do NOT invent new design themes.
2. **Text Authority**: Use only the text and structured data in `01_CONTENT/MAN-B-RET-001_Manual_Content.md`.
3. **Screenshots**: Place and annotate the 9 physical screenshot PNG files from `02_SCREENSHOTS/` according to `SCREENSHOT_ANNOTATION_GUIDE.md`.
4. **Target Output**: Compile into high-quality PDF format and save to `Manuals/MAN-B-RET-001_Retail-Applications/03_PUBLISHED/` upon approval.
