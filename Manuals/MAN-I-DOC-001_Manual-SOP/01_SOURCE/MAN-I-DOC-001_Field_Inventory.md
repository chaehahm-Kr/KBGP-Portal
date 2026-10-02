# MAN-I-DOC-001 — Field Inventory & Data Dictionary
## K SELECT Internal Operations: Manual Engineering Data Schema, DB Entities & UI Controls
### (매뉴얼 제작 및 업데이트 데이터 필드 사전 & 스키마 인벤토리)

---

## 1. Executive Overview
본 문서는 K SELECT 매뉴얼 엔지니어링 라이프사이클 전반에 걸쳐 사용되는 **디렉터리 아티팩트 메타데이터, 데이터베이스 스키마(Knowledge Center DB Tables), Claude Design 패키지 구성 요소, 스크린샷 어노테이션 규격, 그리고 FAQ 엔티티**의 모든 데이터 필드를 정의한 표준 데이터 사전(Field Inventory)입니다.

---

## 2. Manual Repository File & Artifact Metadata

각 매뉴얼 패키지가 파일 시스템상에서 관리하는 핵심 파일들의 메타데이터 스펙입니다:

| 파일 / 폴더 명칭 | 저장 위치 | 형식 / 타입 | 필수 여부 | 역할 및 설명 |
| :--- | :--- | :--- | :---: | :--- |
| `[MANUAL_ID]_Source.md` | `01_SOURCE/` | Markdown (`.md`) | **필수** | 매뉴얼의 기준이 되는 최상위 기획 및 감사 보고서 |
| `[MANUAL_ID]_Field_Inventory.md` | `01_SOURCE/` | Markdown (`.md`) | **필수** | UI 및 DB 필드 데이터 사전 |
| `[MANUAL_ID]_Workflow_Map.md` | `01_SOURCE/` | Markdown (`.md`) | **필수** | 상태 전이도 및 프로세스 흐름도 |
| `[MANUAL_ID]_Screenshot_Requirements.md`| `01_SOURCE/` | Markdown (`.md`) | **필수** | 스크린샷 촬영 명세 및 어노테이션 핀 기획서 |
| `PACKAGE_README.md` | `02_CLAUDE_PACKAGE/`| Markdown (`.md`) | **필수** | 패키지 개요, 자산 매핑, 빌드 가이드 |
| `CLAUDE_DESIGN_MASTER_PROMPT.md` | `02_CLAUDE_PACKAGE/`| Markdown (`.md`) | **필수** | Claude AI 디자인 생성 마스터 프롬프트 |
| `CLAUDE_DESIGN_HANDOFF_PROMPT.md` | `02_CLAUDE_PACKAGE/`| Markdown (`.md`) | **필수** | 최종 릴리즈 및 퍼블리싱 가이드 |
| `[MANUAL_ID]_Design_Structure.md` | `02_CLAUDE_PACKAGE/`| Markdown (`.md`) | **필수** | 챕터 구조, 그리드 레이아웃, 핀 매핑 명세 |
| `[MANUAL_ID]_Manual_Content.md` | `02_CLAUDE_PACKAGE/01_CONTENT/` | Markdown (`.md`) | **필수** | 매뉴얼 원고 본문 전문 |
| `SCR-[SCOPE]-[DOMAIN]-[NUM].png` | `02_CLAUDE_PACKAGE/02_SCREENSHOTS/` | Image (`.png`) | **필수** | 고해상도(1080p 이상) 프로덕션 화면 캡처 (11~14장) |
| `SCREENSHOT_ANNOTATION_GUIDE.md` | `02_CLAUDE_PACKAGE/02_SCREENSHOTS/` | Markdown (`.md`) | **필수** | 스크린샷 핀(Pin) 번호별 상세 UI 설명서 |
| `[DOMAIN]_ARCHITECTURE_DIAGRAMS.md` | `02_CLAUDE_PACKAGE/03_DIAGRAMS/` | Markdown (`.md`) | **필수** | Mermaid 및 ASCII 아키텍처 다이어그램 |
| `REFERENCE_GUIDE.md` | `02_CLAUDE_PACKAGE/04_REFERENCE/` | Markdown (`.md`) | **필수** | 마스터 디자인(`MAN-B-BRAND-001`) 및 DB 스키마 매핑 |
| `[MANUAL_ID]_[Title]_V[X].pdf` | `03_PUBLISHED/` | Binary (`.pdf`) | **필수** | 최종 검수 승인된 완성본 PDF 배포 파일 |
| `[MANUAL_ID]_[Title]_V[X].pdf` | `private_assets/manuals/` | Binary (`.pdf`) | **필수** | 프로덕션 API 서빙용 복제 자산 파일 |

---

## 3. Production Supabase Knowledge Center Database Dictionary

Knowledge Center에 등록되는 Supabase PostgreSQL 데이터베이스의 테이블별 필드 명세입니다:

### 3.1 `knowledge_items` Table (지식 아이템 마스터)
매뉴얼, 가이드, 정책 문서의 최상위 메타데이터 엔티티입니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 / 허용 값 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | 고유 지식 ID (예: `kno-finance-settlement-v10`, `kno-shipping-logistics-v10`) |
| `slug` | `VARCHAR(150)` | `UNIQUE, NOT NULL` | URL 경로 식별자 (예: `man-b-fin-001-finance-settlement`) |
| `title_ko` | `VARCHAR(255)` | `NOT NULL` | 공식 한국어 매뉴얼 제목 |
| `title_en` | `VARCHAR(255)` | `NULLABLE` | 공식 영어 매뉴얼 제목 |
| `summary_ko` | `TEXT` | `NULLABLE` | 한국어 핵심 요약 (목적 및 대상) |
| `summary_en` | `TEXT` | `NULLABLE` | 영어 핵심 요약 |
| `content_ko` | `TEXT` | `NULLABLE` | 매뉴얼 본문 전문 (Markdown 형식) |
| `content_en` | `TEXT` | `NULLABLE` | 매뉴얼 본문 영문 전문 |
| `type` | `VARCHAR(50)` | `NOT NULL` | 문서 유형: `MANUAL`, `GUIDE`, `POLICY`, `SOP`, `FAQ` |
| `source_type` | `VARCHAR(50)` | `DEFAULT 'DOCUMENT'` | 원본 출처 유형: `DOCUMENT`, `SYSTEM`, `INLINE` |
| `module` | `VARCHAR(50)` | `NOT NULL` | 연관 시스템 모듈 (예: `FINANCE`, `LOGISTICS`, `PRODUCTS`, `ORDERS`) |
| `category` | `VARCHAR(50)` | `NOT NULL` | 카테고리 (예: `Brand Portal`, `Admin`, `Retail Network`, `Internal SOP`) |
| `tags` | `TEXT[]` | `DEFAULT '{}'` | 검색 키워드 태그 배열 |
| `audience` | `TEXT[]` | `NOT NULL` | 대상 독자 배열: `['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT']` |
| `current_version` | `VARCHAR(20)` | `DEFAULT 'v1.0'` | 현재 유효 버전 태그 |
| `status` | `VARCHAR(30)` | `NOT NULL` | 배포 상태: `DRAFT`, `UNDER_REVIEW`, `PUBLISHED`, `ARCHIVED` |
| `portal_scope` | `VARCHAR(30)` | `DEFAULT 'BRAND'` | 노출 포털 범위: `BRAND` (브랜드 공개), `ADMIN` (관리자 전용), `INTERNAL` (내부 전용) |
| `document_url` | `VARCHAR(255)` | `NULLABLE` | PDF 서빙 API 엔드포인트 (`/api/admin/knowledge/asset/[asset_id]`) |
| `document_name` | `VARCHAR(255)` | `NULLABLE` | 실물 PDF 파일명 (예: `MAN-B-FIN-001_Finance-Settlement_V1.pdf`) |
| `document_size` | `BIGINT` | `NULLABLE` | 파일 크기 (Bytes) |
| `document_type` | `VARCHAR(50)` | `DEFAULT 'application/pdf'` | MIME 타입 |
| `display_order` | `INTEGER` | `DEFAULT 0` | UI 목록 정렬 순서 |
| `is_featured` | `BOOLEAN` | `DEFAULT false` | 추천 매뉴얼 여부 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 수정 일시 |

### 3.2 `knowledge_versions` Table (버전 이력 관리)
매뉴얼의 버전별 변경 사유 및 본문 스냅샷을 관리합니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 / 허용 값 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | 버전 고유 ID (예: `ver-finance-settlement-v10`) |
| `knowledge_id` | `VARCHAR(100)` | `FK -> knowledge_items.id` | 연관 지식 아이템 ID |
| `version` | `VARCHAR(20)` | `NOT NULL` | 버전 태그 (예: `v1.0`, `v1.1.0`, `v2.0`) |
| `status` | `VARCHAR(30)` | `DEFAULT 'PUBLISHED'` | 해당 버전의 상태 (`PUBLISHED`, `DEPRECATED`) |
| `title_ko` / `title_en` | `VARCHAR(255)` | `NOT NULL` | 해당 버전의 매뉴얼 제목 |
| `summary_ko` / `summary_en` | `TEXT` | `NULLABLE` | 해당 버전의 요약 |
| `content_ko` / `content_en` | `TEXT` | `NULLABLE` | 해당 버전의 본문 내용 |
| `what_changed` | `TEXT` | `NOT NULL` | 변경 사항 상세 요약 |
| `why_changed` | `TEXT` | `NOT NULL` | 변경 사유 및 배경 |
| `effective_date` | `DATE` | `NOT NULL` | 버전 효력 발생일 |
| `document_url` | `VARCHAR(255)` | `NULLABLE` | 해당 버전의 PDF 엔드포인트 |
| `document_name` | `VARCHAR(255)` | `NULLABLE` | 해당 버전의 PDF 파일명 |
| `published_at` | `TIMESTAMPTZ` | `NULLABLE` | 공식 배포 일시 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |

### 3.3 `knowledge_manual_assets` Table (실물 PDF 자산)
인증된 세션에서 다운로드 가능한 바이너리 PDF 파일 엔티티입니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 / 허용 값 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | 자산 고유 ID (예: `asset-finance-settlement-v10`) |
| `knowledge_id` | `VARCHAR(100)` | `FK -> knowledge_items.id` | 연관 지식 아이템 ID |
| `manual_title` | `VARCHAR(255)` | `NOT NULL` | 매뉴얼 공식 제목 |
| `version` | `VARCHAR(20)` | `NOT NULL` | 자산 버전 (`v1.0`) |
| `language` | `VARCHAR(10)` | `DEFAULT 'KO'` | 기본 언어 (`KO`, `EN`, `ALL`) |
| `is_current` | `BOOLEAN` | `DEFAULT true` | 최신 활성 자산 플래그 |
| `file_url` | `VARCHAR(255)` | `NOT NULL` | 서빙 API 엔드포인트 URL |
| `file_name` | `VARCHAR(255)` | `NOT NULL` | 실물 파일명 |
| `file_size` | `BIGINT` | `NOT NULL` | 파일 크기 (Bytes) |
| `published_date` | `DATE` | `NOT NULL` | 배포 일자 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |

### 3.4 `knowledge_relations` Table (포털 메뉴 & URL 매핑)
매뉴얼과 실제 Brand Portal 및 Admin UI 메뉴 간의 딥링크 관계를 정의합니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 / 허용 값 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | 관계 고유 ID (예: `rel-fin-invoice-list`) |
| `knowledge_id` | `VARCHAR(100)` | `FK -> knowledge_items.id` | 연관 지식 아이템 ID |
| `related_portal` | `VARCHAR(50)` | `NOT NULL` | 대상 포털: `Brand Portal`, `Admin`, `Retail Portal` |
| `related_module` | `VARCHAR(50)` | `NOT NULL` | 시스템 모듈 (예: `FINANCE`, `LOGISTICS`, `PRODUCTS`) |
| `related_menu` | `VARCHAR(100)` | `NOT NULL` | 메뉴 명칭 (예: `Finance Hub`, `Invoices List`, `New Invoice Form`) |
| `related_route` | `VARCHAR(255)` | `NOT NULL` | 실제 URL 라우트 경로 (예: `/portal/finance`, `/portal/finance/new`) |
| `manual_title` | `VARCHAR(255)` | `NULLABLE` | 매뉴얼 표시 제목 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |

### 3.5 `knowledge_faqs` Table (1:1 연계 FAQ 마스터)
지식 매뉴얼과 1:1로 연계되어 포털 및 검색 엔진에서 서비스되는 FAQ 엔티티입니다.

| 컬럼명 | 데이터 타입 | 제약 조건 | 설명 / 허용 값 |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | FAQ 고유 ID (예: `faq-fin-01`, `faq-log-01`) |
| `portal_scope` | `VARCHAR(30)` | `DEFAULT 'BRAND'` | 포털 범위 (`BRAND`, `ADMIN`, `RETAIL`) |
| `topic_id` | `VARCHAR(100)` | `FK -> knowledge_topics.id` | 연관 토픽 ID (예: `topic-finance`, `topic-logistics`) |
| `source_knowledge_id` | `VARCHAR(100)` | `FK -> knowledge_items.id` | **[필수 선행 조건]** 연계 매뉴얼 ID (반드시 `status = 'PUBLISHED'`인 Item 참조) |
| `source_version` | `VARCHAR(20)` | `DEFAULT 'v1.0'` | 인용 기준 버전 |
| `source_title` | `VARCHAR(255)` | `NOT NULL` | 인용 매뉴얼 명칭 |
| `question_ko` | `TEXT` | `NOT NULL` | 한국어 질문 문장 |
| `question_en` | `TEXT` | `NOT NULL` | 영어 질문 문장 |
| `answer_ko` | `TEXT` | `NOT NULL` | 한국어 답변 (매뉴얼 챕터/섹션 앵커 포함) |
| `answer_en` | `TEXT` | `NOT NULL` | 영어 답변 (매뉴얼 챕터/섹션 앵커 포함) |
| `audience` | `TEXT[]` | `NOT NULL` | 대상 독자 (`['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT']`) |
| `status` | `VARCHAR(30)` | `DEFAULT 'APPROVED'` | 승인 상태 (`DRAFT`, `APPROVED`, `ARCHIVED`) |
| `kind` | `VARCHAR(30)` | `DEFAULT 'BOTH'` | 노출 형태: `FAQ_ONLY`, `ASK_ONLY`, `BOTH` |
| `display_order` | `INTEGER` | `DEFAULT 0` | 정렬 순서 |
| `is_featured` | `BOOLEAN` | `DEFAULT false` | 대표 FAQ 여부 (매뉴얼당 3~4개) |
| `generated_by` | `VARCHAR(30)` | `DEFAULT 'MANUAL'` | 생성 방식 (`MANUAL`, `AI_ASSISTED`) |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 수정 일시 |

---

## 4. UI Controls & Screenshot Annotation Pin Dictionary

스크린샷 어노테이션 규격서(`SCREENSHOT_ANNOTATION_GUIDE.md`)에서 사용되는 핀(Pin) 메타데이터 구조입니다:

| 필드명 | 데이터 타입 | 설명 / 예시 |
| :--- | :--- | :--- |
| `Screenshot ID` | `VARCHAR(50)` | `SCR-[SCOPE]-[DOMAIN]-[SEQ]` (예: `SCR-I-DOC-001`, `SCR-B-FIN-001`) |
| `Page / Chapter Anchor` | `VARCHAR(100)` | 매뉴얼 본문 챕터 및 섹션 (예: `Chapter 1 · Section 1.2`) |
| `Target Route` | `VARCHAR(255)` | 캡처 화면의 URL (예: `https://portal.kselectnetwork.com/portal/help/manuals`) |
| `Pin Identifier` | `VARCHAR(20)` | `Pin 1`, `Pin 2`, `Pin 3` ... 시각적 원형 뱃지 |
| `UI Element Name` | `VARCHAR(100)` | 대상 UI 컴포넌트 명칭 (예: `Manuals Library Card Grid`) |
| `Technical Code Path` | `VARCHAR(255)` | 컴포넌트 소스 경로 (예: `app/portal/help/manuals/page.tsx`) |
| `User Action / Meaning` | `TEXT` | 사용자가 해당 영역에서 취해야 할 행동 및 화면 데이터의 비즈니스적 의미 |

---

## 5. Audit & Quality Metric Fields

매뉴얼 라이프사이클 QA 스크립트가 산출하고 검증하는 메트릭 사전입니다:

| 메트릭 명칭 | 기준치 (Expected Threshold) | 검증 도구 / 스크립트 | 실패 시 조치 |
| :--- | :---: | :--- | :--- |
| `TypeScript Errors` | **0 errors** | `npx tsc --noEmit` | 타입 에러 완전 해결 전 커밋 금지 |
| `Build Status` | **SUCCESS** | `npm run build` | 프로덕션 빌드 성공 확인 |
| `Source Files Count` | **4 / 4 files** | `readback-verify-physical-files.js` | 누락된 기획 문서 즉시 작성 |
| `Package Files Count` | **8 / 8 MD files** | `verify-package-files.ps1` | 누락된 패키지 마크다운 파일 보완 |
| `Screenshot Count` | **11 ~ 14 images** | `verify-screenshots-hash.js` | 기획된 스크린샷 전수 캡처 |
| `Screenshot Unique SHA-256` | **100% Unique (N/N)** | `verify-screenshots-hash.js` | 중복된 스크린샷 이미지 즉시 교체 |
| `PDF Page Count` | **15 ~ 25 pages** | PDF Inspector Script | 챕터 분량과 페이지 일치 검증 |
| `PDF Layout Overflow` | **0 occurrences** | PDF 시각 전수 검수 | 테이블 폭 조정 및 폰트 줄간격 조정 |
| `Developer Note Count` | **0 occurrences** | Text Regex Search (`TODO\|FIXME`) | 잔존 개발자 메모 완전 삭제 |
| `FAQ Duplicate Count` | **0 duplicates** | `verify-[domain]-faqs-publish.js` | 중복 ID 및 질문 통합·삭제 |
| `Git Working Tree` | **Clean & Synced** | `git status`, `git log -1` | `Local HEAD === origin/main` 확인 |
