# MAN-I-DOC-001 — Screenshot Requirements & Capture Specifications
## K SELECT Internal Operations: Manual Creation & Update SOP UI Asset Inventory
### (매뉴얼 제작 및 업데이트 운영 가이드 스크린샷 규격서)

---

## 1. Executive Overview & Capture Principles
본 문서는 `MAN-I-DOC-001 (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드)`의 디자인 패키지(`02_CLAUDE_PACKAGE/`) 구축 시 필요한 모든 시각적 UI 스크린샷 자산의 촬영 명세 및 어노테이션 핀 규격서입니다.

### 1.1 Core Capture Principles
1. **실제 Production 환경 우선 원칙**: 모든 웹 화면은 실서비스 도메인(`portal.kselectnetwork.com` 및 `admin.kselectnetwork.com`)의 정식 인증 세션에서 촬영합니다.
2. **고해상도 규격**: 최소 1920x1080 (Full HD) 해상도 및 100% 브라우저 배율(Scale 1.0)을 유지합니다.
3. **고유 해시 보증 (Unique SHA-256)**: 동일 이미지를 파일명만 바꾸어 중복 등록하는 행위를 엄격히 금지하며, 전수 고유 해시를 보유해야 합니다.
4. **민감 정보 보호**: 프로덕션 실데이터 중 마스터 시크릿 키, 개인 식별 정보(PII), 실제 결제 계좌 정보 등은 시각적 블러 또는 마스킹 처리합니다.
5. **어노테이션 핀(Pin) 1:1 대응**: 본문에서 설명하는 UI 컨트롤과 스크린샷 상의 Pin 번호(1, 2, 3...)가 100% 일치해야 합니다.

---

## 2. Screenshot Master Inventory (11 Core Assets)

| Screenshot ID | Priority | Scope | Screen Description / Technical Route | Chapter Anchor |
| :--- | :---: | :---: | :--- | :--- |
| `SCR-I-DOC-001` | P0 | Internal | Manuals Directory Hierarchy & 4-Tier Structure in IDE / Workspace | Chapter 1 · Section 1.2 |
| `SCR-I-DOC-002` | P0 | Brand Portal | Brand Portal Knowledge Center Manuals Library (`/portal/help/manuals`) | Chapter 2 · Section 2.1 |
| `SCR-I-DOC-003` | P0 | Brand Portal | Brand Portal Manual Detail & PDF Download Stream (`/portal/help/manuals/[slug]`) | Chapter 2 · Section 2.2 |
| `SCR-I-DOC-004` | P0 | Brand Portal | Brand Portal FAQ Hub & Topic Filter Interface (`/portal/help/faqs`) | Chapter 3 · Section 3.1 |
| `SCR-I-DOC-005` | P1 | Brand Portal | Grounded Knowledge Assistant & Policy Citation Search (`/portal/help/ask`) | Chapter 3 · Section 3.2 |
| `SCR-I-DOC-006` | P0 | Admin System | Admin Knowledge Operations Overview & Metrics Cards (`/admin/knowledge`) | Chapter 4 · Section 4.1 |
| `SCR-I-DOC-007` | P0 | Admin System | Admin Knowledge Library & Manual Status Management (`/admin/knowledge/library`)| Chapter 4 · Section 4.2 |
| `SCR-I-DOC-008` | P1 | Admin System | Admin Knowledge Item Detail, Versions & Assets Inspector (`/admin/knowledge/...`) | Chapter 4 · Section 4.3 |
| `SCR-I-DOC-009` | P0 | Reference | Master Design System Standards (`MAN-B-BRAND-001` Layout & Theme Grid) | Chapter 5 · Section 5.1 |
| `SCR-I-DOC-010` | P1 | Package | Claude Design Package Structure & Annotation Mapping Blueprint | Chapter 5 · Section 5.2 |
| `SCR-I-DOC-011` | P0 | QA Suite | Terminal QA Execution & Verification Report Suite (`verify-*-publish.js`) | Chapter 6 · Section 6.1 |

---

## 3. Screen-by-Screen Detailed Annotation Specifications

### 3.1 `SCR-I-DOC-001` — Manuals Directory Hierarchy & 4-Tier Organization
- **대상 경로**: Repository 루트 `Manuals/` 폴더 트리 (VS Code / Workspace 탐색기)
- **촬영 목적**: 13개 표준 매뉴얼 폴더와 각 폴더 내 4-Tier(`01_SOURCE`, `02_CLAUDE_PACKAGE`, `03_PUBLISHED`, `04_ARCHIVE`) 구조의 물리적 구성을 시각적으로 제시.
- **어노테이션 핀 규격**:
  - **Pin 1**: `Manuals/` 루트 디렉터리 및 모듈별 매뉴얼 네이밍 규칙 (`MAN-[SCOPE]-[DOMAIN]-[NUM]`)
  - **Pin 2**: `01_SOURCE/` 하위 4대 기획 문서 (`Source.md`, `Field_Inventory.md`, `Workflow_Map.md`, `Screenshot_Requirements.md`)
  - **Pin 3**: `02_CLAUDE_PACKAGE/` 하위 표준 프롬프트 및 자산 디렉터리
  - **Pin 4**: `03_PUBLISHED/` 최종 승인된 PDF 아티팩트 보관 위치

### 3.2 `SCR-I-DOC-002` — Brand Portal Knowledge Center Manuals Library
- **대상 경로**: `https://portal.kselectnetwork.com/portal/help/manuals`
- **촬영 목적**: 브랜드사 사용자가 접하는 공식 매뉴얼 라이브러리 목록 카드와 카테고리 필터 UI 구조 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 상단 검색바 및 토픽/모듈 필터 칩 (ONBOARDING, PRODUCTS, ORDERS, LOGISTICS, FINANCE 등)
  - **Pin 2**: 공식 매뉴얼 카드 그리드 (제목, 최신 버전 뱃지, 문서 요약, 페이지 수)
  - **Pin 3**: 매뉴얼 상세 보기 및 바로가기 액션 버튼

### 3.3 `SCR-I-DOC-003` — Brand Portal Manual Detail & PDF Download Stream
- **대상 경로**: `https://portal.kselectnetwork.com/portal/help/manuals/kno-product-management-v10`
- **촬영 목적**: 특정 매뉴얼의 상세 목차, 버전 메타데이터, 인증 기반 PDF 다운로드 액션 연동 구조 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 매뉴얼 메타데이터 헤더 (국문/영문 제목, 공식 버전 `v1.0`, 발행 일자)
  - **Pin 2**: 핵심 내용 요약 및 챕터별 목차 아웃라인
  - **Pin 3**: `[다운로드 (Download)]` 버튼 (실제 `/api/admin/knowledge/asset/[asset-id]` 호출)

### 3.4 `SCR-I-DOC-004` — Brand Portal FAQ Hub & Topic Filter Interface
- **대상 경로**: `https://portal.kselectnetwork.com/portal/help/faqs`
- **촬영 목적**: 매뉴얼에서 파생되어 배포된 90개 공식 FAQ의 토픽별 아코디언 인터페이스 및 Featured 뱃지 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 토픽별 FAQ 필터 탭 (전체, 시작하기, 브랜드, 상품, 발주, 물류, 정산 등)
  - **Pin 2**: Featured FAQ 추천 뱃지 (`⭐ Featured`) 및 우선 노출 목록
  - **Pin 3**: FAQ 아코디언 확장 영역 (한글/영문 질문 및 매뉴얼 챕터 앵커가 포함된 공식 답변)

### 3.5 `SCR-I-DOC-005` — Grounded Knowledge Assistant & Policy Citation Search
- **대상 경로**: `https://portal.kselectnetwork.com/portal/help/ask`
- **촬영 목적**: 결정론적 키워드 검색 엔진을 통해 Published 매뉴얼 본문 및 FAQ 기반으로 근거를 인용하는 지식 검색 구조 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 자연어 및 키워드 질의 입력창
  - **Pin 2**: 매칭된 지식 문서 및 FAQ 답변 요약 카드
  - **Pin 3**: 공식 출처 인용 뱃지 (`Source: MAN-B-FIN-001 Chapter 04 · Section 4.2`)

### 3.6 `SCR-I-DOC-006` — Admin Knowledge Operations Overview & Metrics Cards
- **대상 경로**: `https://admin.kselectnetwork.com/admin/knowledge`
- **촬영 목적**: 어드민 시스템의 지식 관리 허브 대시보드 지표 카드 및 상태 모니터링 UI 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 상단 운영 지표 카드 (총 지식 아이템 수, 배포 완료 수, 등록 FAQ 수, 활성 토픽 수)
  - **Pin 2**: 최근 변경된 지식 아이템 및 버전 감사 로그 피드
  - **Pin 3**: 지식 관리 서브 메뉴 내비게이션 (라이브러리, 토픽 관리, FAQ 관리, 자산 관리)

### 3.7 `SCR-I-DOC-007` — Admin Knowledge Library & Manual Status Management
- **대상 경로**: `https://admin.kselectnetwork.com/admin/knowledge/library`
- **촬영 목적**: 어드민 실무자가 지식 아이템의 `status`(`PUBLISHED`, `DRAFT`, `ARCHIVED`)를 제어하고 자산을 바인딩하는 테이블 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 상태별 필터 탭 (`PUBLISHED`, `ARCHIVED`, `ALL`)
  - **Pin 2**: 지식 아이템 마스터 목록 테이블 (ID, 슬러그, 모듈, 버전, 자산 연결 여부)
  - **Pin 3**: 관리자 편집 및 버전 갱신 액션 메뉴

### 3.8 `SCR-I-DOC-008` — Admin Knowledge Item Detail, Versions & Assets Inspector
- **대상 경로**: `https://admin.kselectnetwork.com/admin/knowledge/items/kno-product-management-v10`
- **촬영 목적**: 개별 지식 아이템에 바인딩된 `knowledge_versions`, `knowledge_manual_assets`, `knowledge_relations` 세부 검수 화면 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: 지식 아이템 기본 정보 패널 (모듈, 카테고리, 대상 독자, 태그)
  - **Pin 2**: 버전 이력 탭 (`what_changed`, `why_changed`, 효력 발생일)
  - **Pin 3**: 연결된 포털 라우트 및 PDF 자산 바이너리 검증 패널

### 3.9 `SCR-I-DOC-009` — Master Design System Standards (`MAN-B-BRAND-001`)
- **대상 경로**: `Manuals/MAN-B-BRAND-001_Brand-Policy/03_PUBLISHED/MAN-B-BRAND-001_Brand-Policy_V1.pdf` (대표 페이지)
- **촬영 목적**: K SELECT 공식 매뉴얼 시리즈의 표준이 되는 마스터 디자인 레이아웃, 컬러 팔레트, 타이포그래피 예시 제시.
- **어노테이션 핀 규격**:
  - **Pin 1**: 매뉴얼 표준 커버 헤더 및 메타데이터 블록
  - **Pin 2**: 다크 테마 카드 컨테이너 (`#18181B`) 및 인디고 액센트 (`#4F46E5`)
  - **Pin 3**: 스크린샷 컨테이너 및 하단 어노테이션 핀 콜아웃 그리드
  - **Pin 4**: 공식 바닥글 페이지네이션 (`Page X / Y`)

### 3.10 `SCR-I-DOC-010` — Claude Design Package Structure & Annotation Mapping
- **대상 경로**: `Manuals/MAN-B-FIN-001_Finance-Settlement/02_CLAUDE_PACKAGE/` (디자인 패키지 구조 예시)
- **촬영 목적**: Claude AI 디자인 생성을 위한 패키지 번들 구성 파일들과 스크린샷 핀 어노테이션 가이드의 구조적 매핑 관계 설명.
- **어노테이션 핀 규격**:
  - **Pin 1**: `PACKAGE_README.md` 및 `CLAUDE_DESIGN_MASTER_PROMPT.md`
  - **Pin 2**: `01_CONTENT/` 원고 본문과 `02_SCREENSHOTS/` 이미지 자산
  - **Pin 3**: `SCREENSHOT_ANNOTATION_GUIDE.md`의 Pin 1, 2, 3 상세 명세 블록

### 3.11 `SCR-I-DOC-011` — Terminal QA Execution & Verification Report Suite
- **대상 경로**: PowerShell / Bash 터미널 (`node scripts/verify-*-publish.js` 실행 화면)
- **촬영 목적**: 소스코드, 패키지 파일, 데이터베이스 스키마, FAQ 무결성을 전수 검증하는 자동화 스크립트 실행 및 결과 보고서 화면 제시.
- **어노테이션 핀 규격**:
  - **Pin 1**: TypeScript 무결성 검증 (`npx tsc --noEmit` -> 0 errors)
  - **Pin 2**: 데이터베이스 FAQ 90개 전수 무결성 및 고유 해시 검증 로그
  - **Pin 3**: 키워드 검색 디스커버리(Search Discovery) 테스트 성공 출력문
  - **Pin 4**: `Local HEAD === origin/main` Git 동기화 확인 라인

---

## 4. Technical Capture Guidelines
- **도구 권장**: Playwright 자동 캡처 스크립트 또는 브라우저 내장 DevTools 스크린샷 기능 활용.
- **포맷**: 무손실 24비트 RGB PNG (`.png`).
- **저장 위치**: `Manuals/MAN-I-DOC-001_Manual-SOP/02_CLAUDE_PACKAGE/02_SCREENSHOTS/`.
- **검증 스크립트**: 캡처 완료 후 `node scripts/verify-screenshots-hash.js`를 실행하여 11개 스크린샷의 무손실성 및 고유 해시 일치 여부를 전수 검증할 것.
