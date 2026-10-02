# MAN-B-TASK-001: Task & Communication Guide
## 업무 할 일, 1:1 케이스 소통 및 운영 조율 매뉴얼

- **문서 ID:** `MAN-B-TASK-001`
- **적용 대상:** K SELECT Brand Portal 사용자 (회사 관리자, 운영 실무자, 권한 보유 담당자)
- **최종 검증일:** 2026-10-02
- **버전:** 1.0 (Production Verified)

---

## 1. 시스템 개요 및 핵심 원칙 (System Overview & Principles)

### 1.1 K SELECT 업무 소통의 기본 철학
K SELECT 플랫폼의 **Task & Communication(지원 센터 / 1:1 문의)** 시스템은 **브랜드 포털 내 공식 지원 문의, 변경 요청 및 관련 커뮤니케이션**을 투명하고 추적 가능하게 관리하는 공식 소통 허브입니다.

파편화되기 쉬운 외부 메신저나 개별 이메일 대신, 공식 지원 및 변경 요청을 단일 케이스 티켓 단위로 구조화하여 이력 보존과 정확한 역할 기반 협업을 지원합니다.

### 1.2 핵심 아키텍처 경계: 6대 업무 라우팅 vs 1:1 케이스 소통
K SELECT 시스템에는 업무(Task)라는 명칭을 공유하지만 목적과 생명주기가 명확히 분리된 두 가지 구조가 존재합니다:

1. **회사 단위 6대 업무 주 담당자 라우팅 (`MAN-B-PERM-001` 관할)**:
   - `company_task_assignments` 테이블에 기반합니다.
   - 회사 내에서 각 업무 영역(`company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry`)별로 알림을 수신할 **단일 주 담당자(Primary Owner)**를 지정하는 정적 라우팅 설정입니다.
2. **동적 1:1 케이스 소통 시스템 (`MAN-B-TASK-001` 본 매뉴얼 관할)**:
   - `partner_inquiries` 및 `partner_inquiry_messages` 테이블에 기반합니다.
   - 특정 비즈니스 안건(발주 수량 변경, 정산 질의, 서류 보완 등)에 대해 티켓을 발행하고, 양방향 스레드 대화와 상태 전이를 거쳐 해결 및 종결(Close)하는 동적 케이스 라이프사이클입니다.

> [!NOTE]
> **어드민 내부 일감 스키마(`public.tasks`)와의 경계 (System Gap Note)**:
> 데이터베이스 내 `public.tasks` 및 `/admin/tasks`는 초기 어드민 내부 업무 모니터링 목적으로 설계된 독립 스키마(현재 목업 데이터 기반)이며, 브랜드 포털의 `partner_inquiries`와는 상호 종속성이나 자동 트리거가 연결되어 있지 않습니다. 브랜드사의 모든 공식 지원 요청과 소통은 `partner_inquiries` 기반의 지원 센터를 통해 전담 처리됩니다.

---

## 2. 지원 센터 메인 허브 및 인터페이스 구성 (Support Hub UI)

브랜드 포털 좌측 내비게이션 메뉴의 **[지원 센터]** (`/portal/support`)를 클릭하면 회사 전용 문의 관리 허브로 이동합니다.

![지원 센터 메인 허브 및 케이스 목록](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-001.png)

### 2.1 주요 UI 영역 구성
1. **상단 액션 바**:
   - 신규 문의 작성을 위한 `[+ 새 문의 작성]` 버튼이 배치되어 있습니다 (`support:write` 권한 필요).
2. **4대 공식 상태 필터 탭**:
   - `전체`, `접수됨(RECEIVED)`, `검토중(UNDER_REVIEW)`, `조치필요(ACTION_REQUIRED)`, `종료됨(CLOSED)` 탭을 통해 진행 단계별로 필터링할 수 있습니다.
3. **케이스 목록 카드**:
   - 각 카드는 **케이스 식별 번호** (예: `CASE-2026-0001`), **문의 카테고리 태그**, **제목**, **최종 업데이트 일시**, **상태 배지**를 직관적으로 제공합니다.
4. **조치 필요 강조 표시**:
   - 운영팀의 추가 회신이나 자료 제출이 요구된 케이스는 붉은색(`ACTION_REQUIRED`) 배지와 알림 하이라이트로 최우선 식별됩니다.

---

## 3. 신규 문의 등록 및 9대 카테고리 분류 (New Inquiry & Categories)

### 3.1 신규 문의 작성 절차
`[+ 새 문의 작성]` 버튼을 클릭하면 문의 등록 모달이 활성화됩니다.

![새 1:1 문의 등록 모달](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-002.png)

1. **문의 분류(Category) 선택**: 문의 목적에 부합하는 카테고리를 9대 분류 중에서 선택합니다.
2. **제목(Title) 입력**: 핵심 안건을 명확히 요약하여 입력합니다 (최대 200자).
3. **상세 내용(Content) 작성**: 구체적인 배경, 발생 일시, 요청 사항을 상세히 기술합니다.
4. **첨부파일(Attachment) 등록**: 증빙 자료, 오류 캡처, 서류 사본을 업로드합니다.
5. **[문의 등록하기] 제출**: 검증 후 서버 액션을 통해 케이스가 생성되고 `RECEIVED (접수됨)` 상태로 등록됩니다.

### 3.2 9대 표준 카테고리 정의

| 카테고리 코드 | 한글 명칭 | 영문 명칭 | 주요 활용 시나리오 및 연계 도메인 |
| :--- | :--- | :--- | :--- |
| `po_change` | **PO 변경 요청** | PO Change Request | 발주 수량, 단가, 출고 예정일, 배송지 변경 (발주 상세 연계) |
| `agreement_change` | **계약 변경 및 서명** | Agreement Change Request | 기본 공급 계약서 조항 수정 요청, 서명 권한자 변경 질의 |
| `product` | **제품 등록 및 정보수정** | Product Registration | 바코드 수정, 전성분 변경, 카테고리 분류 재조정 요청 |
| `onboarding` | **입점 신청 및 심사** | Onboarding Review | 입점 심사 추가 소명 자료 제출, 브랜드 승인 진행 문의 |
| `logistics` | **물류 공급 및 패키징** | Logistics & Packaging | 카톤 라벨 규격, CBM 측정 기준, 선적항 조율 질의 |
| `translation` | **번역 및 전성분표** | Translation & Ingredients | 미국 FDA 라벨링 규정, 성분 영문 번역 검수 요청 |
| `settlement` | **정산 / 인보이스 문의** | Settlement / Invoice | 정산 지급일, 매입전표(AP) 대조, 세금계산서 발행 확인 |
| `system` | **시스템 오류 및 제안** | System & Tech Support | 포털 기능 오동작 제보, 계정 권한 변경 지원 요청 |
| `general` | **기타 일반 문의** | General Inquiry | 기타 제휴 및 일반 운영 관련 문의 |

---

## 4. 양방향 대화 스레드 및 상태 라이프사이클 (Threaded Discussion & Status)

### 4.1 스레드 기반 메시지 타임라인
케이스를 클릭하면 우측에 전체 대화 및 이벤트 타임라인이 펼쳐집니다.

![양방향 대화 스레드 상세 뷰](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-003.png)

- **브랜드사 메시지**: 작성자 성명과 함께 파란색/우측 정렬로 표시됩니다.
- **K SELECT 운영팀 메시지**: 공식 운영팀 배지와 함께 좌측 정렬로 렌더링됩니다.
- **시스템 이벤트 로그**: 상태 전이, 조치 요청, 종결, 만족도 평가 등의 이력이 타임라인 상에 시간순으로 삽입됩니다.

### 4.2 4대 공식 표시 상태와 내부 DB 상태 매핑

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          CASE STATUS LIFECYCLE                                   │
├───────────────┬─────────────────────────────────────────────────┬────────────────┤
│ 1. RECEIVED   │ 2. UNDER_REVIEW                                 │ 4. CLOSED      │
│ (접수됨)      │ (검토중)                                        │ (종료됨)       │
│ • open        │ • in_review, replied, processing, under_review, │ • closed       │
│ • pending     │   action_resolved, awaiting_reply, reopened     │ • resolved     │
│               ├─────────────────────────────────────────────────┤                │
│               │ 3. ACTION_REQUIRED (조치필요)                   │                │
│               │ • action_required (브랜드사 보완 조치 대기)     │                │
└───────────────┴─────────────────────────────────────────────────┴────────────────┘
```

1. **`RECEIVED` (접수됨)**: 문의가 신규 접수되어 운영팀의 최초 배정을 대기 중인 상태입니다.
2. **`UNDER_REVIEW` (검토중)**: 담당 심사관이 배정되어 내용을 검토 중이거나 답변을 교환 중인 상태입니다.
3. **`ACTION_REQUIRED` (조치필요)**: 운영팀에서 추가 증빙이나 서류 수정을 요구한 상태입니다.
4. **`CLOSED` (종료됨)**: 안건 처리가 완료되어 케이스가 공식 종결된 상태입니다.

---

## 5. 조치 필요(Action Required) 대응 및 케이스 종결 (Actions & Resolution)

### 5.1 조치 필요(Action Required) 대응 절차
운영팀에서 서류 보완이나 확인을 요청하면 상단에 붉은색 알림 배너가 표시됩니다.

![조치 필요 배너 및 보완 회신 폼](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-004.png)

1. **요구 사항 확인**: 운영팀 메시지 내 `⚠️ 조치요청` 플래그와 안내 문구를 확인합니다.
2. **보완 파일 첨부**: 요청된 정정 서류나 사진을 업로드합니다.
3. **보완 답변 전송**: 조치 완료 코멘트를 작성하고 회신을 제출합니다.
4. **자동 상태 전이**: 보완 메시지가 등록되면 케이스 상태는 즉시 `UNDER_REVIEW (검토중)`으로 전환되어 운영팀 재검토 단계로 넘어갑니다.

### 5.2 케이스 종결 및 5점 만족도 평가 (CSAT)
안건 처리가 완료되면 브랜드사 관리자(`support:manage`) 또는 K SELECT 운영팀이 케이스를 종결할 수 있습니다.

![케이스 종결 및 만족도 평가](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-005.png)

- **케이스 종결 (`closeCase`)**: 케이스가 `CLOSED (종료됨)` 처리되며 타임라인에 종결 일시와 종결 주체가 기록됩니다.
- **만족도 평가 (`submitSatisfactionRating`)**:
  - 종결된 케이스 하단에 1~5점 별점 평가 컴포넌트가 활성화됩니다.
  - 별점과 함께 건의 사항을 제출하면 품질 관리를 위한 CSAT 데이터로 보존됩니다.

---

## 6. 교차 도메인 연계 및 딥링크 유입 (Cross-Domain Deep Linking)

브랜드 포털의 다른 업무 메뉴에서 특정 데이터를 확인하다가 즉시 지원 센터로 문의를 인입할 수 있는 딥링크가 제공됩니다.

### 6.1 발주(PO) 상세 연계 문의
발주 관리 화면(`/portal/orders/[id]`)에서 `[발주 문의/변경 요청]`을 클릭하면 발주 번호와 외래키(`related_po_id`)가 사전 바인딩된 모달이 실행됩니다.

![PO 변경 요청 딥링크 사전 입력](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-006.png)

- **URL 파라미터**: `/portal/support?new=1&category=po_change&po_id=...&po_no=PO-2026-0008`
- **데이터베이스 연계**: `partner_inquiries.related_po_id`에 실제 `purchase_orders.id` 외래키가 기록되어 운영팀 콘솔에서도 해당 발주서와 직결됩니다.

### 6.2 정산 및 계약 연계 문의 (Context Prefill)
정산 내역(`/portal/settlement`)이나 계약서 관리(`/portal/agreements`) 화면에서도 동일하게 사전 컨텍스트가 주입된 문의 창이 실행됩니다.

![정산 문의 딥링크 사전 입력](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-007.png)

- **URL 파라미터**: `/portal/support?new=1&category=settlement&ap_no=AP-2026-0012`
- **동작 방식 (Context Prefill vs DB FK)**:
  - 발주 문의(`po_change`)는 DB 레벨의 실제 외래키(`related_po_id`)를 연결합니다.
  - 반면 정산(`settlement`) 및 계약(`agreement_change`) 문의는 DB 외래키 대신 **문맥 사전 입력(Context Prefill)** 방식으로 제목과 본문에 매입전표 번호(AP No.) 또는 계약 식별자를 자동 삽입하여 신속한 상담을 지원합니다.

---

## 7. 권한 제어, 보안 및 알림 수신 체계 (ACL, Security & Notifications)

### 7.1 인앱 알림 및 이메일 수신 메커니즘
새로운 메시지나 조치 요청이 도착하면 헤더 알림 벨 아이콘에 실시간 배지가 표시됩니다.

![헤더 인앱 알림 피드](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-008.png)

- **6대 표준 인앱 알림 이벤트 (`notifications`)**:
  1. **New Inquiry (신규 문의 접수)**: 문의 생성 시 회사 계정 및 운영팀에 접수 알림 전달.
  2. **Admin Reply (운영팀 답변 등록)**: 운영팀 메시지 등록 시 브랜드 담당자에게 알림 생성.
  3. **Action Required (조치 요청)**: 서류 보완이나 긴급 확인 필요 시 상단 배너와 함께 생성.
  4. **Action Resolved (조치 회신 완료)**: 브랜드사가 보완 회신 제출 시 운영팀에 전달.
  5. **Case Closed (케이스 공식 종결)**: 문의 종결 시 최종 처리 결과 알림.
  6. **CSAT Submission (만족도 평가 완료)**: 5점 만족도 평가 제출 이력 기록.
  - 각 사용자별 읽음 여부는 `company_users.permissions.read_notification_ids`에 독립적으로 저장되어 다중 담당자 협업 시 읽음 상태를 개별 관리합니다.

- **조건부 트랜잭션 이메일 발송 규칙 (Conditional Email)**:
  - 일상적인 메시지 교환에는 이메일이 발송되지 않습니다.
  - **운영팀의 긴급 조치 요청(`isActionRequired=true` 및 이메일 발송 옵션 활성화 시)** 또는 **어드민 신규 케이스 생성 시 이메일 옵션 선택 시**에만 제한적으로 발송되어 알림 피로도를 최소화합니다.

### 7.2 파일 첨부 보안 및 스토리지 규격
- **스토리지 버킷**: 격리된 Private 버킷인 `"company-uploads"`를 사용합니다.
- **저장 경로**: `${company_id}/inquiries/${uuid}.${ext}` 구조로 회사별 디렉토리가 분리됩니다.
- **크기 및 형식 제한**: 파일당 최대 **20MB**까지 업로드 가능하며, 이미지(`PNG`, `JPEG`, `WEBP`) 및 문서(`PDF`) 형식을 지원합니다.
- **다운로드 보안**: 공용 URL 대신 시간 제한이 적용된 서명 URL(Signed URL)을 통해서만 다운로드가 허용됩니다.

### 7.3 역할별 ACL 권한 통제

| 포털 권한 레벨 | 열람 (Read) | 문의 등록 및 답변 (Write) | 케이스 종결 (Manage) | 대표 UI 동작 |
| :--- | :---: | :---: | :---: | :--- |
| **`support:none (0)`** | ❌ | ❌ | ❌ | 접근 차단 (`AccessDeniedView` 표시) |
| **`support:read (1)`** | ✅ | ❌ | ❌ | 읽기 전용 (신규 작성 버튼 미노출, 입력창 비활성화) |
| **`support:write (2)`** | ✅ | ✅ | ❌ | 문의 등록, 대화 회신, 보완 서류 제출 가능 |
| **`support:manage (3)`** | ✅ | ✅ | ✅ | 모든 작성 기능 + 케이스 직접 종결(`closeCase`) 권한 |

![뷰어 역할 읽기 전용 모드](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-009.png)

![권한 없음 접근 차단 화면](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-010.png)

---

## 8. 부록: 어드민 운영 콘솔 연계 (Admin Console Reference)

운영팀 관리자는 어드민 콘솔(`/admin/partner-inquiries`)을 통해 브랜드사가 제출한 공식 케이스를 통합 모니터링하고 담당 심사관 배정, 조치 요청 발송, 종결 처리를 수행합니다.

![어드민 파트너 문의 관리 콘솔](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-011.png)

> [!NOTE]
> **어드민 내부 일감 콘솔(`/admin/tasks`) 참고**:  
> 어드민 내 `/admin/tasks` 화면은 초기 내부 작업 모니터링용 독립 화면(현재 목업 데이터 기반)이며, 브랜드 포털의 공식 1:1 소통 워크플로우와는 직접 연계되지 않습니다. 브랜드사의 모든 실무 지원은 `/admin/partner-inquiries`를 통해 이루어집니다.

![어드민 내부 일감 콘솔](file:///c:/Users/ChaeHahm/OneDrive%20-%20Letusto%20Inc/Developement/Claude_Dev/KSelectNetwork-Portal/Manuals/MAN-B-TASK-001_Task-Communication/02_CLAUDE_PACKAGE/02_SCREENSHOTS/SCR-B-TASK-012.png)

---
*End of MAN-B-TASK-001_Manual_Content.md*
