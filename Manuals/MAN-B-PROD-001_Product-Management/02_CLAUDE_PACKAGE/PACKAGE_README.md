# MAN-B-PROD-001: Claude Design Package README

**Manual ID:** `MAN-B-PROD-001`  
**Manual Name:** `Brand Portal Product Registration & Management Guide (상품 등록 및 관리 매뉴얼)`  
**Audience:** `B — Brand`  
**Version:** `v1.0`  
**Package Status:** `READY FOR CLAUDE DESIGN`  
**Package Location:** `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/`  
**Source Audit Location:** `Manuals/MAN-B-PROD-001_Product-Management/01_SOURCE/`  
**Published Location (Target):** `Manuals/MAN-B-PROD-001_Product-Management/03_PUBLISHED/`  
**Archive Location:** `Manuals/MAN-B-PROD-001_Product-Management/04_ARCHIVE/`  

---

## 1. Package Purpose & Overview

본 패키지(`02_CLAUDE_PACKAGE`)는 **K SELECT Brand Portal 상품 등록 및 관리 공식 매뉴얼(`MAN-B-PROD-001`)**을 Claude Design에서 완성도 높은 B2B User Document 및 PDF 형태로 직접 제작할 수 있도록 필요한 모든 **Content(15개 완성형 챕터 원문), 실제 Production Screenshot(스크린샷 14종 전수 캡처), Screenshot Annotation Guide(콜아웃 가이드), 4대 Architecture Diagrams(라이프사이클, 6대 탭, 로지스틱스 3계층, 3대 상태 차원), Reference Guide(출처 추적성 & 브랜드 에셋), Design Structure(레이아웃 명세) 및 Master/Handoff Prompt**를 일체화하여 구성한 표준 핸드오프 패키지입니다.

---

## 2. K SELECT Official Manual Folder Standard

모든 K SELECT Manual은 아래 4단계 표준 폴더 구조를 사용합니다:

```text
Manuals/MAN-B-PROD-001_Product-Management/
├── 01_SOURCE/                                # Code/DB/UI 전수 감사 보고서 및 필드/워크플로우 인벤토리
├── 02_CLAUDE_PACKAGE/                        # Claude Design에 전달할 최종 제작 Package
├── 03_PUBLISHED/                             # Chae 최종 승인이 완료된 공식 Published Manual 보관 (.gitkeep)
└── 04_ARCHIVE/                               # 이전 버전 또는 교체된 레거시 Manual 보관 (.gitkeep)
```

---

## 3. Package Folder Structure & Contents

```text
Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/
├── 01_CONTENT/
│   └── MAN-B-PROD-001_Manual_Content.md         # 전체 15개 섹션 완성형 원문 텍스트 (Strict Source Integrity)
├── 02_SCREENSHOTS/
│   ├── PROD-SCR-001_Product_List_Main.png       # 상품 목록 화면 (/portal/products)
│   ├── PROD-SCR-002_Bulk_Delete_Modal.png       # 상품 일괄 삭제 및 모달 (/portal/products)
│   ├── PROD-SCR-003_New_Product_Form_Upper.png  # 신규 등록 폼 상단 (기본정보, 카테고리, 바코드)
│   ├── PROD-SCR-004_New_Product_Form_Lower.png  # 신규 등록 폼 하단 (가격, 채널, 규격, 2가지 제출)
│   ├── PROD-SCR-005_Product_Detail_Header_Tabs.png # 상품 상세 헤더 및 6대 탭 네비게이션
│   ├── PROD-SCR-006_Draft_Missing_Fields_Banner.png # 보완 대기(Draft) 배너 및 자동 포커스 네비게이션
│   ├── PROD-SCR-007_Tab1_Basic_Info.png         # 탭 1: 기본 정보 및 실시간 전성분 번역기
│   ├── PROD-SCR-008_Tab2_Category_3Depth_Selector.png # 탭 2: 3-Depth 카테고리 계층 선택기
│   ├── PROD-SCR-009_Tab2_Dynamic_Attributes.png # 탭 2: 카테고리 동적 속성 폼
│   ├── PROD-SCR-010_Tab3_Pricing_Margin_Tiers.png # 탭 3: 4대 가격 체계, FOB 마진, 수량별 공급가
│   ├── PROD-SCR-011_Tab4_Logistics_3Tier_Specs.png # 탭 4: 단품/패키지/마스터 카톤 3단계 규격 & CBM
│   ├── PROD-SCR-012_Tab4_Container_Simulator.png # 탭 4: 20FT/40FT/40HQ 컨테이너 적재 시뮬레이터
│   ├── PROD-SCR-013_Tab5_Media_Images_Reorder.png # 탭 5: 미디어 드래그앤드롭 순서변경 & 고해상도 줌
│   ├── PROD-SCR-014_Tab6_Tab7_Certs_And_Audit_Log.png # 탭 6: 인허가 & 보증서 서류 업로드 및 파일 버전 관리
│   └── SCREENSHOT_ANNOTATION_GUIDE.md        # 스크린샷별 번호 콜아웃(①, ②, ③, ④) 및 캡션 가이드
├── 03_DIAGRAMS/
│   └── PRODUCT_ARCHITECTURE_DIAGRAMS.md      # 4대 핵심 아키텍처 다이어그램 (Mermaid)
├── 04_REFERENCE/
│   ├── REFERENCE_GUIDE.md                    # 출처 추적성 매트릭스, 상위 정책 연계 & 컬러 시스템
│   ├── ksn-logo-new.png                      # K SELECT 풀 컬러 로고
│   ├── ksn-logo-dark.png                     # K SELECT 다크 모드 로고
│   ├── ksn-symbol.png                        # K SELECT 심볼 아이콘
│   └── apple-touch-icon.png                  # 파비콘 / 앱 아이콘
├── MAN-B-PROD-001_Design_Structure.md        # 페이지별 레이아웃 명세 및 타이포그래피 가이드
├── CLAUDE_DESIGN_MASTER_PROMPT.md            # Claude Design 상세 제작 명세서 (Master Prompt)
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md           # Claude Design 채팅창 복사용 짧은 실행 지시문 (Handoff Prompt)
└── PACKAGE_README.md                         # 본 패키지 설명서
```

---

## 4. How to Execute Handoff to Claude Design

1. `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/` 폴더 전체를 Claude Design 세션에 첨부합니다.
2. `CLAUDE_DESIGN_HANDOFF_PROMPT.md` 파일에 작성된 짧은 지시문을 복사하여 Claude Design 채팅창에 입력합니다.
3. Claude Design이 `CLAUDE_DESIGN_MASTER_PROMPT.md`와 `01_CONTENT/MAN-B-PROD-001_Manual_Content.md`를 기반으로 매뉴얼 문서를 제작합니다.
4. Chae의 최종 검토 및 승인이 완료되면 최종 PDF가 `03_PUBLISHED/`에 저장됩니다.
