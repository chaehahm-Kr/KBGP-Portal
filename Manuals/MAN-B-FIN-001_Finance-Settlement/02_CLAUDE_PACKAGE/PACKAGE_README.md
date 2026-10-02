# MAN-B-FIN-001 — Claude Design Package Readme
## K SELECT Brand Portal: Finance & Settlement Guide (정산 관리 & 인보이스 매뉴얼 패키지)

---

## 1. Package Overview

본 패키지(`02_CLAUDE_PACKAGE/`)는 **K SELECT Brand Portal**의 Finance & Settlement 모듈(**MAN-B-FIN-001**)에 대한 Claude Design 기반 고품질 웹/PDF 매뉴얼 제작을 위해 구축된 최신 디자인 패키지이다.

- **Task ID**: `MAN-B-FIN-001-PKG-001`
- **Source Review Basis**: `MAN-B-FIN-001-SRC-001-R1` (Commit: `2785c341077363cad06c87c6e8afa22623e95208`)
- **Master Design System Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 2. Directory & Asset Structure

```text
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                       # 패키지 구성 및 빌드 가이드 (본 파일)
├── CLAUDE_DESIGN_MASTER_PROMPT.md          # Claude Design 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md         # 디자인 전달 및 퍼블리싱 프롬프트
├── MAN-B-FIN-001_Design_Structure.md       # 매뉴얼 디자인 레이아웃 & 챕터 구조 명세
├── 01_CONTENT/
│   └── MAN-B-FIN-001_Manual_Content.md     # 매뉴얼 본문 원고 (Korean-First)
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md      # 스크린샷 13종 주석 및 콜아웃 가이드
│   ├── SCR-B-FIN-001.png                   # 1. Finance Hub Invoices Tab
│   ├── SCR-B-FIN-002.png                   # 2. New Invoice PO Selection
│   ├── SCR-B-FIN-003.png                   # 3. New Invoice Line & Adjustment Form
│   ├── SCR-B-FIN-004.png                   # 4. Invoice Detail (DRAFT State)
│   ├── SCR-B-FIN-005.png                   # 5. Invoice Edit (DRAFT State)
│   ├── SCR-B-FIN-006.png                   # 6. Invoice Detail (SUBMITTED State)
│   ├── SCR-B-FIN-007.png                   # 7. Invoice Detail (APPROVED & PAID State)
│   ├── SCR-B-FIN-008.png                   # 8. Invoice Detail (REJECTED State)
│   ├── SCR-B-FIN-009.png                   # 9. Finance Hub Settlements Tab
│   ├── SCR-B-FIN-010.png                   # 10. Finance Hub Payments Tab
│   ├── SCR-B-FIN-011.png                   # 11. Admin Invoices List (Reference)
│   ├── SCR-B-FIN-012.png                   # 12. Admin Invoice Approval (Reference)
│   └── SCR-B-FIN-013.png                   # 13. Admin Payment Execution (Reference)
├── 03_DIAGRAMS/
│   └── FINANCE_ARCHITECTURE_DIAGRAMS.md    # 정산 도메인 다이어그램 (Mermaid)
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                  # 브랜드 가이드라인 및 참조 자산 명세
```

---

## 3. Master Design System Reference

본 매뉴얼의 모든 visual design, 서체, 색상 팔레트, 표 서식, 호출 카드(Callout Cards) 및 레이아웃 스펙은 **`MAN-B-BRAND-001_Brand-Policy_V1.pdf`**를 **MASTER DESIGN REFERENCE**로 사용합니다.

---

## 4. Key Domain Principles (Core Handoff Rules)

1. **ORD ➔ FIN 병렬 전환 (Parallel Domain Handoff)**:
   - 공식 발주 수락(`po_status IN ('APPROVED', 'SENT')` AND `supplier_confirmation_status = 'CONFIRMED'`) 완료 시, 물류(LOG)와 정산(FIN)은 병렬로 동시 진입합니다.
   - 입고/검수(LOG)는 결제 조건에 따른 참조 항목일 뿐, FIN 진입 및 인보이스 생성의 직렬 전제조건이 아닙니다.
2. **독립 4대 상태 도메인 분리**:
   - `Invoice Status` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`)
   - `Payment Status` (`UNPAID`, `PARTIALLY_PAID`, `PAID`)
   - `Settlement Status` (`OPEN`, `SETTLED`)
   - `PO Status` (`DRAFT`, `APPROVED`, `SENT`, `COMPLETED`, `CANCELLED`)
3. **단일 활성 인보이스 제약 (Enforcement: BOTH)**:
   - 1개 PO당 오직 1개의 활성 인보이스(`invoice_status NOT IN ('VOID', 'REJECTED')`)만 허용. DB Partial Unique Index와 Application 사전 검증 양쪽에서 검증됨.
4. **정산 조정 (Adjustments)**:
   - `SHORTAGE`, `DAMAGE`, `PRICE_DIFFERENCE`, `OTHER`
   - `CREDIT` (감액 -), `CHARGE` (증액 +)
5. **System Gaps (미구현 기능)**:
   - 1:N 분할 인보이스 미지원 / 자동 PDF 변환 미구현 (외부 PDF 파일 직접 첨부).

---
