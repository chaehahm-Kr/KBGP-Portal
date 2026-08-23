# Support Case 다이어그램 원고 (Diagram Source)

본 문서는 Support Case 시스템의 **전체 프로세스 흐름도(Overall Flow)** 및 **4대 공식 상태 전이도(State Transition Diagram)**에 대한 Mermaid 및 구조화 텍스트 원고입니다.

---

## 1. [Diagram 1] 전체 Support Case 워크플로우 (Overall Workflow Flowchart)

```mermaid
flowchart TD
    subgraph Portal["Brand Portal (파트너사)"]
        P1["1. 새 1:1 문의 등록"] --> P2["문의 제출 (RECEIVED)"]
        P6["4. 조치 완료 작성 및 검토 요청"] --> P7["검토 요청 제출 (UNDER_REVIEW)"]
        P8["5. 문의 종료"] --> P9["종료 확정 (CLOSED)"]
        P9 --> P10["만족도 평가 작성 (Rating)"]
        P9 --> P11["후속 문의 생성 (Follow-up Case)"]
    end

    subgraph Admin["Admin (어드민 운영팀)"]
        A1["2. 문의 검토 (UNDER_REVIEW)"]
        A2["3-A. 일반 답변 작성"]
        A3["3-B. ⚠️ 조치 요청 발송 (ACTION_REQUIRED)"]
        A4["3-C. 🔒 답변 등록 후 케이스 종료 (CLOSED)"]
        A5["3-D. 🔒 답변 없이 케이스 종료 (CLOSED)"]
    end

    P2 --> A1
    A1 --> A2
    A1 --> A3
    A1 --> A4
    A1 --> A5
    A3 --> P6
    P7 --> A1
    P11 --> P1
```

---

## 2. [Diagram 2] 4대 공식 상태 전이도 (Official State Transition Diagram)

```mermaid
stateDiagram-v2
    [*] --> RECEIVED : 파트너 신규 문의 작성

    RECEIVED --> UNDER_REVIEW : Admin 검토 시작 / 일반 답변
    RECEIVED --> ACTION_REQUIRED : Admin 조치 요청 발송

    UNDER_REVIEW --> ACTION_REQUIRED : Admin 추가 조치 요청
    ACTION_REQUIRED --> UNDER_REVIEW : 파트너 조치 완료 작성 제출

    UNDER_REVIEW --> CLOSED : Admin/Portal 명시적 종료
    ACTION_REQUIRED --> CLOSED : Admin/Portal 명시적 종료
    RECEIVED --> CLOSED : Admin/Portal 명시적 종료

    state CLOSED {
        [*] --> FinalStatus
        FinalStatus --> SatisfactionRating : 파트너 만족도 평가 작성/수정
        FinalStatus --> FollowUpCase : 후속 문의 생성 (previous_case_id 연동)
    }

    FollowUpCase --> RECEIVED : 새 케이스 발행 (#CASE-XXXX)
```
