# REFERENCE GUIDE: MAN-B-TASK-001
## Quick Reference Tables, Data Dictionaries & Operational Specifications

- **Manual ID:** `MAN-B-TASK-001`
- **Topic:** `Task & Communication (할 일, 업무 조율 및 1:1 케이스 소통)`
- **Audience:** `B — Brand Portal Users`
- **Authoritative Date:** 2026-10-02

---

## 1. Case Status Normalization Reference

| Presentation Status (`OfficialCaseStatus`) | Korean Label | Badge Style (Tailwind) | Mapped Database `status` Values | Meaning & Lifecycle Stage |
| :--- | :--- | :--- | :--- | :--- |
| **`RECEIVED`** | **접수됨** | `bg-amber-50 text-amber-800 border-amber-200` | `open`, `pending` | Initial case submission awaiting review |
| **`UNDER_REVIEW`** | **검토중** | `bg-blue-50 text-blue-800 border-blue-200` | `in_review`, `replied`, `processing`, `under_review`, `action_resolved`, `awaiting_reply`, `reopened` | Ongoing dialogue or investigation by admin staff |
| **`ACTION_REQUIRED`** | **조치필요** | `bg-rose-50 text-rose-800 border-rose-200` | `action_required` | Supplement documents or clarification required from brand |
| **`CLOSED`** | **종료됨** | `bg-zinc-100 text-zinc-700 border-zinc-200` | `closed`, `resolved` | Issue resolved and case marked closed |

---

## 2. 9 Standard Inquiry Categories Reference

| Category Code | Korean Name | English Name | Integration & Key Fields | Primary Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| `po_change` | **PO 변경 요청** | PO Change Request | `related_po_id` (FK to `purchase_orders`) | Quantity, price, or shipment origin modifications |
| `agreement_change` | **계약 변경 및 서명** | Agreement Change Request | Agreement ID prefill | Contract clause review, signing officer updates |
| `product` | **제품 등록 및 정보수정** | Product Registration | Product ID context | Barcode, ingredients, package spec revisions |
| `onboarding` | **입점 신청 및 심사** | Onboarding Review | Company onboarding context | Supplemental application document submissions |
| `logistics` | **물류 공급 및 패키징** | Logistics & Packaging | Logistics specifications | Carton labeling, CBM measurement, port coordination |
| `translation` | **번역 및 전성분표** | Translation & Ingredients | Regulatory compliance | FDA label English translations, ingredient audits |
| `settlement` | **정산 / 인보이스 문의** | Settlement / Invoice | `related_invoice_id` / AP No. | Payment schedules, tax invoice discrepancies |
| `system` | **시스템 오류 및 제안** | System & Tech Support | Portal UI error context | Feature bugs, user permission escalation requests |
| `general` | **기타 일반 문의** | General Inquiry | None | General partnership or operational questions |

---

## 3. 6 Authoritative Company Contact Tasks (`MAN-B-PERM-001` Domain Boundary)

| Task Code (`task_code`) | Korean Label | System Description & Notification Routing |
| :--- | :--- | :--- |
| `company_apply` | **회사·신청** | Initial company registration, KYC documents, and onboarding review |
| `contract` | **계약** | Master business agreement, terms amendments, and legal notices |
| `product_cert` | **제품·콘텐츠·인증** | Product catalog compliance, FDA certifications, and English labeling |
| `pricing_quote` | **가격·견적** | Wholesale pricing, supply quote negotiations, and margin terms |
| `logistics_inventory` | **발주·물류·재고** | Purchase order fulfillment, ASN notices, carton labels, and warehouse deliveries |
| `settlement_inquiry` | **정산·문의** | Monthly payout statements, accounts payable (AP), and tax invoice inquiries |

---

## 4. Cross-Domain Deep Link Query Parameters

| Source Page | Action / Button | Constructed URL Parameters | Behavior in `/portal/support` |
| :--- | :--- | :--- | :--- |
| `/portal/orders/[id]` | `[발주 문의 / 변경 요청]` | `?new=1&category=po_change&po_id={id}&po_no={po_no}` | Auto-locks category to `po_change`, binds FK `related_po_id`, prefills title with `[{po_no}]` |
| `/portal/settlement` | `[정산 문의하기]` | `?new=1&category=settlement&invoice_id={id}&ap_no={ap_no}` | Auto-selects `settlement`, prefills title with `[{ap_no}]` |
| `/portal/agreements` | `[계약 조항 문의]` | `?new=1&category=agreement_change&agreement_id={id}` | Auto-selects `agreement_change`, injects contract reference |

---

## 5. Storage, Attachment & File Security Specifications

| Specification Item | Rule / Constraint | Details & Implementation |
| :--- | :--- | :--- |
| **Storage Bucket** | `"company-uploads"` | Dedicated private bucket on Supabase Storage |
| **Object Path** | `${companyId}/inquiries/${uuid}.${ext}` | Strict tenant folder isolation by company ID |
| **Max File Size** | **20MB** (`20 * 1024 * 1024` bytes) | Enforced by client and `validateUploadedFile` helper |
| **Allowed File Types** | Images & PDF Documents | `image/png`, `image/jpeg`, `image/webp`, `application/pdf` |
| **Download Security** | Signed URL (`getSignedFileUrl`) | Dynamic HTTPS time-limited signed download link |

---

## 6. Access Control (ACL) Matrix for Support Domain

| ACL Level | Level Value | Route Access | View Cases | Create Case | Reply to Thread | Resolve Action | Close Case |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`support:none`** | `0` | ❌ Blocked | ❌ | ❌ | ❌ | ❌ | ❌ |
| **`support:read`** | `1` | ✅ Allowed | ✅ | ❌ | ❌ | ❌ | ❌ |
| **`support:write`** | `2` | ✅ Allowed | ✅ | ✅ | ✅ | ✅ | ❌ |
| **`support:manage`** | `3` | ✅ Allowed | ✅ | ✅ | ✅ | ✅ | ✅ |

---
*End of REFERENCE_GUIDE.md*
