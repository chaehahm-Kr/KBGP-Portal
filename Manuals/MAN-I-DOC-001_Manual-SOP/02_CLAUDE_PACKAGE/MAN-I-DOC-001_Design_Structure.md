# MAN-I-DOC-001 — Design Structure & Layout Specification
## K SELECT Internal Operations: Manual Creation & Update SOP (디자인 구조 명세서)

---

## 1. Document Architecture & Chapter Layout

```text
MAN-I-DOC-001_Manual-SOP Guide
├── Cover Page & Document Metadata Notice
├── Executive Summary & Core Principles
├── Chapter 1. 매뉴얼 아키텍처 & 4-Tier 디렉터리 구조
│   ├── 1.1 K SELECT 매뉴얼 시리즈 인벤토리 (13 Modules Overview)
│   ├── 1.2 4-Tier 디렉터리 격리 원칙 (01_SOURCE ~ 04_ARCHIVE)
│   │   └── [Screenshot SCR-I-DOC-001]
│   └── 1.3 매뉴얼 ID 및 대상 독자 분류 체계 (MAN-B / MAN-I / MAN-A)
├── Chapter 2. 13단계 엔드투엔드 매뉴얼 라이프사이클 & 5대 QA 게이트
│   ├── 2.1 13단계 순차적 라이프사이클 파이프라인
│   ├── 2.2 5대 품질 게이트(Quality Gates)와 엄격한 차단 원칙 (Strict Blocking)
│   └── 2.3 브랜드 포털 지식 센터 연동 표면
│       ├── [Screenshot SCR-I-DOC-002]
│       └── [Screenshot SCR-I-DOC-003]
├── Chapter 3. 지식 센터 및 Grounded Q&A 어시스턴트 구조
│   ├── 3.1 브랜드 포털 FAQ Hub 구조 및 Featured FAQ 선정 기준
│   │   └── [Screenshot SCR-I-DOC-004]
│   ├── 3.2 Grounded Ask Q&A 어시스턴트 결정론적 검색 및 출처 인용
│   │   └── [Screenshot SCR-I-DOC-005]
│   └── 3.3 FAQ 발행의 필수 선행 조건 (Knowledge Item 선행 등록 원칙)
├── Chapter 4. 어드민 지식 운영 허브 & 버전 관리
│   ├── 4.1 어드민 지식 허브 대시보드 지표 및 상태 모니터링
│   │   └── [Screenshot SCR-I-DOC-006]
│   ├── 4.2 어드민 지식 라이브러리 테이블 및 상태 전이 제어
│   │   └── [Screenshot SCR-I-DOC-007]
│   └── 4.3 지식 아이템 세부 인스펙터, 버전 이력 및 자산 바이너리 검수
│       └── [Screenshot SCR-I-DOC-008]
├── Chapter 5. 마스터 디자인 시스템 규격 & Claude AI 패키징
│   ├── 5.1 MAN-B-BRAND-001 마스터 디자인 시스템 규격 (컬러, 타이포, 콜아웃)
│   │   └── [Screenshot SCR-I-DOC-009]
│   ├── 5.2 Claude Design Package 8-File 번들 구성 및 빌드 지침
│   │   └── [Screenshot SCR-I-DOC-010]
│   └── 5.3 스크린샷 핀(Pin) 어노테이션 매핑 및 100% 고유 해시 검증
├── Chapter 6. 자동화 QA 검증 스위트 & Git 릴리즈 파이프라인
│   ├── 6.1 TypeScript, 패키지 파일, DB 무결성 자동 검증 스크립트
│   │   └── [Screenshot SCR-I-DOC-011]
│   ├── 6.2 Git 커밋, 푸시 및 Local HEAD === origin/main 동기화 원칙
│   └── 6.3 배포 무결성 검증 (Publish Integrity & SHA-256 Checksum)
├── Chapter 7. 매뉴얼 개정 및 연쇄 영향 업데이트 SOP
│   ├── 7.1 시스템 변경 유형별 버전 분류 (Patch / Minor / Major)
│   ├── 7.2 6단계 연쇄 영향(Cascading Impact) 체크리스트
│   └── 7.3 금지된 안티패턴: 불완전 PDF 단독 수정 방지
└── Appendix
    ├── Appendix A. 6대 Production Grounding 상태 사전 (VERIFIED ~ NOT APPLICABLE)
    ├── Appendix B. 5대 도메인 상태 경계 구분표 (State Boundary Disambiguation)
    └── Appendix C. 7대 완료 기준(Definition of Done) 체크리스트
```

---

## 2. Screenshot-to-Chapter Mapping & Pin Layout Grid

| Screenshot ID | Target Chapter | Screen Title & Purpose | Expected Pin Callouts |
| :--- | :--- | :--- | :--- |
| `SCR-I-DOC-001` | Chapter 1 · Section 1.2 | Workspace Manuals Directory Hierarchy | Pin 1: 루트 폴더, Pin 2: 01_SOURCE, Pin 3: 02_PACKAGE, Pin 4: 03_PUBLISHED |
| `SCR-I-DOC-002` | Chapter 2 · Section 2.3 | Brand Portal Help & Manuals Hub | Pin 1: 토픽 필터 칩, Pin 2: 매뉴얼 카드 그리드, Pin 3: 상세 바로가기 |
| `SCR-I-DOC-003` | Chapter 2 · Section 2.3 | Brand Portal Manual Detail View | Pin 1: 버전 메타데이터, Pin 2: 챕터 목차, Pin 3: PDF 다운로드 스트림 |
| `SCR-I-DOC-004` | Chapter 3 · Section 3.1 | Brand Portal FAQ Hub Interface | Pin 1: 토픽 필터 탭, Pin 2: Featured 뱃지, Pin 3: FAQ 아코디언 확장 |
| `SCR-I-DOC-005` | Chapter 3 · Section 3.2 | Grounded Ask Knowledge Assistant | Pin 1: 질의 입력창, Pin 2: 지식 답변 카드, Pin 3: 공식 출처 앵커 인용 |
| `SCR-I-DOC-006` | Chapter 4 · Section 4.1 | Admin Knowledge Operations Overview | Pin 1: KPI 지표 카드, Pin 2: 최근 감사 로그, Pin 3: 서브 메뉴 내비게이션 |
| `SCR-I-DOC-007` | Chapter 4 · Section 4.2 | Admin Knowledge Library Table | Pin 1: 상태별 필터, Pin 2: 지식 아이템 테이블, Pin 3: 편집/버전 액션 |
| `SCR-I-DOC-008` | Chapter 4 · Section 4.3 | Admin Knowledge Detail Inspector | Pin 1: 기본 정보 패널, Pin 2: 버전 이력 탭, Pin 3: PDF 자산 검증 패널 |
| `SCR-I-DOC-009` | Chapter 5 · Section 5.1 | Master Design System Reference Grid | Pin 1: 커버 헤더, Pin 2: 다크 카드 팔레트, Pin 3: 핀 콜아웃, Pin 4: 페이지네이션 |
| `SCR-I-DOC-010` | Chapter 5 · Section 5.2 | Claude Design Package Structure | Pin 1: 마스터 프롬프트, Pin 2: 원고 본문 및 자산, Pin 3: 핀 어노테이션 블록 |
| `SCR-I-DOC-011` | Chapter 6 · Section 6.1 | Terminal Verification & QA Output | Pin 1: TypeScript 0 errors, Pin 2: 스크린샷 고유 해시, Pin 3: Search Discovery, Pin 4: Git Sync |
