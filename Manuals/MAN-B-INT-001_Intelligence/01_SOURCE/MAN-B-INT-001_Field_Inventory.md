# MAN-B-INT-001 — Field Inventory
## Intelligence & Insights Domain: UI Components & Database Schema Field Directory

---

## 1. Brand Portal Operational Intelligence Fields (`/portal`)

### 1.1 Brand Onboarding & Product Completeness Bar
| Field Name | UI Label | Data Source | Data Type | Validation / Display Rule |
| :--- | :--- | :--- | :--- | :--- |
| `onboardingStep` | 온보딩 진행 단계 | `brands.onboarding_status` | Enum / String | `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `REJECTED` |
| `completionPercentage` | 상품 등록 완성도 (%) | `evaluateProductRegistrationStatus()` | Number (0-100) | 100% 미만 시 미완성 항목 가이드 툴팁 노출 |
| `missingFields` | 미입력 입력 항목 목록 | Computed Array | String Array | 필수 미입력 항목 (예: HS Code, 원산지, 영문 상품명) 목록 |

### 1.2 Dashboard Summary KPI Cards
| Field Name | UI Label | Data Source | Data Type | Display Format / Formula |
| :--- | :--- | :--- | :--- | :--- |
| `pendingPoCount` | 승인 대기 발주서 | `purchase_orders.po_status` | Integer | `po_status = 'SENT'` 및 승인 대기 건수 |
| `unpaidInvoiceSubtotal` | 정산 예정 미지급액 | `supplier_invoices` | Currency (USD/KRW) | `payment_status != 'PAID'` 인보이스의 `balance_due` 합계 |
| `openInquiryCount` | 미답변 파트너 문의 | `partner_inquiries.status` | Integer | `status IN ('OPEN', 'IN_PROGRESS')` 건수 |
| `activeProductCount` | 판매 활성 상품 수 | `products.status` | Integer | `status = 'ACTIVE'` 상품 건수 |

---

## 2. Brand Portal Grounded AI Ask Assistant Fields (`/portal/help/ask`)

| Field Name | UI Label | Component / Schema Source | Data Type | Validation & Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `userQuery` | 질문 입력창 | `AskKSelectView.tsx` | String | 최소 2자 이상, 최대 500자 제한 |
| `aiResponseText` | 답변 내용 | `lib/knowledge/ask-assistant.ts` | Markdown String | Grounded RAG 서빙 Markdown 렌더링 |
| `sourceCitations` | 참고출처 / 인용 문서 | `knowledge_articles` | Object Array | `id`, `title`, `slug`, `category` 정보 포함 링크 |
| `confidenceScore` | 매칭 신뢰도 지표 | Computed Metric | Float (0.00-1.00) | 내부 벡터/키워드 매칭 유사도 점수 |

---

## 3. Admin Insights System DB Schema Inventory

### 3.1 `insights_articles` Table (V1 Schema)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | 아티클 고유 식별자 |
| `title` | `TEXT` | `NOT NULL` | 아티클 제목 |
| `slug` | `TEXT` | `NOT NULL`, `UNIQUE` | URL 세그먼트 식별자 |
| `summary` | `TEXT` | `NULLABLE` | 요약 설명 / 서문 |
| `content` | `TEXT` | `NOT NULL` | 마크다운/HTML 아티클 본문 |
| `category_id` | `UUID` | `FOREIGN KEY (insights_categories.id)` | 소속 카테고리 |
| `author_id` | `UUID` | `FOREIGN KEY (insights_authors.id)` | 작성 저자 |
| `status` | `TEXT` | `NOT NULL`, `DEFAULT 'DRAFT'` | `DRAFT`, `IN_REVIEW`, `PUBLISHED`, `ARCHIVED` |
| `is_featured` | `BOOLEAN` | `DEFAULT false` | 메인 노출 피처드 여부 |
| `view_count` | `INTEGER` | `DEFAULT 0` | 누적 조회수 |
| `reading_time_minutes` | `INTEGER` | `DEFAULT 3` | 예상 읽기 시간(분) |
| `published_at` | `TIMESTAMPTZ` | `NULLABLE` | 최초 게시 일시 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 생성 일시 |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 레코드 수정 일시 |

### 3.2 `insights_auto_rules` Table (V2 Auto Engine)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 자동화 규칙 식별자 |
| `rule_name` | `TEXT` | `NOT NULL` | 규칙명 |
| `keywords` | `TEXT[]` | `NOT NULL` | 추적 검색 키워드 배열 |
| `target_category_id` | `UUID` | `FOREIGN KEY (insights_categories.id)` | 생성 결과물 배정 카테고리 |
| `is_active` | `BOOLEAN` | `DEFAULT true` | 활성화 여부 |
| `cron_schedule` | `TEXT` | `DEFAULT '0 9 * * *'` | 실행 크론 주기 |

### 3.3 `insights_auto_runs` Table (V2 Auto Engine Logs)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 오토 엔진 실행 로그 식별자 |
| `rule_id` | `UUID` | `FOREIGN KEY (insights_auto_rules.id)` | 트리거된 규칙 ID |
| `run_status` | `TEXT` | `NOT NULL` | `SUCCESS`, `PARTIAL_SUCCESS`, `FAILED` |
| `articles_generated` | `INTEGER` | `DEFAULT 0` | 생성된 아티클 수 |
| `run_log` | `JSONB` | `NULLABLE` | 수집 및 생성 세부 이력 데이터 |
| `executed_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 실행 시각 |

### 3.4 `insights_claims_audit` Table (V2.1 Risk Audit Engine)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 감사 기록 식별자 |
| `article_id` | `UUID` | `FOREIGN KEY (insights_articles.id)` | 대상 아티클 ID |
| `claim_text` | `TEXT` | `NOT NULL` | 검증 대상 주장 문장 |
| `claim_status` | `TEXT` | `NOT NULL` | `VERIFIED`, `INFERRED`, `ESTIMATE`, `SIGNAL`, `INTERNAL`, `UNSUPPORTED` |
| `risk_level` | `TEXT` | `NOT NULL` | `HIGH`, `MEDIUM`, `LOW` |
| `auditor_action` | `TEXT` | `NOT NULL` | `PASS`, `DOWNGRADE`, `REWRITE`, `REMOVE`, `FAIL` |
| `evidence_excerpt` | `TEXT` | `NULLABLE` | 인용 근거 발췌문 |

### 3.5 `insights_article_feedback` Table (V3 Reader Feedback)
| Column Name | DB Data Type | Constraints / Nullable | Business Meaning & Rules |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY` | 피드백 식별자 |
| `article_id` | `UUID` | `FOREIGN KEY (insights_articles.id)` | 아티클 ID |
| `is_helpful` | `BOOLEAN` | `NOT NULL` | 도움이 되었는지 여부 (Thumb up / down) |
| `feedback_text` | `TEXT` | `NULLABLE` | 의견 서술 |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT now()` | 작성 시각 |

---

## 4. Field Inventory Audit Summary

- 본 데이터 필드 인벤토리는 `supabase/migrations/0046_...sql` ~ `0053_...sql` 스키마 및 `lib/insights/auto-engine/types.ts` 인터페이스 규격과 100% 일치함을 확인하였다.
- 작성 완료일: 2026-10-02
- 상태: **VERIFIED CANONICAL FIELD INVENTORY**
