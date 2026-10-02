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

const ordFaqs = [
  {
    id: "faq-ord-01",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "발주 요청(PO Request)과 정식 발주서(Official Purchase Order)는 어떻게 다른가요?",
    question_en: "What is the difference between a Purchase Order Request and an Official Purchase Order?",
    answer_ko: "K SELECT 오더 시스템은 2-Phase 아키텍처로 운영됩니다. ①발주 요청(/portal/orders/requests)은 리테일러/바이어가 상품 구매 의사를 타진하는 사전 조율 단계이며, ②정식 발주서(/portal/orders/purchase-orders)는 승인된 요청에 대해 관리자가 정식 발주 번호(PO-YYYYMMDD-XXXX)를 부여하여 발행하는 법적 구속력을 갖는 정식 납품 계약입니다. (Chapter 01 & 02)",
    answer_en: "K SELECT operates a 2-Phase Order Architecture: ①PO Requests (/portal/orders/requests) are preliminary buyer purchase proposals, and ②Official Purchase Orders (/portal/orders/purchase-orders) are legally binding fulfillment contracts issued by Admin with formal PO numbers (PO-YYYYMMDD-XXXX). (Chapter 01 & 02)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 1,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-02",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "바이어의 발주 요청(PO Request)을 승인하거나 거절하려면 어떻게 해야 하나요?",
    question_en: "How do I approve or reject a Retailer Purchase Order Request?",
    answer_ko: "발주 요청 상세 화면(/portal/orders/requests/[id])에서 품목, 희망 수량, 제안 납기일, 단가를 확인한 후 우측 상단의 [요청 승인(Approve)] 또는 [요청 거절(Reject)] 버튼을 클릭합니다. 거절 시에는 바이어에게 전달될 구체적인 사유(재고 부족, 생산 일정 불가 등)를 필수로 입력해야 합니다. (Chapter 02 · Section 2.2)",
    answer_en: "In the PO Request Detail screen (/portal/orders/requests/[id]), review items, requested quantity, proposed delivery date, and unit price, then click [Approve] or [Reject]. If rejecting, entering a specific reason (e.g., out of stock, production lead time mismatch) is mandatory. (Chapter 02 · Section 2.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 2,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-03",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "발주 요청(PO Request)을 한 번 승인하거나 거절한 후 상태를 다시 변경할 수 있나요?",
    question_en: "Can I revert or change the status of a PO Request after approving or rejecting it?",
    answer_ko: "아니요. 상태 불변(State Immutability) 원칙에 따라 발주 요청은 승인(APPROVED) 또는 거절(REJECTED) 처리되는 즉시 상태가 영구 동결(Frozen)되며 되돌릴 수 없습니다. 검토 시 생산 일정 및 재고 수량을 면밀히 확인한 후 신중하게 결정해 주시기 바랍니다. (Chapter 02 · Status Immutability)",
    answer_en: "No. Under the State Immutability rule, once a PO Request is Approved (APPROVED) or Rejected (REJECTED), its status is permanently frozen and cannot be reverted. Please verify production schedules and stock availability thoroughly before confirming. (Chapter 02 · Status Immutability)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 3,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-04",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "발주 요청을 승인하면 즉시 제품 생산 및 출고를 진행해야 하나요?",
    question_en: "Should I start production and shipping immediately after approving a PO Request?",
    answer_ko: "아닙니다. 발주 요청 승인(APPROVED)은 구매 의사 수락 단계이며, 즉시 생산을 시작하는 것이 아닙니다. 관리자(Admin)가 승인된 요청을 검토하여 정식 발주서(Official PO)를 발행하고 포털에 PO Sent 상태로 도달한 후, 공급자 주문 확정(Confirm PO)을 완료한 시점부터 본격적인 생산 공정을 진행합니다. (Chapter 02 & 03)",
    answer_en: "No. Approving a PO Request only confirms acceptance of buyer intent. Production begins after Admin issues an Official PO, reaches PO Sent status in the portal, and the brand completes Supplier Confirmation (Confirm PO). (Chapter 02 & 03)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 4,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-05",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "정식 발주서(Official PO)의 6단계 라이프사이클은 어떻게 진행되나요?",
    question_en: "What is the 6-step lifecycle of an Official Purchase Order?",
    answer_ko: "정식 발주서는 ①발주서 발행(PO Sent / ISSUED) → ②공급자 주문 확정(Supplier Confirmed) → ③생산 중(In Production) → ④출고 준비(Ready to Ship / Goods Ready) → ⑤배송 중(Shipped / In Transit) → ⑥입고/오더 완료(Completed)의 6단계 표준 라이프사이클을 거칩니다. (Chapter 03 · 6-Step Stepper)",
    answer_en: "Official POs progress through a 6-step lifecycle: ①PO Sent (ISSUED) → ②Supplier Confirmed → ③In Production → ④Ready to Ship (Goods Ready) → ⑤Shipped (In Transit) → ⑥Completed (Fulfillment Closed). (Chapter 03 · 6-Step Stepper)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 5,
    is_featured: true,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-06",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "발주서의 수량, 단가, 납기일에 변경이 필요한 경우 어떻게 처리하나요?",
    question_en: "How do I request adjustments if order quantities, pricing, or dates need revision?",
    answer_ko: "발주서 상세(/portal/orders/purchase-orders/[id])의 [Overview] 탭에서 수량 및 납기일을 확인하고, 이견이 있는 경우 [수정 요청(Request Change)]을 통해 변경 희망 사항을 입력하거나 Help Center 1:1 지원 문의로 전담 매니저에게 통보하여 발주서 정정(PO Revision) 절차를 진행할 수 있습니다. (Chapter 03 · Section 3.2)",
    answer_en: "On the PO Detail Overview tab (/portal/orders/purchase-orders/[id]), review quantities and dates. If adjustments are required, click [Request Change] or submit a ticket via Help Center 1:1 Support to request a formal PO Revision with your account manager. (Chapter 03 · Section 3.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 6,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-07",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "공급자 발주서 확정(Confirm PO)을 완료하면 정산(Finance) 인보이스는 언제 발행할 수 있나요?",
    question_en: "When can I create a Supplier Invoice in Finance after confirming an order?",
    answer_ko: "po_status IN ('APPROVED', 'SENT') 및 supplier_confirmation_status = 'CONFIRMED' 조건을 충족하고 기존에 유효한(non-VOID/non-REJECTED) 공급사 인보이스가 존재하지 않는 경우, 재무 도메인(/portal/finance/invoices)에서 해당 PO에 대한 공급사 인보이스(Supplier Invoice) 생성 자격이 활성화됩니다. 상세 인보이스 작성 및 AP 승인 절차는 MAN-B-FIN-001을 참조하세요. (Chapter 06 · Finance Handoff)",
    answer_en: "When po_status IN ('APPROVED', 'SENT') and supplier_confirmation_status = 'CONFIRMED' are met with no active (non-VOID/non-REJECTED) invoice already existing, the PO becomes eligible for Supplier Invoice creation in Finance (/portal/finance/invoices). Refer to MAN-B-FIN-001 for invoice filing. (Chapter 06 · Finance Handoff)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 7,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-08",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "제품 생산 완료 후 물류 출고 준비(Goods Ready)는 어떻게 통보하나요?",
    question_en: "How do I notify the team when products are finished and ready for shipment (Goods Ready)?",
    answer_ko: "생산이 완료되고 마스터 카톤 패킹 및 라벨링이 준비되면, 발주서 상세의 [Goods Ready] 버튼을 클릭하여 실제 생산 완료 수량, 패킹 카톤 수, 포워더 인계 가능 일자(Ready Date)를 입력하고 제출합니다. 상태는 자동으로 Step 4(Ready to Ship)로 전환됩니다. (Chapter 04 · Goods Ready)",
    answer_en: "When production and carton labeling are complete, click [Goods Ready] in the PO Detail to submit ready quantities, total carton count, and ready date. The PO automatically transitions to Step 4 (Ready to Ship). (Chapter 04 · Goods Ready)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 8,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-09",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "화물 배송(Step 5: Shipped) 단계에서 등록해야 하는 필수 물류 정보는 무엇인가요?",
    question_en: "What mandatory logistics tracking information is required at Step 5 (Shipped)?",
    answer_ko: "지정 3PL 운송사 또는 포워더에 화물을 인계한 후, 선하증권(B/L) 번호, 택배 송장번호(Tracking Number), 배송 업체명, 출고 일시를 등록해야 합니다. 등록된 운송장 정보는 바이어 및 운영팀에 실시간 공유되어 입고 스케줄링에 활용됩니다. (Chapter 04 · Section 4.2)",
    answer_en: "After handing cargo over to the 3PL carrier or forwarder, enter the B/L number, tracking number, carrier name, and departure date. This tracking data is synced in real time for warehouse receiving scheduling. (Chapter 04 · Section 4.2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 9,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-10",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "오더 라이프사이클의 마지막 단계인 'COMPLETED(입고/오더 완료)'는 판매대금 지급(정산)을 의미하나요?",
    question_en: "Does the final lifecycle status 'COMPLETED' mean payment settlement?",
    answer_ko: "아닙니다. COMPLETED는 미국 현지 물류센터(Fulfillment Center)에 화물이 실물 도착하여 입고 검수(Receiving Inspection)를 정상 통과하고 '물류센터 검수 완료 및 오더 이행 최종 종결(Order Fulfillment Completed)'되었음을 의미합니다. 판매대금 지급 및 정산(PAID)은 재무 도메인(MAN-B-FIN-001)에서 독립적으로 처리되며 오더 이행 종결과 정산 완료는 분리되어 있습니다. (Chapter 05 · Completed Definition)",
    answer_en: "No. COMPLETED means cargo arrived at the US fulfillment center, passed receiving inspection, and order fulfillment is formally closed. Payment remittance and settlement (PAID) are managed independently in the Finance domain (MAN-B-FIN-001). (Chapter 05 · Completed Definition)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 10,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-11",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "물류 배송(LOG)과 대금 정산(FIN)은 순차적으로 종속되어 진행되나요?",
    question_en: "Are Logistics (LOG) and Finance (FIN) sequentially dependent workflows?",
    answer_ko: "아닙니다. 공식 발주서가 확정(Confirm PO)되면 물류(출고/선적) 트랙과 재무(인보이스/정산) 트랙은 각각 독립된 병렬(Parallel) 구조로 운영됩니다. 선적이나 입고 완료 여부와 무관하게 계약 조건에 따라 인보이스 심사 및 지급 절차가 별도 일정으로 진행됩니다. (Chapter 01 · Parallel Domains)",
    answer_en: "No. Once an Official PO is confirmed (Confirm PO), Logistics (fulfillment/shipping) and Finance (invoice/settlement) operate as independent parallel tracks. Invoicing and payout schedules follow financial contract terms separately from shipping milestones. (Chapter 01 · Parallel Domains)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 11,
    is_featured: false,
    generated_by: "MANUAL"
  },
  {
    id: "faq-ord-12",
    portal_scope: "BRAND",
    topic_id: "topic-orders",
    source_knowledge_id: "kno-order-management-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)",
    question_ko: "발주서 PDF, 패킹리스트, 상업송장 등 무역 서류는 어디서 다운로드할 수 있나요?",
    question_en: "Where can I download Official PO PDFs, Packing Lists, and Commercial Invoices?",
    answer_ko: "발주서 상세 화면(/portal/orders/purchase-orders/[id])의 [무역 서류 보관함(Documents)] 탭에서 공식 발주서(Official PO PDF), 패킹리스트(Packing List), 상업송장(Commercial Invoice), 운송장 라벨 및 물류센터 검수 성적서를 언제든지 원클릭으로 다운로드할 수 있습니다. (Chapter 06 · Document Hub)",
    answer_en: "Navigate to the [Documents] tab in the PO Detail screen (/portal/orders/purchase-orders/[id]) to download the Official PO PDF, Packing List, Commercial Invoice, Shipping Labels, and Warehouse Inspection Reports with one click. (Chapter 06 · Document Hub)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 12,
    is_featured: false,
    generated_by: "MANUAL"
  }
];

async function publish() {
  console.log(`=== Publishing ${ordFaqs.length} Grounded Order Management FAQs ===\n`);

  for (const faq of ordFaqs) {
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
      console.log(`✓ Upserted ${faq.id} (${faq.question_ko})`);
    }
  }

  // Verification
  const { data: allFaqs } = await admin
    .from('knowledge_faqs')
    .select('id, portal_scope, topic_id, source_knowledge_id, question_ko, status, display_order, is_featured')
    .order('id');

  console.log('\n=== DB Knowledge FAQs Verification ===');
  console.log(`Total FAQs in DB: ${allFaqs?.length}`);
  const ordCount = allFaqs?.filter(f => f.source_knowledge_id === 'kno-order-management-v10').length;
  console.log(`ORD FAQs in DB: ${ordCount} / 12`);
}

publish().catch(console.error);
