# MAN-B-FAQ-001: Production FAQ Complete Inventory & Data Dictionary

- **문서 번호:** `MAN-B-FAQ-001-INV-001-R2`  
- **문서 명칭:** Production FAQ Complete Inventory & Schema Specification  
- **작성 일자:** 2026-10-02  
- **총 등록 건수:** `120개`  
- **검증 상태:** `120 / 120 VERIFIED (100% Grounded in 12 Published Canonical Manuals)`  
- **Featured FAQ:** `50개` (Editorial Policy / Data Pattern)  
- **발행 도메인:** `12개 전 도메인 100% 배포 (Pending Domains: 0)`  
- **중복 ID / 도메인 충돌:** `0건`  

---

## 1. 데이터베이스 스키마 인벤토리 (Database Schemas)

### 1.1 `public.knowledge_faqs` 컬럼 명세
| 컬럼명 | 타입 | Nullable | 기본값 | FK / 제약조건 | 설명 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `id` | `text` | NO | — | `PRIMARY KEY` | 고유 식별자 (예: `faq-brand-01`, `faq-int-05`) |
| `portal_scope` | `text` | YES | `'BRAND'` | — | 포털 범위 (`BRAND`, `RETAILER`) |
| `topic_id` | `text` | YES | NULL | `knowledge_topics(id)` | 표준 토픽 ID |
| `source_knowledge_id` | `text` | YES | NULL | `knowledge_items(id)` | 원천 매뉴얼 ID |
| `source_version` | `text` | NO | — | — | 원천 매뉴얼 버전 (예: `v1.0`, `v1.1.0`) |
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

## 2. 12개 도메인별 120건 FAQ 전수 인벤토리 (Full Inventory of 120 Production FAQs)

### 2.1 그룹 1: BRAND POLICY (MAN-B-BRAND-001) — 5건 (Featured: 3)
- **원천 매뉴얼:** `kno-brand-policy-v10` (`K SELECT 브랜드 등록 및 관리 정책`)
- **표준 토픽:** `topic-brand` (브랜드 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-brand-01` | ⭐ | 브랜드는 어떻게 등록하나요? | MAN-B-BRAND-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-brand-02` | ⭐ | 상표권이 없어도 브랜드 등록이 가능한가요? | MAN-B-BRAND-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-brand-03` | ⭐ | 상품이 연결된 브랜드를 삭제할 수 있나요? | MAN-B-BRAND-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-brand-04` | — | 동일한 브랜드를 여러 회사가 취급할 수 있나요? | MAN-B-BRAND-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-brand-05` | — | 사용하지 않는 브랜드는 어떻게 처리하나요? | MAN-B-BRAND-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.2 그룹 2: ONBOARDING (MAN-B-ONB-001) — 9건 (Featured: 5)
- **원천 매뉴얼:** `kno-onboarding-guide-v10` (`K SELECT Brand Portal 온보딩 가이드`)
- **표준 토픽:** `topic-start` (시작하기)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-onb-01` | ⭐ | 처음 가입하면 무엇부터 해야 하나요? 온보딩 절차가 어떻게 되나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-02` | ⭐ | 회사 정보 등록 시 필수 입력 항목은 무엇인가요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-03` | — | 관리자 정보에서 영문 이름은 왜 필수이며 어떻게 입력해야 하나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-04` | — | 브랜드 정보 확인 단계(STEP 3)에서는 무엇을 확인하나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-05` | ⭐ | 팀원 초대는 필수인가요? 1인 기업은 어떻게 하나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-06` | ⭐ | 6대 담당업무는 어떻게 지정하며, 한 사람이 여러 업무를 담당할 수 있나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-07` | ⭐ | 온보딩을 완료하려면 상품을 몇 개 등록해야 하며, 어떤 상태여야 하나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-08` | — | 기본계약 체결은 언제 어떻게 진행하나요? 계약 전에도 상품 등록이 가능한가요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-onb-09` | — | 온보딩 7단계를 모두 완료하면 어떻게 되나요? | MAN-B-ONB-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.3 그룹 3: PRODUCT MANAGEMENT (MAN-B-PROD-001) — 14건 (Featured: 5)
- **원천 매뉴얼:** `kno-product-management-v10` (`K SELECT Brand Portal 상품 등록 및 관리 매뉴얼`)
- **표준 토픽:** `topic-product` (상품 등록 & 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-prod-01` | ⭐ | 신규 상품 등록(Add Product)을 진행하려면 어떤 사전 준비가 필요한가요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-02` | ⭐ | 임시 저장(Draft Product)과 제품 등록(Complete)의 차이는 무엇인가요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-03` | ⭐ | 상품 등록 완료(COMPLETE)를 판정하는 10대 필수 조건은 무엇인가요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-04` | ⭐ | 필수 항목을 입력했는데도 계속 Draft(보완 대기)로 표시되면 어떻게 하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-05` | — | 카테고리 선택 및 동적 속성은 어떻게 입력하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-06` | — | 미국 바코드(UPC)와 국제 바코드(EAN) 중 무엇을 입력해야 하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-07` | — | 가격 정보(FOB, 소비자가) 및 수량별 공급가(Pricing)는 어떻게 설정하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-08` | — | 물류(Logistics) 3단계 물리 규격(단품, 패키지, 마스터 카톤)과 CBM은 어떻게 입력하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-09` | — | 컨테이너 적재 시뮬레이터(Container Simulator)는 어떻게 활용하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-10` | ⭐ | 상품 이미지(Product Image) 등록 요건과 대표 썸네일 변경 방법은 무엇인가요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-11` | — | 국문 전성분 번역 및 원산지, 리드타임은 어떻게 등록하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-12` | — | 인증서(Certification), 상표권 및 인허가 서류는 어떻게 업로드하고 버전 관리되나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-13` | — | 상품의 3대 독립 상태(등록, 선정, 판매)는 각각 무엇을 의미하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-prod-14` | — | 등록된 상품 수정 및 삭제는 어떻게 하며, 삭제 후 복구가 필요한 경우 어떻게 하나요? | MAN-B-PROD-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.4 그룹 4: ORDER MANAGEMENT (MAN-B-ORD-001) — 12건 (Featured: 5)
- **원천 매뉴얼:** `kno-order-management-v10` (`K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼`)
- **표준 토픽:** `topic-orders` (발주 요청 & 오더)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-ord-01` | ⭐ | 발주 요청(PO Request)과 정식 발주서(Official Purchase Order)는 어떻게 다른가요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-02` | ⭐ | 바이어의 발주 요청(PO Request)을 승인하거나 거절하려면 어떻게 해야 하나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-03` | ⭐ | 발주 요청(PO Request)을 한 번 승인하거나 거절한 후 상태를 다시 변경할 수 있나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-04` | ⭐ | 발주 요청을 승인하면 즉시 제품 생산 및 출고를 진행해야 하나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-05` | ⭐ | 정식 발주서(Official PO)의 6단계 라이프사이클은 어떻게 진행되나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-06` | — | 발주서의 수량, 단가, 납기일에 변경이 필요한 경우 어떻게 처리하나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-07` | — | 공급자 발주서 확정(Confirm PO)을 완료하면 정산(Finance) 인보이스는 언제 발행할 수 있나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-08` | — | 제품 생산 완료 후 물류 출고 준비(Goods Ready)는 어떻게 통보하나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-09` | — | 화물 배송(Step 5: Shipped) 단계에서 등록해야 하는 필수 물류 정보는 무엇인가요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-10` | — | 오더 라이프사이클의 마지막 단계인 'COMPLETED(입고/오더 완료)'는 판매대금 지급(정산)을 의미하나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-11` | — | 물류 배송(LOG)과 대금 정산(FIN)은 순차적으로 종속되어 진행되나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ord-12` | — | 발주서 PDF, 패킹리스트, 상업송장 등 무역 서류는 어디서 다운로드할 수 있나요? | MAN-B-ORD-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.5 그룹 5: REGULATORY COMPLIANCE (MAN-B-REG-001) — 12건 (Featured: 4)
- **원천 매뉴얼:** `kno-regulatory-compliance-v11` (`K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼`)
- **표준 토픽:** `topic-regulatory` (인허가 & 규정)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-reg-01` | ⭐ | 미국 수출(MoCRA) 및 규제 대응을 위해 K SELECT 포털에서 관리하는 주요 인허가 영역은 무엇인가요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-02` | ⭐ | 상표권(특허청 등록증)이 아직 없는 신규 브랜드도 포털에 등록할 수 있나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-03` | ⭐ | 브랜드 상표권(KIPO / USPTO) 등록 및 증빙 서류는 어떻게 첨부하고 수정하나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-04` | ⭐ | 상품의 국문 전성분 입력과 AI 기반 영문 INCI 번역 기능은 어떻게 사용하나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-05` | — | AI 전성분 번역 도구(Tab 1)와 성분 인증 서류 업로드(Tab 6)는 어떻게 구분되나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-06` | — | 상품 상세 [인허가 & 보증서] 탭(Tab 6)에서 등록할 수 있는 5대 서류 카테고리는 무엇인가요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-07` | — | 기존에 등록된 인허가 서류를 갱신하거나 새 파일로 다시 업로드하면 어떻게 처리되나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-08` | — | 상품 등록 완료(COMPLETE)를 위한 바코드(UPC / EAN) 규격과 검증 규칙은 무엇인가요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-09` | — | 바코드(UPC/EAN) 유효성 검증과 규제/인허가 승인은 동일한 절차인가요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-10` | — | 바코드(UPC/EAN)가 아직 발급되지 않은 신규 상품은 어떻게 지원받을 수 있나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-11` | — | 브랜드가 등록한 상표권 및 상품 인허가 서류는 어드민(Admin)에서 어떻게 확인되나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-reg-12` | — | 인허가 서류, 전성분 또는 상표권 정보의 수정 이력은 어디서 감사(Audit)할 수 있나요? | MAN-B-REG-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.6 그룹 6: RETAIL APPLICATIONS (MAN-B-RET-001) — 11건 (Featured: 4)
- **원천 매뉴얼:** `kno-retail-applications-v10` (`K SELECT Brand Portal 리테일 입점 신청 및 심사 관리 매뉴얼`)
- **표준 토픽:** `topic-retail` (입점 & 리테일 네트워크)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-ret-01` | ⭐ | K SELECT Retail Placement(리테일 입점 신청)이란 무엇이며 어떤 절차로 진행되나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-02` | — | 입점 신청서를 작성하기 전에 반드시 완료해야 하는 사전 필수 준비사항은 무엇인가요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-03` | ⭐ | 여러 브랜드를 운영하는 경우 브랜드별로 입점 신청서를 따로 작성해야 하나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-04` | ⭐ | 6대 프로그램 참여 준비 사항(Readiness)에서 '협의 필요'를 선택하면 심사에서 불이익이나 탈락 사유가 되나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-05` | — | 신규 입점 신청서 작성 중 임시저장(Draft)과 최종 제출의 차이는 무엇인가요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-06` | — | 신청서 제출 후 진행 상태(Status)는 어떻게 구분되며 어떤 의미인가요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-07` | — | 신청서에 포함된 여러 제품의 개별 심사 상태와 전체 종합 상태는 어떻게 집계되나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-08` | ⭐ | MD 심사역으로부터 추가 자료 요청(Info Request)을 받았을 때 어떻게 확인하고 회신하나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-09` | — | 신청서 내 일부 제품만 승인되고 일부 제품이 반려/보류된 경우(부분승인) 어떻게 처리되나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-10` | — | 입점 신청이 최종 승인(Approved)되면 발주서(PO)나 출고가 자동으로 생성되나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-ret-11` | — | 제품 심사가 반려(Rejected) 또는 보류(On Hold)된 경우 사유를 확인하고 어떻게 대처해야 하나요? | MAN-B-RET-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.7 그룹 7: SHIPPING & LOGISTICS (MAN-B-LOG-001) — 10건 (Featured: 4)
- **원천 매뉴얼:** `kno-shipping-logistics-v10` (`K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼`)
- **표준 토픽:** `topic-logistics` (재고 & 물류)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-log-01` | ⭐ | 선적 및 출고 관리(Shipping & Logistics) 프로세스는 어떤 단계로 진행되나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-02` | ⭐ | 운송 책임 트랙인 LETUSTO_ARRANGED와 SUPPLIER_ARRANGED의 차이는 무엇인가요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-03` | ⭐ | 하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 진행할 수 있나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-04` | — | 출고 준비(Goods Readiness) 등록 시 필수로 첨부해야 하는 무역 서류는 무엇인가요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-05` | — | CBM(Cubic Meter, 입방미터)과 실측 카고 스펙은 어떻게 산출 및 등록하나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-06` | ⭐ | 물류 출고나 미국 창고 도착이 완료되면 대금 정산(Finance) 및 인보이스 결제가 자동으로 완료되나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-07` | — | ARRIVED 상태와 RECEIVED 상태는 어떻게 다르며 입고 검수 판정은 어떻게 이루어지나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-08` | — | 출고 준비 완료를 제출(READY_SUBMITTED)한 후 수량이나 출고지 정보를 수정할 수 있나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-09` | — | 브랜드 포털 사용자 역할(Admin/Operator vs Viewer)에 따른 물류 및 선적 권한 차이는 무엇인가요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-log-10` | — | 선적 및 출고 관련 문의나 지원이 필요한 경우 어떤 채널을 이용할 수 있나요? | MAN-B-LOG-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.8 그룹 8: FINANCE & SETTLEMENT (MAN-B-FIN-001) — 10건 (Featured: 4)
- **원천 매뉴얼:** `kno-finance-settlement-v10` (`K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼`)
- **표준 토픽:** `topic-finance` (정산 & 결제)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-fin-01` | ⭐ | 공식 발주 확정(PO Confirmed) 후 대금 청구를 위한 인보이스 발행은 어떤 절차로 진행되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-02` | ⭐ | 인보이스 상태(Invoice Status), 지급 상태(Payment Status), 정산 상태(Settlement Status)는 어떻게 구별되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-03` | ⭐ | 물류 출고나 미국 창고 도착(Shipping/Receiving)이 완료되면 정산 및 대금 지급이 자동으로 완료되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-04` | — | 하나의 발주서(PO)에 대해 여러 개의 인보이스를 동시에 생성하거나 등록할 수 있나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-05` | — | 인보이스 청구 총액(invoice_total)과 미지급 잔액(balance_due)은 어떤 공식으로 산출되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-06` | ⭐ | 대금이 분할 이체(Partial Payment)되는 경우 지급 상태는 어떻게 변경되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-07` | — | 입고 검수 시 수량 부족(Shortage)이나 파손(Damage)이 발생하면 인보이스 정산 조정(Adjustment)은 어떻게 반영되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-08` | — | 포털 내에서 PDF 인보이스를 자동 생성하거나 1개 PO에 대해 여러 번 분할 인보이스(Partial Invoicing)를 청구할 수 있나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-09` | — | 제출한 인보이스가 본사 심사에서 반려(REJECTED)되거나 무효화(VOID)된 경우 어떻게 대처해야 하나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-fin-10` | — | 브랜드 포털 사용자 역할에 따른 정산 메뉴 권한과 정산 관련 1:1 문의 채널은 어떻게 되나요? | MAN-B-FIN-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.9 그룹 9: PERMISSIONS & USER MANAGEMENT (MAN-B-PERM-001) — 7건 (Featured: 4)
- **원천 매뉴얼:** `kno-permissions-user-management-v10` (`K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드`)
- **표준 토픽:** `topic-company` (회사 & 사용자 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-perm-01` | ⭐ | 한 명의 직원이 여러 회사의 포털 계정에 동시에 소속될 수 있나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-02` | ⭐ | 역할 템플릿(Preset)을 선택한 뒤 특정 메뉴의 권한만 따로 바꿀 수 있나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-03` | ⭐ | 발송된 초대 링크가 만료되었다고 표시됩니다. | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-04` | ⭐ | 주 담당자로 지정되면 포털 권한도 자동으로 부여되나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-05` | — | 최초 관리자 계정을 다른 담당자로 변경하거나 삭제할 수 있나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-06` | — | 퇴사한 팀원의 계정을 삭제하면 등록한 제품이나 발주 내역도 삭제되나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-perm-07` | — | 이용 상태를 이용 일시정지(Deactive)로 변경하면 어떻게 되나요? | MAN-B-PERM-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.10 그룹 10: TASK & COMMUNICATION (MAN-B-TASK-001) — 10건 (Featured: 4)
- **원천 매뉴얼:** `kno-task-communication-v10` (`K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼`)
- **표준 토픽:** `topic-company` (회사 & 사용자 관리)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-task-01` | ⭐ | 1:1 지원 센터(Support Center)에서 문의 및 이슈를 접수하려면 어떻게 해야 하나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-02` | ⭐ | 접수된 문의(Support Case)의 진행 상태(Status) 라이프사이클은 어떻게 관리되나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-03` | ⭐ | 운영팀으로부터 조치 요청(ACTION_REQUIRED)을 받았을 때 보완 회신은 어떻게 제출하나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-04` | ⭐ | 문의 케이스 종결(CLOSED)과 서비스 만족도 평가(CSAT)는 어떤 관계인가요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-05` | — | 지원 센터 문의 접수 시 선택할 수 있는 9개 업무 카테고리는 무엇인가요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-06` | — | 문의 등록 시 첨부 가능한 파일의 스펙과 보안 다운로드 방식은 무엇인가요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-07` | — | 발주, 정산, 계약 메뉴에서 지원 센터로 문의 이동 시 교차 도메인 연동은 어떻게 동작하나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-08` | — | 사용자의 포털 권한(ACL) 레벨에 따라 1:1 문의 기능 이용 범위가 어떻게 달라지나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-09` | — | 문의 상태 변경 및 답변 등록 시 인앱 알림과 이메일 알림은 어떻게 발송되나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-task-10` | — | 사용자 관리의 주 담당자 배정(PERM)과 지원 센터 1:1 문의(TASK)는 어떻게 구분되나요? | MAN-B-TASK-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.11 그룹 11: REPORTS & PERFORMANCE (MAN-B-RPT-001) — 10건 (Featured: 4)
- **원천 매뉴얼:** `kno-reports-performance-v10` (`K SELECT Brand Portal 성과 분석, 대시보드 KPI 및 운영 지표 활용 가이드`)
- **표준 토픽:** `topic-start` (시작하기)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-rpt-01` | ⭐ | K SELECT Reports & Performance 모듈의 역할은 무엇이며, 일반 운영 메뉴와 어떻게 다른가요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-02` | ⭐ | 브랜드 포털 메인 대시보드(/portal)에서는 어떤 핵심 지표를 확인할 수 있나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-03` | ⭐ | 대시보드의 실행 필요(Action Required) 큐는 어떤 기준으로 우선순위가 나뉘며, 어떻게 해제되나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-04` | — | 발주 관리(/portal/orders/purchase-orders)의 기간 필터와 상태 칩은 어떻게 작동하나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-05` | ⭐ | 발주 관리 상단의 5대 집계 요약 카드와 정식 발주 라이프사이클은 어떤 관계인가요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-06` | — | 정산 및 재무(/portal/finance) 메뉴의 실적 지표는 어떻게 산출되며, 인보이스 상세와 어떻게 대조하나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-07` | — | 상품 관리(/portal/products)의 카탈로그 완성도(COMPLETE vs Draft)는 어떤 기준으로 판정되나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-08` | — | 도움말 및 지원(/portal/support) 메뉴의 1:1 문의 처리 현황은 어떻게 모니터링하나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-09` | — | 브랜드 포털의 발주 데이터는 어드민 백오피스와 어떻게 동기화되며, 타사 데이터 노출 위험은 없나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-rpt-10` | — | 포털 내 독립된 보고서 메뉴(/portal/reports)나 대량 엑셀/PDF 다운로드 센터가 제공되나요? | MAN-B-RPT-001 Chapter & Operational Grounding | `VERIFIED` |

### 2.12 그룹 12: INTELLIGENCE & INSIGHTS (MAN-B-INT-001) — 10건 (Featured: 4)
- **원천 매뉴얼:** `kno-intelligence-insights-v10` (`K SELECT Brand Portal 시장 인텔리전스, 데일리 인사이트 및 지식 검색 가이드`)
- **표준 토픽:** `topic-marketing` (프로모션 & 마케팅)

| FAQ ID | Featured | 질문 (국문) | 매뉴얼 근거 조항 / 핵심 주제 | 검증 판정 |
| :--- | :---: | :--- | :--- | :---: |
| `faq-int-01` | ⭐ | K SELECT Intelligence & Insights 모듈의 역할과 목적은 무엇인가요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-02` | ⭐ | 시장 인텔리전스(INT)와 성과 분석(RPT) 모듈은 어떻게 구분되나요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-03` | ⭐ | Brand Portal(NETWORK)과 Retail Hub(HUB) 채널의 인사이트 발행 대상은 어떻게 다른가요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-04` | — | 지식 검색 어시스턴트(Grounded Knowledge Assistant)는 어떤 원리로 동작하나요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-05` | ⭐ | Daily Auto-Engine의 데일리 인사이트(Daily Insights) 자동 조사 주기와 3+3 Quota 규칙은 무엇인가요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-06` | — | 인사이트 본문의 3단계 Claim Risk(위험도) 분류와 Fact Check 기준은 무엇인가요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-07` | — | 근거가 완벽하지 않은 주장에 적용되는 Safe Downgrade(SIGNAL 전환) 원칙은 무엇인가요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-08` | — | AI 초안 생성 후 실제 발행까지 거치는 Human Approval Gate는 어떻게 운영되나요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-09` | — | 인사이트 독자 피드백(Reader Feedback)은 어떻게 수집되며 중복 투표는 어떻게 방지되나요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |
| `faq-int-10` | — | 머신러닝 수요 예측이나 동적 가격 책정, 자동 재고 할당 기능이 지원되나요? | MAN-B-INT-001 Chapter & Operational Grounding | `VERIFIED` |

---
*End of MAN-B-FAQ-001_Field_Inventory.md*
