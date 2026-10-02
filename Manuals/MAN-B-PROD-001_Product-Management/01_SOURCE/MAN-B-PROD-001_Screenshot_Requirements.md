# MAN-B-PROD-001: Brand Portal Product Registration & Management — Screenshot Requirements

> **Document ID:** `MAN-B-PROD-001-SCR`  
> **Topic:** 상품 등록 & 관리 / Product Registration & Management  
> **Source Target:** Production Brand Portal UI (`https://portal.kselectnetwork.com`)  
> **Phase:** `01_SOURCE — SCREENSHOT SPECIFICATION`  
> **Audited Date:** 2026-10-01  

---

## 1. 개요 및 스크린샷 캡처 원칙

공식 매뉴얼 `MAN-B-PROD-001` 제작을 위해 수집해야 하는 Production 스크린샷 명세입니다.
모든 스크린샷은 **실제 Production Brand Portal 환경**에서 캡처하며, 시스템의 실제 레이아웃, 상태 뱃지, 유효성 검증 하이라이트 및 모달을 누락 없이 포함해야 합니다.

---

## 2. 필수 스크린샷 목록 (Screenshot Matrix)

| 스크린샷 ID | 화면 / 섹션명 | 대상 URL / 경로 | 상태 / 시나리오 조건 | 강조 영역 및 주석 가이드 (Annotation) |
| :--- | :--- | :--- | :--- | :--- |
| **`PROD-SCR-001`** | **상품 목록 메인 뷰** | `/portal/products` | 여러 카테고리의 상품이 등록된 목록 화면 (Active 탭) | ① 상단 카테고리 탭 (All, Skincare, Hair 등)<br>② 상태 필터 (Active / Draft / Deleted)<br>③ 검색창 및 정렬<br>④ '+ 새 제품 등록' 버튼 |
| **`PROD-SCR-002`** | **상품 일괄 삭제 모달** | `/portal/products` | 목록에서 체크박스로 2개 이상 상품 선택 후 '선택 삭제' 클릭 | ① 체크박스 선택 카운트<br>② 상단 일괄 삭제 액션 바<br>③ 삭제 경고 확인 팝업창 |
| **`PROD-SCR-003`** | **신규 상품 등록 폼 (Phase 1)** | `/portal/products/new` | 신규 등록 폼 상단 및 기본 정보 입력 영역 | ① 브랜드 선택 드롭다운<br>② 제조사 SKU 및 영문 제품명<br>③ 1Depth 카테고리 선택<br>④ 식별 바코드 (UPC/EAN) 입력란 |
| **`PROD-SCR-004`** | **신규 폼 가격/채널/규격 & 제출 버튼** | `/portal/products/new` | 신규 등록 폼 하단 영역 | ① 한국 소비자가 & FOB 가격<br>② 판매 채널 및 온라인 링크<br>③ 패키지 규격 및 단위 변환<br>④ '임시 저장 후 나중에 등록' vs '제품 등록 및 계속' 버튼 |
| **`PROD-SCR-005`** | **상품 상세 헤더 & 탭 네비게이션** | `/portal/products/[id]` | 상품 상세 진입 화면 상단 | ① 상품명 및 제조사 SKU / Letusto SKU<br>② 3대 상태 뱃지 (등록완료/Draft, 선정상태, 판매상태)<br>③ 6개 탭 네비게이션 바<br>④ '상세 정보 저장' 버튼 |
| **`PROD-SCR-006`** | **Draft 보완 대기 알림 바** | `/portal/products/[id]` | 필수 항목이 누락된 Draft 상품 상세 화면 | ① 상단 로즈색(Rose) 보완 대기 배너<br>② 누락 항목 클릭형 뱃지 목록 (클릭 시 해당 필드 자동 포커스)<br>③ 전체 완성도 지표 |
| **`PROD-SCR-007`** | **탭 1: 기본 정보 (Basic Info)** | `/portal/products/[id]?tab=basic` | 기본 정보 탭 전체 뷰 | ① 국문/영문 제품명, 원산지, 용량, 리드타임<br>② 식별 바코드 (UPC / EAN)<br>③ 온라인 판매 링크<br>④ 영문 불릿 포인트 & 전성분 텍스트 번역기 |
| **`PROD-SCR-008`** | **탭 2: 3-Depth 카테고리 선택기** | `/portal/products/[id]?tab=category_attributes` | 3-Depth 카테고리 선택 단계 | ① 1Depth → 2Depth → 3Depth 순차 선택 드롭다운<br>② 카테고리 연관 검색어/동의어 검색 모달/인풋<br>③ 최종 리프 카테고리 경로 표시 |
| **`PROD-SCR-009`** | **탭 2: 카테고리 동적 속성 폼** | `/portal/products/[id]?tab=category_attributes` | 선택된 카테고리의 동적 속성 폼 | ① 공통 속성 그룹 (피부타입, 사용대상 등)<br>② 제품군 프로필 속성 (SPF, 제형 등)<br>③ 필수 속성(빨간 별표) 및 입력 컨트롤 |
| **`PROD-SCR-010`** | **탭 3: 가격 정보 & FOB 마진 지표** | `/portal/products/[id]?tab=price` | 가격 정보 탭 뷰 | ① 소비자가(KRW), 도매가(KRW), FOB(USD), MSRP(USD)<br>② 실시간 FOB 배수 / 마진 지표 카드<br>③ 수량별 B2B 공급 가격 (Tiered Pricing) 테이블 |
| **`PROD-SCR-011`** | **탭 4: 로지스틱스 3단계 규격** | `/portal/products/[id]?tab=logistics` | 로지스틱스 탭 3개 섹션 | ① Tier 1: 단품 규격 (Unit Spec)<br>② Tier 2: 단품 포장 패키지 규격 (Package Spec)<br>③ Tier 3: 마스터 카톤 규격 및 CBM 자동계산 |
| **`PROD-SCR-012`** | **탭 4: 컨테이너 선적 시뮬레이터** | `/portal/products/[id]?tab=logistics` | 컨테이너 시뮬레이션 섹션 및 도움말 모달 | ① 20FT, 40FT, 40HQ 적재 수량/중량/CBM 계산기<br>② '시뮬레이션 값 자동 적용' 버튼<br>③ 로지스틱스 가이드 도움말 모달 |
| **`PROD-SCR-013`** | **탭 5: 미디어 (이미지 드래그앤드롭)** | `/portal/products/[id]?tab=media` | 이미지 업로드 및 순서 변경 화면 | ① 이미지 드래그앤드롭 업로드 영역<br>② 대표 이미지 (Position 0 / 첫 번째 썸네일) 뱃지<br>③ 드래그하여 순서 재배치 핸들러<br>④ 고해상도 줌 뷰어 라이트박스 |
| **`PROD-SCR-014`** | **탭 6: 인증 및 서류 & 탭 7: 변경 이력** | `/portal/products/[id]?tab=certs` | 서류 업로드 및 변경 이력 탭 | ① 전성분표 (국문/영문) 파일 업로드<br>② 상표권/FDA 서류 버전 관리 목록 (`v1`, `v2`)<br>③ 타임스탬프 기반 불변 감사 변경 이력 (Audit Log) |

---

## 3. 스크린샷 파일 저장 규칙

모든 스크린샷 파일은 향후 Claude Package 단계에서 다음 경로에 통일된 네이밍으로 저장합니다:

```text
Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/screenshots/
├── PROD-SCR-001_Product_List_Main.png
├── PROD-SCR-002_Bulk_Delete_Modal.png
├── PROD-SCR-003_New_Product_Form_Upper.png
├── PROD-SCR-004_New_Product_Form_Lower.png
├── PROD-SCR-005_Product_Detail_Header_Tabs.png
├── PROD-SCR-006_Draft_Missing_Fields_Banner.png
├── PROD-SCR-007_Tab1_Basic_Info.png
├── PROD-SCR-008_Tab2_Category_3Depth_Selector.png
├── PROD-SCR-009_Tab2_Dynamic_Attributes.png
├── PROD-SCR-010_Tab3_Pricing_Margin_Tiers.png
├── PROD-SCR-011_Tab4_Logistics_3Tier_Specs.png
├── PROD-SCR-012_Tab4_Container_Simulator.png
├── PROD-SCR-013_Tab5_Media_Images_Reorder.png
└── PROD-SCR-014_Tab6_Tab7_Certs_And_Audit_Log.png
```
