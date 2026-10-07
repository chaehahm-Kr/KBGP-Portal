# HANDOFF — DATA-JSON-MIG: JSON 메타데이터 → 정식 DB 테이블 이전

작성: 2026-10-07 (이전 세션, Supabase MCP 읽기 전용 상태에서 준비)

## 목표
회사 정보·사용자 권한 등 중요한 데이터가 `companies.intro`, `company_users.permissions`,
`brands.intro` 의 JSON 문자열에 저장되어 있다. 동시 저장 시 덮어쓰기, RLS 불가, 검증 불가
문제가 있어 단계별로 정식 테이블/칸으로 옮긴다. 사용자가 단계별 진행을 승인함.

| 단계 | 대상 | 상태 |
|---|---|---|
| 2 | 사용자 권한(9개 메뉴 ACL + preset) → `company_user_permissions` | **0133 DB 적용·검증 완료 (2026-10-07, SQL Editor 수동 실행 — MCP 마이그레이션 히스토리 미기록). 코드 전환(테이블 우선 읽기 + 이중 쓰기) 완료. JSON 권한 키 제거는 별도 승인 대기** |
| 3 | 회사 기본 정보(주소, 메모, 웹사이트, 로고, 온보딩) → `companies` 칸, 연락처 → `company_contacts` | **0134(칸·테이블·복사) + 0135(intro→칸 동기화 트리거) SQL Editor 적용·검증 완료. 코드는 칸 우선 읽기. 유형=company_roles, 상태=companies.status 유지. JSON 제거 시 쓰기 코드를 칸 직접 쓰기로 바꾸고 0135 트리거 제거** |
| 4 | PO 요청 → 0092 테이블 적용 후 데이터 이전 | 미착수 (`po_requests` 는 0127 의 4칸짜리 임시 테이블, 데이터 0행) |
| 5 | 출고지 → 0086 테이블 적용 후 이전 | 미착수 |
| 6 | 브랜드 상표권 → 0015 칸 적용 후 이전 | 미착수 (6개 브랜드가 intro JSON 에 상표권 보유) |

## 2단계 — 다음 할 일
1. `supabase/migrations/0133_company_user_permissions.sql` 을 사용자 승인 후 `apply_migration` 으로 적용
   (이름: `0133_company_user_permissions`). 테이블 생성 + JSON→테이블 복사(재실행 안전, JSON 은 지우지 않음).
2. `execute_sql` 로 검증: 10행 생성, CHECK 제약, RLS(force), select 정책 1개, 아래 미리보기와 값 일치.
3. 코드 전환 (이중 쓰기 → 테이블 우선 읽기):
   - 읽기 중심: `lib/company/permissions.ts` `getPortalUserAcl` — 테이블 우선, 없으면 JSON(`normalizePermissions`).
   - **반드시 유지:** `company_role === "company_admin"` 이면 테이블/JSON 무시하고 `ROLE_PRESETS.admin`.
     (`account@letusto.com` 은 company_admin 인데 JSON 에 application/brands/products/company_info = none 이 있음.
     현재 동작은 전체 권한이므로 바뀌면 안 된다.)
   - 쓰기 지점(이중 쓰기 필요): `components/admin/company-detail-manager.tsx`(656, 733, 771),
     `components/company/company-users-manager.tsx`(220, 251), `lib/company/admin-actions.ts`(517, 626),
     `lib/company/invite-actions.ts`(625), `lib/inquiries/actions.ts`(144), `app/api/inquiries/route.ts`(386),
     `lib/portal/account-actions.ts`(242). 클라이언트에서 직접 쓰는 곳은 서버 액션 경유로 바꿔야 함
     (테이블에 쓰기 정책 없음 — service role 만 쓸 수 있음).
   - 같은 JSON 에 섞인 비권한 항목(이름·연락처·`read_notification_ids`·`otp_*`)은 이번 단계에서 건드리지 않음.
4. tsc / build / vitest → DEPLOY-STD-001 절차로 커밋·푸시·배포·검증.
5. JSON 의 권한 키 제거는 별도 승인 후(데이터 삭제).

## 미리보기 결과 (적용 전 SELECT 로 확인, 순서: application,brands,products,orders,finance,support,company_info,bank_info,agreements)
- company_admin 8명: manage×9 (단 account@letusto.com 은 none,none,none,manage,manage,manage,none,manage,manage — 위 주의 참고)
- jinseoklee81@gmail.com: restricted, none×9
- support@letusto.com: staff, write,write,write,write,read,write,read,none,none

## 이 세션에서 이미 끝난 것 (참고)
PORT-HOTFIX-001, ADM-NTF-PO-001/002(PO 요청 배지는 companies 메타데이터 기준), ADM-NTF-001(notifications 스위치),
ADM-CMP-DEL-001(회사·브랜드 삭제), ADM-SET-001(system_settings 테이블 생성), ADM-CMP-ERR-001(출고지 스위치,
정산담당 조회 제거), PORT-SEC-OTP-001(OTP 증표), PORT-SEC-IMP-001(대리 로그인 서명 키).

## 남은 보안 항목
- `app/api/admin/run-migration-*` 10개 삭제 (0130 이 로그인 없이 브랜드 목록 반환, exec_sql 함수는 DB 에 없음)
- `scripts/capture-*.js` 의 QA 계정 고정 비밀번호
- OTP 를 `company_users.permissions` 평문 → 전용 테이블(해시)로
