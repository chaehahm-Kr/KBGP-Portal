# Claude Design Master Prompt: MAN-B-RET-001

## 1. Project Role & Objective

You are the Lead Visual Designer for **K SELECT NETWORK**.
Your task is to design and generate the official PDF User Manual for **Brand Portal Retail Placement & Application Guide (`MAN-B-RET-001`)**.

---

## 2. Master Visual Standard: `MAN-BRAND-001 Brand Policy.pdf`

> [!IMPORTANT]
> **STRICT DESIGN MASTER REFERENCE**:
> You MUST strictly emulate the exact visual design language, grid layout, header/footer structure, typography scales, badge color tokens, and table styles established in **`MAN-BRAND-001 Brand Policy.pdf`**.
> Do NOT create alternative design systems or modify brand colors.

### Key Design Tokens
- **Primary Color**: Zinc 950 (`#09090b`) / Deep Navy Dark Neutral
- **Accent Color**: Emerald 600 (`#059669`) for approvals/success, Amber 500 (`#f59e0b`) for pending/info requests, Rose 500 (`#f43f5e`) for rejections
- **Backgrounds**: Pure White (`#ffffff`) with subtle card fills in Zinc 50 (`#fafafa`) and borders in Zinc 200 (`#e4e4e7`)
- **Typography**:
  - Title: 20pt Bold / Sans-serif (Pretendard / Inter / Apple SD Gothic Neo)
  - Section Header (H1): 14pt Bold
  - Subheader (H2): 11pt Bold
  - Body Text: 9pt Regular (Line height: 1.5)
  - Code / Identifier / Monospace: 8pt JetBrains Mono / SF Mono
- **Page Dimensions**: Standard A4 Portrait (210mm × 297mm), Margins: Top 20mm, Bottom 20mm, Left 18mm, Right 18mm.

---

## 3. Package File Map & Hierarchy

You will find all necessary assets within `02_CLAUDE_PACKAGE/`:

1. **Content**: `01_CONTENT/MAN-B-RET-001_Manual_Content.md` (Authoritative text, section headers, tables, callout notes, and FAQ).
2. **Screenshots**: `02_SCREENSHOTS/` (9 Production PNG captures + `SCREENSHOT_ANNOTATION_GUIDE.md`).
3. **Diagrams**: `03_DIAGRAMS/RETAIL_APPLICATION_WORKFLOW_DIAGRAMS.md` (Process flowcharts & sequence diagrams).
4. **Reference**: `04_REFERENCE/REFERENCE_GUIDE.md` (Status definitions, RBAC matrix, and technical data rules).

---

## 4. Document Structure (Target: 6–8 Pages)

- **Cover & Header**: Manual Title, Manual ID `MAN-B-RET-001`, Version `v1.0`, Canonical Category `입점 & 리테일 네트워크 (topic-retail)`.
- **Page 1: 1. 개요 및 파트너십 프로세스**
  - K SELECT Retail Network 입점 신청 개요
  - 사전 필수 준비 사항 (브랜드 등록 & 상품 카탈로그 등록 완료)
  - 전체 라이프사이클 요약 다이어그램
- **Page 2: 2. 신청 현황 대시보드 (`/portal/applications`)**
  - 신청 목록 테이블 구조 및 컬러 뱃지 체계
  - 권한별 기능 (`application:read` vs `application:write`)
  - Screenshot `SCR-B-RET-001.png` + 모바일 뷰 `SCR-B-RET-009.png`
- **Page 3: 3. 신규 입점 신청서 작성 (Draft Workspace)**
  - 신규 드래프트 생성 및 다중 브랜드 제품 선택 (`SCR-B-RET-002.png`)
  - 6대 프로그램 참여 준비 사항 (Readiness Criteria) 평가 (`SCR-B-RET-003.png`)
  - 임시저장 및 제출 유효성 검증 규칙 (`SCR-B-RET-004.png`)
- **Page 4: 4. 실시간 심사 현황 및 타임라인 모니터링**
  - 신청서 상세 헤더 및 심사 상태 (`SCR-B-RET-005.png`)
  - 제품별 개별 심사 상태 및 실시간 감사 타임라인 (`SCR-B-RET-007.png`)
  - 자동 상태 집계 엔진 (`computeAggregatedStatus`) 동작 원리
- **Page 5: 5. 추가 자료 요청(Info Request) 대응 및 문서 제출**
  - 긴급 알림 패널 및 회신 기한 안내 (`SCR-B-RET-006.png`)
  - 회신 내용 작성 및 증빙 서류 파일 업로드 (PDF, 이미지, 엑셀)
  - 상태 자동 전환(`re_review`) 및 MD 재심사 루프
- **Page 6: 6. 사이드바 평가 요약 & 결과 후속 절차**
  - 참여 조건 자가진단 및 준비사항 요약 카드 (`SCR-B-RET-008.png`)
  - 최종 승인 / 부분 승인 / 보류 / 반려별 후속 조치
  - 자주 묻는 질문 (FAQ 7선)

---

## 5. Visual Execution Quality Checklist

- [ ] All 9 screenshots from `02_SCREENSHOTS/` embedded with crisp 1:1 or 2:1 aspect ratio.
- [ ] Numbered badge callouts placed accurately as specified in `SCREENSHOT_ANNOTATION_GUIDE.md`.
- [ ] Status badges match production hex colors (`#10b981`, `#f59e0b`, `#3b82f6`, `#f43f5e`, `#71717a`).
- [ ] Header and Footer contain `K SELECT NETWORK` | `MAN-B-RET-001` | `Page X of Y`.
- [ ] Final output delivered to `Manuals/MAN-B-RET-001_Retail-Applications/03_PUBLISHED/MAN-B-RET-001_Retail_Placement_Guide.pdf`.
