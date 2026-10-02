# MAN-B-PROD-001: Brand Portal Product Registration & Management — Production Source Collection Report

> **Document ID:** `MAN-B-PROD-001-SRC`  
> **Manual ID:** `MAN-B-PROD-001`  
> **Task Name:** `Brand Portal Product Registration & Management Manual — Production Source Collection`  
> **Phase:** `01_SOURCE — SOURCE COLLECTION ONLY`  
> **Portal:** `K SELECT Brand Portal`  
> **Topic:** `상품 등록 & 관리 / Product Registration & Management`  
> **Target Audience:** Chae + ChatGPT (Editorial & Review Team)  
> **Audited Date:** 2026-10-01  
> **Source Base:** Production Codebase (`components/product/*`, `lib/product/*`, `app/portal/products/*`) & Production Brand Portal  

---

## 1. Executive Summary (개요 및 목적)

본 보고서는 K SELECT Brand Portal의 공식 매뉴얼 **`MAN-B-PROD-001 (상품 등록 & 관리)`** 제작을 위해 현재 Production 시스템과 코드베이스를 전수 감사(Exhaustive Audit)하여 수집한 **공식 팩트 기반 소스 보고서**입니다.

K SELECT의 상품 도메인은 단순한 단일 등록 폼이 아니며, **Phase 1 (신규 등록 진입)** 과 **Phase 2 (6개 관리 탭 기반 상세 정보 및 3계층 로지스틱스 완성)** 로 이루어진 정밀한 2단계 워크플로우를 가집니다.

또한 등록 완료 여부를 10대 필수 영역 기준으로 실시간 판정하는 **`evaluateProductRegistrationStatus`** 엔진과, **등록 상태 / 선정 상태 / 판매 상태**로 분리된 **3대 독립 상태 차원**을 갖추고 있습니다.

---

## 2. 2-Phase 상품 관리 워크플로우 상세 감사

### A. Phase 1: 신규 상품 등록 진입 (`/portal/products/new`)

신규 상품 등록 폼(`ProductForm`)은 4개 핵심 섹션으로 구성되며, 사용자의 등록 목적에 따라 **2가지 제출 분기**를 제공합니다.

#### 1. 입력 섹션 구성
- **기본 정보:** 브랜드 선택(활성 브랜드만 노출), 1Depth 카테고리(스킨케어, 헤어/두피, 뷰티툴 등 6종), 제조사 SKU(사내 고유성), 영문 제품명, 식별 바코드(UPC 12자리 / EAN 13자리).
- **가격 정보:** 한국 소비자가(KRW, 0원 이상 정수), 수출용 FOB 가격(USD, 0원 초과 양수).
- **판매 채널:** 온라인 판매 여부(체크 시 온라인 판매 링크 1 필수), 오프라인 판매 여부, 판매 링크 1/2.
- **패키지 규격:** 단품 포장 패키지의 가로, 세로, 높이(cm ↔ inch 양방향 실시간 변환), 무게(g ↔ lb ↔ oz 3-way 변환).

#### 2. 2가지 제출 액션 (Submission Actions)
1. **`임시 저장 후 나중에 등록` (`submitAction: list`):**
   - **최소 요구 조건:** `브랜드`, `카테고리`, `제조사 SKU`, `영문 제품명` 4개 필드만 충족하면 저장 가능.
   - **결과:** 상태 `DRAFT (보완 대기)`로 생성되며, 상품 목록 화면(`/portal/products?saved=draft`)으로 이동합니다.
2. **`제품 등록 및 계속` (`submitAction: continue`):**
   - **정식 요구 조건:** 4대 기본 필드 외에 `한국 소비자가 > 0`, `FOB 수출 가격 > 0`, `UPC 또는 EAN 바코드 필수`, `온라인 판매 시 링크 1 필수`를 종합 검증.
   - **결과:** 검증 통과 시 레코드를 생성하고 즉시 Phase 2 상세 관리 화면(`/portal/products/[id]`)으로 리다이렉트되어 하위 탭 정보(상세 속성, 로지스틱스 3단계 규격, 이미지 등)를 입력할 수 있도록 유도합니다.

---

### B. Phase 2: 상품 상세 관리 다중 탭 시스템 (`/portal/products/[id]`)

상품 상세 관리 화면(`ProductDetailTabs`)은 총 6개 탭(감사 로그 포함 7개 섹션)으로 구성되며, 각 탭별로 특화된 전문 입력 도구를 제공합니다.

```text
[상품 상세 관리 탭 체계]
├── 탭 1: 기본 정보 (Basic Info)
├── 탭 2: 카테고리 및 속성 (Category & Attributes - 3Depth + Dynamic Profile)
├── 탭 3: 가격 정보 (Pricing Info - KRW/USD/FOB 마진/수량별 B2B 공급가)
├── 탭 4: 로지스틱스 (Logistics - 3-Tier Specs & Container Simulator)
├── 탭 5: 미디어 (Media - 이미지 드래그앤드롭 순서변경, 썸네일, 동영상)
├── 탭 6: 인증 및 서류 (Certificates - 전성분표, 상표권, FDA 버전관리)
└── 탭 7: 변경 이력 (Audit Change Log - 불변 감사 이력)
```

#### 1. 탭 1: 기본 정보 (Basic Info)
- **국문/영문 제품명:** 글로벌 카탈로그용 영문명과 국내 표시용 국문명 관리.
- **원산지(Origin) & 용량(Volume):** 통관 필수 원산지 선택 및 본품 용량 단위(`ml`, `g`, `oz`, `fl oz` 등) 설정.
- **리드타임 (납기):** 수치와 단위(`일`, `주`, `개월`)를 결합하여 발주 리드타임 관리.
- **영문 불릿 포인트 (Bullet Points):** 최대 5개 이상의 핵심 제품 소구점(Features) 라인 관리.
- **전성분 텍스트 & 내장 번역기:** 한글 전성분 입력 후 `MyMemory API` 기반 실시간 영문 번역 및 원클릭 적용 도구 제공.

#### 2. 탭 2: 카테고리 및 속성 (Category & Attributes)
- **3-Depth 카테고리 선택기:** 1Depth(대분류) → 2Depth(중분류) → 3Depth(소분류/세분류)를 계층적으로 선택하며, 리프 카테고리(`is_final=true`)까지 완결 지정.
- **동의어/연관 검색어 사전 지원:** `선크림`, `비비크림`, `폼클렌징`, `장벽크림` 등 업계 키워드 검색 시 정확한 3-Depth 카테고리 경로를 자동 제안.
- **동적 속성 바인딩 (`CategoryAttributeForm`):**
  - **공통 속성 (COMMON):** 피부타입, 사용대상, 용기형태 등 전 제품군 공통 적용.
  - **프로필 속성 (PROFILE):** 선택된 카테고리에 바인딩된 전용 속성(예: 선케어의 SPF/PA 지수, 워터프루프 여부, 백탁 유무 등).
  - **필수 속성 검증:** 필수 속성 누락 시 완료율(`categoryCompletion`)이 감소하며 완결되지 않음.

#### 3. 탭 3: 가격 정보 (Pricing Info)
- **4대 가격 체계:** 한국 소비자가(KRW), 한국 도매가(KRW), 수출용 FOB 가격(USD), 예상 미국 소비자가(MSRP USD).
- **실시간 지표 자동 산출:**
  - `FOB 대비 MSRP 배수`: `MSRP ÷ FOB Price`
  - `FOB 공급율`: `(FOB Price × 환율) ÷ Retail KRW`
- **수량별 B2B 공급 가격 (Tiered Pricing):** 대량 수출 발주를 위한 MOQ(최소주문수량) 및 구간별 단가 테이블 동적 추가/관리.

#### 4. 탭 4: 로지스틱스 3단계 규격 (Logistics 3-Tier Specs)
- **Tier 1 (단품 본품 규격):** 포장재를 제외한 제품 알맹이(Unit)의 가로, 세로, 높이, 무게.
- **Tier 2 (단품 포장 패키지 규격):** 단상자/개별 박스(Package) 상태의 규격 및 무게 (cm ↔ inch, g ↔ lb ↔ oz 실시간 동기화).
- **Tier 3 (마스터 카톤 규격):** 수출용 아웃박스(Carton) 규격. 카톤 입수량(`carton_pack_qty`), 가로, 세로, 높이, 무게 입력 시 **Carton CBM이 자동 연산**(`(W×D×H)/1,000,000`).
- **컨테이너 적재 시뮬레이터:**
  - 20FT (28 CBM), 40FT (58 CBM), 40HQ (68 CBM) 기준 최대 적재 카톤 수, 총 제품 수, 총 중량, 총 CBM 자동 연산.
  - 시뮬레이션 결과를 원클릭으로 컨테이너 스펙 입력란에 자동 복사 적용 지원.

#### 5. 탭 5: 미디어 (Media)
- **이미지 업로드 및 한도:** 최대 5장 (스토리지), 파일당 10MB (JPG, PNG, WEBP).
- **대표 이미지 (Position 0):** 첫 번째 이미지가 대표 썸네일로 자동 지정.
- **드래그 앤 드롭 순서 변경:** 마우스 드래그로 순서를 변경하면 `updateProductImagesOrder` 액션을 통해 DB에 즉시 반영.
- **고해상도 줌(Zoom) 뷰어:** 등록된 이미지 클릭 시 모달 라이트박스로 확대 확인 가능.
- **동영상 연동:** YouTube/Vimeo 스트리밍 URL 또는 최대 100MB MP4/WebM 파일 직접 업로드 지원.

#### 6. 탭 6: 인증 및 서류 (Certificates)
- **전성분표 파일 (국문 / 영문):** 성분 분석 및 MoCRA 대응을 위한 파일 업로드 (PDF, 이미지, 스프레드시트).
- **버전 관리 (Versioning):** 상표권(`trademark`), FDA 등록(`fda_registration`), 기타 인증서(`other`) 업로드 시 기존 서류를 대체하면서 `v1`, `v2` 버전 히스토리 자동 보존.

#### 7. 탭 7: 변경 이력 (Audit Change Log)
- **불변 감사 이력:** 브랜드사 사용자 또는 어드민 관리자가 정보를 수정할 때마다 타임스탬프, 작업자명, 변경 섹션, 변경 전/후 필드 Diff(`recordProductChangeLog`)를 영구 기록.

---

## 3. 상태 관리 아키텍처 및 등록 완료 판정 엔진

K SELECT의 상품 상태는 단일 상태가 아닌 **3개의 상호 독립적인 차원(Dimension)** 으로 설계되어 있습니다.

### A. 3대 독립 상태 차원 매트릭스

| 상태 차원 | 상태 코드 (Enum) | 한국어 표기 | 시스템 정의 및 역할 |
| :--- | :--- | :--- | :--- |
| **1. 등록 상태 (`registration_status`)** | `COMPLETE` | **등록 완료** | 10대 필수 영역 정보가 모두 입력되어 검증 완료된 상태 |
| | `DRAFT` | **보완 대기** | 필수 항목 중 하나 이상이 누락되어 보완이 필요한 상태 |
| | `DELETED` | **삭제됨** | 소프트 삭제(`deleted_at`) 처리된 상태 |
| **2. 선정 상태 (`selection_status`)** | `UNREVIEWED` | **미검토** | 등록 완료 후 K SELECT MD의 검토 대기 |
| | `UNDER_REVIEW` | **검토 중** | MD가 바이어/채널 매칭 적합성을 심사 중인 상태 |
| | `INFO_REQUESTED`| **정보 요청** | MD가 브랜드사에 추가 서류/스펙 보완을 요청한 상태 |
| | `SELECTED` | **선정** | 미국 수출 및 판매 채널 매칭이 확정된 상태 |
| | `NOT_SELECTED` | **미선정** | 채널 매칭 미선정 또는 보류 상태 |
| **3. 판매 상태 (`sales_status`)** | `PREPARING` | **판매 준비** | 선정 완료 후 물류 선적, 입고, 채널 리스팅 준비 단계 |
| | `ON_SALE` | **판매 중** | 미국 온/오프라인 채널에서 실제 판매가 진행 중인 상태 |
| | `PAUSED` | **일시 중지** | 일시 품절, 재고 부족, 시즌 오프로 판매 일시 중단 |
| | `ENDED` | **판매 종료** | 상품 단종 또는 계약 종료로 판매 완전 종결 |

---

### B. 등록 완료 판정 엔진 (`evaluateProductRegistrationStatus`) 10대 필수 영역

시스템은 다음 **10대 필수 영역**이 모두 충족되었을 때만 `COMPLETE (등록 완료)`로 판정합니다.

1. **브랜드 (`brand_id`):** 소속 회사의 활성 브랜드 바인딩 필수.
2. **카테고리 (`category_code`):** 3-Depth 리프 카테고리까지 완결 선택 필수.
3. **카테고리 필수 속성 (`requiredAttributesComplete`):** 카테고리 프로필의 필수 속성 100% 입력 필수.
4. **영문 제품명 (`name_en`):** 1자 이상 유효한 영문명 필수 (임시저장 기본명칭 불가).
5. **제조사 SKU (`manufacture_sku`):** 파트너사 내 고유 식별자 필수 (임시 SKU `DRAFT-SKU-` 불가).
6. **원산지 (`origin`):** 유효한 국가 선택 필수.
7. **가격 정보:** 한국 소비자가(`price_krw_retail > 0`) 및 수출용 FOB 가격(`price_usd_fob > 0`) 필수.
8. **로지스틱스 3단계 규격 (전체 필수):**
   - 단품 규격 (Unit W, D, H, Wt > 0)
   - 패키지 규격 (Package W, D, H, Wt > 0)
   - 마스터 카톤 규격 (Carton Pack Qty, W, D, H, Wt > 0)
9. **식별 바코드:** UPC(12자리) 또는 EAN(13자리) 중 최소 1개 이상 유효한 바코드 필수.
10. **미디어:** 대표 이미지 최소 1장 이상 등록 필수.
*(추가 조건: 온라인 판매 여부 체크 시 `온라인 판매 링크 1` 필수)*

#### 💡 인터랙티브 누락 항목 네비게이션 (Autofocus Navigation)
- 누락 항목이 있을 경우 상품 상세 상단에 **로즈색(Rose) 보완 대기 배너**와 함께 누락 항목 태그가 노출됩니다.
- 사용자가 누락 뱃지를 클릭하면 **해당 탭으로 자동 전환되고, 해당 입력 필드로 부드럽게 스크롤되며 2.5초간 링 하이라이트 및 자동 포커스(Focus)** 가 적용됩니다.

---

## 4. Brand ↔ Product 구조적 관계 및 제약

1. **No Orphan Products (고아 상품 차단):**
   - 모든 상품 레코드는 DB 차원에서 `brand_id` 외래키를 필수로 요구합니다. 브랜드 없는 상품은 생성이 불가능합니다.
2. **소속사 및 활성 브랜드 제약:**
   - 파트너사 사용자는 오직 자신이 소속된 회사의 **활성 상태 브랜드(`is_active = true`)** 만 선택하여 신규 상품을 등록할 수 있습니다.
3. **브랜드 비활성화 시의 상품 동작:**
   - `MAN-BRAND-001` 정책에 따라 브랜드가 비활성화(Inactive)되어도 기존 등록된 상품 데이터는 삭제되지 않고 보존됩니다.
   - 단, 비활성화된 브랜드로는 신규 상품 등록이 차단되며, 어드민 검토 및 채널 매칭 대상에서 제한될 수 있습니다.

---

## 5. 수정, 소프트 삭제 및 이중 지속성 (Edit & Soft Delete)

### A. 수정 및 권한
- 브랜드 사용자는 상품 상세의 모든 탭 정보를 언제든지 수정하고 저장할 수 있습니다.
- 단, 어드민이 관리하는 **`Letusto SKU`** 및 어드민 오버라이드 메타데이터는 브랜드 포털에서 읽기 전용으로 표시됩니다.

### B. 소프트 삭제 (Soft Delete) & 일괄 삭제 (Bulk Delete)
- **삭제 방식:** 물리적 데이터 삭제(`DROP/DELETE`)가 아닌 **소프트 삭제(Soft Delete)** 로 동작합니다.
- **이중 지속성 (Dual Persistence):**
  - DB 컬럼 `deleted_at = NOW()` 기록
  - JSONB 메타데이터 `price_additional_info.deleted_at` 동시 동기화
  - 상태값 동시 변경: `selection_status = 'NOT_SELECTED'`, `sales_status = 'ENDED'`
- **일괄 삭제 지원:** 목록 화면에서 체크박스로 여러 상품을 다중 선택 후 일괄 삭제를 실행할 수 있습니다.
- **목록 필터링:** 삭제된 상품은 기본 `Active` 목록에서 즉시 숨겨지며, `Deleted` 탭 필터를 통해서만 조회됩니다.

---

## 6. 사실 검증 분류 (Fact Classification)

| 구분 | 내용 | 검증 근거 |
| :--- | :--- | :--- |
| **VERIFIED SYSTEM BEHAVIOR<br>(검증된 시스템 동작)** | - 2단계 상품 관리 워크플로우 (신규 폼 → 상세 6개 탭)<br>- 10대 필수 영역 기반 `evaluateProductRegistrationStatus` 자동 판정 엔진<br>- 누락 필드 클릭 시 해당 탭 이동 및 2.5초 하이라이트 포커스<br>- 3-Depth 카테고리 계층 및 연관 검색어/동의어 매칭<br>- 로지스틱스 3단계 규격(단품, 패키지, 카톤) 및 단위 자동 변환(cm/inch, g/lb/oz)<br>- 카톤 CBM 자동 계산 및 20FT/40FT/40HQ 컨테이너 시뮬레이터<br>- 이미지 드래그앤드롭 순서 변경 및 Position 0 대표 썸네일 지정<br>- 국문/영문 전성분표 업로드 및 MyMemory 실시간 영문 번역기<br>- 인증서 및 서류 업로드 시 자동 버전 관리(`v1`, `v2`)<br>- 소프트 삭제(Soft Delete), 일괄 삭제 및 불변 감사 로그(Audit Log) 기록 | `components/product/*`<br>`lib/product/*`<br>Production Brand Portal UI 전수 감사 완료 |
| **INFERENCE<br>(합리적 추론)** | - MD의 `selection_status` 선정 완료 후 리테일러/바이어 대상 수출 발주 및 공급이 진행됨<br>- 미국 시장 수출을 위해 UPC 바코드와 FDA/MoCRA 서류가 우선적으로 검토됨 | B2B 플랫폼 비즈니스 프로세스 흐름상 일반적 전개 |
| **DECISION REQUIRED<br>(결정 필요 사항)** | - 브랜드사가 실수로 삭제한 상품에 대한 '복구(Restore)' 기능을 포털 UI에 직접 노출할 것인가 여부 (현재는 어드민 또는 DB 레벨에서 복구 가능)<br>- 임시저장(Draft) 상품에 대해 이메일/알림톡 보완 리마인더를 발송할 것인가 여부 | Chae + ChatGPT 검토 후 정책 결정 필요 |

---

## 7. 토픽 경계 및 매뉴얼 범위 준수 (Topic Boundaries)

본 매뉴얼(`MAN-B-PROD-001`)은 **상품 등록 & 관리** 고유 영역에만 집중하며, 아래 연관 주제는 별도 전용 매뉴얼의 범위로 위임합니다.

- ❌ **정산 및 대금 지급 세부 정책:** `MAN-SETTLE-001 (정산 및 대금 관리)`에서 전담.
- ❌ **미국 FDA / MoCRA 법률 규제 정책 세부:** `MAN-REG-001 (미국 인허가 및 규제 가이드)`에서 전담.
- ❌ **창고 실시간 재고 이동 및 입출고 처리:** `MAN-WHS-001 (물류 및 재고 관리)`에서 전담.

---

## 8. 브랜드 사용자용 후보 FAQ (Candidate FAQ Topics)

1. **Q. 상품을 임시 저장(Draft)했는데, 언제 K SELECT MD가 검토를 시작하나요?**  
   *A. 임시 저장은 작성 중인 상태이므로 MD 검토 대상에 오르지 않습니다. 10대 필수 정보(카테고리 필수 속성, 로지스틱스 3단계 규격, 바코드, 대표 이미지 등)를 모두 입력하여 상태가 `COMPLETE (등록 완료)`로 변경되어야 MD 검토가 시작됩니다.*
2. **Q. UPC 바코드와 EAN 바코드 중 어떤 것을 입력해야 하나요?**  
   *A. 둘 중 하나는 반드시 입력해야 합니다. 미국 시장(아마존, 세포라, 타겟 등) 판매를 주력으로 하시는 경우 12자리 UPC 바코드를 권장하며, 한국/국제 표준 바코드를 보유하신 경우 13자리 EAN(880...)을 입력하셔도 됩니다.*
3. **Q. 로지스틱스에서 '단품 규격', '패키지 규격', '마스터 카톤 규격'의 차이는 무엇인가요?**  
   *A. 단품 규격은 박스 포장을 제외한 본품 자체의 크기/무게이며, 패키지 규격은 소비자에게 판매되는 단상자(개별 박스) 포장 상태의 규격입니다. 마스터 카톤 규격은 공장에서 출고되는 수출용 아웃박스 규격으로, 카톤 입수량과 CBM이 컨테이너 선적 계산의 핵심 기준이 됩니다.*
4. **Q. 등록된 상품 이미지를 대표 썸네일로 바꾸려면 어떻게 하나요?**  
   *A. `미디어` 탭에서 업로드된 이미지 카드를 마우스로 드래그하여 가장 첫 번째(Position 0) 위치로 이동시키면 즉시 대표 썸네일로 반영 및 자동 저장됩니다.*
5. **Q. 상품을 삭제하면 완전히 지워지나요? 다시 복구할 수 있나요?**  
   *A. 삭제 시 데이터는 즉시 완전 삭제되지 않고 '소프트 삭제'되어 `Deleted` 탭에 보관됩니다. 실수로 삭제하여 복구가 필요한 경우 1:1 고객센터로 문의하시면 운영팀 확인 후 복구 지원이 가능합니다.*

---

## 9. Chae + ChatGPT 검토를 위한 열린 질문 (Open Questions)

1. **단품 규격(Unit Spec) 필수 입력 정책 유지 여부:**  
   - 현재 시스템은 단품 규격, 패키지 규격, 마스터 카톤 규격의 3가지를 모두 입력해야 `COMPLETE`가 됩니다. 일부 화장품 브랜드의 경우 단상자(패키지) 규격만 알고 본품 규격을 모르는 경우가 있는데, 3가지 모두 필수로 유지하는 현재 정책을 매뉴얼에 공식 안내할지 확인이 필요합니다.
2. **복수 이미지 업로드 상한선 가이드:**  
   - UI 드롭존에서는 다중 파일 업로드를 지원하며 최대 5장이 시스템 대표 한도입니다. 매뉴얼에서 '최소 1장 필수, 최대 5장 권장'으로 가이드를 표준화할지 확인이 필요합니다.

---

## 10. 결론 및 다음 단계 안내

`MAN-B-PROD-001`의 `01_SOURCE` 단계가 완전하게 완료되었습니다.

다음 단계인 **`02_CLAUDE_PACKAGE`** 로 진행하기 위해:
1. Chae + ChatGPT가 본 소스 보고서(`MAN-B-PROD-001_Source_Collection_Report.md`), 필드 인벤토리(`MAN-B-PROD-001_Field_Inventory.md`), 워크플로우 맵(`MAN-B-PROD-001_Workflow_Map.md`), 스크린샷 명세(`MAN-B-PROD-001_Screenshot_Requirements.md`)를 검토합니다.
2. 검토 및 승인이 완료되면 Claude Design 전달용 마스터 프롬프트 및 완성된 컨텐츠 패키지를 빌드합니다.
