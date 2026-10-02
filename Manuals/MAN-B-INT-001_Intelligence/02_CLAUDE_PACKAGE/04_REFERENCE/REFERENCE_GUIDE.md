# MAN-B-INT-001 — Reference Guide
## Source Tiers, Claim Risk Rules, Quota Weights & Database Schema Reference

---

## 1. Source Tier Classification Standards

| Source Tier | Authority Level | Representative Sources | Mandatory Usage / Validation Rule |
| :--- | :--- | :--- | :--- |
| `TIER_A` | **공식 정부 및 국제 통계기관** | U.S. FDA, USITC, 관세청, 국세청, 특허청(USPTO/KIPO) | HIGH RISK 규제 준수, 통관 요건, 수치(%, $) 클레임의 필수 검증 근거 |
| `TIER_B` | **공인 언론 및 뷰티 전문 매체** | Beauty Supply Institute, WWD, Cosmeceuticals Trade Reports | MEDIUM RISK 시장 트렌드, 카테고리 진열 확장 근거 |
| `TIER_C` | **일반 블로그 및 업계 커뮤니티** | Reddit Beauty, 인플루언서 리뷰 포럼, 브랜드 자사 블로그 | 단독으로 HIGH/MED 클레임의 근거가 될 수 없으며, 시그널 탐색용으로만 활용 |
| `SIGNAL` | **시장 탐지 및 검색 모멘텀** | Google Search Trends, TikTok Shop US Analytics, 오프라인 매장 설문 | 주장의 상태가 `SIGNAL`로 강제 분류되며 완화된 표현("신호 감지")으로 서술 |

---

## 2. Claim Risk Level & Auditor Action Matrix

| Claim Risk Level | Claim Subject & Tone | Required Source Tier | Auditor Action | Example Phrasing Adjustment |
| :--- | :--- | :--- | :--- | :--- |
| **HIGH** | FDA/MoCRA 규제, 필수 의무, 정량적 수치(%, $), 인과 보장 | `TIER_A` or `TIER_B` | `PASS` (출처 확보 시) / `DOWNGRADE` (미흡 시) | "단속 개시" ➔ "컴플라이언스 점검 가이드" |
| **MEDIUM** | 시장 트렌드, 검색 급상승, 소비자 선호도 변화 | `TIER_B` or `SIGNAL` | `PASS` / `DOWNGRADE` | "수요 폭증" ➔ "검색 시그널 관심 증가" |
| **LOW** | K SELECT 플랫폼 가이드, 실무 체크리스트, 매장 진열 조언 | 내부 운영 기준 | `PASS` (`INTERNAL`) | "K SELECT 권장 체크리스트" |

---

## 3. Topic Scoring Weights & 5 Critical Conditions

### 3.1 6대 평가 가중치 (Max 100 Points)
- **Audience Relevance (25점)**: 타겟 청중(Brand/Retailer)의 비즈니스 직결성
- **Actionability & Impact (25점)**: 실무 조치 가능성 및 실행 명확성
- **Evidence Strength (20점)**: 뒷받침하는 소스 티어 및 실증 데이터 강도
- **Timeliness & Urgency (15점)**: 시장 변화의 시의성 및 즉시성
- **Originality & Depth (10점)**: 단순 뉴스 복제가 아닌 심층 분석 가치
- **Strategic Fit (5점)**: K SELECT 생태계 방향성 부합도
- **Quality Threshold**: 총점 **80점 이상** 획득 시에만 채택 (미달 시 탈락)

### 3.2 5대 필수 조건 (Critical Conditions)
1. **Evidence Quality**: 최소 1개 이상의 유효한 HTTP 소스 URL 확보 (`PASS` / `FAIL`)
2. **Claim Validation**: 허위 규제 과장(False FDA Approval) 및 가짜 인과관계 없음 (`PASS` / `FAIL`)
3. **Duplicate Check**: 최근 30일 내 동일 주제 중복 발행 이력 없음 (`PASS` / `FAIL`)
4. **Audience Relevance**: Network 또는 Hub 청중 적합도 70점 이상 (`PASS` / `FAIL`)
5. **Actionability**: 브랜드/바이어를 위한 구체적 실행 방안 포함 (`PASS` / `FAIL`)

---

## 4. Multi-Channel Quota & Distribution Reference

| Publish Channel | Target Audience | Primary Focus Areas | Daily Target Quota |
| :--- | :--- | :--- | :--- |
| **`NETWORK`** | 한국 화장품 브랜드사 (Brand Portal) | MoCRA 규제 준수, FOB 가격 전략, 물류 규격, 패키징 | 최대 3건 / 일 |
| **`HUB`** | 미국 독립 리테일러/스토어 (Retail Hub) | 매장 마진 구조, 4FT 진열대 배치, POS 안내문, 카운터 전환 | 최대 3건 / 일 |
| **`SHARED CORE`** | 양 채널 동시 유효 주제 | 양측 모두에게 필수적인 규제/트렌드 (동일 품질 기준) | 중복 패널티 없이 양 채널 배정 |

*(참고: 합격 기준 >= 80점을 통과하는 주제가 없는 경우 당일 0건 생성이 정상 처리됨)*

---

## 5. Database Schema & Status Enums Mapping

### 5.1 `insights_articles` Table Schema
- Primary Key: `id (UUID)`
- Title & Slugs: `title_ko (TEXT)`, `title_en (TEXT)`, `slug (TEXT, UNIQUE)`
- Content Blocks: `body_blocks_ko (JSONB)`, `body_blocks_en (JSONB)`
- Research & Claims: `claims (JSONB)`, `claim_risk_summary (JSONB)`, `content_layers (JSONB)`, `research_brief (JSONB)`
- Audience & Status: `status (AI_DRAFT | DRAFT | REVIEW | PUBLISHED | ARCHIVED)`, `publish_channels (TEXT[])`

### 5.2 Supporting Tables
- `insights_categories`: 4대 카테고리 (`U.S. MARKET ENTRY`, `RETAIL TRENDS`, `CONSUMER INSIGHTS`, `COMPLIANCE & LEGAL`)
- `insights_authors`: 공식 데스크 저자 프로필 (`Compliance Desk`, `Market Intelligence Desk`)
- `insights_editorial_rules`: 마스터 에디토리얼 룰 및 가중치 설정 (`minimum_topic_score = 80`, `network_daily_draft_max = 3`, `hub_daily_draft_max = 3`)
- `insights_automation_runs`: 오토 엔진 실행 로그 (`sources_scanned`, `candidates_gte_80`, `network_drafts`, `hub_drafts`)
- `insights_reader_feedback`: HMAC-SHA256 익명 중복 방지 피드백 (`HELPFUL`, `NOT_HELPFUL`)
- `insights_revision_requests`: 에디터 간 수정 요청 (`OPEN`, `RESOLVED`)
- `insights_version_history`: 아티클 스냅샷 버전 변경 이력

---

## 6. System Gaps & Non-Implemented Boundaries Reference

| Feature Area | Production Reality | Status Classification |
| :--- | :--- | :--- |
| **수요/매출 머신러닝 예측 (Predictive Demand ML)** | 과거/현재 누적 데이터 결정론적 집계만 지원 | `SYSTEM GAP / NOT IMPLEMENTED` |
| **실시간 다이내믹 프라이싱 (Dynamic Pricing AI)** | 알고리즘 기반 자동 가격 변동 없음 | `SYSTEM GAP / NOT IMPLEMENTED` |
| **자동 재고 배치 알고리즘 (Automatic Stock Allocation)** | 물류 센터 간 자동 재고 배분 알고리즘 없음 | `SYSTEM GAP / NOT IMPLEMENTED` |
| **전자동 외부 발행 (Fully Autonomous Publishing)** | 에디터 수동 승인 필수 (`status = 'AI_DRAFT'`) | `NOT IMPLEMENTED / STRICTLY BLOCKED` |
| **피드백 기반 AI 자동 재학습 (Automated Feedback Retraining)**| 수집된 피드백은 에디터 통계로만 활용 | `NOT IMPLEMENTED` |

---
*End of REFERENCE_GUIDE.md*
