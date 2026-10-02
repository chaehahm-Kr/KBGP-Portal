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

K SELECT 매뉴얼 엔지니어링은 단순한 "문서 작성"이 아닌 소프트웨어 엔지니어링과 동일한 엄격성을 갖는 13단계의 순차적 라이프사이클 파이프라인으로 실행됩니다.

> [!IMPORTANT]
> **Strict QA Gate Blocking Principle**:
> 모든 단계는 이전 단계의 품질 게이트(QA Gate)를 공식 통과(PASS)해야만 다음 단계로 진입할 수 있습니다. QA를 통과하지 않은 상태에서 패키지 생성, 디자인 렌더링, 또는 DB 배포를 진행하는 행위는 엄격히 금지됩니다.

```text
[1. Source Creation] ➔ [2. Source Review (R1)] ➔ [3. Claude Package Creation] ➔ [4. Package File Check]
         ↓
[5. Package QA] ➔ [6. Claude Design Generation] ➔ [7. PDF QA] ➔ [8. Publish] ➔ [9. Publish QA]
         ↓
[10. Knowledge Center Publish]* ➔ [11. Knowledge Publish QA]* ➔ [12. FAQ Publish]* ➔ [13. FAQ QA]*
(*Public Brand Portal 대상 매뉴얼에 한함. Internal SOP는 9단계에서 완료)
```

### 3.1 Stage-by-Stage Comprehensive Execution Specification

| 단계 번호 및 명칭 | Purpose (목적) | Input (필수 입력) | Required Actions & Files | QA Gate / Verification Method | Output (산출물) | Next Step Entry Criteria (진입 조건) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01. Source Creation** | 프로덕션 UI, 코드, DB 스키마를 전수 조사하여 4대 기획 문서 작성 | 실서비스 환경, 코드베이스(`app/`, `lib/`), DB 마이그레이션 SQL | `01_SOURCE/` 하위 4개 문서 작성 | 소스코드/DB 교차 대조 | `01_SOURCE/` 4개 문서 초안 | 4개 문서 작성 완료 및 사실 정합성 1차 확인 |
| **02. Source Review (R1)** | 사실 무결성 감사 및 미구현 기능/도메인 경계 오류 교정 | Source 4개 문서 초안, 소스코드 라인 | Ground Truth 감사 및 R1 수정 반영 | **Gate 1: Source QA Gate** (코드 라인 단위 감사) | 승인된 `01_SOURCE/` R1 문서군 | Source Review All Green 승인 |
| **03. Claude Package Creation** | Claude Design AI가 고품질 PDF를 생성할 수 있는 번들 구성 | 승인된 Source R1 문서군 | `02_CLAUDE_PACKAGE/` 8개 마크다운 작성 및 스크린샷 캡처 | 패키지 파일 구조 정합성 검사 | `02_CLAUDE_PACKAGE/` 초기 번들 | 패키지 구성 파일 및 이미지 준비 완료 |
| **04. Package File Check** | 물리적 파일 누락, 0바이트 파일, 동기화 지연 사전 검사 | `02_CLAUDE_PACKAGE/` 디렉터리 | 파일 시스템 실재성 및 크기 전수 스캔 | `readback-verify-physical-files.js` | 파일 물리적 무결성 확인 로그 | 모든 파일 `Size > 0 bytes` 확인 |
| **05. Package QA** | Source ↔ Package 1:1 대조 및 스크린샷 해시 감사 | `01_SOURCE/` 및 `02_CLAUDE_PACKAGE/` | 1:1 내용 정합성 검증, 스크린샷 Unique 해시 검사 | **Gate 2: Package QA Gate** (`verify-screenshots-hash.js`) | Package QA Audit Report | Source ↔ Package 일치율 100%, 해시 100% Unique |
| **06. Claude Design Generation** | 마스터 디자인 시스템에 따른 고품질 PDF/HTML 렌더링 | `CLAUDE_DESIGN_MASTER_PROMPT.md`, `MAN-B-BRAND-001` Ref | Claude AI 디자인 실행 및 PDF 렌더링 | 디자인 렌더러 실행 | PDF 초안 아티팩트 | PDF 렌더링 완료 |
| **07. PDF QA** | 렌더링된 PDF의 전 페이지 시각적·구조적 전수 감사 | PDF 초안, 마스터 디자인 가이드 | 10대 검사항목 전수 검수 (오버플로우, 핀 매핑, TODO 등) | **Gate 3: PDF QA Gate** (전 페이지 시각/텍스트 감사) | Approved Final PDF | 10대 검사 체크리스트 전원 PASS |
| **08. Publish** | 최종 승인된 PDF를 공식 배포 디렉터리 및 자산 폴더로 복제 | Approved Final PDF | `03_PUBLISHED/` 저장 및 `private_assets/manuals/` 동기화 | SHA-256 해시 일치 확인 | Published PDF 자산 | 파일 복제 및 해시 일치 확인 |
| **09. Publish QA** | 배포된 PDF의 바이너리 무결성 및 Git 추적 상태 검증 | `03_PUBLISHED/` 내 PDF | 파일 크기, 페이지 수, 파싱 정상 여부 확인 | Binary Parser / PDF Inspector Script | Publish QA Report | Publish QA All Pass (**Internal SOP 종료 지점**) |
| **10. Knowledge Center Publish** | 프로덕션 Supabase Knowledge Center에 공식 등록 (Brand Portal 전용) | Published PDF, 메타데이터 | Supabase 4대 테이블(`knowledge_items`, `versions`, `assets`, `relations`) upsert | Supabase SQL / Script Execution | 등록된 Knowledge Item Record | Supabase upsert 성공 확인 |
| **11. Knowledge Publish QA** | 지식 아이템 상태 및 실물 자산 다운로드 API 검증 | Supabase DB, 포털 라우트 | `status = 'PUBLISHED'` 및 `/api/admin/knowledge/asset/[id]` 200 OK 확인 | **Gate 4: Knowledge Publish Gate** (인증 세션 API 검증) | Knowledge Center QA Report | Knowledge Item 정상 활성화 및 다운로드 성공 |
| **12. FAQ Publish** | Published PDF를 근거로 8~12개 공식 FAQ 생성 및 배포 | Published PDF, 등록된 Knowledge Item | `knowledge_faqs` upsert 및 `lib/knowledge/store.ts` 동기화 | DB upsert & TypeScript Typecheck | 등록된 8~12개 FAQ Record | DB upsert 및 `store.ts` 동기화 완료 |
| **13. FAQ QA** | FAQ 검색 디스커버리, 중복 감사, 기존 FAQ 그룹 회귀 검증 | Supabase `knowledge_faqs`, `store.ts` | Search Discovery 쿼리 테스트, 중복 0건 감사, 회귀 테스트 | **Gate 5: FAQ Publish Gate** (`verify-[domain]-faqs-publish.js`) | FAQ QA Final Report | 0 Duplicates, All Queries Pass, `Local HEAD === origin/main` |

---

## 4. Production Grounding Standards & Truth Verification

K SELECT 매뉴얼의 신뢰성은 엄격한 **Production Grounding Rules**에서 비롯됩니다. 작성자는 다음 원칙을 반드시 준수해야 합니다.

### 4.1 Strict Grounding Taxonomy (사실성 분류 체계)
모든 기능과 설명은 다음 6대 상태 중 하나로 명확히 분류되어야 하며 상호 중복되어서는 안 됩니다:

| 상태 태그 | 정의 및 작성 원칙 |
| :--- | :--- |
| `VERIFIED` | Production 코드베이스, DB 스키마, 실제 동작 UI에서 100% 확인된 기능. 사실 그대로 기술. |
| `NOT IMPLEMENTED` | UI 버튼이나 필드는 없으나 사용자가 기대할 수 있는 기능. "미구현" 상태임을 명시하여 오해 방지. |
| `SYSTEM GAP` | 정책적 요구사항과 현재 시스템 구현 사이에 괴리가 있는 부분. 우회 절차나 현재 한계를 솔직히 기술. |
| `LEGACY` | 과거에 사용되었으나 현재는 사용되지 않거나 폐기 예정인 기능. 현재 권장 워크플로우와 명확히 구분. |
| `PENDING` | 향후 배포 예정이나 현재 브랜치/DB에 완전히 반영되지 않은 상태. 사용자 매뉴얼에서는 제외하거나 사전 고지. |
| `NOT APPLICABLE` | 특정 역할(Role), 특정 권한, 또는 특정 계약 형태(예: FOB vs DDP)에 적용되지 않는 항목. 적용 제외 범위를 명시. |

### 4.2 Prohibited Anti-Patterns (엄격 금지 사항)
다음과 같은 작성 행위는 Ground Truth를 훼손하므로 엄격히 금지됩니다:
1. ❌ **추측성 기능 기술**: 소스코드에 존재하지 않는 가상의 백오피스 자동화 로직을 있는 것처럼 작성하는 행위.
2. ❌ **미존재 DB 테이블/컬럼 인용**: 마이그레이션 SQL에 정의되지 않은 가상의 스키마를 필드 인벤토리에 기재하는 행위.
3. ❌ **가공의 API 엔드포인트/URL 라우트 기재**: 실제 라우트 핸들러가 없는 가상 URL을 안내하는 행위.
4. ❌ **미래 기획을 현재 기능으로 둔갑**: 로드맵 상의 기획을 현재 운영 중인 기능으로 표현하는 행위.
5. ❌ **Mock/더미 데이터를 실제 데이터처럼 기술**: 시뮬레이션용 임시 수치를 실제 재무/정산 기준으로 설명하는 행위.
6. ❌ **근거 없는 절대적 표현 (Absolute Claims)**: "100% 즉시 처리", "완벽한 실시간 보장", "오류 없는 자동 연산" 등 과장 보증 표현.

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
2. **페이지 누락/중복**: 페이지 순서가 올바르고 중복 렌더링되거나 누락된 페이지가 없는가?
3. **레이아웃 오버플로우/클리핑**: 텍스트, 테이블, 카드가 페이지 경계를 벗어나 잘리지 않았는가?
4. **타이포그래피 위계 및 자간**: H1, H2, H3 헤딩 및 본문 폰트 크기 비율이 적절하며 줄간격이 깨지지 않았는가?
5. **이미지 해상도 및 의미적 정확성**: 스크린샷이 선명하며, 해당 챕터에서 설명하는 실제 화면과 100% 일치하는가?
6. **어노테이션 핀 및 콜아웃 일치**: 스크린샷 위의 핀 번호와 하단 콜아웃 설명 번호가 정확히 1:1로 매핑되는가?
7. **다이어그램 무결성**: Mermaid/ASCII 다이어그램의 선과 텍스트가 깨지지 않고 완벽히 렌더링되었는가?
8. **개발자 잔존물 검사**: `TODO`, `FIXME`, `Developer Note`, `lorem ipsum` 등 임시 텍스트가 전무한가?
9. **바닥글/헤더 및 메타데이터 일치**: 매뉴얼 ID, 버전 번호, 배포 일자, 페이지 번호(예: `12 / 21`)가 전 페이지에 정확한가?
10. **PDF 파일 무결성 및 SHA-256 기록**: 파일 손상 없이 뷰어에서 열리며 고유 SHA-256 해시가 기록되었는가?

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

### 7.2 Strict Knowledge Center ➔ FAQ Precondition & Boundary Rule
> [!CAUTION]
> **FAQ Creation Hard Prerequisite**:
> FAQ는 반드시 **해당 매뉴얼의 Knowledge Item이 Supabase `knowledge_items` 테이블에 `status = 'PUBLISHED'`로 사전에 등록되어 있어야만** 생성 및 배포할 수 있습니다.
> 연계할 Knowledge Item이 존재하지 않는 상태에서 임의의 가상 `source_knowledge_id`를 부여하여 FAQ를 단독 배포하는 행위는 엄격히 금지되며, 이 경우 즉시 FAQ 배포 작업을 중단(STOP)하고 선행 Knowledge Center 등록을 완료해야 합니다.

### 7.3 FAQ Grounding & Fallback Synchronization Rules
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
> [!WARNING]
> **Prohibited Anti-Pattern: Partial PDF-Only Update**:
> PDF 파일만 수정하고 Knowledge Item, Knowledge Version, Knowledge Asset 및 FAQ를 갱신하지 않고 방치하는 행위는 지식 베이스의 불일치를 초래하는 엄격한 금지 행위입니다.

시스템 변경 시 매뉴얼 담당자는 다음 연쇄 영향(Cascading Impact)을 순서대로 반영해야 합니다:
1. **Source Impact**: `01_SOURCE/` 하위 4개 문서에 변경된 필드, 라우트, 워크플로우 반영.
2. **Screenshot Impact**: 변경된 UI 화면을 프로덕션에서 즉시 재촬영하여 `02_SCREENSHOTS/` 갱신.
3. **Package & Design Impact**: `Manual_Content.md` 및 `Design_Structure.md` 수정 후 PDF 재렌더링.
4. **Publish & Asset Impact**: `03_PUBLISHED/` 및 `private_assets/manuals/`의 PDF 교체.
5. **Knowledge Version Impact**: Supabase `knowledge_versions`에 변경 내역(`what_changed`, `why_changed`) 등록.
6. **FAQ Impact**: 변경된 워크플로우와 모순되는 기존 FAQ 답변을 수정하고 필요 시 신규 FAQ 추가 및 `store.ts` 동기화.

---

## 9. Internal vs Brand Portal Manual Boundaries

| 구분 항목 | Brand Portal Manual (`MAN-B-*`) | Internal Operations SOP (`MAN-I-*`) | Admin Manual (`MAN-A-*`) |
| :--- | :--- | :--- | :--- |
| **대상 독자** | 브랜드 파트너사 임직원, 공급사 운영자 | K SELECT 본사 직원, 개발자, 운영팀 | K SELECT 최고 관리자, 시스템 감사관 |
| **공개 범위** | Brand Portal 지식 센터 (`/portal/help`) | 내부 문서 보관소 (`Manuals/MAN-I-*`) | Admin 시스템 전용 (`/admin/knowledge`) |
| **Knowledge Center 등록** | **필수 (MANDATORY)** | **원칙적 제외 (NOT APPLICABLE / Internal Only)** | **필수 (ADMIN 전용 스코프)** |
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
