# MAN-B-TASK-001 CLAUDE DESIGN PACKAGE
## Task & Communication Guide (할 일, 업무 조율 및 1:1 케이스 소통 가이드)

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (업무 할 일, 1:1 문의 및 브랜드 ↔ 어드민 케이스 소통)`
- **Audience:** `B — Brand Portal Users (회사 관리자, 운영 실무자, 권한 보유 사용자)`
- **Authoritative Date:** 2026-10-02
- **Source Basis:** Approved Source Review `MAN-B-TASK-001-SRC-001-R1`
- **Master Design Reference:** `MAN-B-BRAND-001_Brand-Policy_V1.pdf`

---

## 1. Package Overview & Structure

본 디렉토리는 K SELECT Brand Portal의 **Task & Communication(지원 센터 / 1:1 문의)** 공식 매뉴얼 제작을 위한 공식 **Claude Design Package**입니다.

```
02_CLAUDE_PACKAGE/
├── PACKAGE_README.md                                 # 본 패키지 개요 및 규격 문서
├── CLAUDE_DESIGN_MASTER_PROMPT.md                   # Claude PDF 생성 마스터 프롬프트
├── CLAUDE_DESIGN_HANDOFF_PROMPT.md                  # 최종 핸드오프 및 검증 요약
├── MAN-B-TASK-001_Design_Structure.md               # 12열 그리드 및 타이포그래피 레이아웃 가이드
├── 01_CONTENT/
│   └── MAN-B-TASK-001_Manual_Content.md             # 7개 챕터로 구성된 공식 매뉴얼 본문
├── 02_SCREENSHOTS/
│   ├── SCREENSHOT_ANNOTATION_GUIDE.md               # 12개 스크린샷 핀 콜아웃 가이드
│   ├── SCR-B-TASK-001.png                           # 지원 센터 메인 허브 및 케이스 목록
│   ├── SCR-B-TASK-002.png                           # 새 1:1 문의 등록 모달
│   ├── SCR-B-TASK-003.png                           # 양방향 대화 스레드 상세 뷰
│   ├── SCR-B-TASK-004.png                           # 조치 필요 배너 및 보완 폼
│   ├── SCR-B-TASK-005.png                           # 케이스 종결 및 5점 만족도 평가 (CSAT)
│   ├── SCR-B-TASK-006.png                           # PO 변경 요청 딥링크 사전 입력
│   ├── SCR-B-TASK-007.png                           # 정산 문의 딥링크 사전 입력
│   ├── SCR-B-TASK-008.png                           # 헤더 인앱 알림 피드
│   ├── SCR-B-TASK-009.png                           # 뷰어 역할 읽기 전용 모드
│   ├── SCR-B-TASK-010.png                           # 권한 없음 접근 차단 화면
│   ├── SCR-B-TASK-011.png                           # 어드민 파트너 문의 관리 콘솔 (Reference)
│   └── SCR-B-TASK-012.png                           # 어드민 내부 일감 콘솔 (Reference)
├── 03_DIAGRAMS/
│   └── TASK_COMMUNICATION_ARCHITECTURE_DIAGRAMS.md  # 7대 프로덕션 아키텍처 다이어그램
└── 04_REFERENCE/
    └── REFERENCE_GUIDE.md                           # 상태 정규화, 카테고리, ACL 퀵 레퍼런스
```

---

## 2. Core Architecture Rules & Boundaries

1. **PERM Tasks vs Dynamic Case Communication**:
   - `MAN-B-PERM-001`의 6대 주 담당자 업무(`company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry`)는 회사 단위의 정적 알림 라우팅 구조입니다.
   - `MAN-B-TASK-001`의 케이스 소통은 `partner_inquiries` 및 `partner_inquiry_messages` 기반의 동적 티켓/이슈 라이프사이클입니다.
   - 어드민의 레거시 `public.tasks`(`/admin/tasks`)는 파트너 문의와 연동되지 않은 초기 프로토타입/시스템 갭(Unlinked System Gap)이며, 실제 브랜드 파트너 문의 관리는 `/admin/partner-inquiries`에서 전담합니다.

2. **상태 정규화 (Status Normalization)**:
   - 10개의 내부 DB 상태(`draft`, `submitted`, `assigned`, `in_progress`, `waiting_on_partner`, `action_required`, `partner_action_required`, `under_review`, `resolved`, `closed`)는 사용자 UI에서 4개의 직관적인 표시 상태(`RECEIVED`, `UNDER_REVIEW`, `ACTION_REQUIRED`, `CLOSED`)로 정규화되어 일관되게 제공됩니다.

3. **6대 정규 인앱 알림 & 조건부 이메일 발송 규칙**:
   - **인앱 알림 이벤트 (6종)**: `New Inquiry`, `Admin Reply`, `Action Required`, `Action Resolved`, `Case Closed`, `CSAT Submission`.
   - **트랜잭션 이메일 발송 (Resend)**: 일상적인 단순 댓글/답변에는 이메일이 발송되지 않으며, 관리자가 '추가 정보/조치 필요(`isActionRequired=true`)'를 설정하고 '이메일 알림 전송(`sendEmail=true`)'을 명시적으로 체크한 경우 또는 신규 케이스 생성 시 이메일 옵션을 선택한 경우에만 엄격히 조건부로 발송됩니다.

4. **스토리지 및 첨부파일 규격**:
   - 버킷명: `"company-uploads"`, 경로: `${companyId}/inquiries/...`, 최대 크기: 20MB, 이미지(PNG/JPEG/WEBP) 및 PDF 지원, 서명 URL(Signed URL) 다운로드.

5. **교차 도메인 연계 (DB FK vs Context Prefill)**:
   - **PO 발주 변경 (`orders`)**: 모달에서 특정 발주 선택 시 실제 외래키 `related_po_id`가 DB 컬럼에 물리적으로 바인딩됩니다.
   - **정산(`settlements`) 및 약관/계약(`agreements`)**: 전용 DB 외래키 컬럼이 없으며, 인입 시 식별 번호가 제목과 설명에 텍스트로 자동 사전 입력(Context Prefill)되어 안내됩니다.

6. **엄격한 기술적 서술 (Zero Absolute Claims)**:
   - "모든 비즈니스 문의", "모든 소통" 등 검증되지 않은 과장된 절대적 표현을 배제하고, "브랜드 포털 내 공식 지원 문의, 변경 요청 및 관련 커뮤니케이션"으로 명확히 한정하여 기술되었습니다.

---
*End of PACKAGE_README.md*

