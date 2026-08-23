# K SELECT Support Case 운영 매뉴얼 (원본 원고 패키지)

> **문서 버전**: v1.0.0 (Production Release Standard)  
> **발행일**: 2026년 8월 18일  
> **작성 주체**: Advanced Agentic Engineering Team  
> **최종 목적**: K SELECT Network 지원 시스템의 실제 운영 가이드 제공 및 디자인 재가공용 원본 자산 패키지  

---

# A. 문서 개요 (Document Overview)

## 1. 문서 제목
**K SELECT Support Case 시스템 표준 운영 매뉴얼** (Support Case Standard Operational Manual)

## 2. 문서 목적
본 매뉴얼은 K SELECT Network의 브랜드 파트너사(Brand Portal 사용자)와 internal 관리자(Admin 운영팀) 간의 1:1 커뮤니케이션 및 과제 관리 채널인 **Support Case 시스템**의 전체 운영 프로세스, 상태 전이 규칙, 정책 기준 및 화면별 상세 사용법을 명확히 문서화하는 것을 목적으로 합니다.

## 3. 대상 독자
- **Admin 운영 담당자 (Admin Staff)**: 파트너사 문의 검토, 조치 요청 발송, 답변 등록 및 케이스 종료 처리 담당자
- **Brand Portal 파트너 사용자 (Partner User)**: 1:1 문의 등록, 어드민 조치 요청에 대한 대응 작성, 문의 종료, 만족도 평가 및 후속 문의 작성 담당자

## 4. 이 매뉴얼로 무엇을 할 수 있는지
- Support Case의 4대 공식 상태(`접수됨`, `검토중`, `조치필요`, `종료됨`)의 정의와 상태 전이 매트릭스를 완벽히 이해할 수 있습니다.
- Brand Portal과 Admin 양쪽에서 동일한 Single Source of Truth 데이터로 일관되게 케이스를 처리하는 구체적인 행동 지침을 습득할 수 있습니다.
- Case 종료 정책, 후속 문의(Follow-up Case) 연동 및 대화 내용(Conversation) vs 처리 기록(Case Log)의 역할 분리 기준을 정확히 파악할 수 있습니다.

---

# B. 시스템 개요 (System Overview)

## 1. Support Case 기능이란?
K SELECT Support Case 시스템은 단순한 1회성 실시간 채팅창이 아니라, **B2B 파트너십 환경에 최적화된 비동기 과제 해결형 케이스 관리 시스템**입니다. 파트너사가 문의를 등록하면 전용 케이스 번호(`#CASE-XXXX`)가 부여되며, 카테고리 분류, 담당자 배정, 증빙 파일 첨부, 대화 이력 및 시스템 Audit Log 기록, 케이스 종료 및 파트너 만족도 평가까지 전체 Lifecycle을 체계적으로 추적·관리합니다.

## 2. Portal과 Admin의 역할 차이

```
┌───────────────────────────────────────┐         ┌───────────────────────────────────────┐
│     Brand Portal (파트너 사용자)      │         │          Admin (운영 담당자)          │
├───────────────────────────────────────┤         ├───────────────────────────────────────┤
│ • 신규 1:1 문의 등록 및 파일 첨부     │ ──────► │ • 파트너 문의 수신 및 상태 검토       │
│ • 조치 요청 수신 및 조치 완료 작성    │ ◀─────► │ • ⚠️ 조치 요청 발송 (ACTION_REQUIRED) │
│ • 명시적 문의 종료 처리 및 만족도 평가│ ◀─────  │ • 🔒 답변 등록 후 케이스 종료 (CLOSED) │
│ • 종료 케이스에 대한 후속 문의 생성   │ ──────► │ • 후속 문의 이전 케이스 연결 확인     │
└───────────────────────────────────────┘         └───────────────────────────────────────┘
```

## 3. 핵심 개념 정의

- **문의 (Inquiry / Case)**: 파트너사가 특정 주제(입점/제품/물류/정산/시스템 등)에 대해 등록한 독립적인 1:1 문의 객체입니다. Unique한 `#CASE-XXXX` 번호를 가집니다.
- **조치 필요 (Action Required)**: 어드민이 파트너사 측에 서류 보완, 입력 수정 등 추가적인 액션을 명시적으로 요청한 활성(Active) 상태입니다.
- **조치 완료 (Action Resolution)**: 파트너사가 어드민의 조치 요청에 응답하여 보완 내용 및 파일 첨부를 제출하는 행위입니다. 상태는 절대 자동 종료되지 않고 `UNDER_REVIEW` (검토중)으로 전이됩니다.
- **종료 (Closed)**: 어드민 또는 파트너사의 명시적 종료 액션으로 케이스 처리가 완결된 Final Status입니다.
- **후속 문의 (Follow-up Case)**: 종료된 케이스에 대해 추가 질문이나 연관 이슈가 발생했을 때 생성하는 새 문의로, 이전 케이스 번호와 DB 상으로 상호 연결됩니다.

---

# C. 상태 정의 및 상태 전이 (Status & State Transitions)

K SELECT Support Case 시스템은 복잡한 레거시 상태값을 배제하고 **4개 공식 상태(4 Official Case Statuses)**로 단순화하여 Admin과 Portal이 100% 동일한 데이터로 동작합니다.

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

## 1. 4대 공식 상태 정의

1. **`RECEIVED` (`접수됨`, 🟡 Amber)**
   - 파트너사가 포털에서 신규 문의를 제출한 최초 상태입니다. 어드민의 확인 및 첫 답변이 등록되기 전까지 유지됩니다.
2. **`UNDER_REVIEW` (`검토중`, 🔵 Blue)**
   - 어드민 담당자가 문의를 확인하여 검토 중이거나 일반 답변을 남긴 상태, 또는 파트너사가 조치 완료 제출을 마쳐 어드민이 재검토를 진행 중인 Active 상태입니다.
3. **`ACTION_REQUIRED` (`조치필요`, 🔴 Rose/Red)**
   - 어드민이 파트너사 측에 서류 추가 업로드, 상품 정보 수정 등의 개입을 요청한 상태입니다. 파트너사의 화면에 붉은색 안내 배너가 표시됩니다.
4. **`CLOSED` (`종료됨`, ⚫ Neutral/Gray)**
   - 명시적 종료 액션으로 케이스 처리가 완료된 Final Status입니다. 더 이상 메시지 작성이 불가능하며 파트너 만족도 평가 및 후속 문의 작성이 활성화됩니다.

---

# D. 핵심 운영 정책 (Operational Policies)

1. **CLOSED는 Final Status이다**
   - 종료된 케이스는 일반 사용자와 어드민 Workflow에서 절대로 다시 여는(Reopen) 버튼이나 기능을 제공하지 않습니다.
2. **Reopen은 사용하지 않는다**
   - 케이스의 종결성을 보장하고 SLA 및 감사 추적(Audit Trail)을 명확히 하기 위해 Reopen 정책을 완전 배제합니다.
3. **후속 문의는 새 케이스로 생성되고 이전 케이스와 연결된다**
   - 종료 케이스에 추가 문의가 필요하면 **[후속 문의하기]** 버튼을 통해 새 케이스를 발행하며, DB `previous_case_id` 및 UI 상단 `#CASE-XXXX` 카드로 이전 케이스 맥락이 100% 보존됩니다.
4. **케이스 종료는 명시적 종료 액션으로만 가능하다**
   - 어드민: `[🔒 답변 등록 후 케이스 종료]`
   - 어드민: `[🔒 케이스 종료 (답변 없이)]`
   - 파트너사: `[문의 종료]`
   - 이 3가지 명시적 버튼 클릭 외에는 그 어떠한 경우에도 케이스가 자동 종료되지 않습니다.
5. **조치 완료 제출은 절대 자동 종료가 아니며, 상태는 검토중으로 돌아간다**
   - 파트너사의 `[조치 완료 작성 및 검토 요청]` 제출은 상태를 `ACTION_REQUIRED → UNDER_REVIEW`로 전이시킵니다. 어드민이 파트너의 조치 내용을 최종 검토하고 닫기 전까지 케이스는 종료되지 않습니다.
6. **Conversation은 실제 대화 내용**
   - 사람과 사람이 보낸 실질 텍스트 메시지 및 첨부파일을 100% 보존하여 표시합니다 (어드민이 조치 요청 체크 시 보낸 문장 포함).
7. **Case Log는 상태 변화, 종료, 만족도, 후속 문의 연결 등 운영 이력**
   - 시스템/운영 감사 이벤트(Audit Trail)만 타임스탬프 순으로 정렬하여 표시합니다.
8. **종료된 케이스는 파트너가 만족도 평가 가능**
   - 명시적 `CLOSED` 상태에서만 파트너사가 별점 (1~5점) 및 서술형 의견을 작성하거나 수정할 수 있습니다.
9. **종료 후 추가 이슈는 후속 문의로 처리**
   - 종료 케이스 상세 화면 하단에 `후속 문의하기` CTA가 노출되어 원클릭으로 연속성 있는 새 문의 작성을 지원합니다.

---

# E. Brand Portal 사용자 매뉴얼 (Brand Portal Guide)

## 1. 문의 지원 메뉴 진입 및 목록 화면
- 사이드바 메뉴 **`Support`**를 클릭하여 진입합니다.
- 상단에는 통합 검색창(제목/케이스번호/내용)과 4대 상태 필터 탭(`전체`, `접수됨`, `검토중`, `조치필요`, `종료됨`)이 위치합니다.

![PORTAL-01-LIST](file:///assets/annotated/PORTAL-01-LIST_annotated.png)
* [Capture ID: PORTAL-01-LIST] Brand Portal Support 목록 및 검색/상태 필터 화면 (1: 검색창 / 2: 상태 필터 탭)

## 2. 새 1:1 문의 작성
- 우측 상단 **`[새 문의 작성]`** 버튼을 클릭하면 모달 폼이 열립니다.
- 문의 유형(입점/제품/물류/정산/시스템/기타) 선택 후 제목, 상세 내용 및 첨부파일(최대 20MB)을 업로드하고 **`[문의 등록]`**을 누릅니다.

![PORTAL-02-NEW-MODAL](file:///assets/annotated/PORTAL-02-NEW-MODAL_annotated.png)
* [Capture ID: PORTAL-02-NEW-MODAL] 새 1:1 문의 작성 모달 (1: 문의 유형 / 2: 제목 / 3: 내용)

## 3. 대화 내용 (Conversation) 탭 활용
- 케이스 상세 화면의 **`💬 대화 내용 (Conversation)`** 탭에서는 어드민 담당자와 주고받은 텍스트 메시지, 조치 요청 내용, 제출된 파일 첨부가 시각적으로 구분되어 표시됩니다.

![PORTAL-03-CONVERSATION](file:///assets/annotated/PORTAL-03-CONVERSATION_annotated.png)
* [Capture ID: PORTAL-03-CONVERSATION] 대화 내용 탭 - 사람 간 텍스트 대화 100% 표출

## 4. 처리 기록 (Case Log) 탭 활용
- **`📋 Case Log (처리 기록)`** 탭을 선택하면 문의 접수시각, 담당자 변경, 조치 완료 접수, 종료 시각, 만족도 평가 등 전체 시스템 이력을 확인할 수 있습니다.

![PORTAL-04-CASELOG](file:///assets/annotated/PORTAL-04-CASELOG_annotated.png)
* [Capture ID: PORTAL-04-CASELOG] Case Log 탭 - 시스템 운영 Audit Trail 이력

## 5. 조치 필요 (ACTION_REQUIRED) 수신 시 대응 방법
- 케이스 상태가 `조치필요`로 변경되면 상세 상단에 붉은색 안내 배너와 함께 **`[조치 완료 작성 및 검토 요청]`** 버튼이 노출됩니다.

![PORTAL-05-ACTION-REQ-BANNER](file:///assets/annotated/PORTAL-05-ACTION-REQ-BANNER_annotated.png)
* [Capture ID: PORTAL-05-ACTION-REQ-BANNER] 조치 필요 상태 케이스 및 조치 완료 작성 버튼

## 6. 조치 완료 작성 및 검토 요청 방법
- `[조치 완료 작성 및 검토 요청]` 클릭 시 모달이 열립니다. 어드민이 요청한 서류 보완이나 정보 수정 내역을 작성하고 파일 첨부 후 **`[제출 및 검토 요청]`**을 누릅니다.
- 제출 즉시 상태는 `ACTION_REQUIRED → UNDER_REVIEW` (검토중)으로 변경되어 어드민이 재검토를 진행합니다.

![PORTAL-06-RESOLVE-MODAL](file:///assets/annotated/PORTAL-06-RESOLVE-MODAL_annotated.png)
* [Capture ID: PORTAL-06-RESOLVE-MODAL] 조치 완료 작성 및 검토 요청 모달

## 7. 문의 종료 방법
- 추가 문의 사항이 없고 해결이 완료된 경우 우측 상단 **`[문의 종료]`** 버튼을 누릅니다.
- 종료 확인 팝업에서 **`[종료 처리]`**를 누르면 상태가 `CLOSED`로 전이되며 즉시 모달이 닫히고 화면이 종료 상태로 전환됩니다.

![PORTAL-07-CLOSE-MODAL](file:///assets/annotated/PORTAL-07-CLOSE-MODAL_annotated.png)
* [Capture ID: PORTAL-07-CLOSE-MODAL] 문의 종료 확인 모달

## 8. 만족도 평가 방법
- 케이스가 `CLOSED` 처리되면 대화 하단에 만족도 평가 카드가 활성화됩니다.
- 별점(1~5점)을 클릭하고 서술형 의견을 입력한 후 **`[평가 제출]`**을 누르면 어드민 담당자에게 피드백이 전달됩니다 (제출 후 수정도 가능).

![PORTAL-08-RATING](file:///assets/annotated/PORTAL-08-RATING_annotated.png)
* [Capture ID: PORTAL-08-RATING] 종료 케이스 만족도 평가 카드

## 9. 후속 문의 (Follow-up Case) 생성 방법
- 종료된 케이스에서 추가 관련 이슈가 발생하면 하단의 **`[후속 문의하기]`** 버튼을 누릅니다.
- 이전 문의 정보가 자동으로 연동된 신규 작성 창이 열리며, 등록 시 `#CASE-XXXX` 이전 케이스 카드가 상세 상단에 표시됩니다.

![PORTAL-09-FOLLOWUP](file:///assets/annotated/PORTAL-09-FOLLOWUP_annotated.png)
* [Capture ID: PORTAL-09-FOLLOWUP] 종료 케이스 하단 후속 문의하기 버튼

---

# F. Admin 운영자 매뉴얼 (Admin Operational Guide)

## 1. Partner Inquiries 목록 및 검색/필터
- Admin 좌측 메뉴 **`Partner Inquiries`**를 선택합니다.
- 전체 파트너 문의 목록, 회사명, 케이스 번호, 접수 일시, 현재 4대 상태 뱃지를 한눈에 조회할 수 있으며 상단 필터로 원하는 상태만 선별 가능합니다.

![ADMIN-01-LIST](file:///assets/annotated/ADMIN-01-LIST_annotated.png)
* [Capture ID: ADMIN-01-LIST] Admin Partner Inquiries 목록 화면 및 필터

## 2. 케이스 상세 Conversation 및 Case Log 탭
- 파트너사가 작성한 본문 메시지 및 파일 첨부를 확인하고, **`Case Log`** 탭에서 처리 이력을 조회합니다. 어드민 조치 요청 시 작성한 문장도 Conversation 탭에 100% 보존됩니다.

![ADMIN-02-CONVERSATION](file:///assets/annotated/ADMIN-02-CONVERSATION_annotated.png)
* [Capture ID: ADMIN-02-CONVERSATION] Admin 케이스 상세 Conversation 탭

![ADMIN-03-CASELOG](file:///assets/annotated/ADMIN-03-CASELOG_annotated.png)
* [Capture ID: ADMIN-03-CASELOG] Admin 케이스 상세 Case Log 탭

## 3. 어드민 3-Action Group 답변 작성 및 종료
- 답변 작성 영역 하단에는 **논리적으로 통합된 3-Action 버튼 그룹**이 배치되어 있습니다.

```text
[ 답변 등록 ]  [ 🔒 답변 등록 후 케이스 종료 ]
          [ 🔒 답변 없이 케이스 종료 ]
```

1. **`[답변 등록]`**: 답변을 작성하여 파트너사에게 전달하며 상태를 `UNDER_REVIEW`로 유지합니다.
2. **`[🔒 답변 등록 후 케이스 종료]`**: 답변 작성과 케이스 `CLOSED` 처리를 한 번의 클릭으로 안전하게 동시 수행합니다.
3. **`[🔒 답변 없이 케이스 종료]`**: 추가 답변 작성 없이 현재 시점에서 케이스를 즉시 `CLOSED` 처리합니다.

![ADMIN-04-REPLY-FORM](file:///assets/annotated/ADMIN-04-REPLY-FORM_annotated.png)
* [Capture ID: ADMIN-04-REPLY-FORM] Admin 3-Action Group 답변 작성 및 종료 영역 (1: 답변 등록 / 2: 답변 등록 후 종료 / 3: 답변 없이 종료)

## 4. 조치 필요 (ACTION_REQUIRED) 포함 답변 등록
- 파트너사 측의 서류 보완이나 정보 수정을 요청하려면 답변 작성 시 **`⚠️ 조치 요청 포함 (파트너사에서 추가 조치 필요)`** 체크박스를 켭니다.
- 제출 시 상태가 `ACTION_REQUIRED`로 전이되며 파트너사 화면에 붉은색 조치 요청 배너가 생성됩니다.

![ADMIN-05-ACTION-REQUIRED-TOGGLE](file:///assets/annotated/ADMIN-05-ACTION-REQUIRED-TOGGLE_annotated.png)
* [Capture ID: ADMIN-05-ACTION-REQUIRED-TOGGLE] 조치 요청 포함 체크박스 (ACTION_REQUIRED 지정)

## 5. 종료 케이스 확인 및 파트너 만족도 조회
- 종료된 케이스 상세에서는 종료 시각 및 종료 주체(`어드민 담당자` 또는 `파트너사`)가 명시되며, 파트너사가 제출한 별점 및 서술형 피드백을 실시간으로 확인할 수 있습니다.

![ADMIN-06-CLOSED-INFO](file:///assets/annotated/ADMIN-06-CLOSED-INFO_annotated.png)
* [Capture ID: ADMIN-06-CLOSED-INFO] Admin 종료 케이스 상세 및 파트너 만족도 별점 표시 카드

---

# G. 자주 묻는 질문 및 예외 처리 (FAQ & Troubleshooting)

### Q1. 파트너가 [조치 완료]를 제출했는데 왜 바로 종료(CLOSED)되지 않고 검토중(UNDER_REVIEW)이 되나요?
> **답변**: 조치 완료 제출은 파트너사가 요청받은 보완 작성을 마쳤음을 의미할 뿐 케이스 종결을 뜻하지 않습니다. 제출된 조치 내용과 첨부 서류를 어드민 담당자가 최종 재검토한 후 이상이 없을 때 명시적으로 종료 처리하는 것이 정상적인 프로세스입니다.

### Q2. 종료(CLOSED)된 케이스에는 왜 재오픈(Reopen) 버튼이 없나요?
> **답변**: K SELECT Support Case 시스템은 CLOSED를 최종 불변 상태(Final Status)로 처리합니다. 레거시 Reopen 방식은 처리 기간 측정(SLA) 및 이력 추적을 혼란스럽게 만듭니다. 추가 문의는 [후속 문의하기]를 통해 새 케이스로 발행하며 이전 케이스 번호와 자동으로 상호 연결됩니다.

### Q3. Conversation 탭과 Case Log 탭의 차이는 무엇인가요?
> **답변**: **Conversation 탭**은 사람과 사람이 나눈 실질적인 커뮤니케이션 텍스트 메시지 및 파일 첨부만을 보여주는 공간입니다 (어드민의 조치 요청 문장 포함). 반면 **Case Log 탭**은 문의 접수, 상태 변경, 담당자 지정, 종료, 만족도 평가 등 시스템 수준의 감사 이력(Audit Trail)만을 기록하는 공간입니다.

### Q4. 파트너 만족도 평가(Rating)는 언제 작성할 수 있나요?
> **답변**: 만족도 평가는 케이스가 명시적인 종료 액션에 의해 `CLOSED` 상태가 된 이후에만 작성 및 수정이 가능합니다. 케이스가 진행 중인 상태(`RECEIVED`, `UNDER_REVIEW`, `ACTION_REQUIRED`)에서는 만족도 평가가 활성화되지 않습니다.

### Q5. 후속 문의(Follow-up Case)는 어떤 경우에 사용해야 하나요?
> **답변**: 이미 종료(CLOSED)된 케이스 건과 관련하여 추가 서류를 제출해야 하거나, 동일 이슈에 대해 연관 질문이 발생한 경우 사용합니다. 클릭 시 이전 케이스 정보가 자동으로 연동되어 신규 케이스로 생성됩니다.
