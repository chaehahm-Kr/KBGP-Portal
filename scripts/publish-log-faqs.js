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
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

const now = new Date().toISOString();

const logFaqs = [
  {
    id: "faq-log-01",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "선적 및 출고 관리(Shipping & Logistics) 프로세스는 어떤 단계로 진행되나요?",
    question_en: "How does the Shipping & International Logistics process work across lifecycle stages?",
    answer_ko: "공식 발주 확정(PO Status: APPROVED / SENT 및 supplier_confirmation: CONFIRMED) 완료 후, `1. 출고 준비 등록(Goods Readiness)` → `2. 실측 패킹 스펙(카톤 수, 중량, CBM) 입력 및 2대 무역 서류(P/L, C/I) 첨부` → `3. 운송 책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED)별 배송 이행` → `4. 국제 운송 추적(Inbound Tracking)` → `5. 미국 창고 도크 도착(ARRIVED) 및 실물 입고 검수(Warehouse Receiving)` 순서로 진행됩니다. (MAN-B-LOG-001 Chapter 01 · Section 1.1 & Diagram 1)",
    answer_en: "After formal PO Confirmation, the shipping lifecycle proceeds through: 1. Goods Readiness submission -> 2. Packaging specs (Cartons, Weight, CBM) & Trade Documents (P/L, C/I) upload -> 3. Shipping execution by responsibility track (LETUSTO_ARRANGED vs SUPPLIER_ARRANGED) -> 4. International inbound tracking -> 5. US warehouse arrival (ARRIVED) and physical receiving inspection. (MAN-B-LOG-001 Chapter 01 · Section 1.1 & Diagram 1)",
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
    id: "faq-log-02",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "운송 책임 트랙인 LETUSTO_ARRANGED와 SUPPLIER_ARRANGED의 차이는 무엇인가요?",
    question_en: "What is the difference between LETUSTO_ARRANGED and SUPPLIER_ARRANGED shipping tracks?",
    answer_ko: "무역 조건(Incoterms)에 따라 두 가지 트랙으로 분기됩니다: 1. **LETUSTO_ARRANGED (FOB/FCA 기준)**: 본사 지정 국제 포워더가 공급사 창고로 방문하여 화물을 수거(Pickup)하며, 상차 완료 후 포털 상세 화면에서 `[물품 인계 완료 (Handed Over)]`를 클릭합니다. 2. **SUPPLIER_ARRANGED (DDP/DAP 기준)**: 공급사가 자체 특송/운송사를 통해 미국 물류센터 도크까지 직접 발송하고 배송사(Carrier), 송장/BL 번호, ETD/ETA를 등록합니다. (MAN-B-LOG-001 Chapter 01 · Section 1.2 & Chapter 04)",
    answer_en: "Operations branch based on Incoterms: 1. LETUSTO_ARRANGED (FOB/FCA): Headquarters-designated freight forwarder handles pickup from the supplier origin; upon loading, click `[물품 인계 완료 (Handed Over)]`. 2. SUPPLIER_ARRANGED (DDP/DAP): Supplier ships directly via self-contracted carriers and registers Carrier, Tracking/BL, and ETD/ETA dates. (MAN-B-LOG-001 Chapter 01 · Section 1.2 & Chapter 04)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 2,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-log-03",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 진행할 수 있나요?",
    question_en: "Can I perform partial shipments for a single Purchase Order (PO)?",
    answer_ko: "네, 가능합니다. 발주서의 품목별 잔여 가용 수량(`availableReadiness = 확정량 - 기선적량 - 다른 진행중 준비량`) 범위 내라면 여러 차례 나누어 출고 준비(Goods Readiness)를 등록할 수 있습니다. 각 출고 건마다 독립된 CBM, 중량, 패킹리스트, 인계 상태가 관리됩니다. 단, 가용 수량을 초과하는 입력은 Overage Protection 유효성 검증에 의해 저장이 엄격히 차단됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Chapter 06 · Q1)",
    answer_en: "Yes. As long as quantities stay within the item's remaining available readiness (`availableReadiness = confirmed_qty - cumulative_shipped - other pending`), multiple partial shipments can be submitted. Each readiness submission maintains independent CBM, weight, packing list, and handover status. Submissions exceeding available quota are blocked by Overage Protection validation. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Chapter 06 · Q1)",
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
    id: "faq-log-04",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "출고 준비(Goods Readiness) 등록 시 필수로 첨부해야 하는 무역 서류는 무엇인가요?",
    question_en: "What mandatory trade documents are required for Goods Readiness submission?",
    answer_ko: "국제 운송 및 미국 세관 수입 통관을 위해 2대 필수 무역 서류인 **패킹 리스트 (Packing List, P/L)**와 **상업 송장 (Commercial Invoice, C/I)**을 첨부해야 합니다. `.pdf`, `.png`, `.jpg` 형식 업로드를 지원하며, 업로드된 서류는 Private Storage에 안전하게 암호화 보관됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.3)",
    answer_en: "For international freight and US customs clearance, two mandatory documents must be attached: **Packing List (P/L)** and **Commercial Invoice (C/I)**. Supported formats include `.pdf`, `.png`, and `.jpg`, stored encrypted in Private Storage. (MAN-B-LOG-001 Chapter 03 · Section 3.3)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 4,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-log-05",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "CBM(Cubic Meter, 입방미터)과 실측 카고 스펙은 어떻게 산출 및 등록하나요?",
    question_en: "How are CBM and physical cargo specifications calculated and registered?",
    answer_ko: "CBM 산출 공식은 `카톤 가로(m) × 세로(m) × 높이(m) × 총 박스 수(Cartons)`입니다. (예: 50cm × 40cm × 30cm 박스 20개 = 0.5 × 0.4 × 0.3 × 20 = 1.200 CBM). 출고 등록 화면에서 준비 완료 수량(`Ready Qty`), 총 박스 수(`Cartons`), 포장재 포함 저울 실측 중량(`Gross Weight kg`), 총 체적(`CBM m³`)의 4대 스펙을 실측치 기준으로 입력합니다. (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Appendix B)",
    answer_en: "CBM is calculated as `Carton Width(m) × Length(m) × Height(m) × Total Cartons` (e.g., 20 boxes of 50cm × 40cm × 30cm = 0.5 × 0.4 × 0.3 × 20 = 1.200 CBM). On the submission form, 4 physical specs must be entered based on actual measurements: Ready Qty, Cartons, Gross Weight (kg), and CBM (m³). (MAN-B-LOG-001 Chapter 03 · Section 3.2 & Appendix B)",
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
    id: "faq-log-06",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "물류 출고나 미국 창고 도착이 완료되면 대금 정산(Finance) 및 인보이스 결제가 자동으로 완료되나요?",
    question_en: "Does shipment completion or warehouse arrival automatically trigger finance settlement?",
    answer_ko: "아닙니다. 물류(LOG)와 재무/정산(FIN)은 상호 독립적인 비즈니스 도메인입니다 (**Shipping Complete ≠ Settlement Complete**). 공식 발주 확정 이후 양사 간 체결된 계약 조건(선급금 조건, 선적 시 청구 조건, 입고 검수 후 청구 조건 등)에 따라 `MAN-B-FIN-001` 재무 메뉴에서 독립적으로 인보이스를 발행하고 대금 지급/정산 절차를 진행합니다. (MAN-B-LOG-001 Chapter 01 · Section 1.1, Chapter 06 · Q6 & Appendix C 03)",
    answer_en: "No. Shipping/Logistics (LOG) and Finance/Settlement (FIN) operate as independent parallel business domains (**Shipping Complete ≠ Settlement Complete**). Following formal PO Confirmation, invoices and payouts are processed independently in the `MAN-B-FIN-001` Finance menu according to contractual payment terms (advance, on-shipment, or post-receiving terms). (MAN-B-LOG-001 Chapter 01 · Section 1.1, Chapter 06 · Q6 & Appendix C 03)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 6,
    is_featured: true,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-log-07",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "ARRIVED 상태와 RECEIVED 상태는 어떻게 다르며 입고 검수 판정은 어떻게 이루어지나요?",
    question_en: "What is the difference between ARRIVED and RECEIVED states, and how is warehouse inspection determined?",
    answer_ko: "`ARRIVED`는 화물이 미국 물류센터 도크에 물리적으로 도착한 시점(물류 운송 완료 및 창고 인계)이며, `RECEIVED`는 창고 검수자가 카톤을 개봉하여 바코드를 스캔하고 실물 수량/품질을 전수 검수한 완료 시점입니다 (**ARRIVED ≠ RECEIVED**). 실물 검수 결과는 1. 정상 입고 수량(`received_qty`), 2. 파손 격리 수량(`damaged_qty`), 3. 수량 불일치/라벨 보류 수량(`hold_qty`)의 3분류로 판정되어 입고 전표에 기록됩니다. (MAN-B-LOG-001 Chapter 05 · Section 5.1 & 5.2, Chapter 06 · Q3)",
    answer_en: "`ARRIVED` marks physical delivery at the US warehouse dock (logistics transit end & warehouse handoff), whereas `RECEIVED` marks completion of carton unboxing, barcode scanning, and piece-count quality inspection (**ARRIVED ≠ RECEIVED**). Inspection results are categorized into: 1. Normal received (`received_qty`), 2. Damaged quarantine (`damaged_qty`), and 3. Hold/discrepancy (`hold_qty`). (MAN-B-LOG-001 Chapter 05 · Section 5.1 & 5.2, Chapter 06 · Q3)",
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
    id: "faq-log-08",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "출고 준비 완료를 제출(READY_SUBMITTED)한 후 수량이나 출고지 정보를 수정할 수 있나요?",
    question_en: "Can I edit quantities or pickup address after submitting Goods Readiness (READY_SUBMITTED)?",
    answer_ko: "포워더 또는 배송사에 물품을 인계하기 전(`handover_status`가 `HANDED_OVER`로 전환되기 전)이라면 언제든지 출고 준비 정보를 수정하여 재제출할 수 있습니다. 수정 시 변경 이력은 발주서 액티비티 로그에 자동으로 기록됩니다. 단, 실물 화물 인계 또는 선적 등록이 완료된 이후에는 임의 수정이 제한됩니다. (MAN-B-LOG-001 Chapter 03 · Section 3.4 & Chapter 06 · Q2)",
    answer_en: "Before physical cargo handover to the forwarder/carrier (prior to `handover_status` changing to `HANDED_OVER`), readiness details can be modified and resubmitted anytime, with updates recorded in PO activity logs. Once handed over or dispatched, modifications are locked. (MAN-B-LOG-001 Chapter 03 · Section 3.4 & Chapter 06 · Q2)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 8,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  },
  {
    id: "faq-log-09",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "브랜드 포털 사용자 역할(Admin/Operator vs Viewer)에 따른 물류 및 선적 권한 차이는 무엇인가요?",
    question_en: "What are the permission differences between Admin/Operator and Viewer roles for Shipping & Logistics?",
    answer_ko: "회사 관리자(Admin/Owner) 및 운영자(Operator)는 목록/상세 조회, 서류 다운로드, 새 출고 준비 등록(`+ New Goods Ready`), 물품 인계 처리(`Handed Over`), 직배송 선적 등록(`Dispatch Form`)을 모두 실행할 수 있습니다. 반면 조회 전용 사용자(Viewer)는 목록/상세 및 서류 다운로드만 가능하며, 신규 등록 버튼이 노출되지 않고 인계/선적 액션 폼이 읽기 전용으로 비활성화됩니다. (MAN-B-LOG-001 Chapter 06 · Section 6.1)",
    answer_en: "Company Admins/Owners and Operators have full access to view listings/details, download attachments, create goods readiness (`+ New Goods Ready`), complete handovers (`Handed Over`), and register dispatches. Viewer role users have read-only access to view and download, with creation buttons hidden and dispatch/handover forms deactivated. (MAN-B-LOG-001 Chapter 06 · Section 6.1)",
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
    id: "faq-log-10",
    portal_scope: "BRAND",
    topic_id: "topic-logistics",
    source_knowledge_id: "kno-shipping-logistics-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    question_ko: "선적 및 출고 관련 문의나 지원이 필요한 경우 어떤 채널을 이용할 수 있나요?",
    question_en: "What support channels are available for shipping and international logistics inquiries?",
    answer_ko: "1. **Ask K SELECT (Knowledge Assistant)**: Brand Portal의 Ask K SELECT에서 Published Knowledge를 기반으로 정책 및 물류 가이드를 검색할 수 있습니다. 2. **1:1 운영 문의 (Support Center)**: `https://portal.kselectnetwork.com/portal/support` 에서 물류/선적 문의 티켓을 발행하여 운영팀의 지원을 받을 수 있습니다. 3. **긴급 물류 핫라인**: 본사 물류운영본부(`logistics@letusto.com`)를 통해 소통할 수 있습니다. (MAN-B-LOG-001 Appendix D)",
    answer_en: "1. **Ask K SELECT (Knowledge Assistant)**: Search logistics guidelines and policies grounded in Published Knowledge. 2. **1:1 Support Center**: Submit logistics tickets at `https://portal.kselectnetwork.com/portal/support`. 3. **Urgent Logistics Desk**: Contact Headquarters Logistics Operations directly via `logistics@letusto.com`. (MAN-B-LOG-001 Appendix D)",
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    status: "APPROVED",
    kind: "BOTH",
    display_order: 10,
    is_featured: false,
    generated_by: "MANUAL",
    created_at: now,
    updated_at: now
  }
];

async function publishLogFaqs() {
  console.log('====================================================');
  console.log('MAN-B-LOG-001 KNOWLEDGE CENTER FAQ PRODUCTION PUBLISH');
  console.log('====================================================');
  console.log(`Target Knowledge ID: kno-shipping-logistics-v10`);
  console.log(`Target Topic ID:     topic-logistics`);
  console.log(`Total FAQs to publish: ${logFaqs.length}`);

  for (const faq of logFaqs) {
    console.log(`\nUpserting ${faq.id} (${faq.question_ko.substring(0, 35)}...)...`);
    const { data, error } = await supabase.from('knowledge_faqs').upsert(faq, { onConflict: 'id' }).select();
    if (error) {
      console.error(`FAIL: Error upserting ${faq.id}:`, error);
      process.exit(1);
    }
    console.log(`✓ Upserted ${faq.id} (Display Order: ${faq.display_order}, Featured: ${faq.is_featured})`);
  }

  console.log('\n=== All 10 LOG FAQs successfully published to Supabase ===\n');
}

publishLogFaqs().catch(err => {
  console.error('Publication error:', err);
  process.exit(1);
});
