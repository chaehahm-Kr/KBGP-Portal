# MAN-B-ONB-001: Brand Portal Onboarding Screenshot Requirements

**Manual ID:** `MAN-B-ONB-001`  
**Phase:** `01_SOURCE (Screenshot & UI Asset Planning)`  
**Portal:** `K SELECT Brand Portal (https://portal.kselectnetwork.com)`  

---

## 1. Screenshot Capture Guidelines
- **해상도 및 뷰포트:** Desktop 기준 최소 `1920x1080` (또는 `1440x900` 고해상도 2x 레티나 캡처 권장).
- **테마:** 라이트 모드 (Light Mode) 기본 캡처 (가독성 및 인쇄 품질 확보).
- **개인정보 보호:** 실제 기업 식별자 및 개인 연락처는 가상 테스트 데이터(`Letusto Inc / qa-portal-test@letusto.com`) 활용.
- **저장 위치:** `Manuals/MAN-B-ONB-001_Onboarding/01_CLAUDE_PACKAGE/SCREENSHOTS/`

---

## 2. Master Screenshot Requirements Table

| ID | 파일명 | 화면 명칭 및 경로 | 캡처 대상 및 필수 하이라이트 영역 | 매뉴얼 수록 챕터 |
| :---: | :--- | :--- | :--- | :---: |
| **SS-01** | `MAN-B-ONB-001_SS-01_Signup-Public.png` | 공개 신청 조회<br>`/portal/signup` | 사업자등록번호 및 이메일 입력 폼, "신청 내역 확인" 버튼 | Chapter 2.1 |
| **SS-02** | `MAN-B-ONB-001_SS-02_Signup-OTP.png` | 이메일 OTP 인증<br>`/portal/signup?token=...` | 6자리 인증번호 입력창, 5분 유효시간 타이머, 재발송 버튼 | Chapter 2.2 |
| **SS-03** | `MAN-B-ONB-001_SS-03_Signup-Password.png` | 비밀번호 설정<br>`/portal/signup` (setPassword) | 비밀번호 및 확인 입력창, 복합 보안 규칙 가이드라인 안내 | Chapter 2.3 |
| **SS-04** | `MAN-B-ONB-001_SS-04_Dashboard-Checklist.png` | 온보딩 대시보드<br>`/portal` | 상단 진행률 프로그레스 바, 7개 온보딩 카드 그리드 (3+3+1 레이아웃) | Chapter 3.1 |
| **SS-05** | `MAN-B-ONB-001_SS-05_Step1-Company-Info.png` | 회사 정보 확인<br>`/portal/company/info` | 상단 STEP 1 확인 배너, 필수 4대 주소(기본/시/도/우편번호) 입력 필드, 확인 완료 버튼 | Chapter 4.1 |
| **SS-06** | `MAN-B-ONB-001_SS-06_Step2-Admin-Profile.png` | 관리자 프로필<br>`/portal/account` | 국문 성명(성/이름), 영문 성명(First/Last Name), 직함, 연락처 입력 폼 및 저장 버튼 | Chapter 4.2 |
| **SS-07** | `MAN-B-ONB-001_SS-07_Step3-Brand-Info.png` | 브랜드 정보 확인<br>`/portal/brands` | 상단 브랜드 온보딩 확인 배너, 브랜드 목록, KIPO/USPTO 상표권 등록 상태 표시 | Chapter 4.3 |
| **SS-08** | `MAN-B-ONB-001_SS-08_Step4-Team-Invite.png` | 팀원 초대 관리<br>`/portal/company/users` | 팀원 초대 모달(이메일, 직함, 권한 설정), "나중에 하기" 건너뛰기 기능 안내 | Chapter 4.4 |
| **SS-09** | `MAN-B-ONB-001_SS-09_Step5-Task-Owners.png` | 6대 담당업무 지정<br>`/portal/company/info?tab=tasks` | 6대 업무별 주 담당자 드롭다운, 알림 수신인 체크박스, 일괄 저장 버튼 | Chapter 4.5 |
| **SS-10** | `MAN-B-ONB-001_SS-10_Step6-Product-Registration.png` | 상품 등록 완료<br>`/portal/products` | 상품 등록 상태 배지(`COMPLETE` vs `DRAFT`), FOB/Retail가, 3단 규격(단품/패키지/카톤) | Chapter 4.6 |
| **SS-11** | `MAN-B-ONB-001_SS-11_Step7-Agreement-Sign.png` | 기본계약 전자서명<br>`/portal/company/info?tab=agreements` | 기본계약서 카드, "✍️ 계약서 확인/서명" 버튼, 서명 모달 및 전자서명 패드 | Chapter 4.7 |
| **SS-12** | `MAN-B-ONB-001_SS-12_Agreement-Executed-PDF.png` | 계약서 PDF 뷰어<br>`/portal/company/info?tab=agreements` | 서명 완료된 최종 PDF 미리보기 모달, 다운로드 버튼, 계약서 수신 이력 테이블 | Chapter 4.7 / 5.2 |
| **SS-13** | `MAN-B-ONB-001_SS-13_Onboarding-Complete.png` | 100% 완료 대시보드<br>`/portal` | "7 / 7 완료 (100%)" 완료 배지, 접기/펼치기 토글, 운영 활성화 안내 문구 | Chapter 5.1 |

---

## 3. UI Element Callout References for Claude Design

각 스크린샷에 부착할 시각적 콜아웃(Numbered Badges ①, ②, ③)은 아래 요소를 가리키도록 배치합니다.

- **SS-04 (대시보드 온보딩):**
  - ① 진행률 요약 (`N / 7 완료 (X%)` 배지 및 프로그레스 바)
  - ② 상단 6개 카드 (STEP 1~6: 회사, 관리자, 브랜드, 팀원, 업무, 상품)
  - ③ 하단 와이드 히어로 카드 (STEP 7: 최종 법적 체결 단계)
- **SS-05 (회사 정보):**
  - ① 상단 STEP 1 온보딩 확인 배너
  - ② 필수 4대 주소 입력 영역 (기본 주소, 시, 주/도, 우편번호)
  - ③ "회사 정보 확인 완료 ✓" 버튼
- **SS-09 (6대 담당업무):**
  - ① 6대 업무 영역 목록 (회사·신청, 계약, 제품, 가격, 물류, 정산)
  - ② 업무별 주 담당자 선택 셀렉트 박스
  - ③ 이메일 알림 수신인 인라인 토글 체크박스
  - ④ "담당업무 설정 저장" 액션 버튼
- **SS-11 (계약 서명):**
  - ① 계약서 상태 배지 (`서명 대기` / `Version 1.0`)
  - ② "✍️ 계약서 확인 / 서명" CTA 버튼
  - ③ 전자서명 모달 및 자필 서명 캔버스
