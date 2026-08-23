# K SELECT Support Case 운영 정책 요약서 (Policy Summary)

> **문서 버전**: v1.0.0  
> **최종 갱신일**: 2026년 8월 18일  
> **적용 대상**: K SELECT Network Brand Portal 및 Admin 운영팀  

---

## 1. Core Principles (핵심 운영 원칙)

K SELECT Support Case 시스템은 글로벌 B2B 파트너십 환경에 맞춘 일관된 문의 관리 체계를 제공합니다. 모든 문의 처리 과정은 아래 9가지 대원칙을 엄격히 준수합니다.

```
[Principle 1] ONE CASE → ONE CANONICAL STATUS
  - Admin과 Brand Portal은 완전히 동일한 Single Source of Truth DB Status를 공유합니다.
  - UI 화면별로 별도의 상태 계산을 수행하지 않으며, 동일 케이스는 어디서나 동일 상태로 표출됩니다.

[Principle 2] CLOSED IS FINAL STATUS (종료 상태의 불가역성)
  - 종료(CLOSED)된 케이스는 재오픈(Reopen)하지 않습니다.
  - 일반 파트너 및 어드민 Workflow 모두에서 Reopen 액션은 제공되지 않습니다.

[Principle 3] FOLLOW-UP CASE FOR ADDITIONAL ISSUES (후속 문의 체계)
  - 종료된 케이스에 대한 추가 문의가 발생하면 기존 케이스를 여는 대신 새 케이스(Follow-up Case)를 생성합니다.
  - 새 후속 문의는 이전 케이스 번호(#CASE-XXXX)와 DB 상의 FK(previous_case_id)로 명확히 추적 연결됩니다.

[Principle 4] EXPLICIT CLOSE ACTIONS ONLY (명시적 종료 정책)
  - 케이스는 오직 3가지 명시적 종료 액션으로만 CLOSED 전이가 가능합니다.
    1. Admin: [답변 등록 후 케이스 종료]
    2. Admin: [케이스 종료 (답변 없이)]
    3. Portal: [문의 종료]
  - 일반 답변 작성, 조치 요청, 파트너 조치 완료 제출, 만족도 작성 등은 절대 자동 종료를 발생시키지 않습니다.

[Principle 5] PARTNER ACTION COMPLETE TRANSITIONS TO 'UNDER_REVIEW'
  - 파트너사의 [조치 완료 작성 및 검토 요청] 제출은 케이스 종료가 아닙니다.
  - 상태는 ACTION_REQUIRED → UNDER_REVIEW (검토중)으로 전이되어 Admin이 재검토를 진행할 수 있는 Active 상태가 유지됩니다.

[Principle 6] SEPARATION OF CONVERSATION VS CASE LOG
  - 대화 내용 (Conversation): 사람과 사람이 보낸 실질 텍스트 메시지 및 첨부파일을 100% 노출합니다 (Admin 조치 요청 텍스트 포함).
  - 처리 기록 (Case Log): 접수, 상태 변경, 담당자 배정, 조치 완료 접수, 종료, 만족도 평가 등 시스템 Audit Event만 표시합니다.

[Principle 7] SATISFACTION RATING AFTER VERIFIED CLOSE
  - 파트너사의 만족도 평가(별점 1~5점 및 서술형 의견)는 케이스가 명시적으로 CLOSED된 상태에서만 작성/수정 가능합니다.

[Principle 8] BILINGUAL USER-FACING ERROR MESSAGES
  - 사용자에게 노출되는 오류 및 거부 메시지는 항상 한국어와 영어를 함께 표기합니다 (Technical Stack Trace 노출 전면 금지).

[Principle 9] STRICT SECURITY & OWNERSHIP VALIDATION
  - 포털 요청은 로그인 사용자의 company_id 소속 검증 후 처리되며, 어드민 요청은 Admin 권한 인증 후 처리됩니다.
```

---

## 2. Status Definitions (4대 공식 상태 정의)

| 상태명 (Official Status) | UI 라벨 (Ko/En) | Badge Color / Emoji | 설명 및 전이 조건 |
| :--- | :--- | :--- | :--- |
| **RECEIVED** | `접수됨` / Received | Amber 🟡 (`bg-amber-50`) | 파트너사가 새 1:1 문의를 신규 등록한 최초 상태 |
| **UNDER_REVIEW** | `검토중` / Under Review | Blue 🔵 (`bg-blue-50`) | 어드민 담당자가 문의를 확인하여 검토 중이거나, 파트너사가 조치 완료 제출을 마친 Active 상태 |
| **ACTION_REQUIRED** | `조치필요` / Action Required | Rose 🔴 (`bg-rose-50`) | 어드민이 파트너사에 서류 보완, 입력 수정 등 추가 조치를 명시적으로 요청한 상태 |
| **CLOSED** | `종료됨` / Closed | Neutral ⚫ (`bg-zinc-100`) | 어드민 또는 파트너사의 명시적 종료 액션으로 최종 완료된 Final Status |

---

## 3. State Transition Matrix (상태 전이 규칙)

```
                       [ 파트너 신규 문의 작성 ]
                                   │
                                   ▼
                             🟡 접수됨 (RECEIVED)
                                   │
                 ┌─────────────────┴─────────────────┐
                 │ (Admin 검토 시작 / 일반 답변)     │ (Admin 조치 필요 요청)
                 ▼                                   ▼
         🔵 검토중 (UNDER_REVIEW) ◀───────────── 🔴 조치필요 (ACTION_REQUIRED)
                 │         ▲   (파트너 조치 완료 제출)
                 │         │
                 │         └─────────────────────────┘
                 │
                 │ (Admin/Portal 명시적 종료 액션)
                 ▼
         ⚫ 종료됨 (CLOSED)  [FINAL STATUS]
                 │
                 ├──► 파트너 만족도 평가 작성/수정 (Rating)
                 └──► 후속 문의하기 (Follow-up Case 생성 ──► 🟡 RECEIVED)
```

---

## 4. Specific Operational Rules (상세 운영 규칙)

### 4.1 Admin 답변 및 종료 액션 분리
- **`[답변 등록]`**: 파트너사에게 답변 텍스트를 전달하고, 상태는 `UNDER_REVIEW` (조치 요청 포함 시 `ACTION_REQUIRED`)로 유지합니다.
- **`[🔒 답변 등록 후 케이스 종료]`**: 답변 텍스트를 전달함과 동시에 케이스를 `CLOSED`로 안전하게 원자적 종료 처리합니다.
- **`[🔒 케이스 종료 (답변 없이)]`**: 추가 답변 텍스트 없이 현시점에서 케이스를 `CLOSED` 처리합니다.

### 4.2 파트너 조치 완료 프로세스
- 파트너가 `ACTION_REQUIRED` 케이스에서 **[조치 완료 작성 및 검토 요청]**을 클릭하고 내용/첨부파일을 제출하면:
  - 상태: `ACTION_REQUIRED → UNDER_REVIEW`
  - 메시지: Conversation 탭에 파트너 조치 텍스트 기록, Case Log 탭에 `상태 전이: 조치필요 → 검토중` 기록
  - 알림: 어드민 담당자에게 조치 완료 검토 요청 알림 자동 발송

### 4.3 후속 문의 (Follow-up Case) 데이터 모델
- 종료된 케이스 상세 하단의 **[후속 문의하기]** 버튼 클릭 시:
  - 이전 케이스의 카테고리가 자동 선택되고 제목에 `[Follow-up]` 접두어가 부여됩니다.
  - DB `partner_inquiries` 레코드의 `previous_case_id` 컬럼에 원본 케이스 UUID 가 저장되어, 상세 화면 상단에 `#CASE-XXXX` 상호 링크 카드가 생성됩니다.
