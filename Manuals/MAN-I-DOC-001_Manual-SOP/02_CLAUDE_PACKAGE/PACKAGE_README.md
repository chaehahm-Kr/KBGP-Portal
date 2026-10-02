# MAN-I-DOC-001 — Claude Design Package Readme
## K SELECT Internal Operations: Manual Creation & Update SOP Design Package
### (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드 디자인 패키지 안내서)

---

## 1. Package Overview

본 패키지(`02_CLAUDE_PACKAGE/`)는 **K SELECT 네트워크 시스템**의 표준 운영 절차서(**MAN-I-DOC-001**)에 대한 Claude Design AI 기반 고품질 PDF 매뉴얼 제작을 위해 구축된 최신 디자인 패키지입니다.

- **Task ID**: `MAN-I-DOC-001-PKG-001`
- **Source Review Basis**: `MAN-I-DOC-001-SRC-QA-001` (Approved Canonical Baseline)
- **Document Scope**: INTERNAL OPERATIONS / STAFF & ADMIN ONLY
- **Master Design Reference**: `Manuals/MAN-B-BRAND-001_Brand-Policy/03_PUBLISHED/MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 2. Directory & Asset Structure

```text
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                       # 패키지 개요 및 빌드 지침서 (본 파일)
├── CLAUDE_DESIGN_MASTER_PROMPT.md          # Claude AI 디자인 렌더링 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md         # 퍼블리싱 및 릴리즈 전달 프롬프트
├── MAN-I-DOC-001_Design_Structure.md       # 챕터 구성, 그리드 레이아웃 및 핀 매핑 명세서
├── 01_CONTENT/
│   └── MAN-I-DOC-001_Manual_Content.md     # 완전한 공식 원고 본문 전문 (7개 챕터 + 부록)
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md      # 스크린샷별 Pin 1~4 어노테이션 규격서
│   ├── SCR-I-DOC-001.png                   # Workspace & Manuals Directory Hierarchy
│   ├── SCR-I-DOC-002.png                   # Brand Portal Help & Manuals Hub
│   ├── SCR-I-DOC-003.png                   # Brand Portal Manual Detail View
│   ├── SCR-I-DOC-004.png                   # Brand Portal FAQ Hub Interface
│   ├── SCR-I-DOC-005.png                   # Grounded Ask Knowledge Assistant
│   ├── SCR-I-DOC-006.png                   # Admin Knowledge Operations Overview
│   ├── SCR-I-DOC-007.png                   # Admin Knowledge Library Table
│   ├── SCR-I-DOC-008.png                   # Admin Knowledge Item Detail Inspector
│   ├── SCR-I-DOC-009.png                   # Master Design System Reference Grid
│   ├── SCR-I-DOC-010.png                   # Claude Design Package Structure Blueprint
│   └── SCR-I-DOC-011.png                   # Terminal Verification & QA Suite Output
├── 03_DIAGRAMS/
│   └── MANUAL_SOP_ARCHITECTURE_DIAGRAMS.md # 13단계 라이프사이클 & 5대 QA 게이트 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                  # 디자인 토큰 & DB 스키마/코드 매핑 가이드
```

---

## 3. Core Principles & Strict QA Boundaries

1. **13-Stage Manual Lifecycle**:
   `Source Creation` ➔ `Source QA (Gate 1)` ➔ `Package Creation` ➔ `Package File Check` ➔ `Package QA (Gate 2)` ➔ `Claude Design Generation` ➔ `PDF QA (Gate 3)` ➔ `Publish` ➔ `Publish QA` (Internal SOP 완료 지점) ➔ `[Public Only: Knowledge Center Publish` ➔ `Knowledge QA (Gate 4)` ➔ `FAQ Publish` ➔ `FAQ QA (Gate 5)]`.
2. **Strict QA Gate Blocking**: 어떤 단계든 지정된 QA Gate를 공식 Pass하지 못한 상태에서 다음 단계로의 진입은 엄격히 금지됩니다.
3. **Internal vs Public Boundary**: 본 매뉴얼(`MAN-I-DOC-001`)은 사내 직원 전용 Internal SOP이므로 Public Knowledge Center 및 Public FAQ 배포는 `NOT APPLICABLE`로 처리됩니다.
4. **Zero Mismatch Guarantee**: 스크린샷 11장은 전수 고유 SHA-256 해시를 보유하며 `SCREENSHOT_ANNOTATION_GUIDE.md`의 Pin 번호와 100% 대응합니다.
