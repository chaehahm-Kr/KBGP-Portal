# REFERENCE GUIDE: MAN-B-FAQ-001
## Quick Reference Tables, FAQ Matrix & Search Specifications

- **Manual ID:** `MAN-B-FAQ-001`
- **Topic:** `Knowledge Center FAQ (도움말 센터, 자주 묻는 질문 및 지식 검색)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## 1. 63 Production FAQs Group Summary

| Group | Domain Code | Canonical Manual ID | Topic ID | Total FAQs | Featured FAQs | Grounding Status |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: |
| **01** | `BRAND` | `kno-brand-policy-v10` | `topic-brand` | 5 | 3 | `VERIFIED` |
| **02** | `ONB` | `kno-onboarding-guide-v10` | `topic-start` | 9 | 5 | `VERIFIED` |
| **03** | `PROD` | `kno-product-management-v10`| `topic-product` | 14 | 5 | `VERIFIED` |
| **04** | `ORD` | `kno-order-management-v10` | `topic-orders` | 12 | 5 | `VERIFIED` |
| **05** | `REG` | `kno-regulatory-compliance-v11`| `topic-regulatory` | 12 | 4 | `VERIFIED` |
| **06** | `RET` | `kno-retail-applications-v10`| `topic-retail` | 11 | 4 | `VERIFIED` |
| **Total**| **6 Domains**| **6 Published Manuals** | **6 Active Topics** | **63** | **26** | **63 / 63 PASS** |

---

## 2. 6 Active Standard Topics Reference

| Topic ID | Korean Title | English Title | Domain Key | Matching Keywords |
| :--- | :--- | :--- | :--- | :--- |
| `topic-brand` | **브랜드 관리** | Brand Management | `BRAND` | 브랜드, 상표권, 등록, 비활성화, 슬로건 |
| `topic-start` | **시작하기** | Getting Started | `ONBOARDING` | 가입, 시작, 온보딩, 사업자, 계약서 |
| `topic-product`| **상품 등록 & 관리** | Product Catalog | `PRODUCTS` | 상품, 카탈로그, 옵션, CBM, 공급가, 바코드 |
| `topic-regulatory`| **인허가 & 규정**| Regulatory & Compliance| `REGULATORY` | MoCRA, FDA, 전성분, INCI, COA, 성적서 |
| `topic-retail` | **입점 & 리테일 네트워크**| Retail Placement | `RETAIL` | 리테일, 입점신청, 바이어, Readiness |
| `topic-orders` | **발주 요청 & 오더** | Order Management | `ORDERS` | 발주요청, 정식PO, 검수, 납기, 취소 |

---

## 3. Pending FAQ Domains Reference

| Domain Code | Target Manual ID | Topic ID | Current Published FAQs | Status Classification |
| :--- | :--- | :--- | :---: | :--- |
| `LOG` | `MAN-B-LOG-001` | `topic-logistics` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |
| `FIN` | `MAN-B-FIN-001` | `topic-finance` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |
| `PERM` | `MAN-B-PERM-001` | `topic-company` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |
| `TASK` | `MAN-B-TASK-001` | `topic-company` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |
| `RPT` | `MAN-B-RPT-001` | `topic-marketing` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |
| `INT` | `MAN-B-INT-001` | `topic-marketing` | 0 | `PENDING CANONICAL MANUAL COMPLETION / FAQ PUBLICATION` |

---

## 4. Search Engine Scoring Weights Reference

| Matching Layer | Target Field / Condition | Score Weight |
| :--- | :--- | :---: |
| **Intent Pattern** | Predefined natural language intent keywords | `+120 ~ +150` |
| **Canonical / Alias Match** | `titleText` contains canonical term | `+80` |
| | `item.type` exactly matches canonical term | `+70` |
| | `itemTags` contain canonical term | `+60` |
| | `item.category` matches canonical term | `+50` |
| | `summaryText` contains canonical term | `+40` |
| **Expanded Token Match** | `titleText` contains expanded token | `+40` |
| | `itemTags` contain expanded token | `+35` |
| | `summaryText` contains expanded token | `+20` |
| | `contentText` contains expanded token | `+10` |
| **Fuzzy Matching** | `calculateLevenshtein(word, target) <= 2` | `+50` |
| **Route Context** | Guide mode current route matches category | `+25` |
| **Content Type Priority** | `MANUAL` (+20), `SOP` (+15), `POLICY` (+15), `FAQ` (+10) | `+10 ~ +20` |

---

## 5. Featured FAQ Model Definition

- **Technical Implementation**: `knowledge_faqs.is_featured` (Boolean column).
- **Enforcement Type**: **Editorial Policy & Current Data Pattern** (No DB check constraints or application clamp logic).
- **Current Distribution**: Total 26 Featured FAQs across 6 published manuals (3~5 per manual).

---

## 6. Authoritative Cross-Domain Boundary Formulas

1. `Retail Application Approval ≠ Automatic Purchase Order Creation`
2. `ARRIVED ≠ RECEIVED ≠ COMPLETED ≠ PAID`
3. `Shipping Complete ≠ Settlement Complete`
4. `협의 필요 ≠ Rejection`
5. `PERM Operational Task Assignment ≠ TASK Support Case`
6. `AI INCI Translation ≠ Regulatory Certificate Upload`
7. `Barcode Validation ≠ Regulatory Approval`

---
*End of REFERENCE_GUIDE.md*
