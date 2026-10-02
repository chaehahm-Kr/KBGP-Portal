# MAN-I-DOC-001 — Screenshot Annotation Guide
## K SELECT Internal Operations: Manual Creation & Update SOP UI Annotation Specifications
### (스크린샷 어노테이션 핀 가이드 및 세부 설명서)

---

## 1. Overview & Image Specifications
본 문서는 `MAN-I-DOC-001 (K SELECT 매뉴얼 제작 및 업데이트 운영 가이드)`의 11개 스크린샷에 대한 핀(Pin) 번호별 UI 컴포넌트 명칭, 소스코드 경로, 그리고 비즈니스적 의미를 상세히 기술한 어노테이션 가이드입니다.

- **전체 스크린샷 수량**: 11장 (`SCR-I-DOC-001.png` ~ `SCR-I-DOC-011.png`)
- **해시 무결성**: 11/11 Unique SHA-256 검증 완료 (중복 0건)
- **화면 배율 / 테마**: 1440x900 / Dark Slate Zinc Theme

---

## 2. Screen-by-Screen Detailed Annotation Pin Specifications

### 2.1 `SCR-I-DOC-001.png` — Workspace Manuals Hierarchy & 4-Tier Organization
- **대상 파일 / 경로**: VS Code Workspace 탐색기 (`Manuals/` 루트 및 `MAN-I-DOC-001_Manual-SOP/`)
- **매뉴얼 위치**: Chapter 1 · Section 1.2
- **어노테이션 핀 상세**:
  - **Pin 1 [루트 디렉터리]**: `Manuals/` 루트 디렉터리와 13개 모듈별 표준 명명 규칙 (`MAN-[SCOPE]-[DOMAIN]-[NUM]`)
  - **Pin 2 [Tier 1: 01_SOURCE]**: 코드/DB 기반 기획 문서군 (`Source.md`, `Field_Inventory.md`, `Workflow_Map.md`, `Screenshot_Requirements.md`)
  - **Pin 3 [Tier 2: 02_CLAUDE_PACKAGE]**: Claude Design AI 전달용 번들 (`01_CONTENT/`, `02_SCREENSHOTS/`, `03_DIAGRAMS/`, `04_REFERENCE/`)
  - **Pin 4 [Tier 3: 03_PUBLISHED]**: 최종 검수 승인된 완성본 PDF 배포 아티팩트 (`MAN-I-DOC-001_Manual-SOP_V1.pdf`)

### 2.2 `SCR-I-DOC-002.png` — Brand Portal Help & Manuals Hub
- **대상 파일 / 경로**: `https://portal.kselectnetwork.com/portal/help` (`app/portal/help/page.tsx`)
- **매뉴얼 위치**: Chapter 2 · Section 2.3
- **어노테이션 핀 상세**:
  - **Pin 1 [토픽 필터 칩]**: 지식 카테고리/모듈별 필터 칩 (시작하기, 브랜드, 상품, 발주, 물류, 정산 등)
  - **Pin 2 [공식 매뉴얼 카드]**: 배포된 공식 매뉴얼 카드 그리드 (문서 제목, 버전 뱃지 `v1.0`, 핵심 요약)
  - **Pin 3 [상세 바로가기 버튼]**: 개별 매뉴얼 상세 목차 및 다운로드 화면으로 이동하는 액션 링크

### 2.3 `SCR-I-DOC-003.png` — Brand Portal Manual Detail View
- **대상 파일 / 경로**: `https://portal.kselectnetwork.com/portal/help/kno-finance-settlement-v10` (`app/portal/help/[slug]/page.tsx`)
- **매뉴얼 위치**: Chapter 2 · Section 2.3
- **어노테이션 핀 상세**:
  - **Pin 1 [매뉴얼 메타데이터 헤더]**: 공식 한국어/영어 제목, 최신 배포 버전 `v1.0`, 발행 일자
  - **Pin 2 [챕터 상세 목차]**: 매뉴얼의 전체 챕터 및 섹션 아웃라인 (Grounded Chapter Outline)
  - **Pin 3 [다운로드 스트림 버튼]**: 클릭 시 `/api/admin/knowledge/asset/[asset-id]`를 호출하여 인증된 바이너리 PDF 스트림 전송

### 2.4 `SCR-I-DOC-004.png` — Brand Portal FAQ Hub Interface
- **대상 파일 / 경로**: `https://portal.kselectnetwork.com/portal/help/faqs` (`app/portal/help/faqs/page.tsx`)
- **매뉴얼 위치**: Chapter 3 · Section 3.1
- **어노테이션 핀 상세**:
  - **Pin 1 [토픽 탭 내비게이션]**: 토픽별 FAQ 필터 탭 (전체, 온보딩, 상품, 주문, 선적, 정산 등)
  - **Pin 2 [Featured FAQ 뱃지]**: 편집자가 선정한 핵심 FAQ 추천 뱃지 (`⭐ Featured`) 및 우선 노출 카드
  - **Pin 3 [FAQ 아코디언 본문]**: 국문/영문 질문 및 매뉴얼 챕터 앵커가 포함된 공식 답변 확장 영역

### 2.5 `SCR-I-DOC-005.png` — Grounded Ask Knowledge Assistant
- **대상 파일 / 경로**: `https://portal.kselectnetwork.com/portal/help/ask` (`app/portal/help/ask/page.tsx`)
- **매뉴얼 위치**: Chapter 3 · Section 3.2
- **어노테이션 핀 상세**:
  - **Pin 1 [자연어 질의 입력창]**: 정책, 절차, 규정에 대한 키워드 및 자연어 질문 입력 인터페이스
  - **Pin 2 [결정론적 매칭 답변 카드]**: `lib/knowledge/ask-engine.ts`를 통해 매칭된 공식 지식 요약 카드
  - **Pin 3 [공식 출처 인용 뱃지]**: 환각 없는 정책 출처 앵커 (`Source: MAN-B-FIN-001 Chapter 04 · Section 4.2`)

### 2.6 `SCR-I-DOC-006.png` — Admin Knowledge Operations Overview
- **대상 파일 / 경로**: `https://admin.kselectnetwork.com/admin/knowledge` (`app/admin/knowledge/page.tsx`)
- **매뉴얼 위치**: Chapter 4 · Section 4.1
- **어노테이션 핀 상세**:
  - **Pin 1 [운영 KPI 요약 카드]**: 총 지식 아이템 수, 배포 완료 수, 등록 FAQ 수, 활성 토픽 수 요약 카드
  - **Pin 2 [최근 감사 로그 피드]**: 최근 배포 및 개정된 지식 아이템의 변경 이력 타임라인
  - **Pin 3 [서브 메뉴 내비게이션]**: 라이브러리, 토픽 관리, FAQ 관리, 자산 관리 바로가기 탭

### 2.7 `SCR-I-DOC-007.png` — Admin Knowledge Library Table
- **대상 파일 / 경로**: `https://admin.kselectnetwork.com/admin/knowledge/library` (`app/admin/knowledge/library/page.tsx`)
- **매뉴얼 위치**: Chapter 4 · Section 4.2
- **어노테이션 핀 상세**:
  - **Pin 1 [상태 필터 탭]**: 배포 상태별 탭 (`PUBLISHED`, `ARCHIVED`, `DRAFT`, `ALL`)
  - **Pin 2 [지식 마스터 테이블]**: 아이템 식별자, 슬러그, 시스템 모듈, 버전, 자산 바인딩 상태 테이블
  - **Pin 3 [관리 액션 메뉴]**: 개별 아이템 상세 조회, 버전 개정, 아카이브 처리 액션 버튼

### 2.8 `SCR-I-DOC-008.png` — Admin Knowledge Item Detail Inspector
- **대상 파일 / 경로**: `https://admin.kselectnetwork.com/admin/knowledge/[id]` (`app/admin/knowledge/[id]/page.tsx`)
- **매뉴얼 위치**: Chapter 4 · Section 4.3
- **어노테이션 핀 상세**:
  - **Pin 1 [기본 메타데이터 패널]**: 지식 아이템 ID, 모듈(`FINANCE`), 카테고리, 대상 독자 태그
  - **Pin 2 [버전 이력 탭]**: `knowledge_versions`에 기록된 `what_changed`, `why_changed`, 발행 일자
  - **Pin 3 [PDF 자산 및 라우트 패널]**: 연결된 포털 URL 경로(`knowledge_relations`) 및 실물 PDF 파일 검수

### 2.9 `SCR-I-DOC-009.png` — Master Design System Reference Grid
- **대상 파일 / 경로**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf` 디자인 토큰 렌더링 화면
- **매뉴얼 위치**: Chapter 5 · Section 5.1
- **어노테이션 핀 상세**:
  - **Pin 1 [표준 커버 헤더]**: K SELECT 공식 로고, 매뉴얼 ID, 버전, 배포 일자 메타데이터 블록
  - **Pin 2 [다크 카드 컬러 팔레트]**: `#09090B` 배경, `#18181B` 카드, `#4F46E5` 인디고 주 강조색
  - **Pin 3 [표준 콜아웃 컨테이너]**: Scope(인디고), Success(에메랄드), Warning(앰버) 상태 콜아웃 박스
  - **Pin 4 [공식 바닥글 페이지네이션]**: 하단 고정 페이지네이션 (`Page X / Y`) 및 도메인 표기

### 2.10 `SCR-I-DOC-010.png` — Claude Design Package Structure Blueprint
- **대상 파일 / 경로**: Claude Design AI 패키지 아키텍처 명세 화면
- **매뉴얼 위치**: Chapter 5 · Section 5.2
- **어노테이션 핀 상세**:
  - **Pin 1 [마스터 프롬프트 블록]**: `PACKAGE_README.md`, `CLAUDE_DESIGN_MASTER_PROMPT.md`
  - **Pin 2 [원고 및 이미지 자산군]**: `01_CONTENT/Manual_Content.md`, `02_SCREENSHOTS/` (11 Unique PNGs)
  - **Pin 3 [핀 어노테이션 블록]**: `SCREENSHOT_ANNOTATION_GUIDE.md`의 Pin 1, 2, 3 상세 규격 명세

### 2.11 `SCR-I-DOC-011.png` — Terminal QA Execution & Verification Report Suite
- **대상 파일 / 경로**: PowerShell 터미널 자동화 QA 스크립트 실행 화면
- **매뉴얼 위치**: Chapter 6 · Section 6.1
- **어노테이션 핀 상세**:
  - **Pin 1 [TypeScript 무결성]**: `npx tsc --noEmit` 실행 결과 0 Errors 통과 로그
  - **Pin 2 [스크린샷 고유 해시]**: `verify-screenshots-hash.js` 11장 전수 Unique SHA-256 검증 로그
  - **Pin 3 [Search Discovery 쿼리]**: `verify-fin-faqs-publish.js` 90개 FAQ 전수 무결성 및 검색 통과
  - **Pin 4 [Git 동기화 검증]**: `git rev-parse HEAD; git rev-parse origin/main` 일치 확인 라인
