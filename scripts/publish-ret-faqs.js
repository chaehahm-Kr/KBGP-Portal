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
const supabase = createClient(supabaseUrl, supabaseSecretKey);

const now = new Date().toISOString();

const retFaqs = [
  {
    id: "faq-ret-01",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "K SELECT Retail Placement(리테일 입점 신청)이란 무엇이며 어떤 절차로 진행되나요?",
    question_en: "What is K SELECT Retail Placement, how do brands apply, and what is the application process?",
    answer_ko: "K SELECT의 입점 신청(Retail Placement Application)은 브랜드 파트너사가 등록된 상품을 선택하여 북미 온·오프라인 리테일 네트워크 유통을 위한 공식 심사를 신청하는 시스템입니다. 전체 프로세스는 `1. 상품 선택(다중 브랜드 지원)` → `2. 6대 프로그램 참여 준비사항 자가진단(Readiness Criteria)` → `3. 신청서 제출 및 MD 실시간 심사` → `4. 승인 및 입점 파트너십 확정` 순서로 진행됩니다. (MAN-B-RET-001 Chapter 01 · Section 1.1)",
    answer_en: "K SELECT Retail Placement Application is a system where brand partners apply with registered products to request official review for distribution across North American retail networks. The process flows through: 1. Product selection (multi-brand supported) -> 2. 6 Readiness Criteria self-assessment -> 3. Submission & real-time MD review -> 4. Approval & placement partnership finalization. (MAN-B-RET-001 Chapter 01 · Section 1.1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 1,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-02",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "입점 신청서를 작성하기 전에 반드시 완료해야 하는 사전 필수 준비사항은 무엇인가요?",
    question_en: "What are the mandatory prerequisites required before creating a retail placement application?",
    answer_ko: "입점 신청서 작성 전 브랜드 포털에서 다음 3가지 항목이 완료되어 있어야 합니다: 1. **브랜드 등록 완료 (`MAN-B-BRAND-001`)**: 계정에 입점 대상 브랜드가 등록 및 승인되어야 합니다. 2. **상품 카탈로그 등록 완료 (`MAN-B-PROD-001`)**: 신청 대상 상품의 기본 정보, 규격, 카테고리가 등록되어 있어야 합니다. 3. **미국 규제 및 MoCRA 대응 확인 (`MAN-B-REG-001`)**: FDA 요건, 전성분(INCI), 식별 바코드(UPC/EAN) 준비 상태를 사전에 확인해야 합니다. (MAN-B-RET-001 Chapter 01 · Section 1.2)",
    answer_en: "Before creating an application, three prerequisites must be completed on the Brand Portal: 1. Brand Registration (`MAN-B-BRAND-001`), 2. Product Catalog Registration (`MAN-B-PROD-001`) with specifications and categories, 3. US Regulatory & MoCRA Compliance Check (`MAN-B-REG-001`) verifying FDA requirements, INCI ingredients, and UPC/EAN barcodes. (MAN-B-RET-001 Chapter 01 · Section 1.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 2,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-03",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "여러 브랜드를 운영하는 경우 브랜드별로 입점 신청서를 따로 작성해야 하나요?",
    question_en: "If managing multiple brands, do I need to create separate applications for each brand?",
    answer_ko: "아닙니다. 동일 회사 계정에 등록된 여러 브랜드의 상품이 제품 선택 영역에 브랜드별로 자동 그룹화되어 표시됩니다. 단일 신청서 안에서 서로 다른 브랜드의 제품을 복수 선택하여 한 번에 입점 심사를 신청할 수 있습니다. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)",
    answer_en: "No. Products from multiple brands registered under the same company account are automatically grouped by brand. You can select products across multiple brands within a single application and submit them together. (MAN-B-RET-001 Chapter 03 · Section 3.1 & Chapter 07 · Q1)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 3,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-04",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "6대 프로그램 참여 준비 사항(Readiness)에서 '협의 필요'를 선택하면 심사에서 불이익이나 탈락 사유가 되나요?",
    question_en: "Does selecting '협의 필요 (Negotiation Needed)' in the 6 Readiness Criteria result in penalties or disqualification?",
    answer_ko: "절대 감점이나 탈락 사유가 되지 않습니다. K SELECT의 확정 정책에 따라 **협의 필요는 탈락 사유가 아니며 MD 팀과의 사전 조율 단계**입니다. 초도 물량, 마케팅 협력, 유통 가격 및 공급 조건 등에 대해 K SELECT MD 심사팀과 상호 협의하여 맞춤형 조건을 도출하기 위한 정상적인 소통 절차입니다. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)",
    answer_en: "Absolutely not. Under K SELECT's established policy, **'협의 필요 (Negotiation Needed)' is not a rejection reason, but an active coordination step with the MD team**. It is a normal collaboration procedure to align on initial quantities, marketing cooperation, distribution pricing, and supply conditions. (MAN-B-RET-001 Chapter 03 · Section 3.2 & Chapter 07 · Q3)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 4,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-05",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "신규 입점 신청서 작성 중 임시저장(Draft)과 최종 제출의 차이는 무엇인가요?",
    question_en: "What is the difference between Draft saving and Final Submission in Retail Applications?",
    answer_ko: "작성 화면 하단의 **[임시저장]**을 클릭하면 선택한 제품과 6대 준비사항 응답이 저장되며 상태가 `임시저장(draft)`으로 유지되어 언제든지 재방문하여 내용을 수정할 수 있습니다. 최소 1개 이상의 제품을 선택한 후 **[신청서 제출]**을 클릭하면 공식 신청번호(예: `APP-20261001-0001`)가 발급되고 상태가 `제출됨(submitted)`으로 변경됩니다. 최종 제출 후에는 브랜드사에서 내용을 직접 수정할 수 없으며 MD 심사 단계로 전환됩니다. (MAN-B-RET-001 Chapter 03 · Section 3.3)",
    answer_en: "Clicking **[임시저장 (Save Draft)]** stores selected products and readiness answers under `draft` status, allowing ongoing edits. After selecting at least one product, clicking **[신청서 제출 (Submit Application)]** generates an official application ID (e.g. `APP-20261001-0001`) and transitions status to `submitted`. Once submitted, direct edits by the brand are locked as it enters MD review. (MAN-B-RET-001 Chapter 03 · Section 3.3)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 5,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-06",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "신청서 제출 후 진행 상태(Status)는 어떻게 구분되며 어떤 의미인가요?",
    question_en: "How are application statuses defined and what do they mean after submission?",
    answer_ko: "신청서는 9가지 상태로 관리됩니다: 1. `draft(임시저장)`: 작성 중, 2. `submitted(제출됨)`: 접수 완료 및 심사 대기, 3. `under_review(심사중)`: MD 심사 진행 중, 4. `info_requested(추가자료요청)`: MD의 추가 자료 요청 상태, 5. `re_review(재검토중)`: 브랜드 추가 자료 회신 후 재심사 대기, 6. `partial_approved(부분승인)`: 일부 제품 승인 완료, 7. `approved(승인됨)`: 전체 제품 승인 완료, 8. `on_hold(보류)`: 심사 일시 보류, 9. `rejected(반려됨)`: 심사 반려. (MAN-B-RET-001 Chapter 02 · Section 2.2)",
    answer_en: "Applications are tracked across 9 statuses: 1. `draft`: in progress, 2. `submitted`: received & waiting review, 3. `under_review`: active MD review, 4. `info_requested`: MD requesting additional info, 5. `re_review`: brand replied & awaiting re-review, 6. `partial_approved`: some products approved, 7. `approved`: all products approved, 8. `on_hold`: review temporarily paused, 9. `rejected`: review rejected. (MAN-B-RET-001 Chapter 02 · Section 2.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 6,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-07",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "신청서에 포함된 여러 제품의 개별 심사 상태와 전체 종합 상태는 어떻게 집계되나요?",
    question_en: "How are individual product review statuses and the aggregated application status calculated?",
    answer_ko: "신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 각 제품마다 독립적으로 `검토대기`, `심사 진행 중`, `보완 요청`, `심사 보류`, `심사 반려`, `심사 승인` 상태와 MD 피드백 사유(`↳ 사유: ...`)가 기록됩니다. 시스템의 자동 상태 집계 엔진(`computeAggregatedStatus`)은 모든 제품이 승인되면 `approved`, 모든 제품이 반려되면 `rejected`, 일부 제품만 승인되면 `partial_approved`, 심사 중인 제품이 남아있으면 `under_review`로 전체 상태를 실시간 산출합니다. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)",
    answer_en: "Each product independently tracks status (`pending`, `under_review`, `info_requested`, `on_hold`, `rejected`, `approved`) with MD feedback reasons. The automated aggregation engine (`computeAggregatedStatus`) computes overall application status in real-time: `approved` if all products approved, `rejected` if all rejected, `partial_approved` if some approved, and `under_review` if any product is actively under review. (MAN-B-RET-001 Chapter 04 · Section 4.1 & 4.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 7,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-08",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "MD 심사역으로부터 추가 자료 요청(Info Request)을 받았을 때 어떻게 확인하고 회신하나요?",
    question_en: "How do I check and reply when receiving an Info Request from the MD review team?",
    answer_ko: "MD가 성분 분석표(COA), 영문 라벨, 상표권 증빙 등 추가 자료를 요청하면 신청서 상세 페이지 상단에 **노란색 긴급 알림 패널**이 활성화되고 회신 기한이 표시됩니다. 패널 내 회신 내용 입력란에 답변을 작성하고 필요 시 **[파일 선택]** 버튼을 통해 증빙 파일(PDF, PNG, JPG, WEBP, CSV, XLSX)을 첨부한 후 **[회신 제출]**을 클릭합니다. 제출 즉시 신청서 상태가 `재검토중(re_review)`으로 자동 전환되어 MD에게 전달됩니다. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)",
    answer_en: "When MDs request additional documents (e.g., COA, English labeling, trademark proof), a yellow alert panel appears at the top of the application detail page with a reply deadline. Type your response in the text area, attach files (PDF, PNG, JPG, WEBP, CSV, XLSX) via **[파일 선택 (Choose File)]**, and click **[회신 제출 (Submit Reply)]**. The status immediately updates to `re_review`. (MAN-B-RET-001 Chapter 05 · Section 5.1 & 5.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 8,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-09",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "신청서 내 일부 제품만 승인되고 일부 제품이 반려/보류된 경우(부분승인) 어떻게 처리되나요?",
    question_en: "What happens if only some products are approved while others are rejected or put on hold (Partial Approval)?",
    answer_ko: "신청서 상태가 `부분승인(partial_approved)`으로 전환됩니다. 승인된 품목에 대해서만 우선적으로 K SELECT 북미 리테일 유통망 입점 및 후속 비즈니스 협의가 진행됩니다. 반려되거나 보류된 품목은 승인된 품목의 입점 진행에 부정적인 영향을 미치지 않으며, 각 품목별 타임라인에서 반려/보류 사유를 개별 확인할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)",
    answer_en: "The overall application status becomes `partial_approved`. Retail placement and subsequent business onboarding proceed for approved products immediately. Rejected or on-hold items do not hinder the progress of approved items, and reasons for each item can be reviewed in their respective timelines. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q4)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 9,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-10",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "입점 신청이 최종 승인(Approved)되면 발주서(PO)나 출고가 자동으로 생성되나요?",
    question_en: "Does Retail Application approval automatically generate a Purchase Order (PO) or shipment?",
    answer_ko: "아닙니다. 입점 신청 승인(Retail Placement Approval)은 해당 상품의 북미 리테일 유통 자격 심사가 완료되었음을 의미하며, 실제 발주서(Purchase Order), 오더 요청(Order Request), 출고(Shipment), 정산(Settlement)이 자동으로 생성되지 않습니다. 실물 발주 및 납품은 `MAN-B-ORD-001` 매뉴얼의 독립적인 오더 관리 절차(브랜드사 발주 요청 또는 본사 공식 PO 발행 및 확인)를 통해 별도로 진행됩니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)",
    answer_en: "No. Retail Placement Approval confirms retailer eligibility and does NOT automatically generate Purchase Orders, Order Requests, Shipments, or Settlements. Actual ordering and physical supply fulfillment proceed separately through the independent order management workflows defined in `MAN-B-ORD-001`. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q7)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 10,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-ret-11",
    portal_scope: "BRAND",
    topic_id: "topic-retail",
    source_knowledge_id: "kno-retail-applications-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 리테일 입점 신청 및 관리 매뉴얼 (MAN-B-RET-001)",
    question_ko: "제품 심사가 반려(Rejected) 또는 보류(On Hold)된 경우 사유를 확인하고 어떻게 대처해야 하나요?",
    question_en: "If a product review is Rejected or On Hold, where can I check the reason and how should I respond?",
    answer_ko: "신청서 상세 페이지의 '제품별 심사 현황' 테이블에서 해당 제품 하단 타임라인의 `↳ 사유: ...` 항목을 통해 MD 심사역이 기재한 공식 피드백을 확인할 수 있습니다. 보류(`on_hold`)된 경우 MD 담당자와 1:1 지원 채널을 통해 추가 협의를 진행할 수 있으며, 반려(`rejected`)된 경우 규제 서류, 성분, 영문 라벨, 바코드 등 미비 사항을 보완하여 향후 신규 신청을 준비할 수 있습니다. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)",
    answer_en: "Official feedback from the MD review team can be checked under each product's timeline row via `↳ 사유: ...`. For items on hold (`on_hold`), you can consult with MDs through support channels. For rejected (`rejected`) items, review the specific reasons (regulatory documents, ingredients, labeling, barcodes) to prepare for future new submissions. (MAN-B-RET-001 Chapter 06 · Section 6.2 & Chapter 07 · Q6)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 11,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  }
];

async function publishFaqs() {
  console.log('====================================================');
  console.log('MAN-B-RET-001 KNOWLEDGE FAQS PRODUCTION PUBLICATION');
  console.log('====================================================\n');

  console.log(`Publishing ${retFaqs.length} RET FAQs to Supabase DB...`);

  for (const faq of retFaqs) {
    const { data, error } = await supabase
      .from('knowledge_faqs')
      .upsert(faq, { onConflict: 'id' })
      .select('id, question_ko, is_featured, display_order');

    if (error) {
      console.error(`Error upserting ${faq.id}:`, error);
      throw error;
    }
    console.log(`✓ [${faq.id}] ${faq.is_featured ? '⭐ [FEATURED]' : '  [STANDARD]'} ${faq.question_ko}`);
  }

  // Count verification
  const { data: allFaqs, error: countErr } = await supabase
    .from('knowledge_faqs')
    .select('id, source_knowledge_id, topic_id');

  if (countErr) throw countErr;

  const retFaqCount = allFaqs.filter(f => f.source_knowledge_id === 'kno-retail-applications-v10').length;
  console.log(`\nDB Total FAQs: ${allFaqs.length}`);
  console.log(`DB RET FAQs:   ${retFaqCount} (Expected: 11)`);

  console.log('\n✓ RET FAQs successfully published to Supabase!');
}

publishFaqs().catch(err => {
  console.error('Publishing failed:', err);
  process.exit(1);
});
