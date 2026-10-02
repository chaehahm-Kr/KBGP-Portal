# MAN-B-PROD-001: Source Traceability & Reference Guide

**Document ID:** `MAN-B-PROD-001-REF`  
**Topic:** 상품 등록 & 관리 / Product Registration & Management  
**Manual ID:** `MAN-B-PROD-001`  
**Audience:** `B — Brand`  
**Location:** `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/04_REFERENCE/`  

---

## 1. 개요 (Overview)

본 문서는 Claude Design이 `MAN-B-PROD-001` 매뉴얼을 제작할 때 참고할 **Source Traceability Matrix(출처 추적성 매트릭스)**, **관련 상위 정책 매뉴얼 연계 가이드**, 그리고 **공식 디자인 에셋 및 컬러 시스템**을 정의합니다.

---

## 2. Source Traceability Matrix (출처 추적성)

모든 매뉴얼 본문 내용과 규칙은 `01_SOURCE/`의 전수 감사 결과에 100% 기반합니다.

| 매뉴얼 섹션 | 핵심 다루는 주제 | 01_SOURCE 기준 근거 파일 |
| :--- | :--- | :--- |
| **Section 1 ~ 3** | 상품 목록, Phase 1 신규 등록 폼, Draft vs Complete 분기 | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 2.A)<br>`MAN-B-PROD-001_Field_Inventory.md` (Sec 2)<br>`MAN-B-PROD-001_Workflow_Map.md` (Sec 1, 2) |
| **Section 4 ~ 9** | Phase 2 6대 전문 탭 (기본정보, 카테고리 3Depth+속성, 가격/FOB마진, 로지스틱스 3단계+시뮬레이터, 미디어 순서변경, 인증/서류 버전관리) | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 2.B)<br>`MAN-B-PROD-001_Field_Inventory.md` (Sec 3.1 ~ 3.7)<br>`MAN-B-PROD-001_Workflow_Map.md` (Sec 4) |
| **Section 10 ~ 11** | 10대 등록 완료 필수조건, 누락 항목 자동 포커스 네비게이션 | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 3.B)<br>`lib/product/validation.ts` (`evaluateProductRegistrationStatus`) |
| **Section 12** | 3대 독립 상태 차원 (등록 / 선정 / 판매) | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 3.A)<br>`MAN-B-PROD-001_Workflow_Map.md` (Sec 3) |
| **Section 13** | 소프트 삭제 및 복구, 일괄 삭제, 이중 지속성 | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 5)<br>`MAN-B-PROD-001_Workflow_Map.md` (Sec 5) |
| **Section 14 ~ 15** | FAQ, 문제 해결 및 실무자 퀵 체크리스트 | `MAN-B-PROD-001_Source_Collection_Report.md` (Sec 8)<br>`MAN-B-PROD-001_Field_Inventory.md` (Sec 4) |

---

## 3. 상위 정책 및 연계 매뉴얼 가이드 (Related Manuals)

- **`MAN-B-BRAND-001` (Brand Registration & Management Policy):**
  - 브랜드 생성, 수정, 활성화/비활성화 정책.
  - 상품 등록 시 오직 회사의 **활성 브랜드(`is_active=true`)** 만 선택 가능.
  - 브랜드 비활성화 시에도 기존 상품 데이터는 삭제되지 않고 보존됨.
- **`MAN-B-ONB-001` (Brand Portal Onboarding Guide):**
  - 브랜드 포털 초기 7단계 온보딩 중 **STEP 6: 상품 등록 완료**와 직접 연계.
  - 온보딩 100% 완료를 위해 최소 1개 이상의 상품이 `COMPLETE (등록 완료)` 상태여야 함.
- **`MAN-SETTLE-001` (정산 및 대금 관리):**
  - 상품 대금 정산, 마진 분배, 지급 주기 등 (본 매뉴얼에서는 제외).
- **`MAN-REG-001` (미국 인허가 및 MoCRA 가이드):**
  - FDA 시설 등록, MoCRA 라벨링 법률 해석 등 (본 매뉴얼에서는 전성분/서류 업로드 기능만 설명).
- **`MAN-WHS-001` (창고 및 재고 관리):**
  - 미국 현지 창고 입고 및 실시간 재고 이동 (본 매뉴얼에서는 물리적 규격 스펙만 설명).

---

## 4. K SELECT 공식 브랜드 디자인 에셋 및 컬러 시스템

### A. 색상 팔레트 (Color Palette)
- **Brand Navy (Header / Primary):** `#131E2E` (어두운 네이비)
- **Brand Accent (Burgundy):** `#8C1C2B` (포인트 버건디)
- **Emerald Green (Complete / Success):** `#059669` / `#10B981` (등록 완료, 성공)
- **Rose Alert (Draft / Incomplete / Warning):** `#E11D48` / `#FDA4AF` (보완 대기, 필수 누락)
- **Action Amber (Notice / Tips):** `#D97706` / `#F59E0B` (주의사항, 알림)
- **Background & Surface:** `#FFFFFF` (본문 배경), `#F8FAFC` (카드/섹션 배경), `#E2E8F0` (경계선)

### B. 로고 및 그래픽 에셋 (Reference Assets in `04_REFERENCE/`)
- `ksn-logo-new.png`: K SELECT 풀 컬러 메인 로고
- `ksn-logo-dark.png`: 다크 모드 / 네이비 배경용 로고
- `ksn-symbol.png`: K SELECT 심볼 아이콘
- `apple-touch-icon.png`: 앱 아이콘 / 파비콘

---

## 5. 디자인 및 타이포그래피 규칙

- **문서 서식:** A4 / Letter 세로(Portrait) 규격의 B2B 테크니컬 가이드.
- **글꼴 체계:**
  - 제목/헤더: Pretendard, Inter, SF Pro Display (Bold / SemiBold)
  - 본문: Pretendard, Inter (Regular, 10~11pt, 줄간격 150~160%)
  - 코드/식별자/SKU: JetBrains Mono, Fira Code (9~10pt)
- **표 및 다이어그램:**
  - 필드 설명 표는 교차 행 음영(`zebra stripe`)과 명확한 헤더 구분 적용.
  - 모든 스크린샷은 실제 캡처 이미지를 사용하며 상단/하단 캡션 및 번호 콜아웃 적용.
