# MAN-B-PERM-001: Production Screenshot Annotation Guide
## Permissions & User Management (사용자, 역할 및 권한 관리)

---

## 1. Production Screenshot Inventory & Verification

All 10 screenshots below were captured directly from the live production environment using Playwright browser automation.

| Shot ID | File Name | Viewport | Dimensions | File Size | SHA256 Hash | Target Screen & State |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `SCR-01` | `SCR-B-PERM-001.png` | Desktop | 1440×900 | 68,007 B | `5f95e235fb5d3e07dc3df72ab3daa9f60e9dda6baecb023750c6111176365377` | `/portal/company/users` (소속 멤버 목록 대시보드) |
| `SCR-02` | `SCR-B-PERM-002.png` | Desktop | 1440×900 | 138,257 B | `8a1d7e9f0eb7ec9080e55aaf275ad766f84ed398fef163bc5b35f70187a54c85` | `/portal/company/users` (신규 멤버 초대 모달) |
| `SCR-03` | `SCR-B-PERM-003.png` | Desktop | 1440×900 | 148,416 B | `5b50d85a35cd0e1c0e624c9a89c1bbc4cf169d5a56dfbfeb4ce4f573efde9374` | `/portal/company/users` (9-Category ACL 매트릭스 상세 에디터) |
| `SCR-04` | `SCR-B-PERM-004.png` | Desktop | 1440×900 | 105,776 B | `dd92ae516d5fe871922819aff45ee0c8a2731f7a627f275e32f4036b38931df8` | `/portal/company/users` (멤버 정보 및 권한 수정 모달) |
| `SCR-05` | `SCR-B-PERM-005.png` | Desktop | 1440×900 | 131,127 B | `f1c5afcb07293b9e150d967932813c424b3182918d21c3f32dbeda5d1d07419d` | `/portal/company/users` (6대 담당 업무 및 알림 배정 테이블) |
| `SCR-06` | `SCR-B-PERM-006.png` | Desktop | 1440×900 | 27,993 B | `17631867bd3cff41b4e64d4ae1a67dc10de3757d22334b492259159543a53846` | `/portal/invite/accept` (초대 수락 및 비밀번호 설정) |
| `SCR-07` | `SCR-B-PERM-007.png` | Desktop | 1440×900 | 80,763 B | `560deaf04f0d1f0c423544372169c6f4c577cd92dab03656d60f568c115f1d36` | `/portal/account` (내 계정 My Account 화면) |
| `SCR-08` | `SCR-B-PERM-008.png` | Desktop | 1440×900 | 122,862 B | `2e589c3d06e3f784ad653af6becfb4ef83ebfd7c6abe63ae725588b1c76abe6f` | `/portal/company/users` (멤버 제거 확인 모달) |
| `SCR-09` | `SCR-B-PERM-009.png` | Desktop | 1440×900 | 110,707 B | `c7b3c01c905bfb7f9be21fc90b792df3d78dd0b546c1d1c4dcc421c03d02f740` | `/admin/companies/[id]` (어드민 회사 상세 — 소속 직원 탭) |
| `SCR-10` | `SCR-B-PERM-010.png` | Mobile | 390×844 | 17,274 B | `babc0b58617835d08fd83a988c05947b2671d1114ba57a2c613fd080855a8b41` | `/portal/company/users` (모바일 반응형 멤버 목록) |

---

## 2. Callout & Annotation Plan for Claude Design

### Shot 01: `SCR-B-PERM-001.png` (소속 멤버 목록 대시보드)
- **Callout 1 (Top Right Button)**: `[+ 사용자 초대하기]` — `company_admin` 전용 신규 멤버 초대 모달 호출 버튼.
- **Callout 2 (First Column)**: `[이름 및 식별 뱃지]` — 한글/영문 성명 및 `[본인]`, `[최초 관리자]`, `[대표 담당자]` 뱃지.
- **Callout 3 (Fourth Column)**: `[역할 뱃지]` — 5가지 역할 프리셋 (`관리자`, `매니저`, `담당자`, `조회자`, `접근제한`).
- **Callout 4 (Fifth & Sixth Columns)**: `[가입 & 이용 상태]` — `가입완료`/`초대됨`/`초대만료` 및 `정상이용`/`대기중`/`이용정지` 뱃지.
- **Callout 5 (Action Column)**: `[설정 액션]` — `재초대`, `초청 취소`, `수정`, `멤버 제거` 링크 버튼.

### Shot 02: `SCR-B-PERM-002.png` (신규 멤버 초대 모달)
- **Callout 1 (English Names)**: `[영문 성 및 영문 이름 (필수)]` — 글로벌 바이어 및 리테일러 소통용 영문자 입력 필드.
- **Callout 2 (Login Email)**: `[로그인 이메일 (필수)]` — 고유 로그인 계정 및 초대장 발송 주소.
- **Callout 3 (Role Preset Selection)**: `[역할 템플릿]` — 클릭 시 기본 ACL 권한이 자동 동기화되는 5대 프리셋 카드.

### Shot 03: `SCR-B-PERM-003.png` (9-Category ACL 매트릭스 에디터)
- **Callout 1 (Category Column)**: `[9대 업무 영역]` — 입점신청, 브랜드, 제품, 주문, 정산, 문의, 회사정보, 계좌정보, 계약문서.
- **Callout 2 (Radio Button Columns)**: `[4단계 접근 권한]` — `접근불가 (none)` / `조회전용 (read)` / `생성/수정 (write)` / `생성/수정/삭제 (manage)`.
- **Callout 3 (Helper Notice)**: `[커스텀 권한 안내]` — 프리셋 선택 후 개별 카테고리를 자유롭게 오버라이드할 수 있음을 명시.

### Shot 04: `SCR-B-PERM-004.png` (멤버 정보 및 권한 수정 모달)
- **Callout 1 (Section 1: Basic Info)**: `[인적 사항 및 연락처]` — 성명, 직함, 부서, 국제 표준 연락처, 이용 제한 상태.
- **Callout 2 (Section 2: ACL Matrix)**: `[권한 매트릭스]` — 실시간 권한 조정 영역.
- **Callout 3 (Section 3: Task Header)**: `[담당 업무 및 알림 배정]` — 6대 실무 책임자 지정 영역.

### Shot 05: `SCR-B-PERM-005.png` (6대 담당 업무 배정 테이블)
- **Callout 1 (Task Definition Column)**: `[6대 업무 및 설명]` — 회사·신청, 계약, 제품·인증, 가격·견적, 물류·재고, 정산·문의.
- **Callout 2 (Primary Checkbox Column)**: `[주 담당자 지정]` — 업무당 단 1명만 지정 가능한 실무 책임자 체크박스.
- **Callout 3 (Email Notify Column)**: `[이메일 알림 수신]` — 해당 업무 관련 시스템 이메일 수신 여부 설정.

### Shot 06: `SCR-B-PERM-006.png` (초대 수락 및 비밀번호 설정)
- **Callout 1 (Branded Header)**: `[K SELECT NETWORK 로고]` — 신뢰할 수 있는 공식 온보딩 헤더.
- **Callout 2 (Password Policy)**: `[보안 비밀번호 규칙]` — 8자 이상, 대소문자, 숫자, 특수문자 조합 필수 조건.
- **Callout 3 (Submit CTA)**: `[가입 완료 버튼]` — 비밀번호 저장, 계정 활성화(`active`) 및 로그인 화면 전환.

### Shot 07: `SCR-B-PERM-007.png` (내 계정 My Account 화면)
- **Callout 1 (Profile Edit Card)**: `[내 프로필 정보]` — 본인 한글/영문 성명, 직함, 연락처 수정 및 즉시 저장.
- **Callout 2 (Password Change Card)**: `[보안 비밀번호 변경]` — 현재 비밀번호 재인증 및 새 비밀번호 설정.

### Shot 08: `SCR-B-PERM-008.png` (멤버 제거 확인 모달)
- **Callout 1 (Warning Dialog)**: `[소속 멤버십 해제 경고]` — 포털 데이터 접근 권한 회수 안내.
- **Callout 2 (Data Preservation Notice)**: `[회사 데이터 보존]` — 멤버가 등록한 비즈니스 자산은 회사 데이터로 영구 보존됨을 확인.

### Shot 09: `SCR-B-PERM-009.png` (어드민 회사 상세 — 사용자 관리 탭)
- **Callout 1 (Admin Support View)**: `[어드민 관리 화면]` — K SELECT 운영 직원의 파트너사 지원 및 권한 모니터링 탭.

### Shot 10: `SCR-B-PERM-010.png` (모바일 반응형 목록)
- **Callout 1 (Mobile Card Layout)**: `[모바일 반응형 최적화]` — 390px 뷰포트에서의 사용자 카드 레이아웃.

---
*End of SCREENSHOT_ANNOTATION_GUIDE.md*
