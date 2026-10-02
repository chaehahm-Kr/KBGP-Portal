# MAN-B-REG-001 — Claude Design Package Readme
## Official Regulatory, Certification & Compliance Manual Package

**Manual ID:** `MAN-B-REG-001`  
**Title:** `Regulatory, Certification & Compliance User Guide`  
**Audience:** `B` (Brand Portal Users — 브랜드사 담당자 및 관리자)  
**Package Version:** `1.0.0`  
**Source of Truth:** Production Codebase & `01_SOURCE/` Verification Reports  

---

## 1. Package Overview & Objectives

본 패키지(`02_CLAUDE_PACKAGE`)는 K SELECT NETWORK 공식 브랜드 포털 사용자를 위한 **MAN-B-REG-001 — Regulatory, Certification & Compliance Guide**를 Claude Design 환경에서 최종 퍼블리싱 문서로 변환하기 위해 작성된 생산용 패키지이다.

본 패키지에 수록된 모든 설명과 가이드는 Production 시스템에서 실제 작동하는 소프트웨어 기능(브랜드 상표권 정보, 이중 언어 전성분, AI 번역, 인허가 보증서 파일 업로드, 버전 관리, UPC/EAN 바코드 검증)에 100% 기반한다.

---

## 2. Directory Structure

```text
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                       # Package overview & instructions (This file)
├── CLAUDE_DESIGN_MASTER_PROMPT.md          # Comprehensive prompt for Claude Design formatting
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md         # One-click copyable handoff prompt for execution
├── MAN-B-REG-001_Design_Structure.md       # Visual layout, page hierarchy & typography specs
│
├── 01_CONTENT/
│   └── MAN-B-REG-001_Manual_Content.md     # Production-verified complete Korean user guide text
│
├── 02_SCREENSHOTS/
│   ├── SCR-B-REG-001.png ~ SCR-B-REG-008.png  # 8 Live Production PNG screenshots
│   └── SCREENSHOT_ANNOTATION_GUIDE.md      # Detailed callout, caption & highlight specifications
│
├── 03_DIAGRAMS/
│   └── REGULATORY_ARCHITECTURE_DIAGRAMS.md # Mermaid process diagrams & technical data flows
│
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                  # Terminology glossary, error messages & boundary notes
```

---

## 3. Strict Boundary Rules

1. **Software System Features vs Legal Statutes**:
   - 본 매뉴얼은 소프트웨어 시스템에서의 데이터 입력 및 문서 관리 방법을 설명한다.
   - 외부 법률 조항(FDA/MoCRA 개정안 규정)에 대한 법적 해석이나 법적 의무 확장은 일절 다루지 않는다.
2. **Responsible Person Exclusion**:
   - 현재 구현되지 않은 상표권 metadata와 Responsible Person의 법적 매핑은 매뉴얼 내용에서 배제한다.
3. **MSDS / COA Representation**:
   - MSDS 및 COA는 독립된 별도 시스템 기능이 아니라, `product_certificates`의 `ingredient_certification` (성분 인증) 또는 `other` (기타) 카테고리를 이용해 업로드하는 문서로 정확히 설명한다.
4. **No Future Enhancement Features**:
   - 미구현 기능(FDA Listing Number 전용 텍스트 필드, Compliance Status 뱃지 등)은 매뉴얼에 포함하지 않는다.

---

## 4. File Map & Usage Guide

- **Design Master Prompt**: `CLAUDE_DESIGN_MASTER_PROMPT.md` 참조
- **Handoff Execution**: `CLAUDE_DESIGN_HANDOFF_PROMPT.md`를 즉시 복사하여 Claude Design에 전달
- **Content Copy**: `01_CONTENT/MAN-B-REG-001_Manual_Content.md` 사용
- **Screenshot Assets**: `02_SCREENSHOTS/` 폴더 내 `SCR-B-REG-001.png` ~ `SCR-B-REG-008.png` 8개 원본 파일 사용
