# MAN-B-RPT-001 CLAUDE DESIGN PACKAGE
## Reports & Performance Guide (성과 분석, 대시보드 KPI 및 운영 지표 가이드)

- **Manual ID:** `MAN-B-RPT-001`
- **Topic:** `Reports & Performance (성과 분석, 대시보드 KPI 및 운영 지표)`
- **Audience:** `B — Brand Portal Users (회사 관리자, 실무 담당자)`
- **Authoritative Date:** 2026-10-01
- **Source Basis:** Approved Source Review `MAN-B-RPT-001-SRC-001`
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Package Overview & Structure

본 디렉토리는 K SELECT Brand Portal의 **Reports & Performance(성과 분석 및 운영 지표)** 공식 매뉴얼 제작을 위한 공식 **Claude Design Package**입니다.

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                                # 본 패키지 개요 및 규격 문서
├── CLAUDE_DESIGN_MASTER_PROMPT.md                  # Claude PDF 생성 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                 # 최종 핸드오프 및 검증 요약
├── MAN-B-RPT-001_Design_Structure.md               # 12열 그리드 및 타이포그래피 레이아웃 가이드
├── 01_CONTENT/
│   └── MAN-B-RPT-001_Manual_Content.md             # 6개 챕터로 구성된 공식 매뉴얼 본문
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md              # 8개 스크린샷 핀 콜아웃 가이드
│   ├── SCR-B-RPT-001.png                           # 브랜드 포털 메인 운영 대시보드
│   ├── SCR-B-RPT-002.png                           # 실시간 긴급 조치 큐 (Action Required)
│   ├── SCR-B-RPT-003.png                           # 발주 파이프라인 성과 요약 카드
│   ├── SCR-B-RPT-004.png                           # 발주 상태 필터 칩 및 테이블 정렬
│   ├── SCR-B-RPT-005.png                           # 정산 및 인보이스 실적 요약
│   ├── SCR-B-RPT-006.png                           # 제품 등록 완성도 지표 및 보완 알림
│   ├── SCR-B-RPT-007.png                           # 1:1 고객지원 문의 처리 현황
│   └── SCR-B-RPT-008.png                           # 어드민 전사 발주 대시보드
├── 03_DIAGRAMS/
│   └── REPORTS_PERFORMANCE_ARCHITECTURE_DIAGRAMS.md # 5대 프로덕션 아키텍처 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                          # 7대 지표 그룹, 계산식, 경계 공식 퀵 레퍼런스
```

---

## 2. Core Architecture Rules & Boundaries

1. **측정 및 분석 계층(Reporting & Performance Layer)**:
   - RPT 모듈은 신규 트랜잭션을 생성하거나 비즈니스 상태를 직접 변경하는 도메인이 아니며, 기존 운영 데이터(PROD, ORD, LOG, FIN, SUP)를 실시간 집계하여 제공하는 분석 레이어입니다.
2. **엄격한 교차 도메인 경계**:
   - **RPT ↔ PROD**: PROD가 속성의 Source of Truth이며, RPT는 28대 기준 완성도(`COMPLETE` vs `Draft`)를 평가·표시합니다.
   - **RPT ↔ ORD**: ORD가 발주 6단계 라이프사이클을 관리하며, RPT는 단계별 건수, 미입고 수량, 90일 기간 실적을 집계합니다.
   - **RPT ↔ FIN**: FIN이 청구/지급을 주관하며, RPT는 총 청구액, 지급액, 미지급 잔액, 연체 금액을 집계합니다.
   - **RPT ↔ RET**: RET가 리테일 실사를 관리하며, RPT는 재고 소진 추정, WOS(주간 공급량) 지표를 표시합니다.
3. **미구현 기능(System Gap / Not Implemented) 준수**:
   - 독립 메뉴 `/portal/reports`는 존재하지 않으며 대시보드 및 각 모듈에 통합되어 있습니다.
   - 브랜드 포털 일괄 Excel/PDF 보고서 내보내기, AI 성과 예측 기능은 지원되지 않습니다.
   - 어드민 `/admin/reports`는 플레이스홀더(준비 중)로 분류됩니다.
4. **8개 프로덕션 스크린샷 1:1 검증**:
   - 실제 운영 화면에서 캡처된 8장의 고해상도 이미지가 포함되어 있으며 해시 중복이 없습니다.

---
*End of PACKAGE_README.md*
