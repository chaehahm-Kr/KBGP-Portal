# MAN-B-FAQ-001: Production FAQ Complete Inventory & Data Dictionary

- **문서 번호:** `MAN-B-FAQ-001-INV-001-R1`  
- **문서 명칭:** Production FAQ Complete Inventory & Schema Specification  
- **작성 일자:** 2026-10-02  
- **총 등록 건수:** `63개`  
- **검증 상태:** `63 / 63 VERIFIED (100% Grounded in Published Manuals)`  
- **Featured FAQ:** `26개` (Editorial Policy / Data Pattern)  
- **중복 ID / 도메인 충돌:** `0건`  

---

## 1. 데이터베이스 스키마 인벤토리 (Database Schemas)

### 1.1 `public.knowledge_faqs` 컬럼 명세
| 컬럼명 | 타입 | Nullable | 기본값 | FK / 제약조건 | 설명 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `text` | NO | — | `PRIMARY KEY` | 고유 식별자 (예: `faq-brand-01`) |
| `portal_scope` | `text` | YES | `'BRAND'` | — | 포털 범위 (`BRAND`, `RETAILER`) |
| `topic_id` | `text` | YES | NULL | `knowledge_topics(id)` | 표준 토픽 ID |
| `source_knowledge_id` | `text` | YES | NULL | `knowledge_items(id)` | 원천 매뉴얼 ID |
| `source_version` | `text` | NO | — | — | 원천 매뉴얼 버전 (예: `v1.0`) |
| `source_title` | `text` | NO | — | — | 원천 매뉴얼 공식 국문 명칭 |
| `question_ko` | `text` | NO | — | — | 국문 질문 |
| `question_en` | `text` | NO | — | — | 영문 질문 |
| `answer_ko` | `text` | NO | — | — | 국문 답변 및 정책 인용 |
| `answer_en` | `text` | NO | — | — | 영문 답변 |
| `audience` | `text[]`| NO | — | — | 대상 사용자 그룹 배열 |
| `status` | `text` | NO | — | `APPROVED / CANDIDATE` | 거버넌스 승인 상태 |
| `kind` | `text` | YES | `'BOTH'` | `FAQ / SUGGESTED_QUESTION / BOTH` | 표시 형식 |
| `display_order` | `integer`| YES | `0` | — | 정렬 순서 |
| `is_featured` | `boolean`| YES | `false` | — | Featured FAQ 여부 |
| `generated_by` | `text` | YES | `'MANUAL'`| `MANUAL / AI` | 생성 주체 |
| `created_at` | `timestamptz` | YES | `now()` | — | 생성 일시 |
| `updated_at` | `timestamptz` | YES | `now()` | — | 수정 일시 |
| `reviewed_at` | `timestamptz` | YES | NULL | — | 심사 일시 |
| `reviewed_by` | `text` | YES | NULL | — | 심사자 ID |
| `review_note` | `text` | YES | NULL | — | 심사 코멘트 |
| `impact_reason` | `text` | YES | NULL | — | 개정/추가 사유 |

---

## 2. 6개 그룹별 63건 FAQ 전수 인벤토리 (Full Inventory of 63 Production FAQs)

### 2.1 그룹 1: BRAND POLICY (MAN-BRAND-001) — 5건 (Featured: 3)
- **원천 매뉴얼:** `kno-brand-policy-v10` (`K SELECT 브랜드 등록 및 관리 정책`)
- **표준 토픽:** `topic-brand` (브랜드 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-brand-01` | ⭐ | 브랜드는 어떻게 등록하나요? | Policy 01 (브랜드 신규 등록 절차) | `VERIFIED` |
| `faq-brand-02` | ⭐ | 브랜드 비활성화(Deactivation)는 어떤 조건에서 진행되나요? | Policy 02 (비활성화 기준 및 30일 유예) | `VERIFIED` |
| `faq-brand-03` | ⭐ | 브랜드 영문명 및 사업자 번호 수정이 가능한가요? | Policy 03 (수정 불가 필드 및 1:1 문의) | `VERIFIED` |
| `faq-brand-04` | — | 등록 가능한 브랜드 수에 제한이 있나요? | Policy 04 (다중 브랜드 등록 원칙) | `VERIFIED` |
| `faq-brand-05` | — | 브랜드 대표 카테고리는 등록 후 변경할 수 있나요? | Policy 05 (카테고리 수정 정책) | `VERIFIED` |

---

### 2.2 그룹 2: ONBOARDING (MAN-B-ONB-001) — 9건 (Featured: 5)
- **원천 매뉴얼:** `kno-onboarding-guide-v10` (`K SELECT Brand Portal 온보딩 가이드`)
- **표준 토픽:** `topic-start` (시작하기)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-onb-01` | ⭐ | 입점 신청 후 심사에는 며칠이 소요되나요? | Chapter 2.1 (영업일 기준 3~5일 심사) | `VERIFIED` |
| `faq-onb-02` | ⭐ | 사업자등록증 외에 필수 제출 서류는 무엇인가요? | Chapter 2.3 (통신판매업신고증, 통장사본) | `VERIFIED` |
| `faq-onb-03` | ⭐ | 입점 심사가 보완(Action Required) 상태일 때는 어떻게 하나요? | Chapter 3.2 (보완 서류 제출 절차) | `VERIFIED` |
| `faq-onb-04` | ⭐ | 개인사업자도 K SELECT에 입점할 수 있나요? | Chapter 1.2 (사업자 자격 요건) | `VERIFIED` |
| `faq-onb-05` | ⭐ | 입점 승인 후 첫 번째로 진행해야 하는 작업은 무엇인가요? | Chapter 4.1 (브랜드 생성 및 기초정보) | `VERIFIED` |
| `faq-onb-06` | — | 해외 법인 사업자도 입점 신청이 가능한가요? | Chapter 1.3 (해외 사업자 등록 안내) | `VERIFIED` |
| `faq-onb-07` | — | 심사 반려(Rejected) 시 재신청이 가능한가요? | Chapter 3.4 (반려 사유 확인 및 재신청) | `VERIFIED` |
| `faq-onb-08` | — | 온보딩 과정에서 입력한 담당자 정보는 변경할 수 있나요? | Chapter 4.3 (계정 정보 관리) | `VERIFIED` |
| `faq-onb-09` | — | 기본 공급 계약서 서명은 어디서 진행하나요? | Chapter 4.2 (전자 서명 절차) | `VERIFIED` |

---

### 2.3 그룹 3: PRODUCT MANAGEMENT (MAN-B-PROD-001) — 14건 (Featured: 5)
- **원천 매뉴얼:** `kno-product-management-v10` (`K SELECT Brand Portal 상품 등록 및 관리 매뉴얼`)
- **표준 토픽:** `topic-product` (상품 등록 & 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-prod-01` | ⭐ | 상품 등록 시 필수 입력 항목은 무엇인가요? | Chapter 2.1 (상품명, SKU, 카테고리, 공급가) | `VERIFIED` |
| `faq-prod-02` | ⭐ | 바코드(UPC/EAN/GTIN)는 필수인가요? | Chapter 2.2 (바코드 규격 및 검증) | `VERIFIED` |
| `faq-prod-03` | ⭐ | CBM(부피)은 어떻게 계산하여 입력하나요? | Chapter 3.1 (가로×세로×높이 cm 기반 연산) | `VERIFIED` |
| `faq-prod-04` | ⭐ | 상품의 승인 상태(Status) 단계는 어떻게 되나요? | Chapter 4.1 (DRAFT → UNDER_REVIEW → APPROVED) | `VERIFIED` |
| `faq-prod-05` | ⭐ | 등록된 상품의 공급가(Supply Price)를 수정할 수 있나요? | Chapter 3.3 (가격 변경 승인 요청 절차) | `VERIFIED` |
| `faq-prod-06` | — | 상품 옵션(SKU)은 최대 몇 개까지 추가할 수 있나요? | Chapter 2.4 (단품 및 멀티 옵션 구성) | `VERIFIED` |
| `faq-prod-07` | — | 상품 대표 이미지 및 상세 이미지 규격은 어떻게 되나요? | Chapter 2.5 (1000×1000 이상, JPG/PNG) | `VERIFIED` |
| `faq-prod-08` | — | 상품 단종(Discontinued) 처리는 어떻게 하나요? | Chapter 4.3 (상태 전환 및 재고 소진) | `VERIFIED` |
| `faq-prod-09` | — | 세트/번들 상품은 어떻게 등록하나요? | Chapter 2.6 (번들 SKU 등록 규칙) | `VERIFIED` |
| `faq-prod-10` | — | 상품 무게(Net/Gross Weight)는 왜 필수인가요? | Chapter 3.2 (항공/해상 물류비 산정 기초) | `VERIFIED` |
| `faq-prod-11` | — | 일괄(엑셀) 상품 등록이 가능한가요? | Chapter 5.1 (벌크 업로드 템플릿 안내) | `VERIFIED` |
| `faq-prod-12` | — | 상품 수정 시 기존 승인 상태가 초기화되나요? | Chapter 4.2 (핵심 필드 수정 시 재심사) | `VERIFIED` |
| `faq-prod-13` | — | 카톤(Carton) 포장 규격은 왜 입력해야 하나요? | Chapter 3.4 (수출 물류 팔레트 적재 계산) | `VERIFIED` |
| `faq-prod-14` | — | 상품 삭제는 언제 가능한가요? | Chapter 4.4 (발주 이력 없는 DRAFT만 가능) | `VERIFIED` |

---

### 2.4 그룹 4: ORDER MANAGEMENT (MAN-B-ORD-001) — 12건 (Featured: 5)
- **원천 매뉴얼:** `kno-order-management-v10` (`K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼`)
- **표준 토픽:** `topic-orders` (발주 요청 & 오더)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-ord-01` | ⭐ | 발주 요청(Brand PO Request)과 정식 발주(Admin PO)의 차이는 무엇인가요? | Chapter 1.2 (발주 유형 정의) | `VERIFIED` |
| `faq-ord-02` | ⭐ | 발주서가 승인(Confirmed)되면 어떤 절차가 진행되나요? | Chapter 2.3 (출고 준비 및 ASN 안내) | `VERIFIED` |
| `faq-ord-03` | ⭐ | 발주 수량이나 단가 변경이 필요한 경우 어떻게 하나요? | Chapter 3.1 (PO 변경 요청 절차) | `VERIFIED` |
| `faq-ord-04` | ⭐ | 납기일(Delivery Due Date) 연장이 가능한가요? | Chapter 3.2 (납기 변경 신청 및 운영팀 조율) | `VERIFIED` |
| `faq-ord-05` | ⭐ | 발주 취소는 어떤 단계에서 가능한가요? | Chapter 3.3 (출고 전 단계 취소 요청) | `VERIFIED` |
| `faq-ord-06` | — | 발주서(PO) 인쇄 및 PDF 다운로드는 어디서 하나요? | Chapter 2.1 (PO 상세 내 인쇄 버튼) | `VERIFIED` |
| `faq-ord-07` | — | 부분 출고(Partial Shipment)가 가능한가요? | Chapter 4.1 (분할 배송 절차) | `VERIFIED` |
| `faq-ord-08` | — | 긴급 발주(Urgent PO)는 어떻게 요청하나요? | Chapter 1.4 (우선순위 설정) | `VERIFIED` |
| `faq-ord-09` | — | 출고 준비 완료(Ready to Ship) 표시는 언제 하나요? | Chapter 4.2 (패킹 완료 시점 상태 전환) | `VERIFIED` |
| `faq-ord-10` | — | 발주 내역 엑셀 다운로드는 어떻게 하나요? | Chapter 2.2 (목록 내 내보내기) | `VERIFIED` |
| `faq-ord-11` | — | 발주서 검수 중 불량 발생 시 처리는 어떻게 되나요? | Chapter 4.3 (입고 검수 하자 보고) | `VERIFIED` |
| `faq-ord-12` | — | 과거 완료된 발주 이력은 언제까지 조회 가능한가요? | Chapter 2.4 (영구 보존 원칙) | `VERIFIED` |

---

### 2.5 그룹 5: REGULATORY COMPLIANCE (MAN-B-REG-001) — 12건 (Featured: 4)
- **원천 매뉴얼:** `kno-regulatory-compliance-v11` (`K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼`)
- **표준 토픽:** `topic-regulatory` (인허가 & 규정)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-reg-01` | ⭐ | 미국 화장품 규제(MoCRA) 대응 서류는 필수인가요? | Chapter 1.1 (FDA MoCRA 시설/제품 등록) | `VERIFIED` |
| `faq-reg-02` | ⭐ | 상표권(Trademark) 등록증이 없는 경우 어떻게 하나요? | Chapter 2.1 (상표 출원서 또는 라이선스 계약서) | `VERIFIED` |
| `faq-reg-03` | ⭐ | 전성분표(INCI) 영문 번역본은 어떻게 제출하나요? | Chapter 3.1 (영문 전성분 및 배합 한도 표기) | `VERIFIED` |
| `faq-reg-04` | ⭐ | 증빙 서류의 유효기간 만료 시 어떻게 갱신하나요? | Chapter 4.1 (만료 30일 전 갱신 안내) | `VERIFIED` |
| `faq-reg-05` | — | 서류 첨부 파일의 형식과 크기 제한은 어떻게 되나요? | Chapter 2.4 (PDF, JPG, PNG 최대 20MB) | `VERIFIED` |
| `faq-reg-06` | — | 시험성적서(COA)는 제품마다 필수 제출인가요? | Chapter 3.2 (품질 검사 성적서 기준) | `VERIFIED` |
| `faq-reg-07` | — | 안전성 평가서(Safety Assessment)는 무엇인가요? | Chapter 1.3 (미국 수출 안전성 입증 자료) | `VERIFIED` |
| `faq-reg-08` | — | 제출된 서류의 보안 및 열람 권한은 어떻게 관리되나요? | Chapter 5.1 (Private 암호화 스토리지 관리) | `VERIFIED` |
| `faq-reg-09` | — | 서류 심사 결과는 어디서 확인하나요? | Chapter 4.2 (상태 배지 및 이메일 알림) | `VERIFIED` |
| `faq-reg-10` | — | 서류가 반려(Rejected)된 경우 어떻게 수정하나요? | Chapter 4.3 (반려 사유 확인 및 서류 재업로드) | `VERIFIED` |
| `faq-reg-11` | — | 라벨링(Labeling) 규정 준수 검토는 어떻게 진행되나요? | Chapter 3.3 (미국 FDA 표기 규격 사전 검수) | `VERIFIED` |
| `faq-reg-12` | — | 제조증명서(Certificate of Manufacture)는 필수인가요? | Chapter 2.2 (제조사 발행 증빙 요건) | `VERIFIED` |

---

### 2.6 그룹 6: RETAIL APPLICATIONS (MAN-B-RET-001) — 11건 (Featured: 4)
- **원천 매뉴얼:** `kno-retail-applications-v10` (`K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼`)
- **표준 토픽:** `topic-retail` (입점 & 리테일 네트워크)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-ret-01` | ⭐ | 리테일러 입점 신청(Retail Application)은 어떻게 진행하나요? | Chapter 2.1 (바이어 신청 절차) | `VERIFIED` |
| `faq-ret-02` | ⭐ | 입점 신청 승인 후 자동으로 발주(PO)가 생성되나요? | **Chapter 1.2 (입점 승인 ≠ 자동 PO 생성 원칙)** | `VERIFIED` |
| `faq-ret-03` | ⭐ | 부분 승인(Partially Approved) 상태의 의미는 무엇인가요? | Chapter 3.2 (일부 SKU 승인 및 조건부 입점) | `VERIFIED` |
| `faq-ret-04` | ⭐ | 정보 요청(Info Requested) 상태에서는 무엇을 해야 하나요? | Chapter 3.3 (바이어 추가 질의 회신 절차) | `VERIFIED` |
| `faq-ret-05` | — | 여러 리테일러에 동시에 입점 신청할 수 있나요? | Chapter 2.2 (복수 바이어 신청 정책) | `VERIFIED` |
| `faq-ret-06` | — | 입점 심사는 평균 얼마나 걸리나요? | Chapter 3.1 (바이어사 심사 주기 안내) | `VERIFIED` |
| `faq-ret-07` | — | 리테일러 요구사항(Buyer Requirements)은 어디서 확인하나요? | Chapter 1.3 (리테일러별 가이드라인) | `VERIFIED` |
| `faq-ret-08` | — | 입점 신청이 반려(Rejected)된 경우 재신청이 가능한가요? | Chapter 3.4 (보완 후 재신청 안내) | `VERIFIED` |
| `faq-ret-09` | — | 신청서 제출 후 내용을 수정할 수 있나요? | Chapter 2.3 (심사 전 수정 가능 여부) | `VERIFIED` |
| `faq-ret-10` | — | 입점 신청 시 제안 공급가(Offer Price)는 어떻게 결정하나요? | Chapter 2.4 (마진율 및 리테일 권장가 산정) | `VERIFIED` |
| `faq-ret-11` | — | 입점 진행 상태 알림은 어떻게 수신하나요? | Chapter 4.1 (포털 인앱 및 이메일 통지) | `VERIFIED` |

---
*End of MAN-B-FAQ-001_Field_Inventory.md*
