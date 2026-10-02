# MAN-B-INT-001 CLAUDE DESIGN PACKAGE
## Intelligence & Insights Guide (인텔리전스, 지능형 정책 도우미 및 시장 분석 가이드)

- **Manual ID:** `MAN-B-INT-001`
- **Topic:** `Intelligence & Insights (지능형 정책 도우미, 시장 리서치 자동화, 클레임 리스크 감사 및 인사이트 에디토리얼 시스템)`
- **Audience:** `B — Brand Portal Users & Operations (브랜드사 관리자, 실무 담당자 및 플랫폼 운영자)`
- **Authoritative Date:** 2026-10-02
- **Source Basis:** Approved Source Review `MAN-B-INT-001-SRC-001-R1`
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Package Overview & Structure

본 디렉토리는 K SELECT 시스템의 **Intelligence & Insights (지능형 정책 도우미 및 시장 리서치/인사이트 오토 엔진)** 공식 매뉴얼 제작을 위한 공식 **Claude Design Package**입니다.

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                                 # 본 패키지 개요 및 규격 문서
├── CLAUDE_DESIGN_MASTER_PROMPT.md                   # Claude PDF 생성 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                  # 최종 핸드오프 및 검증 요약
├── MAN-B-INT-001_Design_Structure.md               # 12열 그리드 및 타이포그래피 레이아웃 가이드
├── 01_CONTENT/
│   └── MAN-B-INT-001_Manual_Content.md             # 7개 챕터로 구성된 공식 매뉴얼 본문
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md               # 11개 스크린샷 핀 콜아웃 가이드
│   ├── SCR-B-INT-001.png                           # Grounded Knowledge Assistant 메인 검색 화면
│   ├── SCR-B-INT-002.png                           # 정책 질문 검색 결과 & 공식 인용 출처 카드
│   ├── SCR-B-INT-003.png                           # 어드민 인사이트 시스템 오버뷰 대시보드
│   ├── SCR-B-INT-004.png                           # 오토 엔진 생성 아티클 검토 및 승인/반려 큐
│   ├── SCR-B-INT-005.png                           # 클레임 리스크 감사 패널 & 팩트체크 요약 화면
│   ├── SCR-B-INT-006.png                           # 인사이트 전체 아티클 라이브러리 목록
│   ├── SCR-B-INT-007.png                           # 인사이트 아티클 편집기 상세 화면
│   ├── SCR-B-INT-008.png                           # 오토 엔진 실행 이력 및 3+3 쿼터 생성 로그
│   ├── SCR-B-INT-009.png                           # 마스터 에디토리얼 룰 및 가중치 설정 화면
│   ├── SCR-B-INT-010.png                           # 인사이트 카테고리 계층 및 저자 프로필 설정
│   └── SCR-B-INT-011.png                           # 아티클 하단 독자 유용성 피드백 집계 패널
├── 03_DIAGRAMS/
│   └── INTELLIGENCE_ARCHITECTURE_DIAGRAMS.md        # 7대 프로덕션 아키텍처 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                           # 클레임 리스크, 소스 티어, 가중치 퀵 레퍼런스
```

---

## 2. Core Architecture Rules & Boundaries

1. **포털 대시보드 도메인 분리 (Portal Dashboard ≠ Intelligence)**:
   - 포털 대시보드(`/portal`)의 KPI 카드, 온보딩 체크리스트, 미지급 정산액 등은 순수 운영 및 실적 집계 데이터(`RPT` / `ONB` 도메인)이며, 인텔리전스 영역에 포함되지 않습니다.

2. **결정론적 지능형 정책 도우미 (Deterministic Knowledge Assistant)**:
   - `/portal/help/ask`는 외부 LLM 런타임 생성이나 벡터 RAG가 아니며, 서버 사이드에서 `is_published = true`인 지식 문서(`knowledge_articles`)를 대상으로 결정론적 토큰/태그/도메인 인텐트 매칭을 수행하고 공식 출처(`sources`)를 제공합니다.
   - 근거 문서가 미흡하거나 매칭 점수가 미달하는 경우 임의 추론 없이 No Fabrication 원칙에 따라 1:1 고객지원 링크를 안내합니다.

3. **오토 엔진 생성과 인간 검토 게이트 (Auto-Engine Generation ≠ Automatic Publishing)**:
   - 오토 엔진(`lib/insights/auto-engine/*`)이 생성한 모든 결과물은 `AI_DRAFT` 상태로 저장되며, 에디터의 명시적 검토 및 승인 없이는 외부 게시되지 않습니다 (`auto_publish = false`, `human_approval_required = true`).

4. **클레임 리스크 감사 & 안전 하향 (Claim Risk Audit & Safe Downgrades)**:
   - 아티클 내 주장(Claim)은 `HIGH`, `MEDIUM`, `LOW` 리스크로 분류되며, 1급 출처(`TIER_A`/`TIER_B`)가 없는 고위험 주장은 `SIGNAL`로 자동 안전 하향(Downgrade)되고 완화된 어조("신호가 감지됨")로 재작성됩니다.
   - `insights_claims_audit`는 독립 물리 테이블이 아니며, `insights_articles` 내 JSONB 컬럼(`claims`, `claim_risk_summary`)에 내장 관리됩니다.

5. **독자 유용성 피드백 & 모니터링 (Reader Feedback ≠ Automated Model Retraining)**:
   - `insights_reader_feedback`은 HMAC-SHA256 해시를 통한 24시간 중복 방지 기반 익명 투표(`HELPFUL` / `NOT_HELPFUL`)를 수집하며, 에디터의 분석 지표로만 활용되고 AI 모델을 자동 재학습하지 않습니다.

6. **다채널 퍼블리싱 & 3+3 쿼터 규칙 (Network ↔ Hub Boundary)**:
   - **K SELECT Network (`NETWORK`)**: 한국 브랜드사 대상 (수출 규제, FOB 가격, 물류/패키징).
   - **K SELECT Hub (`HUB`)**: 미국 독립 리테일러 대상 (매장 마진, 진열대 배치, POS 안내문).
   - **3+3 Target Quota**: 일일 목표 생성량은 Network 최대 3건, Hub 최대 3건이며, 양측 모두에 유용한 고품질 주제는 Shared Core로 배정됩니다. 합격 주제가 없는 경우 0건 생성이 정상 처리됩니다.

7. **시스템 갭 명시 (Zero Unsupported Absolute Claims)**:
   - 예측형 수요/매출 ML, 자동 다이내믹 프라이싱, 자동 재고 배분 알고리즘, 완전 자율 게시 등 미구현 기능은 활성 기능으로 서술하지 않습니다.

---
*End of PACKAGE_README.md*
