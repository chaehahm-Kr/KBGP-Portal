# CLAUDE DESIGN MASTER PROMPT
## MAN-I-DOC-001 Manual Creation & Update SOP (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드)

```markdown
# TASK PROMPT: K SELECT Manual Creation & Update SOP PDF Design Generation

You are tasked with generating the complete, beautifully formatted, production-grade PDF and HTML Web User Manual for **K SELECT Manual Creation & Update SOP (MAN-I-DOC-001)**.

## 1. Document Scope & Classification
- **Document ID**: `MAN-I-DOC-001`
- **Document Title**: K SELECT Manual Creation & Update SOP (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드)
- **Classification**: INTERNAL SOP / STAFF & ADMIN ONLY
- **Target Audience**: Internal Staff, Operations Managers, Core Developers, Tech Leads
- **Document Version**: `v1.0.0`
- **Master Design System Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

## 2. Visual Theme & Styling Guidelines
All visual styling, typography, color palettes, spacing, UI component containers, step-by-step callouts, and table formats MUST strictly follow:
**`MAN-B-BRAND-001_Brand-Policy_V1.pdf`** as the authoritative **MASTER DESIGN REFERENCE**.

- **Canvas Background**: Dark Zinc / Slate (`#09090B`)
- **Card Container**: Dark Zinc (`#18181B`), Border (`#27272A`)
- **Primary Accent**: Indigo (`#4F46E5`)
- **Success Accent**: Emerald (`#059669`)
- **Warning Accent**: Amber (`#D97706`)
- **Danger / Alert Accent**: Rose (`#E11D48`)
- **Typography Hierarchy**:
  - H1 Manual Title: 24pt Bold `#FAFAFA`
  - H2 Chapter Title: 18pt Bold `#FAFAFA`
  - H3 Section Title: 14pt SemiBold `#E4E4E7`
  - Body Text: 10pt Regular `#A1A1AA`
  - Code / Monospace: 9pt `Consolas, Courier New` `#C7D2FE`

## 3. Mandatory Document Structure & Chapter Layout
The generated PDF MUST contain all 7 chapters and appendices outlined in `01_CONTENT/MAN-I-DOC-001_Manual_Content.md` and `MAN-I-DOC-001_Design_Structure.md`:
- **Cover Page & Metadata Block**
- **Executive Summary & Core Principles**
- **Chapter 1. 매뉴얼 아키텍처 & 4-Tier 디렉터리 구조** (`SCR-I-DOC-001`)
- **Chapter 2. 13단계 엔드투엔드 매뉴얼 라이프사이클 & 5대 QA 게이트** (`SCR-I-DOC-002`, `SCR-I-DOC-003`)
- **Chapter 3. 지식 센터 및 Grounded Q&A 어시스턴트 구조** (`SCR-I-DOC-004`, `SCR-I-DOC-005`)
- **Chapter 4. 어드민 지식 운영 허브 & 버전 관리** (`SCR-I-DOC-006`, `SCR-I-DOC-007`, `SCR-I-DOC-008`)
- **Chapter 5. 마스터 디자인 시스템 규격 & Claude AI 패키징** (`SCR-I-DOC-009`, `SCR-I-DOC-010`)
- **Chapter 6. 자동화 QA 검증 스위트 & Git 릴리즈 파이프라인** (`SCR-I-DOC-011`)
- **Chapter 7. 매뉴얼 개정 및 연쇄 영향 업데이트 SOP (Patch / Minor / Major)**
- **Appendix: 도메인 상태 경계 사전 & 완료 기준(DoD) 체크리스트**

## 4. Screenshot Pin Binding & Quality Rules
- Every screenshot must render crisply in 16:9 / 16:10 aspect ratio with subtle rounded corners (`border-radius: 8px`) and 1px border (`#27272A`).
- Underneath each screenshot, render a structured 2-column or 3-column callout grid detailing `Pin 1`, `Pin 2`, `Pin 3`, `Pin 4` corresponding exactly to `02_SCREENSHOTS/SCREENSHOT_ANNOTATION_GUIDE.md`.
- No placeholder text, no `TODO`, no `FIXME`, and no unsupported absolute claims (`100%`, `Always`, `Real-time`).
```
