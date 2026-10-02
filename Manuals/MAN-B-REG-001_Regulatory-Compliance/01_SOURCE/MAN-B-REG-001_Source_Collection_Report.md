# MAN-B-REG-001 — Regulatory, Certification & Compliance Manual
## Phase 01_SOURCE — Production Source Collection Report (Refined Integrity)

**Manual ID:** `MAN-B-REG-001`  
**Manual Title:** `Regulatory, Certification & Compliance Manual (인허가, 상표권 및 증빙 서류 관리 가이드)`  
**Audience:** `B` (Brand Portal User — 브랜드사 담당자 및 관리자)  
**Authoritative Source:** Production Codebase & Live System Architecture (`shzfrppdobpmrstcjfqu`)  
**Phase:** `01_SOURCE` (Production Source Collection & Planning Only)  

---

## 1. Executive Summary & System Overview

본 보고서는 K SELECT NETWORK 브랜드 포털(Brand Portal)의 브랜드사 사용자를 위한 **MAN-B-REG-001 — Regulatory, Certification & Compliance** 매뉴얼 제작에 필요한 **Production Source of Truth**를 정밀 전수 조사한 결과 문서이다.

본 매뉴얼의 다루는 핵심 범위는 **"K SELECT 소프트웨어 시스템이 제공하는 인허가, 상표권, 전성분, 증빙 서류 및 바코드 관리 기능"**에 한정되며, FDA/MoCRA 등 미국 법률 해석이나 시스템 외적인 법적 의무 사항은 포함하지 않는다.

### 핵심 시스템 기능 요약 (Production Software System Capabilities)
1. **Brand Trademark Declaration & Proof Attachment (브랜드 상표권 정보 및 증빙 관리)**
   - 대한민국 특허청(KIPO) 및 미국 특허청(USPTO) 상표권 보유 여부(Checkbox), 상표 등록번호(Text), 상표권 증빙 파일(PDF/이미지) 첨부 관리.
2. **Dual-Language Ingredient Declaration & AI Translation (이중 언어 전성분 및 AI 번역)**
   - 국문 전성분표(텍스트 및 PDF 파일) 및 영문 전성분표(텍스트 및 PDF 파일) 입력 및 관리.
   - Claude AI 연동 실시간 영문 전성분 자동 번역 및 적용(Apply to field) 기능 지원.
3. **Product Certificate Management System (상품 인증 서류 첨부 및 버전 관리)**
   - 5개 시스템 표준 카테고리(`FDA 등록`, `상표권`, `성분 인증`, `특허`, `기타`) 기반 증빙 서류 업로드.
   - 동일 문서 타입 신규 업로드 시 이전 파일 `is_current: false` 전환 및 `version` 번호자동 증가 (+1) 관리.
4. **Barcode & Export Specification Validation (바코드 및 수출 규격 검증)**
   - 12자리 UPC / 13자리 EAN 바코드 규격 검증.
   - FOB 수출가($), 원산지(Origin), 포장 패키지 규격과의 상호 검증을 통한 Product Registration Status (`COMPLETE` vs `DRAFT`) 판정.

---

## 2. Related Portal URLs & System Files

### A. Related Portal URLs
- **브랜드 신규 개설 및 상표권 정보 입력**: `https://portal.kselectnetwork.com/portal/brands/new`
- **브랜드 상표권 수정 및 증빙 파일 관리**: `https://portal.kselectnetwork.com/portal/brands/[id]`
- **상품 신규 등록 (전성분/바코드 입력)**: `https://portal.kselectnetwork.com/portal/products/new`
- **상품 상세 — 인허가 & 보증서 탭 (Tab 6)**: `https://portal.kselectnetwork.com/portal/products/[id]` (Tab ID: `#certs`)
- **도움말 센터 (Regulatory & Compliance Topic)**: `https://portal.kselectnetwork.com/portal/help/topics/topic-regulatory`
- **바코드/증빙 서류 1:1 Support Inquiry**: `https://portal.kselectnetwork.com/portal/support`

### B. Related Codebase Files
- `lib/brand/actions.ts`: `parseBrandTrademarks()`, `getCleanBrandIntro()`, `createBrand()`, `updateBrand()`
- `lib/product/actions.ts`: `addProductCertificate()`, `uploadIngredientsFile()`, `deleteIngredientsFile()`, `evaluateProductRegistrationStatus()`
- `lib/product/types.ts`: `CertificateType`, `CERTIFICATE_TYPE_LABEL`, `Product` schema
- `lib/product/portal-detail-loader.ts`: `loadPortalProductDetail()`, signed URLs generation for certificates & ingredients
- `components/brand/brand-form.tsx`: Trademark checkboxes (KIPO/USPTO), registration numbers, file dropzones
- `components/product/product-detail-tabs.tsx`: Tab Panel 5 (`certs`), Ingredients upload block, AI translation widget
- `components/admin/admin-brand-detail.tsx`: Admin trademark proof inspection (`[보기]`, `[다운로드]`)

---

## 3. Statuses, Validations & System Rules

### A. Certificate Types & Labels (`CertificateType`)
| Code | UI Label (KR) | System Behavior & File Usage |
| :--- | :--- | :--- |
| `fda_registration` | FDA 등록 | FDA 시설/제품 등록 관련 증빙 문서 업로드 |
| `trademark` | 상표권 | KIPO / USPTO 상표권 등록증 파일 업로드 |
| `ingredient_certification` | 성분 인증 | 전성분 관련 검사서(MSDS, COA 등) 및 성분 증빙 파일 업로드 |
| `patent` | 특허 | 용기 디자인, 성분 추출 등 특허 증빙 파일 업로드 |
| `other` | 기타 | 기타 위생 허가증, CFS 등 기타 증빙 파일 업로드 |

*참고: MSDS, COA 등은 별도의 독립 DB 타입이 아니며, `ingredient_certification` (성분 인증) 또는 `other` (기타) 카테고리를 통해 업로드·관리됩니다.*

### B. File Upload & Storage Rules
- **Storage Bucket**: `company-uploads` (Protected Private Bucket)
- **Signed URL Access**: Expiration 3600 seconds (1 hour) via Supabase Storage API
- **Allowed Mime Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- **Max File Size**: Default 10MB per document
- **Versioning Logic**: 동일 `product_id` + `certificate_type` 신규 업로드 시 이전 파일은 `is_current: false` 처리되고, `version` 번호가 `+1` 자동 증가.

---

## 4. Classification of Collected Findings

### A. VERIFIED SYSTEM BEHAVIOR (100% Production Code Verified)
1. **상표권 미보유 브랜드 등록 기능**: 브랜드 포털에서 상표권(KIPO/USPTO)이 없는 브랜드도 카탈로그 작성을 위해 정상 등록 및 수정 가능함 (Policy 02).
2. **이중 언어 전성분 시스템**: 전성분은 텍스트 필드(`ingredients_text`)와 국문/영문 첨부파일(`ingredients_file_path`, `ingredients_file_path_en`)로 분리 저장 및 관리됨.
3. **AI 전성분 번역 기능**: `product-detail-tabs.tsx`에서 국문 전성분 입력 후 [번역하기 (Translate)] 및 [리뷰 완료 및 적용] 클릭 시 영문 전성분 텍스트 필드에 자동 채움.
4. **증빙 서류 버전 관리 시스템**: `product_certificates` 테이블에서 `version` 컬럼과 `is_current` 비트 플래그를 이용해 서류 개정 이력을 보존함.
5. **바코드 포맷 검증 규칙**: UPC는 12자리 숫자 (`/^\d{12}$/`), EAN은 13자리 숫자 (`/^\d{13}$/`) 유효성 검사를 통과해야만 제품 등록 상태가 `COMPLETE`로 전환됨.

### B. INFERENCE (Excluded from Official Manual Scope)
- Responsible Person 법적 매핑, FDA MoCRA 법률적 조항 해석 등 시스템 코드로 명시되지 않은 외부 법률 해석은 공식 사용자 매뉴얼 범위에서 제외함.

### C. FUTURE ENHANCEMENT BACKLOG (Not in Current Production — Excluded from Manual)
1. **FDA Listing / FEI Number 텍스트 전용 컬럼**: FDA 등록번호 전용 텍스트 필드 신설.
2. **MoCRA Compliance Status Badge**: 인허가 검토 승인 상태 뱃지 시각화.
3. **US Agent Agreement Dedicated Type**: 미국 대리인 계약서 전용 CertificateType 신설.
4. **Historical Version Download UI**: 과거 버전 서류 다운로드 이력 페이지 개방.

---

## 5. Topic Boundary Notice (`MAN-B-PROD-001` vs `MAN-B-REG-001`)

- **`MAN-B-PROD-001` (Product Registration & Management)**:
  - 상품명, SKU 생성, 가격 산정(KRW/FOB), 물류 규격(Item/Package/Carton), 이미지 업로드 등 **카탈로그 생애주기 전반**을 다룸.
- **`MAN-B-REG-001` (Regulatory, Certification & Compliance)**:
  - 브랜드 상표권 정보, 전성분 입력 및 AI 번역, 인허가/보증서 파일 업로드 및 버전 관리, 바코드 규격 검증 등 **시스템 내 인허가 및 증빙 관리**를 다룸.
  - 상품 상세 페이지에서는 `#certs` 탭 진입 방법만 안내하고, 일반 카탈로그 입력법은 `MAN-B-PROD-001`을 참조하도록 처리함.

---

## 6. Recommended Manual Chapter Outline

- **Chapter 1**: Regulatory & Certification Feature Overview (소프트웨어 인허가 모듈 개요)
- **Chapter 2**: Brand Trademark Declaration & Proof File Attachment (KIPO / USPTO 상표권 정보 및 증빙 파일 관리)
- **Chapter 3**: Ingredient Declaration & AI Dual-Language Translation (전성분 입력 및 AI 영문 번역기 활용)
- **Chapter 4**: Product Certificate Upload & Document Version Control (FDA 등록, 성분 인증, 특허 등 보증서 및 버전 관리)
- **Chapter 5**: Product Barcode & Commercial Export Specification Verification (UPC / EAN 바코드 및 수출 규격 검증)
- **Chapter 6**: Admin Audit History & System Status Revalidation (어드민 서류 확인 및 상태 반영)

---

## 7. FAQ Candidates (Strict System Behavior Grounded)

### FAQ 1. 상표권(Trademark)이 없는 브랜드도 K SELECT 브랜드 포털에 등록할 수 있나요?
> **답변 (System Fact)**: 네, 가능합니다. 포털 내 브랜드 등록 시 특허청(KIPO/USPTO) 상표권 등록이 필수 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 체크박스를 해제하고 자유롭게 브랜드를 개설하여 상품을 등록할 수 있습니다.

### FAQ 2. 전성분(Ingredients) 영문 번역은 어떻게 진행하나요?
> **답변 (System Fact)**: 국문 전성분 텍스트를 입력한 후 하단의 [번역하기 (Translate)] 버튼을 클릭하면 AI 엔진이 표준 영문 INCI 명칭으로 번역합니다. 번역된 내용을 확인한 후 [리뷰 완료 및 적용]을 누르면 영문 전성분 필드에 자동으로 입력됩니다.

### FAQ 3. FDA 등록증이나 성분 검사서를 새 파일로 교체하면 이전 파일은 삭제되나요?
> **답변 (System Fact)**: 삭제되지 않고 시스템 이력으로 보존됩니다. 인허가 탭에서 동일한 서류 종류로 새 파일을 업로드하면 이전 파일은 `is_current: false` 상태로 자동 변경되고, 새 파일이 Version +1로 활성화됩니다.

### FAQ 4. MSDS나 COA(성분분석표)는 어떤 카테고리로 업로드해야 하나요?
> **답변 (System Fact)**: 상품 상세 페이지의 [인허가 & 보증서] 탭에서 서류 종류를 `성분 인증` (ingredient_certification) 또는 `기타` (other)로 선택하여 업로드하시면 됩니다.

### FAQ 5. 바코드(UPC/EAN) 입력 시 오류가 발생하면 어떻게 해야 하나요?
> **답변 (System Fact)**: UPC는 정확히 12자리 숫자, EAN은 정확히 13자리 숫자여야 합니다. 자리수가 맞지 않거나 잘못된 문자가 포함된 경우 제품 상태가 `Draft (보완 대기)`로 지정됩니다. 바코드가 없는 경우 [💬 바코드 문의] 버튼을 이용해 포털 지원팀에 문의할 수 있습니다.
