# MAN-B-REG-001 — Field Inventory
## Production Regulatory, Certification & Compliance Field Specifications

**Manual ID:** `MAN-B-REG-001`  
**Document Type:** Production Field Inventory & System Schema  
**Scope:** Brand Portal & Admin Regulatory/Compliance Module  

---

## 1. Brand Trademark & Profile Fields (`public.brands` / `intro` metadata)

| Field Name | UI Label (KR) | Data Type | Required / Optional | Validation Rules | DB Column / Storage Path | User Editable | Related Workflow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `name` | 브랜드명 | String | Required | Minimum 1 char. Duplicate check per company. | `brands.name` | Portal Write / Admin Edit | Brand Registration |
| `intro` | 브랜드 소개 | String | Optional | Max 2000 chars. Sanitized clean intro text. | `brands.intro` | Portal Write / Admin Edit | Brand Profile |
| `hasKrTrademark` | 대한민국 상표권 보유 | Boolean | Optional | Default `false`. | `intro` -> `trademarks.has_kr_trademark` | Portal Write / Admin Edit | Trademark Information |
| `krTrademarkNumber` | 대한민국 상표 등록번호 | String | Optional (Required if `hasKr=true`) | Alphanumeric registration number. | `intro` -> `trademarks.kr_trademark_number` | Portal Write / Admin Edit | Trademark Information |
| `krTrademarkFile` | 대한민국 상표권 증빙 | File | Optional | `image/*`, `application/pdf`. Storage path generated. | `company-uploads/{companyId}/brands/{brandId}/trademarks/kr_trademark_{uuid}.pdf` | Portal Upload / Admin Download | Trademark File Upload |
| `hasUsTrademark` | 미국 USPTO 상표권 보유 | Boolean | Optional | Default `false`. | `intro` -> `trademarks.has_us_trademark` | Portal Write / Admin Edit | Trademark Information |
| `usTrademarkNumber` | 미국 USPTO 등록번호 | String | Optional (Required if `hasUs=true`) | Alphanumeric USPTO serial/reg number. | `intro` -> `trademarks.us_trademark_number` | Portal Write / Admin Edit | Trademark Information |
| `usTrademarkFile` | 미국 USPTO 증빙 | File | Optional | `image/*`, `application/pdf`. Storage path generated. | `company-uploads/{companyId}/brands/{brandId}/trademarks/us_trademark_{uuid}.pdf` | Portal Upload / Admin Download | Trademark File Upload |

---

## 2. Product Ingredient & Dual-Language Fields (`public.products`)

| Field Name | UI Label (KR) | Data Type | Required / Optional | Validation Rules | DB Column / Storage Path | User Editable | Related Workflow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ingredientsText` | 국문/영문 전성분 텍스트 | String (Text) | Optional | Multiline text. AI Translate tool supports KR -> EN conversion. | `products.ingredients_text` | Portal Edit / Admin Edit | Ingredient Declaration & AI Translation |
| `ingredientsFileKo` | 국문 전성분표 파일 | File | Optional | `image/*`, `application/pdf`. Auto-syncs to `product_certificates` as `ingredient_certification`. | `company-uploads/{companyId}/products/{productId}/ingredients/ko_{uuid}.pdf` | Portal Upload / Admin Download | Ingredient Certificate Upload |
| `ingredientsFileEn` | 영문 전성분표 파일 | File | Optional | `image/*`, `application/pdf`. Auto-syncs to `product_certificates` as `ingredient_certification`. | `company-uploads/{companyId}/products/{productId}/ingredients/en_{uuid}.pdf` | Portal Upload / Admin Download | Ingredient Certificate Upload |

---

## 3. Product Certificate & Compliance Document Fields (`public.product_certificates`)

| Field Name | UI Label (KR) | Data Type | Required / Optional | Validation Rules | DB Column / Storage Path | User Editable | Related Workflow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `certificate_type` | 서류 종류 | Enum / String | Required | Enum: `fda_registration`, `trademark`, `ingredient_certification`, `patent`, `other`. (MSDS/COA uploaded under `ingredient_certification` or `other`). | `product_certificates.certificate_type` | Portal Select / Admin Select | Certificate Registration |
| `storage_path` | 서류 저장 경로 | String (Path) | Required | Auto-generated bucket relative path. | `product_certificates.storage_path` | System Managed | Storage Index |
| `original_filename` | 원본 파일명 | String | Required | File name preserved upon upload. | `product_certificates.original_filename` | System Managed | Document Management |
| `version` | 서류 버전 번호 | Integer | System Managed | Auto-increments (+1) per upload of same type. | `product_certificates.version` | System Managed | Version Control |
| `is_current` | 최신 버전 여부 | Boolean | System Managed | `true` for current active file, `false` for archive versions. | `product_certificates.is_current` | System Managed | Version Control |

---

## 4. Product Barcode & Commercial Export Specification Fields (`public.products`)

| Field Name | UI Label (KR) | Data Type | Required / Optional | Validation Rules | DB Column / Storage Path | User Editable | Related Workflow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `upc` | UPC 바코드 (12자리) | String | Required for COMPLETE (if EAN missing) | Exactly 12 digits (`/^\d{12}$/`). | `products.upc` | Portal Edit / Admin Edit | Barcode Validation |
| `ean` | EAN 바코드 (13자리) | String | Required for COMPLETE (if UPC missing) | Exactly 13 digits (`/^\d{13}$/`). | `products.ean` | Portal Edit / Admin Edit | Barcode Validation |
| `origin` | 원산지 | String | Required for COMPLETE | Standard country string (e.g., `Made in Korea`, `대한민국`). | `products.origin` | Portal Edit / Admin Edit | Commercial Specification |
| `price_usd_fob` | FOB 수출 가격 ($) | Numeric | Required for COMPLETE | Must be > 0. Decimal format. | `products.price_usd_fob` | Portal Edit / Admin Edit | Export Price Specification |
