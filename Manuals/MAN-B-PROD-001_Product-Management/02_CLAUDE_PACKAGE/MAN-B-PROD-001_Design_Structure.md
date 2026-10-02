# MAN-B-PROD-001: Design & Document Structure Specification

**Document ID:** `MAN-B-PROD-001-STR`  
**Topic:** 상품 등록 & 관리 / Product Registration & Management  
**Manual ID:** `MAN-B-PROD-001`  
**Audience:** `B — Brand`  
**Location:** `Manuals/MAN-B-PROD-001_Product-Management/02_CLAUDE_PACKAGE/`  

---

## 1. Document Format & Layout Standards

- **Document Type:** B2B Professional Technical User Manual (Document Format, NOT Slide/Deck).
- **Page Format:** A4 / US Letter Portrait (210 × 297 mm), suitable for high-resolution screen viewing and sharp PDF printing.
- **Margins:** 20mm Top / Bottom, 18mm Left / Right.
- **Header & Footer:**
  - Header: Left — `K SELECT NETWORK` | Right — `MAN-B-PROD-001: 상품 등록 & 관리 매뉴얼 (v1.0)`
  - Footer: Left — `CONFIDENTIAL & PROPRIETARY — FOR BRAND OPERATORS` | Right — Page Number (`Page X of Y`).

---

## 2. Typography & Hierarchy

| 요소 (Element) | 폰트 패밀리 (Font Family) | 크기 (Size) | 굵기 (Weight) | 색상 (Color) | 줄간격 (Line Height) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Document Title** | Pretendard / SF Pro Display | 26pt | Bold (700) | Navy (`#131E2E`) | 1.2 |
| **Chapter / Major (H1)** | Pretendard / Inter | 18pt | Bold (700) | Navy (`#131E2E`) | 1.3 |
| **Section (H2)** | Pretendard / Inter | 14pt | SemiBold (600) | Slate (`#1E293B`) | 1.4 |
| **Sub-section (H3)** | Pretendard / Inter | 11.5pt | Medium (500) | Slate (`#334155`) | 1.4 |
| **Body Text** | Pretendard / Inter | 10pt | Regular (400) | Charcoal (`#0F172A`) | 1.55 |
| **Table Content** | Pretendard / Inter | 9pt | Regular (400) | Charcoal (`#1E293B`) | 1.45 |
| **Code / SKU / Keys** | JetBrains Mono / SF Mono | 8.5pt | Medium (500) | Burgundy / Dark Navy | 1.3 |
| **Captions** | Pretendard / Inter | 8.5pt | Regular (400) | Cool Slate (`#64748B`) | 1.35 |

---

## 3. Visual Components & Callout Boxes

1. **`[!IMPORTANT]` Box (완료 필수 조건, 누락 방지):**
   - Left Border: 4px Solid `#E11D48` (Rose / Crimson)
   - Background: `#FFF1F2` (Soft Rose Tint)
   - Title: Bold Rose `#9F1239`
2. **`[!TIP]` Box (실무 팁, 빠른 작성 가이드):**
   - Left Border: 4px Solid `#059669` (Emerald Green)
   - Background: `#ECFDF5` (Soft Mint Tint)
   - Title: Bold Emerald `#065F46`
3. **`[!NOTE]` Box (시스템 배경, 자동 연산 안내):**
   - Left Border: 4px Solid `#3B82F6` (Ocean Blue)
   - Background: `#EFF6FF` (Soft Sky Tint)
   - Title: Bold Blue `#1E40AF`
4. **Number Callouts (①, ②, ③, ④):**
   - Circular Badge: Background `#131E2E` with White `#FFFFFF` Text (Diameter: 18px).

---

## 4. Page-by-Page Content Architecture Plan (12-Page Plan)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PAGE 01: Cover & Table of Contents                                               │
│ ├─ Official Header, K SELECT Logo, Manual Title, Audience Code (B - Brand)       │
│ └─ 15 Structured Sections Roadmap & Executive Overview                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 02: Chapter 1. 상품 관리 시작하기 & 2-Phase Lifecycle Diagram                │
│ ├─ /portal/products 목록 인터페이스 개요                                         │
│ ├─ PROD-SCR-001 (상품 목록 메인 뷰) + 번호 콜아웃                                │
│ └─ Diagram A: Product Registration Journey (엔드투엔드 흐름도)                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 03: Chapter 2. 신규 상품 등록 (Phase 1) & 2가지 제출 액션                    │
│ ├─ /portal/products/new 입력 섹션 (기본정보, 바코드, 가격, 채널, 패키지 규격)    │
│ ├─ PROD-SCR-003 & PROD-SCR-004 + 번호 콜아웃                                     │
│ └─ [비교 분석] '임시 저장' (최소 4개 필드) vs '등록 및 계속' (정식 필수값 검증)  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 04: Chapter 3. 상품 상세 관리 개요 & 탭 1: 기본 정보                         │
│ ├─ /portal/products/[id] 헤더 및 6대 탭 아키텍처 (Diagram B)                     │
│ ├─ PROD-SCR-005 (상세 헤더) & PROD-SCR-007 (기본 정보 탭)                        │
│ └─ 국문/영문명, 바코드, 온라인 링크, 불릿포인트, 전성분 실시간 영문 번역기 활용법 │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 05: Chapter 4. 탭 2: 카테고리 및 속성 (Category & Attributes)                │
│ ├─ 3-Depth 카테고리 계층 선택 & 연관 검색어/동의어 매칭 사전                      │
│ ├─ 공통 속성(COMMON) vs 카테고리 전용 프로필 속성(PROFILE)                       │
│ └─ PROD-SCR-008 & PROD-SCR-009 + 필수 속성 충족도 지표                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 06: Chapter 5. 탭 3: 가격 정보 & 수량별 B2B 공급가                           │
│ ├─ 4대 가격 체계 (한국소비자가, 한국도매가, FOB USD, MSRP USD)                    │
│ ├─ 실시간 FOB 배수 (MSRP ÷ FOB) 및 FOB 공급율 자동 산출 지표                     │
│ ├─ 수량별 구간 B2B 공급 가격 (Tiered Pricing) 테이블 입력법                      │
│ └─ PROD-SCR-010 + 번호 콜아웃                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 07: Chapter 6. 탭 4: 로지스틱스 3단계 물리 규격                              │
│ ├─ Diagram C: Logistics 3-Tier Hierarchy (단품 → 패키지 → 마스터 카톤)          │
│ ├─ Tier 1(단품), Tier 2(패키지), Tier 3(마스터카톤) 입력 필드 및 단위 자동 변환 │
│ ├─ Carton CBM 자동 연산식 ((W×D×H)/1,000,000)                                   │
│ └─ PROD-SCR-011 + 번호 콜아웃                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 08: Chapter 7. 탭 4: 컨테이너 선적 시뮬레이터 & 물류 최적화                  │
│ ├─ 20FT (28 CBM), 40FT (58 CBM), 40HQ (68 CBM) 적재량 자동 산출                 │
│ ├─ '시뮬레이션 값 자동 적용' 원클릭 기능                                         │
│ ├─ 미국 FBA / K SELECT 물류 표준 가이드                                          │
│ └─ PROD-SCR-012 + 번호 콜아웃                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 09: Chapter 8. 탭 5: 미디어 관리 & 탭 6: 인증 및 서류                        │
│ ├─ 이미지 업로드 (최대 5장, 10MB/장, JPG/PNG/WEBP) & Position 0 대표 썸네일      │
│ ├─ 마우스 드래그 앤 드롭 순서 변경 & DB 실시간 자동 저장                         │
│ ├─ 전성분표(국문/영문) 파일 업로드 & 상표권/FDA 서류 버전 히스토리 (v1, v2)     │
│ └─ PROD-SCR-013 & PROD-SCR-014 + 번호 콜아웃                                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 10: Chapter 9. 10대 등록 완료 조건 & 인터랙티브 누락 항목 이동              │
│ ├─ evaluateProductRegistrationStatus 10대 필수 체크리스트 요약표                 │
│ ├─ PROD-SCR-006 (보완 대기 배너)                                                 │
│ └─ 누락 뱃지 클릭 시 탭 자동 전환, 부드러운 스크롤, 2.5초 링 포커스 하이라이트   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 11: Chapter 10. 3대 독립 상태 차원 & 소프트 삭제 관리                       │
│ ├─ Diagram D: 3 Independent Status Dimensions Matrix (등록, 선정, 판매)          │
│ ├─ 소프트 삭제 (Soft Delete) 원리, 이중 지속성(Dual Persistence) 및 일괄 삭제    │
│ ├─ PROD-SCR-002 (일괄 삭제 모달)                                                 │
│ └─ 탭 7: 불변 감사 변경 이력 (Audit Log) 조회 및 추적                             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PAGE 12: Chapter 11. 문제 해결(FAQ) & 실무자 퀵 체크리스트                       │
│ ├─ 자주 묻는 질문 (바코드, CBM, 임시저장 검토 시점, 복구 등)                     │
│ ├─ 실무자 퀵 체크리스트 (등록 전 / 등록 완료 전 / MD 선정 전)                    │
│ └─ 고객센터 문의 및 지원 안내 (1:1 Help Center 연계)                             │
└──────────────────────────────────────────────────────────────────────────────────┘
```
