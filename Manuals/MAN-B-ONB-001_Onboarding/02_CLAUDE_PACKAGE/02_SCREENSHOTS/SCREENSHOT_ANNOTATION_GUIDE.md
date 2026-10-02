# MAN-B-ONB-001: Screenshot Annotation & Visual Guide

**Manual ID:** `MAN-B-ONB-001`  
**Document:** `Screenshot Annotation & Design Callout Specification`  
**Package Folder:** `02_SCREENSHOTS/`  

---

## 1. General Screenshot Styling & Rules

- **Callout Style:** Indigo/Navy filled circular numbered badges (①, ②, ③, ④) with crisp white text.
- **Bounding Box:** Thin 1.5px border (`#4F46E5` or `#131E2E`) with slight rounded corners around highlighted UI elements.
- **Masking:** Any private personal email addresses, phone numbers, or BRN identifiers in sample data should use subtle neutral placeholder styling (`Letusto Inc`, `qa-portal-test@letusto.com`).
- **Integrity Rule:** Do NOT alter the underlying UI components, text, or layout of the screenshots. Only overlay callout markers and bounding boxes as specified below.
- **Fabrication Protection Rule:** If a screenshot is not included in the approved Claude Package, do not fabricate, redraw, simulate, or recreate the K SELECT Portal UI.

---

## 2. Per-Screenshot Annotation Specifications

### [SS-01] `ONB-SS-01_Signup-Public.png`
- **Manual Section:** Chapter 3.1 (가입 확인 및 계정 활성화)
- **화면 명칭:** 파트너십 가입 내역 확인 (`/portal/signup`)
- **화면 목적:** 공개 신청 파트너의 사업자등록번호 + 이메일 조회 및 활성화 진입
- **Callout 번호 및 대상:**
  - **①:** 섹션 1 — "이미 파트너십을 신청하셨나요?" 입력 폼 (사업자등록번호, 이메일 주소 필드)
  - **②:** "신청 내역 확인" CTA 버튼
  - **③:** 섹션 2 — "아직 파트너십을 신청하지 않으셨나요?" 신청 링크 안내
- **Caption:** `[그림 3-1] 파트너십 신청 내역 조회 및 계정 활성화 화면`
- **Crop / Focus:** 중앙 카드 컨테이너 중심 포커스.

---

### [SS-02] `ONB-SS-02_Onboarding-Overview.png`
- **Manual Section:** Chapter 2 (온보딩 전체 흐름)
- **화면 명칭:** Brand Portal 온보딩 대시보드 (`/portal`)
- **화면 목적:** 7단계 온보딩 진행률 및 각 단계별 상태 카드 확인
- **Callout 번호 및 대상:**
  - **①:** 상단 진행률 요약 배지 (`N / 7 완료 (X%)`) 및 프로그레스 바
  - **②:** 상단 6개 온보딩 단계 카드 (STEP 1: 회사, STEP 2: 관리자, STEP 3: 브랜드, STEP 4: 팀원, STEP 5: 업무, STEP 6: 상품)
  - **③:** 하단 STEP 7 와이드 히어로 카드 (최종 법적 체결 단계 — 기본계약 확인·서명)
- **Caption:** `[그림 2-1] Brand Portal 대시보드 7단계 온보딩 체크리스트`
- **Crop / Focus:** 온보딩 체크리스트 전체 영역 포커스.

---

### [SS-03] `ONB-SS-03_Company-Information.png`
- **Manual Section:** Chapter 4 (STEP 1: 회사 정보 확인)
- **화면 명칭:** 회사 정보 관리 (`/portal/company/info`)
- **화면 목적:** 법인 기본 정보 및 필수 4대 주소(기본/시/도/우편번호), 로고 확인
- **Callout 번호 및 대상:**
  - **①:** 상단 STEP 1 온보딩 안내 배너 및 "회사 정보 확인 완료 ✓" 버튼
  - **②:** 우측 상단 "수정" / "저장" 버튼
  - **③:** 회사 필수 4대 주소 입력 영역 (기본 주소, 시, 도, 우편번호)
  - **④:** 회사 로고 업로드 영역
- **Caption:** `[그림 4-1] 회사 정보 및 필수 주소 등록 화면`
- **Crop / Focus:** 좌측 회사 정보 카드 및 상단 온보딩 배너 중심.

---

### [SS-04] `ONB-SS-04_Admin-Profile.png`
- **Manual Section:** Chapter 5 (STEP 2: 관리자 정보 확인)
- **화면 명칭:** 내 계정 관리 (`/portal/account`)
- **화면 목적:** 대표 관리자의 국문/영문 프로필 및 직함, 연락처 등록
- **Callout 번호 및 대상:**
  - **①:** 한글 성 및 한글 이름 필드
  - **②:** 영문 이름(First Name) 및 영문 성(Last Name) 필드
  - **③:** 직함(Job Title) 및 연락처 필드
  - **④:** "프로필 정보 저장" 액션 버튼
- **Caption:** `[그림 5-1] 대표 관리자 국문/영문 프로필 등록 화면`
- **Crop / Focus:** 프로필 정보 관리 폼 중심.

---

### [SS-05] `ONB-SS-05_Brand-Information.png`
- **Manual Section:** Chapter 6 (STEP 3: 브랜드 정보 확인)
- **화면 명칭:** 브랜드 관리 (`/portal/brands`)
- **화면 목적:** 대표 브랜드 정보 및 대한민국/미국 상표권 등록 상태 확인
- **Callout 번호 및 대상:**
  - **①:** 상단 브랜드 온보딩 확인 배너 및 "브랜드 정보 확인 완료 ✓" 버튼
  - **②:** 등록된 브랜드 카드 및 상표권 보유 배지 (KR / US)
  - **③:** "새 브랜드 추가" 버튼
- **Caption:** `[그림 6-1] 브랜드 정보 및 상표권 등록 현황 확인 화면`
- **Crop / Focus:** 상단 배너 및 브랜드 목록 카드 중심.

---

### [SS-06] `ONB-SS-06_Team-Invitation.png`
- **Manual Section:** Chapter 7 (STEP 4: 팀원 초대)
- **화면 명칭:** 소속 사용자 관리 (`/portal/company/users`)
- **화면 목적:** 사내 동료 초대 및 세부 권한(ACL) 설정
- **Callout 번호 및 대상:**
  - **①:** 우측 상단 "팀원 초대" 버튼
  - **②:** 등록된 팀원 목록 테이블 (이메일, 직함, 권한 등급, 상태)
  - **③:** (체크리스트 참조) 대시보드 STEP 4 카드의 "나중에 하기" 건너뛰기 기능
- **Caption:** `[그림 7-1] 사내 팀원 초대 및 권한 관리 화면`
- **Crop / Focus:** 사용자 목록 테이블 및 상단 액션 버튼 중심.

---

### [SS-07] `ONB-SS-07_Task-Assignment.png`
- **Manual Section:** Chapter 8 (STEP 5: 6대 담당업무 지정)
- **화면 명칭:** 담당 업무 및 주 담당자 관리 (`/portal/company/info?tab=tasks`)
- **화면 목적:** 사내 6대 운영 업무별 주 담당자 및 이메일 알림 수신인 지정
- **Callout 번호 및 대상:**
  - **①:** 6대 핵심 업무 목록 (회사·신청, 계약, 제품, 가격, 물류, 정산)
  - **②:** 업무별 사내 주 담당자(Primary Owner) 드롭다운 선택창
  - **③:** 이메일 알림 수신인 인라인 체크박스
  - **④:** 하단 "담당업무 설정 저장" 버튼
- **Caption:** `[그림 8-1] 6대 핵심 운영 업무별 사내 주 담당자 지정 화면`
- **Crop / Focus:** 6개 업무 영역 테이블 및 일괄 저장 영역 중심.

---

### [SS-08] `ONB-SS-08_Product-Registration.png`
- **Manual Section:** Chapter 9 (STEP 6: 상품 등록 완료)
- **화면 명칭:** 상품 관리 (`/portal/products`)
- **화면 목적:** 최소 1개 이상의 대표 상품 완전 등록(`COMPLETE`) 상태 달성
- **Callout 번호 및 대상:**
  - **①:** 상품 등록 상태 배지 (`등록 완료` vs `Draft (보완 대기)`)
  - **②:** FOB 수출 가격 및 소비자 판매가 정보
  - **③:** 로지스틱스 3단 규격(단품, 패키지, 카톤) 및 바코드 상태
  - **④:** "상품 등록" / "수정" 버튼
- **Caption:** `[그림 9-1] 상품 등록 및 완성도 검증 화면`
- **Crop / Focus:** 상품 목록 테이블 및 상태 배지 중심.

---

### [SS-09] `ONB-SS-09_Agreement-Signing.png`
- **Manual Section:** Chapter 10 (STEP 7: 기본계약 체결)
- **화면 명칭:** 공급 및 이용 약관 관리 (`/portal/company/info?tab=agreements`)
- **화면 목적:** 브랜드 공급·미국 유통 및 플랫폼 이용 기본계약서 검토 및 전자서명 체결
- **Callout 번호 및 대상:**
  - **①:** 계약서 상태 배지 (`서명 대기` / `Version 1.0` / 계약 ID)
  - **②:** "✍️ 계약서 확인 / 서명" CTA 버튼
  - **③:** 계약 주요 운용 안내 (2년 자동연장, 사전 준비 가능 안내)
- **Caption:** `[그림 10-1] 기본공급계약서 확인 및 전자서명 체결 화면`
- **Crop / Focus:** 계약서 카드 컨테이너 중심.

---

### [SS-10] `ONB-SS-10_Help-Center-Entry.png`
- **Manual Section:** Chapter 12 (도움이 필요한 경우)
- **화면 명칭:** Brand Help Center (`/portal/help`)
- **화면 목적:** 주제별 도움말 Topic 및 FAQ 검색, 1:1 지원 문의 접수
- **Callout 번호 및 대상:**
  - **①:** 중앙 질문 검색창
  - **②:** 주제별 도움말 Topic 영역
  - **③:** 1:1 문의하기 (Support Ticket) 에스컬레이션 링크
- **Caption:** `[그림 12-1] Brand Portal 도움말 센터 및 1:1 문의 지원`
- **Crop / Focus:** Help Center 전체 레이아웃 중심.
