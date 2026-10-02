# MAN-B-LOG-001: Claude Design Package
## K SELECT Brand Portal Shipping & Logistics Manual (선적 & 출고 관리 가이드)

- **Manual ID:** `MAN-B-LOG-001`
- **Manual Title:** K SELECT Brand Portal Shipping & International Logistics Guide (출고 준비, 선적 및 물류 추적 가이드)
- **Target Audience:** `B — Brand Portal (브랜드사 / 공급사 물류 및 출고 담당자)`
- **Topic Code:** `topic-logistics`
- **Version:** `1.0.0`
- **Authoritative Date:** 2026-10-01
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Package Overview & Purpose

본 패키지는 **K SELECT Brand Portal**을 이용하는 브랜드사 및 공급사 담당자를 위한 공식 **선적 & 출고 관리(Shipping & Logistics)** 매뉴얼의 Claude Design 제작 패키지입니다.

`01_SOURCE`의 철저한 프로덕션 코드/DB 감사 결과를 바탕으로 작성되었으며, **공식 발주 확정(PO Confirmation) 이후 상품 출고 준비(Goods Readiness), 실측 카고 규격 및 서류(P/L, C/I) 등록, 운송 책임별 분기(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED), 국제 선적 추적(Inbound Shipments), 그리고 미국 창고 입고(Warehouse Receiving) 인계**까지의 전 과정을 시각적이고 직관적인 가이드북으로 제작합니다.

---

## 2. Directory Structure

```text
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                         # 본 문서 (패키지 전체 안내서)
├── CLAUDE_DESIGN_MASTER_PROMPT.md            # Claude Design 전용 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md           # 실행용 원클릭 핸드오프 프롬프트
├── MAN-B-LOG-001_Design_Structure.md         # 매뉴얼 페이지별 디자인 레이아웃 구조서
├── 01_CONTENT/
│   └── MAN-B-LOG-001_Manual_Content.md       # 공식 매뉴얼 본문 텍스트 (Full Markdown)
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md        # 11개 스크린샷 캡션 및 콜아웃 주석 가이드
│   ├── SCR-B-LOG-001.png                     # 출고 준비 등록 내역 탭
│   ├── SCR-B-LOG-002.png                     # 선적 추적 내역 탭
│   ├── SCR-B-LOG-003.png                     # 출고 준비 등록 - 기본 정보 입력
│   ├── SCR-B-LOG-004.png                     # 출고 준비 등록 - 품목 스펙 및 서류 첨부
│   ├── SCR-B-LOG-005.png                     # 출고 상세 - LETUSTO 지정 운송 인계 패널
│   ├── SCR-B-LOG-006.png                     # 출고 상세 - SUPPLIER 자체 운송 선적 등록
│   ├── SCR-B-LOG-007.png                     # 출고 상세 - 물품 인계 완료 상태
│   ├── SCR-B-LOG-008.png                     # 출고 준비 수량 초과 경고 (Overage Alert)
│   ├── SCR-B-LOG-009.png                     # 조회자(Viewer) 역할 읽기 전용 제한
│   ├── SCR-B-LOG-010.png                     # 관리자 인바운드 선적 상세 (참고용)
│   └── SCR-B-LOG-011.png                     # 관리자 창고 입고 검수 화면 (참고용)
├── 03_DIAGRAMS/
│   └── LOGISTICS_ARCHITECTURE_DIAGRAMS.md    # 7개 Mermaid 다이어그램 및 시각화 명세
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                    # 용어집, FAQ, 상태 전이도 및 핵심 비즈니스 룰
```

---

## 3. Strict Domain Boundaries & Terminology Rules

1. **ORD ↔ LOG Handoff**:
   - 발주서(PO)의 `po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'` 조건이 충족될 때 출고 준비 등록이 가능합니다.
2. **LOG ↔ FIN Parallel Architecture**:
   - 공식 확정된 PO를 기반으로 물류(`MAN-B-LOG-001`)와 재무(`MAN-B-FIN-001`)는 상호 독립적인 병렬 도메인으로 작동합니다. 물류 프로세스가 재무의 필수 선행 단계로 강제되지 않습니다.
3. **LOG ↔ Warehouse Receiving Boundary**:
   - 물류 도메인은 화물이 미국 목적지 창고에 도착(`ARRIVED`/`DELIVERED`)하여 실물을 인도할 때 종료되며, 이후의 물리적 바코드 스캔, 피스 카운팅, 파손/보류 격리는 **창고 입고 도메인(Warehouse Receiving)**으로 Handoff 됩니다.
4. **Disambiguation Rules**:
   - `ARRIVED ≠ RECEIVED` (ARRIVED: 화물 도착, RECEIVED: 실물 검수 완료)
   - `RECEIVED ≠ COMPLETED`
   - `COMPLETED ≠ PAID`
   - `Shipping Complete ≠ Settlement Complete`

---

## 4. Master Design Reference System

- **Reference Document:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Key Design Tenets:**
  - 12-Column Grid System with generous white space.
  - Typographic Hierarchy: Clear Sans-Serif font (Inter / Pretendard), High Contrast.
  - Accent Color Palette: Dark Charcoal/Black (`#09090b`), Slate Gray (`#64748b`), Royal Blue (`#2563eb`), Emerald Green (`#059669`), Amber Warning (`#d97706`), Rose Alert (`#e11d48`).
  - Seamless Manual Series Consistency: Cover design, header bands, callout cards, step-by-step numbered badges, diagram cards, footer page numbering.
