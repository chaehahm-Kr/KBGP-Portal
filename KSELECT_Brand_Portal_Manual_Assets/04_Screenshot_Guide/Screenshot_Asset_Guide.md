# K SELECT Brand Portal — Screenshot Asset Guide & Manual Documentation

이 문서는 K SELECT Brand Portal의 각 화면(Screenshot)별 목적, 사용자 행동(User Action), 필수 입력값, 주의사항 및 다음 단계를 정리한 공식 가이드입니다. Claude Design에서 최종 Onboarding Manual 페이지를 구성할 때 직관적으로 매핑하여 사용할 수 있도록 표준화된 포맷으로 작성되었습니다.

---

## SCREEN 01-A — K SELECT NETWORK Entry Point (Home Hero & Header)

- **Clean File**: `01_Clean_Screenshots/01_01_Website_Home_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/01_01_Website_Home_Annotated.png`

### Purpose
한국 브랜드사가 K SELECT NETWORK 공식 웹사이트(`www.kselectnetwork.com`)에 처음 접속하여 파트너십 입점 신청을 시작하거나 기존 포털 계정으로 로그인하는 진입 화면.

### User Action
1. **① Partner With Us / 입점 신청**: 상단 내비게이션 우측의 `PARTNER WITH US` 버튼 또는 메인 히어로 영역의 `신청하기` 버튼을 클릭하여 입점 신청 모달/페이지로 이동합니다.
2. **② Brand Portal Login**: 이미 계정이 승인된 브랜드 담당자는 상단 `로그인 / Brand Portal` 링크를 통해 브랜드 포털로 즉시 진입합니다.
3. **③ Main Navigation & Program Overview**: 프로그램 소개, 글로벌 수출 네트워크, 미국 오프라인/온라인 유통 모델을 사전에 검토합니다.

### Required Fields
- N/A (진입 화면)

### Important Note
- 공식 마케팅 사이트는 PC/모바일 환경을 모두 지원하며, 파트너십 신청은 상단 CTA 버튼을 통해 원클릭으로 열립니다.

### Next Step
→ **SCREEN 01-B: Partner Application Form (온라인 입점 신청서 작성)**

---

## SCREEN 01-B — Marketing Site Partner Application Form

- **Clean File**: `01_Clean_Screenshots/01_02_Website_Partner_Application_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/01_02_Website_Partner_Application_Annotated.png`

### Purpose
브랜드사의 기본 정보, 주력 브랜드, 담당자 한글/영문 성명, 입점 자격 자가진단을 제출하는 공식 입점 신청서.

### User Action
1. **회사 기본 정보 입력**: 회사명(상호), 사업자등록번호(선택/입력), 회사 대표 웹사이트를 입력합니다.
2. **담당자 한글/영문 성명 & 연락처 입력**: 담당자 한글 성명(예: 박은애)과 글로벌 통신용 영문 First Name(예: Eun-ae) / Last Name(예: Park), 업무용 이메일, 휴대전화 번호를 입력합니다.
3. **주력 브랜드명 및 주력 카테고리 선택**: 미국 시장에 론칭할 대표 브랜드명과 화장품 카테고리(스킨케어, 메이크업 등)를 선택합니다.
4. **입점 자격 자가 진단 (Self-Check)**: 수출 가능 여부, 공급 안정성 체크리스트에 동의합니다.
5. **신청서 제출**: `입점 신청서 제출` 버튼을 클릭합니다.

### Required Fields
- 회사명 (`company_name`)
- 담당자 한글 성명 (`name_kr`) & 영문 First/Last Name
- 업무용 이메일 (`contact_email`)
- 연락처 (`contact_phone`)
- 브랜드명 (`brand_name`)
- 자가 진단 동의

### Important Note
- 제출 완료 시 고유 접수 번호(`APP-YYYYMMDD-XXXX`)가 발급되며, K SELECT 운영팀 검토 후 승인 초대 이메일이 발송됩니다.

### Next Step
→ **SCREEN 02-A: Brand Portal Sign Up / Login (계정 활성화)**

---

## SCREEN 02-A — Brand Portal Login

- **Clean File**: `01_Clean_Screenshots/02_01_Portal_Login_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/02_01_Portal_Login_Annotated.png`

### Purpose
승인된 브랜드사 담당자가 포털 시스템(`portal.kselectnetwork.com/portal/login`)에 접속하기 위한 인증 화면.

### User Action
1. **① 계정 이메일 입력**: 입점 승인받은 업무용 이메일 주소를 입력합니다.
2. **② 비밀번호 입력**: 설정한 안전한 비밀번호를 입력합니다.
3. **③ 로그인 버튼 클릭**: 포털 메인 대시보드로 접속합니다.
4. **④ 비밀번호 재설정**: 비밀번호를 분실한 경우 `비밀번호 찾기`를 클릭하여 재설정 링크를 이메일로 수신합니다.

### Required Fields
- 이메일 (`email`)
- 비밀번호 (`password`)

### Important Note
- 5회 이상 연속 로그인 실패 시 보안 잠금이 작동하므로 올바른 계정 정보를 입력해야 합니다.

### Next Step
→ **SCREEN 03-A: Company Profile & Information (회사 정보 관리)**

---

## SCREEN 02-B — Brand Portal Sign Up

- **Clean File**: `01_Clean_Screenshots/02_02_Portal_Signup_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/02_02_Portal_Signup_Annotated.png`

### Purpose
초대 링크를 받지 않고 신규 계정을 직접 생성하거나 초대 코드를 등록하는 가입 화면.

### User Action
1. **① 가입 이메일**: 인증을 진행할 회사 이메일을 입력합니다.
2. **② 비밀번호 설정**: 대문자, 소문자, 숫자, 특수문자를 포함한 8자 이상의 보안 비밀번호를 설정합니다.
3. **③ 회사명 입력**: 정식 법인/개인사업자 상호명을 입력합니다.
4. **④ 회원가입 요청**: 이메일 인증 메일을 발송하고 계정을 생성합니다.

### Required Fields
- 이메일, 비밀번호, 비밀번호 확인, 회사명

### Next Step
→ **SCREEN 03-A: Company Profile & Information**

---

## SCREEN 03-A — Company Profile & Shipping Origin (회사 정보 및 출하지 관리)

- **Clean File**: `01_Clean_Screenshots/03_01_Company_Profile_Info_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/03_01_Company_Profile_Info_Annotated.png`

### Purpose
브랜드사의 사업자등록 정보, 본사 주소 및 물류 선적의 출발점이 되는 **출하지(Shipping Origin)** 주소 및 담당 물류창고 정보를 관리하는 화면.

### User Action
1. **① 회사 기본 정보 확인/수정**: 회사명, 사업자등록번호, 대표자명, 본사 영문/국문 주소, 공식 웹사이트를 확인하고 수정합니다.
2. **② 출하지 정보 (Shipping Origin) 등록**: 미국 수출용 화물이 출고되는 국내 물류센터/창고 주소, 창고 담당자 연락처, 기본 출하지 여부를 지정합니다.
3. **③ 정보 저장**: `저장` 버튼을 클릭하여 최신 회사 정보를 반영합니다.

### Required Fields
- 회사명, 사업자등록번호, 대표 연락처, 출하지 주소

### Important Note
- 출하지 정보는 향후 발주서(Purchase Order) 생성 및 포워더 픽업 시 자동으로 반영되는 기준 데이터입니다.

### Next Step
→ **SCREEN 03-B: Company Contacts & Role Assignments (소속 담당자 & 업무 배정)**

---

## SCREEN 03-B — Company Contacts & Role Assignments (소속 담당자 & 업무 배정)

- **Clean File**: `01_Clean_Screenshots/03_02_Company_Contacts_Roles_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/03_02_Company_Contacts_Roles_Annotated.png`

### Purpose
회사 내 다양한 부서의 실무 담당자 계정을 초대하고, 한글/영문 성명 표준화 데이터를 관리하며, 업무 영역(제품/물류/정산/법무)별 주 담당자를 지정하는 화면.

### User Action
1. **① 소속 담당자 목록 확인**: 등록된 담당자의 한글 성명, 여권 기준 영문 First Name / Last Name, 직책, 부서, 이메일, 연락처를 확인합니다.
2. **② 새 담당자 초대**: `담당자 초대` 버튼을 눌러 동료 직원의 이메일과 역할을 입력하여 포털 접근 권한을 부여합니다.
3. **③ 담당 업무 및 주 담당자 지정**: 제품 관리, 물류/선적, 정산/세금계산서, 계약/법무 영역별로 알림을 수신할 **주 담당자(Primary Contact)**를 선택합니다.

### Required Fields
- 담당자 한글명, 영문 First Name, 영문 Last Name, 이메일, 부서/직책

### Important Note
- K SELECT 시스템은 한국어 및 영어 바이어 커뮤니케이션을 모두 지원하므로 성명 영문 표기가 정확해야 합니다.

### Next Step
→ **SCREEN 04-A: Brand Management (브랜드 관리 및 등록)**

---

## SCREEN 04-A — Brand Management List (보유 브랜드 목록)

- **Clean File**: `01_Clean_Screenshots/04_01_Brand_Management_List_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/04_01_Brand_Management_List_Annotated.png`

### Purpose
회사에서 보유 및 운영 중인 뷰티 브랜드 카탈로그를 확인하고 관리하는 화면.

### User Action
1. **① 새 브랜드 등록**: 우측 상단의 `새 브랜드 등록` 버튼을 클릭하여 신규 브랜드 생성 화면으로 이동합니다.
2. **② 보유 브랜드 카탈로그**: 등록된 각 브랜드의 로고, 국문/영문 명칭, 웹사이트, 활성 상태를 확인하고 상세 페이지로 이동합니다.

### Next Step
→ **SCREEN 04-B: New Brand Registration Form (새 브랜드 등록)**

---

## SCREEN 04-B — New Brand Registration Form (새 브랜드 등록 양식)

- **Clean File**: `01_Clean_Screenshots/04_02_Brand_Registration_New_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/04_02_Brand_Registration_New_Annotated.png`

### Purpose
새로운 화장품 브랜드를 등록하여 제품을 귀속시킬 브랜드를 생성하는 화면.

### User Action
1. **① 브랜드 국문명 (필수)**: 브랜드의 공식 한글 명칭을 입력합니다 (예: 브랜드테스트).
2. **② 브랜드 영문명 (필수)**: 글로벌 및 미국 리테일러에 노출될 공식 영문 표기를 입력합니다 (예: Brand Test).
3. **③ 공식 웹사이트 / 온라인 몰**: 브랜드 공식 자사몰 또는 인스타그램 URL을 입력합니다.
4. **④ 브랜드 스토리 및 소개**: 브랜드의 철학, 핵심 원료, 타깃 연령층 등을 자유롭게 작성합니다.
5. **⑤ 브랜드 로고 업로드**: 고해상도 브랜드 로고 이미지(PNG/SVG 권장)를 업로드합니다.
6. **⑥ 브랜드 등록 완료**: `등록하기` 버튼을 클릭합니다.

### Required Fields
- 브랜드 국문명 (`name_kr`)
- 브랜드 영문명 (`name_en`)

### Important Note
- 브랜드 등록이 완료되어야 이후 제품(Product)을 생성할 때 해당 브랜드를 선택할 수 있습니다.

### Next Step
→ **SCREEN 05: Product Management List (제품 관리 목록)**

---

## SCREEN 05 — Product Management List (제품 카탈로그 & 필터)

- **Clean File**: `01_Clean_Screenshots/05_01_Product_Management_List_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/05_01_Product_Management_List_Annotated.png`

### Purpose
등록된 모든 제품의 리스트를 조회하고, 카테고리 버튼 필터, 등록 상태 다중 필터, 검색, 이미지 썸네일 확대 등을 통해 제품군을 효율적으로 관리하는 메인 허브.

### User Action
1. **① 새 제품 추가 (Add Product CTA)**: 우측 상단의 `새 제품 추가` 버튼을 클릭하여 제품 등록을 시작합니다.
2. **② 카테고리 원클릭 버튼 필터**: `All`, `스킨케어`, `헤어&스칼프`, `뷰티소품툴`, `데일리케어`, `웰니스/기능성패치`, `기타` 버튼을 클릭하여 즉시 카테고리별로 목록을 필터링합니다.
3. **③ 등록 상태 다중 필터**: `등록완료`, `보완대기 (Draft)`, `전체`, `삭제` 필터를 선택하여 진행 상태별 제품을 조회합니다.
4. **④ 제품 목록 & 썸네일 줌**: 제품 썸네일에 마우스를 올리면 고해상도 이미지가 확대 표시되며, 행을 클릭하여 상세 정보로 이동합니다.

### Important Note
- 페이지 최초 진입 시 기본적으로 `등록완료`와 `보완대기 (Draft)` 상태가 활성화되어 있어 검토 및 등록 중인 제품을 한눈에 볼 수 있습니다.

### Next Step
→ **SCREEN 06-A: New Product Registration - Basic Info (기본 정보 등록)**

---

## SCREEN 06-A — New Product Registration: Basic Info (기본 정보)

- **Clean File**: `01_Clean_Screenshots/06_01_Product_Reg_Basic_Info_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/06_01_Product_Reg_Basic_Info_Annotated.png`

### Purpose
신규 제품 등록의 첫 번째 영역으로, 소속 브랜드, 국문/영문 제품명, 고유 SKU 및 온라인 판매처 링크를 입력하는 화면.

### User Action
1. **① 소속 브랜드 선택**: 사전에 등록된 브랜드 중 해당 제품이 속한 브랜드를 선택합니다.
2. **② 제품명 국문 (필수)**: 한국 공식 판매 제품명을 입력합니다 (예: 비타민 브라이트닝 세럼 50ml).
3. **③ 제품명 영문 (글로벌 표기용)**: 미국 바이어 및 라벨용 영문 공식 명칭을 입력합니다.
4. **④ 제조사 SKU (사내 고유 식별코드)**: 브랜드사 자체 관리 품번(SKU)을 입력합니다. (동일 회사 내 중복 불가)
5. **⑤ 국내/해외 판매 링크**: 올리브영, 네이버 스마트스토어, 아마존 등 현재 판매 중인 온라인 URL을 입력합니다.

### Required Fields
- 브랜드 선택 (`brand_id`)
- 제품명 국문 (`name_kr`)
- 제조사 고유 SKU (`manufacture_sku`)

### Important Note
- 제조사 SKU는 물류 및 정산에서 제품을 식별하는 기본 키이므로 정확하게 입력해야 합니다.

### Next Step
→ **SCREEN 06-B: Category & Dynamic Attributes (카테고리 및 속성)**

---

## SCREEN 06-B — New Product Registration: Category & Attributes (카테고리 및 맞춤 속성)

- **Clean File**: `01_Clean_Screenshots/06_02_Product_Reg_Category_Attributes_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/06_02_Product_Reg_Category_Attributes_Annotated.png`

### Purpose
제품을 표준 뷰티 분류 체계(1Depth 대분류 → 2Depth 중분류 → 3Depth 소분류)에 매핑하고, 카테고리별 맞춤 상세 속성을 입력하는 영역.

### User Action
1. **① 1Depth 대분류 선택**: 스킨케어, 메이크업, 헤어케어, 바디케어 등 대분류를 선택합니다.
2. **② 2Depth 중분류 선택**: 대분류에 따른 중분류(예: 클렌징, 토너, 세럼/에센스, 크림)를 선택합니다.
3. **③ 3Depth 소분류 선택**: 최종 소분류(예: 클렌징 오일, 워터, 폼)를 선택합니다.
4. **④ 용량 및 맞춤 속성 입력**: 제품 용량(ml/g) 및 해당 카테고리 전용 피부타입, 기능성 성분 등의 속성을 입력합니다.

### Required Fields
- 카테고리 3-Depth 선택 (`category_code`)
- 제품 용량 (`volume`)

### Important Note
- 3단계 카테고리가 모두 완벽하게 매핑되어야 바이어 검색 및 수출 카탈로그에 정상 노출됩니다.

### Next Step
→ **SCREEN 06-C: Logistics & Master Carton Specs (물류 및 마스터 카톤)**

---

## SCREEN 06-C — New Product Registration: Logistics & Master Carton Specs (물류 스펙)

- **Clean File**: `01_Clean_Screenshots/06_03_Product_Reg_Logistics_Carton_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/06_03_Product_Reg_Logistics_Carton_Annotated.png`

### Purpose
국제 운송, 해상/항공 물류비 산출 및 미국 물류센터 입고를 위한 단품 패키지 치수와 마스터 카톤(아웃박스) 물류 제원을 등록하는 영역.

### User Action
1. **① 단품(Item) 포장 규격 및 중량**: 개별 포장 박스 기준 가로(cm), 세로(cm), 높이(cm), 중량(g)을 입력합니다. (인치/파운드 자동 환산)
2. **② 마스터 카톤 입수량 (Qty.)**: 마스터 카톤 1박스에 들어가는 단품 수량을 입력합니다. (기본값 없이 실제 입수량 직접 입력)
3. **③ 마스터 카톤 치수 & CBM 자동 산출**: 카톤 박스의 가로, 세로, 높이(cm)와 총중량(kg)을 입력하면 CBM(입방미터)이 자동 계산됩니다.
4. **④ 팔레트 / 컨테이너 적재 수량**: 표준 팔레트 1개당 적재 가능한 카톤 박스 수를 입력합니다.

### Required Fields
- 단품 규격/중량
- 마스터 카톤 입수량 (`carton_pack_qty`)
- 카톤 가로/세로/높이 및 총중량

### Important Note
- 마스터 카톤 입수량은 물류 견적 및 발주 수량(MOQ 배수)의 핵심 기준입니다.

### Next Step
→ **SCREEN 06-D: Pricing (가격 정책)**

---

## SCREEN 06-D — New Product Registration: Pricing (가격 정책)

- **Clean File**: `01_Clean_Screenshots/06_04_Product_Reg_Pricing_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/06_04_Product_Reg_Pricing_Annotated.png`

### Purpose
국내 정규 소비자가격과 미국 수출을 위한 FOB 공급가를 입력하는 화면.

### User Action
1. **① 국내 소비자가 (KRW MSRP)**: 한국 원화 기준 공식 권장소비자가격을 입력합니다 (예: 35,000).
2. **② 수출 FOB 공급가 (USD)**: 부산항/인천공항 선적도(FOB) 기준 미달러(USD) 공급가를 입력합니다 (예: 12.50).
3. **③ 가격 정책 메모**: 수량별 할인 조건, 프로모션 특가 등 비고 사항을 기록합니다.

### Required Fields
- 국내 소비자가격 (`price_krw_retail`)
- 수출 공급가 (`price_usd_fob`)

### Next Step
→ **SCREEN 07-A: Product Identifiers (UPC / EAN 바코드)**

---

## SCREEN 07-A — Product Identifiers: UPC / EAN Barcodes (식별 관리 번호)

- **Clean File**: `01_Clean_Screenshots/07_01_Product_Reg_Identifiers_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/07_01_Product_Reg_Identifiers_Annotated.png`

### Purpose
미국 오프라인 리테일러 입점 및 온라인 유통에 필수적인 바코드(UPC / EAN) 번호를 등록하고, 바코드가 없는 경우 지원을 요청하는 화면.

### User Action
1. **① UPC 바코드 번호 (12자리)**: 미국 표준 12자리 UPC 번호가 있는 경우 입력합니다.
2. **② EAN 바코드 번호 (13자리)**: 한국 유통 880 표준 13자리 바코드 번호를 입력합니다.
3. **③ 바코드 미발급 시 1:1 지원 문의**: 바코드가 없거나 미국용 UPC 발급이 필요한 경우 `바코드 지원 문의` 버튼을 눌러 담당자에게 도움을 요청합니다.

### Required Fields
- UPC 또는 EAN (전체 K SELECT 시스템에서 고유 중복 검증 수행)

### Important Note
- UPC/EAN 번호는 타 브랜드 및 타사 제품과의 중복이 엄격히 차단됩니다.

### Next Step
→ **SCREEN 07-B: Images & Ingredients Documents (이미지 및 서류)**

---

## SCREEN 07-B — Product Images & Compliance Documents (제품 이미지 및 전성분 서류)

- **Clean File**: `01_Clean_Screenshots/07_02_Product_Reg_Images_Documents_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/07_02_Product_Reg_Images_Documents_Annotated.png`

### Purpose
바이어 제안서 및 리테일러 등록용 고화질 제품 이미지와 미국 MoCRA/FDA 규제 검토를 위한 전성분표 문서를 업로드하는 화면.

### User Action
1. **① 대표 제품 고화질 이미지 등록**: 흰색 배경의 정면 고해상도 1:1 비율 이미지(JPG/PNG, 1000x1000px 이상)를 업로드합니다.
2. **② 전성분 목록 (국문/영문)**: 제품 단상자에 표기된 전체 전성분 텍스트를 입력합니다.
3. **③ 전성분표 및 인증 서류 파일 업로드**: 공인 시험성적서, 국문/영문 전성분 증명서(PDF)를 첨부합니다.

### Required Fields
- 대표 제품 이미지
- 전성분 텍스트 또는 전성분표 첨부 파일

### Next Step
→ **SCREEN 08: Review, Draft Save & Submit Actions (저장 및 제출)**

---

## SCREEN 08 — Review, Draft Save & Submit Actions (임시 저장 및 최종 등록)

- **Clean File**: `01_Clean_Screenshots/08_01_Product_Draft_Save_Validation_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/08_01_Product_Draft_Save_Validation_Annotated.png`

### Purpose
작성 중인 제품 데이터를 안전하게 보관하거나 모든 필수값을 검증하여 정식 카탈로그로 등록하는 하단 액션 영역.

### User Action
1. **① 임시 저장 후 나중에 등록 (Draft Save)**: 필수 서류나 바코드가 아직 준비되지 않은 경우 클릭하여 `보완대기 (Draft)` 상태로 안전하게 저장합니다.
2. **② 제품 등록 및 계속 (Submit & Continue)**: 모든 필수 항목을 검증하고 `등록완료 (Registered)` 상태로 제출하여 즉시 다음 제품 등록으로 이어갑니다.
3. **③ 취소 및 목록으로 돌아가기**: 수정을 취소하고 제품 목록으로 복귀합니다.

### Validation Rule
- 필수 항목(브랜드, 국문명, SKU, 카테고리, 마스터 카톤 입수량, 소비자가, 공급가 등) 누락 시 해당 필드로 자동 스크롤되며 명확한 필드별 오류 메시지가 표시됩니다.

### Next Step
→ **SCREEN 09-A: Product Detail & Status Review (등록 상태 확인 및 관리)**

---

## SCREEN 09-A — Registered Product Detail & Status Overview (제품 상세 및 상태)

- **Clean File**: `01_Clean_Screenshots/09_01_Product_Detail_Status_Review_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/09_01_Product_Detail_Status_Review_Annotated.png`

### Purpose
등록이 완료된 제품의 모든 사양, 물류 스펙, 바이어 심사 상태를 종합적으로 검토하고 필요 시 수정하거나 1:1 문의를 요청하는 상세 화면.

### User Action
1. **① 제품 등록 상태 확인**: `등록완료 (Registered)`, `보완대기 (Draft)`, `선정 (Selected)`, `판매중 (On Sale)` 등 현재 제품의 상태 배지를 확인합니다.
2. **② 카테고리 및 맞춤 속성값 검토**: 매핑된 3-Depth 카테고리 정보와 상세 속성을 확인합니다.
3. **③ 제품 정보 수정**: 변경된 규격이나 가격이 있을 경우 `수정` 버튼을 눌러 업데이트합니다.
4. **④ 제품 전담 1:1 문의 연동**: 제품 관련 질문이나 바이어 매칭 문의가 있을 때 원클릭으로 1:1 서포트 케이스를 생성합니다.

### Next Step
→ **SCREEN 09-B: 1:1 Partner Inquiries & Support Center (문의 지원 센터)**

---

## SCREEN 09-B — 1:1 Partner Inquiries & Support Center (1:1 파트너 문의 지원)

- **Clean File**: `01_Clean_Screenshots/09_02_Portal_Support_Inquiries_Clean.png`
- **Annotated File**: `02_Annotated_Screenshots/09_02_Portal_Support_Inquiries_Annotated.png`

### Purpose
온보딩, 제품 등록, 물류 선적, 정산, 미국 현지 마케팅에 대해 K SELECT 전담 매니저와 1:1로 실시간 소통하는 고객 지원 허브.

### User Action
1. **① 1:1 새 문의 작성**: `새 문의` 버튼을 클릭하여 카테고리(제품, 물류, 정산, 계약 등)를 선택하고 문의 내용을 작성합니다.
2. **② 문의 처리 현황 및 관리자 답변 확인**: 접수된 문의의 처리 상태(`접수`, `검토중`, `답변완료`)와 K SELECT 담당자의 회신 내용을 열람하고 추가 질문을 이어갑니다.

---

## 4. Screenshot Asset Mapping Table

| 번호 | 화면 명칭 | Clean 파일명 | Annotated 파일명 |
| :--- | :--- | :--- | :--- |
| **01-A** | 웹사이트 메인 & 진입점 | `01_01_Website_Home_Clean.png` | `01_01_Website_Home_Annotated.png` |
| **01-B** | 온라인 파트너십 입점 신청서 | `01_02_Website_Partner_Application_Clean.png` | `01_02_Website_Partner_Application_Annotated.png` |
| **02-A** | 포털 로그인 화면 | `02_01_Portal_Login_Clean.png` | `02_01_Portal_Login_Annotated.png` |
| **02-B** | 포털 회원가입 화면 | `02_02_Portal_Signup_Clean.png` | `02_02_Portal_Signup_Annotated.png` |
| **03-A** | 회사 기본정보 및 출하지 관리 | `03_01_Company_Profile_Info_Clean.png` | `03_01_Company_Profile_Info_Annotated.png` |
| **03-B** | 소속 담당자 & 업무 배정 | `03_02_Company_Contacts_Roles_Clean.png` | `03_02_Company_Contacts_Roles_Annotated.png` |
| **04-A** | 보유 브랜드 카탈로그 목록 | `04_01_Brand_Management_List_Clean.png` | `04_01_Brand_Management_List_Annotated.png` |
| **04-B** | 새 브랜드 신규 등록 양식 | `04_02_Brand_Registration_New_Clean.png` | `04_02_Brand_Registration_New_Annotated.png` |
| **05** | 제품 관리 리스트 & 필터 | `05_01_Product_Management_List_Clean.png` | `05_01_Product_Management_List_Annotated.png` |
| **06-A** | 새 제품 등록: 기본 정보 & SKU | `06_01_Product_Reg_Basic_Info_Clean.png` | `06_01_Product_Reg_Basic_Info_Annotated.png` |
| **06-B** | 새 제품 등록: 3-Depth 카테고리 & 속성 | `06_02_Product_Reg_Category_Attributes_Clean.png` | `06_02_Product_Reg_Category_Attributes_Annotated.png` |
| **06-C** | 새 제품 등록: 물류 및 마스터 카톤 CBM | `06_03_Product_Reg_Logistics_Carton_Clean.png` | `06_03_Product_Reg_Logistics_Carton_Annotated.png` |
| **06-D** | 새 제품 등록: 가격 정책 (KRW/USD) | `06_04_Product_Reg_Pricing_Clean.png` | `06_04_Product_Reg_Pricing_Annotated.png` |
| **07-A** | 식별 관리 번호 (UPC / EAN 바코드) | `07_01_Product_Reg_Identifiers_Clean.png` | `07_01_Product_Reg_Identifiers_Annotated.png` |
| **07-B** | 제품 이미지 & 전성분 인증 서류 | `07_02_Product_Reg_Images_Documents_Clean.png` | `07_02_Product_Reg_Images_Documents_Annotated.png` |
| **08** | 임시 저장 & 최종 등록 액션 | `08_01_Product_Draft_Save_Validation_Clean.png` | `08_01_Product_Draft_Save_Validation_Annotated.png` |
| **09-A** | 등록 제품 상세 & 상태 검토 | `09_01_Product_Detail_Status_Review_Clean.png` | `09_01_Product_Detail_Status_Review_Annotated.png` |
| **09-B** | 1:1 파트너 지원 & 문의 센터 | `09_02_Portal_Support_Inquiries_Clean.png` | `09_02_Portal_Support_Inquiries_Annotated.png` |
