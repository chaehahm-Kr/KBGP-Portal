# K SELECT 매뉴얼 스크린샷 가이드
### MAN-B-BRAND-001 : K SELECT 브랜드 등록 및 관리 정책

본 문서는 Claude Design이 매뉴얼을 디자인할 때 각 스크린샷의 의도, 실제 프로덕션 경로, 포함된 핵심 UI 요소 및 디자인 가공 지시사항을 제공하는 마스터 가이드입니다.

---

## 📸 스크린샷 목록 요약 (Summary Table)

| ID | 파일명 | 실제 Route / 소스 | 화면 상태 (Status) | 매뉴얼 섹션 매핑 |
|---|---|---|---|---|
| **SS-01** | `MAN-B-BRAND-001_SS-01_Brand-Management.png` | `/portal/brands` | **ACTUAL PRODUCTION** | 3. 포털 화면별 실무 가이드 > 1단계: 브랜드 관리 메인 |
| **SS-02** | `MAN-B-BRAND-001_SS-02_Brand-Registration-Entry.png` | `/portal/brands` (Header) | **ACTUAL PRODUCTION** | 3. 포털 화면별 실무 가이드 > 1단계: 브랜드 관리 메인 |
| **SS-03** | `MAN-B-BRAND-001_SS-03_Brand-Registration-Form.png` | `/portal/brands/new` | **ACTUAL PRODUCTION** | 3. 포털 화면별 실무 가이드 > 2단계: 신규 브랜드 등록 |
| **SS-04** | `MAN-B-BRAND-001_SS-04_Brand-Detail-Edit.png` | `/portal/brands/[id]` | **ACTUAL PRODUCTION** | 3. 포털 화면별 실무 가이드 > 3단계: 브랜드 정보 수정 |
| **SS-05** | `MAN-B-BRAND-001_SS-05_Brand-Empty-State.png` | `/portal/brands` (0 Brands) | **ACTUAL PRODUCTION** | 2. 핵심 정책 > Policy 01: 선행 조건 |
| **SS-06** | `MAN-B-BRAND-001_SS-06_Product-Brand-Selection.png` | `/portal/products/new` | **ACTUAL PRODUCTION** | 3. 포털 화면별 실무 가이드 > 4단계: 상품 등록 연계 |
| **SS-07** | `MAN-B-BRAND-001_SS-07_Brand-Deactivation-Action.png` | `/portal/brands` (Action Area) | **ACTUAL PRODUCTION** | 2. 핵심 정책 > Policy 05, 06: 사용 중단 |
| **SS-08** | `MAN-B-BRAND-001_SS-08_Trademark-Information-Fields.png` | `/portal/brands/new` (Expanded) | **ACTUAL PRODUCTION** | 2. 핵심 정책 > Policy 02 & 3. 실무 가이드 > 2단계 |
| **PROP-01** | *(UI 미구현 항목)* | Brand Policy Modal Concept | **PROPOSED UI CONCEPT** | 정책 요약 안내 모달 컨셉 디자인 |

---

## 🔍 스크린샷별 상세 디자인 지시서 (Per-Screenshot Detail)

### 1. SS-01 — Brand Management Main List
- **파일명**: `MAN-B-BRAND-001_SS-01_Brand-Management.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands`
- **상태**: 실제 라이브 프로덕션 캡처 (Retina 2x)
- **화면 목적**: 파트너사가 등록한 모든 활성 브랜드 카드 목록 조회 화면
- **주요 UI 요소**:
  - `[1]` 상단 타이틀: `브랜드 관리` 및 설명 텍스트
  - `[2]` 우측 상단 액션: `새 브랜드 추가` CTA 버튼
  - `[3]` 브랜드 카드 그리드: 로고 썸네일, 브랜드명 (`K SELECT LAB`, `Natural Shoes Inc`)
  - `[4]` 상표권 상태 배지: `대한민국 상표권 등록 여부: 미보유 / 보유`, `미국 USPTO 상표권 등록 여부: 미보유 / 보유`
  - `[5]` 카드 하단 액션 버튼: `[브랜드 수정]`, `[사용 중단]`
- **Claude Design 지시사항**:
  - 전체 화면 레이아웃의 균형을 유지하면서 브랜드 카드가 선명하게 보이도록 배치하십시오.
  - 상단 타이틀 및 상표권 배지에 Callout 번호를 부여하여 설명과 연결하십시오.

---

### 2. SS-02 — Brand Registration Entry
- **파일명**: `MAN-B-BRAND-001_SS-02_Brand-Registration-Entry.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands` (상단 영역)
- **화면 목적**: 브랜드 관리 페이지 진입 및 신규 브랜드 등록 버튼 위치 강조
- **Claude Design 지시사항**:
  - 상단 우측의 `새 브랜드 추가` 다크 네이비 버튼을 강조 테두리 또는 화살표로 포인팅하여 진입 동선을 시각화하십시오.

---

### 3. SS-03 — Brand Registration Form (Default View)
- **파일명**: `MAN-B-BRAND-001_SS-03_Brand-Registration-Form.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands/new`
- **화면 목적**: 신규 브랜드 생성 시 입력하는 기본 폼 레이아웃 설명
- **주요 UI 요소**:
  - 브랜드명 입력 필드 (필수)
  - 브랜드 소개 텍스트에어리어 (선택)
  - 로고 이미지 파일 선택 (JPG/PNG/WEBP, 10MB 이하)
  - 대한민국 특허청 상표권 등록 여부 라디오 그룹 (`예` / `아니오`)
  - 미국 USPTO 상표권 등록 여부 라디오 그룹 (`예` / `아니오`)
- **Claude Design 지시사항**:
  - 기본 입력 항목의 깔끔한 카드 구조를 유지하고, 필수 항목 표시(`*`)를 시각적으로 강조하십시오.

---

### 4. SS-04 — Brand Detail / Edit Page
- **파일명**: `MAN-B-BRAND-001_SS-04_Brand-Detail-Edit.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands/[id]`
- **화면 목적**: 기존 등록된 브랜드의 상세 정보 조회 및 수정 화면
- **주요 UI 요소**:
  - 기존 등록 데이터 자동 바인딩 (브랜드명: `K SELECT LAB`, 소개글)
  - 등록된 브랜드 로고 미리보기
  - 상표권 여부 및 등록 정보 수정
  - 하단 `변경사항 저장` 버튼
- **Claude Design 지시사항**:
  - 기등록 데이터가 수정 모드에서 어떻게 노출되는지 보여주고, 하단 저장 버튼으로 이어지는 흐름을 표시하십시오.

---

### 5. SS-05 — Brand Empty State
- **파일명**: `MAN-B-BRAND-001_SS-05_Brand-Empty-State.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands` (신규 파트너 계정)
- **화면 목적**: 등록된 브랜드가 하나도 없을 때의 안내 화면
- **주요 UI 요소**:
  - *"등록된 브랜드가 아직 존재하지 않습니다. 상단 '새 브랜드 추가' 단추를 이용해 첫 브랜드를 개설해 보세요."* 안내 박스
- **Claude Design 지시사항**:
  - 파트너사가 가입 후 최초로 수행해야 하는 필수 액션이 '브랜드 등록'임을 설명하는 섹션에 배치하십시오.

---

### 6. SS-06 — Product Registration Brand Selection Dropdown
- **파일명**: `MAN-B-BRAND-001_SS-06_Product-Brand-Selection.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/products/new`
- **화면 목적**: 상품 등록 시 브랜드 선택의 필수성과 바로가기 옵션 설명
- **주요 UI 요소**:
  - 제품 1단계 기본 정보의 `브랜드 *` 드롭다운
  - 드롭다운 내부의 등록된 브랜드 목록
  - 드롭다운 하단 분리선 및 `+ 브랜드 추가` 단축 경로
- **Claude Design 지시사항**:
  - 상품 등록과 브랜드 등록의 유기적 연결 관계를 설명하는 다이어그램 옆에 배치하고, 드롭다운 영역을 확대(Zoom Callout)하여 보여주십시오.

---

### 7. SS-07 — Brand Deactivation Action UI
- **파일명**: `MAN-B-BRAND-001_SS-07_Brand-Deactivation-Action.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands` (카드 하단)
- **화면 목적**: 브랜드 사용 중단(비활성화) 버튼 및 프로세스 설명
- **주요 UI 요소**:
  - 카드 하단의 와인색 아웃라인 `사용 중단` 버튼
  - 사용 중단 시 나타나는 안내 문구
- **Claude Design 지시사항**:
  - 물리 삭제(Hard Delete)가 아닌 논리 비활성화(Soft Deactivation)임을 명확히 구분하는 경고성/안내성 배너 스타일로 꾸며주십시오.

---

### 8. SS-08 — Trademark Information Form Expanded
- **파일명**: `MAN-B-BRAND-001_SS-08_Trademark-Information-Fields.png`
- **URL / Route**: `https://portal.kselectnetwork.com/portal/brands/new` (상표권 '예' 선택 시)
- **화면 목적**: 대한민국 및 미국 상표권 보유 시 등록번호 및 증빙 파일 첨부 절차 설명
- **주요 UI 요소**:
  - `대한민국 특허청 상표권 등록 번호` 입력 필드
  - `상표권 증빙서류 첨부 (PDF/이미지, 10MB 이하)` 업로드 필드
  - `미국 USPTO 상표권 등록 번호` 입력 필드
  - `미국 상표권 증빙서류 첨부` 업로드 필드
- **Claude Design 지시사항**:
  - 상표권 라디오를 '예'로 선택했을 때 동적으로 열리는 입력 필드를 확대하여 단계별로 번호(Step 1, Step 2)를 매겨 디자인하십시오.

---

### 9. PROPOSED-01 — Brand Policy Modal Concept (미구현 항목)
- **상태**: **CURRENT UI — NOT IMPLEMENTED (Proposed UI Concept)**
- **설명**: 현재 프로덕션 UI에는 별도의 '브랜드 정책 팝업 모달' 버튼이 없습니다.
- **Claude Design 지시사항**:
  - 만약 매뉴얼에서 '브랜드 정책 모달'을 시각 자료로 포함하고자 하는 경우, 실제 프로덕션 스크린샷이 아니므로 **Proposed Concept Mockup**으로 제작하고, 상단에 `[Proposed UI Concept]` 라벨을 명기하십시오.
