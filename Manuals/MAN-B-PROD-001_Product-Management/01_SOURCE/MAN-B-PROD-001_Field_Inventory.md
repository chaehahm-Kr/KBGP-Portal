# MAN-B-PROD-001: Brand Portal Product Registration & Management — Field Inventory

> **Document ID:** `MAN-B-PROD-001-INV`  
> **Topic:** 상품 등록 & 관리 / Product Registration & Management  
> **Source Target:** Production Brand Portal & Codebase (`/portal/products`, `/portal/products/new`, `/portal/products/[id]`)  
> **Phase:** `01_SOURCE — FACT COLLECTION`  
> **Audited Date:** 2026-10-01  

---

## 1. 개요 및 필드 분류 체계

K SELECT Brand Portal의 상품 데이터는 크게 **Phase 1 (신규 상품 등록 폼)** 과 **Phase 2 (상품 상세 관리 탭 시스템)** 의 2단계 입력 체계로 구성됩니다.

각 필드는 시스템 완성도 평가(`evaluateProductRegistrationStatus`), MD 선정 검토(`selection_status`), 그리고 운영 판매 상태(`sales_status`)에 직접적인 영향을 미칩니다.

---

## 2. Phase 1: 신규 상품 등록 폼 필드 인벤토리 (`/portal/products/new`)

| 섹션 | 필드명 (UI 표기) | DB / State 컬럼명 | 데이터 타입 | 필수 여부 (임시저장) | 필수 여부 (정식계속) | 유효성 검증 규칙 (Validation) | 편집 가능 주체 | 시스템 영향 및 동작 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **기본 정보** | **브랜드** | `brand_id` | UUID (FK) | **필수** | **필수** | 소속 파트너사 활성 브랜드(`is_active=true`)만 선택 가능 | Brand User | 브랜드 미선택 시 저장 불가 (Orphan 상품 생성 차단) |
| **기본 정보** | **카테고리** | `category` / `category_code` | Enum / String | **필수** | **필수** | 1Depth 대분류 Enum 6종 중 1개 선택 | Brand User | 하위 상세 속성 및 프로필 연동의 기준이 됨 |
| **기본 정보** | **제조사 SKU** | `manufacture_sku` | String | **필수** | **필수** | 파트너사(`company_id`) 내 대소문자 무시 고유성(Unique), 앞뒤 공백 및 특수기호 자동 정제 | Brand User / Admin Override | 자사 관리용 고유 식별자, 중복 시 저장 차단 |
| **기본 정보** | **영문 제품명** | `name_en` | String | **필수** | **필수** | 최소 1자 이상, 공백 제외 유효 문자열 | Brand User / Admin Override | 글로벌 카탈로그 및 어드민 대표 명칭으로 사용 |
| **식별 바코드** | **미국 바코드 (UPC)** | `upc` | String | 선택 (형식검증) | **UPC/EAN 중 택1 필수** | 숫자 12자리 정규식 (`^\d{12}$`), 글로벌 고유성(Unique) | Brand User / Admin Override | 미국 바이어/리테일러 POS 식별 및 수출 필수 식별자 |
| **식별 바코드** | **유럽/국제 바코드 (EAN)** | `ean` | String | 선택 (형식검증) | **UPC/EAN 중 택1 필수** | 숫자 13자리 정규식 (`^\d{13}$`), 글로벌 고유성(Unique) | Brand User / Admin Override | 국제 유통 POS 식별자 |
| **가격 정보** | **한국 소비자가 (KRW)** | `price_krw_retail` | Numeric | 선택 | **필수 (정식)** | 0 이상의 정수/숫자 (소수점 불가) | Brand User / Admin Override | 한국 시장 소비자가 기준 (원화) |
| **가격 정보** | **수출용 FOB 가격 (USD)** | `price_usd_fob` | Numeric | 선택 | **필수 (정식)** | 0 초과 양수 (소수점 허용) | Brand User / Admin Override | K SELECT 수출 공급 기준단가, 마진 계산 기준 |
| **판매 채널** | **온라인 판매 여부** | `selling_online` | Boolean | 선택 | 선택 | Checkbox (True/False) | Brand User | 체크 시 온라인 판매 링크 1 입력이 필수로 전환 |
| **판매 채널** | **오프라인 판매 여부** | `selling_offline` | Boolean | 선택 | 선택 | Checkbox (True/False) | Brand User | 오프라인 입점 현황 플래그 |
| **판매 채널** | **온라인 판매 링크 1** | `sales_link_1` | String (URL) | 선택 | **온라인 체크 시 필수** | 유효 URL 형식 권장 | Brand User | 현재 판매 중인 공식몰/스마트스토어/쿠팡 등 링크 |
| **판매 채널** | **온라인 판매 링크 2** | `sales_link_2` | String (URL) | 선택 | 선택 | 유효 URL 형식 | Brand User | 추가 판매처 링크 (올리브영, 무신사, 아마존 등) |
| **패키지 규격** | **가로 (cm / inch)** | `package_width` | Numeric | 선택 | 선택 | 0 초과 숫자, cm ↔ inch 실시간 양방향 자동 변환 | Brand User / Admin Override | 단품 포장 패키지 가로 규격 |
| **패키지 규격** | **세로 (cm / inch)** | `package_depth` | Numeric | 선택 | 선택 | 0 초과 숫자, cm ↔ inch 실시간 양방향 자동 변환 | Brand User / Admin Override | 단품 포장 패키지 세로 규격 |
| **패키지 규격** | **높이 (cm / inch)** | `package_height` | Numeric | 선택 | 선택 | 0 초과 숫자, cm ↔ inch 실시간 양방향 자동 변환 | Brand User / Admin Override | 단품 포장 패키지 높이 규격 |
| **패키지 규격** | **무게 (g / lb / oz)** | `package_weight` | Numeric | 선택 | 선택 | 0 초과 숫자, g ↔ lb ↔ oz 실시간 3-way 자동 변환 | Brand User / Admin Override | 단품 포장 패키지 총 중량 |

---

## 3. Phase 2: 상품 상세 관리 탭 인벤토리 (`/portal/products/[id]`)

### 3.1 탭 1: 기본 정보 (Basic Info)

| 필드명 (UI 표기) | DB / State 컬럼명 | 데이터 타입 | 필수 여부 | 유효성 검증 규칙 | 수정/저장 권한 | 시스템 영향 및 설명 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **브랜드** | `brand_id` | UUID (FK) | **필수** | 소속 회사 활성 브랜드 선택 | Brand User | 브랜드 변경 시 해당 브랜드 하위로 소속 재지정 |
| **영문 제품명** | `name_en` | String | **필수** | 공백 제외 1자 이상, 임시저장 기본명칭 불가 | Brand User / Admin Override | 글로벌 카탈로그 기본 명칭 |
| **국문 제품명** | `name` | String | 선택 | 자유 텍스트 | Brand User | 한국어 표시용 제품명 |
| **제조사 SKU** | `manufacture_sku` | String | **필수** | 파트너사 내 Unique, 임시 SKU(`DRAFT-SKU-`) 불가 | Brand User / Admin Override | 브랜드 자체 식별 코드 |
| **Letusto SKU** | `letusto_sku` | String | 읽기 전용 (어드민) | 어드민 자동/수동 채번 코드 | Admin 전용 (Brand 읽기) | K SELECT 통합 물류/유통 마스터 SKU |
| **원산지** | `origin` | String | **필수** | "대한민국 (Korea)", "미국", "일본", "중국", "기타" 등 | Brand User / Admin Override | 수출입 통관 및 통상 요건 필수 |
| **용량 / 중량** | `volume` (`volumeValue` + `volumeUnit`) | String | 선택 | 수치 + 단위(`ml`, `g`, `oz`, `fl oz`, `L`, `kg`, `매`, `set`) | Brand User | 제품 표기 본품 용량 |
| **리드타임 (납기)** | `lead_time` (`leadTimeValue` + `leadTimeUnit`) | String | 선택 | 수치 + 단위(`일`, `주`, `개월`, `Days`) | Brand User | 발주 후 생산/출고 소요 기간 |
| **대표 색상 / 컬러맵** | `color`, `color_map` | String | 선택 | 텍스트 + 표준 컬러 팔레트 선택 | Brand User | 색조/뷰티툴 상품 구색용 |
| **식별 바코드 (UPC)** | `upc` | String | **UPC/EAN 중 택1 필수** | 숫자 12자리 (`^\d{12}$`), 글로벌 Unique | Brand User / Admin Override | 미국 리테일러 입점 필수 바코드 |
| **식별 바코드 (EAN)** | `ean` | String | **UPC/EAN 중 택1 필수** | 숫자 13자리 (`^\d{13}$`), 글로벌 Unique | Brand User / Admin Override | 국제 표준 바코드 (한국 880 등) |
| **판매 채널** | `selling_online`, `selling_offline` | Boolean | 선택 | Checkbox (복수 선택 가능) | Brand User | 판매 상태 채널 플래그 |
| **온라인 판매 링크 1, 2**| `sales_link_1`, `sales_link_2` | String (URL) | 온라인 체크 시 1 필수 | 유효 URL | Brand User | 판매 레퍼런스 검증용 링크 |
| **제품 상세 설명** | `description` | Text | 선택 | 멀티라인 텍스트 | Brand User | 제품 컨셉, 소구점, 사용법 등 |
| **영문 핵심 특징 (Bullet Points)** | `bullet_points` | Array of Strings | 선택 | 최대 5개 이상의 핵심 불릿 포인트 | Brand User | 아마존/미국 리테일러 스타일 제품 요약 |
| **전성분 텍스트 (국문/영문)**| `ingredients_text` | Text | 선택 | 멀티라인 텍스트 (번역기 내장) | Brand User | 전성분 목록 (MyMemory API 기반 실시간 영문 번역 제공) |

---

### 3.2 탭 2: 카테고리 및 속성 (Category & Attributes)

| 컴포넌트 / 필드 | DB / State 컬럼명 | 데이터 타입 | 필수 여부 | 유효성 검증 규칙 | 시스템 동작 및 세부 로직 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **3-Depth 카테고리 선택기** | `category_code` (`cat1`, `cat2`, `cat3`) | String (Hierarchical Code) | **필수** | 리프 카테고리(is_final=true)까지 단계별 완결 선택 | - 1Depth (대분류) → 2Depth (중분류) → 3Depth (소분류/세분류)<br>- 카테고리 실시간 연관 검색어/동의어 사전 매칭 지원<br>- 선택된 리프 코드에 따라 프로필 속성이 동적으로 바인딩됨 |
| **공통 필수 속성** | `product_attribute_values` (`scope='COMMON'`) | JSON / Text | 속성 마스터 설정에 따름 | 속성별 input_type (단일선택, 다중선택, 수치, 텍스트) | 모든 제품군에 공통 적용되는 속성 (예: 피부타입, 사용대상 등) |
| **제품군 프로필 속성** | `product_attribute_values` (`scope='PROFILE'`) | JSON / Text | 속성 마스터/프로필 오버라이드에 따름 | 필수 속성(`is_required=true`) 미입력 시 Complete 판정 불가 | 선케어(SPF/PA/자차유형), 기초(제형/기능성), 헤어/바디 등 카테고리 맞춤형 세부 스펙 |
| **동적 속성 완료율** | `categoryCompletion` | Client / Server Calculation | - | 필수 속성 충족도 (0~100%) 실시간 계산 | 누락된 필수 속성 클릭 시 해당 입력 필드로 자동 스크롤 및 포커스 하이라이트 |

---

### 3.3 탭 3: 가격 정보 (Pricing Info)

| 필드명 (UI 표기) | DB / State 컬럼명 | 데이터 타입 | 필수 여부 | 유효성 검증 규칙 | 계산 수식 및 시스템 효과 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **한국 소비자 판매가 (KRW)** | `price_krw_retail` | Numeric | **필수** | 0 초과 정수 (원화) | 한국 내 공식 리테일 판매가 |
| **한국 도매가 (KRW)** | `price_krw_wholesale` | Numeric | 선택 | 0 이상의 정수 (원화) | 국내 B2B 공급/도매 기준가 |
| **수출용 FOB 가격 (USD)** | `price_usd_fob` | Numeric | **필수** | 0 초과 양수 (소수점 허용) | K SELECT 수출 공급 기준단가 |
| **예상 미국 소비자가 (MSRP USD)**| `estimated_retail_price` | Numeric | 선택 | 0 초과 양수 (소수점 허용) | 미국 시장 예상 리테일 판매가 |
| **FOB 배수 / 마진 지표** | 계산 지표 (UI 산출) | Numeric | - | 자동 실시간 연산 | - **FOB 대비 MSRP 배수:** `MSRP ÷ FOB Price`<br>- **FOB 공급율:** `(FOB Price in KRW) ÷ Retail KRW` (참고 환율 적용) |
| **수량별 B2B 공급 가격 (Tiered Pricing)** | `price_additional_info.price_tiers` | JSON Array (`qty`, `price`) | 선택 (입력 시 쌍 검증) | 최소 주문 수량(MOQ)과 구간별 단가 모두 입력 필수 | 대량 발주 구간별 공급 단가 테이블 (최대 n구간 추가 가능) |

---

### 3.4 탭 4: 로지스틱스 3단계 규격 (Logistics 3-Tier Specs)

| 티어 (Tier) | 필드명 (UI 표기) | DB 컬럼명 | 데이터 타입 | 필수 여부 | 검증 및 변환 규칙 | 시스템 연계 및 시뮬레이션 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tier 1: 단품 규격 (Unit Spec)** | 단품 가로, 세로, 높이, 무게 | `item_width`, `item_depth`, `item_height`, `item_weight` | Numeric | **필수** | mm / g 기준, 0 초과 양수 | 포장재를 제외한 순수 제품 본품의 규격/무게 |
| **Tier 2: 단품 포장 패키지 규격 (Package Spec)** | 패키지 가로, 세로, 높이, 무게 | `package_width`, `package_depth`, `package_height`, `package_weight` | Numeric | **필수** | cm / g 기준 (inch / lb / oz 실시간 양방향 변환) | 단품 개별 박스(단상자) 포장 완료 상태의 규격/무게 |
| **Tier 3: 마스터 카톤 규격 (Master Carton Spec)** | 카톤 입수량, 가로, 세로, 높이, 무게, CBM | `carton_pack_qty`, `carton_width`, `carton_depth`, `carton_height`, `carton_weight`, `carton_cbm` | Numeric | **필수** | - `carton_pack_qty`: 카톤당 단품 개수 (정수)<br>- `carton_cbm`: `(W × D × H) ÷ 1,000,000` 자동 계산 | 물류 수출 박스 규격, 컨테이너 선적 계산의 핵심 기준 |
| **옵션: 팔레트 규격 (Pallet Spec)** | 팔레트당 카톤 수, 가로, 세로, 높이, 무게 | `palette_carton_qty`, `palette_width`, `palette_depth`, `palette_height`, `palette_weight` | Numeric | 선택 | 0 이상의 수치 | 항공/해상 팔레트 적재 스펙 |
| **컨테이너 적재 시뮬레이터** | 20FT, 40FT, 40HQ 적재량 (카톤수, 제품수, 총중량, 총CBM) | `container_20ft_*`, `container_40ft_*`, `container_40fthc_*` | Numeric | 선택 (원클릭 적용 지원) | - 20FT 기준: 28 CBM<br>- 40FT 기준: 58 CBM<br>- 40HQ 기준: 68 CBM | 카톤 CBM 기반 자동 선적 계산기 내장, 수동 오버라이드 지원 |

---

### 3.5 탭 5: 미디어 (Media)

| 미디어 유형 | DB 테이블 / 컬럼 | 최대 한도 / 스펙 | 필수 여부 | 유효성 검증 규칙 | 시스템 기능 및 지원 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **제품 이미지** | `product_images` (`storage_path`, `position`) | 최대 5장 (스토리지), 파일당 10MB | **최소 1장 필수** | JPG, PNG, WEBP 포맷, 빈 파일(0 byte) 차단, 중복 파일 차단 | - 첫 번째 이미지(Position 0)가 대표 썸네일로 자동 지정<br>- 드래그 앤 드롭으로 노출 순서 즉시 변경 및 자동 저장<br>- 이미지 클릭 시 고해상도 라이트박스 줌(Zoom) 뷰어 제공 |
| **제품 동영상 (URL)** | `product_videos` (`video_url`) | URL 형식 | 선택 | YouTube, Vimeo, S3 등 스트리밍 URL | 제품 홍보/사용법 비디오 링크 연동 |
| **제품 동영상 (파일)** | `product_videos` (`storage_path`) | MP4, MOV, WebM (최대 100MB) | 선택 | 동영상 파일 업로드 | 자체 스토리지 호스팅 비디오 |

---

### 3.6 탭 6: 인증 및 서류 (Certificates & Documents)

| 서류 유형 | 저장 위치 / 메타데이터 | 버전 관리 | 필수 여부 | 허용 포맷 | 시스템 연계 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **전성분표 (국문/영문 파일)** | `products.ingredients_file_path(_en)` & `product_certificates` | Version 자동 증가 (`v1`, `v2`...) | 선택 | PDF, JPG, PNG, XLSX, CSV | 성분 검증 및 MoCRA 사전 스크리닝 원본 파일 |
| **상표권 등록증 (Trademark)** | `product_certificates` (`certificate_type='trademark'`) | Version 관리 | 선택 | PDF, JPG, PNG | 미국/글로벌 상표권 증빙 |
| **FDA 등록 / MoCRA 서류** | `product_certificates` (`certificate_type='fda_registration'`) | Version 관리 | 선택 | PDF, JPG, PNG | 미국 FDA 시설/제품 리스팅 증빙 |
| **기타 인증서 (Other)** | `product_certificates` (`certificate_type='other'`) | Version 관리 | 선택 | PDF, JPG, PNG | 비건, 유기농, 임상시험성적서, 특허 등 |

---

### 3.7 탭 7: 변경 이력 (Audit Change Log)

| 항목 | 기록 필드 | 기록 주체 | 자동 생성 조건 | 보존 정책 |
| :--- | :--- | :--- | :--- | :--- |
| **감사 로그 레코드** | `product_change_logs` (시간, 유저ID, 유저명, 회사명, 소스, 섹션, 작업유형, 요약, 변경전/후 Diff) | Brand User & Admin Operator | 탭별 정보 저장, 이미지 순서 변경, 파일 업로드/삭제, 소프트 삭제/복구 시 실시간 생성 | 불변(Immutable) 감사 이력으로 영구 보존 |

---

## 4. 필드 인벤토리 무결성 요약

1. **Brand 격리:** 모든 상품은 반드시 유효한 `brand_id` 및 `company_id`에 바인딩됩니다.
2. **식별자 고유성:** `manufacture_sku`는 파트너사 내 고유, `upc` 및 `ean`은 시스템 전체 고유성이 강제됩니다.
3. **이중 지속성(Dual Persistence):** 소프트 삭제(`deleted_at`) 및 복합 메타데이터는 컬럼과 JSONB 양쪽에 안전하게 동기화됩니다.
