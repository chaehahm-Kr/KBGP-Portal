# MAN-I-DOC-001 — Manual Creation & Update Standard Operating Procedure (SOP)
## K SELECT Internal Operations: Manual Lifecycle, Grounding, Design Packaging, and Knowledge Publishing Guide
### (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드 — Canonical Source)

---

## 1. Document Metadata & Executive Overview

| Field | Canonical Value |
| :--- | :--- |
| **Manual ID** | `MAN-I-DOC-001` |
| **Manual Title (EN)** | K SELECT Manual Creation & Update SOP |
| **Manual Title (KO)** | K SELECT 매뉴얼 제작 및 업데이트 운영 가이드 |
| **Document Classification** | INTERNAL SOP / STAFF & ADMIN ONLY |
| **Audience Scope** | Internal Staff, Operations Managers, Core Developers, Tech Leads |
| **Document Version** | `v1.0.0` (Canonical Baseline) |
| **Effective Date** | 2026-10-02 |
| **Authoritative Domain** | Documentation & Knowledge Management Lifecycle |
| **Related Master Design Reference** | `Manuals/MAN-B-BRAND-001_Brand-Policy/03_PUBLISHED/MAN-B-BRAND-001_Brand-Policy_V1.pdf` |

### 1.1 Executive Purpose
본 표준 운영 절차서(SOP, Standard Operating Procedure)는 K SELECT 네트워크 시스템에서 운영되는 모든 사용자 매뉴얼(Brand Portal Manual, `MAN-B-*`), 내부 운영 매뉴얼(Internal SOP, `MAN-I-*`), 그리고 관리자 매뉴얼(Admin Manual, `MAN-A-*`)의 **발굴·조사(Source) ➔ 설계·패키징(Claude Package) ➔ 디자인·PDF 발행(Design & Publish) ➔ 지식 허브 연동(Knowledge Center) ➔ FAQ 연계(FAQ Publish) ➔ 유지보수 및 버전 관리(Maintenance & Versioning)**에 이르는 전체 라이프사이클을 표준화하기 위해 제정되었습니다.

K SELECT 시스템의 모든 문서는 **"실제 Production 코드베이스 및 데이터베이스 스키마와 100% 일치하는 사실(Ground Truth)"**에 기반하여 작성되어야 하며, 어떠한 가상의 기능, 미구현 상태에 대한 허위 기술, 또는 과장된 보증(Absolute Claims)도 허용되지 않습니다.

---

## 2. K SELECT Manual Repository Architecture & Inventory

K SELECT Repository(`KSelectNetwork-Portal`) 내의 모든 매뉴얼은 루트 디렉터리의 `Manuals/` 하위에서 모듈별 고유 ID 폴더로 관리됩니다.

```text
Manuals/
├── MAN-B-BRAND-001_Brand-Policy/                 # [Published] 브랜드 등록 & 관리 정책 (Master Design Ref)
├── MAN-B-ONB-001_Onboarding/                     # [Published] 브랜드 포털 온보딩 가이드
├── MAN-B-PROD-001_Product-Management/            # [Published] 상품 등록 및 카탈로그/물류스펙 관리
├── MAN-B-REG-001_Regulatory-Compliance/          # [Published] FDA, 인허가, 상표권 및 증빙서류 관리
├── MAN-B-RET-001_Retail-Applications/            # [Published] 리테일 입점 신청 및 심사 관리
├── MAN-B-ORD-001_Order-Management/               # [Published] 발주 요청(PO) 및 주문 처리 관리
├── MAN-B-LOG-001_Shipping-Logistics/             # [Published] 출고, 선적 및 국제 물류 운송 관리
├── MAN-B-FIN-001_Finance-Settlement/             # [Published] 인보이스 발행, 정산 조정 및 대금 지급
├── MAN-B-PERM-001_Permissions-User-Management/   # [Published] 회사 정보, 사용자 역할 및 권한 관리
├── MAN-B-TASK-001_Task-Communication/            # [Published] 업무 커뮤니케이션 & 1:1 지원 센터
├── MAN-B-RPT-001_Reports-Performance/            # [Package Stage] 실적 리포트 & 데이터 분석
├── MAN-B-INT-001_Intelligence/                   # [Package Stage] 지식 어시스턴트 & 시장 인텔리전스
├── MAN-B-FAQ-001_Knowledge-FAQ/                  # [Package Stage] 지식 센터 및 FAQ 활용 가이드
└── MAN-I-DOC-001_Manual-SOP/                     # [Canonical Source] 매뉴얼 제작/업데이트 표준 SOP (본 문서)
```

### 2.1 Standard 4-Tier Directory Hierarchy
모든 매뉴얼 폴더는 업무 단계별 격리와 무결성 보장을 위해 다음과 같은 4단계 하위 디렉터리 구조를 엄격히 준수합니다:

```text
Manuals/[MANUAL_ID]_[Title]/
├── 01_SOURCE/                                    # 1단계: 프로덕션 코드/DB 기반 사실 조사 및 기획 문서
│   ├── [MANUAL_ID]_Source.md                     # (또는 [MANUAL_ID]_Source_Collection_Report.md)
│   ├── [MANUAL_ID]_Field_Inventory.md            # UI 컨트롤 & DB 스키마 필드 사전
│   ├── [MANUAL_ID]_Workflow_Map.md               # 상태 머신 및 엔드투엔드 워크플로우 맵
│   └── [MANUAL_ID]_Screenshot_Requirements.md    # 스크린샷 촬영 명세서 및 핀 어노테이션 규격
├── 02_CLAUDE_PACKAGE/                            # 2단계: Claude Design AI 전달용 표준 번들 패키지
│   ├── PACKAGE_README.md                         # 패키지 빌드 가이드 및 자산 매핑
│   ├── CLAUDE_DESIGN_MASTER_PROMPT.md            # Claude Design 마스터 프롬프트
│   ├── CLAUDE_DESIGN_HANDOFF_PROMPT.md           # 디자인 전달 및 자동 퍼블리싱 프롬프트
│   ├── [MANUAL_ID]_Design_Structure.md           # 챕터 구성, 레이아웃 및 핀 배치 명세
│   ├── 01_CONTENT/                               # 원고 본문 ([MANUAL_ID]_Manual_Content.md)
│   ├── 02_SCREENSHOTS/                           # Production 스크린샷 (SCR-*) + SCREENSHOT_ANNOTATION_GUIDE.md
│   ├── 03_DIAGRAMS/                              # 아키텍처 다이어그램 (*_ARCHITECTURE_DIAGRAMS.md)
│   └── 04_REFERENCE/                             # 마스터 디자인 참조 (REFERENCE_GUIDE.md)
├── 03_PUBLISHED/                                 # 3단계: 최종 승인 및 릴리즈된 배포용 PDF 아티팩트
│   └── [MANUAL_ID]_[Title]_V[X].pdf              # 최종 Published PDF (SHA-256 검증 대상)
└── 04_ARCHIVE/                                   # 4단계: 이전 버전 초안, 레거시 PDF 및 중간 산출물 보관
```

---

## 3. End-to-End Manual Lifecycle (13 Sequential Stages)

K SELECT 매뉴얼 엔지니어링은 단순한 "문서 작성"이 아닌 소프트웨어 엔지니어링과 동일한 엄격성을 갖는 13단계의 라이프사이클 파이프라인으로 실행됩니다:

```text
[1. Source Creation] ➔ [2. Source Review (R1)] ➔ [3. Claude Package Creation] ➔ [4. Package File Check]
         ↓
[5. Package QA] ➔ [6. Claude Design Generation] ➔ [7. PDF QA] ➔ [8. Publish] ➔ [9. Publish QA]
         ↓
[10. Knowledge Center Publish]* ➔ [11. Knowledge Publish QA]* ➔ [12. FAQ Publish]* ➔ [13. FAQ QA]*
(*Public/Brand Portal 대상 매뉴얼에 한함. Internal SOP는 9단계에서 완료 가능)
```

### 3.1 Stage 01: Source Creation (코드 & DB 기반 조사)
- **목적**: 프로덕션 UI 경로, 컴포넌트, 서버 액션, API 라우트, DB 스키마, 상태 머신을 전수 조사하여 4대 표준 기획 문서를 작성.
- **필수 입력**: 실서비스 환경(`portal.kselectnetwork.com`, `admin.kselectnetwork.com`), 소스코드(`app/`, `components/`, `lib/`), 마이그레이션 SQL(`supabase/migrations/`).
- **필수 산출물**: `01_SOURCE/` 하위 4개 문서 (`_Source.md`, `_Field_Inventory.md`, `_Workflow_Map.md`, `_Screenshot_Requirements.md`).
- **완료 기준**: 4개 문서 작성 완료, 모든 기술 용어 및 상태 코드가 코드와 1:1 일치.

### 3.2 Stage 02: Source Review & Canonical Correction (SRC-QA / R1)
- **목적**: 작성된 Source 문서의 사실 무결성(Ground Truth)을 감사하고 미구현 기능, 과장된 표현, 도메인 경계 오류를 교정.
- **검증 방법**: 코드 라인 단위 추적, DB 쿼리 실행, 실서비스 UI 대조.
- **산출물**: Source Review Report 및 승인된 R1 문서.
- **완료 기준**: 사실 검증 상태 태그 부여 완료 (`VERIFIED`, `NOT IMPLEMENTED`, `SYSTEM GAP`, `LEGACY`, `PENDING`).

### 3.3 Stage 03: Claude Design Package Creation (PKG)
- **목적**: Claude Design AI가 고품질 레이아웃과 디자인을 직접 생성할 수 있도록 완결된 디자인 패키지 폴더 구성.
- **필수 산출물**: `02_CLAUDE_PACKAGE/` 하위 4개 루트 마크다운 + 4개 하위 디렉터리(`01_CONTENT/`, `02_SCREENSHOTS/`, `03_DIAGRAMS/`, `04_REFERENCE/`).
- **완료 기준**: 마스터 디자인(`MAN-B-BRAND-001`) 명세 연계, 본문 텍스트 내 스크린샷 핀 콜아웃 완벽 매핑.

### 3.4 Stage 04: Package File Check
- **목적**: 물리적 파일 누락, OneDrive 동기화 지연, 빈 파일(0 bytes) 발생 여부를 사전 검사.
- **검증 스크립트**: `node scripts/readback-verify-physical-files.js` 또는 `verify-package-files.ps1`.
- **완료 기준**: 패키지 내 모든 파일의 `File Size > 0 bytes`, 읽기/쓰기 권한 정상.

### 3.5 Stage 05: Package QA (PKG-QA)
- **목적**: Source 4개 문서와 Package 8개 마크다운의 1:1 정합성, 스크린샷 11~14장의 고유 해시(Unique SHA-256) 검증.
- **검증 항목**:
  1. Source ↔ Package 내용 일치율 100%.
  2. 스크린샷 손상 없음, 중복 해시 0건(Unique SHA-256 = N/N).
  3. `SCREENSHOT_ANNOTATION_GUIDE.md`의 Pin 번호와 UI 컨트롤 의미 일치.
- **완료 기준**: Package QA All Green 통과.

### 3.6 Stage 06: Claude Design Generation (디자인 렌더링)
- **목적**: Claude Design 프롬프트를 실행하여 마스터 가이드에 부합하는 웹/PDF 렌더링 산출물 생성.
- **디자인 표준**: Dark Slate/Zinc 테마, 피그마 수준의 카드 그리드, 인디고/에메랄드/앰버/로즈 액센트, 명확한 타이포그래피.
- **완료 기준**: 디자인 초안 PDF 생성 완료.

### 3.7 Stage 07: PDF QA (최종 PDF 검수)
- **목적**: 렌더링된 PDF의 모든 페이지를 시각적·구조적으로 전수 감사.
- **검사 체크리스트**:
  - [ ] 페이지 누락, 중복, 잘림(Cut-off) 여부
  - [ ] 텍스트 오버플로우(Overflow) 및 테이블 줄바꿈 깨짐 여부
  - [ ] 스크린샷 및 다이어그램 가독성, 해상도 저하 여부
  - [ ] 어노테이션 핀(Pin 1, 2, 3...) 위치와 콜아웃 텍스트 정합성
  - [ ] 내부 개발자 메모(`TODO`, `FIXME`, `Developer Note`, 임시 데이터) 잔존 여부
  - [ ] 과장된 보증 표현(`100%`, `Always`, `Real-time`) 존재 여부
- **완료 기준**: PDF QA 검수 보고서 승인.

### 3.8 Stage 08: Publish (공식 배포 자산화)
- **목적**: 승인된 최종 PDF를 배포 디렉터리에 격리 저장하고 프로덕션 제공 자산 폴더로 동기화.
- **배포 경로**:
  - 1차: `Manuals/[MANUAL_ID]/03_PUBLISHED/[MANUAL_ID]_[Title]_V1.pdf`
  - 2차: `private_assets/manuals/[MANUAL_ID]_[Title]_V1.pdf` (서버 API 제공용 자산)
- **완료 기준**: 파일 복사 완료 및 소스/배포 파일 간 SHA-256 일치 확인.

### 3.9 Stage 09: Publish QA (배포 무결성 검증)
- **목적**: Git 저장소 커밋 전 파일 손상 및 메타데이터 일치 검증.
- **검증 항목**: 파일 크기, 페이지 수, PDF 렌더러 파싱 정상 여부, SHA-256 해시 기록.
- **완료 기준**: Publish QA PASS.

### 3.10 Stage 10: Knowledge Center Production Publish (지식 센터 등록)
- **목적**: 배포된 PDF 매뉴얼을 프로덕션 Supabase 데이터베이스의 Knowledge Center 스키마에 공식 등록.
- **대상 테이블**:
  1. `knowledge_items`: 매뉴얼 메타데이터 및 한국어/영어 개요 등록 (`status = 'PUBLISHED'`).
  2. `knowledge_versions`: 버전 이력 및 변경 사유 등록 (`version = 'v1.0'`).
  3. `knowledge_manual_assets`: 실물 PDF 자산 엔드포인트 연동 (`file_url = '/api/admin/knowledge/asset/[asset_id]'`).
  4. `knowledge_relations`: 연관 포털 메뉴 및 URL 라우트 매핑 (`related_route = '/portal/...'`).
- **완료 기준**: Supabase 4대 테이블 upsert 완료.

### 3.11 Stage 11: Knowledge Publish QA
- **목적**: 등록된 지식 아이템이 포털 및 어드민에서 정상 조회·다운로드되는지 검증.
- **검증 항목**:
  - `knowledge_items`에서 `status = 'PUBLISHED'` 확인.
  - `knowledge_topics`와의 모듈 매칭 및 검색 키워드 바인딩 확인.
  - 인증된 브라우저 세션에서 `/api/admin/knowledge/asset/[asset_id]` 다운로드 응답 코드 `200 OK` 및 `Content-Type: application/pdf` 확인.
- **완료 기준**: Knowledge Center 연동 무결성 확인.

### 3.12 Stage 12: Knowledge Center FAQ Publish (FAQ 생성 및 배포)
- **목적**: Published PDF를 Authoritative Source로 삼아 브랜드사 핵심 질문 8~12개를 작성하고 배포.
- **DB 테이블**: `knowledge_faqs`
  - `portal_scope = 'BRAND'`
  - `source_knowledge_id = [kno-id]`
  - `topic_id = [topic-id]`
  - `status = 'APPROVED'`, `kind = 'BOTH'`
  - 한국어(`question_ko`, `answer_ko`) 및 영어(`question_en`, `answer_en`) 병기
  - 편집자 추천 `is_featured = true` 3~4건 선정
- **인메모리 동기화**: `lib/knowledge/store.ts` 내 `memoryFaqs` 배열에 동일 데이터 반영 (DB 장애 시 Fallback 보장).
- **완료 기준**: DB upsert 및 `store.ts` 동기화 완료.

### 3.13 Stage 13: FAQ QA (최종 FAQ 검수 및 검색 검증)
- **목적**: 배포된 FAQ의 중복성, 기존 FAQ 그룹 회귀(Regression), 키워드 검색 노출성을 전수 감사.
- **검증 항목**:
  1. 전체 FAQ 카운트 증가 확인 (기존 N개 ➔ 신규 N+M개 정상 반영).
  2. 기존 모든 FAQ 그룹(BRAND, ONB, PROD, ORD, REG, RET, LOG, PERM, FIN 등) 100% 온전성 유지.
  3. 중복 FAQ ID 및 중복 질문 0건 (Zero duplicates).
  4. 핵심 키워드(5~8개) Search Discovery 테스트 실행 및 통과.
- **완료 기준**: FAQ QA Audit Script All Pass ➔ Git Commit & Push ➔ `Local HEAD === origin/main` 일치.

---

## 4. Production Grounding Standards & Truth Verification

K SELECT 매뉴얼의 신뢰성은 엄격한 **Production Grounding Rules**에서 비롯됩니다. 작성자는 다음 원칙을 반드시 준수해야 합니다.

### 4.1 Strict Grounding Taxonomy (사실성 분류 체계)
모든 기능과 설명은 다음 6대 상태 중 하나로 명확히 분류되어야 합니다:

| 상태 태그 | 정의 및 작성 원칙 |
| :--- | :--- |
| `VERIFIED` | Production 코드베이스, DB 스키마, 실제 동작 UI에서 100% 확인된 기능. 사실 그대로 기술. |
| `NOT IMPLEMENTED` | UI 버튼이나 필드는 없으나 사용자가 기대할 수 있는 기능. "미구현" 상태임을 명시하여 오해 방지. |
| `SYSTEM GAP` | 정책적 요구사항과 현재 시스템 구현 사이에 괴리가 있는 부분. 우회 절차나 현재 한계를 솔직히 기술. |
| `LEGACY` | 과거에 사용되었으나 현재는 사용되지 않거나 폐기 예정인 기능. 현재 권장 워크플로우와 구분 기술. |
| `PENDING` | 배포 예정이나 현재 브랜치/DB에 완전히 반영되지 않은 상태. 사용자 매뉴얼에서는 제외하거나 사전 고지. |
| `NOT APPLICABLE` | 특정 역할(Role), 특정 권한, 또는 특정 계약 형태(예: FOB vs DDP)에 적용되지 않는 항목. 적용 제외 범위를 명시. |

### 4.2 Prohibition of Absolute & Unsupported Claims (과장 및 허위 보증 금지)
다음과 같은 입증되지 않은 절대적 표현은 매뉴얼 및 FAQ에서 **사용이 엄격히 금지**됩니다:
- ❌ **"100% 보장", "항상 즉시 처리", "완벽한 자동화"**: 시스템 장애, 심사 대기, 네트워크 지연 가능성이 있으므로 "조건 충족 시 자동 연산", "영업일 기준 순차 처리" 등으로 기술.
- ❌ **"실시간(Real-time) 동기화"**: 주기적 폴링이나 비동기 트리거로 작동하는 경우 "이벤트 발생 시 자동 갱신" 등으로 정확히 표현.
- ❌ **Mock/더미 데이터를 실제 데이터처럼 설명**: 테스트용 가상 데이터를 실서비스의 법적·재무적 기준으로 설명하지 말 것.
- ❌ **미지원 기능을 지원되는 것처럼 설명**: (예: 포털 내 PDF 인보이스 자동 생성 기능 미구현 ➔ "외부 회계 시스템 PDF 파일 첨부 필수"로 기술).

### 4.3 Production Domain Boundary Disambiguation (도메인 상태 경계 구분)
서로 다른 도메인의 상태를 혼용하여 기술하면 중대한 운영 사고를 유발하므로 다음 경계를 엄격히 구분합니다:

```text
1. [LOG vs WHS]    ARRIVED (화물 창고 도착)      ≠ RECEIVED (실물 검수 및 입고 확정)
2. [LOG vs FIN]    Shipping Complete (선적 완료) ≠ Settlement Complete (정산 및 송금 완료)
3. [FIN Domain]    Invoice Status (문서 심사)    ≠ Payment Status (동적 지급 상태) ≠ Settlement Status (행정적 마감)
4. [ORD vs RPT]    ORD Status (트랜잭션 생애주기) ≠ RPT Views (통계적 집계 및 시각화 데이터)
5. [PERM vs TASK]  PERM Assignment (계정 권한)   ≠ TASK Support Ticket (1:1 브랜드 문의 스레드)
```

---

## 5. Standard Claude Design Package Specifications

Claude Design AI가 일관된 K SELECT 엔터프라이즈 디자인 표준에 따라 문서를 빌드할 수 있도록 패키지 내 각 파일은 다음 표준을 따릅니다:

### 5.1 Package Core Files Directory Map

```text
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                       # 패키지 빌드 가이드, 자산 목록, 버전 이력
├── CLAUDE_DESIGN_MASTER_PROMPT.md          # Claude AI 디자인 지침 (색상, 타이포그래피, 마스터 참조)
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md         # 배포 및 아티팩트 전달 프롬프트
├── [MANUAL_ID]_Design_Structure.md         # 챕터별 구조, 그리드 명세, 스크린샷 핀 매핑 테이블
├── 01_CONTENT/
│   └── [MANUAL_ID]_Manual_Content.md       # 완전한 원고 본문 (국문/영문 혼용 또는 국문 완결본)
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md      # 스크린샷별 Pin 1, 2, 3... 위치 및 설명 규격서
│   └── SCR-[SCOPE]-[DOMAIN]-[NUM].png      # Production 고해상도 PNG 스크린샷 자산
├── 03_DIAGRAMS/
│   └── [DOMAIN]_ARCHITECTURE_DIAGRAMS.md   # Mermaid 및 ASCII 기반 아키텍처/상태머신 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                  # 마스터 디자인(MAN-B-BRAND-001) 및 DB 스키마 매핑
```

### 5.2 Screenshot Naming & Capture Standard
- **명명 규칙**:
  - Brand Portal 매뉴얼: `SCR-B-[DOMAIN]-[NUM].png` (예: `SCR-B-FIN-001.png`, `SCR-B-LOG-001.png`)
  - Internal / Admin 매뉴얼: `SCR-I-[DOMAIN]-[NUM].png` (예: `SCR-I-DOC-001.png`, `SCR-I-ADM-001.png`)
- **촬영 원칙**:
  1. 실제 Production 환경(`https://portal.kselectnetwork.com` 또는 `https://admin.kselectnetwork.com`)에서 캡처.
  2. 해상도: 최소 1920x1080 (Full HD) 뷰포트 기준.
  3. 개인정보, 내부 인증키, 실제 결제 계좌 등 민감 정보는 마스킹 처리.
  4. 모든 스크린샷 파일은 고유한 SHA-256 해시를 보유해야 함 (중복 파일 재사용 금지).

---

## 6. Design & PDF Quality Assurance (QA) Standards

### 6.1 Master Design System Guidelines (`MAN-B-BRAND-001`)
모든 매뉴얼 PDF는 `MAN-B-BRAND-001_Brand-Policy_V1.pdf`를 authoritative 기준점으로 삼아 다음 디자인 요소를 엄격히 일치시킵니다:
- **배경색 (Canvas)**: `#09090B` (Zinc-950 Dark Slate)
- **카드 컨테이너**: `#18181B` (Zinc-900), 테두리 `#27272A` (Zinc-800)
- **주요 텍스트**: 헤더 `#FAFAFA` (Zinc-50), 본문 `#A1A1AA` (Zinc-400)
- **브랜드 주 강조색 (Primary Accent)**: `#4F46E5` (Indigo-600)
- **상태 강조색**:
  - Success / Approved / Active: `#059669` (Emerald-600)
  - Warning / Partial / Pending: `#D97706` (Amber-600)
  - Danger / Rejected / Canceled: `#E11D48` (Rose-600)

### 6.2 Mandatory PDF QA Inspection Checklist
PDF 검수 담당자는 다음 10대 검사항목에 대해 체크를 수행해야 합니다:
1. **페이지 수(Page Count)**: 기획된 챕터 분량과 실제 렌더링 페이지 수가 정확히 일치하는가?
2. **레이아웃 오버플로우**: 텍스트나 테이블이 페이지 경계를 벗어나 잘리지 않았는가?
3. **타이포그래피 위계**: H1, H2, H3 헤딩 및 본문 폰트 크기 비율이 적절한가?
4. **이미지 해상도**: 스크린샷의 텍스트와 UI 요소가 선명하게 식별 가능한가?
5. **어노테이션 핀 일치**: 스크린샷 위의 핀 번호와 하단 콜아웃 설명 번호가 정확히 일치하는가?
6. **다이어그램 무결성**: Mermaid/ASCII 다이어그램의 선과 텍스트가 깨지지 않고 렌더링되었는가?
7. **개발자 잔존물 검사**: `TODO`, `FIXME`, `Developer Note`, `lorem ipsum` 등 임시 텍스트가 전무한가?
8. **도메인 경계 일치**: 수량, 금액, 상태 코드, URL 경로가 프로덕션 코드와 100% 일치하는가?
9. **바닥글/헤더 일치**: 매뉴얼 ID, 버전 번호, 배포 일자, 페이지 번호(예: `12 / 21`)가 전 페이지에 정확한가?
10. **PDF 파일 무결성**: 파일 손상 없이 Adobe Acrobat, 브라우저, Preview에서 완벽히 열리는가?

---

## 7. Knowledge Center & FAQ Production Publishing Standards

### 7.1 Knowledge Center Schema Architecture
K SELECT Knowledge Center는 Supabase PostgreSQL 데이터베이스의 다음 테이블들을 통해 운영됩니다:

```text
                               ┌───────────────────────────┐
                               │     knowledge_topics      │ (카테고리/토픽)
                               └─────────────┬─────────────┘
                                             │ 1:N
┌───────────────────────────┐  1:N           ▼
│  knowledge_manual_assets  │ ◄────── ┌───────────────────────────┐
│ (실물 PDF 자산 엔드포인트) │         │      knowledge_items      │ (지식 아이템 마스터)
└───────────────────────────┘         └──────┬────────────┬───────┘
                                             │ 1:N        │ 1:N
                                             ▼            ▼
                               ┌───────────────────┐ ┌───────────────────┐
                               │knowledge_versions │ │knowledge_relations│ (포털 메뉴 연동)
                               └───────────────────┘ └───────────────────┘
                                             │ 1:N
                                             ▼
                               ┌───────────────────┐
                               │  knowledge_faqs   │ (1:1 연계 FAQ)
                               └───────────────────┘
```

### 7.2 FAQ Creation & Grounding Rules
- **작성 수량**: 매뉴얼당 8~12개의 실무 중심 핵심 FAQ 작성.
- **필수 필드**:
  - `id`: `faq-[domain]-[seq]` (예: `faq-fin-01`, `faq-log-01`)
  - `source_knowledge_id`: 연관된 Knowledge Item ID (예: `kno-finance-settlement-v10`)
  - `topic_id`: 유효한 토픽 ID (예: `topic-finance`, `topic-logistics`)
  - `portal_scope`: `BRAND` (또는 필요 시 `RETAIL`)
  - `status`: `APPROVED`
  - `kind`: `BOTH` (FAQ 탭 및 Ask 검색 결과 동시 노출)
  - `question_ko` / `question_en`: 국문 및 영문 질문 명확히 작성
  - `answer_ko` / `answer_en`: 근거 매뉴얼의 챕터 및 섹션 앵커를 명시한 답변 작성
- **Featured FAQ**: 전체 질문 중 사용자 입장에서 가장 중요하고 빈번한 3~4개를 `is_featured = true`로 설정.
- **인메모리 동기화**: `lib/knowledge/store.ts`의 `memoryFaqs` 배열에 반드시 동일한 객체를 등록하여 DB 미접속 환경에서도 동작 보장.

---

## 8. Manual Maintenance & Version Control SOP

프로덕션 시스템의 기능 추가, UI 개편, DB 마이그레이션 발생 시 기존 매뉴얼은 아래 규칙에 따라 즉시 업데이트되어야 합니다:

### 8.1 Versioning Trigger & Level Classification
| 버전 변경 유형 | 버전 표기 예시 | 트리거 조건 | 업데이트 범위 |
| :--- | :--- | :--- | :--- |
| **Patch / Revision** | `v1.0` ➔ `v1.0.1` (또는 `R1`) | 오탈자 수정, 용어 명확화, 워크플로우 불변 상태에서 UI 단순 버튼 색상/위치 변경. | Source 수정 ➔ Package QA ➔ PDF 재빌드 및 Publish 교체. |
| **Minor Version** | `v1.0` ➔ `v1.1.0` | 신규 서브 탭 추가, 선택 입력 필드 추가, 새로운 비파괴적 상태 코드 추가. | Source 4종 전면 개정 ➔ Package 스크린샷 재촬영 ➔ PDF 재생성 ➔ `knowledge_versions` 신규 버전 추가 ➔ FAQ 개정. |
| **Major Version** | `v1.0` ➔ `v2.0.0` | 핵심 비즈니스 로직 변경, 워크플로우 전면 개편, 도메인 분리, 권한 체계 대개편. | 전체 13단계 라이프사이클 재수행, 기존 Knowledge Item `ARCHIVED` 처리 후 신규 버전 발행. |

### 8.2 Cascading Update Impact Checklist
시스템 변경 시 매뉴얼 담당자는 다음 연쇄 영향(Cascading Impact)을 순서대로 반영해야 합니다:
1. **Source Impact**: `01_SOURCE/` 하위 4개 문서에 변경된 필드, 라우트, 워크플로우 반영.
2. **Screenshot Impact**: 변경된 UI 화면을 프로덕션에서 즉시 재촬영하여 `02_SCREENSHOTS/` 갱신.
3. **Package & Design Impact**: `Manual_Content.md` 및 `Design_Structure.md` 수정 후 PDF 재렌더링.
4. **Publish & Asset Impact**: `03_PUBLISHED/` 및 `private_assets/manuals/`의 PDF 교체.
5. **Knowledge Version Impact**: Supabase `knowledge_versions`에 변경 내역(`what_changed`, `why_changed`) 등록.
6. **FAQ Impact**: 변경된 워크플로우와 모순되는 기존 FAQ 답변을 수정하고 필요 시 신규 FAQ 추가.

---

## 9. Internal vs Brand Portal Manual Boundaries

| 구분 항목 | Brand Portal Manual (`MAN-B-*`) | Internal Operations SOP (`MAN-I-*`) | Admin Manual (`MAN-A-*`) |
| :--- | :--- | :--- | :--- |
| **대상 독자** | 브랜드 파트너사 임직원, 공급사 운영자 | K SELECT 본사 직원, 개발자, 운영팀 | K SELECT 최고 관리자, 시스템 감사관 |
| **공개 범위** | Brand Portal 지식 센터 (`/portal/help`) | 내부 문서 보관소 (`Manuals/MAN-I-*`) | Admin 시스템 전용 (`/admin/knowledge`) |
| **Knowledge Center 등록** | **필수 (MANDATORY)** | **선택적 (내부 전용 태그 시 등록 가능)** | **필수 (ADMIN 전용 스코프)** |
| **공개 FAQ 배포** | **필수 (8~12개 배포)** | **원칙적 제외 (NOT APPLICABLE)** | 필요 시 내부 관리자 FAQ로 제한 배포 |
| **스크린샷 스코프** | `SCR-B-*` (브랜드 화면 우선) | `SCR-I-*` (내부 도구 및 워크플로우) | `SCR-A-*` (어드민 백오피스 화면 전용) |

---

## 10. Definition of Done (DoD) & Completion Criteria

K SELECT 매뉴얼 제작 및 업데이트 작업은 다음 7대 완료 조건(Definition of Done)이 모두 충족되었을 때 비로소 **COMPLETE** 상태로 인정됩니다:

```text
[✓] Pillar 1: Source Documents Created & Verified (4/4 Source Files in 01_SOURCE/)
[✓] Pillar 2: Package QA Passed (02_CLAUDE_PACKAGE/ 8 Markdown Files & Unique Screenshots)
[✓] Pillar 3: Claude Design & Layout Generated (Master Design System Aligned)
[✓] Pillar 4: PDF QA Passed (Zero Overflow, Zero TODOs, 100% Verified Content)
[✓] Pillar 5: Published Artifacts Stored (03_PUBLISHED/ & private_assets/manuals/ Synced)
[✓] Pillar 6: Knowledge Center Registered & Verified (Supabase 4 Tables Updated, if applicable)
[✓] Pillar 7: FAQs Published & Verified (knowledge_faqs & lib/knowledge/store.ts Synced, if applicable)
```

> **핵심 원칙**: 단순히 로컬에서 PDF 파일을 생성했다고 해서 매뉴얼이 완료된 것이 아닙니다. 기획에서 지식 베이스 및 FAQ 배포에 이르는 전체 데이터 파이프라인이 검증되고 Git 동기화(`Local HEAD === origin/main`)까지 완료되어야 작업이 완전히 종료됩니다.
