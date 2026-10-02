# MAN-B-PERM-001: Workflow & Architecture Diagrams
## Permissions & User Management (사용자, 역할 및 권한 관리)

**Manual ID:** `MAN-B-PERM-001`  
**Topic:** Verified Workflows for Identity, Invitation, ACL Enforcement & Multi-Tenant Security  
**Phase:** `01_SOURCE`  
**Authoritative Reference:** Production Middleware, DAL, Server Actions & PostgreSQL RLS Policies

---

## 1. Authentication to Company Context Resolution Flow

```mermaid
flowchart TD
    A["User Request with Session Cookie"] --> B["DAL: verifyPortalSession()"]
    B --> C{"auth.users valid & active?"}
    C -->|No / Expired| D["Redirect: /portal/login?reason=session_expired"]
    C -->|Yes| E["Query profiles where id = auth.uid()"]
    
    E --> F{"profiles.role === 'portal'?"}
    F -->|No (e.g. admin/retailer)| G["Redirect: /portal/login?reason=role_mismatch"]
    F -->|Yes| H["DAL: requireCompanyMembership()"]
    
    H --> I["Query company_users where id = user.id"]
    I --> J{"company_users status === 'active'?"}
    J -->|No (invited or suspended)| K["Redirect: /portal/login?reason=membership_inactive"]
    J -->|Yes| L["Establish CompanyMembership Context<br/>- userId<br/>- companyId<br/>- companyRole ('company_admin' | 'company_staff')"]
    
    L --> M["getPortalUserAcl()<br/>- Read company_users.permissions JSONB<br/>- normalizePermissions() across 9 Categories"]
    M --> N["Render PortalLayout & Filter Navigation Items"]
```

---

## 2. End-to-End User Invitation Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Company Admin
    participant Portal as /portal/company/users
    participant Actions as lib/company/invite-actions.ts
    participant DB as PostgreSQL DB
    participant Auth as Supabase Auth Admin
    participant Mail as Resend Email Service
    actor Invitee as Invited Team Member

    Admin->>Portal: 신규 멤버 정보 입력 (영문 성명, 이메일, 역할 프리셋 & ACL 설정)
    Admin->>Portal: '초대하기' 클릭
    Portal->>Actions: inviteCompanyUser(formData)
    Actions->>Actions: requireCompanyAdmin() 권한 검증
    Actions->>Actions: checkUserEmailDuplicate(email, companyId)
    
    alt 이메일 중복 (동일 회사 또는 타사)
        Actions-->>Portal: 에러 반환 (초대 중단)
    else 유효한 신규 이메일
        Actions->>Auth: generateLink({ type: 'invite', redirectTo: '/portal/invite/accept' })
        Auth-->>Actions: actionLink & invitedUserId 발급
        Actions->>DB: INSERT INTO company_users (status = 'invited', invited_at = now(), permissions)
        Actions->>Mail: sendEmail(custom branded K SELECT HTML template)
        Mail-->>Invitee: [K SELECT NETWORK] 브랜드 포털 초대 안내 이메일 발송
        Actions-->>Portal: 성공 메시지 반환 및 목록에 '초대됨' 상태로 갱신
    end
```

---

## 3. Invitation Acceptance & Password Onboarding Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Invitee as Invited Team Member
    participant Browser as Invitee Browser
    participant AcceptPage as /portal/invite/accept
    participant Supabase as Supabase Client
    participant Actions as completeInviteAcceptance()
    participant DB as PostgreSQL DB

    Invitee->>Browser: 이메일 내 '초대 수락 및 비밀번호 설정' 버튼 클릭
    Browser->>AcceptPage: 토큰 매개변수와 함께 접속
    AcceptPage->>AcceptPage: 7일 유효기간 및 토큰 검증
    
    alt 토큰 만료 또는 기 수락된 링크
        AcceptPage-->>Invitee: '초청 링크가 만료되었거나 유효하지 않습니다' 안내
    else 유효한 초대 세션
        AcceptPage-->>Invitee: 비밀번호 설정 폼 노출 (8자 이상 영문 대소문자/숫자/특수문자)
        Invitee->>AcceptPage: 신규 비밀번호 입력 및 제출
        AcceptPage->>Supabase: auth.updateUser({ password })
        AcceptPage->>Actions: completeInviteAcceptance() 실행
        Actions->>DB: UPDATE company_users SET status = 'active', joined_at = now()
        Actions->>Supabase: auth.signOut() (보안을 위한 임시 세션 종료)
        Actions-->>Browser: /portal/login?reason=invited_activated 로 리디렉션
        Browser-->>Invitee: 가입 완료 안내 및 정식 로그인 화면 표시
    end
```

---

## 4. 5-Role Preset & Granular ACL Evaluation Flow

```mermaid
flowchart TD
    A["Company Admin Selects Role Preset"] --> B{"Selected Preset"}
    
    B -->|Restricted| C["ROLE_PRESETS.restricted<br/>All 9 Categories = 'none'"]
    B -->|Viewer (Default)| D["ROLE_PRESETS.viewer<br/>7 Operational = 'read', 2 Sensitive = 'none'"]
    B -->|Staff| E["ROLE_PRESETS.staff<br/>5 Operational = 'write', 2 Info = 'read', 2 Sensitive = 'none'"]
    B -->|Manager| F["ROLE_PRESETS.manager<br/>Products/Orders/Support = 'manage', Finance/Info = 'write', 2 Sensitive = 'read'"]
    B -->|Admin| G["ROLE_PRESETS.admin<br/>All 9 Categories = 'manage'"]
    
    C --> H["Individual Category Radio Override in ACL Matrix Editor"]
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I["Serialize to JSONB & Save in company_users.permissions"]
    I --> J["Runtime Resolution via normalizePermissions()"]
```

---

## 5. Server Action Authorization & Protected Execution Flow

```mermaid
flowchart TD
    A["Brand Portal User Triggers Server Action<br/>(e.g., createProduct, updatePORequest, submitApplication)"] --> B["requireCompanyMembership()"]
    B --> C{"User Active in Company?"}
    C -->|No| D["Throw Membership Inactive Error"]
    C -->|Yes| E["requirePortalPermission(category, requiredLevel)"]
    
    E --> F{"User's ACL Level >= Required Level?<br/>(none:0, read:1, write:2, manage:3)"}
    F -->|No| G["Throw Unauthorized Error:<br/>'이 작업을 수행할 권한이 없습니다.'"]
    F -->|Yes| H["Execute Business Action with Target company_id Context"]
    H --> I["PostgreSQL RLS Safety Check"]
    I --> J["Return Action Result to Client"]
```

---

## 6. PostgreSQL Row-Level Security (RLS) Multi-Tenant Architecture

```mermaid
flowchart TD
    subgraph ClientLayer ["Client & Portal Application Layer"]
        U1["Brand A User (company_id: AAA)"]
        U2["Brand B User (company_id: BBB)"]
        A1["Letusto Admin Staff (role: admin)"]
    end

    subgraph SecurityDefiner ["PostgreSQL Security Definer Functions"]
        F1["public.auth_company_id()<br/>Returns caller's company_id"]
        F2["public.auth_is_admin()<br/>Returns true if caller is Letusto Staff"]
    end

    subgraph DatabaseLayer ["PostgreSQL Database Tables with FORCE RLS"]
        T1[("companies")]
        T2[("company_users")]
        T3[("brands")]
        T4[("products")]
        T5[("applications")]
        T6[("purchase_orders")]
        T7[("supplier_invoices")]
        T8[("company_task_assignments")]
    end

    U1 -->|SQL Queries| SecurityDefiner
    U2 -->|SQL Queries| SecurityDefiner
    A1 -->|SQL Queries| SecurityDefiner

    SecurityDefiner -->|Policy: company_id = auth_company_id()| DatabaseLayer
    SecurityDefiner -->|Policy: auth_is_admin() = true| DatabaseLayer

    style T1 fill:#f9f9f9,stroke:#333,stroke-width:1px
    style T2 fill:#f9f9f9,stroke:#333,stroke-width:1px
    style T3 fill:#f9f9f9,stroke:#333,stroke-width:1px
    style T4 fill:#f9f9f9,stroke:#333,stroke-width:1px
    style T5 fill:#f9f9f9,stroke:#333,stroke-width:1px
```

---

## 7. Member Removal & Protected Admin Safety Flow

```mermaid
flowchart TD
    A["Company Admin Clicks '멤버 제거' (removeCompanyMember)"] --> B{"Is Target User Self?"}
    B -->|Yes| C["Block: 본인 계정은 직접 제거할 수 없습니다."]
    B -->|No| D{"Is Target User Initial Owner / Earliest Admin?"}
    
    D -->|Yes| E["Block: 최초 관리자(Owner) 계정은 회사에서 제거할 수 없습니다."]
    D -->|No| F{"Is Target User Company Admin?"}
    
    F -->|Yes| G{"Remaining Active Admins in Company <= 1?"}
    G -->|Yes| H["Block: 회사에는 최소 1명의 관리자가 필요합니다."]
    G -->|No| I["Proceed with Removal"]
    F -->|No (Staff)| I
    
    I --> J["Delete company_task_assignments for Target User"]
    J --> K["DELETE FROM company_users WHERE id = targetUserId"]
    K --> L["Deactivate Active Sessions & Revalidate Cache"]
    L --> M["Company Data Preserved Intact; User Access Revoked"]
```

---
*End of MAN-B-PERM-001 Workflow Map*
