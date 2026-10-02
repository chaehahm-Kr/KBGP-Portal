# MAN-B-PROD-001: Screenshot Annotation & Callout Guide

**Document ID:** `MAN-B-PROD-001-SSG`  
**Topic:** 상품 등록 & 관리 / Product Registration & Management  
**Manual ID:** `MAN-B-PROD-001`  
**Audience:** `B — Brand`  
**Location:** `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/02_SCREENSHOTS/`  

---

## 1. 개요 (Overview)

본 문서는 Claude Design이 `MAN-B-PROD-001 (상품 등록 & 관리 매뉴얼)`을 제작할 때, 실제 Production 스크린샷 14종 위에 오버레이할 **콜아웃 번호(①, ②, ③, ④...), 포커스 영역 및 공식 캡션([그림 X-X])** 을 규정하는 가이드라인입니다.

> **콜아웃 스타일 원칙:**  
> - 원형 번호 배지: Dark Slate (`#131E2E`) 배경에 White (`#FFFFFF`) 텍스트 또는 Accent Burgundy (`#8C1C2B`).  
> - 강조 테두리 박스: 2px Solid `#8C1C2B` 또는 `#3B82F6`.  
> - 캡션 형식: `[그림 X-X] 화면명 — 핵심 기능 설명`

---

## 2. 스크린샷별 콜아웃 명세 (14 Authentic Screenshots)

### 1) `PROD-SCR-001_Product_List_Main.png`
- **화면명:** 상품 목록 메인 뷰 (`/portal/products`)
- **공식 캡션:** `[그림 1-1] 상품 목록 화면 — 카테고리 탭, 상태 필터 및 신규 등록 진입`
- **콜아웃 매핑:**
  - ① **상단 카테고리 탭 (Category Filter Tabs):** `All`, `Skincare`, `Hair/Scalp`, `Body`, `Makeup`, `Beauty Tools` 카테고리별 빠른 필터.
  - ② **상태 탭 (Status Filters):** `Active (활성 상품)`, `Draft (보완 대기)`, `Deleted (삭제된 상품)` 탭 분기.
  - ③ **검색 및 정렬 바 (Search & Sort):** 제품명/SKU 검색창, 브랜드 필터, 최신순/이름순 정렬.
  - ④ **'+ 새 제품 등록' 버튼 (Add Product CTA):** 신규 상품 등록 폼 진입 버튼 (Accent Burgundy/Navy).

---

### 2) `PROD-SCR-002_Bulk_Delete_Modal.png`
- **화면명:** 상품 일괄 삭제 및 관리 (`/portal/products`)
- **공식 캡션:** `[그림 13-1] 상품 일괄 삭제 — 체크박스 다중 선택 및 안전한 소프트 삭제 확인`
- **콜아웃 매핑:**
  - ① **다중 선택 체크박스 (Bulk Selection):** 목록 좌측 체크박스로 여러 상품 동시 선택 (선택된 개수 표시).
  - ② **상단 액션 툴바 (Bulk Action Bar):** 'N개 선택됨' 카운터 및 '선택 삭제' 버튼.
  - ③ **삭제 확인 모달 (Confirmation Modal):** 소프트 삭제 경고 및 영구 삭제가 아님을 알리는 확인 대화상자.

---

### 3) `PROD-SCR-003_New_Product_Form_Upper.png`
- **화면명:** 신규 상품 등록 폼 상단 (Phase 1 기본 정보) (`/portal/products/new`)
- **공식 캡션:** `[그림 2-1] 신규 상품 등록 폼 — 기본 정보, 제조사 SKU, 카테고리 및 바코드 입력`
- **콜아웃 매핑:**
  - ① **브랜드 선택 (Brand Selector):** 소속 파트너사의 활성 브랜드(`is_active=true`) 선택 드롭다운.
  - ② **1Depth 카테고리 (Main Category):** 6대 대분류 카테고리 선택.
  - ③ **제조사 SKU & 영문 제품명 (SKU & Name EN):** 사내 고유 식별 코드 및 글로벌 공식 영문명.
  - ④ **식별 바코드 (UPC / EAN Barcodes):** 미국 12자리 UPC 또는 국제 표준 13자리 EAN 입력란.

---

### 4) `PROD-SCR-004_New_Product_Form_Lower.png`
- **화면명:** 신규 상품 등록 폼 하단 (Phase 1 가격/채널/규격 및 액션 버튼) (`/portal/products/new`)
- **공식 캡션:** `[그림 2-2] 가격, 판매 채널, 패키지 규격 및 2가지 제출 방식 (임시 저장 vs 등록 및 계속)`
- **콜아웃 매핑:**
  - ① **가격 정보 (Pricing Inputs):** 한국 소비자가(KRW) 및 수출용 FOB 가격(USD).
  - ② **판매 채널 및 링크 (Sales Channels & Links):** 온라인/오프라인 판매 체크박스 및 판매처 URL.
  - ③ **패키지 규격 및 자동 변환 (Package Dimensions):** 가로/세로/높이(cm↔inch), 무게(g↔lb↔oz) 실시간 변환.
  - ④ **2가지 제출 버튼 (Submission Action Buttons):**
    - 좌측: `임시 저장 후 나중에 등록` (최소 4개 필드 충족 시 Draft 저장)
    - 우측: `제품 등록 및 계속` (정식 필수값 검증 후 상세 관리 화면으로 즉시 전환)

---

### 5) `PROD-SCR-005_Product_Detail_Header_Tabs.png`
- **화면명:** 상품 상세 헤더 및 6대 탭 네비게이션 (`/portal/products/[id]`)
- **공식 캡션:** `[그림 4-1] 상품 상세 헤더 — 식별자, 3대 상태 뱃지 및 6개 관리 탭`
- **콜아웃 매핑:**
  - ① **상품 헤더 및 식별자 (Product Identification):** 상품 영문명, 제조사 SKU 및 K SELECT 통합 `Letusto SKU`.
  - ② **3대 상태 뱃지 (3 Status Dimensions):** 등록 상태(`COMPLETE/DRAFT`), 선정 상태(`UNREVIEWED/UNDER_REVIEW/SELECTED`), 판매 상태(`PREPARING/ON_SALE`).
  - ③ **6대 관리 탭 네비게이션 (Detail Tabs Bar):** 기본정보, 카테고리 및 속성, 가격 정보, 로지스틱스, 미디어, 인증 및 서류.
  - ④ **상세 저장 버튼 (Save Changes Button):** 탭별 입력 내용 저장 및 감사 로그 기록.

---

### 6) `PROD-SCR-006_Draft_Missing_Fields_Banner.png`
- **화면명:** Draft 보완 대기 배너 및 원클릭 포커스 네비게이션 (`/portal/products/[id]`)
- **공식 캡션:** `[그림 11-1] 보완 대기(Draft) 배너 — 누락 항목 뱃지 클릭 시 해당 탭 이동 및 필드 포커스 하이라이트`
- **콜아웃 매핑:**
  - ① **로즈색 보완 대기 배너 (Alert Banner):** '현재 상품은 보완 대기(Draft) 상태입니다' 안내.
  - ② **누락 항목 클릭 뱃지 (Missing Field Badges):** 누락된 항목(예: '단품 규격', '대표 이미지', '필수 속성') 태그 목록.
  - ③ **인터랙티브 자동 이동 (Autofocus Navigation):** 뱃지 클릭 시 해당 탭으로 자동 전환되고 해당 입력 필드로 스크롤되어 2.5초간 링 하이라이트 표시.

---

### 7) `PROD-SCR-007_Tab1_Basic_Info.png`
- **화면명:** 탭 1: 기본 정보 관리 (`/portal/products/[id]?tab=basic`)
- **공식 캡션:** `[그림 4-2] 탭 1: 기본 정보 — 국문/영문명, 원산지, 리드타임, 불릿 포인트 및 전성분 번역기`
- **콜아웃 매핑:**
  - ① **글로벌 기본 스펙 (Global Specs):** 국문명, 원산지(대한민국 등), 용량/단위, 발주 리드타임.
  - ② **식별 바코드 & 판매 채널 (Barcodes & Links):** UPC/EAN 바코드 및 온라인 판매 레퍼런스 링크.
  - ③ **영문 핵심 불릿 포인트 (Bullet Points):** 최대 5개 이상의 영문 특장점 리스트.
  - ④ **전성분 텍스트 & 실시간 영문 번역기 (Ingredients Translator):** 한글 전성분 입력 후 `MyMemory API` 기반 원클릭 영문 번역 적용 버튼.

---

### 8) `PROD-SCR-008_Tab2_Category_3Depth_Selector.png`
- **화면명:** 탭 2: 3-Depth 카테고리 계층 선택기 (`/portal/products/[id]?tab=category_attributes`)
- **공식 캡션:** `[그림 5-1] 탭 2: 3단계 카테고리 선택 — 대/중/소 분류 및 연관 검색어 동의어 매칭`
- **콜아웃 매핑:**
  - ① **3-Depth 계층 드롭다운 (Cascading Category):** 1Depth(스킨케어) → 2Depth(선케어) → 3Depth(선크림/선젤) 단계별 선택.
  - ② **동의어/연관 검색어 검색창 (Synonym Search):** '선크림', '비비크림', '클렌징폼' 등 입력 시 일치하는 카테고리 경로 자동 추천.
  - ③ **최종 리프 카테고리 확정 표시 (Leaf Confirmation):** `is_final=true` 확인 뱃지.

---

### 9) `PROD-SCR-009_Tab2_Dynamic_Attributes.png`
- **화면명:** 탭 2: 카테고리 동적 속성 폼 (`/portal/products/[id]?tab=category_attributes`)
- **공식 캡션:** `[그림 5-2] 탭 2: 카테고리 동적 속성 — 공통 속성, 카테고리 프로필 전용 속성 및 완성도 검증`
- **콜아웃 매핑:**
  - ① **공통 속성 그룹 (Common Attributes):** 피부타입, 사용대상, 용기타입 등 전 상품 공통 입력란.
  - ② **카테고리 전용 프로필 속성 (Profile Attributes):** 선케어 전용 속성(자외선 차단지수 SPF/PA, 백탁 유무, 자차 방식 등).
  - ③ **필수 속성 식별자 (`*` Required Marks):** 필수 속성 빨간색 별표 및 누락 시 경고 안내.

---

### 10) `PROD-SCR-010_Tab3_Pricing_Margin_Tiers.png`
- **화면명:** 탭 3: 가격 정보 & 수량별 B2B 공급가 (`/portal/products/[id]?tab=price`)
- **공식 캡션:** `[그림 6-1] 탭 3: 가격 정보 — 4대 기준 가격, FOB 마진 배수 지표 및 수량별 구간 공급가`
- **콜아웃 매핑:**
  - ① **4대 기준 가격 입력란 (4 Base Prices):** 한국 소비자가(KRW), 한국 도매가(KRW), 수출용 FOB 가격(USD), 예상 MSRP(USD).
  - ② **실시간 FOB 배수 / 마진 지표 카드 (Margin Metrics):** `FOB 대비 MSRP 배수` (`MSRP ÷ FOB`) 및 `FOB 공급율` 자동 연산 카드.
  - ③ **수량별 B2B 공급 가격 테이블 (Tiered Pricing):** 대량 발주 MOQ 및 수량 구간별 단가 추가/관리 테이블.

---

### 11) `PROD-SCR-011_Tab4_Logistics_3Tier_Specs.png`
- **화면명:** 탭 4: 로지스틱스 3단계 물리 규격 (`/portal/products/[id]?tab=logistics`)
- **공식 캡션:** `[그림 7-1] 탭 4: 로지스틱스 3단계 규격 — 단품, 패키지, 마스터 카톤 규격 및 CBM 자동 계산`
- **콜아웃 매핑:**
  - ① **Tier 1: 단품 본품 규격 (Unit Spec):** 순수 본품 가로/세로/높이 및 무게(g).
  - ② **Tier 2: 단품 포장 패키지 규격 (Package Spec):** 개별 단상자 가로/세로/높이(cm↔inch), 총중량(g↔lb↔oz).
  - ③ **Tier 3: 마스터 카톤 규격 (Master Carton Spec):** 카톤 입수량(`carton_pack_qty`), 외박스 가로/세로/높이/중량 및 **Carton CBM 자동 계산 결과** (`(W×D×H)/1,000,000`).

---

### 12) `PROD-SCR-012_Tab4_Container_Simulator.png`
- **화면명:** 탭 4: 컨테이너 선적 시뮬레이터 & 물류 가이드 (`/portal/products/[id]?tab=logistics`)
- **공식 캡션:** `[그림 7-2] 컨테이너 적재 시뮬레이터 — 20FT / 40FT / 40HQ 선적 용량 및 원클릭 스펙 적용`
- **콜아웃 매핑:**
  - ① **20FT / 40FT / 40HQ 시뮬레이션 카드 (Container Cards):** 카톤 CBM 기반 최대 적재 카톤 수, 총 제품 수, 총 중량 자동 산출.
  - ② **'시뮬레이션 값 자동 적용' 버튼 (Autofill CTA):** 시뮬레이션 계산치를 컨테이너 스펙 필드로 원클릭 복사.
  - ③ **로지스틱스 규격 가이드 모달 (Guide Modal):** 미국 FBA 및 K SELECT 물류 표준 규격 설명 모달.

---

### 13) `PROD-SCR-013_Tab5_Media_Images_Reorder.png`
- **화면명:** 탭 5: 미디어 관리 & 이미지 순서 변경 (`/portal/products/[id]?tab=media`)
- **공식 캡션:** `[그림 8-1] 탭 5: 미디어 관리 — 이미지 드래그앤드롭 업로드, 대표 썸네일 자동 지정 및 고해상도 줌`
- **콜아웃 매핑:**
  - ① **이미지 드롭존 (Upload Dropzone):** 최대 5장 (스토리지), 10MB 이하 드래그앤드롭 파일 첨부 영역.
  - ② **대표 이미지 뱃지 (Position 0 Main Badge):** 첫 번째 카드의 '대표 썸네일' 식별 태그.
  - ③ **드래그 앤 드롭 순서 변경 (Drag & Drop Reorder):** 카드 드래그 시 실시간 순서 재배치 및 DB 즉시 자동 저장.
  - ④ **고해상도 라이트박스 줌 & 동영상 연동 (Zoom & Video):** 이미지 클릭 확대 팝업 및 YouTube/MP4 동영상 연동란.

---

### 14) `PROD-SCR-014_Tab6_Tab7_Certs_And_Audit_Log.png`
- **화면명:** 탭 6: 인증 및 서류 & 탭 7: 변경 이력 (`/portal/products/[id]?tab=certs`)
- **공식 캡션:** `[그림 9-1] 탭 6 & 탭 7 — 전성분표/인증서 서류 버전 관리 및 불변 감사 변경 이력`
- **콜아웃 매핑:**
  - ① **전성분표 원본 서류 업로드 (Ingredients Documents):** 국문/영문 전성분 증빙 파일 첨부.
  - ② **인증서 버전 관리 히스토리 (Certificates Versioning):** 상표권, FDA 서류 재업로드 시 `v1`, `v2` 버전 히스토리 보존.
  - ③ **불변 감사 변경 이력 (Audit Change Log):** 작업 일시, 작업자명, 수정 섹션, 변경 전/후 상세 내역(Diff) 조회 테이블.
