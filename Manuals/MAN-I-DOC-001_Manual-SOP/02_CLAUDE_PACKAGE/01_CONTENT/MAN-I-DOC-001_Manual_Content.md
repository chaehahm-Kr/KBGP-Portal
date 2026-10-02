# K SELECT 매뉴얼 제작 및 업데이트 운영 가이드 (MAN-I-DOC-001)
## K SELECT Manual Creation, QA, Publishing & Maintenance Standard Operating Procedure (SOP)

---

## 0. 매뉴얼 개요 및 마스터 메타데이터

| 메타데이터 항목 | 공식 명세 및 기준값 |
| :--- | :--- |
| **매뉴얼 식별자 (Manual ID)** | `MAN-I-DOC-001` |
| **공식 문서명 (Title)** | K SELECT 매뉴얼 제작 및 업데이트 운영 가이드 (Manual Creation & Update SOP) |
| **문서 분류 (Classification)**| **INTERNAL OPERATIONS SOP / 사내 직원 및 관리자 전용** |
| **대상 독자 (Audience)** | 사내 운영팀, 테크 리드, 개발 담당자, 지식 관리자 |
| **문서 버전 (Version)** | `v1.0.0` (공식 제정본) |
| **발행 일자 (Effective Date)** | 2026-10-02 |
| **마스터 디자인 시스템 참조** | `MAN-B-BRAND-001_Brand-Policy_V1.pdf` (Authoritative Design Baseline) |

### 0.1 목적 및 적용 범위 (Executive Summary)
본 운영 가이드(SOP)는 K SELECT 엔터프라이즈 시스템 내에서 사용되는 모든 매뉴얼(브랜드 포털 사용자용 `MAN-B-*`, 사내 운영용 `MAN-I-*`, 어드민 관리자용 `MAN-A-*`)의 **기획, 사실 조사(Ground Truth Reconnaissance), 디자인 패키징, PDF 발행, 지식 센터(Knowledge Center) 연동, FAQ 배포, 그리고 개정 및 버전 관리**에 이르는 전 과정을 표준화하기 위해 제정되었습니다.

K SELECT의 모든 문서는 **"실제 Production 코드베이스 및 데이터베이스 스키마와 100% 일치하는 사실"**만을 기술해야 하며, 개발 미완료 기능, 추측성 로직, 과장된 보증(Absolute Claims)은 철저히 배제됩니다.

---

## Chapter 1. 매뉴얼 아키텍처 & 4-Tier 디렉터리 구조

### 1.1 K SELECT 공식 매뉴얼 인벤토리
K SELECT 네트워크의 모든 매뉴얼은 루트 디렉터리의 `Manuals/` 하위에서 모듈별 고유 ID 폴더로 격리되어 관리됩니다:
- `MAN-B-BRAND-001`: 브랜드 등록 및 관리 정책 (마스터 디자인 표준 레퍼런스)
- `MAN-B-ONB-001`: 브랜드 포털 온보딩 가이드
- `MAN-B-PROD-001`: 상품 등록, 카탈로그 및 3단계 물류 스펙 관리 매뉴얼
- `MAN-B-REG-001`: FDA, 인허가, 상표권 및 규제 증빙 관리 가이드
- `MAN-B-RET-001`: 리테일 바이어 입점 신청 및 심사 관리 매뉴얼
- `MAN-B-ORD-001`: 발주 요청(PO) 및 주문 처리 관리 가이드
- `MAN-B-LOG-001`: 출고, 선적 및 국제 물류 운송 관리 매뉴얼
- `MAN-B-FIN-001`: 인보이스 발행, 정산 조정 및 대금 지급 관리 매뉴얼
- `MAN-B-PERM-001`: 회사 정보, 사용자 역할 및 권한 관리 가이드
- `MAN-B-TASK-001`: 업무 커뮤니케이션 및 1:1 지원 센터 가이드
- `MAN-B-RPT-001`: 실적 리포트 및 데이터 분석 가이드
- `MAN-B-INT-001`: 지식 어시스턴트 및 시장 인텔리전스 가이드
- `MAN-B-FAQ-001`: 지식 센터 및 FAQ 활용 가이드
- `MAN-I-DOC-001`: 매뉴얼 제작 및 업데이트 운영 가이드 (본 문서)

### 1.2 4-Tier 디렉터리 구조 격리 원칙
모든 매뉴얼 폴더는 각 단계별 산출물의 오염 방지와 추적성(Traceability)을 위해 엄격한 4계층 구조를 준수합니다.

```text
Manuals/[MANUAL_ID]_[Title]/
├── 01_SOURCE/                                    # Tier 1: 프로덕션 코드/DB 기반 사실 조사 문서
├── 02_CLAUDE_PACKAGE/                            # Tier 2: Claude Design AI 전달용 디자인 번들
├── 03_PUBLISHED/                                 # Tier 3: 최종 승인된 완성본 PDF 배포 아티팩트
└── 04_ARCHIVE/                                   # Tier 4: 이전 버전 및 레거시 초안 보관소
```

> **[스크린샷 삽입: SCR-I-DOC-001]**
> *Workspace 내 Manuals/ 디렉터리 및 4-Tier 구조 탐색기 화면*
> - **Pin 1**: `Manuals/` 루트 디렉터리 및 13개 모듈별 표준 폴더 명명 규칙
> - **Pin 2**: `01_SOURCE/` 하위 4대 기획 문서 (`Source.md`, `Field_Inventory.md`, `Workflow_Map.md`, `Screenshot_Requirements.md`)
> - **Pin 3**: `02_CLAUDE_PACKAGE/` 하위 표준 프롬프트, 원고, 스크린샷, 다이어그램 디렉터리
> - **Pin 4**: `03_PUBLISHED/` 최종 승인된 SHA-256 검증 대상 배포용 PDF 자산

### 1.3 매뉴얼 식별자 및 대상 독자 분류 체계
- **`MAN-B-*` (Brand Portal Manual)**: 브랜드 파트너사 및 외부 공급사용 공개 매뉴얼. 지식 센터 및 FAQ 배포가 필수적으로 연동됩니다.
- **`MAN-I-*` (Internal Operations SOP)**: 본사 직원, 운영팀, 개발자를 위한 사내 전용 SOP. Public 지식 센터 및 FAQ 배포 대상에서 제외됩니다.
- **`MAN-A-*` (Admin Operations Manual)**: K SELECT 백오피스 최고 관리자 전용 운영 매뉴얼.

---

## Chapter 2. 13단계 엔드투엔드 매뉴얼 라이프사이클 & 5대 QA 게이트

### 2.1 13단계 순차적 라이프사이클 파이프라인
K SELECT 매뉴얼 제작은 기획부터 배포까지 엄격한 13단계 순차 파이프라인을 따릅니다:
1. **Source Creation**: 실서비스 UI, 소스코드, DB 스키마 전수 조사 및 4대 기획 문서 작성
2. **Source QA (Gate 1)**: 소스코드 라인 단위 대조 및 사실 무결성(Ground Truth) 감사
3. **Claude Package Creation**: Claude AI용 8대 패키지 번들 구축 및 스크린샷 캡처
4. **Package File Check**: 물리적 파일 누락 및 0바이트 파일 사전 스캔
5. **Package QA (Gate 2)**: Source ↔ Package 1:1 대조 및 스크린샷 100% Unique 해시 감사
6. **Claude Design Generation**: 마스터 가이드 기반 고품질 PDF 렌더링
7. **PDF QA (Gate 3)**: 전 페이지 시각 검수 (오버플로우, 핀 콜아웃, 개발자 잔존물 검사)
8. **Publish**: `03_PUBLISHED/` 및 `private_assets/manuals/`로 최종 PDF 복제
9. **Publish QA**: 파일 크기, 페이지 수, 바이너리 무결성 및 SHA-256 해시 검증 (**Internal SOP 완료 지점**)
10. **Knowledge Center Publish**: Supabase PostgreSQL 4대 테이블 upsert (Public 매뉴얼 전용)
11. **Knowledge Publish QA (Gate 4)**: 지식 아이템 활성화 및 PDF 다운로드 스트림 200 OK 검증
12. **FAQ Publish**: Published PDF 기반 8~12개 공식 FAQ 등록 및 `store.ts` 동기화
13. **FAQ QA (Gate 5)**: 검색 디스커버리 쿼리, 중복 0건, 회귀 테스트 및 최종 Git 동기화

### 2.2 5대 품질 게이트(Quality Gates)와 엄격한 차단 원칙 (Strict Blocking)
> [!IMPORTANT]
> **Strict Gate Blocking Rule**:
> 각 QA 게이트를 100% 만족하지 못한 상태에서는 다음 단계로의 진입이 원천 차단됩니다.
> - **Gate 1 (Source QA)** 미통과 시 ➔ 패키지 생성 금지
> - **Gate 2 (Package QA)** 미통과 시 ➔ 디자인 생성 금지
> - **Gate 3 (PDF QA)** 미통과 시 ➔ Publish 금지
> - **Gate 4 (Knowledge QA)** 미통과 시 ➔ FAQ 생성 금지 (**Hard Prerequisite**)
> - **Gate 5 (FAQ QA)** 미통과 시 ➔ Git Commit & Release 금지

### 2.3 브랜드 포털 지식 센터 표면
> **[스크린샷 삽입: SCR-I-DOC-002]**
> *Brand Portal 지식 센터 공식 매뉴얼 라이브러리 목록 화면 (`/portal/help`)*
> - **Pin 1**: 상단 검색바 및 토픽/모듈별 필터 칩 (PRODUCTS, ORDERS, FINANCE 등)
> - **Pin 2**: 공식 매뉴얼 카드 그리드 (최신 버전 뱃지, 문서 요약, 페이지 수)
> - **Pin 3**: 매뉴얼 상세 보기 및 바로가기 액션 버튼

> **[스크린샷 삽입: SCR-I-DOC-003]**
> *Brand Portal 매뉴얼 상세 목차 및 PDF 다운로드 화면 (`/portal/help/[slug]`)*
> - **Pin 1**: 매뉴얼 메타데이터 헤더 (국문/영문 제목, 공식 버전 `v1.0`, 발행일)
> - **Pin 2**: 핵심 내용 요약 및 챕터별 상세 목차 아웃라인
> - **Pin 3**: `[다운로드 (Download)]` 버튼 (`/api/admin/knowledge/asset/[id]` 스트림)

---

## Chapter 3. 지식 센터 및 Grounded Q&A 어시스턴트 구조

### 3.1 FAQ Hub 및 Featured FAQ 운영 기준
- **작성 수량**: 매뉴얼당 8~12개의 실무 중심 FAQ를 국문/영문으로 병기 작성.
- **Featured FAQ**: 사용자에게 가장 빈번하고 중요한 핵심 3~4개를 `is_featured = true`로 지정하여 상단에 우선 노출.
- **근거 앵커 명시**: 모든 FAQ 답변에는 반드시 `(MAN-B-FIN-001 Chapter 04 · Section 4.2)`와 같이 근거 매뉴얼의 챕터 및 섹션 앵커를 명시.

> **[스크린샷 삽입: SCR-I-DOC-004]**
> *Brand Portal FAQ Hub 인터페이스 (`/portal/help/faqs`)*
> - **Pin 1**: 토픽별 FAQ 필터 탭 (전체, 시작하기, 상품, 발주, 물류, 정산 등)
> - **Pin 2**: Featured FAQ 추천 뱃지 (`⭐ Featured`) 및 우선 노출 카드
> - **Pin 3**: FAQ 아코디언 확장 영역 (한글/영문 질문 및 매뉴얼 앵커 답변)

### 3.2 Grounded Ask Q&A 어시스턴트 구조
K SELECT의 Q&A 어시스턴트(`/portal/help/ask`)는 환각(Hallucination)을 원천 차단하기 위해 **결정론적 서버 사이드 매칭(Deterministic Server-Side Matching)** 엔진(`lib/knowledge/ask-engine.ts`)을 기반으로 동작합니다. 배포된 `knowledge_articles` 및 `knowledge_faqs`만을 검색 대상으로 삼으며, 검색 결과에 공식 출처 뱃지를 강제 바인딩합니다.

> **[스크린샷 삽입: SCR-I-DOC-005]**
> *Grounded Ask 지식 검색 및 출처 인용 화면 (`/portal/help/ask`)*
> - **Pin 1**: 자연어 및 키워드 질의 입력창
> - **Pin 2**: 매칭된 공식 지식 문서 및 FAQ 답변 요약 카드
> - **Pin 3**: 공식 출처 인용 뱃지 (`Source: MAN-B-FIN-001 Chapter 04 · Section 4.2`)

### 3.3 FAQ 발행의 필수 선행 조건 (Knowledge Item 선행 원칙)
> [!CAUTION]
> **Hard Prerequisite Rule**:
> FAQ는 반드시 연계할 Knowledge Item이 `knowledge_items` 테이블에 `status = 'PUBLISHED'`로 존재해야만 발행할 수 있습니다. Knowledge Item이 없는 상태에서 FAQ를 임의의 ID로 단독 배포하는 행위는 엄격히 금지됩니다.

---

## Chapter 4. 어드민 지식 운영 허브 & 버전 관리

### 4.1 어드민 지식 허브 대시보드 지표
어드민 지식 허브(`/admin/knowledge`)는 시스템 전체의 지식 아이템 수, 배포 완료 상태, 등록된 FAQ 수 및 토픽 매핑 상태를 실시간으로 모니터링합니다.

> **[스크린샷 삽입: SCR-I-DOC-006]**
> *Admin 지식 허브 대시보드 화면 (`/admin/knowledge`)*
> - **Pin 1**: 상단 운영 KPI 지표 카드 (총 지식 아이템, 배포 완료, 등록 FAQ, 활성 토픽)
> - **Pin 2**: 최근 변경된 지식 아이템 및 버전 감사 로그 피드
> - **Pin 3**: 지식 관리 서브 메뉴 내비게이션 (라이브러리, 토픽 관리, FAQ 관리, 자산 관리)

### 4.2 어드민 지식 라이브러리 테이블
지식 아이템의 `status`(`DRAFT`, `PUBLISHED`, `ARCHIVED`)를 제어하고 모듈별 카테고리를 관리합니다.

> **[스크린샷 삽입: SCR-I-DOC-007]**
> *Admin 지식 라이브러리 목록 테이블 (`/admin/knowledge/library`)*
> - **Pin 1**: 상태별 필터 탭 (`PUBLISHED`, `ARCHIVED`, `ALL`)
> - **Pin 2**: 지식 아이템 마스터 목록 테이블 (ID, 슬러그, 모듈, 버전, 자산 연결 여부)
> - **Pin 3**: 관리자 편집 및 버전 갱신 액션 메뉴

### 4.3 개별 지식 아이템 세부 인스펙터
개별 지식 아이템에 바인딩된 버전 이력(`knowledge_versions`), 실물 PDF 바이너리(`knowledge_manual_assets`), 그리고 포털 라우트 매핑(`knowledge_relations`)을 전수 검수합니다.

> **[스크린샷 삽입: SCR-I-DOC-008]**
> *Admin 지식 아이템 상세 및 버전 검수 화면 (`/admin/knowledge/[id]`)*
> - **Pin 1**: 지식 아이템 기본 정보 패널 (모듈, 카테고리, 대상 독자, 태그)
> - **Pin 2**: 버전 이력 탭 (`what_changed`, `why_changed`, 효력 발생일)
> - **Pin 3**: 연결된 포털 라우트 및 PDF 자산 바이너리 검증 패널

---

## Chapter 5. 마스터 디자인 시스템 규격 & Claude AI 패키징

### 5.1 MAN-B-BRAND-001 마스터 디자인 시스템 규격
모든 공식 매뉴얼 PDF는 `MAN-B-BRAND-001_Brand-Policy_V1.pdf`의 디자인 토큰을 100% 준수합니다:
- **Canvas Background**: `#09090B` (Dark Slate/Zinc-950)
- **Card Containers**: `#18181B` (Zinc-900), 테두리 `#27272A` (Zinc-800)
- **Primary Accent**: `#4F46E5` (Indigo-600)
- **Success State**: `#059669` (Emerald-600)
- **Warning State**: `#D97706` (Amber-600)
- **Danger State**: `#E11D48` (Rose-600)

> **[스크린샷 삽입: SCR-I-DOC-009]**
> *MAN-B-BRAND-001 마스터 디자인 시스템 규격 및 컬러 토큰 화면*
> - **Pin 1**: 매뉴얼 표준 커버 헤더 및 메타데이터 블록
> - **Pin 2**: 다크 테마 카드 컨테이너 (`#18181B`) 및 인디고 액센트 (`#4F46E5`)
> - **Pin 3**: 스크린샷 컨테이너 및 하단 어노테이션 핀 콜아웃 그리드
> - **Pin 4**: 공식 바닥글 페이지네이션 (`Page X / Y`)

### 5.2 Claude Design Package 8-File 번들 구조
디자인 패키지(`02_CLAUDE_PACKAGE/`)는 다음 8개 표준 마크다운과 4개 하위 디렉터리로 구성됩니다:
1. `PACKAGE_README.md`
2. `CLAUDE_DESIGN_MASTER_PROMPT.md`
3. `CLAUDE_DESIGN_HANDOFF_PROMPT.md`
4. `[MANUAL_ID]_Design_Structure.md`
5. `01_CONTENT/[MANUAL_ID]_Manual_Content.md`
6. `02_SCREENSHOTS/` (스크린샷 PNG + `SCREENSHOT_ANNOTATION_GUIDE.md`)
7. `03_DIAGRAMS/` (`[DOMAIN]_ARCHITECTURE_DIAGRAMS.md`)
8. `04_REFERENCE/` (`REFERENCE_GUIDE.md`)

> **[스크린샷 삽입: SCR-I-DOC-010]**
> *Claude Design 패키지 구조 및 핀 매핑 청사진 화면*
> - **Pin 1**: `PACKAGE_README.md` 및 `CLAUDE_DESIGN_MASTER_PROMPT.md`
> - **Pin 2**: `01_CONTENT/` 원고 본문과 `02_SCREENSHOTS/` 이미지 자산
> - **Pin 3**: `SCREENSHOT_ANNOTATION_GUIDE.md`의 Pin 1, 2, 3 상세 명세 블록

---

## Chapter 6. 자동화 QA 검증 스위트 & Git 릴리즈 파이프라인

### 6.1 자동화 스크립트 기반 무결성 검증
매뉴얼 배포 전 실행하는 표준 검증 명령어 스위트입니다:
1. `npx tsc --noEmit` ➔ TypeScript 컴파일 0 에러 확인
2. `node scripts/verify-screenshots-hash.js` ➔ 스크린샷 11장 100% Unique 해시 확인
3. `node scripts/verify-[domain]-faqs-publish.js` ➔ FAQ 90개 전수 무결성 및 Search Discovery 확인
4. `git rev-parse HEAD; git rev-parse origin/main` ➔ Local HEAD === origin/main 일치 확인

> **[스크린샷 삽입: SCR-I-DOC-011]**
> *터미널 자동화 QA 스크립트 실행 및 전 항목 PASS 결과 화면*
> - **Pin 1**: TypeScript 무결성 검증 (`npx tsc --noEmit` -> 0 errors)
> - **Pin 2**: 스크린샷 전수 실재 및 100% Unique SHA-256 해시 검증 로그
> - **Pin 3**: 키워드 검색 디스커버리(Search Discovery) 테스트 성공 출력문
> - **Pin 4**: `Local HEAD === origin/main` Git 동기화 확인 라인

---

## Chapter 7. 매뉴얼 개정 및 연쇄 영향 업데이트 SOP

### 7.1 버전 변경 레벨 분류
- **Patch / Revision (`v1.0` ➔ `v1.0.1` / `R1`)**: 단순 오탈자 수정, UI 단순 스타일 변경.
- **Minor Version (`v1.0` ➔ `v1.1.0`)**: 신규 서브 탭, 추가 입력 필드, 신규 비파괴적 상태 코드 추가.
- **Major Version (`v1.0` ➔ `v2.0.0`)**: 핵심 비즈니스 로직 변경, 워크플로우 전면 개편, 도메인 분리.

### 7.2 6단계 연쇄 영향(Cascading Impact) 체크리스트
시스템 변경 시 매뉴얼 담당자는 다음 연쇄 영향을 빠짐없이 반영해야 합니다:
1. `01_SOURCE/` 4대 기획 문서 갱신
2. `02_SCREENSHOTS/` 영향받은 UI 화면 재촬영
3. `01_CONTENT/` 원고 및 `Design_Structure.md` 수정 후 PDF 재렌더링
4. `03_PUBLISHED/` 및 `private_assets/manuals/` PDF 교체
5. Supabase `knowledge_versions`에 버전 이력 등록
6. Supabase `knowledge_faqs` 및 `lib/knowledge/store.ts` 동기화

---

## Appendix (부록)

### Appendix A. 6대 Production Grounding 상태 사전
- `VERIFIED`: 프로덕션 코드/DB에서 100% 확인된 기능
- `NOT IMPLEMENTED`: 사용자가 기대할 수 있으나 현재 미구현된 기능 (오해 방지용 명시)
- `SYSTEM GAP`: 정책 요구사항과 시스템 구현 간의 괴리가 있는 부분
- `LEGACY`: 과거 사용되었으나 현재는 권장되지 않는 기능
- `PENDING`: 향후 배포 예정이나 현재 브랜치에 미반영된 상태
- `NOT APPLICABLE`: 특정 역할 또는 계약 형태에 적용되지 않는 항목

### Appendix B. 5대 도메인 상태 경계 구분표
1. `ARRIVED` (화물 창고 도착) ≠ `RECEIVED` (실물 검수 및 입고 확정)
2. `Shipping Complete` (선적 완료) ≠ `Settlement Complete` (정산 및 송금 완료)
3. `Invoice Status` (문서 심사) ≠ `Payment Status` (동적 지급 상태) ≠ `Settlement Status` (행정적 마감)
4. `ORD Status` (트랜잭션 생애주기) ≠ `RPT Views` (통계적 집계 데이터)
5. `PERM Assignment` (계정 권한) ≠ `TASK Support Ticket` (1:1 브랜드 문의 스레드)

### Appendix C. 7대 완료 기준 (Definition of Done)
- [✓] 1. Source Documents Created & Verified (4/4 in `01_SOURCE/`)
- [✓] 2. Package QA Passed (8 Markdowns & 11 Unique Screenshots in `02_CLAUDE_PACKAGE/`)
- [✓] 3. Claude Design & Layout Generated (MAN-B-BRAND-001 Aligned)
- [✓] 4. PDF QA Passed (0 Overflow, 0 TODOs, 100% Verified)
- [✓] 5. Published Artifacts Stored (`03_PUBLISHED/` & `private_assets/manuals/`)
- [✓] 6. Knowledge Center Registered (Public Manual Only)
- [✓] 7. FAQs Published & Verified (Public Manual Only)
