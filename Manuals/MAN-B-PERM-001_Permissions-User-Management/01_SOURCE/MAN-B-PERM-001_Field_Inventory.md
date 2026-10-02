# MAN-B-PERM-001: Comprehensive Field & UI Inventory
## Permissions & User Management (사용자, 역할 및 권한 관리)

**Manual ID:** `MAN-B-PERM-001`  
**Topic:** Field Inventory for User Management, ACL Matrix, Task Assignments & My Account  
**Phase:** `01_SOURCE — FINAL SOURCE INTEGRITY REVIEW (R1)`  
**Authoritative Reference:** Live UI Components, Server Actions & PostgreSQL Database Schema

---

## 1. Member List Dashboard (`/portal/company/users`)

### Main Table Columns
| Screen Column Header | UI Element Type | Internal Field Key | DB Column Mapping | Role / ACL Access | Notes & Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **이름** | Text + Badges | `name`, `displayName` | `company_users.name`, `profiles.display_name` | `company_admin` only | 한글 성명 또는 영문 성명. `[본인]`, `[최초 관리자]`, `[대표 담당자]` 뱃지 동시 노출. |
| **이메일 / 연락처** | Two-line Text | `email`, `phone` | `company_users.email`, `company_users.phone` | `company_admin` only | 로그인 이메일(모노스페이스) 및 국제 표준 전화번호(`📞`). |
| **직함 / 부서** | Two-line Text | `title`, `position` | `company_users.title`, `company_users.position` | `company_admin` only | 직함(예: 대표이사, 부장) 및 부서/포지션(예: 해외영업팀). |
| **역할** | Color-coded Badge | `rolePreset` | `company_users.permissions->preset`, `company_role` | `company_admin` only | 5가지 역할 뱃지 (`관리자`, `매니저`, `담당자`, `조회자`, `접근제한`). |
| **가입 상태** | Color-coded Badge | `joinStatus` | `company_users.status`, `invited_at` | `company_admin` only | `가입완료` (초록), `초대됨` (노랑), `초대만료` (빨강, >7일 경과). |
| **이용 상태** | Color-coded Badge | `usageStatus` | `company_users.status` | `company_admin` only | `정상이용` (초록), `대기중` (회색), `이용정지` (빨강, `suspended`). |
| **설정** | Action Buttons | `actions` | N/A | `company_admin` only | 상태별 액션 버튼 제공 (`내 계정 관리`, `재초대`, `초청 취소`, `수정`, `멤버 제거`). |

---

## 2. Invite New Member Modal (`InviteUserForm`)

| Section / Group | Field Label (UI) | Form Parameter | Data Type | Required | Editable | Validation Rule | Default Value | DB Mapping | Notes |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| **기본 정보** | 영문 성 (English Last Name) | `englishLastName` | String | ✅ | ✅ | 영문자(A-Z, a-z), 공백, 하이픈(-), 아포스트로피(')만 허용 | Empty | `company_users.permissions->english_last_name` | 필수 입력. 해외 바이어/리테일러 커뮤니케이션용. |
| **기본 정보** | 영문 이름 (English First Name) | `englishFirstName` | String | ✅ | ✅ | 영문자(A-Z, a-z), 공백, 하이픈(-), 아포스트로피(')만 허용 | Empty | `company_users.permissions->english_first_name` | 필수 입력. |
| **기본 정보** | 한글 성 (Korean Last Name) | `koreanLastName` | String | ❌ | ✅ | 한글 문자 | Empty | `company_users.permissions->korean_last_name` | 선택 입력. |
| **기본 정보** | 한글 이름 (Korean First Name) | `koreanFirstName` | String | ❌ | ✅ | 한글 문자 | Empty | `company_users.permissions->korean_first_name` | 선택 입력. |
| **기본 정보** | 이메일 (Login Email) | `email` | String (Email) | ✅ | ✅ | RFC 5322 이메일 규격 + 전사 중복 체크 | Empty | `company_users.email`, `auth.users.email` | 고유 계정 식별자. 초대 이메일 수신 주소. |
| **역할 설정** | 회사 내 역할 (Company Role) | `rawRolePreset` | Select / Preset | ✅ | ✅ | 5 Role Presets 중 선택 | `viewer` | `company_users.company_role`, `permissions->preset` | 역할 선택 시 오른쪽 ACL 매트릭스가 자동 세팅됨. |
| **권한 매트릭스** | 메뉴별 상세 권한 (ACL Matrix) | `permissionsJson` | JSON Object | ✅ | ✅ | 9개 카테고리별 4개 레벨 라디오 버튼 | Preset Default | `company_users.permissions` | 개별 카테고리 권한 오버라이드 지원. |

---

## 3. Edit Member Info, ACL & Tasks Modal (`CompanyUsersManager Edit Modal`)

| Section / Group | Field Label (UI) | Internal Key | Data Type | Required | Editable | Validation Rule | DB Mapping |
| :--- | :--- | :--- | :--- | :---: | :---: | :--- | :--- |
| **1. 기본 정보** | 한글 성 (Korean Last Name) | `formKoreanLastName` | String | ❌ | ✅ | 한글 문자 | `company_users.permissions->korean_last_name` |
| **1. 기본 정보** | 한글 이름 (Korean First Name) | `formKoreanFirstName` | String | ❌ | ✅ | 한글 문자 | `company_users.permissions->korean_first_name` |
| **1. 기본 정보** | 영문 성 (English Last Name) | `formEnglishLastName` | String | ❌ | ✅ | 영문자 규격 (`isPureEnglishName`) | `company_users.permissions->english_last_name` |
| **1. 기본 정보** | 영문 이름 (English First Name) | `formEnglishFirstName` | String | ❌ | ✅ | 영문자 규격 (`isPureEnglishName`) | `company_users.permissions->english_first_name` |
| **1. 기본 정보** | 이메일 (Login Email) | `formEmail` | String (Email) | ✅ | ✅ | 유효 이메일 규격, 타사 중복 불가 | `company_users.email`, `auth.users.email` |
| **1. 기본 정보** | 직함 (Job Title) | `formTitle` | String | ❌ | ✅ | 문자열 | `company_users.title` |
| **1. 기본 정보** | 포지션 / 부서 (Department) | `formPosition` | String | ❌ | ✅ | 문자열 | `company_users.position` |
| **1. 기본 정보** | 연락처 (Phone Number) | `formPhone` | String (E.164) | ❌ | ✅ | 국제 표준 전화번호 포맷 | `company_users.phone` |
| **1. 기본 정보** | 이용 제한 상태 | `formStatus` | Enum Select | ✅ | ✅ | `active` (정상 이용) vs `suspended` (이용 일시정지) | `company_users.status` |
| **1. 기본 정보** | 대표 담당자 지정 | `formIsPrimary` | Checkbox | ❌ | ✅ | Boolean (회사당 1명만 대표 지정 시 타사원 해제) | `company_users.is_primary` |
| **2. ACL 권한** | 역할 프리셋 선택 | `formRolePreset` | Select / Preset | ✅ | ✅ | 5가지 역할 프리셋 | `company_users.permissions->preset` |
| **2. ACL 권한** | 9개 카테고리 매트릭스 | `formPermissions` | Radio Grid | ✅ | ✅ | 9개 카테고리 $\times$ 4개 레벨 | `company_users.permissions` |
| **3. 담당 업무** | 6대 업무별 주 담당자 지정 | `formTaskAssignments[code].is_primary` | Checkbox | ❌ | ✅ | 업무당 주 담당자 1명 (중복 지정 시 컨펌 알럿) | `company_task_assignments.is_primary` |
| **3. 담당 업무** | 6대 업무별 이메일 알림 수신 | `formTaskAssignments[code].email_notify` | Checkbox | ❌ | ✅ | Boolean | `company_task_assignments.email_notify` |

---

## 4. Self-Service My Account Dashboard (`/portal/account`)

| Card / Group | Field Label (UI) | Key | Type | Editable | Notes & Security Boundaries |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **기본 프로필** | 한글 성 (Korean Last Name) | `koreanLastName` | Text | ✅ | 필수 입력. |
| **기본 프로필** | 한글 이름 (Korean First Name) | `koreanFirstName` | Text | ✅ | 필수 입력. |
| **기본 프로필** | 영문 성 (English Last Name) | `lastName` | Text | ✅ | 필수 입력. 영문자 검증 (`validateEnglishName`). |
| **기본 프로필** | 영문 이름 (English First Name) | `firstName` | Text | ✅ | 필수 입력. 영문자 검증 (`validateEnglishName`). |
| **기본 프로필** | 로그인 이메일 (Email) | `email` | Text | ❌ (Read Only) | 본인 계정 화면에서는 이메일 변경 불가 (관리자 화면에서만 변경 가능). |
| **기본 프로필** | 직함 (Job Title) | `title` | Text | ✅ | 필수 입력. |
| **기본 프로필** | 부서 / 포지션 (Department) | `position` | Text | ✅ | 선택 입력. |
| **기본 프로필** | 연락처 (Phone Number) | `phone` | Text | ✅ | 필수 입력. 국제 전화번호 컴포넌트 연동. |
| **소속 및 권한** | 소속 회사명 | `companyName` | Text | ❌ (Read Only) | `companies.name` 연동. |
| **소속 및 권한** | 부여된 역할 | `companyRole` | Badge | ❌ (Read Only) | 본인이 스스로 권한을 상향할 수 없음. |
| **보안 비밀번호** | 현재 비밀번호 | `currentPassword` | Password | ✅ | 본인 재인증 (Re-Authentication). |
| **보안 비밀번호** | 새 비밀번호 | `newPassword` | Password | ✅ | 8자 이상, 대소문자, 숫자, 특수문자 조합 필수. |
| **보안 비밀번호** | 새 비밀번호 확인 | `confirmPassword` | Password | ✅ | `newPassword`와 일치 검증. |

---

## 5. Database Schema & Tables Data Dictionary

### Table: `public.company_users`
| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, FK $\rightarrow$ `public.profiles(id)` ON DELETE CASCADE | None | User Unique UUID (1:1 with Auth User) |
| `company_id` | `uuid` | NOT NULL, FK $\rightarrow$ `public.companies(id)` ON DELETE CASCADE | None | Bound Company Context ID |
| `name` | `text` | NOT NULL | None | Full Canonical Korean/English Name |
| `english_name` | `text` | Nullable | None | Canonical Full English Name (`First Last`) |
| `email` | `text` | NOT NULL | None | Normalized Login Email (`lower(trim(email))`) |
| `company_role` | `text` | NOT NULL, CHECK in (`company_admin`, `company_staff`) | None | Relational DB Membership Role |
| `status` | `text` | NOT NULL, CHECK in (`invited`, `active`, `suspended`) | `'active'` | Lifecycle & Login Active Status |
| `invited_by` | `uuid` | Nullable, FK $\rightarrow$ `public.profiles(id)` | None | Inviting Admin User ID |
| `invited_at` | `timestamptz`| Nullable | None | Invitation Timestamp (Used for 7-day expiration) |
| `joined_at` | `timestamptz` | Nullable | None | Password Setup & Activation Timestamp |
| `title` | `text` | Nullable | None | Job Title (대표, 이사, 매니저 등) |
| `position` | `text` | Nullable | None | Department / Position (해외영업팀 등) |
| `phone` | `text` | Nullable | None | Contact Phone Number (E.164 format) |
| `is_primary` | `boolean` | NOT NULL | `false` | Primary Company Contact Point Flag |
| `permissions` | `jsonb` | NOT NULL | `'{}'::jsonb` | Granular ACL Matrix, Presets & Structured Names |
| `created_at` | `timestamptz` | NOT NULL | `now()` | Record Creation Timestamp |

### Table: `public.company_task_assignments`
| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `company_id` | `uuid` | PK (1/3), FK $\rightarrow$ `public.companies(id)` | None | Company ID |
| `user_id` | `uuid` | PK (2/3), FK $\rightarrow$ `public.company_users(id)` | None | Assigned Team Member User ID |
| `task_code` | `text` | PK (3/3), CHECK in 6 task codes | None | 6 Official Operational Task Code |
| `is_primary` | `boolean` | NOT NULL | `false` | Primary Representative Flag (Unique per task per company) |
| `email_notify` | `boolean` | NOT NULL | `false` | Email Notification Receive Subscription |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Last Updated Timestamp |
| `updated_by` | `uuid` | Nullable, FK $\rightarrow$ `public.profiles(id)` | None | Modifier User ID |
| `updated_path` | `text` | NOT NULL, CHECK in (`portal`, `admin`) | None | Update Origin Channel |

---
*End of MAN-B-PERM-001 Field Inventory (R1)*
