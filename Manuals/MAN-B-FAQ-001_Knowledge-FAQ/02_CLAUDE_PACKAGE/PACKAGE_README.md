# MAN-B-FAQ-001 CLAUDE DESIGN PACKAGE
## Knowledge Center & FAQ Guide (도움말 센터, 자주 묻는 질문 및 지식 검색 가이드)

- **Manual ID:** `MAN-B-FAQ-001`
- **Topic:** `Knowledge Center FAQ (도움말 센터, 자주 묻는 질문 및 지식 검색)`
- **Audience:** `B — Brand Portal Users (회사 관리자, 실무 담당자)`
- **Authoritative Date:** 2026-10-02
- **Source Basis:** Approved Source Review `MAN-B-FAQ-001-SRC-001-R1`
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Package Overview & Structure

본 디렉토리는 K SELECT Brand Portal의 **Knowledge Center & FAQ(도움말 센터 / 지식 검색)** 공식 매뉴얼 제작을 위한 공식 **Claude Design Package**입니다.

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                                # 본 패키지 개요 및 규격 문서
├── CLAUDE_DESIGN_MASTER_PROMPT.md                  # Claude PDF 생성 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                 # 최종 핸드오프 및 검증 요약
├── MAN-B-FAQ-001_Design_Structure.md               # 12열 그리드 및 타이포그래피 레이아웃 가이드
├── 01_CONTENT/
│   └── MAN-B-FAQ-001_Manual_Content.md             # 7개 챕터로 구성된 공식 매뉴얼 본문
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md              # 10개 스크린샷 핀 콜아웃 가이드
│   ├── SCR-B-FAQ-001.png                           # 도움말 센터 메인 히어로 및 검색창
│   ├── SCR-B-FAQ-002.png                           # 6대 표준 토픽 그리드 및 Featured FAQ
│   ├── SCR-B-FAQ-003.png                           # 토픽 선택 및 FAQ 아코디언 확장 뷰
│   ├── SCR-B-FAQ-004.png                           # Grounded Ask K SELECT 직접 답변 카드
│   ├── SCR-B-FAQ-005.png                           # 출처 인용 및 정본 매뉴얼 링크
│   ├── SCR-B-FAQ-006.png                           # 매뉴얼 상세 뷰어 및 하단 연계 FAQ
│   ├── SCR-B-FAQ-007.png                           # 1:1 문의 연계 시 질문 사전 입력 화면
│   ├── SCR-B-FAQ-008.png                           # 모바일 반응형 도움말 센터
│   ├── SCR-B-FAQ-009.png                           # 어드민 FAQ 심사 및 배포 관리 콘솔
│   └── SCR-B-FAQ-010.png                           # 어드민 지식 라이브러리 관리 콘솔
├── 03_DIAGRAMS/
│   └── KNOWLEDGE_FAQ_ARCHITECTURE_DIAGRAMS.md      # 5대 프로덕션 아키텍처 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                          # 63개 FAQ 매트릭스, 토픽, 검색 스코어링 퀵 레퍼런스
```

---

## 2. Core Architecture Rules & Boundaries

1. **63개 프로덕션 FAQ 기준 작성**:
   - BRAND (5), ONB (9), PROD (14), ORD (12), REG (12), RET (11) 총 63건의 공식 FAQ만을 정본으로 다룹니다.
2. **미발행 도메인 관리**:
   - LOG, FIN, PERM, TASK, RPT, INT는 현재 FAQ가 발행되지 않았으므로 활성 FAQ처럼 표현하지 않고 배포 예정 상태로 명시합니다.
3. **Featured FAQ 모델**:
   - 시스템 강제 제약이 아닌 **Editorial Policy 및 Data Pattern**으로 정의합니다 (현재 26건 배정).
4. **교차 도메인 경계 수호**:
   - `Retail Application Approval ≠ Automatic Purchase Order Creation`
   - `ARRIVED ≠ RECEIVED ≠ COMPLETED ≠ PAID`
   - `Shipping Complete ≠ Settlement Complete`
5. **엄격한 기술적 서술**:
   - 과장되거나 검증되지 않은 절대적 표현을 배제하고 프로덕션 실제 동작에 기반하여 기술되었습니다.

---
*End of PACKAGE_README.md*
