# MAN-B-FAQ-001: Production FAQ Complete Inventory & Source Grounding Matrix

**문서 번호:** `MAN-B-FAQ-001-INV`  
**문서 명칭:** Production FAQ Complete Inventory (전수 조사 인벤토리)  
**작성 일자:** 2026-10-02  
**총 등록 건수:** `63개`  
**검증 상태:** `63 / 63 VERIFIED (100% Grounded)`  

---

## 1. 전수 조사 요약표 (Summary by Knowledge Group)

| 그룹 번호 | 원천 매뉴얼 ID | 매뉴얼 명칭 | 모듈 | 표준 토픽 | FAQ 수 | Featured 수 | 소스 근거 판정 |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **01** | `kno-brand-policy-v10` | 브랜드 등록 및 관리 정책 (MAN-BRAND-001) | BRAND | `topic-brand` | 5 | 3 | `5 VERIFIED` |
| **02** | `kno-onboarding-guide-v10` | Brand Portal 온보딩 가이드 (MAN-B-ONB-001) | ONBOARDING | `topic-start` | 9 | 4 | `9 VERIFIED` |
| **03** | `kno-product-management-v10`| 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001) | PRODUCTS | `topic-product` | 14 | 5 | `14 VERIFIED` |
| **04** | `kno-order-management-v10` | 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001) | ORDERS | `topic-orders` | 12 | 4 | `12 VERIFIED` |
| **05** | `kno-regulatory-compliance-v11`| 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)| REGULATORY | `topic-regulatory`| 12 | 4 | `12 VERIFIED` |
| **06** | `kno-retail-applications-v10` | 리테일 입점 신청 및 심사 관리 매뉴얼 (MAN-B-RET-001) | RETAIL | `topic-retail` | 11 | 4 | `11 VERIFIED` |
| **합계** | **6개 매뉴얼** | — | — | — | **63** | **21** | **63 VERIFIED (100%)** |

---

## 2. 상세 FAQ 인벤토리 전수 명세 (Itemized 63 FAQ Records)


### 2.1 [K SELECT 브랜드 등록 및 관리 정책] (5 FAQs)

- **Knowledge ID:** `kno-brand-policy-v10`
- **Source Version:** `v1.0`
- **Topic ID:** `topic-brand`
- **Portal Scope:** `BRAND`

#### [faq-brand-01] 브랜드는 어떻게 등록하나요? ⭐ [FEATURED]
- **Question (EN):** How do I register a brand in the portal?
- **Answer (KO):** 포털 내 브랜드 관리 메뉴(/portal/brands) 또는 신규 등록 화면(/portal/brands/new)에서 브랜드 국문/영문명, 사업자 등록번호, 대표 카테고리, 슬로건 및 물류 출고지/반품지 정보를 입력하여 등록합니다. 상품 등록 전 활성 브랜드 등록이 필수입니다. (Policy 01)
- **Answer (EN):** Navigate to Brand Management (/portal/brands) or New Brand (/portal/brands/new) to enter brand names, business ID, category, and logistics origins. Brand registration is mandatory before product listings. (Policy 01)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-brand-02] 상표권이 없어도 브랜드 등록이 가능한가요? ⭐ [FEATURED]
- **Question (EN):** Can I register a brand without an official trademark?
- **Answer (KO):** 네, 가능합니다. 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 자유롭게 등록하여 입점할 수 있습니다. (Policy 02)
- **Answer (EN):** Yes. Brand registration in the portal is for catalog classification and does not require official trademark registration. Brands without trademarks or with pending applications can be registered. (Policy 02)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-brand-03] 상품이 연결된 브랜드를 삭제할 수 있나요? ⭐ [FEATURED]
- **Question (EN):** Can I delete a brand that has associated products?
- **Answer (KO):** 단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다. 취급 중단 시 영구 삭제 대신 '사용 중단(Inactive)' 비활성화 처리를 적용하며, 언제든지 재활성화가 가능합니다. (Policy 05 & 06)
- **Answer (EN):** Brands associated with even one product cannot be physically hard-deleted to preserve order, customs, and invoice audit integrity. Use Inactive status instead. (Policy 05 & 06)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-brand-04] 동일한 브랜드를 여러 회사가 취급할 수 있나요? 
- **Question (EN):** Can multiple partner companies distribute the same brand?
- **Answer (KO):** 네, 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 공식 총판, 셀러)가 독립적으로 취급할 수 있습니다. 단, 지식재산권을 직접 보유한 원천 Brand Owner는 시스템상 1개사로 정의됩니다. (Policy 03 & 04)
- **Answer (EN):** Yes. Multiple independent companies (manufacturers, distributors, sellers) can distribute the same brand, while authoritative Brand Ownership is maintained at 1 entity. (Policy 03 & 04)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-brand-05] 사용하지 않는 브랜드는 어떻게 처리하나요? 
- **Question (EN):** How do I handle unused or discontinued brands?
- **Answer (KO):** 취급을 중단하거나 사용하지 않는 브랜드는 브랜드 관리 목록에서 '사용 중단(Inactive)'으로 전환합니다. 비활성화된 브랜드는 신규 상품 등록 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다. (Policy 06)
- **Answer (EN):** Set discontinued brands to Inactive in the Brand Management screen. Inactive brands are hidden from new product selection while preserving audit history. (Policy 06)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)


### 2.2 [K SELECT Brand Portal 온보딩 가이드 (MAN-B-ONB-001)] (9 FAQs)

- **Knowledge ID:** `kno-onboarding-guide-v10`
- **Source Version:** `v1.0`
- **Topic ID:** `topic-start`
- **Portal Scope:** `BRAND`

#### [faq-onb-01] 처음 가입하면 무엇부터 해야 하나요? 온보딩 절차가 어떻게 되나요? ⭐ [FEATURED]
- **Question (EN):** What should I do first after signing up? What is the onboarding process?
- **Answer (KO):** 포털 로그인 후 대시보드(/portal)의 7단계 온보딩 로드맵에 따라 회사 정보 확인 ➔ 관리자 프로필 ➔ 브랜드 정보 ➔ 팀원 초대(선택) ➔ 6대 담당업무 지정 ➔ 상품 등록 ➔ 기본계약 전자서명을 진행합니다. 각 단계는 서류 및 정보 준비 상황에 따라 원하는 순서대로 자유롭게 선택하여 진행할 수 있습니다. (Chapter 02 · 7-Step Roadmap)
- **Answer (EN):** After logging in, follow the 7-step onboarding roadmap on the dashboard (/portal): Company Info -> Admin Profile -> Brand Info -> Team Invitation (Optional) -> 6 Task Owners -> Product Listing -> Master Agreement. Steps can be completed in any flexible order based on your document readiness. (Chapter 02 · 7-Step Roadmap)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-02] 회사 정보 등록 시 필수 입력 항목은 무엇인가요? ⭐ [FEATURED]
- **Question (EN):** What are the mandatory fields when registering company information?
- **Answer (KO):** 회사 정보 관리 메뉴(/portal/company/info)에서 공식 법인명, 대표 연락처와 함께 필수 4대 주소(기본 주소 address_1, 시 City, 주/도 State/Province, 우편번호 Zip Code)를 입력해야 합니다. 4개 주소 필드가 모두 저장되어야 온보딩 1단계(STEP 1)가 완료 처리됩니다. (Chapter 04 · STEP 1)
- **Answer (EN):** In Company Information (/portal/company/info), you must provide legal corporate name, contact phone, and all 4 mandatory address fields: Address 1, City, State/Province, and Zip Code. All 4 address fields must be saved to complete STEP 1. (Chapter 04 · STEP 1)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-03] 관리자 정보에서 영문 이름은 왜 필수이며 어떻게 입력해야 하나요? 
- **Question (EN):** Why is English name required in admin profile and how should it be entered?
- **Answer (KO):** 내 계정 메뉴(/portal/account)에서 등록하는 대표 관리자의 영문 성명(First Name, Last Name)은 글로벌 무역 서류 및 통관, 공식 파트너십 커뮤니케이션에 활용되므로 여권상 영문 표기와 동일하게 입력해야 합니다. 국문 성명, 직함(Job Title), 연락처와 함께 저장하면 2단계(STEP 2)가 완료됩니다. (Chapter 05 · STEP 2)
- **Answer (EN):** The administrator's English name (First Name, Last Name) in My Account (/portal/account) is used for global trade documents, customs, and official partnership communications, so it must match your passport exactly. Save along with Korean name, Job Title, and phone to complete STEP 2. (Chapter 05 · STEP 2)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-04] 브랜드 정보 확인 단계(STEP 3)에서는 무엇을 확인하나요? 
- **Question (EN):** What should I verify during the Brand Information step (STEP 3)?
- **Answer (KO):** 브랜드 관리 메뉴(/portal/brands)에서 등록된 대표 브랜드명, 브랜드 로고, 대한민국(KIPO)/미국(USPTO) 상표권 보유 현황을 점검하고 상단 배너의 '브랜드 정보 확인 완료 ✓' 버튼을 클릭합니다. 신규 브랜드 추가 및 상표권 상세 정책은 MAN-BRAND-001 문서를 참고해 주시기 바랍니다. (Chapter 06 · STEP 3)
- **Answer (EN):** In Brand Management (/portal/brands), check your registered brand name, logo, and KIPO/USPTO trademark registration status, then click 'Confirm Brand Information ✓'. For detailed brand registration and trademark policies, refer to MAN-BRAND-001. (Chapter 06 · STEP 3)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-05] 팀원 초대는 필수인가요? 1인 기업은 어떻게 하나요? ⭐ [FEATURED]
- **Question (EN):** Is team invitation mandatory? How do solo/single-person businesses proceed?
- **Answer (KO):** 팀원 초대는 선택 사항(Optional)입니다. 사내 동료가 있는 경우 소속 사용자 관리(/portal/company/users)에서 이메일로 초대할 수 있으며, 1인 기업이거나 즉시 초대가 불필요한 경우 대시보드 온보딩 체크리스트 STEP 4 카드의 '나중에 하기' 버튼을 누르면 본 단계를 건너뛰고 완료할 수 있습니다. (Chapter 07 · STEP 4)
- **Answer (EN):** Team invitation is optional. If you have colleagues, you can invite them via email in Team Management (/portal/company/users). For solo entrepreneurs or if immediate invitations are not needed, click 'Do this later' on the STEP 4 dashboard card to skip and complete this step. (Chapter 07 · STEP 4)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-06] 6대 담당업무는 어떻게 지정하며, 한 사람이 여러 업무를 담당할 수 있나요? ⭐ [FEATURED]
- **Question (EN):** How are the 6 core task owners assigned, and can one person hold multiple roles?
- **Answer (KO):** 회사 정보 관리 > 담당 업무 탭(/portal/company/info?tab=tasks)에서 6대 핵심 업무(회사·신청, 계약, 제품·콘텐츠·인증, 가격·견적, 발주·물류·재고, 정산·문의)별 사내 주 담당자(Primary Owner)를 드롭다운에서 지정합니다. 1인 기업 또는 소규모 팀의 경우 대표 관리자 1인이 6개 업무를 모두 겸임하여 지정할 수 있습니다. (Chapter 08 · STEP 5)
- **Answer (EN):** Navigate to Company Info > Task Owners tab (/portal/company/info?tab=tasks) to assign Primary Owners across 6 operational areas (Company, Contract, Product/Cert, Pricing/Quote, Orders/Logistics, Settlement/Inquiry). For solo or small teams, a single admin can hold all 6 primary owner roles. (Chapter 08 · STEP 5)
- **Display Order:** `6` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-07] 온보딩을 완료하려면 상품을 몇 개 등록해야 하며, 어떤 상태여야 하나요? ⭐ [FEATURED]
- **Question (EN):** How many products must be registered to complete onboarding, and what status is required?
- **Answer (KO):** 대표 상품을 최소 1개 이상 '등록 완료(COMPLETE)' 상태로 등록(/portal/products)해야 합니다. 단순 임시저장(Draft) 상태는 인정되지 않으며, 기본정보, 카테고리 필수 속성, 가격(소비자가/FOB가), 3단계 로지스틱스 규격(단품/패키지/카톤), 바코드(UPC/EAN), 대표 이미지가 모두 입력되어야 합니다. (Chapter 09 · STEP 6)
- **Answer (EN):** You must register at least 1 representative product in 'COMPLETE' status in Product Management (/portal/products). Draft status is not accepted. All requirements including basic info, category attributes, pricing (Retail/FOB), 3-tier specs (Item/Package/Carton), barcode (UPC/EAN), and image must be filled. (Chapter 09 · STEP 6)
- **Display Order:** `7` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-08] 기본계약 체결은 언제 어떻게 진행하나요? 계약 전에도 상품 등록이 가능한가요? 
- **Question (EN):** When and how is the Master Agreement signed? Can products be listed before signing?
- **Answer (KO):** 회사 정보 관리 > 공급 및 이용 약관 탭(/portal/company/info?tab=agreements)에서 비독점 기본공급계약서 전문을 검토한 후 서명 패드에 자필 전자서명을 작성하여 체결합니다. 계약 체결 전이라도 상품 등록 및 기본 정보 입력 등 사전 준비 작업은 자유롭게 진행하실 수 있습니다. (Chapter 10 · STEP 7)
- **Answer (EN):** In Company Info > Agreements tab (/portal/company/info?tab=agreements), review the Non-Exclusive Master Agreement terms and execute electronic signature on the pad. Product listing and preparatory tasks can be conducted freely even before agreement execution. (Chapter 10 · STEP 7)
- **Display Order:** `8` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-onb-09] 온보딩 7단계를 모두 완료하면 어떻게 되나요? 
- **Question (EN):** What happens after completing all 7 onboarding steps?
- **Answer (KO):** 7개 단계가 모두 완료되면 대시보드 상단에 '7 / 7 완료 (100%)' 녹색 배지가 표시되며 Brand Portal의 정식 운영 기능이 활성화됩니다. 온보딩 완료 후에도 회사 주소, 담당자, 계좌, 상품 정보 등 변경 사항이 발생하면 언제든지 해당 메뉴에서 실시간으로 수정할 수 있습니다. (Chapter 11 · Onboarding Complete)
- **Answer (EN):** Once all 7 steps are complete, the '7 / 7 Complete (100%)' green badge appears on the dashboard, unlocking standard Brand Portal operations. Even after completion, company details, owners, and product specs can be updated in real time whenever changes occur. (Chapter 11 · Onboarding Complete)
- **Display Order:** `9` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)


### 2.3 [K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)] (12 FAQs)

- **Knowledge ID:** `kno-order-management-v10`
- **Source Version:** `v1.0`
- **Topic ID:** `topic-orders`
- **Portal Scope:** `BRAND`

#### [faq-ord-01] 발주 요청(PO Request)과 정식 발주서(Official Purchase Order)는 어떻게 다른가요? ⭐ [FEATURED]
- **Question (EN):** What is the difference between a Purchase Order Request and an Official Purchase Order?
- **Answer (KO):** K SELECT 오더 시스템은 2-Phase 아키텍처로 운영됩니다. ①발주 요청(/portal/orders/requests)은 리테일러/바이어가 상품 구매 의사를 타진하는 사전 조율 단계이며, ②정식 발주서(/portal/orders/purchase-orders)는 승인된 요청에 대해 관리자가 정식 발주 번호(PO-YYYYMMDD-XXXX)를 부여하여 발행하는 법적 구속력을 갖는 정식 납품 계약입니다. (Chapter 01 & 02)
- **Answer (EN):** K SELECT operates a 2-Phase Order Architecture: ①PO Requests (/portal/orders/requests) are preliminary buyer purchase proposals, and ②Official Purchase Orders (/portal/orders/purchase-orders) are legally binding fulfillment contracts issued by Admin with formal PO numbers (PO-YYYYMMDD-XXXX). (Chapter 01 & 02)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-02] 바이어의 발주 요청(PO Request)을 승인하거나 거절하려면 어떻게 해야 하나요? ⭐ [FEATURED]
- **Question (EN):** How do I approve or reject a Retailer Purchase Order Request?
- **Answer (KO):** 발주 요청 상세 화면(/portal/orders/requests/[id])에서 품목, 희망 수량, 제안 납기일, 단가를 확인한 후 우측 상단의 [요청 승인(Approve)] 또는 [요청 거절(Reject)] 버튼을 클릭합니다. 거절 시에는 바이어에게 전달될 구체적인 사유(재고 부족, 생산 일정 불가 등)를 필수로 입력해야 합니다. (Chapter 02 · Section 2.2)
- **Answer (EN):** In the PO Request Detail screen (/portal/orders/requests/[id]), review items, requested quantity, proposed delivery date, and unit price, then click [Approve] or [Reject]. If rejecting, entering a specific reason (e.g., out of stock, production lead time mismatch) is mandatory. (Chapter 02 · Section 2.2)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-03] 발주 요청(PO Request)을 한 번 승인하거나 거절한 후 상태를 다시 변경할 수 있나요? ⭐ [FEATURED]
- **Question (EN):** Can I revert or change the status of a PO Request after approving or rejecting it?
- **Answer (KO):** 아니요. 상태 불변(State Immutability) 원칙에 따라 발주 요청은 승인(APPROVED) 또는 거절(REJECTED) 처리되는 즉시 상태가 영구 동결(Frozen)되며 되돌릴 수 없습니다. 검토 시 생산 일정 및 재고 수량을 면밀히 확인한 후 신중하게 결정해 주시기 바랍니다. (Chapter 02 · Status Immutability)
- **Answer (EN):** No. Under the State Immutability rule, once a PO Request is Approved (APPROVED) or Rejected (REJECTED), its status is permanently frozen and cannot be reverted. Please verify production schedules and stock availability thoroughly before confirming. (Chapter 02 · Status Immutability)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-04] 발주 요청을 승인하면 즉시 제품 생산 및 출고를 진행해야 하나요? ⭐ [FEATURED]
- **Question (EN):** Should I start production and shipping immediately after approving a PO Request?
- **Answer (KO):** 아닙니다. 발주 요청 승인(APPROVED)은 구매 의사 수락 단계이며, 즉시 생산을 시작하는 것이 아닙니다. 관리자(Admin)가 승인된 요청을 검토하여 정식 발주서(Official PO)를 발행하고 포털에 PO Sent 상태로 도달한 후, 공급자 주문 확정(Confirm PO)을 완료한 시점부터 본격적인 생산 공정을 진행합니다. (Chapter 02 & 03)
- **Answer (EN):** No. Approving a PO Request only confirms acceptance of buyer intent. Production begins after Admin issues an Official PO, reaches PO Sent status in the portal, and the brand completes Supplier Confirmation (Confirm PO). (Chapter 02 & 03)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-05] 정식 발주서(Official PO)의 6단계 라이프사이클은 어떻게 진행되나요? ⭐ [FEATURED]
- **Question (EN):** What is the 6-step lifecycle of an Official Purchase Order?
- **Answer (KO):** 정식 발주서는 ①발주서 발행(PO Sent / ISSUED) → ②공급자 주문 확정(Supplier Confirmed) → ③생산 중(In Production) → ④출고 준비(Ready to Ship / Goods Ready) → ⑤배송 중(Shipped / In Transit) → ⑥입고/오더 완료(Completed)의 6단계 표준 라이프사이클을 거칩니다. (Chapter 03 · 6-Step Stepper)
- **Answer (EN):** Official POs progress through a 6-step lifecycle: ①PO Sent (ISSUED) → ②Supplier Confirmed → ③In Production → ④Ready to Ship (Goods Ready) → ⑤Shipped (In Transit) → ⑥Completed (Fulfillment Closed). (Chapter 03 · 6-Step Stepper)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-06] 발주서의 수량, 단가, 납기일에 변경이 필요한 경우 어떻게 처리하나요? 
- **Question (EN):** How do I request adjustments if order quantities, pricing, or dates need revision?
- **Answer (KO):** 발주서 상세(/portal/orders/purchase-orders/[id])의 [Overview] 탭에서 수량 및 납기일을 확인하고, 이견이 있는 경우 [수정 요청(Request Change)]을 통해 변경 희망 사항을 입력하거나 Help Center 1:1 지원 문의로 전담 매니저에게 통보하여 발주서 정정(PO Revision) 절차를 진행할 수 있습니다. (Chapter 03 · Section 3.2)
- **Answer (EN):** On the PO Detail Overview tab (/portal/orders/purchase-orders/[id]), review quantities and dates. If adjustments are required, click [Request Change] or submit a ticket via Help Center 1:1 Support to request a formal PO Revision with your account manager. (Chapter 03 · Section 3.2)
- **Display Order:** `6` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-07] 공급자 발주서 확정(Confirm PO)을 완료하면 정산(Finance) 인보이스는 언제 발행할 수 있나요? 
- **Question (EN):** When can I create a Supplier Invoice in Finance after confirming an order?
- **Answer (KO):** po_status IN ('APPROVED', 'SENT') 및 supplier_confirmation_status = 'CONFIRMED' 조건을 충족하고 기존에 유효한(non-VOID/non-REJECTED) 공급사 인보이스가 존재하지 않는 경우, 재무 도메인(/portal/finance/invoices)에서 해당 PO에 대한 공급사 인보이스(Supplier Invoice) 생성 자격이 활성화됩니다. 상세 인보이스 작성 및 AP 승인 절차는 MAN-B-FIN-001을 참조하세요. (Chapter 06 · Finance Handoff)
- **Answer (EN):** When po_status IN ('APPROVED', 'SENT') and supplier_confirmation_status = 'CONFIRMED' are met with no active (non-VOID/non-REJECTED) invoice already existing, the PO becomes eligible for Supplier Invoice creation in Finance (/portal/finance/invoices). Refer to MAN-B-FIN-001 for invoice filing. (Chapter 06 · Finance Handoff)
- **Display Order:** `7` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-08] 제품 생산 완료 후 물류 출고 준비(Goods Ready)는 어떻게 통보하나요? 
- **Question (EN):** How do I notify the team when products are finished and ready for shipment (Goods Ready)?
- **Answer (KO):** 생산이 완료되고 마스터 카톤 패킹 및 라벨링이 준비되면, 발주서 상세의 [Goods Ready] 버튼을 클릭하여 실제 생산 완료 수량, 패킹 카톤 수, 포워더 인계 가능 일자(Ready Date)를 입력하고 제출합니다. 상태는 자동으로 Step 4(Ready to Ship)로 전환됩니다. (Chapter 04 · Goods Ready)
- **Answer (EN):** When production and carton labeling are complete, click [Goods Ready] in the PO Detail to submit ready quantities, total carton count, and ready date. The PO automatically transitions to Step 4 (Ready to Ship). (Chapter 04 · Goods Ready)
- **Display Order:** `8` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-09] 화물 배송(Step 5: Shipped) 단계에서 등록해야 하는 필수 물류 정보는 무엇인가요? 
- **Question (EN):** What mandatory logistics tracking information is required at Step 5 (Shipped)?
- **Answer (KO):** 지정 3PL 운송사 또는 포워더에 화물을 인계한 후, 선하증권(B/L) 번호, 택배 송장번호(Tracking Number), 배송 업체명, 출고 일시를 등록해야 합니다. 등록된 운송장 정보는 바이어 및 운영팀에 실시간 공유되어 입고 스케줄링에 활용됩니다. (Chapter 04 · Section 4.2)
- **Answer (EN):** After handing cargo over to the 3PL carrier or forwarder, enter the B/L number, tracking number, carrier name, and departure date. This tracking data is synced in real time for warehouse receiving scheduling. (Chapter 04 · Section 4.2)
- **Display Order:** `9` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-10] 오더 라이프사이클의 마지막 단계인 'COMPLETED(입고/오더 완료)'는 판매대금 지급(정산)을 의미하나요? 
- **Question (EN):** Does the final lifecycle status 'COMPLETED' mean payment settlement?
- **Answer (KO):** 아닙니다. COMPLETED는 미국 현지 물류센터(Fulfillment Center)에 화물이 실물 도착하여 입고 검수(Receiving Inspection)를 정상 통과하고 '물류센터 검수 완료 및 오더 이행 최종 종결(Order Fulfillment Completed)'되었음을 의미합니다. 판매대금 지급 및 정산(PAID)은 재무 도메인(MAN-B-FIN-001)에서 독립적으로 처리되며 오더 이행 종결과 정산 완료는 분리되어 있습니다. (Chapter 05 · Completed Definition)
- **Answer (EN):** No. COMPLETED means cargo arrived at the US fulfillment center, passed receiving inspection, and order fulfillment is formally closed. Payment remittance and settlement (PAID) are managed independently in the Finance domain (MAN-B-FIN-001). (Chapter 05 · Completed Definition)
- **Display Order:** `10` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-11] 물류 배송(LOG)과 대금 정산(FIN)은 순차적으로 종속되어 진행되나요? 
- **Question (EN):** Are Logistics (LOG) and Finance (FIN) sequentially dependent workflows?
- **Answer (KO):** 아닙니다. 공식 발주서가 확정(Confirm PO)되면 물류(출고/선적) 트랙과 재무(인보이스/정산) 트랙은 각각 독립된 병렬(Parallel) 구조로 운영됩니다. 선적이나 입고 완료 여부와 무관하게 계약 조건에 따라 인보이스 심사 및 지급 절차가 별도 일정으로 진행됩니다. (Chapter 01 · Parallel Domains)
- **Answer (EN):** No. Once an Official PO is confirmed (Confirm PO), Logistics (fulfillment/shipping) and Finance (invoice/settlement) operate as independent parallel tracks. Invoicing and payout schedules follow financial contract terms separately from shipping milestones. (Chapter 01 · Parallel Domains)
- **Display Order:** `11` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ord-12] 발주서 PDF, 패킹리스트, 상업송장 등 무역 서류는 어디서 다운로드할 수 있나요? 
- **Question (EN):** Where can I download Official PO PDFs, Packing Lists, and Commercial Invoices?
- **Answer (KO):** 발주서 상세 화면(/portal/orders/purchase-orders/[id])의 [무역 서류 보관함(Documents)] 탭에서 공식 발주서(Official PO PDF), 패킹리스트(Packing List), 상업송장(Commercial Invoice), 운송장 라벨 및 물류센터 검수 성적서를 언제든지 원클릭으로 다운로드할 수 있습니다. (Chapter 06 · Document Hub)
- **Answer (EN):** Navigate to the [Documents] tab in the PO Detail screen (/portal/orders/purchase-orders/[id]) to download the Official PO PDF, Packing List, Commercial Invoice, Shipping Labels, and Warehouse Inspection Reports with one click. (Chapter 06 · Document Hub)
- **Display Order:** `12` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)


### 2.4 [K SELECT Brand Portal 상품 등록 및 관리 매뉴얼 (MAN-B-PROD-001)] (14 FAQs)

- **Knowledge ID:** `kno-product-management-v10`
- **Source Version:** `v1.0`
- **Topic ID:** `topic-product`
- **Portal Scope:** `BRAND`

#### [faq-prod-01] 신규 상품 등록(Add Product)을 진행하려면 어떤 사전 준비가 필요한가요? ⭐ [FEATURED]
- **Question (EN):** What preparations are needed before adding a new product (Product Registration)?
- **Answer (KO):** 상품 등록(Product Registration)을 시작하기 전에 먼저 포털에 등록된 활성(Active) 브랜드가 1개 이상 존재해야 합니다. 브랜드가 없는 경우 신규 브랜드 등록 화면(/portal/brands/new)으로 자동 이동하며, 등록 시 영문 제품명, 자사 제조사 SKU, 바코드(UPC/EAN), 기본 가격 및 패키지 규격을 준비하면 신속하게 등록할 수 있습니다. (Chapter 02 · Phase 1)
- **Answer (EN):** At least one active brand must be registered in the portal before adding a new product (Product Registration). If no brand exists, you will be redirected to New Brand (/portal/brands/new). Have your English product name, manufacturer SKU, barcode (UPC/EAN), basic pricing, and package dimensions ready. (Chapter 02 · Phase 1)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-02] 임시 저장(Draft Product)과 제품 등록(Complete)의 차이는 무엇인가요? ⭐ [FEATURED]
- **Question (EN):** What is the difference between saving a draft product and complete product registration?
- **Answer (KO):** 임시 저장(Draft Product)은 브랜드, 카테고리, 영문명, 제조사 SKU만 입력하여 보완 대기 상태로 저장하는 것이며, '제품 등록 및 계속'은 필수 유효성을 충족한 후 상세 관리 화면(/portal/products/[id])으로 이동하는 방식입니다. 파트너사 온보딩 완수 및 MD 입점 검토를 위해서는 10대 필수 조건이 모두 입력된 등록 완료(COMPLETE) 상태여야 합니다. (Chapter 03 · Draft vs Complete)
- **Answer (EN):** Saving a draft product records basic identifiers into Draft status for later completion, while 'Register & Continue' validates Phase 1 and moves to Product Detail (/portal/products/[id]). Completing onboarding and MD selection reviews requires full 'COMPLETE' status across all 10 criteria. (Chapter 03 · Draft vs Complete)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-03] 상품 등록 완료(COMPLETE)를 판정하는 10대 필수 조건은 무엇인가요? ⭐ [FEATURED]
- **Question (EN):** What are the 10 mandatory criteria for complete product registration?
- **Answer (KO):** ①소속 활성 브랜드, ②3-Depth 리프 카테고리, ③카테고리 필수 동적 속성(*), ④영문 공식 제품명, ⑤제조사 SKU 코드, ⑥원산지 국가, ⑦2대 필수 가격(한국소비자가 KRW + 수출FOB가 USD), ⑧3단계 물리 규격(단품/패키지/마스터카톤 및 입수량), ⑨식별 바코드(12자리 UPC 또는 13자리 EAN), ⑩대표 상품 이미지(1장 이상)가 모두 입력되어야 합니다. (Chapter 10 · Complete Criteria)
- **Answer (EN):** ①Active Brand, ②3-Depth Leaf Category, ③Mandatory Category Attributes (*), ④English Product Name, ⑤Manufacturer SKU, ⑥Country of Origin, ⑦2 Required Prices (KRW Retail + FOB USD), ⑧3-Tier Physical Specs (Item/Package/Carton + Pack Qty), ⑨Barcode (12-digit UPC or 13-digit EAN), and ⑩At least 1 product image. (Chapter 10 · Complete Criteria)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-04] 필수 항목을 입력했는데도 계속 Draft(보완 대기)로 표시되면 어떻게 하나요? ⭐ [FEATURED]
- **Question (EN):** Why does my product stay in Draft status and how do I fix missing fields?
- **Answer (KO):** 상품 상세 화면 상단의 로즈색 보완 대기 배너에 표시된 누락 항목 뱃지(예: [FOB 수출 가격 누락], [마스터 카톤 규격 누락])를 클릭하세요. 스마트 자동 포커스 기능이 해당 입력 탭으로 즉시 전환하고 누락된 필드로 스크롤하여 붉은색 테두리로 강조 표시해 줍니다. (Chapter 11 · Autofocus Navigation)
- **Answer (EN):** Click any missing field badge displayed in the rose-colored Draft banner at the top of the Product Detail screen. The interactive autofocus system will automatically switch to the correct tab, scroll directly to the missing input, and highlight it with a red border. (Chapter 11 · Autofocus Navigation)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-05] 카테고리 선택 및 동적 속성은 어떻게 입력하나요? 
- **Question (EN):** How do I select categories and enter dynamic attributes?
- **Answer (KO):** 탭 2(카테고리 & 속성)에서 3단계(대분류 ➔ 중분류 ➔ 소분류 리프) 카테고리를 선택하거나, 스마트 동의어 검색창에 키워드(예: 수분크림, Sunscreen)를 입력하여 즉시 지정합니다. 선택된 카테고리에 따라 피부 타입, 제형, SPF 등 맞춤형 동적 속성 폼이 자동으로 나타나며 붉은 별표(*) 필수 항목을 입력하면 됩니다. (Chapter 05 · Tab 2)
- **Answer (EN):** In Tab 2 (Category & Attributes), navigate through the 3-Depth hierarchy or use the smart synonym search (e.g., 'Moisturizer', 'Sunscreen') to select the leaf category. Tailored dynamic attribute forms (Skin Type, Formulation, SPF, etc.) load automatically based on your category. (Chapter 05 · Tab 2)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-06] 미국 바코드(UPC)와 국제 바코드(EAN) 중 무엇을 입력해야 하나요? 
- **Question (EN):** Should I enter a US UPC barcode or an international EAN barcode?
- **Answer (KO):** 미국 대형 오프라인 리테일러 입점을 위해서는 숫자 12자리 UPC 바코드 입력을 적극 권장합니다. 현재 UPC가 없는 경우 한국 880 표준을 포함한 숫자 13자리 EAN 바코드를 입력해도 등록 완료(COMPLETE)가 가능합니다. (Chapter 02 & 14 · Barcode Specs)
- **Answer (EN):** A 12-digit UPC barcode is strongly recommended for US brick-and-mortar retail placement. If you do not currently have a UPC, a standard 13-digit EAN barcode (including Korean 880 barcodes) is accepted for COMPLETE registration. (Chapter 02 & 14 · Barcode Specs)
- **Display Order:** `6` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-07] 가격 정보(FOB, 소비자가) 및 수량별 공급가(Pricing)는 어떻게 설정하나요? 
- **Question (EN):** How do I set pricing (FOB, Retail) and tiered quantity rates (MOQ Pricing)?
- **Answer (KO):** 탭 3(가격 정보)에서 한국 소비자가(KRW)와 수출용 FOB 공급가(USD)를 필수로 입력합니다. 시스템이 환율 기반 FOB 마진율(%)과 배수를 실시간 자동 연산하며, 대량 발주에 대응하기 위해 수량 구간별(MOQ Tier) 차등 공급가(Tiered Pricing)를 추가로 구성할 수 있습니다. (Chapter 06 · Tab 3)
- **Answer (EN):** In Tab 3 (Pricing Info), KRW Retail price and FOB Export price (USD) are mandatory. The system calculates real-time FOB margin (%) and multiples based on daily exchange rates. You can also configure quantity-based tiered pricing rates for bulk MOQ orders. (Chapter 06 · Tab 3)
- **Display Order:** `7` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-08] 물류(Logistics) 3단계 물리 규격(단품, 패키지, 마스터 카톤)과 CBM은 어떻게 입력하나요? 
- **Question (EN):** How do I enter the 3-tier logistics and package specifications, and calculate CBM?
- **Answer (KO):** 탭 4(물류 / 로지스틱스)에서 ①단품 본품 크기/순중량, ②단상자 개별 포장 패키지(Package) 규격/총중량, ③수출용 마스터 카톤 규격 및 카톤당 입수량을 입력합니다. cm/inch 및 g/kg/lb 단위 입력 시 실시간 자동 환산되며, 카톤 체적(CBM)은 공식에 따라 실시간 자동 계산됩니다. (Chapter 07 · Tab 4)
- **Answer (EN):** In Tab 4 (Logistics), enter ①Item specs (net dimensions/weight), ②Package specs (unit box dimensions/gross weight), and ③Master Carton dimensions with pack quantity. Units convert bidirectionally (cm/inch, g/kg/lb) and CBM is calculated automatically. (Chapter 07 · Tab 4)
- **Display Order:** `8` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-09] 컨테이너 적재 시뮬레이터(Container Simulator)는 어떻게 활용하나요? 
- **Question (EN):** How does the Container Load Simulator work for sea shipping logistics?
- **Answer (KO):** 탭 4에 마스터 카톤 규격과 카톤당 입수량을 입력하면, 해상 선적용 20ft 표준(28 CBM), 40ft 표준(58 CBM), 40ft High Cube(68 CBM) 컨테이너별 최대 적재 가능 카톤 수 및 총 제품 수량이 실시간 자동 시뮬레이션되어 표시됩니다. (Chapter 07 · Container Simulator)
- **Answer (EN):** When you enter master carton dimensions and pack quantity in Tab 4, the system automatically simulates maximum loadable cartons and total unit capacity across 20ft (28 CBM), 40ft (58 CBM), and 40ft HQ (68 CBM) sea containers in real time. (Chapter 07 · Container Simulator)
- **Display Order:** `9` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-10] 상품 이미지(Product Image) 등록 요건과 대표 썸네일 변경 방법은 무엇인가요? ⭐ [FEATURED]
- **Question (EN):** What are the product image requirements and how do I change the thumbnail?
- **Answer (KO):** 상품 이미지는 최대 10장, 파일당 최대 10MB까지 등록할 수 있으며 JPG, PNG, WEBP 포맷을 지원합니다 (1000×1000 이상 흰색 배경 정방형 권장). 탭 5(미디어)에서 등록된 이미지 카드를 드래그하여 첫 번째(Position 0) 위치에 놓으면 대표 썸네일로 즉시 자동 지정 및 저장됩니다. (Chapter 08 · Tab 5)
- **Answer (EN):** Upload up to 10 product images (max 10MB each, JPG/PNG/WEBP; 1000x1000 white background square recommended). In Tab 5 (Media), drag and drop any image card to the first position (Position 0) to instantly set and save it as the primary thumbnail. (Chapter 08 · Tab 5)
- **Display Order:** `10` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-11] 국문 전성분 번역 및 원산지, 리드타임은 어떻게 등록하나요? 
- **Question (EN):** How do I register ingredients translation, country of origin, and lead time?
- **Answer (KO):** 탭 1(기본 정보)에서 원산지 국가와 출고 리드타임(예: 14일), 용량/중량을 입력합니다. 한글 전성분 텍스트를 입력창에 붙여넣고 '영문 번역' 버튼을 클릭하면 전문 화장품 용어로 실시간 번역되어 영문 전성분 필드에 원클릭으로 자동 적용됩니다. (Chapter 04 · Tab 1)
- **Answer (EN):** In Tab 1 (Basic Info), enter Country of Origin, Lead Time (e.g., 14 days), and Volume/Weight. Paste Korean ingredients and click 'Translate to English' to perform real-time cosmetic terminology translation and auto-populate English ingredients. (Chapter 04 · Tab 1)
- **Display Order:** `11` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-12] 인증서(Certification), 상표권 및 인허가 서류는 어떻게 업로드하고 버전 관리되나요? 
- **Question (EN):** How are certification documents, trademarks, and compliance certificates uploaded and versioned?
- **Answer (KO):** 탭 6(인허가 & 보증서 / 인증서)에서 전성분표, 상표등록증, 시험성적서, 유통 증빙 서류 등을 업로드합니다. 동일 서류 항목에 새로운 파일을 업로드하면 이전 파일이 삭제되지 않고 v1, v2, v3 형태로 과거 버전 이력이 자동 보존됩니다. 미국 MoCRA 등 심층 규제 절차는 MAN-B-REG-001 문서를 참조하세요. (Chapter 09 · Tab 6)
- **Answer (EN):** In Tab 6 (Certificates), upload ingredient sheets, trademark registrations, test reports, and compliance certification documents. Uploading updated files automatically preserves past history as v1, v2, v3 versioning without overwriting. Refer to MAN-B-REG-001 for MoCRA compliance details. (Chapter 09 · Tab 6)
- **Display Order:** `12` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-13] 상품의 3대 독립 상태(등록, 선정, 판매)는 각각 무엇을 의미하나요? 
- **Question (EN):** What do the 3 independent status dimensions (Registration, Selection, Sales) mean?
- **Answer (KO):** ①등록 상태(Draft/Complete): 브랜드사가 10대 필수 정보를 입력 완료했는지 나타냄, ②선정 상태(Unreviewed/Under Review/Selected/Info Req/Not Selected): K SELECT MD가 미국 유통 공급 대상 여부를 심사함, ③판매 상태(Preparing/On Sale/Paused/Ended): 통관 및 현지 발주/판매 진행 상태를 나타내며 세 상태는 독립적으로 동작합니다. (Chapter 12 · 3 Status Dimensions)
- **Answer (EN):** ①Registration Status (Draft/Complete): Whether mandatory product data is 100% complete; ②Selection Status (Unreviewed/Under Review/Selected/Info Req): K SELECT MD review for retail placement; ③Sales Status (Preparing/On Sale/Paused/Ended): Logistics, clearance, and retail order execution. (Chapter 12 · 3 Status Dimensions)
- **Display Order:** `13` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-prod-14] 등록된 상품 수정 및 삭제는 어떻게 하며, 삭제 후 복구가 필요한 경우 어떻게 하나요? 
- **Question (EN):** How do I edit or delete a product, and how can I request recovery if deleted?
- **Answer (KO):** 상품 정보 수정(상품 수정)은 상품 상세 화면에서 언제든지 실시간으로 가능하며, 상품 삭제 시 물리적 데이터는 삭제되지 않고 deleted_at 타임스탬프가 기록되어 'Deleted (삭제됨)' 필터 탭으로 안전하게 격리 보관됩니다. SKU 및 과거 주문 이력은 영구 보존되며, 실수로 삭제하여 복구 및 재활성화가 필요한 경우 Help Center 1:1 고객지원으로 문의하시면 운영팀이 처리해 드립니다. (Chapter 13 · Soft Delete)
- **Answer (EN):** Product editing can be performed at any time in the Product Detail screen. Product deletion performs a soft delete with a deleted_at timestamp, safely moving the product to the 'Deleted' filter tab. SKU and order histories are preserved. If you accidentally deleted an item and need recovery support, contact Help Center 1:1 Support. (Chapter 13 · Soft Delete)
- **Display Order:** `14` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)


### 2.5 [K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)] (12 FAQs)

- **Knowledge ID:** `kno-regulatory-compliance-v11`
- **Source Version:** `v1.1.0`
- **Topic ID:** `topic-regulatory`
- **Portal Scope:** `BRAND`

#### [faq-reg-01] 미국 수출(MoCRA) 및 규제 대응을 위해 K SELECT 포털에서 관리하는 주요 인허가 영역은 무엇인가요? ⭐ [FEATURED]
- **Question (EN):** What core regulatory and compliance areas are managed in the K SELECT portal for US export (MoCRA)?
- **Answer (KO):** 포털 시스템에서 4대 인허가 영역을 관리합니다: ①브랜드 상표권(대한민국 KIPO 및 미국 USPTO 등록 정보·증빙 파일), ②전성분표(국문/영문 텍스트 선언 및 AI 영문 INCI 번역), ③인증 보증서(FDA 등록, 상표권, 성분 인증, 특허, 기타 5대 카테고리 서류 및 버전 관리), ④상품 식별 바코드(12자리 UPC 및 13자리 EAN 규격 검증). (MAN-B-REG-001 Chapter 01)
- **Answer (EN):** The portal manages 4 core compliance pillars: ①Brand Trademarks (KIPO and USPTO registration data/files), ②Ingredients (Dual-language text and AI INCI translation), ③Certificates (5 categories: FDA, Trademark, Ingredient, Patent, Other with version control), and ④Product Barcodes (12-digit UPC and 13-digit EAN validation). (MAN-B-REG-001 Chapter 01)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-02] 상표권(특허청 등록증)이 아직 없는 신규 브랜드도 포털에 등록할 수 있나요? ⭐ [FEATURED]
- **Question (EN):** Can a brand without official trademark registrations be registered in the portal?
- **Answer (KO):** 네, 가능합니다. 포털 내 브랜드 등록 시 특허청 상표권 등록이 필수 전제 조건은 아닙니다(Policy 02). 브랜드 신규 등록 화면(/portal/brands/new)에서 KIPO/USPTO 체크박스를 해제한 상태로 브랜드를 등록할 수 있으며, 향후 상표권을 취득하면 브랜드 수정 화면(/portal/brands/[id])에서 등록번호와 증빙 서류를 추가할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Policy 02)
- **Answer (EN):** Yes. Trademark registration is not a mandatory prerequisite for creating a brand in the portal (Policy 02). You can register a brand in the New Brand screen (/portal/brands/new) with the KIPO/USPTO checkboxes unchecked. Once trademarks are issued, you can add registration numbers and certificates in the Brand Edit screen (/portal/brands/[id]). (MAN-B-REG-001 Chapter 02 · Policy 02)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-03] 브랜드 상표권(KIPO / USPTO) 등록 및 증빙 서류는 어떻게 첨부하고 수정하나요? ⭐ [FEATURED]
- **Question (EN):** How do I enter KIPO and USPTO trademark data and manage certificate files?
- **Answer (KO):** 브랜드 등록(/portal/brands/new) 또는 수정(/portal/brands/[id]) 화면에서 대한민국 특허청(KIPO) 및 미국 특허청(USPTO) 상표권 보유 여부를 각각 체크합니다. 상표권을 보유한 경우 체크 후 상표 등록번호를 입력하고 증빙 파일(PDF/이미지)을 첨부합니다. 이미 등록된 브랜드의 경우 [보기] 링크를 통해 기존 서류를 확인하거나 삭제 및 새 파일로 교체할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)
- **Answer (EN):** In the Brand Registration (/portal/brands/new) or Brand Edit (/portal/brands/[id]) screen, check the KIPO or USPTO boxes independently. Enter the official registration number and attach the certificate file (PDF/image). For existing brands, click [View] to inspect the uploaded document, delete it, or replace it with a new file. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-04] 상품의 국문 전성분 입력과 AI 기반 영문 INCI 번역 기능은 어떻게 사용하나요? ⭐ [FEATURED]
- **Question (EN):** How do I enter Korean ingredients and use the AI-based English INCI translation tool?
- **Answer (KO):** 상품 상세 페이지(/portal/products/[id])의 [기본 정보] 탭(Tab 1) 내 전성분 영역에서 국문 전성분 텍스트를 입력한 후 [번역하기(Translate)] 버튼을 누릅니다. 시스템이 화장품 국제 표준 INCI(International Nomenclature of Cosmetic Ingredients) 명칭으로 자동 변환하며, 프리뷰 확인 후 [리뷰 완료 및 적용(Apply to field)] 버튼을 클릭하면 영문 전성분 필드에 자동 입력됩니다. (MAN-B-REG-001 Chapter 03 · Section 3.2)
- **Answer (EN):** In Product Detail (/portal/products/[id]) Tab 1 (Basic Info), enter Korean ingredients in the ingredients field and click [Translate]. The system converts them into standard INCI nomenclature. Review the preview and click [Apply to field] to automatically populate the English ingredients field. (MAN-B-REG-001 Chapter 03 · Section 3.2)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-05] AI 전성분 번역 도구(Tab 1)와 성분 인증 서류 업로드(Tab 6)는 어떻게 구분되나요? 
- **Question (EN):** What is the boundary between the AI Ingredients Translator (Tab 1) and Ingredient Certificate Upload (Tab 6)?
- **Answer (KO):** 두 기능은 시스템상 엄격히 분리된 워크플로우입니다. Tab 1의 'AI 전성분 번역'은 상품 기본 정보에 라벨 표기용 국문/영문 INCI 텍스트를 선언하는 기능이며, Tab 6의 서류 업로드를 대체하지 않습니다. 전성분 분석표, MSDS(물질안전보건자료), COA(시험성적서) 등 성분 관련 증빙 파일은 [인허가 & 보증서] 탭(Tab 6)의 [성분 인증(`ingredient_certification`)] 또는 [기타(`other`)] 카테고리를 통해 별도로 업로드해야 합니다. (MAN-B-REG-001 Chapter 03 & 04)
- **Answer (EN):** These are strictly separated workflows in the portal. AI Translation (Tab 1) declares dual-language INCI text for basic product specifications and does not replace document uploads. Supporting files such as ingredient analyses, MSDS, or COA must be uploaded separately via the [Ingredient Certification (`ingredient_certification`)] or [Other (`other`)] category in Tab 6 (Certificates). (MAN-B-REG-001 Chapter 03 & 04)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-06] 상품 상세 [인허가 & 보증서] 탭(Tab 6)에서 등록할 수 있는 5대 서류 카테고리는 무엇인가요? 
- **Question (EN):** What are the 5 certificate categories supported in Product Detail Tab 6 (Certificates)?
- **Answer (KO):** Tab 6에서 다음 5가지 서류 카테고리를 지원합니다: ①`fda_registration` (FDA 등록: 시설 등록 FFRM, 제품 리스팅 PDRM 증빙), ②`trademark` (상표권: 특정 상품 전용 상표 등록 서류), ③`ingredient_certification` (성분 인증: 전성분 분석표, MSDS, COA 등), ④`patent` (특허: 용기 구조, 성분 추출 기술 특허증), ⑤`other` (기타: 위생 허가증, 자유판매증명서 CFS 등). (MAN-B-REG-001 Chapter 04 · Section 4.1)
- **Answer (EN):** Tab 6 supports 5 categories: ①`fda_registration` (FDA registration: FFRM and PDRM proofs), ②`trademark` (product trademarks), ③`ingredient_certification` (ingredient analyses, MSDS, COA), ④`patent` (patents, utility models), and ⑤`other` (sanitary certificates, CFS, and other guarantees). (MAN-B-REG-001 Chapter 04 · Section 4.1)
- **Display Order:** `6` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-07] 기존에 등록된 인허가 서류를 갱신하거나 새 파일로 다시 업로드하면 어떻게 처리되나요? 
- **Question (EN):** How are renewed certificate files processed when uploaded for an existing document type?
- **Answer (KO):** 동일한 서류 카테고리에 새 파일을 등록하면, 시스템이 자동으로 버전(Version) 번호를 `+1` 증가(예: Version 1 -> Version 2)시키며 최신 서류(`is_current: true`)로 지정합니다. 이전 업로드 파일은 `is_current: false` 상태로 자동 변경되어 서류 이력으로 보존됩니다. (MAN-B-REG-001 Chapter 04 · Section 4.2)
- **Answer (EN):** When a new file is uploaded under the same certificate category, the system automatically increments the version number by `+1` (e.g., Version 1 -> Version 2) and designates it as active (`is_current: true`). The previously uploaded file is automatically changed to `is_current: false` and retained as history. (MAN-B-REG-001 Chapter 04 · Section 4.2)
- **Display Order:** `7` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-08] 상품 등록 완료(COMPLETE)를 위한 바코드(UPC / EAN) 규격과 검증 규칙은 무엇인가요? 
- **Question (EN):** What are the barcode standards (UPC / EAN) and validation rules to achieve COMPLETE product status?
- **Answer (KO):** 상품이 최종 `COMPLETE (등록 완료)` 상태로 전환되기 위해서는 식별 바코드가 필수적으로 검증되어야 합니다. 북미 표준인 12자리 UPC(`/^\d{12}$/`) 또는 국제 표준인 13자리 EAN(`/^\d{13}$/`) 숫자 규격만 유효합니다. 자릿수 오류나 숫자가 아닌 문자가 포함된 경우 등록 평가기(Registration Evaluator)에 의해 `Draft (보완 대기)` 상태로 유지됩니다. (MAN-B-REG-001 Chapter 05 · Section 5.1)
- **Answer (EN):** Product status can only advance to `COMPLETE` with a validated barcode. Exactly 12-digit numeric UPC (`/^d{12}$/`) or 13-digit numeric EAN (`/^d{13}$/`) is required. Invalid lengths or non-numeric characters will hold the product in `Draft` status. (MAN-B-REG-001 Chapter 05 · Section 5.1)
- **Display Order:** `8` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-09] 바코드(UPC/EAN) 유효성 검증과 규제/인허가 승인은 동일한 절차인가요? 
- **Question (EN):** Is barcode (UPC/EAN) validation the same procedure as regulatory and compliance approval?
- **Answer (KO):** 아닙니다. 바코드 입력은 물류 식별(WMS) 및 리테일 POS 스캔을 위한 상품 식별 번호 검증 절차이며, FDA 등록이나 법적 인허가 승인을 대신하지 않습니다. 바코드 검증과 규제 서류 승인은 독립된 영역이므로 규제 요건 충족을 위해서는 Tab 6([인허가 & 보증서])에 필요한 인증 서류를 별도로 등록해야 합니다. (MAN-B-REG-001 Chapter 01 & Chapter 05)
- **Answer (EN):** No. Barcode entry validates product identification for warehouse WMS and retail POS scanning, and does not substitute for FDA registrations or legal compliance approvals. Barcode validation and regulatory document approval are distinct; compliance requirements must be met by uploading required certificates in Tab 6. (MAN-B-REG-001 Chapter 01 & Chapter 05)
- **Display Order:** `9` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-10] 바코드(UPC/EAN)가 아직 발급되지 않은 신규 상품은 어떻게 지원받을 수 있나요? 
- **Question (EN):** How can I request support if a barcode (UPC/EAN) has not yet been issued for a new product?
- **Answer (KO):** 상품 등록/수정 화면의 바코드 입력란 우측에 위치한 [💬 바코드 문의] 링크를 클릭하여 지원을 요청할 수 있습니다. 바코드 신규 발급 또는 식별 관리와 관련하여 헬프센터 1:1 지원 채널을 통해 안내를 받으실 수 있습니다. (MAN-B-REG-001 Chapter 05 · Section 5.1 & 그림 5.1)
- **Answer (EN):** Click the [💬 Inquire Barcode] link located to the right of the barcode input field. You can request assistance with barcode issuance and product identification through the Help Center 1:1 support channel. (MAN-B-REG-001 Chapter 05 · Section 5.1 & Figure 5.1)
- **Display Order:** `10` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-11] 브랜드가 등록한 상표권 및 상품 인허가 서류는 어드민(Admin)에서 어떻게 확인되나요? 
- **Question (EN):** How are brand trademarks and product certificate documents viewed and audited by Admin operators?
- **Answer (KO):** 브랜드사가 등록한 상표권 및 인허가 보증서 파일은 어드민 상세 화면(/admin/brands/[brandId] 및 /admin/products/[id])에서 운영 담당자에게 실시간 동기화됩니다. 어드민 사용자는 [보기] 또는 [다운로드] 버튼을 통해 브랜드사가 제출한 서류 원본을 열람하여 검증할 수 있습니다. (MAN-B-REG-001 Chapter 06 · Section 6.1)
- **Answer (EN):** Trademarks and certificates registered by brands synchronize in real time to Admin detail screens (/admin/brands/[brandId] and /admin/products/[id]). Admin operators can inspect and verify submitted original documents using the [View] or [Download] buttons. (MAN-B-REG-001 Chapter 06 · Section 6.1)
- **Display Order:** `11` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-reg-12] 인허가 서류, 전성분 또는 상표권 정보의 수정 이력은 어디서 감사(Audit)할 수 있나요? 
- **Question (EN):** Where can I audit the modification history for certificates, ingredients, or trademarks?
- **Answer (KO):** 브랜드사 또는 어드민이 전성분, 상표권, 인허가 보증서 파일을 수정·추가·삭제하면 시스템 변경 감사 모듈(`product_change_history`)에 변경 내역이 기록됩니다. 이를 통해 변경 일시와 내역을 투명하게 추적할 수 있으며, 어드민과 브랜드 포털 간 실시간 데이터 갱신이 수행됩니다. (MAN-B-REG-001 Chapter 06 · Section 6.2)
- **Answer (EN):** When ingredients, trademarks, or certificates are modified, added, or deleted by brands or admins, change records are captured in the system change audit module (`product_change_history`). This allows transparent tracking of modification timestamps and details with real-time synchronization between Admin and Brand Portal. (MAN-B-REG-001 Chapter 06 · Section 6.2)
- **Display Order:** `12` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)


### 2.6 [K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)] (11 FAQs)

- **Knowledge ID:** `kno-retail-applications-v10`
- **Source Version:** `v1.0`
- **Topic ID:** `topic-retail`
- **Portal Scope:** `BRAND`

#### [faq-ret-01] K SELECT Retail Placement(리테일 입점 신청)이란 무엇이며 어떤 절차로 진행되나요? ⭐ [FEATURED]
- **Question (EN):** What is K SELECT Retail Placement, how do brands apply, and what is the application process?
- **Answer (KO):** K SELECT의 입점 신청(Retail Placement Application)은 브랜드 파트너사가 등록된 상품을 선택하여 북미 온·오프라인 리테일 네트워크 유통을 위한 공식 심사를 신청하는 시스템입니다. 전체 프로세스는 `1. 상품 선택(다중 브랜드 지원)` → `2. 6대 프로그램 참여 준비사항 자가진단(Readiness Criteria)` → `3. 신청서 제출 및 MD 실시간 심사` → `4. 승인 및 입점 파트너십 확정` 순서로 진행됩니다. (MAN-B-RET-001 Chapter 01 · Section 1.1)
- **Answer (EN):** K SELECT Retail Placement Application is a system where brand partners apply with registered products to request official review for distribution across North American retail networks. The process flows through: 1. Product selection (multi-brand supported) -> 2. 6 Readiness Criteria self-assessment -> 3. Submission & real-time MD review -> 4. Approval & placement partnership finalization. (MAN-B-RET-001 Chapter 01 · Section 1.1)
- **Display Order:** `1` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-02] 입점 신청서를 작성하기 전에 반드시 완료해야 하는 사전 필수 준비사항은 무엇인가요? 
- **Question (EN):** What are the mandatory prerequisites required before creating a retail placement application?
- **Answer (KO):** 입점 신청서 작성 전 브랜드 포털에서 다음 3가지 항목이 완료되어 있어야 합니다: 1. **브랜드 등록 완료 (`MAN-B-BRAND-001`)**: 계정에 입점 대상 브랜드가 등록 및 승인되어야 합니다. 2. **상품 카탈로그 등록 완료 (`MAN-B-PROD-001`)**: 신청 대상 상품의 기본 정보, 규격, 카테고리가 등록되어 있어야 합니다. 3. **미국 규제 및 MoCRA 대응 확인 (`MAN-B-REG-001`)**: FDA 요건, 전성분(INCI), 식별 바코드(UPC/EAN) 준비 상태를 사전에 확인해야 합니다. (MAN-B-RET-001 Chapter 01 · Section 1.2)
- **Answer (EN):** Before creating an application, three prerequisites must be completed on the Brand Portal: 1. Brand Registration (`MAN-B-BRAND-001`), 2. Product Catalog Registration (`MAN-B-PROD-001`) with specifications and categories, 3. US Regulatory & MoCRA Compliance Check (`MAN-B-REG-001`) verifying FDA requirements, INCI ingredients, and UPC/EAN barcodes. (MAN-B-RET-001 Chapter 01 · Section 1.2)
- **Display Order:** `2` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-03] 여러 브랜드를 운영하는 경우 브랜드별로 입점 신청서를 따로 작성해야 하나요? ⭐ [FEATURED]
- **Question (EN):** If managing multiple brands, do I need to create separate applications for each brand?
- **Answer (KO):** 아닙니다. 동일 회사 계정에 등록된 여러 브랜드의 상품이 제품 선택 영역에 브랜드별로 자동 그룹화되어 표시됩니다. 단일 신청서 안에서 서로 다른 브랜드의 제품을 복수 선택하여 한 번에 입점 심사를 신청할 수 있습니다. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)
- **Answer (EN):** No. Products from multiple brands registered under the same company account are automatically grouped by brand. You can select products across multiple brands within a single application and submit them together. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)
- **Display Order:** `3` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-04] 6대 프로그램 참여 준비 사항(Readiness)에서 '협의 필요'를 선택하면 심사에서 불이익이나 탈락 사유가 되나요? ⭐ [FEATURED]
- **Question (EN):** Does selecting '협의 필요 (Negotiation Needed)' in the 6 Readiness Criteria result in penalties or disqualification?
- **Answer (KO):** 절대 감점이나 탈락 사유가 되지 않습니다. K SELECT의 확정 정책에 따라 **협의 필요는 탈락 사유가 아니며 MD 팀과의 사전 조율 단계**입니다. 초도 물량, 마케팅 협력, 유통 가격 및 공급 조건 등에 대해 K SELECT MD 심사팀과 상호 협의하여 맞춤형 조건을 도출하기 위한 정상적인 소통 절차입니다. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)
- **Answer (EN):** Absolutely not. Under K SELECT's established policy, **'협의 필요 (Negotiation Needed)' is not a rejection reason, but an active coordination step with the MD team**. It is a normal collaboration procedure to align on initial quantities, marketing cooperation, distribution pricing, and supply conditions. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)
- **Display Order:** `4` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-05] 신규 입점 신청서 작성 중 임시저장(Draft)과 최종 제출의 차이는 무엇인가요? 
- **Question (EN):** What is the difference between Draft saving and Final Submission in Retail Applications?
- **Answer (KO):** 작성 화면 하단의 **[임시저장]**을 클릭하면 선택한 제품과 6대 준비사항 응답이 저장되며 상태가 `임시저장(draft)`으로 유지되어 언제든지 재방문하여 내용을 수정할 수 있습니다. 최소 1개 이상의 제품을 선택한 후 **[신청서 제출]**을 클릭하면 공식 신청번호(예: `APP-20261001-0001`)가 발급되고 상태가 `제출됨(submitted)`으로 변경됩니다. 최종 제출 후에는 브랜드사에서 내용을 직접 수정할 수 없으며 MD 심사 단계로 전환됩니다. (MAN-B-RET-001 Chapter 03 · Section 3.3)
- **Answer (EN):** Clicking **[임시저장 (Save Draft)]** stores selected products and readiness answers under `draft` status, allowing ongoing edits. After selecting at least one product, clicking **[신청서 제출 (Submit Application)]** generates an official application ID (e.g. `APP-20261001-0001`) and transitions status to `submitted`. Once submitted, direct edits by the brand are locked as it enters MD review. (MAN-B-RET-001 Chapter 03 · Section 3.3)
- **Display Order:** `5` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-06] 신청서 제출 후 진행 상태(Status)는 어떻게 구분되며 어떤 의미인가요? 
- **Question (EN):** How are application statuses defined and what do they mean after submission?
- **Answer (KO):** 신청서는 9가지 상태로 관리됩니다: 1. `draft(임시저장)`: 작성 중, 2. `submitted(제출됨)`: 접수 완료 및 심사 대기, 3. `under_review(심사중)`: MD 심사 진행 중, 4. `info_requested(추가자료요청)`: MD의 추가 자료 요청 상태, 5. `re_review(재검토중)`: 브랜드 추가 자료 회신 후 재심사 대기, 6. `partial_approved(부분승인)`: 일부 제품 승인 완료, 7. `approved(승인됨)`: 전체 제품 승인 완료, 8. `on_hold(보류)`: 심사 일시 보류, 9. `rejected(반려됨)`: 심사 반려. (MAN-B-RET-001 Chapter 02 · Section 2.2)
- **Answer (EN):** Applications are tracked across 9 statuses: 1. `draft`: in progress, 2. `submitted`: received & waiting review, 3. `under_review`: active MD review, 4. `info_requested`: MD requesting additional info, 5. `re_review`: brand replied & awaiting re-review, 6. `partial_approved`: some products approved, 7. `approved`: all products approved, 8. `on_hold`: review temporarily paused, 9. `rejected`: review rejected. (MAN-B-RET-001 Chapter 02 · Section 2.2)
- **Display Order:** `6` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-07] 신청서에 포함된 여러 제품의 개별 심사 상태와 전체 종합 상태는 어떻게 집계되나요? 
- **Question (EN):** How are individual product review statuses and the aggregated application status calculated?
- **Answer (KO):** 신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 각 제품마다 독립적으로 `검토대기`, `심사 진행 중`, `보완 요청`, `심사 보류`, `심사 반려`, `심사 승인` 상태와 MD 피드백 사유(`↳ 사유: ...`)가 기록됩니다. 시스템의 자동 상태 집계 엔진(`computeAggregatedStatus`)은 모든 제품이 승인되면 `approved`, 모든 제품이 반려되면 `rejected`, 일부 제품만 승인되면 `partial_approved`, 심사 중인 제품이 남아있으면 `under_review`로 전체 상태를 실시간 산출합니다. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)
- **Answer (EN):** Each product independently tracks status (`pending`, `under_review`, `info_requested`, `on_hold`, `rejected`, `approved`) with MD feedback reasons. The automated aggregation engine (`computeAggregatedStatus`) computes overall application status in real-time: `approved` if all products approved, `rejected` if all rejected, `partial_approved` if some approved, and `under_review` if any product is actively under review. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)
- **Display Order:** `7` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-08] MD 심사역으로부터 추가 자료 요청(Info Request)을 받았을 때 어떻게 확인하고 회신하나요? ⭐ [FEATURED]
- **Question (EN):** How do I check and reply when receiving an Info Request from the MD review team?
- **Answer (KO):** MD가 성분 분석표(COA), 영문 라벨, 상표권 증빙 등 추가 자료를 요청하면 신청서 상세 페이지 상단에 **노란색 긴급 알림 패널**이 활성화되고 회신 기한이 표시됩니다. 패널 내 회신 내용 입력란에 답변을 작성하고 필요 시 **[파일 선택]** 버튼을 통해 증빙 파일(PDF, PNG, JPG, WEBP, CSV, XLSX)을 첨부한 후 **[회신 제출]**을 클릭합니다. 제출 즉시 신청서 상태가 `재검토중(re_review)`으로 자동 전환되어 MD에게 전달됩니다. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)
- **Answer (EN):** When MDs request additional documents (e.g., COA, English labeling, trademark proof), a yellow alert panel appears at the top of the application detail page with a reply deadline. Type your response in the text area, attach files (PDF, PNG, JPG, WEBP, CSV, XLSX) via **[파일 선택 (Choose File)]**, and click **[회신 제출 (Submit Reply)]**. The status immediately updates to `re_review`. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)
- **Display Order:** `8` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `true`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-09] 신청서 내 일부 제품만 승인되고 일부 제품이 반려/보류된 경우(부분승인) 어떻게 처리되나요? 
- **Question (EN):** What happens if only some products are approved while others are rejected or put on hold (Partial Approval)?
- **Answer (KO):** 신청서 상태가 `부분승인(partial_approved)`으로 전환됩니다. 승인된 품목에 대해서만 우선적으로 K SELECT 북미 리테일 유통망 입점 및 후속 비즈니스 협의가 진행됩니다. 반려되거나 보류된 품목은 승인된 품목의 입점 진행에 부정적인 영향을 미치지 않으며, 각 품목별 타임라인에서 반려/보류 사유를 개별 확인할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)
- **Answer (EN):** The overall application status becomes `partial_approved`. Retail placement and subsequent business onboarding proceed for approved products immediately. Rejected or on-hold items do not hinder the progress of approved items, and reasons for each item can be reviewed in their respective timelines. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)
- **Display Order:** `9` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-10] 입점 신청이 최종 승인(Approved)되면 발주서(PO)나 출고가 자동으로 생성되나요? 
- **Question (EN):** Does Retail Application approval automatically generate a Purchase Order (PO) or shipment?
- **Answer (KO):** 아닙니다. 입점 신청 승인(Retail Placement Approval)은 해당 상품의 북미 리테일 유통 자격 심사가 완료되었음을 의미하며, 실제 발주서(Purchase Order), 오더 요청(Order Request), 출고(Shipment), 정산(Settlement)이 자동으로 생성되지 않습니다. 실물 발주 및 납품은 `MAN-B-ORD-001` 매뉴얼의 독립적인 오더 관리 절차(브랜드사 발주 요청 또는 본사 공식 PO 발행 및 확인)를 통해 별도로 진행됩니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)
- **Answer (EN):** No. Retail Placement Approval confirms retailer eligibility and does NOT automatically generate Purchase Orders, Order Requests, Shipments, or Settlements. Actual ordering and physical supply fulfillment proceed separately through the independent order management workflows defined in `MAN-B-ORD-001`. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)
- **Display Order:** `10` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

#### [faq-ret-11] 제품 심사가 반려(Rejected) 또는 보류(On Hold)된 경우 사유를 확인하고 어떻게 대처해야 하나요? 
- **Question (EN):** If a product review is Rejected or On Hold, where can I check the reason and how should I respond?
- **Answer (KO):** 신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 해당 제품 하단 타임라인의 `↳ 사유: ...` 항목을 통해 MD 심사역이 기재한 공식 피드백을 확인할 수 있습니다. 보류(`on_hold`)된 경우 MD 담당자와 1:1 지원 채널을 통해 추가 협의를 진행할 수 있으며, 반려(`rejected`)된 경우 규제 서류, 성분, 영문 라벨, 바코드 등 미비 사항을 보완하여 향후 신규 신청을 준비할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)
- **Answer (EN):** Official feedback from the MD review team can be checked under each product's timeline row via `↳ 사유: ...`. For items on hold (`on_hold`), you can consult with MDs through support channels. For rejected (`rejected`) items, review the specific reasons (regulatory documents, ingredients, labeling, barcodes) to prepare for future new submissions. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)
- **Display Order:** `11` | **Kind:** `BOTH` | **Status:** `APPROVED` | **Featured:** `false`
- **Grounding Audit:** `VERIFIED` (출처 매뉴얼 인용 및 프로덕션 동작 일치)
- **Cross-Domain Relationship:** 독립 도메인 무결성 유지 (타 모듈 침범 없음)

