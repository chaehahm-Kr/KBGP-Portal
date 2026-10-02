# REFERENCE_GUIDE.md
## Technical Reference, Glossary & System Boundary Specifications

**Manual ID:** `MAN-B-REG-001`  
**Document Type:** Glossary & Technical Specifications Reference  
**Asset Folder:** `04_REFERENCE/`  

---

## 1. Terminology Glossary

| Term / Abbreviation | Full Name | System Definition & Usage |
| :--- | :--- | :--- |
| **KIPO** | Korean Intellectual Property Office | 대한민국 특허청. 브랜드 등록 시 국내 상표권 보유 여부 및 등록번호 식별자. |
| **USPTO** | United States Patent and Trademark Office | 미국 특허청. 브랜드 등록 시 미국 상표권 보유 여부 및 등록번호 식별자. |
| **INCI** | International Nomenclature of Cosmetic Ingredients | 국제 화장품 성분 명칭. 전성분 영문 텍스트 표기 시 사용되는 화학/식물 명칭 표준. |
| **UPC** | Universal Product Code | 미국/북미 리테일 표준 12자리 숫자 바코드. |
| **EAN** | European Article Number | 글로벌 표준 13자리 숫자 바코드. |
| `CertificateType` | Product Certificate Enum | `fda_registration`, `trademark`, `ingredient_certification`, `patent`, `other`. |
| `version` | Document Version Number | `product_certificates` 테이블의 integer 컬럼. 신규 업로드 시 자동 +1 증가. |
| `is_current` | Active File Flag | `product_certificates` 테이블의 boolean 컬럼. `true`인 경우 최신 활성 문서로 지정. |

---

## 2. Common System Validation Messages & Resolution Guide

| Validation Trigger | System UI Message | Root Cause & Resolution |
| :--- | :--- | :--- |
| **Barcode Format Error** | `[기본 정보: 식별 바코드(UPC/EAN)]` missing field warning | UPC가 12자리 숫자가 아니거나 EAN이 13자리 숫자가 아님. 숫자 자리수를 교정하거나 `[💬 바코드 문의]` 단추를 이용. |
| **File Type Validation Error** | `허용되지 않는 파일 형식입니다.` | 업로드 파일이 PDF 또는 이미지(`JPG`, `PNG`, `WEBP`)가 아님. 허용 포맷으로 변환 후 업로드. |
| **File Size Limit Exceeded** | `파일 용량이 초과되었습니다.` | 업로드 파일 크기가 10MB를 초과함. 파일 압축 후 다시 시도. |
| **Duplicate Brand Name Error** | `이미 같은 이름의 브랜드가 등록되어 있습니다.` | 동일 회사 내에 같은 이름의 활성 브랜드가 존재함. 기존 브랜드를 수정하거나 이름을 구분. |

---

## 3. Strict System Boundary Summary

- **MAN-B-PROD-001 Reference**: 일반 상품 생성, 이미지 업로드, SKU 관리, 물류 규격 입력 등 카탈로그 작성법은 `MAN-B-PROD-001` 매뉴얼을 참조합니다.
- **Future Enhancements (Excluded)**: FDA Listing Number 텍스트 필드, Compliance Status 뱃지 시각화, US Agent Agreement 전용 타입 등 미구현 기능은 이번 매뉴얼 범위에 포함되지 않습니다.
