# MAN-B-ONB-001: Claude Design Package README

**Manual ID:** `MAN-B-ONB-001`  
**Manual Name:** `Brand Portal Onboarding Guide`  
**Version:** `v1.0`  
**Package Status:** `READY FOR CLAUDE DESIGN`  
**Package Location:** `Manuals/MAN-B-ONB-001_Onboarding/02_CLAUDE_PACKAGE/`  
**Source Audit Location:** `Manuals/MAN-B-ONB-001_Onboarding/01_SOURCE/`  
**Published Location (Target):** `Manuals/MAN-B-ONB-001_Onboarding/03_PUBLISHED/`  
**Archive Location:** `Manuals/MAN-B-ONB-001_Onboarding/04_ARCHIVE/`  

---

## 1. Package Purpose & Overview

본 패키지(`02_CLAUDE_PACKAGE`)는 **K SELECT Brand Portal 온보딩 공식 매뉴얼(`MAN-B-ONB-001`)**을 Claude Design에서 완성도 높은 B2B Document 및 PDF 형태로 직접 제작할 수 있도록 필요한 모든 **Content(원문), 실제 Production Screenshot(스크린샷 10종), Annotation Guide(콜아웃 가이드), Workflow Diagram(흐름도), Reference(로고/참고자료) 및 Master/Handoff Prompt**를 일체화하여 구성한 표준 핸드오프 패키지입니다.

---

## 2. K SELECT Official Manual Folder Standard

모든 K SELECT Manual은 아래 4단계 표준 폴더 구조를 사용합니다:

```text
Manuals/MAN-B-ONB-001_Onboarding/
├── 01_SOURCE/                                # Code/DB/UI 조사자료 및 Source Collection Report
├── 02_CLAUDE_PACKAGE/                        # Claude Design에 전달할 최종 제작 Package
├── 03_PUBLISHED/                             # Chae 최종 승인이 완료된 공식 Published Manual 보관 (.gitkeep)
└── 04_ARCHIVE/                               # 이전 버전 또는 교체된 레거시 Manual 보관 (.gitkeep)
```

---

## 3. Package Folder Structure & Contents

```text
Manuals/MAN-B-ONB-001_Onboarding/02_CLAUDE_PACKAGE/
├── 01_CONTENT/
│   └── MAN-B-ONB-001_Manual_Content.md         # 전체 12개 챕터 완성형 원문 텍스트 (Strict Source Integrity)
├── 02_SCREENSHOTS/
│   ├── ONB-SS-01_Signup-Public.png           # 파트너십 가입 내역 조회 (/portal/signup)
│   ├── ONB-SS-02_Onboarding-Overview.png     # 온보딩 대시보드 7단계 체크리스트 (/portal)
│   ├── ONB-SS-03_Company-Information.png     # STEP 1: 회사 정보 관리 (/portal/company/info)
│   ├── ONB-SS-04_Admin-Profile.png           # STEP 2: 관리자 프로필 (/portal/account)
│   ├── ONB-SS-05_Brand-Information.png       # STEP 3: 브랜드 관리 (/portal/brands)
│   ├── ONB-SS-06_Team-Invitation.png         # STEP 4: 소속 사용자 관리 (/portal/company/users)
│   ├── ONB-SS-07_Task-Assignment.png         # STEP 5: 6대 담당업무 관리 (/portal/company/info?tab=tasks)
│   ├── ONB-SS-08_Product-Registration.png    # STEP 6: 상품 관리 (/portal/products)
│   ├── ONB-SS-09_Agreement-Signing.png       # STEP 7: 공급계약 전자서명 (/portal/company/info?tab=agreements)
│   ├── ONB-SS-10_Help-Center-Entry.png       # Brand Help Center (/portal/help)
│   └── SCREENSHOT_ANNOTATION_GUIDE.md        # 스크린샷별 번호 콜아웃(①, ②, ③) 및 캡션 가이드
├── 03_DIAGRAMS/
│   └── ONBOARDING_7_STEP_FLOW.md             # 7-Step 온보딩 사용자 흐름 다이어그램 (Mermaid/ASCII)
├── 04_REFERENCE/
│   ├── REFERENCE_GUIDE.md                    # MAN-BRAND-001 연계 가이드 및 브랜드 컬러 팔레트
│   ├── ksn-logo-new.png                      # K SELECT 풀 컬러 로고
│   ├── ksn-logo-dark.png                     # K SELECT 다크 모드 로고
│   ├── ksn-symbol.png                        # K SELECT 심볼 아이콘
│   └── apple-touch-icon.png                  # 파비콘 / 앱 아이콘
├── CLAUDE_DESIGN_MASTER_PROMPT.md            # Claude Design 상세 제작 명세서 (Master Prompt)
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md           # Claude Design 채팅창 복사용 짧은 실행 지시문 (Handoff Prompt)
└── PACKAGE_README.md                         # 본 패키지 설명서
```

---

## 4. How to Execute Handoff to Claude Design

1. `Manuals/MAN-B-ONB-001_Onboarding/02_CLAUDE_PACKAGE/` 폴더 전체를 Claude Design 세션에 첨부합니다.
2. `CLAUDE_DESIGN_HANDOFF_PROMPT.md` 파일에 작성된 짧은 지시문을 복사하여 Claude Design 채팅창에 입력합니다.
3. Claude Design이 `CLAUDE_DESIGN_MASTER_PROMPT.md`와 `MAN-B-ONB-001_Manual_Content.md`를 기반으로 매뉴얼 문서를 제작합니다.
4. Chae의 최종 검토 및 승인이 완료되면 최종 PDF가 `03_PUBLISHED/`에 저장됩니다.
