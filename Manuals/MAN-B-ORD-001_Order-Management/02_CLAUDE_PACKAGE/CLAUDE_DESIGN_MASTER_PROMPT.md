# Claude Design Master Prompt: MAN-B-ORD-001

## 1. Project Role & Objective

You are the Lead Visual Designer for **K SELECT NETWORK**.
Your task is to design and generate the official PDF User Manual for **Brand Portal Purchase Orders & Order Management (`MAN-B-ORD-001`)**.

---

## 2. Master Visual Standard: `MAN-BRAND-001 Brand Policy.pdf`

> [!IMPORTANT]
> **STRICT DESIGN MASTER REFERENCE**:
> You MUST strictly emulate the exact visual design language, grid layout, header/footer structure, typography scales, badge color tokens, and table styles established in **`MAN-BRAND-001 Brand Policy.pdf`**.
> Do NOT create alternative design systems, foreign palettes, or modify brand colors.

### Key Design Tokens
- **Primary Color**: Zinc 950 (`#09090b`) / Deep Navy Dark Neutral (`#0f172a`)
- **Accent & Status Colors**:
  - **Success / Confirmed / Approved**: Emerald 600 (`#059669`) / Green 500 (`#22c55e`)
  - **Pending / Action Required / Review**: Amber 500 (`#f59e0b`) / Blue 500 (`#3b82f6`)
  - **Rejection / Cancelled**: Rose 500 (`#f43f5e`) / Red 500 (`#ef4444`)
  - **Neutral / Draft / Archived**: Zinc 500 (`#71717a`)
- **Backgrounds**: Pure White (`#ffffff`) with subtle card fills in Zinc 50 (`#fafafa`) and borders in Zinc 200 (`#e4e4e7`)
- **Typography**:
  - Document Title: 20pt Bold / Sans-serif (Pretendard / Inter / Apple SD Gothic Neo)
  - Section Header (H1): 14pt Bold
  - Subheader (H2): 11pt Bold
  - Body Text: 9pt Regular (Line height: 1.5)
  - Code / Identifier / Monospace: 8pt JetBrains Mono / SF Mono
- **Page Dimensions**: Standard A4 Portrait (210mm × 297mm), Margins: Top 20mm, Bottom 20mm, Left 18mm, Right 18mm.

---

## 3. Package Asset Map & File Hierarchy

All source assets are available in `02_CLAUDE_PACKAGE/`:

1. **Content**: `01_CONTENT/MAN-B-ORD-001_Manual_Content.md` (Authoritative text, field descriptions, business logic, callouts, and FAQ).
2. **Screenshots**: `02_SCREENSHOTS/` (15 Production PNG captures + `SCREENSHOT_ANNOTATION_GUIDE.md`).
3. **Diagrams**: `03_DIAGRAMS/ORDER_ARCHITECTURE_DIAGRAMS.md` (Dual-Track PO Architecture, State Machines, and Step-by-Step Flowcharts).
4. **Reference**: `04_REFERENCE/REFERENCE_GUIDE.md` (Status definitions, RBAC matrix, and technical data rules).

---

## 4. Document Structure Blueprint (Target: 7 Pages)

- **Header / Meta**: Title: `브랜드 포털 발주 요청 & 오더 관리 가이드`, Manual ID: `MAN-B-ORD-001`, Version: `v1.0`, Audience: `Brand Portal User`.
- **Page 1: 1. 개요 및 오더 아키텍처 (Order Architecture & Overview)**
  - K SELECT 오더 관리 체계 소개
  - **Dual-Track PO Architecture**: Track A (Brand PO Request) vs Track B (Admin Direct PO)
  - **핵심 분리 원칙**: `Retail Application Approval ≠ Automatic Purchase Order Creation`
  - 6단계 통합 라이프사이클 요약 다이어그램
- **Page 2: 2. 발주 요청(PO Request) 생성 및 관리 (`/portal/orders/requests`)**
  - 발주 요청 목록 대시보드 (`SCR-B-ORD-001.png`)
  - 신규 발주 요청 작성 폼: 출고지, 담당자, 희망 출고일 (`SCR-B-ORD-002.png`)
  - 품목 검색 및 FOB 티어 가격 연동 (`SCR-B-ORD-003.png`)
  - MOQ 가이드라인 및 최종 제출 절차 (`SCR-B-ORD-004.png`)
- **Page 3: 3. 발주 요청 심사 및 PO 전환 모니터링**
  - 본사 MD 심사 상태 및 수정 요청 대응 (`SCR-B-ORD-005.png`)
  - 공식 발주서(PO)로의 전환 및 연결 확인 (`SCR-B-ORD-006.png`)
  - 발주 요청 $\rightarrow$ 공식 발주서 전환 라이프사이클 매핑 테이블
- **Page 4: 4. 공식 발주서(Purchase Order) 검토 및 공급사 수락 (`/portal/orders/purchase-orders`)**
  - 공식 발주서 목록 대시보드 (`SCR-B-ORD-007.png`)
  - 발주서 상세 Overview 및 6단계 진행 바 (`SCR-B-ORD-008.png`)
  - 공급사 발주 수락(Confirm PO) 및 조건 변경 요청(Request Change) 절차
  - 품목별 수량 대조(Variance) 테이블 확인 (`SCR-B-ORD-009.png`)
- **Page 5: 5. 출고 준비 등록(Goods Ready) 및 선적 책임별 물류 처리**
  - 출고 준비 등록(Goods Ready) 진입 및 모달 (`SCR-B-ORD-010.png`, `SCR-B-ORD-011.png`)
  - 카톤 수량, 총중량, CBM 입력 및 패킹리스트/상업송장 첨부
  - **선적 책임 분기**:
    - `LETUSTO_ARRANGED`: 본사 포워더 화물 인계 보고(Submit Handover)
    - `SUPPLIER_ARRANGED`: B/L, 추적번호, ETD/ETA 등록 (`SCR-B-ORD-012.png`)
- **Page 6: 6. 입고 검수(Receiving & Inspection) 및 문서 보관함**
  - 미국 물류센터 실물 입고 검수 결과 확인 (`SCR-B-ORD-013.png`)
  - 정상 입고(Accepted), 파손(Damaged), 불일치(Variance) 확인
  - 발주 관련 무역/통관 서류 통합 보관함 (`SCR-B-ORD-014.png`)
  - Finance(공급사 인보이스) 연계 조건 및 Handoff 기준 (`supplier_confirmation_status = 'CONFIRMED'`)
- **Page 7: 7. 글로벌 선적 허브 & 자주 묻는 질문 (FAQ)**
  - 통합 출고 & 선적 관리 허브 (`SCR-B-ORD-015.png`)
  - 자주 묻는 질문 (FAQ 8선)
  - 지원 채널 및 1:1 문의(Inquiry) 안내

---

## 5. Visual Execution Quality Checklist

- [ ] All 15 production screenshots placed with crisp 1:1 or 2:1 aspect ratio.
- [ ] Numbered badge callouts (①, ②, ③, etc.) mapped directly according to `SCREENSHOT_ANNOTATION_GUIDE.md`.
- [ ] Status badges match official production styling and hex codes.
- [ ] Header and Footer contain `K SELECT NETWORK` | `MAN-B-ORD-001` | `Page X of Y`.
- [ ] Final output delivered in high-res PDF to `Manuals/MAN-B-ORD-001_Order-Management/03_PUBLISHED/MAN-B-ORD-001_Order_Management_Guide.pdf`.
