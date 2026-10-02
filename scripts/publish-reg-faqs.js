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
    question_ko: "미국 수출(MoCRA)을 위해 K SELECT 포털에 등록해야 하는 핵심 규제 및 인허가 정보는 무엇인가요?",
    question_en: "What core regulatory and compliance data must be registered in the portal for US export (MoCRA)?",
    answer_ko: "미국 화장품 규제 현대화법(MoCRA) 및 바이어 요건 충족을 위해 포털에서 4대 규제 정보를 관리합니다: ①한/미 상표권(KIPO/USPTO) 번호 및 증빙, ②국문 및 국제 표준 영문 전성분(INCI), ③5대 인허가 서류(FDA 등록, 상표권, COA/MSDS 성분인증, 특허, 기타) 및 ④글로벌 식별 바코드(12자리 UPC / 13자리 EAN). (Chapter 01)",
    answer_en: "To comply with US MoCRA and retail standards, manage 4 core compliance pillars in the portal: ①Trademark (KIPO/USPTO) certificates, ②Dual-language INCI ingredients, ③5 Certificate categories (FDA, Trademark, COA/MSDS, Patent, Other), and ④UPC/EAN barcodes. (Chapter 01)",
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
    question_en: "Can I register a brand in the portal without official trademark registration certificates?",
    answer_ko: "네, 가능합니다. K SELECT는 인디 브랜드의 신속한 입점을 위해 상표권 미보유 브랜드의 포털 개설을 전면 허용합니다(Policy 02). 브랜드 등록 화면(/portal/brands/new)에서 KIPO/USPTO 체크박스를 해제한 상태로 개설할 수 있으며, 추후 상표권을 취득하면 브랜드 수정 화면(/portal/brands/[id])에서 언제든지 등록번호와 증빙을 추가할 수 있습니다. (Chapter 02 · Policy 02)",
    answer_en: "Yes. K SELECT fully permits brand registration without official trademarks (Policy 02). Uncheck KIPO/USPTO checkboxes when creating a brand (/portal/brands/new). Once trademarks are issued, update numbers and certificates anytime in Brand Edit (/portal/brands/[id]). (Chapter 02 · Policy 02)",
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
    question_ko: "상품의 전성분 텍스트 입력과 AI 영문 번역기(Ingredients Translator)는 어떻게 사용하나요?",
    question_en: "How do I enter ingredient text and use the real-time AI Ingredients Translator?",
    answer_ko: "상품 상세 화면(/portal/products/[id])의 [기본 정보] 탭(Tab 1)에서 국문 전성분 목록을 붙여넣은 후 [번역하기(Translate)] 버튼을 클릭합니다. AI 번역 엔진이 국제 표준 INCI(International Nomenclature of Cosmetic Ingredients) 명칭으로 실시간 변환해 주며, [리뷰 완료 및 적용]을 클릭하면 영문 전성분 필드에 원클릭으로 자동 입력됩니다. (Chapter 03 · Section 3.2)",
    answer_en: "In Product Detail (/portal/products/[id]) Tab 1 (Basic Info), paste Korean ingredients and click [Translate]. The AI engine translates text into official INCI nomenclature in real time. Click [Apply to Field] to populate the English ingredients field with one click. (Chapter 03 · Section 3.2)",
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
    question_ko: "전성분 텍스트 번역과 성분 인증 서류(COA / MSDS) 업로드는 어떻게 다른가요?",
    question_en: "What is the difference between Ingredient Translation and Ingredient Certificate Upload?",
    answer_ko: "두 기능은 관리 목적과 업로드 위치가 다릅니다. '전성분 텍스트 번역'은 탭 1(기본 정보)에서 상품 라벨 표기용 국문/영문 성분명을 선언하는 기능이며, '성분 인증 서류'는 탭 6(인허가 & 보증서)의 [성분 인증(ingredient_certification)] 카테고리에 공인 시험성적서(COA) 또는 물질안전보건자료(MSDS) PDF/이미지 원본 파일을 보관·증빙하는 기능입니다. (Chapter 03 & 04)",
    answer_en: "These serve different compliance purposes. Ingredient translation (Tab 1) generates dual-language INCI text for product specifications, while Certificate Upload (Tab 6) stores official laboratory test reports (COA) or Material Safety Data Sheets (MSDS) under the ingredient_certification category. (Chapter 03 & 04)",
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
    question_ko: "상품 상세의 [인허가 & 보증서] 탭(Tab 6)에서 제공하는 5대 서류 카테고리는 무엇인가요?",
    question_en: "What are the 5 certificate document categories supported in Tab 6 (Certificates)?",
    answer_ko: "①FDA 등록(fda_registration: 시설등록 FFRM, 제품리스팅 PDRM), ②상표권(trademark: 개별 상품 전용 상표증), ③성분 인증(ingredient_certification: COA 시험성적서, MSDS), ④특허(patent: 용기/제형 특허증), ⑤기타(other: 위생허가증, 자유판매증명서 CFS 등)의 5가지 카테고리로 분류하여 등록합니다. (Chapter 04 · Section 4.1)",
    answer_en: "①FDA Registration (fda_registration: FFRM, PDRM), ②Trademark (trademark), ③Ingredient Certification (ingredient_certification: COA, MSDS), ④Patent (patent), and ⑤Other (other: CFS, sanitary certificates). (Chapter 04 · Section 4.1)",
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
    question_ko: "기존에 등록된 인허가 서류를 갱신하거나 새 파일로 다시 업로드하면 이전 파일은 어떻게 되나요?",
    question_en: "What happens to older versions when I re-upload or update a compliance certificate?",
    answer_ko: "이전 파일은 삭제되지 않고 무손실 버전 관리(Lossless Versioning)에 의해 안전하게 보존됩니다. 동일 서류 카테고리에 새 파일을 등록하면 시스템이 자동으로 version 번호를 증가(v1 -> v2)시키며 최신 파일만 is_current: true로 활성화하고, 과거 버전 이력은 감사(Audit) 목적으로 영구 보존됩니다. (Chapter 04 · Version Control)",
    answer_en: "Previous files are never deleted or overwritten. Uploading an updated document automatically increments the version (v1 -> v2), sets the newest file to is_current: true, and archives prior versions for audit trail preservation. (Chapter 04 · Version Control)",
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
    question_ko: "상품 등록 완료(COMPLETE)를 위한 식별 바코드(UPC / EAN) 규격은 어떻게 되나요?",
    question_en: "What are the exact formatting rules for UPC / EAN barcodes to achieve COMPLETE status?",
    answer_ko: "상품이 최종 등록 완료(COMPLETE) 판정을 받으려면 반드시 글로벌 공인 바코드가 입력되어야 합니다. 미국/북미 표준인 12자리 UPC(/^\\d{12}$/) 또는 한국/유럽/글로벌 표준인 13자리 EAN(/^\\d{13}$/) 숫자 규격만 유효하며, 자릿수가 맞지 않거나 문자가 포함되면 등록 판정기가 Draft(보완 대기) 상태로 유지합니다. (Chapter 05 · Section 5.1)",
    answer_en: "Complete product registration requires a valid global barcode. Only exact 12-digit UPC (/^\\d{12}$/) or 13-digit EAN (/^\\d{13}$/) numeric formats are accepted. Invalid lengths or non-numeric characters will hold the product in Draft status. (Chapter 05 · Section 5.1)",
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
    question_ko: "바코드(UPC/EAN)가 아직 발급되지 않은 신규 상품은 어떻게 등록하나요?",
    question_en: "How do I register a new product if barcodes (UPC/EAN) are not yet issued?",
    answer_ko: "상품 등록/수정 화면의 바코드 입력창 우측에 위치한 [새 바코드 문의] 파란색 링크를 클릭하십시오. GS1 공인 바코드 신규 발급 지원 또는 미국 수출용 임시 식별 코드 부여와 관련하여 헬프센터 1:1 고객지원으로 즉시 연결되어 전문 상담을 받으실 수 있습니다. (Chapter 05 · Section 5.3)",
    answer_en: "Click the blue [Inquire Barcode] link located to the right of the barcode input field. This connects directly to Help Center 1:1 Support for assistance with GS1 barcode issuance or temporary identification codes. (Chapter 05 · Section 5.3)",
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
    question_ko: "업로드 가능한 증빙 서류의 파일 형식 및 최대 용량 제한은 어떻게 되나요?",
    question_en: "What are the allowed file types and file size limits for uploading compliance documents?",
    answer_ko: "상표등록증, 시험성적서, 전성분표, FDA 서류 등 모든 규제 증빙 문서는 PDF, JPG, PNG, WEBP 형식을 지원하며, 파일당 최대 용량은 10MB입니다. 고해상도 스캔 문서는 10MB 이하로 최적화하여 업로드해 주시기 바랍니다. (Chapter 02 & 04)",
    answer_en: "Regulatory documents (trademarks, COA, FDA certificates) support PDF, JPG, PNG, and WEBP formats up to 10MB per file. Please optimize high-resolution scans below 10MB before uploading. (Chapter 02 & 04)",
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
    question_ko: "브랜드가 제출한 인허가 서류는 어드민(Admin)에서 어떻게 검증되나요?",
    question_en: "How are submitted regulatory certificates inspected and verified by Admin?",
    answer_ko: "브랜드사가 업로드한 모든 상표권 및 인허가 서류는 K SELECT 운영팀의 어드민 상세 화면(/admin/brands/[brandId] 및 /admin/products/[id])에서 실시간으로 대조 심사됩니다. 어드민 심사관이 서류 원본을 열람하여 성분 일치성, 유효기간, 발급 기관을 확인한 후 수출 승인을 진행합니다. (Chapter 06 · Section 6.1)",
    answer_en: "All submitted documents are reviewed in real time on Admin detail pages (/admin/brands/[brandId] and /admin/products/[id]). Specialists verify ingredient consistency, expiration dates, and issuing authorities before clearing products for export. (Chapter 06 · Section 6.1)",
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
    question_ko: "규제 서류나 성분 정보를 수정한 내역은 어디서 확인할 수 있나요?",
    question_en: "Where can I check the audit log for modified compliance documents and ingredients?",
    answer_ko: "상품 상세 화면의 [감사 변경 이력] 탭(Tab 7)에서 확인하실 수 있습니다. 서류 추가/교체, 국문/영문 전성분 수정, 바코드 갱신 등의 모든 작업은 작업자 ID, 변경 일시, 변경 전/후 데이터 차이(Diff)가 포함된 불변 감사 로그(product_change_history)로 영구 기록됩니다. (Chapter 06 · Section 6.2)",
    answer_en: "Audit history is tracked on the [Audit Log] Tab (Tab 7) of the Product Detail screen. Certificate changes, ingredient edits, and barcode updates are permanently recorded with timestamps, user IDs, and before/after diffs (product_change_history). (Chapter 06 · Section 6.2)",
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
    question_ko: "미국 MoCRA 규제 대응이나 FDA 시설 등록과 관련하여 전담 상담을 받으려면 어떻게 하나요?",
    question_en: "How do I request specialized consulting for US MoCRA compliance and FDA facility registrations?",
    answer_ko: "포털 좌측 하단의 [Help Center -> 1:1 Inquiry] 메뉴를 통해 전담 규제 담당자(Regulatory Specialist)에게 문의를 접수하실 수 있습니다. 미국 대리인(US Agent) 지정, FDA 시설 등록(FFRM) 대행, 성분 안전성 평가서 작성 등 심층 규제 상담을 신속하게 지원해 드립니다. (Chapter 06 · Appendix)",
    answer_en: "Submit a ticket via [Help Center -> 1:1 Inquiry] to connect with a Regulatory Specialist. We provide dedicated support for US Agent appointments, FDA facility registrations (FFRM), and cosmetic safety assessments. (Chapter 06 · Appendix)",
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
