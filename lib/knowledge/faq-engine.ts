import {
  KnowledgeItem,
  KnowledgeFaqItem,
  FaqStatus,
  FaqKind,
  AudienceType,
  SecurityUserContext
} from "./types";
import {
  getStoreKnowledgeItems,
  getStoreKnowledgeById,
  getStoreFaqs,
  getStoreFaqById,
  saveStoreFaq,
  deleteStoreFaq,
  addStoreAuditLog
} from "./store";
import { isEligibleForAudience } from "./distribution";
import { normalizeQueryString, calculateLevenshtein } from "./search";

/**
 * Checks similarity between two questions to prevent duplicate candidates.
 */
export function isDuplicateQuestion(q1: string, q2: string): boolean {
  const norm1 = normalizeQueryString(q1);
  const norm2 = normalizeQueryString(q2);

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    if (minLen >= 8) return true;
  }

  const dist = calculateLevenshtein(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen > 0 && dist / maxLen < 0.25) {
    return true;
  }

  return false;
}

/**
 * Candidate Generation Engine: Generates grounded FAQ & Suggested Question candidates
 * strictly derived from a Published Knowledge document.
 *
 * CRITICAL GOVERNANCE PRINCIPLE:
 * AI Generated !== Published FAQ.
 * Every generated item starts strictly in 'CANDIDATE' status.
 */
export async function generateFaqCandidatesForKnowledge(
  knowledgeId: string,
  userContext?: SecurityUserContext
): Promise<{ success: boolean; createdCount: number; items: KnowledgeFaqItem[]; message?: string }> {
  const item = await getStoreKnowledgeById(knowledgeId);
  if (!item) {
    throw new Error(`Knowledge item '${knowledgeId}' not found.`);
  }

  if (item.status !== "PUBLISHED") {
    throw new Error(`Cannot generate FAQ from non-published knowledge (Current status: ${item.status}). Only PUBLISHED knowledge is eligible.`);
  }

  const existingFaqs = await getStoreFaqs(knowledgeId);
  const candidatesToCreate: Array<{
    question_ko: string;
    question_en: string;
    answer_ko: string;
    answer_en: string;
    kind: FaqKind;
    display_order: number;
    is_featured: boolean;
  }> = [];

  const now = new Date().toISOString();
  const titleText = (item.title_ko || item.title || "").toLowerCase();
  const isBrandPolicy = item.id === "kno-brand-policy-v10" || item.slug?.includes("brand-policy") || titleText.includes("브랜드 등록");
  const isInsights = item.category === "INSIGHTS" || item.module === "INSIGHTS";

  if (isBrandPolicy) {
    // Grounded FAQ Candidates derived directly from MAN-BRAND-001 (6 Core Policies)
    candidatesToCreate.push(
      {
        question_ko: "브랜드는 어떻게 등록하나요?",
        question_en: "How do I register a brand in the portal?",
        answer_ko: "포털 내 브랜드 관리 메뉴(/portal/brands) 또는 신규 등록 화면(/portal/brands/new)에서 브랜드 국문/영문명, 사업자 등록번호, 대표 카테고리, 슬로건 및 물류 출고지/반품지 정보를 입력하여 등록합니다. 상품 등록 전 활성 브랜드 등록이 필수입니다. (Policy 01)",
        answer_en: "Navigate to Brand Management (/portal/brands) or New Brand (/portal/brands/new) to enter brand names, business ID, category, and logistics origins. Brand registration is mandatory before product listings. (Policy 01)",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "상표권이 없어도 브랜드 등록이 가능한가요?",
        question_en: "Can I register a brand without an official trademark?",
        answer_ko: "네, 가능합니다. 포털 내 브랜드 등록은 카탈로그 분류를 위한 것이며, 특허청(KIPO/USPTO) 상표권 등록이 필수 전제 조건은 아닙니다. 상표권이 없거나 출원 중인 브랜드도 자유롭게 등록하여 입점할 수 있습니다. (Policy 02)",
        answer_en: "Yes. Brand registration in the portal is for catalog classification and does not require official trademark registration. Brands without trademarks or with pending applications can be registered. (Policy 02)",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      },
      {
        question_ko: "상품이 연결된 브랜드를 삭제할 수 있나요?",
        question_en: "Can I delete a brand that has associated products?",
        answer_ko: "단 1건이라도 상품이 등록된 브랜드는 발주·통관·인보이스 무결성 보존을 위해 물리 삭제(Hard Delete)가 절대 불가합니다. 취급 중단 시 영구 삭제 대신 '사용 중단(Inactive)' 비활성화 처리를 적용하며, 언제든지 재활성화가 가능합니다. (Policy 05 & 06)",
        answer_en: "Brands associated with even one product cannot be physically hard-deleted to preserve order, customs, and invoice audit integrity. Use Inactive status instead. (Policy 05 & 06)",
        kind: "BOTH",
        display_order: 3,
        is_featured: true
      },
      {
        question_ko: "동일한 브랜드를 여러 회사가 취급할 수 있나요?",
        question_en: "Can multiple partner companies distribute the same brand?",
        answer_ko: "네, 글로벌 B2B 유통 구조를 반영하여 동일 브랜드를 여러 회사(제조사, 공식 총판, 셀러)가 독립적으로 취급할 수 있습니다. 단, 지식재산권을 직접 보유한 원천 Brand Owner는 시스템상 1개사로 정의됩니다. (Policy 03 & 04)",
        answer_en: "Yes. Multiple independent companies (manufacturers, distributors, sellers) can distribute the same brand, while authoritative Brand Ownership is maintained at 1 entity. (Policy 03 & 04)",
        kind: "BOTH",
        display_order: 4,
        is_featured: false
      },
      {
        question_ko: "사용하지 않는 브랜드는 어떻게 처리하나요?",
        question_en: "How do I handle unused or discontinued brands?",
        answer_ko: "취급을 중단하거나 사용하지 않는 브랜드는 브랜드 관리 목록에서 '사용 중단(Inactive)'으로 전환합니다. 비활성화된 브랜드는 신규 상품 등록 목록에서 제외되지만 기존 거래 내역은 안전하게 보존됩니다. (Policy 06)",
        answer_en: "Set discontinued brands to Inactive in the Brand Management screen. Inactive brands are hidden from new product selection while preserving audit history. (Policy 06)",
        kind: "BOTH",
        display_order: 5,
        is_featured: false
      }
    );
  } else if (item.id === "kno-onboarding-guide-v10" || item.slug?.includes("onboarding-guide") || titleText.includes("온보딩")) {
    // Grounded FAQ Candidates derived directly from MAN-B-ONB-001 (7-Step Onboarding Guide)
    candidatesToCreate.push(
      {
        question_ko: "처음 가입하면 무엇부터 해야 하나요? 온보딩 절차가 어떻게 되나요?",
        question_en: "What should I do first after signing up? What is the onboarding process?",
        answer_ko: "포털 로그인 후 대시보드(/portal)의 7단계 온보딩 로드맵에 따라 회사 정보 확인 ➔ 관리자 프로필 ➔ 브랜드 정보 ➔ 팀원 초대(선택) ➔ 6대 담당업무 지정 ➔ 상품 등록 ➔ 기본계약 전자서명을 진행합니다. 각 단계는 서류 및 정보 준비 상황에 따라 원하는 순서대로 자유롭게 선택하여 진행할 수 있습니다. (Chapter 02 · 7-Step Roadmap)",
        answer_en: "After logging in, follow the 7-step onboarding roadmap on the dashboard (/portal): Company Info -> Admin Profile -> Brand Info -> Team Invitation (Optional) -> 6 Task Owners -> Product Listing -> Master Agreement. Steps can be completed in any flexible order based on your document readiness. (Chapter 02 · 7-Step Roadmap)",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "회사 정보 등록 시 필수 입력 항목은 무엇인가요?",
        question_en: "What are the mandatory fields when registering company information?",
        answer_ko: "회사 정보 관리 메뉴(/portal/company/info)에서 공식 법인명, 대표 연락처와 함께 필수 4대 주소(기본 주소 address_1, 시 City, 주/도 State/Province, 우편번호 Zip Code)를 입력해야 합니다. 4개 주소 필드가 모두 저장되어야 온보딩 1단계(STEP 1)가 완료 처리됩니다. (Chapter 04 · STEP 1)",
        answer_en: "In Company Information (/portal/company/info), you must provide legal corporate name, contact phone, and all 4 mandatory address fields: Address 1, City, State/Province, and Zip Code. All 4 address fields must be saved to complete STEP 1. (Chapter 04 · STEP 1)",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      },
      {
        question_ko: "관리자 정보에서 영문 이름은 왜 필수이며 어떻게 입력해야 하나요?",
        question_en: "Why is English name required in admin profile and how should it be entered?",
        answer_ko: "내 계정 메뉴(/portal/account)에서 등록하는 대표 관리자의 영문 성명(First Name, Last Name)은 글로벌 무역 서류 및 통관, 공식 파트너십 커뮤니케이션에 활용되므로 여권상 영문 표기와 동일하게 입력해야 합니다. 국문 성명, 직함(Job Title), 연락처와 함께 저장하면 2단계(STEP 2)가 완료됩니다. (Chapter 05 · STEP 2)",
        answer_en: "The administrator's English name (First Name, Last Name) in My Account (/portal/account) is used for global trade documents, customs, and official partnership communications, so it must match your passport exactly. Save along with Korean name, Job Title, and phone to complete STEP 2. (Chapter 05 · STEP 2)",
        kind: "BOTH",
        display_order: 3,
        is_featured: false
      },
      {
        question_ko: "브랜드 정보 확인 단계(STEP 3)에서는 무엇을 확인하나요?",
        question_en: "What should I verify during the Brand Information step (STEP 3)?",
        answer_ko: "브랜드 관리 메뉴(/portal/brands)에서 등록된 대표 브랜드명, 브랜드 로고, 대한민국(KIPO)/미국(USPTO) 상표권 보유 현황을 점검하고 상단 배너의 '브랜드 정보 확인 완료 ✓' 버튼을 클릭합니다. 신규 브랜드 추가 및 상표권 상세 정책은 MAN-BRAND-001 문서를 참고해 주시기 바랍니다. (Chapter 06 · STEP 3)",
        answer_en: "In Brand Management (/portal/brands), check your registered brand name, logo, and KIPO/USPTO trademark registration status, then click 'Confirm Brand Information ✓'. For detailed brand registration and trademark policies, refer to MAN-BRAND-001. (Chapter 06 · STEP 3)",
        kind: "BOTH",
        display_order: 4,
        is_featured: false
      },
      {
        question_ko: "팀원 초대는 필수인가요? 1인 기업은 어떻게 하나요?",
        question_en: "Is team invitation mandatory? How do solo/single-person businesses proceed?",
        answer_ko: "팀원 초대는 선택 사항(Optional)입니다. 사내 동료가 있는 경우 소속 사용자 관리(/portal/company/users)에서 이메일로 초대할 수 있으며, 1인 기업이거나 즉시 초대가 불필요한 경우 대시보드 온보딩 체크리스트 STEP 4 카드의 '나중에 하기' 버튼을 누르면 본 단계를 건너뛰고 완료할 수 있습니다. (Chapter 07 · STEP 4)",
        answer_en: "Team invitation is optional. If you have colleagues, you can invite them via email in Team Management (/portal/company/users). For solo entrepreneurs or if immediate invitations are not needed, click 'Do this later' on the STEP 4 dashboard card to skip and complete this step. (Chapter 07 · STEP 4)",
        kind: "BOTH",
        display_order: 5,
        is_featured: true
      },
      {
        question_ko: "6대 담당업무는 어떻게 지정하며, 한 사람이 여러 업무를 담당할 수 있나요?",
        question_en: "How are the 6 core task owners assigned, and can one person hold multiple roles?",
        answer_ko: "회사 정보 관리 > 담당 업무 탭(/portal/company/info?tab=tasks)에서 6대 핵심 업무(회사·신청, 계약, 제품·콘텐츠·인증, 가격·견적, 발주·물류·재고, 정산·문의)별 사내 주 담당자(Primary Owner)를 드롭다운에서 지정합니다. 1인 기업 또는 소규모 팀의 경우 대표 관리자 1인이 6개 업무를 모두 겸임하여 지정할 수 있습니다. (Chapter 08 · STEP 5)",
        answer_en: "Navigate to Company Info > Task Owners tab (/portal/company/info?tab=tasks) to assign Primary Owners across 6 operational areas (Company, Contract, Product/Cert, Pricing/Quote, Orders/Logistics, Settlement/Inquiry). For solo or small teams, a single admin can hold all 6 primary owner roles. (Chapter 08 · STEP 5)",
        kind: "BOTH",
        display_order: 6,
        is_featured: true
      },
      {
        question_ko: "온보딩을 완료하려면 상품을 몇 개 등록해야 하며, 어떤 상태여야 하나요?",
        question_en: "How many products must be registered to complete onboarding, and what status is required?",
        answer_ko: "대표 상품을 최소 1개 이상 '등록 완료(COMPLETE)' 상태로 등록(/portal/products)해야 합니다. 단순 임시저장(Draft) 상태는 인정되지 않으며, 기본정보, 카테고리 필수 속성, 가격(소비자가/FOB가), 3단계 로지스틱스 규격(단품/패키지/카톤), 바코드(UPC/EAN), 대표 이미지가 모두 입력되어야 합니다. (Chapter 09 · STEP 6)",
        answer_en: "You must register at least 1 representative product in 'COMPLETE' status in Product Management (/portal/products). Draft status is not accepted. All requirements including basic info, category attributes, pricing (Retail/FOB), 3-tier specs (Item/Package/Carton), barcode (UPC/EAN), and image must be filled. (Chapter 09 · STEP 6)",
        kind: "BOTH",
        display_order: 7,
        is_featured: true
      },
      {
        question_ko: "기본계약 체결은 언제 어떻게 진행하나요? 계약 전에도 상품 등록이 가능한가요?",
        question_en: "When and how is the Master Agreement signed? Can products be listed before signing?",
        answer_ko: "회사 정보 관리 > 공급 및 이용 약관 탭(/portal/company/info?tab=agreements)에서 비독점 기본공급계약서 전문을 검토한 후 서명 패드에 자필 전자서명을 작성하여 체결합니다. 계약 체결 전이라도 상품 등록 및 기본 정보 입력 등 사전 준비 작업은 자유롭게 진행하실 수 있습니다. (Chapter 10 · STEP 7)",
        answer_en: "In Company Info > Agreements tab (/portal/company/info?tab=agreements), review the Non-Exclusive Master Agreement terms and execute electronic signature on the pad. Product listing and preparatory tasks can be conducted freely even before agreement execution. (Chapter 10 · STEP 7)",
        kind: "BOTH",
        display_order: 8,
        is_featured: false
      },
      {
        question_ko: "온보딩 7단계를 모두 완료하면 어떻게 되나요?",
        question_en: "What happens after completing all 7 onboarding steps?",
        answer_ko: "7개 단계가 모두 완료되면 대시보드 상단에 '7 / 7 완료 (100%)' 녹색 배지가 표시되며 Brand Portal의 정식 운영 기능이 활성화됩니다. 온보딩 완료 후에도 회사 주소, 담당자, 계좌, 상품 정보 등 변경 사항이 발생하면 언제든지 해당 메뉴에서 실시간으로 수정할 수 있습니다. (Chapter 11 · Onboarding Complete)",
        answer_en: "Once all 7 steps are complete, the '7 / 7 Complete (100%)' green badge appears on the dashboard, unlocking standard Brand Portal operations. Even after completion, company details, owners, and product specs can be updated in real time whenever changes occur. (Chapter 11 · Onboarding Complete)",
        kind: "BOTH",
        display_order: 9,
        is_featured: false
      }
    );
  } else if (item.id === "kno-product-management-v10" || item.slug?.includes("product-management") || titleText.includes("상품 등록") || titleText.includes("product registration")) {
    // Grounded FAQ Candidates derived directly from MAN-B-PROD-001 (Product Registration & Management Guide)
    candidatesToCreate.push(
      {
        question_ko: "신규 상품을 등록하려면 어떤 사전 준비가 필요한가요?",
        question_en: "What preparations are needed before registering a new product?",
        answer_ko: "상품을 등록하기 전에 먼저 포털에 등록된 활성(Active) 브랜드가 1개 이상 존재해야 합니다. 브랜드가 없는 경우 브랜드 신규 등록 화면(/portal/brands/new)으로 자동 이동하며, 등록 시 영문 제품명, 자사 제조사 SKU, 바코드(UPC/EAN), 기본 가격 및 패키지 규격을 준비하면 신속하게 등록할 수 있습니다. (Chapter 02 · Phase 1)",
        answer_en: "At least one active brand must be registered in the portal before adding products. If no brand exists, you will be redirected to New Brand (/portal/brands/new). Have your English product name, manufacturer SKU, barcode (UPC/EAN), basic pricing, and package dimensions ready. (Chapter 02 · Phase 1)",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "임시 저장(Draft)과 제품 등록(Complete)의 차이는 무엇인가요?",
        question_en: "What is the difference between Draft and Complete registration?",
        answer_ko: "'임시 저장'은 브랜드, 카테고리, 영문명, 제조사 SKU만 입력하여 보완 대기(Draft) 상태로 저장하는 것이며, '제품 등록 및 계속'은 필수 유효성을 충족한 후 상세 관리 화면(/portal/products/[id])으로 이동하는 방식입니다. 파트너사 온보딩 완수 및 MD 입점 검토를 위해서는 10대 필수 조건이 모두 입력된 등록 완료(COMPLETE) 상태여야 합니다. (Chapter 03 · Draft vs Complete)",
        answer_en: "'Save as Draft' saves basic identifiers into Draft status for later completion, while 'Register & Continue' validates Phase 1 and moves to Product Detail (/portal/products/[id]). Completing onboarding and MD selection reviews requires full 'COMPLETE' status across all 10 criteria. (Chapter 03 · Draft vs Complete)",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      },
      {
        question_ko: "상품 등록 완료(COMPLETE)를 판정하는 10대 필수 조건은 무엇인가요?",
        question_en: "What are the 10 mandatory criteria for Complete registration status?",
        answer_ko: "①소속 활성 브랜드, ②3-Depth 리프 카테고리, ③카테고리 필수 동적 속성(*), ④영문 공식 제품명, ⑤제조사 SKU 코드, ⑥원산지 국가, ⑦2대 필수 가격(한국소비자가 KRW + 수출FOB가 USD), ⑧3단계 물리 규격(단품/패키지/마스터카톤 및 입수량), ⑨식별 바코드(12자리 UPC 또는 13자리 EAN), ⑩대표 상품 이미지(1장 이상)가 모두 입력되어야 합니다. (Chapter 10 · Complete Criteria)",
        answer_en: "①Active Brand, ②3-Depth Leaf Category, ③Mandatory Category Attributes (*), ④English Product Name, ⑤Manufacturer SKU, ⑥Country of Origin, ⑦2 Required Prices (KRW Retail + FOB USD), ⑧3-Tier Physical Specs (Item/Package/Carton + Pack Qty), ⑨Barcode (12-digit UPC or 13-digit EAN), and ⑩At least 1 product image. (Chapter 10 · Complete Criteria)",
        kind: "BOTH",
        display_order: 3,
        is_featured: true
      },
      {
        question_ko: "필수 항목을 입력했는데도 계속 Draft(보완 대기)로 표시되면 어떻게 하나요?",
        question_en: "Why does my product stay in Draft status and how do I fix missing fields?",
        answer_ko: "상품 상세 화면 상단의 로즈색 보완 대기 배너에 표시된 누락 항목 뱃지(예: [FOB 수출 가격 누락], [마스터 카톤 규격 누락])를 클릭하세요. 스마트 자동 포커스 기능이 해당 입력 탭으로 즉시 전환하고 누락된 필드로 스크롤하여 붉은색 테두리로 강조 표시해 줍니다. (Chapter 11 · Autofocus Navigation)",
        answer_en: "Click any missing field badge displayed in the rose-colored Draft banner at the top of the Product Detail screen. The interactive autofocus system will automatically switch to the correct tab, scroll directly to the missing input, and highlight it with a red border. (Chapter 11 · Autofocus Navigation)",
        kind: "BOTH",
        display_order: 4,
        is_featured: true
      },
      {
        question_ko: "카테고리 선택 및 동적 속성은 어떻게 입력하나요?",
        question_en: "How do I select categories and enter dynamic attributes?",
        answer_ko: "탭 2(카테고리 & 속성)에서 3단계(대분류 ➔ 중분류 ➔ 소분류 리프) 카테고리를 선택하거나, 스마트 동의어 검색창에 키워드(예: 수분크림, Sunscreen)를 입력하여 즉시 지정합니다. 선택된 카테고리에 따라 피부 타입, 제형, SPF 등 맞춤형 동적 속성 폼이 자동으로 나타나며 붉은 별표(*) 필수 항목을 입력하면 됩니다. (Chapter 05 · Tab 2)",
        answer_en: "In Tab 2 (Category & Attributes), navigate through the 3-Depth hierarchy or use the smart synonym search (e.g., 'Moisturizer', 'Sunscreen') to select the leaf category. Tailored dynamic attribute forms (Skin Type, Formulation, SPF, etc.) load automatically based on your category. (Chapter 05 · Tab 2)",
        kind: "BOTH",
        display_order: 5,
        is_featured: false
      },
      {
        question_ko: "미국 바코드(UPC)와 국제 바코드(EAN) 중 무엇을 입력해야 하나요?",
        question_en: "Should I enter a US UPC barcode or an international EAN barcode?",
        answer_ko: "미국 대형 오프라인 리테일러 입점을 위해서는 숫자 12자리 UPC 바코드 입력을 적극 권장합니다. 현재 UPC가 없는 경우 한국 880 표준을 포함한 숫자 13자리 EAN 바코드를 입력해도 등록 완료(COMPLETE)가 가능합니다. (Chapter 02 & 14 · Barcode Specs)",
        answer_en: "A 12-digit UPC barcode is strongly recommended for US brick-and-mortar retail placement. If you do not currently have a UPC, a standard 13-digit EAN barcode (including Korean 880 barcodes) is accepted for COMPLETE registration. (Chapter 02 & 14 · Barcode Specs)",
        kind: "BOTH",
        display_order: 6,
        is_featured: false
      },
      {
        question_ko: "가격 정보(FOB, 소비자가) 및 수량별 공급가는 어떻게 설정하나요?",
        question_en: "How do I set pricing (FOB, Retail) and tiered rates?",
        answer_ko: "탭 3(가격 정보)에서 한국 소비자가(KRW)와 수출용 FOB 공급가(USD)를 필수로 입력합니다. 시스템이 환율 기반 FOB 마진율(%)과 배수를 실시간 자동 연산하며, 대량 발주에 대응하기 위해 수량 구간별(MOQ Tier) 차등 공급가를 추가로 구성할 수 있습니다. (Chapter 06 · Tab 3)",
        answer_en: "In Tab 3 (Pricing Info), KRW Retail price and FOB Export price (USD) are mandatory. The system calculates real-time FOB margin (%) and multiples based on daily exchange rates. You can also configure quantity-based tiered rates for bulk orders. (Chapter 06 · Tab 3)",
        kind: "BOTH",
        display_order: 7,
        is_featured: false
      },
      {
        question_ko: "로지스틱스 3단계 물리 규격(단품, 패키지, 마스터 카톤)과 CBM은 어떻게 입력하나요?",
        question_en: "How do I enter the 3-tier logistics specifications and calculate CBM?",
        answer_ko: "탭 4(로지스틱스)에서 ①단품 본품 크기/순중량, ②단상자 개별 포장 규격/총중량, ③수출용 마스터 카톤 규격 및 카톤당 입수량을 입력합니다. cm/inch 및 g/kg/lb 단위 입력 시 실시간 자동 환산되며, 카톤 체적(CBM)은 공식에 따라 실시간 자동 계산됩니다. (Chapter 07 · Tab 4)",
        answer_en: "In Tab 4 (Logistics), enter ①Item specs (net dimensions/weight), ②Package specs (unit box dimensions/gross weight), and ③Master Carton dimensions with pack quantity. Units convert bidirectionally (cm/inch, g/kg/lb) and CBM is calculated automatically. (Chapter 07 · Tab 4)",
        kind: "BOTH",
        display_order: 8,
        is_featured: false
      },
      {
        question_ko: "컨테이너 적재 시뮬레이터는 어떻게 활용하나요?",
        question_en: "How does the Container Load Simulator work?",
        answer_ko: "탭 4에 마스터 카톤 규격과 카톤당 입수량을 입력하면, 해상 선적용 20ft 표준(28 CBM), 40ft 표준(58 CBM), 40ft High Cube(68 CBM) 컨테이너별 최대 적재 가능 카톤 수 및 총 제품 수량이 실시간 자동 시뮬레이션되어 표시됩니다. (Chapter 07 · Container Simulator)",
        answer_en: "When you enter master carton dimensions and pack quantity in Tab 4, the system automatically simulates maximum loadable cartons and total unit capacity across 20ft (28 CBM), 40ft (58 CBM), and 40ft HQ (68 CBM) sea containers in real time. (Chapter 07 · Container Simulator)",
        kind: "BOTH",
        display_order: 9,
        is_featured: false
      },
      {
        question_ko: "상품 이미지 등록 요건과 대표 썸네일 변경 방법은 무엇인가요?",
        question_en: "What are the product image requirements and how do I change the thumbnail?",
        answer_ko: "이미지는 최대 10장, 파일당 최대 10MB까지 등록할 수 있으며 JPG, PNG, WEBP 포맷을 지원합니다 (1000×1000 이상 흰색 배경 정방형 권장). 탭 5(미디어)에서 등록된 이미지 카드를 드래그하여 첫 번째(Position 0) 위치에 놓으면 대표 썸네일로 즉시 자동 지정 및 저장됩니다. (Chapter 08 · Tab 5)",
        answer_en: "Upload up to 10 images (max 10MB each, JPG/PNG/WEBP; 1000x1000 white background square recommended). In Tab 5 (Media), drag and drop any image card to the first position (Position 0) to instantly set and save it as the primary thumbnail. (Chapter 08 · Tab 5)",
        kind: "BOTH",
        display_order: 10,
        is_featured: true
      },
      {
        question_ko: "국문 전성분 번역 및 원산지, 리드타임은 어떻게 등록하나요?",
        question_en: "How do I register ingredients translation, country of origin, and lead time?",
        answer_ko: "탭 1(기본 정보)에서 원산지 국가와 출고 리드타임(예: 14일), 용량/중량을 입력합니다. 한글 전성분 텍스트를 입력창에 붙여넣고 '영문 번역' 버튼을 클릭하면 전문 화장품 용어로 실시간 번역되어 영문 전성분 필드에 원클릭으로 자동 적용됩니다. (Chapter 04 · Tab 1)",
        answer_en: "In Tab 1 (Basic Info), enter Country of Origin, Lead Time (e.g., 14 days), and Volume/Weight. Paste Korean ingredients and click 'Translate to English' to perform real-time cosmetic terminology translation and auto-populate English ingredients. (Chapter 04 · Tab 1)",
        kind: "BOTH",
        display_order: 11,
        is_featured: false
      },
      {
        question_ko: "인허가, 상표권 및 인증 서류는 어떻게 업로드하고 버전 관리되나요?",
        question_en: "How are certificates, trademarks, and compliance documents uploaded and versioned?",
        answer_ko: "탭 6(인허가 & 보증서)에서 전성분표, 상표등록증, 시험성적서, 유통 증빙 서류 등을 업로드합니다. 동일 서류 항목에 새로운 파일을 업로드하면 이전 파일이 삭제되지 않고 v1, v2, v3 형태로 과거 버전 이력이 자동 보존됩니다. 미국 MoCRA 등 심층 규제 절차는 MAN-B-REG-001 문서를 참조하세요. (Chapter 09 · Tab 6)",
        answer_en: "In Tab 6 (Certificates), upload ingredient sheets, trademark registrations, test reports, and compliance documents. Uploading updated files automatically preserves past history as v1, v2, v3 versioning without overwriting. Refer to MAN-B-REG-001 for MoCRA compliance details. (Chapter 09 · Tab 6)",
        kind: "BOTH",
        display_order: 12,
        is_featured: false
      },
      {
        question_ko: "상품의 3대 독립 상태(등록, 선정, 판매)는 각각 무엇을 의미하나요?",
        question_en: "What do the 3 independent status dimensions (Registration, Selection, Sales) mean?",
        answer_ko: "①등록 상태(Draft/Complete): 브랜드사가 10대 필수 정보를 입력 완료했는지 나타냄, ②선정 상태(Unreviewed/Under Review/Selected/Info Req/Not Selected): K SELECT MD가 미국 유통 공급 대상 여부를 심사함, ③판매 상태(Preparing/On Sale/Paused/Ended): 통관 및 현지 발주/판매 진행 상태를 나타내며 세 상태는 독립적으로 동작합니다. (Chapter 12 · 3 Status Dimensions)",
        answer_en: "①Registration Status (Draft/Complete): Whether mandatory product data is 100% complete; ②Selection Status (Unreviewed/Under Review/Selected/Info Req): K SELECT MD review for retail placement; ③Sales Status (Preparing/On Sale/Paused/Ended): Logistics, clearance, and retail order execution. (Chapter 12 · 3 Status Dimensions)",
        kind: "BOTH",
        display_order: 13,
        is_featured: false
      },
      {
        question_ko: "상품을 삭제하면 영구 삭제되나요? 복구가 필요한 경우 어떻게 하나요?",
        question_en: "Does deleting a product permanently remove it? How can I request recovery?",
        answer_ko: "상품 삭제 시 물리적 데이터는 삭제되지 않으며 deleted_at 타임스탬프가 기록되어 'Deleted (삭제됨)' 필터 탭으로 안전하게 격리 보관됩니다. SKU 및 과거 주문 이력은 영구 보존되며, 실수로 삭제하여 복구 및 재활성화가 필요한 경우 Help Center 1:1 고객지원으로 문의하시면 운영팀이 처리해 드립니다. (Chapter 13 · Soft Delete)",
        answer_en: "Product deletion performs a soft delete with a deleted_at timestamp, safely moving the product to the 'Deleted' filter tab. SKU and order histories are preserved. If you accidentally deleted an item and need recovery support, contact Help Center 1:1 Support. (Chapter 13 · Soft Delete)",
        kind: "BOTH",
        display_order: 14,
        is_featured: false
      }
    );
  } else if (isInsights) {
    candidatesToCreate.push(
      {
        question_ko: "INSIGHTS Topic Score 기준은 몇 점인가요?",
        question_en: "What is the Topic Score threshold for INSIGHTS?",
        answer_ko: "현재 적용 중인 Topic Score 기준점은 80점 이상입니다. 80점을 통과한 주제만 Daily Insight Candidate로 채택되며, 기준 통과 항목이 없을 경우 당일 초안이 0개인 것도 정상 동작입니다.",
        answer_en: "The current Topic Score threshold is 80+ points. Topics meeting 80+ are selected as Daily Candidates; 0 draft days are normal.",
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      },
      {
        question_ko: "HIGH Risk Claim은 무엇을 확인해야 하나요?",
        question_en: "What verification is required for HIGH Risk claims?",
        answer_ko: "규제(Regulation), 정확한 숫자(%), 금액($), 시장 규모 및 성장률을 포함한 문장은 HIGH Risk로 분류되며, 승인 전 반드시 뒷받침하는 원본 근거(Source / Evidence)를 직접 재확인해야 합니다.",
        answer_en: "Regulations, %, $, and growth rate claims are classified as HIGH Risk requiring mandatory source trace verification before approval.",
        kind: "BOTH",
        display_order: 2,
        is_featured: true
      }
    );
  } else {
    // Generic Grounded Fallback Candidates from Item Content
    const summaryKo = item.summary_ko || item.title_ko || item.title;
    candidatesToCreate.push(
      {
        question_ko: `${item.title_ko || item.title}의 주요 운영 기준은 무엇인가요?`,
        question_en: `What are the core operating standards for ${item.title_en || item.title}?`,
        answer_ko: `${summaryKo}. 상세 절차는 공식 승인된 ${item.current_version} 매뉴얼 문서를 참조해 주시기 바랍니다.`,
        answer_en: `${item.summary_en || summaryKo}. Refer to official ${item.current_version} document.`,
        kind: "BOTH",
        display_order: 1,
        is_featured: true
      }
    );
  }

  // Duplicate Guard Filter
  const createdItems: KnowledgeFaqItem[] = [];

  for (const cand of candidatesToCreate) {
    const isDup = existingFaqs.some(ef =>
      isDuplicateQuestion(ef.question_ko, cand.question_ko) ||
      (cand.question_en && ef.question_en && isDuplicateQuestion(ef.question_en, cand.question_en))
    );

    if (!isDup) {
      const newFaq: KnowledgeFaqItem = {
        id: `faq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        source_knowledge_id: item.id,
        source_version: item.current_version || "v1.0",
        source_title: item.title_ko || item.title,
        question_ko: cand.question_ko,
        question_en: cand.question_en,
        answer_ko: cand.answer_ko,
        answer_en: cand.answer_en,
        audience: item.audience,
        status: "CANDIDATE", // Strictly starts as CANDIDATE
        kind: cand.kind,
        display_order: cand.display_order,
        is_featured: cand.is_featured,
        generated_by: "AI",
        created_at: now,
        updated_at: now
      };

      await saveStoreFaq(newFaq);
      createdItems.push(newFaq);

      await addStoreAuditLog({
        id: `log-faq-gen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        knowledge_id: item.id,
        user_name: userContext?.userId || "Admin (AI Generator)",
        action: "FAQ Candidate Generated",
        previous_value: undefined,
        new_value: { faqId: newFaq.id, question: newFaq.question_ko, status: "CANDIDATE" },
        reason: `Auto-generated FAQ candidate from ${item.title} (${item.current_version})`,
        created_at: now
      });
    }
  }

  return {
    success: true,
    createdCount: createdItems.length,
    items: createdItems,
    message: createdItems.length > 0
      ? `${createdItems.length}개의 신규 FAQ/질문 후보가 생성되었습니다 (검토 대기 상태).`
      : "중복되지 않는 신규 질문 후보가 없습니다 (기존 후보/승인 목록 유지)."
  };
}

/**
 * Approves a FAQ candidate for official distribution.
 */
export async function approveFaqItem(
  faqId: string,
  reviewerName: string = "Admin",
  reviewNote?: string
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const prevStatus = faq.status;

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "APPROVED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reviewNote || faq.review_note,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-appr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Approved",
    previous_value: { status: prevStatus },
    new_value: { status: "APPROVED", faqId, question: faq.question_ko },
    reason: reviewNote || "Admin reviewed and approved FAQ for official distribution.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Rejects a FAQ candidate.
 */
export async function rejectFaqItem(
  faqId: string,
  reviewerName: string = "Admin",
  reviewNote?: string
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const prevStatus = faq.status;

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "REJECTED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reviewNote || faq.review_note,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-rej-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Rejected",
    previous_value: { status: prevStatus },
    new_value: { status: "REJECTED", faqId, question: faq.question_ko },
    reason: reviewNote || "Admin rejected FAQ candidate.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Deactivates an existing approved FAQ.
 */
export async function deactivateFaqItem(
  faqId: string,
  reviewerName: string = "Admin"
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    status: "INACTIVE",
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-deact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Deactivated",
    previous_value: { status: faq.status },
    new_value: { status: "INACTIVE", faqId },
    reason: "Admin deactivated FAQ.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Edits a FAQ item (Human Editing Governance).
 */
export async function editFaqItem(
  faqId: string,
  updates: Partial<KnowledgeFaqItem>,
  editorName: string = "Admin"
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const now = new Date().toISOString();
  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    ...updates,
    id: faq.id,
    source_knowledge_id: updates.source_knowledge_id || faq.source_knowledge_id,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: editorName,
    action: "FAQ Edited",
    previous_value: { question: faq.question_ko, answer: faq.answer_ko, status: faq.status, topic_id: faq.topic_id },
    new_value: { question: updatedFaq.question_ko, answer: updatedFaq.answer_ko, status: updatedFaq.status, topic_id: updatedFaq.topic_id },
    reason: "Admin edited FAQ item.",
    created_at: now
  });

  return updatedFaq;
}

/**
 * Manually creates a new FAQ item linked to an authoritative Published Knowledge item or standalone.
 */
export async function createManualFaqItem(params: {
  source_knowledge_id?: string;
  portal_scope?: "BRAND" | "RETAILER";
  topic_id?: string | null;
  question_ko: string;
  question_en?: string;
  answer_ko: string;
  answer_en?: string;
  audience?: AudienceType[];
  status?: FaqStatus;
  kind?: FaqKind;
  display_order?: number;
  is_featured?: boolean;
  createdBy?: string;
}): Promise<KnowledgeFaqItem> {
  let sourceId = params.source_knowledge_id;
  let sourceTitle = "Direct Admin FAQ";
  let sourceVersion = "v1.0";
  let itemAudience: AudienceType[] = params.portal_scope === "RETAILER" ? ["RETAILER"] : ["BRAND"];

  if (sourceId) {
    const item = await getStoreKnowledgeById(sourceId);
    if (item) {
      sourceTitle = item.title_ko || item.title;
      sourceVersion = item.current_version || "v1.0";
      itemAudience = item.audience;
    }
  } else {
    // Default fallback to knowledge item if any
    const allKnowledge = await getStoreKnowledgeItems();
    const defaultItem = allKnowledge.find(k => k.status === "PUBLISHED");
    if (defaultItem) {
      sourceId = defaultItem.id;
      sourceTitle = defaultItem.title_ko || defaultItem.title;
      sourceVersion = defaultItem.current_version || "v1.0";
    } else {
      sourceId = "kno-brand-policy-v10";
    }
  }

  const now = new Date().toISOString();
  const portalScope = params.portal_scope || (params.audience?.some(a => a.includes("RETAIL")) ? "RETAILER" : "BRAND");

  const newFaq: KnowledgeFaqItem = {
    id: `faq-man-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    portal_scope: portalScope,
    topic_id: params.topic_id || null,
    source_knowledge_id: sourceId!,
    source_version: sourceVersion,
    source_title: sourceTitle,
    question_ko: params.question_ko.trim(),
    question_en: params.question_en?.trim() || "",
    answer_ko: params.answer_ko.trim(),
    answer_en: params.answer_en?.trim() || "",
    audience: params.audience || (portalScope === "RETAILER" ? ["RETAILER", "INTERNAL"] : ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"]),
    status: params.status || "APPROVED",
    kind: params.kind || "BOTH",
    display_order: params.display_order ?? 0,
    is_featured: params.is_featured ?? false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  };

  await saveStoreFaq(newFaq);

  await addStoreAuditLog({
    id: `log-faq-man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: sourceId!,
    user_name: params.createdBy || "Admin",
    action: "Manual FAQ Created",
    previous_value: undefined,
    new_value: { faqId: newFaq.id, question: newFaq.question_ko, portal_scope: portalScope, topic_id: newFaq.topic_id },
    reason: "Admin manually created FAQ.",
    created_at: now
  });

  return newFaq;
}


/**
 * Source Version Governance: Triggers UPDATE_REQUIRED review for linked approved FAQs
 * when a new version of the parent knowledge is published.
 *
 * DO NOT AUTOMATICALLY REWRITE FAQ.
 */
export async function triggerSourceVersionFaqImpact(
  knowledgeId: string,
  newVersion: string,
  triggeredBy: string = "Version Publication Governance"
): Promise<{ impactedCount: number; faqIds: string[] }> {
  const allFaqs = await getStoreFaqs(knowledgeId);
  const approvedFaqs = allFaqs.filter(f => f.status === "APPROVED" && f.source_version !== newVersion);

  const now = new Date().toISOString();
  const impactedIds: string[] = [];

  for (const faq of approvedFaqs) {
    const updated: KnowledgeFaqItem = {
      ...faq,
      status: "UPDATE_REQUIRED",
      review_note: `Source published new version (${newVersion}). Human review required to verify FAQ validity.`,
      updated_at: now
    };
    await saveStoreFaq(updated);
    impactedIds.push(faq.id);

    await addStoreAuditLog({
      id: `log-faq-ver-impact-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      knowledge_id: knowledgeId,
      user_name: triggeredBy,
      action: "FAQ Impact Detected: UPDATE_REQUIRED",
      previous_value: { status: "APPROVED", source_version: faq.source_version },
      new_value: { status: "UPDATE_REQUIRED", latest_source_version: newVersion },
      reason: `Source knowledge updated to ${newVersion}. FAQ flagged for review.`,
      created_at: now
    });
  }

  return { impactedCount: impactedIds.length, faqIds: impactedIds };
}

/**
 * No Update Needed Review: Admin confirms existing FAQ is still accurate despite source version change.
 */
export async function resolveFaqNoUpdateNeeded(
  faqId: string,
  reviewerName: string = "Admin",
  reason: string = "FAQ remains accurate and valid with current source version."
): Promise<KnowledgeFaqItem> {
  const faq = await getStoreFaqById(faqId);
  if (!faq) {
    throw new Error(`FAQ item '${faqId}' not found.`);
  }

  const parentItem = await getStoreKnowledgeById(faq.source_knowledge_id);
  const currentVer = parentItem?.current_version || faq.source_version;
  const now = new Date().toISOString();

  const updatedFaq: KnowledgeFaqItem = {
    ...faq,
    source_version: currentVer,
    status: "APPROVED",
    reviewed_by: reviewerName,
    reviewed_at: now,
    review_note: reason,
    updated_at: now
  };

  await saveStoreFaq(updatedFaq);

  await addStoreAuditLog({
    id: `log-faq-no-update-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    knowledge_id: faq.source_knowledge_id,
    user_name: reviewerName,
    action: "FAQ Review: No Update Needed",
    previous_value: { status: faq.status, source_version: faq.source_version },
    new_value: { status: "APPROVED", source_version: currentVer },
    reason,
    created_at: now
  });

  return updatedFaq;
}

/**
 * Audience-Scoped FAQ Retrieval:
 * Strictly retrieves ONLY Approved, Non-Sensitive FAQs linked to eligible Published Knowledge.
 */
export async function getApprovedFaqsForAudience(
  audience: AudienceType,
  options?: {
    kind?: FaqKind;
    topic_id?: string;
    search?: string;
    limit?: number;
  }
): Promise<KnowledgeFaqItem[]> {
  const allItems = await getStoreKnowledgeItems();
  const eligibleItems = allItems.filter(item => isEligibleForAudience(item, audience));

  if (eligibleItems.length === 0) {
    return []; // Strict zero fabrication
  }

  const eligibleKnowledgeIds = new Set(eligibleItems.map(i => i.id));
  const allFaqs = await getStoreFaqs();

  let filtered = allFaqs.filter(faq => {
    // Rule 1: Must be APPROVED
    if (faq.status !== "APPROVED") return false;

    // Rule 2: Must be linked to an eligible Published Knowledge document
    if (!eligibleKnowledgeIds.has(faq.source_knowledge_id)) return false;

    // Rule 3: Audience matching
    const auds = (faq.audience || []).map(a => a.toUpperCase());
    const target = audience.toUpperCase();

    if (target === "BRAND" && !auds.includes("BRAND")) return false;
    if ((target === "RETAIL" || target === "RETAILER") && (!auds.includes("RETAIL") && !auds.includes("RETAILER"))) return false;
    if (target === "PUBLIC" && !auds.includes("PUBLIC")) return false;

    // Rule 4: Topic filter
    if (options?.topic_id && faq.topic_id !== options.topic_id) return false;

    // Rule 5: Kind filter (FAQ, SUGGESTED_QUESTION, BOTH)
    if (options?.kind) {
      if (options.kind === "FAQ" && faq.kind !== "FAQ" && faq.kind !== "BOTH") return false;
      if (options.kind === "SUGGESTED_QUESTION" && faq.kind !== "SUGGESTED_QUESTION" && faq.kind !== "BOTH") return false;
    }

    return true;
  });

  // Search filter
  if (options?.search) {
    const q = options.search.toLowerCase().trim();
    filtered = filtered.filter(f =>
      f.question_ko.toLowerCase().includes(q) ||
      (f.question_en && f.question_en.toLowerCase().includes(q)) ||
      f.answer_ko.toLowerCase().includes(q) ||
      (f.answer_en && f.answer_en.toLowerCase().includes(q)) ||
      f.source_title.toLowerCase().includes(q)
    );
  }

  // Ordering: is_featured first, then display_order ascending, then created_at descending
  filtered.sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (options?.limit && options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

