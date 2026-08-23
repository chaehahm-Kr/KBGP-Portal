# K SELECT Support Case 운영 매뉴얼 아웃라인 (Manual Outline)

> **문서 목적**: 본 아웃라인 문서는 Claude Design 팀이 최종 매뉴얼 디자인 및 레이아웃 재가공 시 각 섹션의 목적과 매핑되는 캡처 자산 ID(Capture ID)를 한눈에 파악하고 조립할 수 있도록 구조화된 목차 가이드입니다.

---

## 목차 및 캡처 자산 매핑표

```text
1. 문서 개요 (Document Overview)
   ├── 1.1 문서 목적 및 적용 범위
   ├── 1.2 대상 독자 (Admin 담당자 / Portal 파트너 사용자)
   └── 1.3 매뉴얼 활용 방법

2. 시스템 개요 (System Overview)
   ├── 2.1 Support Case 시스템 개요
   ├── 2.2 Portal과 Admin의 역할 및 협업 모델
   └── 2.3 주요 핵심 개념 (문의 / 케이스 / 조치 필요 / 종료 / 후속 문의)

3. 4대 공식 상태 및 상태 전이 규칙 (Status & Transition Rules)
   ├── 3.1 4대 공식 상태 정의 (RECEIVED / UNDER_REVIEW / ACTION_REQUIRED / CLOSED)
   ├── 3.2 상태 전이 매트릭스 (State Transition Matrix)
   └── 3.3 [다이어그램] 전체 Support Case 워크플로우 및 상태 전이도

4. 핵심 운영 정책 (Operational Policies)
   ├── 4.1 CLOSED의 Final Status 원칙 (재오픈 금지)
   ├── 4.2 명시적 종료 액션 3가지 규칙
   ├── 4.3 파트너 조치 완료의 UNDER_REVIEW 전이 규칙
   ├── 4.4 대화 내용 (Conversation) vs 처리 기록 (Case Log) 역할 분리
   └── 4.5 후속 문의 (Follow-up Case) 연동 규칙

5. Brand Portal 사용자 매뉴얼 (Brand Portal Guide)
   ├── 5.1 문의 지원 메뉴 진입 및 목록 화면 구조
   │   └── [Capture ID: PORTAL-01-LIST]
   ├── 5.2 새 1:1 문의 작성 및 파일 첨부
   │   └── [Capture ID: PORTAL-02-NEW-MODAL]
   ├── 5.3 대화 내용 (Conversation) 탭 활용
   │   └── [Capture ID: PORTAL-03-CONVERSATION]
   ├── 5.4 처리 기록 (Case Log) 탭 활용
   │   └── [Capture ID: PORTAL-04-CASELOG]
   ├── 5.5 조치 필요 (ACTION_REQUIRED) 수신 시 대응 방법
   │   └── [Capture ID: PORTAL-05-ACTION-REQ-BANNER]
   ├── 5.6 조치 완료 작성 및 검토 요청 제출
   │   └── [Capture ID: PORTAL-06-RESOLVE-MODAL]
   ├── 5.7 문의 종료 처리 방법
   │   └── [Capture ID: PORTAL-07-CLOSE-MODAL]
   ├── 5.8 종료 케이스 만족도 평가 및 수정
   │   └── [Capture ID: PORTAL-08-RATING]
   └── 5.9 후속 문의 (Follow-up Case) 생성
       └── [Capture ID: PORTAL-09-FOLLOWUP]

6. Admin 운영자 매뉴얼 (Admin Operational Guide)
   ├── 6.1 Partner Inquiries 목록 및 4대 상태 필터 활용
   │   └── [Capture ID: ADMIN-01-LIST]
   ├── 6.2 케이스 상세 대화 내용 (Conversation) 및 조치 요청 확인
   │   └── [Capture ID: ADMIN-02-CONVERSATION]
   ├── 6.3 케이스 상세 처리 기록 (Case Log) 이력 확인
   │   └── [Capture ID: ADMIN-03-CASELOG]
   ├── 6.4 어드민 3-Action Group 답변 작성 및 종료
   │   └── [Capture ID: ADMIN-04-REPLY-FORM]
   ├── 6.5 조치 필요 포함 답변 등록 (ACTION_REQUIRED 지정)
   │   └── [Capture ID: ADMIN-05-ACTION-REQUIRED-TOGGLE]
   └── 6.6 종료 케이스 확인 및 파트너 만족도 별점 조회
       └── [Capture ID: ADMIN-06-CLOSED-INFO]

7. 자주 묻는 질문 및 예외 처리 (FAQ & Troubleshooting)
   ├── FAQ 1. 조치 완료를 누르면 왜 바로 종료되지 않고 검토중이 되나요?
   ├── FAQ 2. 종료된 케이스는 왜 재오픈(Reopen) 버튼이 없나요?
   ├── FAQ 3. Conversation 탭과 Case Log 탭의 차이는 무엇인가요?
   ├── FAQ 4. 만족도 평가는 언제 작성할 수 있나요?
   └── FAQ 5. 후속 문의는 어떤 경우에 사용하나요?
```
