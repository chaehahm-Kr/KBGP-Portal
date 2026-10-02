# MAN-B-INT-001 — Field Inventory
## Intelligence & Insights Domain: UI Components & Database Schema Field Directory

---

## 1. Domain Scope & Separation

- **Brand Portal Operational Dashboard (`/portal`)**: 대시보드의 KPI 카드, 온보딩 진행 바, 미지급 정산액 등은 `RPT` (Reports & Performance) 및 `ONB` (Onboarding) 도메인에서 관리되는 운영 집계 데이터이며 본 인텔리전스 인벤토리에서는 제외됨.
- **본 인벤토리 적용 범위**:
  1. Brand Portal Grounded Knowledge Assistant UI 필드 (`/portal/help/ask`, `/portal/ask`)
  2. K SELECT Admin Insights 시스템 및 데이터베이스 스키마 (`/admin/insights/*`, `supabase/migrations/0046_...` ~ `0053_...`)

---

## 2. Brand Portal Grounded Knowledge Assistant Fields (`/portal/help/ask`)

| Field Name | UI Label / Display | Component / Type Source | Data Type | Validation & Operational Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `question` (`userQuery`) | 정책 질문 입력창 | `AskKSelectView.tsx` | String | 최소 2자 이상 입력, 공백 제거 정규화 후 처리 |
| `directAnswer` | 직접 답변 본문 | `AskAnswerResponse.directAnswer` | Markdown String | 공식 검증 지식 기반 직접 안내문 렌더링 |
| `currentRuleBullets` | 핵심 규칙 요약 불릿 | `AskAnswerResponse.currentRuleBullets` | String Array | 공식 매뉴얼 핵심 정책 2~4개 불릿 요약 서빙 |
| `sources` | 공식 인용 출처 목록 | `AskAnswerResponse.sources` | Object Array | 인용 매뉴얼의 `id`, `slug`, `title`, `type`, `version`, `status`, `url`, `documentUrl` 포함 |
| `actions` | 바로가기 액션 링크 | `AskAnswerResponse.actions` | Object Array | 상세 매뉴얼 링크(`knowledge`), 관련 기능 라우트(`route`), 1:1 지원 센터(`support`) |
| `isUnknown` | 미확인 질문 여부 | `AskAnswerResponse.isUnknown` | Boolean | 등록된 공식 정책이 없거나 출처 미흡 시 `true` (No Fabrication 규칙) |
| `isReadonlyActionAttempt` | 쓰기 작업 시도 감지 | `AskAnswerResponse.isReadonlyActionAttempt` | Boolean | "수정해줘", "삭제해줘" 등 시도 시 Read-Only 안내 플래그 `true` |
| `audience` | 인가된 청중 범위 | `AskAnswerResponse.audience` | Enum | 서버 세션 기반 강제 (`BRAND` / `RETAILER` / `INTERNAL`) |

---

## 3. Admin Insights System DB Schema Inventory

### 3.1 `insights_articles` Table (Master Articles Repository)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | 아티클 고유 식별자 |
| `title` / `title_ko` | `TEXT` | `NOT NULL` | 아티클 국문 제목 |
| `title_en` | `TEXT` | `NULLABLE` | 아티클 영문 제목 |
| `slug` | `TEXT` | `NOT NULL`, `UNIQUE` | URL 세그먼트 식별자 |
| `subtitle` / `subtitle_ko` | `TEXT` | `NULLABLE` | 국문 부제 |
| `subtitle_en` | `TEXT` | `NULLABLE` | 영문 부제 |
| `category` / `network_category` | `TEXT` | `NOT NULL` | 소속 카테고리명 |
| `content_type` | `TEXT` | `NOT NULL`, `DEFAULT 'ARTICLE'` | 콘텐츠 유형 |
| `hero_image` | `TEXT` | `NULLABLE` | 대표 비주얼 이미지 URL |
| `excerpt` / `summary_ko` | `TEXT` | `NULLABLE` | 국문 요약문 |
| `summary_en` | `TEXT` | `NULLABLE` | 영문 요약문 |
| `body_blocks_ko` | `JSONB` | `DEFAULT '[]'::jsonb` | 국문 본문 블록 데이터 |
| `body_blocks_en` | `JSONB` | `DEFAULT '[]'::jsonb` | 영문 본문 블록 데이터 |
| `author` | `TEXT` | `NOT NULL` | 작성 저자 / Desk 명칭 |
| `publish_date` | `TIMESTAMPTZ` | `NULLABLE` | 최초 게시 일시 |
| `sources` / `sources_detail` | `JSONB` | `DEFAULT '[]'::jsonb` | 참조된 시장 데이터/규제 소스 목록 (`SourceItem[]`) |
| `claims` | `JSONB` | `DEFAULT '[]'::jsonb` | 아티클 내 추출된 주장 목록 (`VerifiedClaim[]`) |
| `claim_risk_summary` | `JSONB` | `DEFAULT '{}'::jsonb` | HIGH/MED/LOW 리스크 수치 및 Fact-Check 통계 |
| `content_layers` | `JSONB` | `DEFAULT '{}'::jsonb` | 4대 레이어 (Fact, Signal, View, Action) 분리 데이터 |
| `research_brief` | `JSONB` | `DEFAULT '{}'::jsonb` | 핵심 리서치 브리프 (시그널, 근거, 불확실성, 시사점) |
| `status` | `TEXT` | `NOT NULL`, `DEFAULT 'DRAFT'` | `AI_DRAFT`, `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED` |
| `audience` | `TEXT` | `NOT NULL`, `DEFAULT 'BRAND'` | `BRAND`, `RETAILER`, `BOTH` |
| `publish_channels` | `TEXT[]` | `DEFAULT '{}'::text[]` | `K_SELECT_NETWORK`, `K_SELECT_HUB` |
| `network_enabled` | `BOOLEAN` | `DEFAULT true` | Network 채널 활성화 여부 |
| `hub_enabled` | `BOOLEAN` | `DEFAULT true` | Hub 채널 활성화 여부 |
| `topic_score` | `INTEGER` | `DEFAULT 85` | 6대 가중치 종합 평가 점수 (0-100) |
| `featured` | `BOOLEAN` | `DEFAULT false` | 메인 피처드 아티클 지정 여부 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 수정 일시 |

### 3.2 `insights_editorial_rules` Table (Master Rules & Quota Config)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 규칙 설정 고유 식별자 |
| `rule_key` | `TEXT` | `UNIQUE`, `DEFAULT 'DEFAULT_MASTER_RULES'` | 규칙 마스터 키 |
| `daily_run_time` | `TEXT` | `DEFAULT '05:00 AM'` | 일일 오토 엔진 실행 시각 (ET) |
| `timezone` | `TEXT` | `DEFAULT 'America/New_York'` | 기준 타임존 |
| `minimum_topic_score` | `INTEGER` | `DEFAULT 80` | 초안 생성 품질 합격 기준 점수 (기본 80점) |
| `network_daily_draft_max` | `INTEGER` | `DEFAULT 3` | Network 채널 일일 최대 초안 목표 (3건) |
| `hub_daily_draft_max` | `INTEGER` | `DEFAULT 3` | Hub 채널 일일 최대 초안 목표 (3건) |
| `topic_score_weights` | `JSONB` | `DEFAULT '{"relevance":25,...}'` | 6대 평가 가중치 구성 |
| `human_approval_required` | `BOOLEAN` | `DEFAULT true` | 게시 전 에디터 승인 필수 강제 여부 |
| `auto_publish` | `BOOLEAN` | `DEFAULT false` | 자동 게시 여부 (기본 false — 엄격한 인간 게이트) |

### 3.3 `insights_automation_runs` Table (Auto-Engine Execution Logs)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 실행 로그 고유 식별자 |
| `run_date` | `DATE` | `DEFAULT CURRENT_DATE` | 실행 일자 |
| `started_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 파이프라인 시작 시각 |
| `completed_at` | `TIMESTAMPTZ` | `NULLABLE` | 파이프라인 종료 시각 |
| `sources_scanned` | `INTEGER` | `DEFAULT 0` | 스캔된 소스 건수 |
| `sources_accepted` | `INTEGER` | `DEFAULT 0` | 채택된 소스 건수 |
| `candidates_found` | `INTEGER` | `DEFAULT 0` | 생성된 주제 후보 건수 |
| `candidates_scored` | `INTEGER` | `DEFAULT 0` | 평가 점수 산출 건수 |
| `candidates_gte_80` | `INTEGER` | `DEFAULT 0` | 80점 이상 합격 건수 |
| `critical_rejects` | `INTEGER` | `DEFAULT 0` | 필수 조건 미달 탈락 건수 |
| `duplicate_rejects` | `INTEGER` | `DEFAULT 0` | 중복 검사 탈락 건수 |
| `network_drafts` | `INTEGER` | `DEFAULT 0` | 생성된 Network 초안 수 |
| `hub_drafts` | `INTEGER` | `DEFAULT 0` | 생성된 Hub 초안 수 |
| `shared_core_drafts` | `INTEGER` | `DEFAULT 0` | 양 채널 공유 초안 수 |
| `high_risk_claims_count`| `INTEGER` | `DEFAULT 0` | 검출된 HIGH 리스크 클레임 수 |
| `claims_downgraded_count`| `INTEGER` | `DEFAULT 0` | 안전 하향(Downgraded)된 클레임 수 |
| `status` | `TEXT` | `NOT NULL` | `COMPLETED`, `PARTIAL`, `FAILED` |
| `run_mode` | `TEXT` | `DEFAULT 'SCHEDULED'` | `SCHEDULED`, `MANUAL`, `DRY_RUN` |
| `no_draft_reason` | `TEXT` | `NULLABLE` | 목표 미달 또는 0건 생성 사유 |

### 3.4 `insights_reader_feedback` Table (Reader Usefulness Feedback)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 피드백 고유 식별자 |
| `article_id` | `UUID` | `REFERENCES insights_articles(id)` | 대상 아티클 ID |
| `channel` | `TEXT` | `DEFAULT 'NETWORK'` | `NETWORK` 또는 `HUB` |
| `feedback` | `TEXT` | `NOT NULL` | 유용성 투표 (`HELPFUL`, `NOT_HELPFUL`) |
| `client_hash` | `TEXT` | `NULLABLE` | HMAC-SHA256 익명 중복 방지 단방향 해시 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 피드백 제출 시각 |

### 3.5 Supporting Tables
- `insights_categories`: `id`, `name`, `description`, `created_at` (카테고리 마스터)
- `insights_authors`: `id`, `name`, `role`, `avatar_url`, `created_at` (저자 프로필)
- `insights_revision_requests`: `id`, `article_id`, `requested_by`, `comment`, `target_section`, `resolution_status` (수정 요청)
- `insights_version_history`: `id`, `article_id`, `version_number`, `changed_by`, `snapshot` (버전 이력)

---

## 4. Field Inventory Audit Summary

- 본 데이터 필드 인벤토리는 `lib/knowledge/ask-engine.ts`, `lib/insights/auto-engine/types.ts` 인터페이스 및 `supabase/migrations/0046_...sql` ~ `0053_...sql` 실제 프로덕션 스키마와 100% 일치함을 확인하였다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL FIELD INVENTORY (R1 REVISED)**
