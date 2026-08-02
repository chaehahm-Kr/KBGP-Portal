# K Select Network 파트너 포털

K Select Network의 B2B 운영 플랫폼(외부 파트너 포털 + 내부 관리자 콘솔). 기획 문서 전체는
`KBeautyWebsite/PRD/` 폴더를 참고. 이 저장소는 그중 **명세서 00(프로젝트 기반 설정),
01(회사 회원가입·로그인·소속 사용자 관리), 02(브랜드·제품 등록), 03(신청서 작성·제출·현황확인),
04(관리자 로그인·신청 목록·회사 관리), 05(신청서 심사), 06(추가 자료 요청),
07(담당자 배정·내부 메모), 08(이메일 알림 시스템 전체 연동), 09(대시보드),
10(직원 관리·활동 로그)**까지 구현된 상태다. Phase 1의 11개 명세서(00~10)가 전부
끝난 시점이다. 05까지 완성되면 "신청 접수부터 심사 결과 통보까지"가 시스템 안에서
처음부터 끝까지 동작한다(`11_개발우선순위와개발명세서목록.md`가 이 지점을 "Phase 1의
진짜 마일스톤"이라고 부르는 이유).

마케팅 사이트(`kselectnetwork.com`, `KBeautyWebsite/web`)와는 완전히 분리된 별도 프로젝트이며,
`portal.kselectnetwork.com` 서브도메인의 별도 Vercel 프로젝트로 배포한다.

## 기술 스택

- **Next.js 16** (App Router) / React 19 / TypeScript — 마케팅 사이트와 동일한 조합으로 통일
- **Supabase** (Postgres + Auth + RLS) — 인증과 "회사 간 데이터 격리"를 데이터베이스 차원에서
  강제하기 위해 선택. 이유는 아래 "데이터 격리" 절 참고
- **Tailwind CSS v4**
- **Vercel** 배포

## 폴더/URL 구조 — 외부 포털과 관리자 포털의 분리

`02_사용자유형과권한표.md` 설계 원칙 3번("외부 화면과 내부 화면은 코드 수준에서부터
분리한다")과 `10_보안과권한요구사항.md` 2번("완전히 다른 로그인 경로")을 그대로 코드
구조에 반영했다.

```
app/
  page.tsx              # 루트 — 포털/관리자 로그인 중 선택하는 안내 화면
  portal/                # 외부 파트너(한국 브랜드사) 전용. Company/CompanyUser 사용자만 진입 가능
    login/page.tsx
    signup/page.tsx        # 회사 회원가입(Company Admin 생성)
    signup/check-email/page.tsx
    reset-password/page.tsx          # 비밀번호 재설정 요청
    reset-password/confirm/page.tsx  # 이메일 링크로 진입, 새 비밀번호 설정
    invite/accept/page.tsx           # 동료 초대 이메일 링크로 진입, 비밀번호 설정 후 가입 완료
    company/users/page.tsx           # 소속 사용자 관리 (Company Admin 전용)
    brands/page.tsx, brands/new/page.tsx, brands/[id]/page.tsx     # 브랜드 등록·수정
    products/page.tsx, products/new/page.tsx, products/[id]/page.tsx  # 제품 등록·수정·파일첨부
    applications/page.tsx, applications/[id]/page.tsx  # 신청 현황 목록, 작성/제출/상세(회사측)
    page.tsx              # 로그인 후 대시보드 (지금은 골격 확인용 자리표시자)
  admin/                  # Letusto 내부 직원 전용. StaffUser만 진입 가능
    login/page.tsx
    applications/page.tsx, applications/[id]/page.tsx  # 전체 회사 신청 목록·상세(열람만, 심사는 명세서 05)
    companies/page.tsx, companies/[id]/page.tsx          # 회사 목록·상세(브랜드·제품·신청이력 통합)
    page.tsx

components/
  auth/
    login-form.tsx / signup-form.tsx
  company/
    invite-user-form.tsx
  brand/
    brand-form.tsx
  product/
    product-form.tsx / add-certificate-form.tsx
  application/
    application-draft-form.tsx / submit-application-button.tsx / review-product-form.tsx

lib/
  supabase/
    client.ts            # 브라우저(클라이언트 컴포넌트)용
    server.ts             # 서버 컴포넌트/서버 액션용 — RLS가 항상 적용됨
    admin.ts               # secret 키. RLS를 우회하므로 극히 제한된 용도로만 사용
    proxy.ts                # proxy.ts(구 middleware.ts)에서 쓰는 세션 갱신 로직
  auth/
    dal.ts                 # Data Access Layer — verifyPortalSession()/verifyAdminSession()
    actions.ts              # 로그인/로그아웃 서버 액션 (area별로 분리), 5회 실패 잠금 연동
    admin-actions.ts         # 계정 비활성화 시 세션 즉시 무효화 등 관리자 전용 작업
    signup.ts                # 회사 회원가입 서버 액션
    login-attempts.ts        # 로그인 5회 연속 실패 시 15분 잠금
    reset-password.ts        # 비밀번호 재설정 요청 서버 액션
    password.ts               # 비밀번호 규칙(zod 스키마) — 여러 화면에서 공용
  company/
    dal.ts                  # requireCompanyMembership()/requireCompanyAdmin() — 접근 가드
    invite-actions.ts        # 초대 발송/재초대/제거/초대 수락 서버 액션
    types.ts                 # CompanyRole, 초대 만료 판정 등 공용 타입
  brand/
    actions.ts               # 브랜드 등록/수정/사용중단 서버 액션
  product/
    actions.ts                # 제품 등록/이미지 추가·삭제/인증서 추가 서버 액션
    types.ts                  # 카테고리·인증서 종류 라벨
  application/
    actions.ts                # 신청서 임시저장/제품 선택/제출 서버 액션
    review-actions.ts          # 제품별 심사(승인/보류/반려) + 자동 집계 + 결과 이메일
    types.ts                  # 신청 상태값·제품 심사 상태값 라벨, 자가진단 6문항
  notifications/
    email.ts                  # Resend 발송(키 없으면 콘솔 로그로 대체)
  files/
    validate.ts              # 매직 바이트 기반 파일 형식·용량 검증
    storage.ts                 # 비공개 버킷의 서명된 URL 발급
  env/
    public.ts               # NEXT_PUBLIC_* 검증 (브라우저 노출 가능)
    server.ts                # 서버 전용 비밀값 검증 ("server-only"로 클라이언트 import 차단)

proxy.ts                 # Next.js 16 라우트 진입점 (구 middleware.ts). /portal, /admin 게이트

supabase/
  migrations/
    0001_init_auth_profiles.sql   # profiles 테이블 + RLS 정책의 기준 패턴
    0002_companies.sql             # companies, company_users, login_attempts + RLS
    0003_brands_products.sql        # brands, products, product_images/certificates + Storage RLS
    0004_applications.sql            # applications, application_products + RLS(제출 후 잠금)
    0005_staff.sql                    # staff_members, staff_roles(N:M) + RLS, admin 자동 백필
```

`/portal`과 `/admin`은 로그인 화면부터 완전히 다른 URL이고, 서로 다른 역할(`profiles.role`)이
아니면 상대 영역에 들어갈 수 없다 — 포털 계정으로 `/admin`에 들어가면 관리자 로그인 화면으로,
그 반대도 마찬가지로 돌려보낸다.

## 인증 구조

1. **1차 방어선 — `proxy.ts`**: 모든 요청에서 Supabase 세션 쿠키를 갱신하고, `/portal`,
   `/admin` 경로에 로그인하지 않은 사용자가 접근하면 해당 영역의 로그인 화면으로 보낸다.
   `getClaims()`로 "로그인 여부"만 가볍게 확인한다(Supabase 공식 권장 패턴).
2. **2차·최종 방어선 — `lib/auth/dal.ts`**: 각 페이지에서 `verifyPortalSession()` /
   `verifyAdminSession()`을 호출해 (a) 실제 로그인 상태인지, (b) `profiles.role`이 이
   영역과 일치하는지를 Supabase Auth 서버에 직접 재확인한다(`getUser()`). 계정이 방금
   비활성화되었어도 다음 요청부터 즉시 튕겨나가도록 일부러 캐시된 쿠키가 아니라 실시간
   확인 방식을 쓴다 — `10_보안과권한요구사항.md` 3번 요구사항.
3. **직원 계정 비활성화**: `lib/auth/admin-actions.ts`의 `deactivateUserSessions()`가
   `service_role` 키로 계정을 정지시킨다. 완전 삭제가 아니라 정지이므로 데이터는
   보존된다(`10_보안과권한요구사항.md` 5번, "비활성화 + 접근 차단, 데이터는 보관").

## 회사 회원가입 · 로그인 · 소속 사용자 관리 (명세서 01)

- **회원가입** (`/portal/signup`, `lib/auth/signup.ts`): 회사명·사업자등록번호(숫자 10자리
  검증)·담당자 정보·비밀번호를 받아 `auth.users` + `companies` + `company_users`
  (`company_role: 'company_admin'`)를 한 번에 만든다. Company/CompanyUser 레코드 생성은
  세션 유무와 무관하게 항상 성공해야 하므로 `lib/supabase/admin.ts`(secret 키)로 수행한다 —
  Supabase의 "Confirm email" 설정이 켜져 있으면(권장값, 기본값) `signUp()` 직후에는
  세션이 아직 없기 때문이다. 세션이 있으면 바로 `/portal`로, 없으면
  `/portal/signup/check-email`로 보낸다.
- **로그인 5회 실패 잠금** (`lib/auth/login-attempts.ts`): `login_attempts` 테이블에 모든
  시도를 기록하고, 최근 5회가 15분 이내에 전부 실패였으면 Supabase Auth 자체에 요청을
  보내지도 않고 즉시 잠금 안내를 반환한다(`10_보안과권한요구사항.md` 2번).
- **비밀번호 재설정** (`/portal/reset-password`, `.../confirm`): 요청 화면은 계정 존재
  여부를 알려주지 않도록 항상 같은 문구를 보여준다. 확인 화면은 이메일 링크가 브라우저의
  Supabase 클라이언트에만 세션을 넘겨주는 구조라서 클라이언트 컴포넌트로 만들었다.
- **소속 사용자 초대** (`/portal/company/users`, `lib/company/invite-actions.ts`): 별도의
  초대 토큰 테이블 없이 `supabase.auth.admin.inviteUserByEmail()`을 그대로 쓴다 — 계정
  생성과 초대 메일 발송, 링크의 만료·1회성 보장을 Supabase Auth가 전부 맡아준다. 초대
  수락(`/portal/invite/accept`)도 비밀번호 재설정과 같은 구조(클라이언트에서 세션 감지 →
  비밀번호 설정 → 서버 액션으로 `company_users.status`를 `invited → active` 전환)를 쓴다.
  회사에 남은 마지막 관리자는 제거할 수 없게 막아둔다(`08_주요화면과AC.md` 예외 규칙).

**이메일 발송 관련 주의**: Supabase 프로젝트의 기본 공유 SMTP는 **시간당 2통**으로
제한되어 있고 best-effort다("Confirm email", 비밀번호 재설정, 초대 메일 전부 이 한도를
공유한다). 로컬 개발 중 반복 테스트하다 보면 금방 한도를 넘기니(이 프로젝트도 실제로
겪었다), 실제 운영 전에는 반드시 Supabase 대시보드 > Authentication > Emails에서
커스텀 SMTP(예: Resend, Postmark)를 연결해야 한다. 코드 쪽은 이미 대응해뒀다 —
`over_email_send_rate_limit` 에러를 별도로 감지해 사용자에게 명확한 안내를 보여준다.

**아직 만들지 않은 것**:
- 내부 직원(관리자 포털) 2단계 인증 — Phase 2 이후 권장 사항(`10_보안과권한요구사항.md` 2번)
- 회사 프로필 수정 화면 (RLS 정책은 이미 있음, 화면만 없음 — `08_주요화면과AC.md` 화면 4)

## 브랜드 · 제품 등록 (명세서 02)

- **브랜드** (`/portal/brands`): 등록·수정·"사용 중단"(논리 삭제 — 이미 신청서에 쓰인
  브랜드를 물리 삭제하지 않기 위함, `08_주요화면과AC.md` 화면 6 예외). 같은 회사 내
  브랜드명 중복은 부분 유니크 인덱스(`brands_company_name_active_unique`)로 DB가 직접 막는다.
- **제품** (`/portal/products`): 브랜드 소속으로 등록. 이미지 최소 1장(최대 5장) 필수,
  인증서는 선택이지만 없으면 상세 화면에 경고만 표시하고 막지는 않는다(화면 7 AC).
- **파일 업로드** (`lib/files/validate.ts`, `lib/files/storage.ts`): 브라우저가 보낸
  `file.type`/확장자를 신뢰하지 않고 파일 내용의 매직 바이트를 직접 읽어 신고된 형식과
  일치하는지 확인한다(`10_보안과권한요구사항.md` 4번). 업로드는 `company-uploads`라는
  **비공개** Storage 버킷 하나에 `{company_id}/...` 경로 규칙으로 저장하고, Storage 자체의
  RLS 정책(`storage.objects`)이 `auth_company_id()`와 경로의 첫 세그먼트를 비교해 회사 간
  파일 접근을 차단한다. 화면에 보여줄 때는 매번 짧게 유효한 서명된 URL을 새로 발급한다
  (`getSignedFileUrl()`) — 파일에 영구적인 공개 URL이 존재하지 않는다.
- **인증서 버전 관리** (`product_certificates.version`/`is_current`): 같은 종류의 인증서를
  다시 올리면 기존 파일을 지우지 않고 새 버전을 추가한다(`09_알림및문서관리규칙.md` 버전
  관리 규칙). 이전 버전도 `is_current=false`로 남아 조회는 가능하다.
- **검증 방법에 대한 메모**: 브라우저 자동화 도구로는 `<input type="file">`에 실제 파일을
  넣을 수 없어(브라우저 자체 보안 제약), 파일 업로드 로직은 실제 Supabase 프로젝트를
  대상으로 한 스크립트로 매직 바이트 검증 → Storage 업로드 → RLS → 서명 URL 발급까지
  직접 실행해 확인했고, 화면에서 이미지가 실제로 로드되는 것(`naturalWidth` 확인)까지
  브라우저로 검증했다. 회사 간 데이터 격리는 서로 다른 두 회사 계정으로 각각 로그인해
  브랜드/제품 목록이 서로 안 보이는 것, 그리고 다른 회사 제품 URL을 직접 입력해도
  404로 막히는 것까지 확인했다.

**아직 만들지 않은 것 (계속)**:
- 바이러스/악성코드 스캔(권장 사항, `09_알림및문서관리규칙.md` 7번) — 운영 전 별도 스캔
  서비스 연동 필요

## 신청서 작성 · 제출 · 현황확인 (명세서 03)

이 시스템의 핵심 연결 고리인 Application/ApplicationProduct를 만든다 — "신청서 전체
상태와 제품별 심사 상태가 서로 독립적"이라는 확정 답변이 여기서 실제로 구현된다.

- **작성·임시저장** (`/portal/applications/[id]`): "새 신청서 작성"을 누르면 빈 draft가
  즉시 만들어지고 편집 화면으로 이동한다. 제품 선택(브랜드별로 묶어서 표시), 신청 동기,
  참여 조건 자가진단 6문항(마케팅 사이트 `web/lib/content.ts`의 `eligibilityConditions`와
  동일 항목)을 임시저장할 수 있다. 자가진단은 미충족이어도 제출을 막지 않는다.
- **제출**: 제품이 1개 이상 선택된 draft에만 "신청서 제출" 버튼이 나타난다. 제출 시
  `generate_application_number()` RPC로 신청번호(`APP-000001` 형식)를 발급하고, 상태를
  `submitted`로 바꾼다. **제출 이후에는 회사 쪽에서 더 이상 수정할 수 없다** — UI에서
  버튼을 숨기는 게 아니라 RLS(`applications_update_while_draft`)가 DB 차원에서 막는다.
- **현황 목록·상세** (`/portal/applications`): 신청번호·상태·제품 수·제출일을 보여주는
  목록과, 제출된 신청서는 제품별 심사 상태(전부 아직 `검토대기` — 심사 기능은 명세서 05)를
  보여주는 읽기 전용 상세 화면.

**실제로 겪은 RLS 버그와 교훈**: 처음 작성한 `applications_update_while_draft` 정책은
`USING (status = 'draft')`만 있고 `WITH CHECK`이 없었다. Postgres는 UPDATE 정책에
`WITH CHECK`이 없으면 `USING`을 그대로 재사용하는데, 문제는 이 정책이 지키려는 바로 그
컬럼(`status`)을 이 업데이트가 직접 바꾼다는 점이었다 — "draft를 submitted로 바꾸는"
업데이트 자체가, 바뀐 뒤의 행(`status='submitted'`)을 다시 "`status`가 draft인가"로
검사받아 매번 거부됐다. **상태 전이를 허용하는 UPDATE 정책을 쓸 때는 USING(전이 전
조건)과 WITH CHECK(전이 후에도 지켜야 할 조건, 보통 `company_id`처럼 안 바뀌는 값만)을
반드시 따로 명시해야 한다.** 브라우저로 실제 제출을 시도해보고 나서야 발견한 문제였다 —
스크립트로 개별 SQL 동작을 확인하는 것만으로는 놓치기 쉬운 종류의 버그였다.

## 관리자 로그인 · 신청 목록 · 회사 관리 (명세서 04)

Letusto 내부 직원이 처음으로 시스템에 들어와서 뭔가를 "볼 수 있게" 되는 지점이다.
아직 심사(승인/보류/반려)는 못 한다 — 그건 명세서 05.

- **StaffUser/Role** (`staff_members`, `staff_roles`): `profiles.role='admin'`은 이미
  "Letusto 내부 로그인 계정인가"만 구분했는데, 여기에 이름과 세부 역할(Super
  Admin/Reviewer/Account Manager/Operations/Executive Viewer, `02_사용자유형과권한표.md`의
  5개)을 추가한다. 아직 직원을 화면에서 만드는 UI는 없다(명세서 10 범위) — 지금은
  Supabase 대시보드에서 만든 관리자 계정을 기준으로 `handle_new_user()` 트리거가
  `staff_members` 행을 자동으로 만들어준다(기존 계정은 마이그레이션의 백필 INSERT로 처리).
- **신청 목록** (`/admin/applications`): 전체 회사의 제출된 신청서를 상태·회사명으로
  필터링해 볼 수 있다. 회사 측 화면과 똑같은 `applications`/`application_products`
  테이블을 쓰지만, RLS 정책에 이미 넣어둔 `or auth_is_admin()` 덕분에 관리자는 회사
  구분 없이 전체를 본다 — 이 화면을 위해 새로 만든 정책은 없다.
- **회사 관리** (`/admin/companies`): 회사 목록과, 회사 하나를 클릭하면 브랜드·제품·신청
  이력을 한 화면에 모아 보여주는 상세 화면(`08_주요화면과AC.md`의 "통합 뷰" 요구사항).

## 신청서 심사 (명세서 05) — Phase 1의 진짜 마일스톤

11_개발우선순위와개발명세서목록.md가 "신청 접수부터 심사 결과 통보까지가 처음부터
끝까지 동작하는 지점"이라고 부르는 곳이다.

- **제품별 독립 심사** (`/admin/applications/[id]`): 신청서에 포함된 제품 하나하나를
  승인/보류/반려로 판단한다. 보류·반려는 사유 입력이 없으면 저장되지 않는다
  (`08_주요화면과AC.md` 화면 9 AC). 담당자 배정(명세서 07 범위)이 아직 없어서, 지금은
  관리자 전체가 모든 신청서를 심사할 수 있다.
- **자동 집계** (`lib/application/review-actions.ts`의 `computeAggregatedStatus()`):
  제품 심사 결과가 바뀔 때마다 `06_상태값정의.md`의 규칙(전부 승인→승인, 일부만
  승인→부분승인, 전부 반려→반려, 전부 보류→보류, 아직 미정 있으면 심사중 유지)을 그대로
  적용해 신청서 전체 상태를 다시 계산한다. 관리자가 별도로 "전체 승인" 버튼을 누를
  필요가 없다 — 06번 문서 자체가 "제 판단으로 설계한 부분"이라고 밝힌, 승인 없이
  반려·보류만 섞인 경우는 보류로 처리하도록 정했다(다르게 운영하고 싶다면 이 함수만
  고치면 된다).
- **결과 통보 이메일**: 신청 상태가 최종 상태(승인/부분승인/보류/반려)로 확정되는
  순간에만, 그리고 실제로 상태가 바뀐 경우에만 회사 소속 사용자 전원에게 메일을
  보낸다. `RESEND_API_KEY`가 없는 개발 환경에서는 실제 발송 대신 콘솔에 로그를 남기며,
  문구는 `09_알림및문서관리규칙.md`의 예시 톤을 그대로 따랐다.
- **회사 측 반영**: 제품별 심사 상태와, 반려·보류인 경우의 공식 사유가 회사 측 신청서
  상세 화면에도 그대로 보인다(`08_주요화면과AC.md` 화면 7 AC) — 내부 메모는 아직
  존재하지 않으므로(명세서 07 범위) 새어나갈 경로 자체가 없다.

브라우저로 제품 2개짜리 신청서를 만들어 하나는 승인, 하나는 반려로 각각 저장해보고
신청서 전체 상태가 "부분승인"으로 자동 반영되는 것, 이메일 로그가 정확한 수신자·문구로
찍히는 것, 회사 측 화면에 반려 사유가 그대로 보이는 것까지 확인했다.

## 추가 자료 요청 (명세서 06)

심사자가 서류만으로 판단하기 어려운 제품을 만났을 때, 승인/반려로 확정 짓지 않고
회사 측에 추가 자료를 요청할 수 있게 하는 기능이다(`06_상태값정의.md`의
`info_requested` 상태).

- **요청 생성** (`lib/application/info-request-actions.ts`의 `createInfoRequest`):
  관리자가 신청서 전체 또는 특정 제품을 대상으로 요청 내용을 남기면
  `additional_info_requests` 행이 생기고, 신청서 상태가 `info_requested`로 바뀌며
  회사 소속 사용자 전원에게 이메일이 나간다.
- **회사 측 회신** (`replyToInfoRequest`): 포털의 신청서 상세 화면에 대기 중인 요청이
  주황색 배너로 뜨고, 텍스트 답변과 파일 첨부(선택)로 회신한다. 회신하면 요청이
  `replied`로 바뀌고 신청서 상태는 `re_review`로 돌아가 관리자가 다시 판단할 수 있게
  한다.
- **RLS**: `additional_info_requests`는 회사 측에는 SELECT만 허용하고(자기 회사 것만),
  실제 INSERT/UPDATE는 전부 `lib/supabase/admin.ts` 또는 서버 액션 내부 권한 검사를
  거친 경로로만 이뤄진다 — 회사 사용자가 요청 상태를 직접 조작할 수 없다.

브라우저로 제품 하나를 대상으로 요청을 보내고, 회사 측 로그인으로 배너가 뜨는 것과
회신 후 이력 섹션으로 넘어가는 것, 신청서 상태가 `info_requested → re_review`로 도는
것까지 확인했다.

## 담당자 배정 · 내부 메모 (명세서 07)

여러 심사자가 같은 신청서를 동시에 건드리는 걸 막고, 심사 과정에서 나오는 메모를
회사 측에는 절대 보이지 않게 분리하는 기능이다.

- **배정** (`lib/application/assignment-actions.ts`의 `assignApplication`): Super Admin은
  누구에게나 배정/재배정할 수 있고, 일반 admin은 미배정 상태의 신청서를 자기 자신에게만
  배정할 수 있다(다른 사람에게 배정하거나 이미 배정된 걸 바꾸려 하면 거부된다). 첫 배정
  시에만 신청서 상태가 `submitted → assigned`로 바뀐다. 새 담당자에게는 배정 안내,
  재배정으로 밀려난 이전 담당자에게는 해제 안내 이메일이 나간다(PRD의 "인앱 알림"은
  아직 알림 센터가 없어 이메일로 대체 — 명세서 09 범위로 남겨둠).
- **심사 권한 제약** (`lib/application/assignment-dal.ts`의 `canReviewApplication`,
  `review-actions.ts`에 통합): Super Admin이거나, 아직 미배정 상태이거나, 본인이 현재
  담당자인 경우에만 제품 심사 폼이 활성화된다. 그 외에는 "배정된 담당자만 이 신청서를
  심사할 수 있습니다" 안내와 함께 폼이 잠긴다 — 서버 액션에서도 동일하게 재검증하므로
  화면을 우회해 요청을 직접 보내도 막힌다.
- **내부 메모** (`lib/application/review-note-actions.ts`): 신청서 전체 또는 특정
  제품에 메모를 남길 수 있고, 삭제는 작성자 본인 또는 Super Admin만 가능하다.
  `review_notes` 테이블은 관리자 전용 SELECT 정책만 갖고 있어 회사 측 세션으로는
  RLS 자체가 행을 아예 반환하지 않는다 — 화면에서 안 보여주는 게 아니라 DB 레벨에서
  존재 자체가 안 보인다.

**검증 (브라우저 + 직접 스크립트로 3-way 확인):**
1. 일반 admin이 남에게 배정 시도 → "Super Admin만 할 수 있습니다" 거부, 본인 자가배정
   → 성공하고 상태가 `assigned`로 전환됨을 확인.
2. Super Admin이 이미 배정된 신청서를 재배정 → 성공, 새 담당자·이전 담당자 양쪽에
   각각 다른 문구의 이메일 로그가 남는 것을 확인.
3. 내부 메모를 추가한 뒤 같은 신청서를 회사 측 세션(`/portal/applications/[id]`)으로
   열어 배정 정보·메모 텍스트가 어디에도 노출되지 않음을 확인. 서비스 롤이 아닌
   `anon`/`authenticated` 키로 `assignments`/`review_notes`를 직접 SELECT하는
   스크립트로도 0건임을 재확인(RLS가 우연이 아니라 강제되고 있음을 증명).

**부수적으로 발견해 고친 보안 이슈**: `get_advisors` 보안 감사에서 RLS 정책 내부
전용으로 만든 `auth_company_id()` 등 헬퍼 함수 5개가 PostgREST에 의해
`/rest/v1/rpc/...`로 익명 사용자에게까지 직접 호출 가능하게 노출돼 있는 걸 발견했다.
Postgres가 함수 생성 시 기본으로 `PUBLIC`에 EXECUTE를 주기 때문에 `anon`/`authenticated`
개별 REVOKE만으로는 막히지 않는다는 걸 확인하고(`0008_...sql`은 효과 없음),
`PUBLIC`에서 걷어낸 뒤 RLS·앱 코드가 실제로 필요로 하는 곳에만 `authenticated`로
다시 명시적으로 부여하는 방식(`0009_fix_helper_function_public_grant.sql`)으로
고쳤다. `handle_new_user()`(회원가입 트리거 전용)는 어느 롤에도 재부여하지 않았다 —
트리거 실행은 호출자의 EXECUTE 권한과 무관하게 동작하므로 회원가입 흐름에는 영향이
없다.

## 이메일 알림 시스템 전체 연동 (명세서 08)

`09_알림및문서관리규칙.md` Part 1의 알림 이벤트 11개를 전부 점검하고, 지금까지
각 서버 액션 안에 하드코딩돼 있던 이메일 문구를 하나의 템플릿 테이블로 모았다.

**감사 결과 — 시작 시점에 실제로 빠져 있던 것:**
- "신청서 제출 완료"(제출한 담당자 본인)와 "신규 신청서 접수"(내부 직원 전체) 두
  이벤트는 `submitApplication()`에 이메일 발송 코드 자체가 없었다 — 완전히 누락.
- "초대 만료 임박"(초대한 Company Admin 대상)도 발송 로직이 아예 없었다.
- 나머지 8개(회원가입·소속사용자초대는 Supabase Auth 기본 메일러, 담당자
  배정/해제·추가자료요청 발송/회신·심사결과확정 4종)는 이미 구현돼 있었다.

**이메일 템플릿 테이블** (`email_templates`, `lib/notifications/templates.ts`):
모든 업무 알림이 `sendTemplatedEmail(key, to, variables)`를 거치도록 통일했다.
DB에서 `{{변수명}}` 형태의 제목·본문을 읽어와 치환 후 발송하고, 행이 없으면
코드 내 `DEFAULT_TEMPLATES`로 폴백한다 — 시드가 지워져도 발송 자체는 끊기지 않는다.
`/admin/settings/email-templates`(Super Admin 전용, `08_주요화면과AC.md` 화면 20)에서
문구를 수정하고 예시 변수로 본인 이메일에 테스트 발송해볼 수 있다.

**"인앱" 채널을 이메일로 대체한 판단**: PRD는 "담당자 배정 해제됨"과 "초대 만료
임박" 두 이벤트의 채널을 인앱으로 정했지만, 인앱 알림함 화면은 아직 없다(명세서 09
대시보드 범위). 두 이벤트 모두 참고용 정보라 완전히 누락시키는 것보다 이메일로
대체하는 게 낫다고 판단해 그렇게 구현했다 — 나중에 인앱 알림함이 생기면 이메일을
인앱으로 옮기거나 병행하면 된다.

**추가 자료 회신 기한(`reply_due_at`)**: PRD가 정확한 일수를 정하지 않아 요청 생성
시점 기준 5일을 기본값으로 잡았다(`lib/application/info-request-actions.ts`의
`REPLY_DUE_DAYS` 상수 하나만 고치면 운영 중 바꿀 수 있다). Vercel Cron이 매일
`/api/cron/info-request-reminders`와 `/api/cron/invite-expiry-reminders`를 호출해
기한 임박(회사 측)·초과(내부 담당자)·초대 만료 임박(초대한 Company Admin)을
리마인드한다(`vercel.json`). 같은 요청에 리마인드가 중복 발송되지 않도록
`due_soon_notified_at`/`overdue_notified_at`/`expiry_notified_at` 컬럼으로 발송
여부를 기록해둔다. 두 라우트 모두 `CRON_SECRET` 환경변수와 `Authorization: Bearer`
헤더를 대조해 인증하며, 로컬 개발에서는 값이 없어도 통과시키되 운영 환경에서는
`CRON_SECRET` 미설정 시 요청 자체를 거부한다.

**11개 이벤트 검증**: 브라우저로 신청서를 새로 제출해 제출확인·신규접수 이메일이
동시에 나가는 것, 담당자 배정·심사 결과 확정 이메일이 템플릿 리팩터 이후에도
그대로 동작하는 것, `/admin/settings/email-templates`에서 문구 저장과 테스트
발송이 실제로 DB에 반영되고 메일이 나가는 것, 일반 admin 계정으로는 이 설정
화면에 접근하면 대시보드로 튕겨나가는 것을 확인했다. 두 크론 라우트는 마감일이
임박/초과하도록 조작한 테스트 행으로 직접 호출해 리마인드가 발송되고, 재호출 시
중복 발송되지 않는 것까지 확인했다.

## 대시보드 (명세서 09)

`11_개발우선순위와개발명세서목록.md`가 "지금까지 만든 데이터를 요약해서 보여주는
조회 전용 화면이므로 가장 나중에 만들어도 무방"이라고 규정한 범위 그대로,
`/portal`과 `/admin` 첫 화면을 링크 모음에서 실제 요약 화면으로 바꿨다. 새 테이블이나
서버 액션은 없다 — 전부 기존 RLS 스코프 쿼리를 재사용한다.

- **회사 측** (`08_주요화면과AC.md` 화면 3): 상태별 신청 건수, 회신 대기 중인 추가
  자료 요청(주황색 배너로 강조), 최근 신청서 5건.
- **관리자 측** (화면 14): 미배정 신청서 큐(강조), 내가 담당 중인 신청서, 전체
  상태별 건수, 최근 접수 5건. Super Admin에게만 이메일 템플릿 설정 링크가 보인다.

브라우저로 두 대시보드 모두 확인했다 — 미배정 큐·내 담당 목록·상태별 집계·최근
목록이 실제 DB 데이터와 일치하는 것, 회신 대기 요청이 있을 때만 배너가 뜨는 것을
확인했다. 데이터 격리는 이 화면이 기존 RLS 스코프 쿼리를 그대로 재사용할 뿐이라
스펙02·03·05~07에서 이미 반복 검증된 것과 동일한 보장을 받는다(새 접근 경로 없음).

## 직원 관리 · 활동 로그 (명세서 10) — Phase 1 마지막 명세서

`08_주요화면과AC.md` 화면 18("직원 관리 | Super Admin | 역할 부여/회수 즉시 반영,
계정 비활성화 시 즉시 로그인 차단")과 화면 19("활동 로그, 최소 버전")를 구현했다.

- **직원 초대·역할 관리** (`/admin/staff`, Super Admin 전용): company invite와
  같은 이유로 `inviteUserByEmail()`을 쓰되, `role: 'admin'` 메타데이터를 보내면
  `handle_new_user()` 트리거가 초대 즉시 `staff_members`를 active 상태로 만들어준다
  (회사 소속 여부 같은 모호함이 없어서 company_users처럼 별도 `invited` 단계가
  필요 없다). 역할 체크박스는 저장 시 선택된 역할 전체로 그대로 교체한다.
  마지막 남은 Super Admin의 Super Admin 역할은 회수할 수 없게 막는다 — 그렇지
  않으면 아무도 이 화면에 다시 들어올 수 없는 상태가 될 수 있다.
- **활동 로그(최소 버전)** (`lib/activity/log.ts`의 `recordActivity`): 모든
  엔터티가 아니라 신청서 심사(`review-actions.ts`)와 담당자 배정
  (`assignment-actions.ts`)처럼 가장 중요한 상태 변경 지점에만 기록한다.
  관리자 신청서 상세 화면에 "활동 이력" 섹션으로 보여준다(대상 엔터티, 변경
  전/후 상태, 변경자, 시각, 사유).

**검증 중 발견하고 고친 보안 버그**: "계정 비활성화 시 즉시 로그인 차단"을
테스트하려고 직접 REST로 `/auth/v1/user`를 호출해보니, `ban_duration`으로
계정을 정지시켜도 **이미 발급된 access token이 만료 전이면 여전히 200을
반환**했다 — GoTrue가 ban을 로그인·토큰 갱신 시점에만 확인하고, 유효기간 내
기존 JWT 자체를 그 자리에서 무효화하지는 않는다는 뜻이다. 기존 코드 주석은
"getUser()가 매번 서버에 재확인하니 즉시 반영된다"고 잘못 설명하고 있었다.
실제로 "즉시 차단"을 만족시키려면 `lib/auth/dal.ts`의 `verifySession()`이 매
요청마다 `staff_members.status`(관리자)/`company_users.status`(포털)를 DB에서
직접 조회해야 한다 — 이건 access token의 유효기간과 무관하게 즉시 반영된다.
포털 쪽은 원래 `requireCompanyMembership()`에만 이 확인이 있어서, 그 함수를
거치지 않는 화면(예: 새로 만든 대시보드)은 사각지대가 될 수 있었다. 두 area
모두 `verifySession()` 자체에 상태 확인을 넣어 어떤 화면을 거치든 항상
적용되게 고쳤다(`ban_duration`은 재로그인을 막는 보조 수단으로 유지).

브라우저와 직접 REST/스크립트로 확인한 것: (1) 정지된 계정은 새로 로그인할 수
없음(ban이 로그인 자체는 정상적으로 막음), (2) 이미 로그인된 세션도 같은
토큰으로 DB의 status만 바뀌면 다음 요청부터 `verifySession()`이 즉시 로그인
화면으로 돌려보냄, (3) 역할 저장이 실제로 DB에 반영되고 화면에도 바로
보임(본인의 Super Admin 역할을 해제하자 그 즉시 `/admin`으로 리다이렉트된
것으로도 확인), (4) 마지막 Super Admin 보호 가드가 정확한 문구로 차단함,
(5) 신청서 심사·배정 후 활동 이력이 신청서 상세 화면에 바로 나타남.

## 마케팅 사이트 신청 접수 연동 (Phase 1 이후 추가)

사용자 요청: "신청을 받고, 우리가 거래할 사람들에게만 포털을 제공하는 형식으로
하면 좋을 것 같아. 하지만 포털의 어드민에서는 회사 및 상품 정보가 접수는
되어야지, 그리고 접수 이메일도 보내주기는 할 거야." — 이 요구사항을 그대로
구현했다.

**이전 상태**: `kselectnetwork.com`(마케팅 사이트, `KBeautyWebsite/web`)의
"신청서 접수" 모달이 자체 API(`/api/applications`)로 로컬 파일시스템에 저장하고
있었다. 포털과는 완전히 분리되어 있어서, 접수된 문의가 포털 admin에 전혀 보이지
않았고 Vercel 같은 서버리스 환경에서는 `/tmp`에 쓰여 재배포 시 데이터가 사라질
위험까지 있었다.

**지금**: 마케팅 사이트의 `/api/applications`가 이 포털의 `/api/inquiries`로
서버 간 전달(proxy)한다(브라우저는 여전히 같은 origin만 호출하므로 CORS 설정이
필요 없다). `inquiries` 테이블은 `companies`/`company_users`와 완전히
분리되어 있다 — Super Admin이 아니라 일반 admin도 `/admin/inquiries`에서 검토할
수 있지만, **"전환" 버튼을 눌러야만** 실제 회사 계정이 생기고 담당자에게 포털
초대 메일이 나간다. 접수만으로는 어떤 포털 로그인 권한도 생기지 않는다.

- **접수 시**: `inquiry_received_applicant`(신청자 확인 메일) +
  `inquiry_received_internal`(내부 직원 전체 알림) 이메일이 나간다(둘 다
  명세서08의 이메일 템플릿 시스템을 그대로 재사용).
- **전환**: `companies` + `company_users`를 만들고
  `inviteUserByEmail()`(company invite와 동일한 메커니즘)로 초대 메일을 보낸다.
  **초대를 먼저 시도하고 성공해야만 회사를 만든다** — 처음엔 반대 순서였는데,
  검증 중 초대가 실패(잘못된 이메일 등)해도 아무도 못 쓰는 회사 행만 남는 문제를
  발견해 순서를 바꿨다. 회사 저장이 실패하면 이미 나간 초대를 롤백한다.
- **거절**: 내부용 사유만 남기고 종료, 역시 포털 권한은 생기지 않는다.
- 첨부파일은 `inquiry-uploads`(private 버킷)에 저장하고 관리자 화면에서
  서명된 URL로만 열람한다. `products`는 정규화된 Product 테이블과 구조가
  달라서(성분표·인증서 없음) 전환 시에도 그대로 옮기지 않는다 — 전환은 회사
  계정만 만들고, 실제 브랜드·제품 등록은 회사가 로그인해서 명세서02 화면으로
  직접 한다.

필요한 환경변수는 `INQUIRY_INTAKE_SECRET`(마케팅 사이트 쪽과 값이 같아야 함) —
`.env.local.example` 참고.

브라우저 UI 퀴즈를 거치지 않고 마케팅 사이트 `/api/applications`에 직접
스크립트로 요청을 보내 전체 경로(검증 → 포털 전달 → DB 저장 → 파일 업로드 →
이메일 2건 발송)를 확인했고, 관리자 화면에서 목록·상세·거절이 정상 동작하는 것을
확인했다. "전환"의 회사 생성까지는 확인했지만 초대 메일 발송 자체는 이 세션에서
Supabase 무료 티어의 이메일 발송 한도(하루 여러 번의 이전 테스트로 이미 소진)에
걸려 끝까지 재현하지 못했다 — 다만 같은 `inviteUserByEmail()` 호출은 명세서01
소속 사용자 초대, 명세서10 직원 초대에서 이미 여러 차례 검증된 것과 동일한
코드 경로라 신뢰할 수 있다.

## 데이터 격리 — Supabase RLS를 처음부터 강제

`10_보안과권한요구사항.md` 1번("회사 간 데이터는 물리적으로도, 논리적으로도 완전히
분리되어야 한다")을 만족시키기 위해, 이 프로젝트의 모든 테이블은 예외 없이 아래 규칙을
따른다 (`supabase/migrations/0001_init_auth_profiles.sql`에 실제 예시가 있다):

1. 테이블 생성 직후 반드시 `enable row level security` + `force row level security`를 건다.
2. 조회·수정 권한은 전부 RLS 정책(`create policy ...`)으로 표현한다. 애플리케이션 코드의
   `if` 문으로 "이 회사 것만 보여준다"를 구현하지 않는다 — URL을 직접 조작해도 막혀야 하기
   때문이다.
3. 일반 데이터 조회·입력은 항상 `lib/supabase/server.ts`(publishable 키, RLS 적용됨)를
   사용한다. `lib/supabase/admin.ts`(secret 키, RLS 우회)는 계정 비활성화처럼 사용자 본인
   세션으로는 할 수 없는 극히 제한된 서버 내부 작업에만 쓴다.

향후 명세서에서 Company, Brand, Product, Application 등을 추가할 때도 이 패턴(테이블마다
RLS 활성화 + `auth.uid()` 또는 소속 `company_id`/`staff_id` 기준 정책)을 그대로 반복한다.

## 환경변수

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채운다. `.env.local`은 git에
커밋되지 않는다(`.gitignore`).

```bash
cp .env.local.example .env.local
```

| 변수 | 용도 | 어디서 얻나 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 주소 | Supabase 대시보드 > Project Settings > General(또는 상단 Connect 버튼) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저에 노출돼도 되는 공개 키 | Project Settings > API Keys > Publishable and secret API keys 탭 |
| `SUPABASE_SECRET_KEY` | RLS를 우회하는 관리자 키(구 service_role). 절대 브라우저 노출 금지 | 위와 동일 |
| `NEXT_PUBLIC_SITE_URL` | 이 포털이 배포된 주소 | 로컬은 `http://localhost:3000`, 운영은 `https://portal.kselectnetwork.com` |
| `RESEND_API_KEY` (선택) | 심사 결과 등 업무 알림 이메일 발송. 없으면 콘솔 로그로 대체 | [resend.com](https://resend.com) 대시보드 |
| `EMAIL_FROM_ADDRESS` (선택) | 알림 이메일의 발신 주소 | Resend에서 인증한 도메인의 주소 |
| `CRON_SECRET` (운영 배포 시 필수) | Vercel Cron이 `/api/cron/*` 라우트를 호출할 때의 인증. 로컬 개발은 비워둬도 동작 | 임의의 긴 랜덤 문자열을 직접 생성해 Vercel 프로젝트 환경변수에도 동일하게 등록 |

값이 비어 있거나 형식이 틀리면 `lib/env/public.ts`, `lib/env/server.ts`가 앱 시작 시점에
바로 에러를 던진다(런타임 중간에야 발견되는 것을 방지).

## Supabase 프로젝트 준비

1. https://supabase.com/dashboard 에서 새 프로젝트 생성 (무료 티어로 시작 가능)
2. Project Settings > General에서 URL, API Keys에서 Publishable key·Secret key 확인 →
   `.env.local`에 입력
3. SQL Editor에서 `supabase/migrations/` 안의 파일을 **번호 순서대로**(0001 → 0002 → 0003 → 0004 → 0005)
   전부 실행한다. `create table` 다음에 그 테이블을 참조하는 `create function`이 오는
   순서를 반드시 지켜야 한다 — `language sql` 함수는 plpgsql과 달리 생성 시점에 본문이
   참조하는 테이블의 존재 여부를 검증하기 때문에, 순서가 바뀌면 `relation ... does not
   exist` 에러가 난다.
4. Authentication > Providers > Email에서 "Confirm email"은 켜둔 채로 둔다(기본값,
   권장값 — 이유는 아래 인증 섹션 참고).
5. Authentication > Users에서 관리자 콘솔(`/admin`) 테스트 계정을 직접 추가하고,
   `profiles` 테이블에 해당 `id`로 `role = 'admin'`인 행을 넣는다 — `/portal` 쪽 계정은
   이제 회원가입 화면(`/portal/signup`)으로 직접 만들 수 있다.
6. 운영 배포 전에는 반드시 커스텀 SMTP를 연결한다(아래 "이메일 발송 관련 주의" 참고).

## 로컬 개발

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인. Supabase 환경변수가 없으면 로그인 화면 진입 시 에러가
발생하니, 위 "Supabase 프로젝트 준비"를 먼저 완료해야 한다.
