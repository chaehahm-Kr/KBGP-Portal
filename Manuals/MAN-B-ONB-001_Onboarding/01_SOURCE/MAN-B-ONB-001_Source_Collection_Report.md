# MAN-B-ONB-001: Brand Portal Onboarding Manual — Production Source Collection Report

**Manual ID:** `MAN-B-ONB-001`  
**Task Name:** `Brand Portal Onboarding Manual — Production Source Collection`  
**Phase:** `01_SOURCE (Source Collection & System Behavior Audit)`  
**Portal:** `K SELECT Brand Portal (portal.kselectnetwork.com)`  
**Topic:** `시작하기 / Onboarding`  
**Target Audience:** `Brand Partner Administrators & Operation Managers`  
**Author:** `Antigravity Agent`  
**Reviewed by:** `Pending Chae + ChatGPT Review`  

---

## 1. Executive Summary

본 보고서는 K SELECT Brand Portal의 공식 온보딩 매뉴얼(`MAN-B-ONB-001`) 제작을 위해 **현재 Production 시스템(`https://portal.kselectnetwork.com`) 및 실제 Codebase(Next.js App Router, Supabase RLS, Server Actions, Tailwind CSS)**를 전수 감사하여 수집한 **Source Collection Report**입니다.

본 보고서의 모든 내용은 **실제 동작 코드 및 데이터베이스 스키마에 기반**하며, 확실히 검증된 동작(`VERIFIED SYSTEM BEHAVIOR`), 코드 분석 기반 추론(`INFERENCE`), 관리자 및 경영진의 정책 결정이 필요한 사항(`DECISION REQUIRED`)으로 엄격히 구분하여 기술되었습니다.

### 핵심 시스템 구조 요약
1. **이원화된 포털 접근 모드:**
   - **Pre-Approval Mode (입점 심사 대기 모드):** 신청서 접수 및 심사 중인 상태. 대시보드에 심사 진행 타임라인 및 추가 정보 요청 배너 노출.
   - **Operational Mode (운영 모드):** 파트너 승인 완료 후 7단계 온보딩 체크리스트 및 운영 KPI/Action Required 위젯 노출.
2. **2개 가입 및 계정 활성화 경로:**
   - **공개 입점 신청 확인 경로 (Public Application Path):** `kselectnetwork.com` 신청서 제출 후 사업자등록번호(BRN) + 이메일 대조를 통한 비밀번호 설정.
   - **어드민 직접 초청 토큰 경로 (Admin Direct Token Path):** 어드민에서 발송한 7일 유효 보안 토큰 링크 접속 → 이메일 소유 확인 → 6자리 OTP 인증(5분 유효) → 비밀번호 설정.
3. **단일 진실 공급원(Single Source of Truth) 7단계 온보딩 체크리스트:**
   - 대시보드(`app/portal/page.tsx`) 및 어드민 파트너 관리(`evaluateCompanyOnboarding`)에서 완전히 동일한 7단계 평가 엔진(`lib/company/onboarding-status.ts`)을 공유.

---

## 2. Actual Production Workflow & User Entry

```text
[경로 A: 공개 파트너십 신청]                      [경로 B: 어드민 직접 초청]
  kselectnetwork.com 신청서 접수                       Admin 직접 등록 및 초청 메일 발송
          │                                                    │
          ▼                                                    ▼
  어드민 심사 및 가입요청 발송                        초청 링크 클릭 (?token=...)
          │                                                    │
          ▼                                                    ▼
  /portal/signup 접속                                 /portal/signup?token=...
  (사업자등록번호 + 이메일 조회)                       (이메일 확인 + 6자리 OTP 인증)
          │                                                    │
          └─────────────────────────┬──────────────────────────┘
                                    ▼
                         비밀번호 설정 (8자 이상, 영문+숫자+특수문자)
                                    │
                                    ▼
                         /portal/login 로그인
                                    │
                                    ▼
                         Brand Portal Dashboard (/portal)
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
 [Pre-Approval Mode]                                    [Operational Mode]
 (신청서 심사 중 타임라인 노출)                           (7-Step 온보딩 체크리스트 시작)
                                                                │
                                                                ▼
                                                    STEP 1: 회사 정보 확인
                                                    STEP 2: 관리자 프로필 확인
                                                    STEP 3: 브랜드 정보 확인
                                                    STEP 4: 팀원 초대 (선택/건너뛰기)
                                                    STEP 5: 6대 담당업무 주 담당자 지정
                                                    STEP 6: 최소 1개 상품 등록 완료
                                                    STEP 7: 공급계약서 전자서명 체결
                                                                │
                                                                ▼
                                                    🎉 온보딩 완료 (100%)
```

---

## 3. Detailed Step-by-Step System Audit

### [STEP 0] 계정 가입 및 로그인 (Signup & Authentication)

#### 1. 공개 신청 확인 경로 (Public Marketing Application Flow)
- **URL:** `/portal/signup`
- **검증 항목:** 사업자등록번호 (`brn`), 신청 당시 이메일 (`email`)
- **시스템 처리 로직 (`verifyPartnerApplicationAction`):**
  - 입력된 BRN의 특수문자/공백 제거 후 DB `companies.business_registration_number`와 대조.
  - 해당 회사의 `company_users` 중 이메일 대소문자 무시 일치 확인.
  - **Case A (내역 없음):** 입점 신청 내역 없음 에러 화면 (`result_A`) 표시 → `kselectnetwork.com/#eligibility` 신청 링크 제공.
  - **Case B (심사 대기):** `status === 'invited'`이나 `invited_at`이 `null`인 경우 → 심사 대기 중 화면 (`result_B`) 표시.
  - **Case C (기 가입):** `status === 'active'`인 경우 → 이미 가입된 계정 안내 (`result_C`) 표시 및 로그인 링크 제공.
  - **Case D (가입 가능):** `status === 'invited'` 및 `invited_at` 존재 시 → 비밀번호 설정 단계 진입.

#### 2. 어드민 직접 초청 토큰 경로 (Admin Direct Token Flow)
- **URL:** `/portal/signup?token={rawToken}`
- **시스템 처리 로직 (`verifyBrandInvitationTokenAction`):**
  - URL의 토큰을 SHA-256 해싱하여 `company_users.invitation_token_hash`와 대조 (만료 기간: 7일).
  - 토큰 유효 시 담당자 성명 및 마스킹/확인 이메일 화면(`email_confirm`) 표시.
  - **OTP 인증 발송 (`sendInvitationVerificationCodeAction`):** 초청 이메일로 6자리 무작위 난수 발송 (유효 기간: 5분).
  - **OTP 인증 확인 (`verifyInvitationCodeAction`):** 6자리 번호 일치 시 `permissions.email_verified = true` 처리 후 비밀번호 설정 단계 진입.

#### 3. 비밀번호 설정 규칙 (`lib/auth/password.ts`)
- 최소 8자 이상, 최대 72자 이하.
- 영문(대/소문자), 숫자, 특수문자(!@#$%^&* 등)를 반드시 각각 1개 이상 포함.
- 활성화 완료 시 `company_users.status = 'active'`, `company_users.joined_at = NOW()` 갱신.

---

### [STEP 1] 회사 정보 확인 (Company Info Verification)

- **경로:** `/portal/company/info`
- **목적:** 브랜드 파트너사의 공식 법인 정보, 필수 미국/글로벌 우편 주소, 대표 연락처 및 로고 등록.
- **주요 입력 필드:**
  - 공식 법인명 (`name` - 필수)
  - 설립 국가 (`country` - 필수)
  - 사업자등록번호 (`business_registration_number` - 수정 불가, 변경 시 고객지원 문의 필요)
  - 회사 대표 전화번호 (`contact_phone` - 국제 전화번호 형식 지원)
  - **필수 4대 주소 필드:**
    - 기본 주소 (`address_1` - 필수)
    - 상세 주소 (`address_2` - 선택)
    - 시 (`city` - 필수)
    - 주/도 (`state` - 필수)
    - 우편번호 (`zip_code` - 필수)
  - 웹사이트 (`website` - 선택)
  - 회사 로고 이미지 (`portalUploadCompanyLogo` - PNG, WebP, JPG 지원, Storage: `company-uploads`)
- **온보딩 완료 조건 (`isCompanyInfoConfirmed`):**
  - `companies.intro` JSON 내 `company_onboarding_confirmed_at` 타임스탬프 존재.
  - **AND** `address_1`, `city`, `state`, `zip_code` 4개 주소 필드가 모두 공백 없이 저장되어 있어야 함.
- **UI 특징:** 상단에 `온보딩 STEP 1 — 회사 정보 확인` 노란색 안내 배너가 표시되며, 주소 누락 시 `주소 입력 필요` 배지가 노출되고 `회사 정보 확인 완료 ✓` 버튼을 눌러 확정.

---

### [STEP 2] 관리자 프로필 확인 (Admin Profile Verification)

- **경로:** `/portal/account`
- **목적:** K SELECT와의 원활한 글로벌 커뮤니케이션을 위한 대표 관리자의 국문/영문 프로필 등록.
- **주요 입력 필드:**
  - 한글 성 (`koreanLastName` - 필수, 예: `홍`)
  - 한글 이름 (`koreanFirstName` - 필수, 예: `길동`)
  - 영문 이름 (`firstName` - 필수, 예: `Gildong`, 영문/하이픈/공백만 허용)
  - 영문 성 (`lastName` - 필수, 예: `Hong`, 영문/하이픈/공백만 허용)
  - 직함 (`title` - 필수, 예: `대표이사`, `팀장`)
  - 부서/직책 (`position` - 선택, 예: `해외영업팀`)
  - 연락처 (`phone` - 필수)
- **온보딩 완료 조건 (`isAdminProfileConfirmed`):**
  - `companies.intro` JSON 내 `admin_profile_onboarding_confirmed_at` 타임스탬프 존재.
  - **AND** `company_users` 테이블 내 `name`, `english_name`, `title`, `phone`이 모두 등록되어 있어야 함.
- **시스템 동기화:** 저장 시 `company_users`, `profiles.display_name`, `companies.intro` 메타데이터 내 contacts 배열 및 `companies.contact_name`, `companies.contact_phone`이 일괄 자동 동기화됨.

---

### [STEP 3] 브랜드 정보 확인 (Brand Info Verification)

- **경로:** `/portal/brands`
- **목적:** 유통할 대표 브랜드 정보 확인 및 대한민국(KIPO) / 미국(USPTO) 상표권 등록 상태 검토.
- **주요 입력 필드:**
  - 브랜드명 (`name` - 필수)
  - 브랜드 소개 (`intro_text` - 선택)
  - 브랜드 로고 (`logo_path` - Storage 업로드)
  - 한국 상표권 등록 여부 (`has_kr_trademark` - Yes/No) 및 등록번호/증빙파일
  - 미국 상표권 등록 여부 (`has_us_trademark` - Yes/No) 및 등록번호/증빙파일
- **온보딩 완료 조건 (`isBrandConfirmed`):**
  - `companies.intro` JSON 내 `brand_onboarding_confirmed_at` 타임스탬프 존재.
  - **AND** 활성 브랜드 수(`is_active !== false`)가 1개 이상 존재해야 함.
- **UI 특징:** 브랜드 관리 상단에 `BrandOnboardingBanner`가 노출되며 `브랜드 정보 확인 완료 ✓` 버튼을 클릭하여 확정.

---

### [STEP 4] 팀원 초대 (Team Invitation - Optional)

- **경로:** `/portal/company/users`
- **목적:** 사내 협업 담당자(영업, 물류, 정산 등)를 포털에 초대하여 업무 분담.
- **선택 여부:** **선택 사항 (Optional)** — 1인 기업이거나 즉시 초대가 불필요한 경우 건너뛸 수 있음.
- **주요 기능:**
  - 팀원 초대 버튼 클릭 → 이메일, 성명, 직함, 포털 권한(회사 관리자 vs 일반 멤버), 세부 메뉴별 읽기/쓰기 ACL 설정.
  - 초대 메일 자동 발송 (7일 유효 보안 토큰 포함).
- **온보딩 완료 조건 (`isTeamComplete`):**
  - `company_users` 등록 인원이 2명 이상인 경우.
  - **OR** 대시보드 체크리스트에서 `나중에 하기` 버튼을 클릭하여 `companies.intro.team_onboarding_skipped === true` 처리된 경우.

---

### [STEP 5] 6대 담당업무 및 주 담당자 지정 (Task Owner Assignment)

- **경로:** `/portal/company/info?tab=tasks`
- **목적:** 발주, 선적, 계약, 정산 등 업무 발생 시 K SELECT 운영팀이 신속히 소통할 6대 핵심 업무별 주 담당자 및 알림 수신자 지정.
- **6대 핵심 업무 영역 (`lib/company/task-constants.ts`):**
  1. `company_apply` (**회사·신청**): 회사 정보, 브랜드 등록, 입점 신청, 보완 및 심사 관련 업무
  2. `contract` (**계약**): 계약서 확인, 계약 조건 검토, 서명 및 갱신 관련 업무
  3. `product_cert` (**제품·콘텐츠·인증**): 제품 정보, 콘텐츠, 이미지, 성분, 인증 및 규제 서류 관련 업무
  4. `pricing_quote` (**가격·견적**): 공급가격, 원가, 견적, 가격 검토 및 승인 관련 업무
  5. `logistics_inventory` (**발주·물류·재고**): 발주, 생산, 선적, 입고, 물류 및 재고 관련 업무
  6. `settlement_inquiry` (**정산·문의**): 인보이스, 지급, 정산, 일반 문의 및 이슈 대응 업무
- **조작 방식:**
  - 각 업무별 드롭다운에서 `주 담당자`를 소속 활성 팀원 중 1명으로 선택 (1인이 6개 업무를 모두 겸임 가능).
  - 해당 업무 관련 이메일 알림을 수신할 `알림 수신인` 체크박스 다중 선택 가능.
  - 하단 `담당업무 설정 저장` 버튼을 클릭하여 일괄 저장.
- **온보딩 완료 조건 (`isTaskComplete`):**
  - 6개 업무 영역 모두에 주 담당자(`is_primary === true`)가 지정되어 있어야 함 (`primaryTaskCount >= 6`).

---

### [STEP 6] 상품 등록 완료 (Product Registration)

- **경로:** `/portal/products`
- **목적:** 미국 시장에 공급할 대표 상품을 최소 1개 이상 완전한 규격 및 가격 정보로 등록.
- **상품 등록 완성도 판정 기준 (`evaluateProductRegistrationStatus`):**
  - 단순 임시저장(Draft) 상태는 미완료로 간주되며, 아래 필수 항목이 모두 채워져 **`등록 완료(COMPLETE)`** 판정을 받아야 함:
    1. **기본 정보:** 브랜드 선택, 영문 제품명, 제조사 SKU, 원산지(Origin)
    2. **카테고리 & 필수 속성:** 1Depth/2Depth/3Depth 카테고리 지정 및 해당 카테고리 필수 속성값 입력
    3. **가격 정보:** 소비자 판매가 (`price_krw_retail` > 0), FOB 수출 가격 (`price_usd_fob` > 0)
    4. **로지스틱스 규격 (3단계 필수):**
       - 단품 규격: 가로, 세로, 높이, 무게 > 0
       - 단품 포장(Package) 규격: 가로, 세로, 높이, 무게 > 0
       - 마스터 카톤(Carton) 규격: 입수량(`carton_pack_qty` > 0), 가로, 세로, 높이, 무게 > 0
    5. **식별 바코드:** 유효한 12자리 UPC 또는 13자리 EAN 번호
    6. **미디어:** 최소 1장 이상의 대표 상품 이미지 업로드
- **온보딩 완료 조건 (`isProductComplete`):**
  - `completeProductCount >= 1` (완전 등록된 상품 1개 이상).

---

### [STEP 7] 상품공급 및 플랫폼 이용 기본계약 체결 (Agreement Signing)

- **경로:** `/portal/company/info?tab=agreements`
- **목적:** 브랜드 공급, 미국 유통 및 K SELECT 플랫폼 이용 기본계약서(비독점) 검토 및 전자서명 체결.
- **계약 체결 프로세스:**
  1. `/portal/company/info?tab=agreements` 탭 진입.
  2. 계약서 카드에서 `✍️ 계약서 확인 / 서명` 버튼 클릭.
  3. 모달 내에서 양사 정보(상호, 주소, 대표자 성명) 및 전문 약관 조항 검토.
  4. 서명자 정보(성명, 직함, 서명일) 입력 및 서명 패드에 서명 작성.
  5. 서명 완료 시 PDF 계약서가 자동 생성/암호화 보관되며, 계약 상태가 `active`로 변경.
  6. 서명자 및 사전 등록된 추가 수신자에게 서명 완료된 계약서 PDF가 이메일로 자동 전송됨.
- **온보딩 완료 조건 (`isAgreementComplete`):**
  - `company_agreements.status === 'active'`.

---

## 4. System Logic Matrix (UI vs. Server vs. DB)

| 온보딩 단계 | 화면 경로 (Route) | Server Action / Dal Function | DB 테이블 및 완료 플래그 | 완료 판정 조건 (Evaluation Logic) |
| :--- | :--- | :--- | :--- | :--- |
| **STEP 0: 가입** | `/portal/signup` | `verifyPartnerApplicationAction`<br>`activatePartnerAccountWithTokenAction` | `company_users.status = 'active'`<br>`company_users.joined_at` | 비밀번호 설정 및 계정 활성화 완료 |
| **STEP 1: 회사 정보** | `/portal/company/info` | `updateCompanyPortalMetadata`<br>`confirmCompanyOnboardingAction` | `companies.intro` JSON:<br>`company_onboarding_confirmed_at`<br>`address_1`, `city`, `state`, `zip_code` | `company_onboarding_confirmed_at` 존재 **AND** 필수 4대 주소값 모두 존재 |
| **STEP 2: 관리자 정보** | `/portal/account` | `updateMyAccountProfileAction` | `companies.intro` JSON:<br>`admin_profile_onboarding_confirmed_at`<br>`company_users` (name, english_name, title, phone) | `admin_profile_onboarding_confirmed_at` 존재 **AND** 관리자 4대 필드 모두 존재 |
| **STEP 3: 브랜드 정보** | `/portal/brands` | `confirmBrandOnboardingAction` | `companies.intro` JSON:<br>`brand_onboarding_confirmed_at`<br>`brands` 테이블 | `brand_onboarding_confirmed_at` 존재 **AND** `is_active` 브랜드 수 >= 1 |
| **STEP 4: 팀원 초대** | `/portal/company/users` | `inviteCompanyUser`<br>`skipTeamOnboardingAction` | `company_users` 레코드 수<br>`companies.intro.team_onboarding_skipped` | 소속 사용자 수 >= 2 **OR** `team_onboarding_skipped === true` |
| **STEP 5: 담당업무** | `/portal/company/info?tab=tasks` | `saveCompanyTaskAssignmentsBatch` | `company_task_assignments`<br>(`is_primary = true`) | 6대 업무 영역 모두 `is_primary` 지정 완료 (`count >= 6`) |
| **STEP 6: 상품 등록** | `/portal/products` | `evaluateProductRegistrationStatus`<br>`saveProductDraftAction` | `products` 테이블<br>(SKU, FOB/Retail가, 규격, 바코드, 이미지) | `completeProductCount >= 1` (`evaluateProductRegistrationStatus` 통과) |
| **STEP 7: 계약 체결** | `/portal/company/info?tab=agreements` | `signCompanyAgreementAction`<br>`getCompanyAgreement` | `company_agreements.status` | `company_agreements.status === 'active'` |

---

## 5. Issues & Decisions Classification

코드 및 UI 전수 감사 과정에서 발견된 이슈들을 성격별로 명확히 분류하였습니다.

### [UX ISSUE / SYSTEM CONSISTENCY]
1. **브랜드 온보딩 배너 단계 표기 불일치:**
   - `components/brand/brand-onboarding-banner.tsx`의 텍스트가 `온보딩 4단계: 브랜드 정보 및 상표권 확인 필요`로 하드코딩되어 있음.
   - 실제 단일 진실 공급원인 7단계 체크리스트에서는 브랜드 정보 확인이 **`STEP 3`**임. (매뉴얼에는 `STEP 3`으로 통일하여 기술).
2. **회사 정보 주소 필수값 안내 UI 강화 필요:**
   - 대시보드 체크리스트에는 주소 4대 필드가 필수임을 명시하고 있으나, 회사 정보 수정 폼에서는 `상세 주소(선택)` 외 다른 필드에 대한 필수 표시(`*`)가 다소 시각적으로 약함.

### [POLICY DECISION / MANUAL CLARIFICATION]
1. **상품 등록 완료의 필수 선행 여부:**
   - **현재 시스템:** STEP 1~7은 병렬적으로 언제든 클릭하여 수행할 수 있으며, 엄격한 선후관계(Strict Gating)로 다른 단계를 블로킹하지 않음.
   - **매뉴얼 안내:** 순서대로 진행하는 것을 권장하되, 서류 준비 상태에 따라 유연하게 진행할 수 있음을 명시해야 함.
2. **계약 체결 전 상품 등록 및 포털 이용 가능 여부:**
   - **현재 시스템:** 계약 체결(`STEP 7`)이 완료되지 않아도 상품 등록, 견적 조회 등 포털 내 기능을 정상적으로 사용할 수 있음.
   - **매뉴얼 안내:** "계약 체결 대기 중이라도 상품 정보 등록 및 포털 기능은 자유롭게 이용하실 수 있습니다"라는 공식 안내 포함 필요.

---

## 6. Relationship with Published `MAN-BRAND-001`

| 구분 | MAN-B-ONB-001 (본 온보딩 매뉴얼) | MAN-BRAND-001 (기 발행 브랜드 정책 매뉴얼) |
| :--- | :--- | :--- |
| **핵심 목적** | 포털 가입부터 7단계 온보딩 완료까지의 **End-to-End 시작 가이드** | 브랜드 등록 기준, 상표권 요건, 비활성화 정책 등 **브랜드 도메인 심층 규정** |
| **다루는 범위** | 계정 가입, 로그인, 회사 정보, 관리자 프로필, 브랜드 온보딩 확인, 팀원 초대, 6대 업무 지정, 상품 등록 완료 요건, 계약 체결 | 브랜드 신규 등록 절차, KIPO/USPTO 상표권 등록 증빙 요건, 브랜드 수정/비활성화 시 상품 영향도 |
| **상호 참조 방식** | STEP 3 브랜드 확인에서 상표권 및 세부 정책이 필요한 경우 `MAN-BRAND-001` 링크 참조 유도 | 매뉴얼 도입부에서 온보딩 프로세스(`MAN-B-ONB-001`)와의 연계성 언급 |

---

## 7. Recommended `MAN-B-ONB-001` Table of Contents (ToC)

- **Chapter 1. 개요 및 시작하기 안내**
  - 1.1 K SELECT Brand Portal 소개
  - 1.2 온보딩 전체 흐름 및 7단계 로드맵
  - 1.3 계정 권한 및 지원 브라우저 환경
- **Chapter 2. 계정 가입 및 로그인**
  - 2.1 공개 입점 신청 후 계정 활성화 경로
  - 2.2 어드민 직접 초청 링크 및 이메일 OTP 인증
  - 2.3 비밀번호 설정 규칙 및 로그인
  - 2.4 비밀번호 찾기 및 계정 보안
- **Chapter 3. 포털 대시보드 및 온보딩 체크리스트 활용**
  - 3.1 대시보드 화면 구성 (Pre-Approval vs. Operational)
  - 3.2 온보딩 진행률 및 상태 확인
- **Chapter 4. 7단계 온보딩 상세 가이드**
  - 4.1 [STEP 1] 회사 정보 확인 및 필수 주소 등록
  - 4.2 [STEP 2] 대표 관리자 프로필(국문/영문) 등록
  - 4.3 [STEP 3] 대표 브랜드 확인 및 상표권 상태 점검
  - 4.4 [STEP 4] 사내 팀원 초대 및 권한 부여 (선택)
  - 4.5 [STEP 5] 6대 핵심 운영 업무별 주 담당자 지정
  - 4.6 [STEP 6] 대표 상품 등록 및 완성도 요건 충족
  - 4.7 [STEP 7] 상품공급 및 플랫폼 이용 기본계약 전자서명 체결
- **Chapter 5. 온보딩 완료 후 운영 및 문제 해결**
  - 5.1 온보딩 100% 완료 후 다음 단계 (상품 검토, 발주, 정산)
  - 5.2 단계별 정보 수정 및 업데이트 방법
  - 5.3 1:1 고객지원(Support) 및 도움말 센터 활용

---

## 8. FAQ Candidates (Questions Only)

1. [가입] 파트너십 신청서를 제출했는데 가입 확인 시 "입점 신청 내역 없음"이라고 나옵니다. 어떻게 해야 하나요?
2. [가입] 어드민 초청 이메일을 받았는데 링크를 누르면 "초청 링크 만료"라고 뜹니다.
3. [가입] 이메일 인증 번호(OTP)가 도착하지 않거나 5분이 지났습니다.
4. [체크리스트] 온보딩 7단계를 반드시 순서대로 진행해야 하나요?
5. [회사 정보] 사업자등록번호가 변경되었는데 포털에서 직접 수정할 수 있나요?
6. [회사 정보] 회사 주소를 입력했는데 STEP 1이 미완료로 표시됩니다.
7. [관리자 정보] 영문 이름은 왜 필수이며 여권 철자와 일치해야 하나요?
8. [브랜드] 등록된 브랜드가 여러 개인 경우 어떤 브랜드를 확인해야 하나요?
9. [팀원 초대] 1인 기업이라 초대할 팀원이 없는데 STEP 4를 완료할 수 있나요?
10. [담당업무] 한 명의 담당자가 6개 업무를 모두 담당해도 되나요?
11. [상품 등록] 상품을 등록했는데 왜 계속 `Draft(보완 대기)`로 표시되나요?
12. [상품 등록] 로지스틱스 규격(단품, 패키지, 카톤)을 모두 입력해야 등록 완료가 되나요?
13. [계약] 계약서에 서명하기 전에 계약 조항을 먼저 검토할 수 있나요?
14. [계약] 전자서명이 완료된 계약서 사본은 어디서 다시 확인할 수 있나요?
15. [계약] 계약서 서명 권한은 회사 내 누구에게 있나요?

---

## 9. Open Questions for Chae

| # | 항목 | 현재 시스템 동작 (Current Behavior) | 확인 및 결정 필요 사항 (Question) | 결정 필요 이유 (Why Needed) | 우선순위 |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **Q1** | **브랜드 온보딩 배너 문구 불일치** | `components/brand/brand-onboarding-banner.tsx`에 `온보딩 4단계`로 하드코딩되어 있음. | 매뉴얼에는 공식 7단계 체크리스트 순서에 맞추어 `STEP 3 (브랜드 정보 확인)`으로 통일하여 작성할지 여부 | 사용자 혼선 방지 및 UI-매뉴얼 정합성 확보 | **HIGH** |
| **Q2** | **상품 등록 규격 필수 입력 엄격도** | 단품/패키지/카톤 가로·세로·높이·무게 및 바코드가 모두 입력되어야 `COMPLETE`로 판정되어 STEP 6이 완료됨. | 신규 입점 브랜드가 카톤 규격이나 바코드가 즉시 없는 경우 임시 예외 정책이 있는지, 아니면 매뉴얼에 필수 요건으로 명확히 안내할지 여부 | 브랜드 온보딩 완료율 및 물류 데이터 정확도 균형 | **MEDIUM** |
| **Q3** | **계약 체결 전 주문/운영 제한 여부** | 현재 시스템은 계약 미체결 상태에서도 상품 등록, 가격 설정 등 포털 기능을 제한 없이 이용 가능함. | 매뉴얼에 "계약 체결 전이라도 상품 등록 및 사전 준비는 즉시 진행 가능"함을 공식 팁(Tip)으로 강조할지 여부 | 온보딩 진행 중 파트너의 이탈 방지 및 신속한 상품 등록 유도 | **MEDIUM** |
| **Q4** | **1인 관리자의 6대 업무 일괄 지정** | 드롭다운에서 6개 업무를 동일한 1인으로 지정 시 6/6 완료 처리됨. | 매뉴얼 작성 시 "1인 기업의 경우 대표 관리자가 6대 업무를 모두 겸임 지정할 수 있습니다"라는 안내 문구를 명시할지 여부 | 1인 또는 소규모 브랜드 파트너의 의문 해소 | **LOW** |
