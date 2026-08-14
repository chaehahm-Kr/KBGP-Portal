# K SELECT Knowledge Center 실무자 활용·운영 매뉴얼 v1.0
**K SELECT NETWORK · INTERNAL OPERATIONS GUIDE**
- Document Version: `1.0`
- Date: `2026-08-14`
- Classification: `INTERNAL USE ONLY`
- Target Audience: Admin Users, Operations Staff, Editors, Approvers, Knowledge Managers, New Employees

---

## SECTION 01. Knowledge Center란?

K SELECT Knowledge Center는 단순한 문서 저장소나 PDF 파일 보관함이 아닙니다. 플랫폼 전체(Manual, Policy, FAQ, System Rule, Admin Guide, Brand Guide, Retailer Guide)의 **공통 Source of Truth (단일 진실 출처)** 역할을 수행하는 장기 운영 지식 중앙 통제 모듈입니다.

> **기억할 한 문장**: PDF를 보관하는 곳이 아니라, K SELECT의 현재 운영 기준과 정책을 안전하게 관리하는 곳입니다.

### 4대 핵심 가치
1. **Single Source of Truth**: 파편화될 수 있는 운영 규칙과 정책을 하나의 검증된 중앙 데이터베이스로 일원화
2. **Strict Audience Isolation**: INTERNAL, ADMIN, BRAND, RETAILER, PUBLIC 5단계 권한 엔진이 수집(Retrieval) 레벨에서 외부 유출 원천 차단
3. **Immutable Versioning**: 기존 운영 기준을 직접 덮어쓰지 않고, 버전 이력(v1.0 -> v1.1)을 스냅샷으로 보존하며 안전하게 개정
4. **Live System Rule Impact**: 실제 Insights/어드민 시스템 설정값이 변경되면 관련 지식 항목을 감지하여 `POTENTIALLY_OUTDATED` 상태로 검토 요청 자동 생성

> ⚠️ **Knowledge Record vs PDF Manual 차이점**
> - **Knowledge Record**: 시스템 데이터베이스에 저장되는 최우선 표준 지식 (Source of Truth)
> - **PDF Manual Asset**: 시각적 배포 및 교육을 위해 연결된 부속 문서 (Asset)
> - *PDF 파일만 교체하고 Knowledge Record의 내용이나 버전을 업데이트하지 않는 조치는 엄격히 금지됩니다.*

---

## SECTION 02. 언제 Knowledge Center를 사용하는가?

| 실무 상황 (Situation) | 이동 화면 (Menu / Tab) | 실무자 행동 가이드 (Action) |
|---|---|---|
| **"어떤 메뉴나 기능의 사용법을 모르겠습니다."** | `Library` 탭 | 검색창에 메뉴명(예: *Topic Score*, *Fact Check*) 입력 후 `MANUAL` 또는 `GUIDE` 조회 |
| **"현재 적용 중인 공식 운영 정책을 확인하고 싶습니다."** | `Library` 탭 | Type 필터를 `POLICY` 또는 `SYSTEM_RULE`로 선택하여 최신 `PUBLISHED` 건 확인 |
| **"새 운영 매뉴얼 PDF가 완성되었습니다."** | `+ Create Knowledge` | Type을 `MANUAL`로 선택, 정보 작성 후 4단계에서 PDF Asset 파일 연결 |
| **"기존 정책이나 승인 기준이 변경되었습니다."** | Detail → `VERSIONS` 탭 | 기존 글 직접 수정 금지 ❌ → `Create New Version` 버튼을 눌러 v1.1 Draft 작성 및 승인 배포 |
| **"외부 브랜드/리테일러에 공개해도 되는지 검증이 필요합니다."** | Detail → `ACCESS` 탭 | Audience 확인 및 `Preview As (Brand / Retailer)` 기능으로 시뮬레이션 검증 |
| **"어드민 시스템 설정(Rule)이 변경되었습니다."** | `Review & Updates` 탭 | `System Change Impact` 항목에서 `POTENTIALLY_OUTDATED` 상태 건 재검토 수행 |

---

## SECTION 03. 화면 구조 및 이동 방법

Knowledge Center는 어드민 좌측 사이드바 **Admin → Settings → Knowledge Center**로 진입하며, 상단 3개 탭으로 구성됩니다.

1. **Overview**: 지식 센터의 전체 지표, 요약 카운트, 조치가 필요한 항목(Needs Your Attention)을 한눈에 보는 대시보드
2. **Library**: 등록된 모든 지식을 검색, 유형/권한별 필터링하고 상세 내용을 확인하는 실무 중심 검색 화면
3. **Review & Updates**: 외부 공개 승인 대기(Awaiting Approval), 검토 필요, 시스템 변경 영향(System Impact) 관리

---

## SECTION 04. Overview 대시보드 활용법

출근 후 Overview에 접속하면 모든 숫자를 일일이 확인할 필요 없이, **Needs Your Attention** 섹션을 가장 먼저 확인합니다.

- **PUBLISHED**: 현재 정상 운영 적용 중인 지식 총 건수
- **DRAFT / IN_REVIEW**: 작성 중이거나 개정 검토 중인 지식 항목 수
- **EXTERNAL REVIEW**: Brand / Retailer / Public 공개를 위해 외부 검토가 요청된 수
- **OUTDATED**: 어드민 시스템 설정 변경으로 재검토가 필요한 지식 항목 수

---

## SECTION 05. Library — 가장 많이 사용하는 실무 화면

Library는 지식 검색과 다차원 필터링을 통해 원하는 정책과 가이드를 빠르게 검색하는 메인 작업 공간입니다.

### 검색 및 필터 구조
- **Search**: 자유 텍스트 (Title, Summary, Content, Tag 검색)
- **Type**: MANUAL, POLICY, SOP, FAQ, SYSTEM_RULE, DEFINITION, GUIDE, DECISION_RECORD, INTERNAL_RULE, TRAINING
- **Audience**: INTERNAL, ADMIN / MANAGEMENT, BRAND, RETAILER, PUBLIC
- **Module**: INSIGHTS, OPERATIONS, ONBOARDING, RETAIL_NETWORK...
- **Status**: PUBLISHED, DRAFT, IN_REVIEW, APPROVED, SUPERSEDED, ARCHIVED (기본 검색 시 SUPERSEDED/ARCHIVED 자동 제외)
- **Language**: KO, EN, BOTH

---

## SECTION 06. Knowledge Type 가이드

- **MANUAL**: 종합 운영 지침서 및 공식 매뉴얼 (PDF 가이드북 파일과 함께 전체 시스템을 안내할 때)
- **POLICY**: 회사의 공식 운영 원칙 및 규정/기준 (실무자가 반드시 지켜야 하는 원칙이나 위험 관리 기준 지정 시)
- **SOP**: 표준 운영 절차 (업무를 순서대로 진행해야 하는 단계별 프로세스 안내 시)
- **SYSTEM_RULE**: 실제 시스템 설정(Setting)과 연동된 운영 기준 (어드민 설정값과 연동하여 관리가 필요할 때)
- **DEFINITION**: 용어, 상태(Status), 필드 및 메트릭의 정합성 정의
- **GUIDE**: 시스템 실행 결과 해석 및 장애 처리 안내 가이드
- **FAQ**: 자주 묻는 질문과 답변 안내

---

## SECTION 07. 새로운 Knowledge 등록 Workflow

`+ Create Knowledge` 버튼 클릭 시 5단계 Guided Wizard 실행:
1. **Step 1 (What is this?)**: Type, Title (국문 필수/영문 선택), Module, Tags 지정
2. **Step 2 (Who is it for?)**: Audience 지정 (기본값: INTERNAL ONLY), Sensitive Internal 여부 선택
3. **Step 3 (Content)**: Summary 및 Markdown 본문 작성
4. **Step 4 (Connections)**: PDF Manual 파일 연결, Related Menu/Route/System Setting 선택
5. **Step 5 (Review & Publish)**: 정보 최종 확인 및 등록 (INTERNAL은 즉시 PUBLISHED, 외부 공개 대상은 IN_REVIEW)

---

## SECTION 08. Audience & 보안 정책 (Deny-by-Default)

> **보안 절대 수칙**: 모든 신규 Knowledge의 기본값은 INTERNAL ONLY입니다. 외부 공개를 확신할 수 없으면 INTERNAL 상태를 유지하세요.

- **INTERNAL**: K SELECT 내부 임직원 및 어드민 관리자 전용 (외부 검색 0건 차단)
- **ADMIN / MANAGEMENT**: Super Admin 및 경영진/승인권자 전용
- **BRAND**: 입점 한국 브랜드사 파트너
- **RETAILER**: 미국 오프라인 뷰티 수플라이 / 리테일 바이어
- **PUBLIC**: 인증 없이 방문하는 모든 외부 이용자

---

## SECTION 09 & 10. External Publication & Sensitive Internal

### 외부 공개 승인 흐름
1. 외부 Audience 지정 시 즉시 `IN_REVIEW (External Approval Required)`로 대기
2. `Preview As Brand` 또는 `Preview As Retailer`로 실제 외부 화면 시뮬레이션 검증
3. Approver 최종 승인 후 `PUBLISHED` 처리

⛔ **외부 공개 자료 절대 포함 금지 항목**
- 내부 마진율 계산 로직 (Margin Logic & FOB Margin Weight)
- 공급가 원가 (Supplier Cost & Sourcing Cost)
- 내부 브랜드/제조사 심사 가중치 점수표
- 미국 리테일러 바이어 협상 가이드라인 (Negotiation Rules)
- 자사 고유 알고리즘 (Proprietary Score Logic)

---

## SECTION 11. Knowledge 수정과 Version 관리

운영 정책이나 시스템 룰이 개정되었을 때 기존 `PUBLISHED` 문서를 직접 수정하거나 덮어쓰는 행위는 이력 관리상 **엄격히 금지**됩니다.

### 버전 개정 절차
`v1.0 CURRENT` → Detail의 VERSIONS 탭에서 `Create New Version` 클릭 → `v1.1 DRAFT` 작성 (What/Why 입력) → Review → Publish → `v1.0 SUPERSEDED` / `v1.1 CURRENT` 자동 전환

---

## SECTION 12 & 13. Manual Asset 연결 및 Relations 활용법

### 삼위일체(Trinity) 원칙
`PDF 파일명 (v1.0)` = `PDF 표지 버전 (1.0)` = `Knowledge Record Version (v1.0)`

### Relations (관계 연동)
- **Related Menu / Route**: 어드민 실무 메뉴(`Review Queue`) 및 라우트(`/admin/insights/queue`) 연결
- **Related System Setting**: 시스템 설정 Key(`insights_daily_auto_rule`) 연결로 변경 감지
- **Related Manual**: 세부 지식 항목을 상위 매뉴얼(K SELECT INSIGHTS 실무자 운영 매뉴얼 v1.0)과 연결

---

## SECTION 14 & 15. Review & Updates 및 System Change Impact

### System Change Impact (POTENTIALLY_OUTDATED)
어드민 시스템 설정이 변경되면 연동된 Knowledge 항목이 자동으로 `POTENTIALLY_OUTDATED` 상태로 표시됩니다.

- **조치 1 (Create Updated Version)**: 변경된 시스템 설정에 맞추어 신규 개정 Draft 버전 생성
- **조치 2 (No Update Required)**: 본문의 지식 내용이 여전히 유효함을 확인하고 이유 기록 후 NORMAL 복구

---

## SECTION 16 & 17. Archive 관리 및 문제 대응 가이드

- **물리적 삭제 금지**: 배포되었던 지식은 감사 및 이력 보존을 위해 DB에서 물리 삭제되지 않습니다.
- **Archive (보관)**: 더 이상 유효하지 않은 지식은 `ARCHIVED` 상태로 전환하여 보존합니다.

---

## SECTION 18. 실무자를 위한 DO & DON'T

### ✅ DO (권장 수칙)
1. 신규 등록 시 최우선적으로 `INTERNAL ONLY`를 적용하세요.
2. 정책 변경 시 `Create New Version`으로 개정 이력을 보존하세요.
3. 외부 공개 전 `Preview As`로 시뮬레이션 검증을 수행하세요.
4. 시스템 변경 알림(Outdated) 발생 시 사유를 확인하고 조치하세요.
5. PDF 파일명, 표지 버전, Knowledge Record 버전을 일치시키세요.
6. 세부 지식에 연관 모듈, 라우트, 상위 매뉴얼 관계를 연결하세요.

### ❌ DON'T (절대 금지 수칙)
1. 이미 `PUBLISHED`된 지식을 몰래 직접 덮어쓰지 마세요.
2. 마진, 원가, 내부 심사점수를 외부 공개 지식에 포함하지 마세요.
3. PDF 파일만 슬그머니 교체하고 버전을 유지하지 마세요.
4. 테스트 목적으로 실제 어드민 System Rule을 임의 변경하지 마세요.
5. 오래된 `SUPERSEDED` 지식을 검증 없이 최신 정책으로 인용하지 마세요.
6. 외부 공개 승인 요청 절차 없이 외부 파트너에 지식을 전달하지 마세요.

---

## SECTION 19. 5분 Quick Start Guide

- **1분: 자료 찾기** → Settings → Knowledge Center → Library 검색
- **1분: 새 지식 등록** → + Create Knowledge → 5단계 Wizard
- **1분: 정책 개정** → Knowledge Detail → VERSIONS → Create New Version
- **1분: 외부 공개** → ACCESS → Preview As → Review Request
- **1분: 변경 감지** → Review & Updates → Potentially Outdated 조치

> **최종 운영 원칙**: "출처는 단 하나로, 보안은 철저하게, 이력은 투명하게."
