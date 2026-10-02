const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
const envText = fs.readFileSync(envPath, 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

const regFaqs = [
  {
    id: "faq-reg-01",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "미국 수출(MoCRA) 및 규제 대응을 위해 K SELECT 포털에서 관리하는 주요 인허가 영역은 무엇인가요?",
    question_en: "What core regulatory and compliance areas are managed in the K SELECT portal for US export (MoCRA)?",
    answer_ko: "포털 시스템에서 4대 인허가 영역을 관리합니다: ①브랜드 상표권(대한민국 KIPO 및 미국 USPTO 등록 정보·증빙 파일), ②전성분표(국문/영문 텍스트 선언 및 AI 영문 INCI 번역), ③인증 보증서(FDA 등록, 상표권, 성분 인증, 특허, 기타 5대 카테고리 서류 및 버전 관리), ④상품 식별 바코드(12자리 UPC 및 13자리 EAN 규격 검증). (MAN-B-REG-001 Chapter 01)",
    answer_en: "The portal manages 4 core compliance pillars: ①Brand Trademarks (KIPO and USPTO registration data/files), ②Ingredients (Dual-language text and AI INCI translation), ③Certificates (5 categories: FDA, Trademark, Ingredient, Patent, Other with version control), and ④Product Barcodes (12-digit UPC and 13-digit EAN validation). (MAN-B-REG-001 Chapter 01)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 1,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-02",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "상표권(특허청 등록증)이 아직 없는 신규 브랜드도 포털에 등록할 수 있나요?",
    question_en: "Can a brand without official trademark registrations be registered in the portal?",
    answer_ko: "네, 가능합니다. 포털 내 브랜드 등록 시 특허청 상표권 등록이 필수 전제 조건은 아닙니다(Policy 02). 브랜드 신규 등록 화면(/portal/brands/new)에서 KIPO/USPTO 체크박스를 해제한 상태로 브랜드를 등록할 수 있으며, 향후 상표권을 취득하면 브랜드 수정 화면(/portal/brands/[id])에서 등록번호와 증빙 서류를 추가할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Policy 02)",
    answer_en: "Yes. Trademark registration is not a mandatory prerequisite for creating a brand in the portal (Policy 02). You can register a brand in the New Brand screen (/portal/brands/new) with the KIPO/USPTO checkboxes unchecked. Once trademarks are issued, you can add registration numbers and certificates in the Brand Edit screen (/portal/brands/[id]). (MAN-B-REG-001 Chapter 02 · Policy 02)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 2,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-03",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "브랜드 상표권(KIPO / USPTO) 등록 및 증빙 서류는 어떻게 첨부하고 수정하나요?",
    question_en: "How do I enter KIPO and USPTO trademark data and manage certificate files?",
    answer_ko: "브랜드 등록(/portal/brands/new) 또는 수정(/portal/brands/[id]) 화면에서 대한민국 특허청(KIPO) 및 미국 특허청(USPTO) 상표권 보유 여부를 각각 체크합니다. 상표권을 보유한 경우 체크 후 상표 등록번호를 입력하고 증빙 파일(PDF/이미지)을 첨부합니다. 이미 등록된 브랜드의 경우 [보기] 링크를 통해 기존 서류를 확인하거나 삭제 및 새 파일로 교체할 수 있습니다. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)",
    answer_en: "In the Brand Registration (/portal/brands/new) or Brand Edit (/portal/brands/[id]) screen, check the KIPO or USPTO boxes independently. Enter the official registration number and attach the certificate file (PDF/image). For existing brands, click [View] to inspect the uploaded document, delete it, or replace it with a new file. (MAN-B-REG-001 Chapter 02 · Section 2.2 & 2.3)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 3,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-04",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "상품의 국문 전성분 입력과 AI 기반 영문 INCI 번역 기능은 어떻게 사용하나요?",
    question_en: "How do I enter Korean ingredients and use the AI-based English INCI translation tool?",
    answer_ko: "상품 상세 페이지(/portal/products/[id])의 [기본 정보] 탭(Tab 1) 내 전성분 영역에서 국문 전성분 텍스트를 입력한 후 [번역하기(Translate)] 버튼을 누릅니다. 시스템이 화장품 국제 표준 INCI(International Nomenclature of Cosmetic Ingredients) 명칭으로 자동 변환하며, 프리뷰 확인 후 [리뷰 완료 및 적용(Apply to field)] 버튼을 클릭하면 영문 전성분 필드에 자동 입력됩니다. (MAN-B-REG-001 Chapter 03 · Section 3.2)",
    answer_en: "In Product Detail (/portal/products/[id]) Tab 1 (Basic Info), enter Korean ingredients in the ingredients field and click [Translate]. The system converts them into standard INCI nomenclature. Review the preview and click [Apply to field] to automatically populate the English ingredients field. (MAN-B-REG-001 Chapter 03 · Section 3.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 4,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-05",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "AI 전성분 번역 도구(Tab 1)와 성분 인증 서류 업로드(Tab 6)는 어떻게 구분되나요?",
    question_en: "What is the boundary between the AI Ingredients Translator (Tab 1) and Ingredient Certificate Upload (Tab 6)?",
    answer_ko: "두 기능은 시스템상 엄격히 분리된 워크플로우입니다. Tab 1의 'AI 전성분 번역'은 상품 기본 정보에 라벨 표기용 국문/영문 INCI 텍스트를 선언하는 기능이며, Tab 6의 서류 업로드를 대체하지 않습니다. 전성분 분석표, MSDS(물질안전보건자료), COA(시험성적서) 등 성분 관련 증빙 파일은 [인허가 & 보증서] 탭(Tab 6)의 [성분 인증(`ingredient_certification`)] 또는 [기타(`other`)] 카테고리를 통해 별도로 업로드해야 합니다. (MAN-B-REG-001 Chapter 03 & 04)",
    answer_en: "These are strictly separated workflows in the portal. AI Translation (Tab 1) declares dual-language INCI text for basic product specifications and does not replace document uploads. Supporting files such as ingredient analyses, MSDS, or COA must be uploaded separately via the [Ingredient Certification (`ingredient_certification`)] or [Other (`other`)] category in Tab 6 (Certificates). (MAN-B-REG-001 Chapter 03 & 04)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 5,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-06",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "상품 상세 [인허가 & 보증서] 탭(Tab 6)에서 등록할 수 있는 5대 서류 카테고리는 무엇인가요?",
    question_en: "What are the 5 certificate categories supported in Product Detail Tab 6 (Certificates)?",
    answer_ko: "Tab 6에서 다음 5가지 서류 카테고리를 지원합니다: ①`fda_registration` (FDA 등록: 시설 등록 FFRM, 제품 리스팅 PDRM 증빙), ②`trademark` (상표권: 특정 상품 전용 상표 등록 서류), ③`ingredient_certification` (성분 인증: 전성분 분석표, MSDS, COA 등), ④`patent` (특허: 용기 구조, 성분 추출 기술 특허증), ⑤`other` (기타: 위생 허가증, 자유판매증명서 CFS 등). (MAN-B-REG-001 Chapter 04 · Section 4.1)",
    answer_en: "Tab 6 supports 5 categories: ①`fda_registration` (FDA registration: FFRM and PDRM proofs), ②`trademark` (product trademarks), ③`ingredient_certification` (ingredient analyses, MSDS, COA), ④`patent` (patents, utility models), and ⑤`other` (sanitary certificates, CFS, and other guarantees). (MAN-B-REG-001 Chapter 04 · Section 4.1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 6,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-07",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "기존에 등록된 인허가 서류를 갱신하거나 새 파일로 다시 업로드하면 어떻게 처리되나요?",
    question_en: "How are renewed certificate files processed when uploaded for an existing document type?",
    answer_ko: "동일한 서류 카테고리에 새 파일을 등록하면, 시스템이 자동으로 버전(Version) 번호를 `+1` 증가(예: Version 1 -> Version 2)시키며 최신 서류(`is_current: true`)로 지정합니다. 이전 업로드 파일은 `is_current: false` 상태로 자동 변경되어 서류 이력으로 보존됩니다. (MAN-B-REG-001 Chapter 04 · Section 4.2)",
    answer_en: "When a new file is uploaded under the same certificate category, the system automatically increments the version number by `+1` (e.g., Version 1 -> Version 2) and designates it as active (`is_current: true`). The previously uploaded file is automatically changed to `is_current: false` and retained as history. (MAN-B-REG-001 Chapter 04 · Section 4.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 7,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-08",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "상품 등록 완료(COMPLETE)를 위한 바코드(UPC / EAN) 규격과 검증 규칙은 무엇인가요?",
    question_en: "What are the barcode standards (UPC / EAN) and validation rules to achieve COMPLETE product status?",
    answer_ko: "상품이 최종 `COMPLETE (등록 완료)` 상태로 전환되기 위해서는 식별 바코드가 필수적으로 검증되어야 합니다. 북미 표준인 12자리 UPC(`/^\\d{12}$/`) 또는 국제 표준인 13자리 EAN(`/^\\d{13}$/`) 숫자 규격만 유효합니다. 자릿수 오류나 숫자가 아닌 문자가 포함된 경우 등록 평가기(Registration Evaluator)에 의해 `Draft (보완 대기)` 상태로 유지됩니다. (MAN-B-REG-001 Chapter 05 · Section 5.1)",
    answer_en: "Product status can only advance to `COMPLETE` with a validated barcode. Exactly 12-digit numeric UPC (`/^\d{12}$/`) or 13-digit numeric EAN (`/^\d{13}$/`) is required. Invalid lengths or non-numeric characters will hold the product in `Draft` status. (MAN-B-REG-001 Chapter 05 · Section 5.1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 8,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-09",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "바코드(UPC/EAN) 유효성 검증과 규제/인허가 승인은 동일한 절차인가요?",
    question_en: "Is barcode (UPC/EAN) validation the same procedure as regulatory and compliance approval?",
    answer_ko: "아닙니다. 바코드 입력은 물류 식별(WMS) 및 리테일 POS 스캔을 위한 상품 식별 번호 검증 절차이며, FDA 등록이나 법적 인허가 승인을 대신하지 않습니다. 바코드 검증과 규제 서류 승인은 독립된 영역이므로 규제 요건 충족을 위해서는 Tab 6([인허가 & 보증서])에 필요한 인증 서류를 별도로 등록해야 합니다. (MAN-B-REG-001 Chapter 01 & Chapter 05)",
    answer_en: "No. Barcode entry validates product identification for warehouse WMS and retail POS scanning, and does not substitute for FDA registrations or legal compliance approvals. Barcode validation and regulatory document approval are distinct; compliance requirements must be met by uploading required certificates in Tab 6. (MAN-B-REG-001 Chapter 01 & Chapter 05)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 9,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-10",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "바코드(UPC/EAN)가 아직 발급되지 않은 신규 상품은 어떻게 지원받을 수 있나요?",
    question_en: "How can I request support if a barcode (UPC/EAN) has not yet been issued for a new product?",
    answer_ko: "상품 등록/수정 화면의 바코드 입력란 우측에 위치한 [💬 바코드 문의] 링크를 클릭하여 지원을 요청할 수 있습니다. 바코드 신규 발급 또는 식별 관리와 관련하여 헬프센터 1:1 지원 채널을 통해 안내를 받으실 수 있습니다. (MAN-B-REG-001 Chapter 05 · Section 5.1 & 그림 5.1)",
    answer_en: "Click the [💬 Inquire Barcode] link located to the right of the barcode input field. You can request assistance with barcode issuance and product identification through the Help Center 1:1 support channel. (MAN-B-REG-001 Chapter 05 · Section 5.1 & Figure 5.1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 10,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-11",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "브랜드가 등록한 상표권 및 상품 인허가 서류는 어드민(Admin)에서 어떻게 확인되나요?",
    question_en: "How are brand trademarks and product certificate documents viewed and audited by Admin operators?",
    answer_ko: "브랜드사가 등록한 상표권 및 인허가 보증서 파일은 어드민 상세 화면(/admin/brands/[brandId] 및 /admin/products/[id])에서 운영 담당자에게 실시간 동기화됩니다. 어드민 사용자는 [보기] 또는 [다운로드] 버튼을 통해 브랜드사가 제출한 서류 원본을 열람하여 검증할 수 있습니다. (MAN-B-REG-001 Chapter 06 · Section 6.1)",
    answer_en: "Trademarks and certificates registered by brands synchronize in real time to Admin detail screens (/admin/brands/[brandId] and /admin/products/[id]). Admin operators can inspect and verify submitted original documents using the [View] or [Download] buttons. (MAN-B-REG-001 Chapter 06 · Section 6.1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 11,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-reg-12",
    portal_scope: "BRAND",
    topic_id: "topic-regulatory",
    source_knowledge_id: "kno-regulatory-compliance-v11",
    source_version: "v1.1.0",
    source_title: "K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)",
    question_ko: "인허가 서류, 전성분 또는 상표권 정보의 수정 이력은 어디서 감사(Audit)할 수 있나요?",
    question_en: "Where can I audit the modification history for certificates, ingredients, or trademarks?",
    answer_ko: "브랜드사 또는 어드민이 전성분, 상표권, 인허가 보증서 파일을 수정·추가·삭제하면 시스템 변경 감사 모듈(`product_change_history`)에 변경 내역이 기록됩니다. 이를 통해 변경 일시와 내역을 투명하게 추적할 수 있으며, 어드민과 브랜드 포털 간 실시간 데이터 갱신이 수행됩니다. (MAN-B-REG-001 Chapter 06 · Section 6.2)",
    answer_en: "When ingredients, trademarks, or certificates are modified, added, or deleted by brands or admins, change records are captured in the system change audit module (`product_change_history`). This allows transparent tracking of modification timestamps and details with real-time synchronization between Admin and Brand Portal. (MAN-B-REG-001 Chapter 06 · Section 6.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 12,
    is_featured: false,
    generated_by: "MANUAL"
  }
];

async function publish() {
  console.log(`=== Publishing ${regFaqs.length} Grounded Regulatory FAQs ===\n`);

  for (const faq of regFaqs) {
    const { data, error } = await admin
      .from('knowledge_faqs')
      .upsert({
        ...faq,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`❌ Error upserting ${faq.id}:`, error.message);
    } else {
      console.log(`✓ Upserted ${faq.id} (${faq.question_ko.substring(0, 40)}...)`);
    }
  }

  // Verification
  const { data: allFaqs } = await admin
    .from('knowledge_faqs')
    .select('id, portal_scope, topic_id, source_knowledge_id, question_ko, status, display_order, is_featured')
    .order('id');

  console.log('\n=== DB Knowledge FAQs Verification ===');
  console.log(`Total FAQs in DB: ${allFaqs?.length}`);
  const regCount = allFaqs?.filter(f => f.source_knowledge_id === 'kno-regulatory-compliance-v11').length;
  console.log(`REG FAQs in DB: ${regCount} / 12`);
}

publish().catch(console.error);
