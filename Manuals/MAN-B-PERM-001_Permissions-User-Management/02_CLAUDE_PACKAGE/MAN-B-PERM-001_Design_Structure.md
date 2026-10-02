# MAN-B-PERM-001: Design & Page Structure Specification
## Permissions & User Management (사용자, 역할 및 권한 관리)

---

## 1. Document Overview
- **Manual ID**: `MAN-B-PERM-001`
- **Manual Title**: Brand Portal Permissions & User Management Guide (사용자, 역할 및 권한 관리 가이드)
- **Target Audience**: Brand Company Owners, Administrators, and Operations Team Members
- **Visual Design Reference**: `MAN-B-BRAND-001_Brand-Policy_V1.pdf`
- **Estimated Length**: 6–8 Pages (A4 Portrait)

---

## 2. Chapter & Page Layout Plan

### Page 1: Cover Header & 1. 개요 및 5단계 권한 아키텍처
- **Header Banner**: K SELECT NETWORK Partner Portal Manual, ID `MAN-B-PERM-001`, Category `topic-company`.
- **Section 1.1: 개요 및 목적**:
  - 브랜드사 팀원의 초대, 권한 부여, 담당 업무 배정 및 안전한 멀티테넌트 데이터 격리 체계 소개.
- **Section 1.2: 5단계 권한 레이어 구조**:
  - 인증(Auth) $\rightarrow$ 소속(Membership) $\rightarrow$ 역할 프리셋(Preset) $\rightarrow$ 세부 권한(ACL) $\rightarrow$ 데이터 격리(RLS).
  - Diagram: `Membership / Role / ACL Relationship`.

### Page 2: 2. 소속 멤버 목록 및 상태 관리
- **Section 2.1: 멤버 목록 대시보드 (`/portal/company/users`)**:
  - Screenshot: `SCR-B-PERM-001.png` (대시보드 메인).
  - 식별 뱃지: `[본인]`, `[최초 관리자]`, `[대표 담당자]`.
  - 가입 상태(`가입완료`/`초대됨`/`초대만료`) 및 이용 상태(`정상이용`/`대기중`/`이용정지`) 설명.
- **Section 2.2: 모바일 환경 지원**:
  - Screenshot: `SCR-B-PERM-010.png` (모바일 반응형 뷰).

### Page 3: 3. 신규 멤버 초대 및 역할 프리셋 설정
- **Section 3.1: 신규 멤버 초대 (`/portal/company/users` Modal)**:
  - Screenshot: `SCR-B-PERM-002.png` (신규 멤버 초대 모달).
  - 영문 성명(필수) 및 한글 성명(선택), 이메일 중복 검증 규칙.
- **Section 3.2: 5대 역할 프리셋 (Role Presets)**:
  - `restricted` (접근 제한), `viewer` (조회 사용자, 기본값), `staff` (담당자), `manager` (매니저), `admin` (관리자).
  - DB 멤버십 역할(`company_admin` vs `company_staff`)과의 관계 설명.

### Page 4: 4. 메뉴별 상세 권한(ACL) 매트릭스 설정
- **Section 4.1: 9개 메뉴 카테고리 $\times$ 4단계 접근 권한 매트릭스**:
  - Screenshot: `SCR-B-PERM-003.png` (ACL 매트릭스 에디터).
  - 4단계 레벨: `none` (접근불가) / `read` (조회전용) / `write` (생성/수정) / `manage` (생성/수정/삭제).
  - 9개 카테고리: `application`, `brands`, `products`, `orders`, `finance`, `support`, `company_info`, `bank_info`, `agreements`.
  - 역할 프리셋 선택 후 개별 카테고리 오버라이드 커스텀 가이드.

### Page 5: 5. 멤버 정보 수정, 6대 업무 배정 및 멤버 제거
- **Section 5.1: 멤버 정보 수정 (`CompanyUsersManager Edit Modal`)**:
  - Screenshot: `SCR-B-PERM-004.png` (정보 및 권한 수정 모달).
  - 인적 사항, 직함, 연락처 및 이용 제한 상태 변경.
- **Section 5.2: 6대 공식 담당 업무 배정**:
  - Screenshot: `SCR-B-PERM-005.png` (담당 업무 배정 테이블).
  - `company_apply`, `contract`, `product_cert`, `pricing_quote`, `logistics_inventory`, `settlement_inquiry`.
  - 업무 배정과 권한(ACL)의 차이점 명시 (업무 배정 $\neq$ 권한).
- **Section 5.3: 멤버 제거 및 안전 보호 정책**:
  - Screenshot: `SCR-B-PERM-008.png` (멤버 제거 확인 모달).
  - 최초 관리자(Initial Owner) 보호, 마지막 관리자(Last Admin) 보호, 본인 삭제 차단 및 회사 데이터 보존.

### Page 6: 6. 초대 수락 및 본인 계정 관리 (My Account)
- **Section 6.1: 초대 수락 및 비밀번호 온보딩 (`/portal/invite/accept`)**:
  - Screenshot: `SCR-B-PERM-006.png` (초대 수락 및 비밀번호 설정).
  - 7일 유효기간, 비밀번호 복잡도 규칙 및 재초대/취소 관리.
- **Section 6.2: 내 계정 관리 (`/portal/account`)**:
  - Screenshot: `SCR-B-PERM-007.png` (My Account 대시보드).
  - 본인 프로필 수정 및 보안 비밀번호 재인증 변경.

### Page 7: 7. 어드민 지원 및 테넌트 데이터 보안 + 8. FAQ 7선
- **Section 7.1: 어드민 관리 및 테넌트 데이터 격리**:
  - Screenshot: `SCR-B-PERM-009.png` (어드민 회사 상세 — 사용자 관리 탭).
  - PostgreSQL RLS 기반 데이터 격리 및 Letusto 내부 직원 지원 세션(Impersonation 배너).
- **Section 7.2: 자주 묻는 질문 (FAQ 7선)**:
  - 7 Grounded Q&A items covering single-company binding, preset overrides, invitation expiration, task assignment meaning, owner protection, password resets, and session deactivation.

---
*End of MAN-B-PERM-001_Design_Structure.md*
