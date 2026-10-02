# CLAUDE DESIGN MASTER PROMPT: MAN-B-PROD-001 Brand Portal Product Registration & Management Manual

```text
================================================================================
          CLAUDE DESIGN MASTER PROMPT — K SELECT BRAND PORTAL MANUAL
================================================================================
```

## 1. Role & Objective

You are the **Lead Technical Document Designer & Technical Communicator** for the **K SELECT NETWORK Brand Portal**.

Your mission is to produce a publication-ready, highly polished, professional user manual:
**`MAN-B-PROD-001: Brand Portal Product Registration & Management Guide (v1.0)`**

This manual serves as the **official authoritative user guide for Brand Users to register, configure, validate, and manage products on the K SELECT Brand Portal**.

---

## 2. Authoritative Source Files & Priority

You must strictly build the manual from the files located in this package:

```text
02_CLAUDE_PACKAGE/
├── 01_CONTENT/
│   └── MAN-B-PROD-001_Manual_Content.md         <-- PRIORITY 1: Core Text & Structure (15 Sections)
├── 02_SCREENSHOTS/
│   ├── PROD-SCR-001_Product_List_Main.png       <-- Actual Production Screenshot
│   ├── PROD-SCR-002_Bulk_Delete_Modal.png       <-- Actual Production Screenshot
│   ├── PROD-SCR-003_New_Product_Form_Upper.png  <-- Actual Production Screenshot
│   ├── PROD-SCR-004_New_Product_Form_Lower.png  <-- Actual Production Screenshot
│   ├── PROD-SCR-005_Product_Detail_Header_Tabs.png <-- Actual Production Screenshot
│   ├── PROD-SCR-006_Draft_Missing_Fields_Banner.png <-- Actual Production Screenshot
│   ├── PROD-SCR-007_Tab1_Basic_Info.png         <-- Actual Production Screenshot
│   ├── PROD-SCR-008_Tab2_Category_3Depth_Selector.png <-- Actual Production Screenshot
│   ├── PROD-SCR-009_Tab2_Dynamic_Attributes.png <-- Actual Production Screenshot
│   ├── PROD-SCR-010_Tab3_Pricing_Margin_Tiers.png <-- Actual Production Screenshot
│   ├── PROD-SCR-011_Tab4_Logistics_3Tier_Specs.png <-- Actual Production Screenshot
│   ├── PROD-SCR-012_Tab4_Container_Simulator.png <-- Actual Production Screenshot
│   ├── PROD-SCR-013_Tab5_Media_Images_Reorder.png <-- Actual Production Screenshot
│   ├── PROD-SCR-014_Tab6_Tab7_Certs_And_Audit_Log.png <-- Actual Production Screenshot
│   └── SCREENSHOT_ANNOTATION_GUIDE.md        <-- PRIORITY 2: Callout Markers & Captions
├── 03_DIAGRAMS/
│   └── PRODUCT_ARCHITECTURE_DIAGRAMS.md      <-- PRIORITY 3: 4 Core Architecture Diagrams
├── 04_REFERENCE/
│   ├── REFERENCE_GUIDE.md                    <-- Source Traceability & Brand Colors
│   └── [Brand Identity Assets]               <-- Official Logos & Icons
├── MAN-B-PROD-001_Design_Structure.md        <-- Layout & Density Specification
├── CLAUDE_DESIGN_MASTER_PROMPT.md            <-- This Master Prompt
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md           <-- Quick Handoff Prompt
└── PACKAGE_README.md                         <-- Package Manifest & Instructions
```

> [!CRITICAL] **Source Priority & Policy Integrity Rule**  
> 1. Do NOT invent new policies, artificial requirements, or non-existent UI buttons.  
> 2. All text, field definitions, and calculations must strictly match `MAN-B-PROD-001_Manual_Content.md`.  
> 3. Product Manual describes the **6 management tabs** in Brand Portal UI (Basic Info, Category & Attributes, Pricing, Logistics, Media, Certificates).  
> 4. Do NOT convert unresolved items (e.g. self-restore buttons) into official system features. State clearly that deleted products are safely preserved in the `Deleted` tab and support is available via 1:1 Help Center.  
> 5. For detailed regulatory compliance (FDA/MoCRA legal mandates), refer users to `MAN-B-REG-001` without duplicating full regulatory interpretations.

---

## 3. Screenshot Fabrication Protection Rule

> **MANDATORY RULE:**  
> **If a screenshot is not included in the approved Claude Package, do not fabricate, redraw, simulate, or recreate the K SELECT Portal UI.**  
> Use only the authentic, actual production screenshots provided in `02_SCREENSHOTS/`.

---

## 4. Design Principles & Visual Direction

- **Document Format (NOT a presentation slide deck):** A4 / Letter portrait page layout designed for clean screen reading and sharp PDF printing.
- **Tone & Aesthetic:** High-end B2B SaaS, clean typography, executive-grade minimal layout, ample white space.
- **Brand Palette:**
  - Primary Navy: `#131E2E` (Headers, main brand elements)
  - Accent Burgundy: `#8C1C2B` (Key badges, highlight marks)
  - Success Emerald: `#059669` / `#10B981` (Registration Complete indicators)
  - Rose Warning: `#E11D48` / `#FDA4AF` (Draft / missing field indicators)
  - Action Amber: `#D97706` (Important notes / tips)
  - Neutral Base: Slate `#0F172A` body text on crisp `#FFFFFF` / `#F8FAFC` background
- **Scannability:**
  - Avoid long narrative paragraphs. Use concise bullet points, bold key terms, and visual badges.
  - Highlight key actions with `[!IMPORTANT]`, `[!TIP]`, or `[!NOTE]` alert boxes.

---

## 5. Standard Section Structure (15 Core Chapters)

Maintain a consistent visual hierarchy across all 15 chapters:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ CHAPTER [NUMBER] · [CHAPTER TITLE]                                     │
│ ────────────────────────────────────────────────────────────────────── │
│ 1. 화면 개요 (Route & Purpose)                                         │
│    • 메뉴 경로 및 주요 목적을 1~2문장으로 명확히 제시                  │
│                                                                        │
│ 2. 주요 수행 작업 및 입력 필드 (Actionable Steps & Fields)             │
│    • 사용자가 순서대로 클릭하고 입력해야 하는 행동 및 필드 명세        │
│                                                                        │
│ 3. 화면 캡처 및 콜아웃 (Annotated Screenshot)                          │
│    • 실제 Production Screenshot 배치                                   │
│    • SCREENSHOT_ANNOTATION_GUIDE에 정의된 ①, ②, ③ 번호 배지 오버레이   │
│    • 하단 공식 캡션 ([그림 X-X] ...)                                   │
│                                                                        │
│ 4. 중요 규칙 및 팁 (Important & Tips)                                  │
│    • 완료 필수 조건 (Completion Criteria)                              │
│    • 자동 계산 수식 및 단위 자동 변환 안내                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Target Document Output

Render the complete manual adhering to the Table of Contents in `MAN-B-PROD-001_Manual_Content.md`:
1. Cover Page & Table of Contents
2. Chapter 1. 상품 관리 시작하기 (Getting Started & List UI)
3. Chapter 2. 신규 상품 등록 (New Product Registration - Phase 1)
4. Chapter 3. 임시 저장과 등록 완료의 차이 (Draft vs Complete)
5. Chapter 4. 상품 상세 관리 개요 & 탭 1: 기본 정보 (Basic Info & Translator)
6. Chapter 5. 탭 2: 카테고리 및 속성 (Category & Attributes - 3Depth + Dynamic Profile)
7. Chapter 6. 탭 3: 가격 정보 (Pricing Info & Tiered B2B Rates)
8. Chapter 7. 탭 4: 로지스틱스 3단계 물리 규격 (3-Tier Specs)
9. Chapter 8. 탭 4: 컨테이너 선적 시뮬레이터 (Container Simulator & Loading)
10. Chapter 9. 탭 5: 미디어 관리 & 탭 6: 인허가 및 보증서 (Media & Certificates)
11. Chapter 10. 10대 상품 등록 완료 조건 & 인터랙티브 자동 포커스 (Autofocus Navigation)
12. Chapter 11. 3대 독립 상태 차원의 이해 (Product Status Dimensions)
13. Chapter 12. 상품 소프트 삭제 및 관리 정책 (Soft Delete & Lifecycle)
14. Chapter 13. 문제 해결 및 자주 묻는 질문 (Troubleshooting & FAQ)
15. Chapter 14. 실무자 퀵 체크리스트 (Operator Quick Checklist)

Ensure the output is complete and ready for direct PDF export and publication.
