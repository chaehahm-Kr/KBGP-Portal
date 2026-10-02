# MAN-B-PERM-001: Permissions & Architecture Diagrams
## Permissions & User Management (사용자, 역할 및 권한 관리)

---

## 1. 5-Layer Access Control & Security Model

```mermaid
flowchart TD
    A["1. 사용자 인증 (Authentication)<br/>- Supabase Auth 이메일/비밀번호 검증"] --> B["2. 애플리케이션 프로필 (Application Profile)<br/>- 파티션 확인 (role: 'portal')"]
    B --> C["3. 회사 소속 멤버십 (Company Membership)<br/>- 단일 회사 1:1 바인딩 (company_id)<br/>- 활성 상태 검증 (status: 'active')"]
    C --> D["4. 역할 프리셋 및 세부 ACL (Role & ACL Matrix)<br/>- 5가지 프리셋 및 9개 업무 영역 4단계 권한"]
    D --> E["5. 데이터베이스 행 레벨 보안 (PostgreSQL RLS)<br/>- DB 커널 레벨에서 본인 회사 데이터만 격리 조회"]
```

---

## 2. End-to-End User Invitation & Onboarding Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 회사 관리자 (Company Admin)
    participant Portal as /portal/company/users
    participant Actions as 서버 액션 (inviteCompanyUser)
    participant DB as Supabase DB
    participant Mail as 이메일 발송 (Resend)
    actor Invitee as 초대받은 팀원 (Invitee)

    Admin->>Portal: 신규 팀원 정보 입력 (영문 성명, 이메일, 역할 프리셋 선택)
    Admin->>Portal: '초대하기' 클릭
    Portal->>Actions: 초대 실행 및 이메일 중복 검증
    Actions->>DB: INSERT company_users (status = 'invited', invited_at = now())
    Actions->>Mail: [K SELECT NETWORK] 공식 초대 이메일 발송
    Mail-->>Invitee: 초대 안내 메일 수신 (7일간 유효)
    
    Invitee->>Portal: 메일 내 링크 클릭 (/portal/invite/accept 접속)
    Invitee->>Portal: 8자 이상 보안 비밀번호 설정 및 제출
    Portal->>DB: UPDATE company_users (status = 'active', joined_at = now())
    Portal-->>Invitee: 정식 로그인 화면(/portal/login) 이동 및 가입 완료
```

---

## 3. 5 Role Presets vs 9-Category ACL Mapping

```mermaid
flowchart TD
    subgraph Presets ["5가지 역할 프리셋 (Role Presets)"]
        P1["접근 제한 (Restricted)<br/>모든 메뉴 접근불가"]
        P2["조회 사용자 (Viewer)<br/>일반 메뉴 조회전용 (기본값)"]
        P3["담당자 (Staff)<br/>실무 메뉴 생성/수정 가능"]
        P4["매니저 (Manager)<br/>실무 관리 및 정산 수정"]
        P5["관리자 (Admin)<br/>전 메뉴 최고 관리 권한"]
    end

    subgraph Matrix ["9개 업무 영역 ACL 매트릭스"]
        M1["입점 신청서 (application)"]
        M2["브랜드 관리 (brands)"]
        M3["제품 관리 (products)"]
        M4["주문 관리 (orders)"]
        M5["정산 / 인보이스 (finance)"]
        M6["문의 지원 (support)"]
        M7["회사 기본 정보 (company_info)"]
        M8["송금 계좌 정보 (bank_info)"]
        M9["계약 및 문서 (agreements)"]
    end

    P2 -->|Default Preset Matrix| Matrix
    P3 -->|Default Preset Matrix| Matrix
    P4 -->|Default Preset Matrix| Matrix
    P5 -->|Default Preset Matrix| Matrix

    Matrix -->|Custom Override| Final["최종 유효 권한 (Effective Permissions)<br/>permissions JSONB 저장"]
```

---

## 4. Task Assignment vs ACL Permission Separation

```mermaid
flowchart LR
    subgraph ACL ["메뉴 접근 권한 (ACL Matrix)"]
        A1["포털 메뉴 노출 여부 (사이드바)"]
        A2["데이터 조회/수정/삭제 실행 권한"]
        A3["Server Action 접근 통제"]
    end

    subgraph Tasks ["6대 담당 업무 배정 (Task Assignments)"]
        T1["K SELECT 운영팀 실무 소통 책임자 지정"]
        T2["업무별 주 담당자 1명 지정 (Primary Contact)"]
        T3["업무 관련 시스템 이메일 알림 수신 라우팅"]
    end

    ACL -.->|독립적으로 동작| Tasks
```

---

## 5. Member Removal & Account Safety Protections

```mermaid
flowchart TD
    A["관리자가 '멤버 제거' 클릭"] --> B{"본인 계정인가?"}
    B -->|Yes| C["차단: 본인 계정 직접 삭제 불가"]
    B -->|No| D{"최초 관리자(Initial Owner)인가?"}
    
    D -->|Yes| E["차단: 최초 관리자 계정 삭제 불가"]
    D -->|No| F{"회사에 남은 유일한 관리자인가?"}
    
    F -->|Yes| G["차단: 최소 1명의 관리자 유지 필수"]
    F -->|No| H["멤버십 해제 진행"]
    
    H --> I["company_users 레코드 삭제 및 세션 무효화"]
    H --> J["회사 비즈니스 데이터는 멤버십과 별도로 유지"]
```

---
*End of PERMISSIONS_ARCHITECTURE_DIAGRAMS.md*
