# MAN-B-REG-001 — Screenshot Requirements
## Production UI Screenshot Capture Plan for Manual Design

**Manual ID:** `MAN-B-REG-001`  
**Document Type:** UI Screenshot Requirements & Production Annotation Plan  
**Scope:** Brand Portal & Admin Regulatory/Compliance UI Views  

---

## 1. Production UI Screenshot Capture Inventory

| Screenshot ID | Target URL | Target Screen / View | Required Data State | Highlight Area | Target Chapter | Annotation Instructions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `SCR-B-REG-001` | `/portal/brands/new` | Brand Registration Form | Brand form loaded with KIPO/USPTO checkboxes expanded | KIPO / USPTO Trademark Registration Checkboxes, Number Inputs & File Dropzone | Chapter 2 | Draw red callout box around trademark registration inputs. Add text badge: "상표권 미보유 시 체크 해제 상태로 등록 가능". |
| `SCR-B-REG-002` | `/portal/brands/[id]` | Brand Edit View | Registered brand with KIPO trademark number & uploaded PDF proof | Trademark status badges (`보유`), registration numbers, and file view links | Chapter 2 | Highlight `[보기]` signed link and trademark registration numbers. |
| `SCR-B-REG-003` | `/portal/products/[id]` | Product Detail (Basic Info / Ingredients) | Korean ingredient text entered in textarea | Korean ingredient textarea & `[번역하기 (Translate)]` AI button | Chapter 3 | Highlight AI translation widget button. Add arrow pointing to English translation preview box. |
| `SCR-B-REG-004` | `/portal/products/[id]` | Product Detail (Ingredients Translation Result) | AI translation completed, preview box rendered with INCI names | `[리뷰 완료 및 적용 (Apply to field)]` button | Chapter 3 | Highlight application button that populates the English ingredients field. |
| `SCR-B-REG-005` | `/portal/products/[id]` | Product Detail — Tab 6 (`#certs`) | Product with FDA registration PDF and MSDS certificate uploaded | Certificate List table, `CertificateType` badges (`FDA 등록`, `성분 인증`), Version numbers | Chapter 4 | Highlight file version tags (`Version 1`, `Version 2`) and signed download links. |
| `SCR-B-REG-006` | `/portal/products/[id]` | Certificate Upload Form (`#certs` tab bottom) | Certificate category dropdown open showing 5 options | Category dropdown (`fda_registration`, `trademark`, `ingredient_certification`, `patent`, `other`) | Chapter 4 | Draw red callout around 5 certificate category types. Highlight that MSDS/COA are uploaded under `ingredient_certification` or `other`. |
| `SCR-B-REG-007` | `/portal/products/[id]` | Product Detail (Logistics & Barcode Section) | Product with 12-digit UPC barcode & 13-digit EAN barcode entered | UPC / EAN inputs & `[💬 바코드 문의]` button | Chapter 5 | Highlight UPC/EAN format requirement and barcode inquiry help button. |
| `SCR-B-REG-008` | `/admin/brands/[brandId]` | Admin Brand Detail Page | Admin view of brand with trademark proof files | Trademark Ownership Card, KIPO/USPTO proof file `[보기]` / `[다운로드]` buttons | Chapter 6 | Highlight Admin audit actions and trademark legal footnote. |

---

## 2. Capture Guidelines & Quality Standards

1. **Resolution**: Minimum 1440x900 viewport (Desktop View).
2. **Theme**: Standard Light Mode (with optional Dark Mode callouts if relevant).
3. **Data Integrity**: Use realistic production-level demo data (e.g. `Natural Shoes Inc`, `K SELECT LAB`, valid UPC/EAN barcodes, sample FDA PDF files). Avoid `asdf` or dummy test strings.
4. **Storage Path**: Captured PNG images will be saved in `Manuals/MAN-B-REG-001_Regulatory-Compliance/02_CLAUDE_PACKAGE/screenshots/` during Phase 02.
