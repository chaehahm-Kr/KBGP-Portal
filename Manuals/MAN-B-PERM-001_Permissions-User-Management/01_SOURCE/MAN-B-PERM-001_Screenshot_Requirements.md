# MAN-B-PERM-001: Production Screenshot Requirements
## Permissions & User Management (사용자, 역할 및 권한 관리)

**Manual ID:** `MAN-B-PERM-001`  
**Topic:** Production Screenshot Inventory & Annotation Requirements  
**Phase:** `01_SOURCE`  
**Target Manual Standard:** High-Resolution Crisp Desktop (1440×900) & Mobile (390×844) Visual Documentation

---

## 1. Screenshot Inventory & Priority Matrix

| Shot ID | Exact Route | Target Viewport | User Role | Priority | Target Screen & State | Manual Chapter |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `SCR-B-PERM-001` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P0 — CORE** | 소속 멤버 목록 대시보드 (사용자 목록, 역할 뱃지, 가입/이용 상태, 액션 버튼) | Chapter 2: 멤버 목록 및 상태 관리 |
| `SCR-B-PERM-002` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P0 — CORE** | 신규 멤버 초대 팝업 모달 (영문/한글 성명, 이메일, 5대 역할 프리셋) | Chapter 3: 신규 멤버 초대 및 역할 설정 |
| `SCR-B-PERM-003` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P0 — CORE** | 메뉴별 상세 권한 매트릭스 에디터 (9개 카테고리 $\times$ 4개 레벨 라디오 버튼) | Chapter 3: 메뉴별 상세 권한(ACL) 설정 |
| `SCR-B-PERM-004` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P0 — CORE** | 멤버 정보 및 권한 수정 모달 (기본 정보, ACL 매트릭스, 6대 담당 업무 배정) | Chapter 4: 멤버 정보 수정 및 권한 변경 |
| `SCR-B-PERM-005` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P1 — SUPPORTING** | 6대 담당 업무 및 이메일 알림 배정 테이블 (주 담당자 지정 및 이메일 수신 체크) | Chapter 4: 6대 공식 담당 업무 배정 |
| `SCR-B-PERM-006` | `/portal/invite/accept` | Desktop (1440×900) | Anonymous (Invitee) | **P0 — CORE** | 초대 수락 및 비밀번호 설정 화면 (KSN 로고, 비밀번호 복잡도 안내, 가입 완료) | Chapter 5: 초대 수락 및 계정 활성화 |
| `SCR-B-PERM-007` | `/portal/account` | Desktop (1440×900) | Any Portal User | **P0 — CORE** | 내 계정 (My Account) 관리 화면 (프로필 수정 및 보안 비밀번호 변경) | Chapter 6: 본인 계정 및 비밀번호 관리 |
| `SCR-B-PERM-008` | `/portal/company/users` | Desktop (1440×900) | `company_admin` | **P1 — SUPPORTING** | 멤버 제거 확인 모달 (데이터 보존 안내 및 소속 멤버십 해제 경고) | Chapter 4: 멤버 제거 및 안전 정책 |
| `SCR-B-PERM-009` | `/admin/companies/[id]` | Desktop (1440×900) | Letusto Admin | **P1 — SUPPORTING** | K SELECT 어드민 회사 상세 — 소속 사용자 및 권한 관리 탭 | Chapter 7: 어드민 관리 및 테넌트 보안 |
| `SCR-B-PERM-010` | `/portal/company/users` | Mobile (390×844) | `company_admin` | **P2 — OPTIONAL** | 모바일 반응형 사용자 관리 목록 화면 | Chapter 2: 모바일 환경 지원 |

---

## 2. Detailed Annotation & Highlighting Plan

### `SCR-B-PERM-001`: 소속 멤버 목록 대시보드
- **Annotation 1 (Top Right Button)**: `[+ 사용자 초대하기]` — `company_admin` 전용 신규 멤버 초대 모달 호출 버튼.
- **Annotation 2 (Table Column 1)**: `[이름 & 식별 뱃지]` — 한글/영문 성명과 함께 `[본인]`, `[최초 관리자]`, `[대표 담당자]` 뱃지 표시.
- **Annotation 3 (Table Column 4)**: `[역할 뱃지]` — 컬러 코딩된 5가지 역할 (`관리자`, `매니저`, `담당자`, `조회자`, `접근제한`).
- **Annotation 4 (Table Columns 5 & 6)**: `[가입 상태 & 이용 상태]` — `가입완료`/`초대됨`/`초대만료` 및 `정상이용`/`대기중`/`이용정지` 뱃지.
- **Annotation 5 (Table Column 7)**: `[설정 액션]` — `재초대`, `초청 취소`, `수정`, `멤버 제거` 링크 버튼.

### `SCR-B-PERM-002`: 신규 멤버 초대 팝업 모달
- **Annotation 1 (English Names)**: `[영문 성 및 영문 이름 (필수)]` — 글로벌 바이어 및 리테일러 통신을 위한 필수 영문자 입력 필드.
- **Annotation 2 (Login Email)**: `[로그인 이메일 (필수)]` — 초대 메일이 수신될 고유 계정 주소.
- **Annotation 3 (Role Preset Selection Cards)**: `[5대 역할 템플릿]` — 클릭 시 기본 ACL 권한이 자동 동기화되는 프리셋 카드.

### `SCR-B-PERM-003`: 메뉴별 상세 권한(ACL) 매트릭스 에디터
- **Annotation 1 (9 Categories)**: `[9대 업무 영역]` — 입점신청, 브랜드, 제품, 주문, 정산, 문의, 회사정보, 계좌정보, 계약문서.
- **Annotation 2 (4 Radio Levels)**: `[4단계 접근 권한]` — `접근불가 (none)` / `조회전용 (read)` / `생성/수정 (write)` / `생성/수정/삭제 (manage)`.
- **Annotation 3 (Custom Override Notice)**: `[커스텀 권한 안내]` — 프리셋 선택 후 개별 카테고리를 자유롭게 오버라이드할 수 있음을 표시.

### `SCR-B-PERM-004`: 멤버 정보 및 권한 수정 모달
- **Annotation 1 (Section 1: Basic Info)**: `[인적 사항 및 연락처]` — 성명, 이메일, 직함, 부서, 국제 표준 연락처, 이용 제한 상태.
- **Annotation 2 (Section 2: ACL Matrix)**: `[권한 매트릭스]` — 실시간 권한 조정 영역.
- **Annotation 3 (Section 3: Task Assignments)**: `[담당 업무 및 알림 배정]` — 6대 업무별 주 담당자 및 이메일 수신 체크박스.

### `SCR-B-PERM-006`: 초대 수락 및 비밀번호 설정 화면
- **Annotation 1 (Branded Header)**: `[K SELECT NETWORK 로고]` — 신뢰할 수 있는 공식 온보딩 헤더.
- **Annotation 2 (Password Rules)**: `[보안 비밀번호 규칙]` — 8자 이상, 대소문자, 숫자, 특수문자 조합 필수 조건.
- **Annotation 3 (Submit CTA)**: `[가입 완료 버튼]` — 비밀번호 저장, 계정 활성화(`active`) 및 로그인 화면 전환.

### `SCR-B-PERM-007`: 내 계정 (My Account) 관리 화면
- **Annotation 1 (Profile Edit Card)**: `[내 프로필 정보]` — 본인 한글/영문 성명, 직함, 연락처 수정 및 즉시 저장.
- **Annotation 2 (Password Change Card)**: `[보안 비밀번호 변경]` — 현재 비밀번호 재인증 및 새 비밀번호 설정.

---
*End of MAN-B-PERM-001 Screenshot Requirements*
