const fs = require('fs');
const path = require('path');

const baseDir = path.join(
  process.cwd(),
  'Manuals',
  'MAN-B-REG-001_Regulatory-Compliance',
  '02_CLAUDE_PACKAGE'
);

// Ensure test file is removed
const testFilePath = path.join(baseDir, 'MANUAL_FILESYSTEM_TEST.txt');
if (fs.existsSync(testFilePath)) {
  fs.unlinkSync(testFilePath);
}

function writeAndFlush(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
  const fd = fs.openSync(filePath, 'r+');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

// 1. PACKAGE_README.md
writeAndFlush(path.join(baseDir, 'PACKAGE_README.md'), `# MAN-B-REG-001 — Claude Design Package Readme
## Official Regulatory, Certification & Compliance Manual Package

**Manual ID:** \`MAN-B-REG-001\`  
**Title:** \`Regulatory, Certification & Compliance User Guide\`  
**Audience:** \`B\` (Brand Portal Users — 브랜드사 담당자 및 관리자)  
**Package Version:** \`1.1.0\`  
**Source of Truth:** Production Codebase & \`01_SOURCE/\` Verification Reports  

---

## 1. Package Overview & Objectives

본 패키지(\`02_CLAUDE_PACKAGE\`)는 K SELECT NETWORK 공식 브랜드 포털 사용자를 위한 **MAN-B-REG-001 — Regulatory, Certification & Compliance Guide**를 Claude Design 환경에서 최종 퍼블리싱 문서로 변환하기 위해 작성된 생산용 패키지이다.

본 패키지에 수록된 모든 설명과 가이드는 Production 시스템에서 실제 작동하는 소프트웨어 기능(브랜드 상표권 정보, 이중 언어 전성분, AI 기반 영문 번역 도구, 인허가 보증서 파일 업로드, 버전 관리, UPC/EAN 바코드 검증)에 100% 기반한다.

---

## 2. Directory Structure

\`\`\`text
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
\`\`\`

---

## 3. Strict Boundary Rules

1. **Software System Features vs Legal Statutes**:
   - 본 매뉴얼은 소프트웨어 시스템에서의 데이터 입력 및 문서 관리 방법을 설명한다.
   - 외부 법률 조항(FDA/MoCRA 개정안 규정)에 대한 법적 해석이나 법적 의무 확장은 일절 다루지 않는다.
2. **Responsible Person Exclusion**:
   - 현재 구현되지 않은 상표권 metadata와 Responsible Person의 법적 매핑은 매뉴얼 내용에서 배제한다.
3. **MSDS / COA Representation**:
   - MSDS 및 COA는 독립된 별도 시스템 기능이 아니라, \`product_certificates\`의 \`ingredient_certification\` (성분 인증) 또는 \`other\` (기타) 카테고리를 이용해 업로드하는 문서로 정확히 설명한다.
4. **No Future Enhancement Features**:
   - 미구현 기능(FDA Listing Number 전용 텍스트 필드, Compliance Status 뱃지 등)은 매뉴얼에 포함하지 않는다.

---

## 4. File Map & Usage Guide

- **Design Master Prompt**: \`CLAUDE_DESIGN_MASTER_PROMPT.md\` 참조
- **Handoff Execution**: \`CLAUDE_DESIGN_HANDOFF_PROMPT.md\`를 즉시 복사하여 Claude Design에 전달
- **Content Copy**: \`01_CONTENT/MAN-B-REG-001_Manual_Content.md\` 사용
- **Screenshot Assets**: \`02_SCREENSHOTS/\` 폴더 내 \`SCR-B-REG-001.png\` ~ \`SCR-B-REG-008.png\` 8개 원본 파일 사용
`);

// 2. CLAUDE_DESIGN_MASTER_PROMPT.md
writeAndFlush(path.join(baseDir, 'CLAUDE_DESIGN_MASTER_PROMPT.md'), `# CLAUDE_DESIGN_MASTER_PROMPT.md
## Master Design Prompt for MAN-B-REG-001 Manual Generation

**Target Document:** \`MAN-B-REG-001 — Regulatory, Certification & Compliance User Guide\`  
**Audience:** Brand Portal Users (K-Beauty Brand Partners & Operations Team)  
**Master Design Reference:** \`MAN-BRAND-001 Brand Policy.pdf\` & \`MAN-B-ONB-001\` Document Design System  
**Content Source of Truth:** Current \`02_CLAUDE_PACKAGE\` (\`01_CONTENT/MAN-B-REG-001_Manual_Content.md\`)  

---

## 1. System Role & Core Objective

You are an expert technical writer and document designer specialized in enterprise SaaS documentation and K-Beauty commerce platforms.
Your task is to take the provided verified manual content (\`01_CONTENT/MAN-B-REG-001_Manual_Content.md\`), screenshots (\`02_SCREENSHOTS/\`), diagrams (\`03_DIAGRAMS/\`), and annotations (\`SCREENSHOT_ANNOTATION_GUIDE.md\`) to produce a polished, professional User Guide document.

**PRIMARY DIRECTIVES & MASTER DESIGN ALIGNMENT:**
- **Master Design System Compliance**: You MUST use \`MAN-BRAND-001 Brand Policy.pdf\` (and \`MAN-B-ONB-001\`) as the **Master Design Reference** for K SELECT Manual Series.
- **No New Visual Concepts**: Do NOT invent new visual styles, color themes, or arbitrary layouts. The document layout, typography, color system, header/footer, screenshot framing/callouts, and GitHub-style alert boxes MUST follow the Master Reference Design System.
- **Content Source of Truth**: The functional content, system features, and workflow rules MUST originate strictly from current \`02_CLAUDE_PACKAGE\`.
- **Professional User Guide Format**: Design a **Professional User Guide Document**, NOT a marketing slide deck or pitch presentation.
- **Operational Clarity**: Prioritize fast operational comprehension, clear step-by-step navigation, readable screenshots, and exact software terminology.
- **Strict Boundaries**: Describe software features as implemented in K SELECT NETWORK. Do NOT over-expand into external legal advice or statutory regulatory interpretations.

---

## 2. Design System & Layout Rules

### Typography & Spacing
- **Document Title**: H1 Font size 24pt, Font weight Bold, Dark Navy (\`#131E2E\`).
- **Chapter Titles**: H2 Font size 18pt, Font weight Bold with subtle bottom border divider (\`#E4E4E7\`).
- **Subsections**: H3 Font size 14pt, Font weight Semi-bold.
- **Body Text**: 10.5pt, Line height 1.6, Charcoal (\`#27272A\`).
- **Code & Identifier Badges**: Monospace 9.5pt inside rounded light zinc badges (\`bg-zinc-100 border-zinc-200\`).

### Visual Callout Boxes
Use GitHub-style alert callouts strategically (matching \`MAN-BRAND-001\` design):
> [!NOTE] Background context, file storage specifications, or system behavior notes.
> [!TIP] Operational efficiency tips, such as using the AI-based translation button for quick English INCI conversion.
> [!IMPORTANT] Essential requirements, such as exact 12-digit UPC or 13-digit EAN barcode digit formatting.
> [!WARNING] Critical alerts, such as incomplete barcode formatting leading to \`Draft\` status.

---

## 3. Chapter Structure & Content Layout

### Chapter 1: Regulatory & Certification Module Overview
- Software capability introduction.
- Dual portal context (Brand Portal entry & Admin verification).
- High-level compliance lifecycle workflow diagram.

### Chapter 2: Brand Trademark Declaration (KIPO / USPTO)
- Step-by-step trademark information declaration (\`/portal/brands/new\` and \`/portal/brands/[id]\`).
- Checkbox rules (KIPO / USPTO) and optionality for non-trademarked brands (Policy 02).
- Registration number entry and PDF proof file attachment.
- Screenshot \`SCR-B-REG-001\` and \`SCR-B-REG-002\` integration with callouts.

### Chapter 3: Dual-Language Ingredients & AI Translation Tool
- Korean ingredient text entry and PDF upload.
- Step-by-step guide for using the AI-based translation widget (\`Translate\` -> Review -> \`Apply to field\`).
- English ingredient PDF upload.
- Screenshot \`SCR-B-REG-003\` and \`SCR-B-REG-004\` integration with step callouts.

### Chapter 4: Product Certificates & Document Version Control
- Tab 6 (\`#certs\` - 인허가 & 보증서) navigation and certificate list table walkthrough.
- 5 Certificate Category dropdown options (\`FDA 등록\`, \`상표권\`, \`성분 인증\`, \`특허\`, \`기타\`).
- Explanation of MSDS/COA management under \`ingredient_certification\` or \`other\`.
- Version control rules (\`version\` increment, \`is_current\` active flag).
- Screenshot \`SCR-B-REG-005\` and \`SCR-B-REG-006\` integration with version callouts.

### Chapter 5: Barcode Format Validation & Commercial Specifications
- 12-digit UPC and 13-digit EAN formatting rules and validation.
- Status evaluator logic (\`DRAFT\` vs \`COMPLETE\`).
- \`[💬 바코드 문의]\` support channel reference.
- Screenshot \`SCR-B-REG-007\` integration (focusing on UPC/EAN inputs and inquiry channel).

### Chapter 6: Admin Audit History & System Status Revalidation
- How Admin reviews trademark proof files and certificate attachments (\`/admin/brands/[brandId]\`).
- Field-level audit logging (\`product_change_history\`).
- Real-time path revalidation (\`revalidatePath\`).
- Screenshot \`SCR-B-REG-008\` integration.
`);

// 3. CLAUDE_DESIGN_HANDOFF_PROMPT.md
writeAndFlush(path.join(baseDir, 'CLAUDE_DESIGN_HANDOFF_PROMPT.md'), `# CLAUDE_DESIGN_HANDOFF_PROMPT.md
## Executable Handoff Prompt for Claude Design

> **Instructions for User:**  
> Copy the prompt block below and paste it into Claude Design along with attaching the \`02_CLAUDE_PACKAGE\` folder.

\`\`\`markdown
Hello Claude Design! Please generate the published user guide document for **MAN-B-REG-001 — Regulatory, Certification & Compliance User Guide**.

### Package Context & Attachments
I have attached the complete \`02_CLAUDE_PACKAGE\` directory containing:
1. \`01_CONTENT/MAN-B-REG-001_Manual_Content.md\` — Complete verified Korean manual text.
2. \`02_SCREENSHOTS/SCR-B-REG-001.png\` ~ \`SCR-B-REG-008.png\` — 8 Production screenshots and \`SCREENSHOT_ANNOTATION_GUIDE.md\`.
3. \`03_DIAGRAMS/REGULATORY_ARCHITECTURE_DIAGRAMS.md\` — Mermaid process workflow diagrams.
4. \`CLAUDE_DESIGN_MASTER_PROMPT.md\` — Master document style & design system rules.

### Design Principles & Directives
- **Master Design System Reference**: Use \`MAN-BRAND-001 Brand Policy.pdf\` (and \`MAN-B-ONB-001\`) as the **Master Design Reference** for K SELECT Manual Series.
- **No New Visual Concepts**: Do NOT create new visual styles or arbitrary layouts. Layout, typography, color system (\`#131E2E\` headers, \`#27272A\` body), header/footer, screenshot framing/callouts, and GitHub-style alert boxes (\`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`) MUST follow the Master Design Reference.
- **Content Source of Truth**: The functional content, system features, and workflow rules MUST originate strictly from \`02_CLAUDE_PACKAGE\`.
- **Product Navigation Alignment**: Note that "인허가 & 보증서" (\`#certs\`) is **Tab 6** in the official Product Detail navigation.
- **Format**: Format this as a **Professional SaaS User Guide Document**, NOT a slide deck.
- **Screenshot Embedding**: Embed the 8 production screenshots in their respective chapters with highlighted callouts, step badges, and captions as specified in \`SCREENSHOT_ANNOTATION_GUIDE.md\`.
- **Mermaid Diagrams**: Render the Mermaid workflow diagrams clearly at the beginning of relevant chapters.
- **Strict Boundaries**: Describe software features as implemented in K SELECT NETWORK. Do NOT add legal interpretations of external FDA/MoCRA statutes.
- **MSDS / COA Representation**: Keep MSDS/COA document explanations strictly aligned with the \`ingredient_certification\` or \`other\` certificate categories.

Please proceed with generating the published manual output in \`03_PUBLISHED/MAN-B-REG-001_Regulatory_Compliance_User_Guide.md\`.
\`\`\`
`);

// 4. MAN-B-REG-001_Design_Structure.md
writeAndFlush(path.join(baseDir, 'MAN-B-REG-001_Design_Structure.md'), `# MAN-B-REG-001 — Design Structure
## Document Design System, Page Layout & Visual Hierarchy Specs

**Manual ID:** \`MAN-B-REG-001\`  
**Document Title:** \`Regulatory, Certification & Compliance User Guide\`  
**Target Design System:** K SELECT Standard Manual Specification (Reference: \`MAN-B-ONB-001\`)  

---

## 1. Color Palette & Typography

### Color Palette
- **Primary Header / Brand Accent**: \`#131E2E\` (Dark Navy)
- **Secondary Header**: \`#1F3047\` (Slate Navy)
- **Body Text**: \`#27272A\` (Zinc 800 Charcoal)
- **Muted Text / Meta Info**: \`#71717A\` (Zinc 500)
- **Border Dividers**: \`#E4E4E7\` (Zinc 200)

### Typography Hierarchy
- **Title (H1)**: 24pt Bold, Navy (\`#131E2E\`)
- **Chapter Header (H2)**: 18pt Bold, Navy (\`#131E2E\`), Bottom border 1px solid \`#E4E4E7\`
- **Section Header (H3)**: 14pt Semi-bold, Dark Charcoal (\`#27272A\`)
- **Sub-section Header (H4)**: 12pt Bold, Charcoal (\`#3F3F46\`)
- **Body Text**: 10.5pt Regular, Charcoal (\`#27272A\`), Line height 1.6
- **Badges & Monospace**: 9.5pt Mono (\`font-mono\`), rounded badge style

---

## 2. Document Page Hierarchy

\`\`\`text
Document Root
├── Header Meta Block (Manual ID, Title, Target Audience, Version, Effective Date)
├── Document Table of Contents
├── Chapter 1: Regulatory & Certification Module Overview
│   ├── 1.1 System Scope & Purpose
│   └── 1.2 End-to-End Compliance Lifecycle Workflow (Mermaid Diagram)
├── Chapter 2: Brand Trademark Declaration (KIPO / USPTO)
│   ├── 2.1 Trademark Declaration Policy (Policy 02)
│   ├── 2.2 Registering KIPO / USPTO Numbers & Proof Files
│   └── 2.3 Screenshots SCR-B-REG-001 & SCR-B-REG-002 Walkthrough
├── Chapter 3: Dual-Language Ingredient Declaration & AI Translation Tool
│   ├── 3.1 Korean & English Ingredient Text Declaration
│   ├── 3.2 AI-Based Ingredients Translator Usage (KR -> EN)
│   └── 3.3 Screenshots SCR-B-REG-003 & SCR-B-REG-004 Walkthrough
├── Chapter 4: Product Certificates Upload & Version Control (Tab 6 #certs)
│   ├── 4.1 Certificate Categories (fda_registration, trademark, ingredient_certification, patent, other)
│   ├── 4.2 Document Versioning Rules (version, is_current)
│   └── 4.3 Screenshots SCR-B-REG-005 & SCR-B-REG-006 Walkthrough
├── Chapter 5: Product Barcode Specifications & Barcode Inquiry Channel
│   ├── 5.1 UPC (12-digit) & EAN (13-digit) Barcode Formatting
│   ├── 5.2 Registration Evaluator Check & Barcode Inquiry Channel
│   └── 5.3 Screenshot SCR-B-REG-007 Barcode Section Walkthrough
└── Chapter 6: Admin Audit History & System Status Revalidation
    ├── 6.1 Admin Verification Views & Proof File Inspection
    ├── 6.2 Screenshot SCR-B-REG-008 & Change History Audit
    └── 6.3 Appendix & Help Center Navigation
\`\`\`
`);

// 5. 01_CONTENT/MAN-B-REG-001_Manual_Content.md
writeAndFlush(path.join(baseDir, '01_CONTENT', 'MAN-B-REG-001_Manual_Content.md'), `# MAN-B-REG-001 — Regulatory, Certification & Compliance User Guide
## 공식 브랜드 포털 인허가, 상표권 및 증빙 서류 관리 매뉴얼

**Manual ID:** \`MAN-B-REG-001\`  
**Manual Title:** \`Regulatory, Certification & Compliance User Guide\`  
**Audience:** \`B\` (Brand Portal Users — 브랜드사 담당자 및 관리자)  
**Effective Date:** 2026-10-01  
**Version:** \`1.1.0\`  
**System Scope:** K SELECT NETWORK 소프트웨어 시스템 (\`https://portal.kselectnetwork.com\`)  

---

## 목차 (Table of Contents)
1. [제1장: 소프트웨어 인허가 모듈 개요](#제1장-소프트웨어-인허가-모듈-개요)
2. [제2장: 브랜드 상표권 정보 및 증빙 서류 관리](#제2장-브랜드-상표권-정보-및-증빙-서류-관리)
3. [제3장: 전성분 선언 및 AI 영문 번역기 활용](#제3장-전성분-선언-및-ai-영문-번역기-활용)
4. [제4장: 상품 인증 서류 업로드 및 버전 관리](#제4장-상품-인증-서류-업로드-및-버전-관리)
5. [제5장: 바코드 검증 및 문의 채널 안내](#제5장-바코드-검증-및-문의-채널-안내)
6. [제6장: 어드민 서류 확인 및 상태 동기화](#제6장-어드민-서류-확인-및-상태-동기화)

---

## 제1장: 소프트웨어 인허가 모듈 개요

### 1.1 모듈 목적 및 시스템 범위
K SELECT NETWORK 브랜드 포털은 입점 브랜드사가 미국 및 글로벌 B2B 리테일 시장 진출에 필요한 **상표권 정보, 이중 언어 전성분표, FDA 및 성분 인증 서류, 바코드 규격**을 효율적으로 등록하고 관리할 수 있는 통합 인허가 모듈을 제공합니다.

> [!NOTE]
> **시스템 범위 안내**: 본 매뉴얼은 K SELECT 포털 소프트웨어 내에서 인허가 정보 및 서류를 등록·수정·관리하는 시스템 사용법을 안내합니다. 외부 법률 조항이나 규제기관(FDA 등)의 행정 조문에 대한 법적 해석은 포함하지 않으며, 실제 시스템에 작성 및 업로드된 정보 관리법을 다룹니다.

### 1.2 주요 인허가 관리 영역
- **브랜드 상표권 (Brand Trademarks)**: 대한민국 특허청(KIPO) 및 미국 특허청(USPTO) 상표권 등록 정보 및 증빙 파일 관리.
- **전성분표 (Ingredients)**: 국문/영문 전성분 텍스트 선언, 국문/영문 전성분 PDF 첨부, AI 자동 번역 지원.
- **인증 보증서 (Certificates)**: FDA 등록증, 상표권증, 성분 인증서(MSDS/COA 등), 특허증, 기타 서류 업로드 및 자동 버전 관리.
- **상품 바코드 (Barcodes)**: 12자리 UPC / 13자리 EAN 바코드 규격 검증 및 카탈로그 \`COMPLETE\` 상태 전환.

---

## 제2장: 브랜드 상표권 정보 및 증빙 서류 관리

### 2.1 상표권 등록 정책 (Policy 02)
K SELECT 포털은 상표권을 미보유한 브랜드라도 카탈로그 구성을 위해 포털에 자유롭게 브랜드를 개설하고 등록하는 것을 허용합니다. (상표권 미보유 등록 가능)

> [!TIP]
> **상표권 미보유 브랜드**: 브랜드 등록 시 상표권 체크박스를 해제한 상태로 등록할 수 있으며, 향후 특허청 상표권이 등록되면 언제든지 브랜드 수정 화면에서 등록번호와 증빙 서류를 추가할 수 있습니다.

### 2.2 브랜드 신규 등록 시 상표권 입력 방법
1. 브랜드 포털 좌측 메뉴에서 **[브랜드 관리]** 클릭 후 상단 **[새 브랜드 추가]** 단추를 누릅니다 (\`/portal/brands/new\`).
2. **대한민국 특허청(KIPO) 상표권 보유** 여부 체크박스를 확인합니다.
   - 상표권을 보유한 경우: 체크박스를 클릭하고 **상표 등록번호**를 입력한 뒤 **상표권 증빙 파일(PDF/이미지)**을 첨부합니다.
3. **미국 특허청(USPTO) 상표권 보유** 여부 체크박스를 확인합니다.
   - 보유 시 체크 후 등록번호 입력 및 증빙 파일을 첨부합니다.
4. **[저장]** 버튼을 눌러 등록을 완료합니다.

![SCR-B-REG-001: 브랜드 등록 상표권 입력 화면](../02_SCREENSHOTS/SCR-B-REG-001.png)  
*그림 2.1: 브랜드 신규 개설 화면의 KIPO / USPTO 상표권 선택 및 증빙 파일 첨부 영역*

### 2.3 등록된 브랜드의 상표권 수정 및 서류 업데이트
1. **[브랜드 관리]** 목록에서 수정할 브랜드의 카드에 위치한 **[수정]** 버튼을 클릭합니다 (\`/portal/brands/[id]\`).
2. 기존에 첨부된 상표권 증빙 파일이 있는 경우 \`[보기]\` 링크를 클릭해 업로드된 문서를 즉시 확인할 수 있습니다.
3. 기존 증빙 파일을 삭제하거나 새 파일로 교체할 수 있습니다.

![SCR-B-REG-002: 브랜드 수정 및 상표권 파일 보기](../02_SCREENSHOTS/SCR-B-REG-002.png)  
*그림 2.2: 브랜드 수정 화면의 상표권 번호 및 첨부 서류 확인 링크*

---

## 제3장: 전성분 선언 및 AI 영문 번역기 활용

### 3.1 국문/영문 전성분 입력 및 첨부파일
상품 상세 페이지 (\`/portal/products/[id]\`)의 **[기본 정보]** 탭 내 전성분 영역에서 다음 항목을 설정합니다:
- **전성분 텍스트**: 제품에 함유된 전체 성분을 함량순으로 작성합니다.
- **국문/영문 전성분표 파일**: PDF 또는 이미지 파일 형태로 전성분표 문서를 업로드합니다.

### 3.2 AI 기반 실시간 영문 번역기 활용
1. **[전성분 텍스트 (국문)]** 필드에 한국어 전성분 목록을 작성합니다.
2. 하단의 **[번역하기 (Translate)]** 버튼을 클릭합니다.
3. 시스템이 AI 번역 엔진을 통해 화장품 표준 **INCI (International Nomenclature of Cosmetic Ingredients)** 명칭으로 자동 번역하여 프리뷰 상자에 표시합니다.
4. 번역 결과를 확인한 후 **[리뷰 완료 및 적용 (Apply to field)]** 버튼을 누르면 영문 전성분 텍스트 필드에 자동으로 입력됩니다.

![SCR-B-REG-003: 전성분 입력 및 번역 버튼](../02_SCREENSHOTS/SCR-B-REG-003.png)  
*그림 3.1: 전성분 입력란 하단의 AI 번역 실행 위젯*

![SCR-B-REG-004: AI 번역 결과 프리뷰 및 적용](../02_SCREENSHOTS/SCR-B-REG-004.png)  
*그림 3.2: AI 영문 INCI 번역 완료 결과 확인 및 적용*

> [!NOTE]
> **전성분 서류 관리 안내**: 전성분 관련 증빙 문서(전성분 분석표, MSDS, COA 등)는 **[인허가 & 보증서]** 탭(Tab 6)의 **[성분 인증]** (\`ingredient_certification\`) 카테고리를 이용하여 별도로 업로드하고 관리할 수 있습니다.

---

## 제4장: 상품 인증 서류 업로드 및 버전 관리

### 4.1 서류 종류 (Certificate Category) 구분
상품 상세 페이지 (\`/portal/products/[id]\`)의 **[인허가 & 보증서]** 탭 (Tab 6)에서 제공하는 5가지 서류 카테고리는 다음과 같습니다:

| 서류 종류 코드 | UI 표시 명칭 | 파일 설명 및 업로드 예시 |
| :--- | :--- | :--- |
| \`fda_registration\` | FDA 등록 | FDA 시설 등록(FFRM) 및 제품 리스팅(PDRM) 관련 증빙 서류 |
| \`trademark\` | 상표권 | 특정 상품 관련 상표권 등록 서류 |
| \`ingredient_certification\` | 성분 인증 | 전성분 분석표, MSDS (물질안전보건자료), COA (시험성적서) 등 |
| \`patent\` | 특허 | 용기 구조, 성분 추출 기술 특허증 |
| \`other\` | 기타 | 위생 허가증, 자유판매증명서(CFS) 및 기타 보증 서류 |

> [!NOTE]
> **MSDS / COA 서류 업로드 안내**: MSDS(Safety Data Sheet) 및 COA(Certificate of Analysis)는 독립된 별도 시스템 메뉴가 아니며, **[성분 인증]** (\`ingredient_certification\`) 또는 **[기타]** (\`other\`) 서류 카테고리를 선택하여 업로드하시면 됩니다.

### 4.2 서류 업로드 및 버전 관리 (Version Control) 규칙
1. **[인허가 & 보증서]** 탭 하단의 서류 등록 서식에서 서류 종류를 선택하고 PDF/이미지 파일을 선택한 뒤 **[등록]**을 누릅니다.
2. 동일한 서류 종류로 새 파일을 등록하면:
   - 이전 업로드 파일: \`is_current: false\` 상태로 자동 변경되어 이력으로 보존됩니다.
   - 신규 업로드 파일: \`version\` 번호가 \`+1\` 증가(예: Version 1 -> Version 2)하며 최신 서류(\`is_current: true\`)로 지정됩니다.

![SCR-B-REG-005: 인허가 & 보증서 탭 목록 및 버전 표시](../02_SCREENSHOTS/SCR-B-REG-005.png)  
*그림 4.1: 등록된 인허가 서류 목록과 버전(Version 1) 표시*

![SCR-B-REG-006: 서류 종류 선택 드롭다운](../02_SCREENSHOTS/SCR-B-REG-006.png)  
*그림 4.2: 5가지 표준 서류 카테고리 선택 드롭다운*

---

## 제5장: 바코드 검증 및 문의 채널 안내

### 5.1 UPC / EAN 바코드 유효성 검증
상품의 최종 등록 상태가 \`COMPLETE (등록 완료)\`가 되기 위해서는 식별 바코드가 필수적으로 검증되어야 합니다.
- **UPC 바코드**: 정확히 **12자리 숫자** (\`/^\\d{12}$/\`)
- **EAN 바코드**: 정확히 **13자리 숫자** (\`/^\\d{13}$/\`)

> [!IMPORTANT]
> **바코드 포맷 오류**: 12자리/13자리 규칙에 맞지 않는 문자나 자리수가 입력되면 등록 평가기(Registration Evaluator)에 의해 제품 상태가 \`Draft (보완 대기)\`로 지정됩니다. 바코드가 없는 경우 입력란 우측의 **[💬 바코드 문의]** 링크를 클릭하여 지원을 요청하십시오.

![SCR-B-REG-007: 바코드 및 식별 관리 번호 입력란](../02_SCREENSHOTS/SCR-B-REG-007.png)  
*그림 5.1: 식별 바코드(UPC/EAN) 입력란 및 바코드 문의 지원 링크*

---

## 제6장: 어드민 서류 확인 및 상태 동기화

### 6.1 어드민(Admin) 검증 및 서류 열람
1. 브랜드사가 등록한 상표권 서류 및 인허가 보증서는 어드민 상세 화면(\`https://admin.kselectnetwork.com/admin/brands/[brandId]\` 및 \`/admin/products/[id]\`)에서 담당자에 의해 실시간 검증됩니다.
2. 어드민 사용자는 브랜드사가 제출한 상표권 및 인허가 증빙 파일을 \`[보기]\` 또는 \`[다운로드]\`를 통해 서류 원본을 확인할 수 있습니다.

![SCR-B-REG-008: 어드민 브랜드 상세 화면 서류 확인](../02_SCREENSHOTS/SCR-B-REG-008.png)  
*그림 6.1: 어드민 상표권 정보 카드 및 증빙 파일 열람/다운로드 버튼*

### 6.2 데이터 변경 감사 이력 (Change History Audit)
브랜드사 또는 어드민이 전성분, 상표권, 인허가 보증서 파일을 수정·삭제·추가하면 \`product_change_history\` 모듈에 변경 내역이 기록되며, 어드민과 브랜드 포털 간 실시간 경로 재검증(\`revalidatePath\`)이 수행됩니다.
`);

// 6. 02_SCREENSHOTS/SCREENSHOT_ANNOTATION_GUIDE.md
writeAndFlush(path.join(baseDir, '02_SCREENSHOTS', 'SCREENSHOT_ANNOTATION_GUIDE.md'), `# SCREENSHOT_ANNOTATION_GUIDE.md
## Production Screenshot Annotation & Callout Specifications

**Manual ID:** \`MAN-B-REG-001\`  
**Document Type:** Screenshot Callout, Highlighting & Annotation Instructions  
**Asset Folder:** \`02_SCREENSHOTS/\`  

---

## 1. Screenshot Asset Inventory & Annotation Specs

### Asset 1: \`SCR-B-REG-001.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/brands/new\`
- **Screen**: Brand Registration Form
- **Target Chapter**: Chapter 2 (Section 2.2)
- **Callout Highlights**:
  1. Red callout box around KIPO checkbox & registration number input.
  2. Red callout box around USPTO checkbox & number input.
- **Caption**: \`그림 2.1: 브랜드 신규 개설 화면의 KIPO / USPTO 상표권 선택 및 증빙 파일 첨부 영역\`

### Asset 2: \`SCR-B-REG-002.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/brands/[id]\`
- **Screen**: Brand Information Edit Page
- **Target Chapter**: Chapter 2 (Section 2.3)
- **Callout Highlights**:
  1. Highlight \`[보유]\` status badge in green.
  2. Highlight \`[보기]\` signed URL link.
- **Caption**: \`그림 2.2: 브랜드 수정 화면의 상표권 번호 및 첨부 서류 확인 링크\`

### Asset 3: \`SCR-B-REG-003.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/products/[id]\`
- **Screen**: Product Detail (Basic Info / Ingredients Section)
- **Target Chapter**: Chapter 3 (Section 3.1 & 3.2)
- **Caption**: \`그림 3.1: 전성분 입력란 하단의 AI 번역 실행 위젯\`

### Asset 4: \`SCR-B-REG-004.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/products/[id]\`
- **Screen**: Product Detail (AI Translation Result Preview)
- **Target Chapter**: Chapter 3 (Section 3.2)
- **Caption**: \`그림 3.2: AI 영문 INCI 번역 완료 결과 확인 및 적용\`

### Asset 5: \`SCR-B-REG-005.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/products/[id]#certs\`
- **Screen**: Product Detail — Tab 6 (\`인허가 & 보증서\`)
- **Target Chapter**: Chapter 4 (Section 4.1 & 4.2)
- **Caption**: \`그림 4.1: 등록된 인허가 서류 목록과 버전(Version 1) 표시\`

### Asset 6: \`SCR-B-REG-006.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/products/[id]#certs\`
- **Screen**: Certificate Upload Form Category Dropdown
- **Target Chapter**: Chapter 4 (Section 4.1)
- **Caption**: \`그림 4.2: 5가지 표준 서류 카테고리 선택 드롭다운\`

### Asset 7: \`SCR-B-REG-007.png\`
- **URL**: \`https://portal.kselectnetwork.com/portal/products/[id]\`
- **Screen**: Basic Info — Logistics & Barcode Section
- **Target Chapter**: Chapter 5 (Section 5.1 & 5.2)
- **Callout Highlights**:
  1. Red callout box around \`[식별 관리 번호 (UPC / EAN)]\` inputs (\`12자리 UPC\` / \`13자리 EAN\`).
  2. Circle around \`[💬 바코드 문의]\` support link.
- **Caption**: \`그림 5.1: 식별 바코드(UPC/EAN) 입력란 및 바코드 문의 지원 링크\`

### Asset 8: \`SCR-B-REG-008.png\`
- **URL**: \`https://admin.kselectnetwork.com/admin/brands/[brandId]\`
- **Screen**: Admin Brand Detail Page
- **Target Chapter**: Chapter 6 (Section 6.1)
- **Caption**: \`그림 6.1: 어드민 상표권 정보 카드 및 증빙 파일 열람/다운로드 버튼\`
`);

// 7. 03_DIAGRAMS/REGULATORY_ARCHITECTURE_DIAGRAMS.md
writeAndFlush(path.join(baseDir, '03_DIAGRAMS', 'REGULATORY_ARCHITECTURE_DIAGRAMS.md'), `# REGULATORY_ARCHITECTURE_DIAGRAMS.md
## Regulatory, Certification & Compliance Process Diagrams

**Manual ID:** \`MAN-B-REG-001\`  
**Document Type:** Process Architecture & Technical Diagrams  
**Asset Folder:** \`03_DIAGRAMS/\`  

---

## 1. Compliance Lifecycle & Product Completion Evaluator Diagram

\`\`\`mermaid
flowchart TD
    Start["Brand Portal Access"] --> Step1["Step 1: Brand Registration & Trademark Declaration"]
    Step1 --> CheckTM{"Has Trademark?"}
    CheckTM -- "Yes (KIPO / USPTO)" --> TMUpload["Enter Reg Number & Upload Proof PDF"]
    CheckTM -- "No / Pending" --> SkipTM["Continue Brand Registration (Policy 02)"]
    
    TMUpload --> Step2["Step 2: Product Creation & Catalog Identification"]
    SkipTM --> Step2
    
    Step2 --> RegInputs["Input Identification Data: UPC/EAN"]
    RegInputs --> IngInput["Input Ingredients (Korean Text / PDF)"]
    IngInput --> AITrans["Click AI Translation Widget (Korean -> English INCI)"]
    AITrans --> ApplyEN["Apply English INCI Text & Upload English PDF"]
    
    ApplyEN --> Step3["Step 3: Document Upload (FDA, MSDS, COA, Patents)"]
    Step3 --> CertSelect["Select Certificate Type: fda_registration / ingredient_certification / etc."]
    CertSelect --> FileUpload["Upload PDF/Image to company-uploads Bucket"]
    
    FileUpload --> EvalCheck{"Registration Evaluator Check"}
    EvalCheck -- "Missing UPC / Ingredients" --> StatusDraft["Status: DRAFT (보완 대기)"]
    EvalCheck -- "All Identification & Catalog Fields Valid" --> StatusComplete["Status: COMPLETE (등록 완료)"]
    
    StatusDraft --> Revisit["Brand User Updates Required Fields"]
    Revisit --> EvalCheck
    
    StatusComplete --> AdminAudit["Admin Audit & System Revalidation"]
\`\`\`

---

## 2. Certificate Version Control Data Flow

\`\`\`mermaid
flowchart TD
    A["Upload New Certificate File (e.g. FDA Registration or MSDS PDF)"] --> B["Query Existing Certificates for product_id + certificate_type"]
    B --> C{"Existing Certificate Found?"}
    C -- "Yes" --> D["Set Existing File is_current = false"]
    D --> E["Increment Next Version = Current Version + 1"]
    C -- "No" --> F["Set Next Version = 1"]
    E --> G["Insert New Record into product_certificates (is_current = true)"]
    F --> G
    G --> H["Record Audit Log in product_change_history"]
    H --> I["Trigger revalidatePath for Product Detail & Admin Views"]
\`\`\`
`);

// 8. 04_REFERENCE/REFERENCE_GUIDE.md
writeAndFlush(path.join(baseDir, '04_REFERENCE', 'REFERENCE_GUIDE.md'), `# REFERENCE_GUIDE.md
## Technical Reference, Glossary & System Boundary Specifications

**Manual ID:** \`MAN-B-REG-001\`  
**Document Type:** Glossary & Technical Specifications Reference  
**Asset Folder:** \`04_REFERENCE/\`  

---

## 1. Terminology Glossary

| Term / Abbreviation | Full Name | System Definition & Usage |
| :--- | :--- | :--- |
| **KIPO** | Korean Intellectual Property Office | 대한민국 특허청. 브랜드 등록 시 국내 상표권 보유 여부 및 등록번호 식별자. |
| **USPTO** | United States Patent and Trademark Office | 미국 특허청. 브랜드 등록 시 미국 상표권 보유 여부 및 등록번호 식별자. |
| **INCI** | International Nomenclature of Cosmetic Ingredients | 국제 화장품 성분 명칭. 전성분 영문 텍스트 표기 시 사용되는 화학/식물 명칭 표준. |
| **UPC** | Universal Product Code | 미국/북미 리테일 표준 12자리 숫자 바코드. |
| **EAN** | European Article Number | 글로벌 표준 13자리 숫자 바코드. |
| \`CertificateType\` | Product Certificate Enum | \`fda_registration\`, \`trademark\`, \`ingredient_certification\`, \`patent\`, \`other\`. |
| \`version\` | Document Version Number | \`product_certificates\` 테이블의 integer 컬럼. 신규 업로드 시 자동 +1 증가. |
| \`is_current\` | Active File Flag | \`product_certificates\` 테이블의 boolean 컬럼. \`true\`인 경우 최신 활성 문서로 지정. |

---

## 2. Common System Validation Messages & Resolution Guide

| Validation Trigger | System UI Message | Root Cause & Resolution |
| :--- | :--- | :--- |
| **Barcode Format Error** | \`[기본 정보: 식별 바코드(UPC/EAN)]\` missing field warning | UPC가 12자리 숫자가 아니거나 EAN이 13자리 숫자가 아님. 숫자 자리수를 교정하거나 \`[💬 바코드 문의]\` 단추를 이용. |
| **File Type Validation Error** | \`허용되지 않는 파일 형식입니다.\` | 업로드 파일이 PDF 또는 이미지(\`JPG\`, \`PNG\`, \`WEBP\`)가 아님. 허용 포맷으로 변환 후 업로드. |
| **File Size Limit Exceeded** | \`파일 용량이 초과되었습니다.\` | 업로드 파일 크기가 10MB를 초과함. 파일 압축 후 다시 시도. |
| **Duplicate Brand Name Error** | \`이미 같은 이름의 브랜드가 등록되어 있습니다.\` | 동일 회사 내에 같은 이름의 활성 브랜드가 존재함. 기존 브랜드를 수정하거나 이름을 구분. |

---

## 3. Strict System Boundary Summary

- **MAN-B-PROD-001 Reference**: 일반 상품 생성, 이미지 업로드, SKU 관리, 물류 규격 입력 등 카탈로그 작성법은 \`MAN-B-PROD-001\` 매뉴얼을 참조합니다.
- **Future Enhancements (Excluded)**: FDA Listing Number 텍스트 필드, Compliance Status 뱃지 시각화, US Agent Agreement 전용 타입 등 미구현 기능은 이번 매뉴얼 범위에 포함되지 않습니다.
`);

console.log("=== PACKAGE CORRECTIONS WRITTEN & FLUSHED SUCCESSFULLY ===");
