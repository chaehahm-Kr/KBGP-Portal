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

const finFaqs = [
  {
    id: "faq-fin-01",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "공식 발주 확정(PO Confirmed) 후 대금 청구를 위한 인보이스 발행은 어떤 절차로 진행되나요?",
    question_en: "What is the end-to-end process for issuing a supplier invoice after PO Confirmation?",
    answer_ko: "공식 발주 확정(`CONFIRMED`) 완료 시 정산(FIN) 도메인이 즉시 활성화됩니다. 브랜드사는 `/portal/finance/new`에서 발주서를 선택하여 인보이스를 생성(`DRAFT`)하고, 수량·단가 확인 및 외부 송장 PDF를 첨부한 뒤 제출(`SUBMITTED`)합니다. 이후 본사 검토를 거쳐 승인(`APPROVED`), 대금 송금 집행(`PAID`), 정산 마감(`SETTLED`) 순으로 완수됩니다. (MAN-B-FIN-001 Chapter 01 · Section 1.1 & Diagram 01)",
    answer_en: "Following official PO Confirmation (`CONFIRMED`), the finance domain unlocks immediately. Brands create an invoice draft at `/portal/finance/new`, verify item lines/pricing, attach external invoice PDFs, and submit (`SUBMITTED`). The lifecycle concludes through Admin review/approval (`APPROVED`), remittance payment (`PAID`), and settlement closing (`SETTLED`). (MAN-B-FIN-001 Chapter 01 · Section 1.1 & Diagram 01)",
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
    id: "faq-fin-02",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "인보이스 상태(Invoice Status), 지급 상태(Payment Status), 정산 상태(Settlement Status)는 어떻게 구별되나요?",
    question_en: "How are Invoice Status, Payment Status, and Settlement Status disambiguated?",
    answer_ko: "세 가지 상태는 상호 독립적인 상태 머신으로 작동합니다 (**Invoice ≠ Payment ≠ Settlement**). 1. **인보이스 상태**: 문서 결재 단계(`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`). 2. **지급 상태**: 실제 송금 실적 및 잔액 기반 자동 산출(`UNPAID`, `PARTIALLY_PAID`, `PAID`). 3. **정산 상태**: 행정적 마감 상태(`OPEN`, `SETTLED`). \"승인됨(APPROVED)\"이 대금 지급 완료를 의미하지 않으며, \"지급 완료(PAID)\" 후에도 별도의 정산 마감 절차가 수행됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Diagram 02)",
    answer_en: "The 3 status dimensions operate as independent parallel state machines (**Invoice ≠ Payment ≠ Settlement**): 1. **Invoice Status**: Document workflow (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `VOID`). 2. **Payment Status**: Dynamically computed from remittance (`UNPAID`, `PARTIALLY_PAID`, `PAID`). 3. **Settlement Status**: Administrative closing (`OPEN`, `SETTLED`). \"APPROVED\" does not mean payment is executed, and \"PAID\" does not automatically close the settlement file. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Diagram 02)",
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
    id: "faq-fin-03",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "물류 출고나 미국 창고 도착(Shipping/Receiving)이 완료되면 정산 및 대금 지급이 자동으로 완료되나요?",
    question_en: "Does shipping completion or US warehouse receiving automatically trigger settlement or payment?",
    answer_ko: "아닙니다. 물류(LOG)와 정산(FIN)은 독립된 병렬 비즈니스 도메인입니다 (**Shipping Complete ≠ Settlement Complete**). 발주서가 완료(`PO COMPLETED`)되거나 화물이 도착(`ARRIVED`/`RECEIVED`)하더라도 인보이스나 지급 상태가 자동으로 변경되지 않습니다. 대금 지급은 양사 계약 조건(선급금, 선적 시 청구, 입고 후 청구 등)에 따라 독립된 인보이스 승인 및 송금 절차를 거쳐 집행됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 02 & Chapter 06 · Q6)",
    answer_en: "No. Shipping/Logistics (LOG) and Finance/Settlement (FIN) operate as independent parallel business domains (**Shipping Complete ≠ Settlement Complete**). PO completion or warehouse arrival does not alter Invoice or Payment statuses. Payments are executed independently via invoice review and remittance according to agreed contract terms. (MAN-B-FIN-001 Chapter 01 · Boundary 02 & Chapter 06 · Q6)",
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
    id: "faq-fin-04",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "하나의 발주서(PO)에 대해 여러 개의 인보이스를 동시에 생성하거나 등록할 수 있나요?",
    question_en: "Can multiple active invoices be created for a single Purchase Order (PO)?",
    answer_ko: "아니요, 불가능합니다. 1개 PO당 최대 1건의 활성 인보이스(`invoice_status NOT IN ('VOID', 'REJECTED')`)만 존재할 수 있는 **Single Active Invoice** 규칙이 적용됩니다. 동일 PO에 이미 활성 인보이스가 존재할 경우, 포털 화면 사전 검증(Check 1) 및 데이터베이스 고유 인덱스(`idx_supplier_invoices_one_active_per_po`, Check 2) 양단계에서 신규 생성이 원천 차단됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.2 & Diagram 04)",
    answer_en: "No. K SELECT enforces the **Single Active Invoice** policy where only 1 active invoice (`invoice_status NOT IN ('VOID', 'REJECTED')`) is allowed per PO. If an active invoice already exists, duplicate creation is strictly blocked by both application pre-checks (Check 1) and database partial unique index constraints (`idx_supplier_invoices_one_active_per_po`, Check 2). (MAN-B-FIN-001 Chapter 06 · Section 6.2 & Diagram 04)",
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
    id: "faq-fin-05",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "인보이스 청구 총액(invoice_total)과 미지급 잔액(balance_due)은 어떤 공식으로 산출되나요?",
    question_en: "How are the invoice total (invoice_total) and balance due (balance_due) calculated?",
    answer_ko: "시스템은 다음 5대 수식에 따라 실시간으로 연산합니다: 1. 품목 소계: `subtotal = SUM(invoiced_qty * unit_price)`, 2. 정산 조정 합계: `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`, 3. 최종 청구 총액: `invoice_total = subtotal + adjustmentTotal`, 4. 지급 완료 누적액: `amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')`, 5. 미지급 잔액: `balance_due = invoice_total - amount_paid`. 최종 청구 총액이 0 미만인 경우 저장이 자동 차단됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.1)",
    answer_en: "The system calculates amounts in real time using 5 authoritative formulas: 1. Line subtotal: `subtotal = SUM(invoiced_qty * unit_price)`, 2. Adjustment total: `adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)`, 3. Final Invoice Total: `invoice_total = subtotal + adjustmentTotal`, 4. Completed Remittance: `amount_paid = SUM(completed payments)`, 5. Balance Due: `balance_due = invoice_total - amount_paid`. Submissions with negative totals (< $0) are automatically blocked. (MAN-B-FIN-001 Chapter 06 · Section 6.1)",
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
    id: "faq-fin-06",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "대금이 분할 이체(Partial Payment)되는 경우 지급 상태는 어떻게 변경되나요?",
    question_en: "How does Payment Status change when partial payments are remitted?",
    answer_ko: "지급 상태는 잔액(`balance_due`)에 따라 동적으로 자동 산출됩니다. 송금 전에는 `UNPAID(미지급)` 상태이며, 일부 금액만 이체되어 `amount_paid > 0` 및 `balance_due > 0`인 경우 `PARTIALLY_PAID(일부지급)`으로 자동 전환됩니다. 최종 잔여 금액이 모두 송금되어 `balance_due <= 0`이 되면 `PAID(지급완료)` 상태로 전환됩니다. 일시 완납 시에는 UNPAID에서 PAID로 즉시 변경됩니다. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Chapter 05 · Section 5.1)",
    answer_en: "Payment Status is computed dynamically based on `balance_due`: It starts as `UNPAID`. When partial payments occur (`amount_paid > 0` and `balance_due > 0`), it transitions automatically to `PARTIALLY_PAID`. Once full remittance reduces `balance_due <= 0`, status becomes `PAID`. In full single payouts, it transitions directly from UNPAID to PAID. (MAN-B-FIN-001 Chapter 01 · Boundary 03 & Chapter 05 · Section 5.1)",
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
    id: "faq-fin-07",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "입고 검수 시 수량 부족(Shortage)이나 파손(Damage)이 발생하면 인보이스 정산 조정(Adjustment)은 어떻게 반영되나요?",
    question_en: "How are warehouse shortages, damages, or price differences handled via settlement adjustments?",
    answer_ko: "본사 어드민 심사 시 실물 입고 검수 결과에 따라 3대 조정 유형이 인보이스에 추가됩니다: 1. `SHORTAGE` (수량 부족 감액 CREDIT), 2. `DAMAGE` (파손 격리 감액 CREDIT), 3. `PRICE_DIFFERENCE` (단가 차액 감액 CREDIT 또는 증액 CHARGE). 조정 항목이 반영되면 `adjustmentTotal`이 재연산되어 최종 청구 총액(`invoice_total`)에 자동 반영됩니다. (MAN-B-FIN-001 Chapter 04 · Section 4.2 & Appendix B.1)",
    answer_en: "Admin reviewers apply 3 standard adjustment categories based on warehouse inspection: 1. `SHORTAGE` (quantity deficiency CREDIT deduction), 2. `DAMAGE` (damaged cargo CREDIT deduction), 3. `PRICE_DIFFERENCE` (contract unit price difference CREDIT/CHARGE). Adjustments update `adjustmentTotal`, which recalculates final `invoice_total` automatically. (MAN-B-FIN-001 Chapter 04 · Section 4.2 & Appendix B.1)",
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
    id: "faq-fin-08",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "포털 내에서 PDF 인보이스를 자동 생성하거나 1개 PO에 대해 여러 번 분할 인보이스(Partial Invoicing)를 청구할 수 있나요?",
    question_en: "Does the portal support automatic PDF export or 1:N partial invoicing for a single PO?",
    answer_ko: "1. **1:N 분할 인보이스 (Partial Invoicing)**: 1개 PO에 대해 여러 차례 나누어 인보이스를 청구하는 기능은 **지원되지 않습니다 (NOT SUPPORTED)** (Single Active Invoice 원칙). 2. **포털 내 PDF 자동 변환 (PDF Export)**: 입력 데이터를 PDF로 자동 변환·내보내는 기능은 **구현되어 있지 않습니다 (NOT IMPLEMENTED)**. 브랜드사는 외부 회계 시스템에서 발행한 정식 PDF 송장 파일을 직접 첨부해야 합니다. (MAN-B-FIN-001 Chapter 06 · Section 6.3)",
    answer_en: "1. **1:N Partial Invoicing**: Submitting multiple partial invoices for 1 PO is **NOT SUPPORTED** (Single Active Invoice constraint). 2. **Portal PDF Auto Export**: Converting input forms into PDF documents is **NOT IMPLEMENTED**. Partner brands must attach their externally generated commercial invoice PDF directly to the submission form. (MAN-B-FIN-001 Chapter 06 · Section 6.3)",
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
    id: "faq-fin-09",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "제출한 인보이스가 본사 심사에서 반려(REJECTED)되거나 무효화(VOID)된 경우 어떻게 대처해야 하나요?",
    question_en: "What should I do if an invoice is Rejected (REJECTED) or Voided (VOID) by Admin review?",
    answer_ko: "인보이스가 `REJECTED` 또는 `VOID` 처리되면 해당 PO에 걸려 있던 활성 인보이스 잠금이 즉시 해제됩니다. 브랜드사는 상세 화면에서 반려 사유를 확인한 후, `/portal/finance/new`에서 해당 발주서를 다시 선택하여 수정된 내용과 정정 서류를 첨부한 새 인보이스를 즉시 작성·제출할 수 있습니다. (MAN-B-FIN-001 Chapter 04 · Section 4.3 & Chapter 05 · Section 5.2)",
    answer_en: "When an invoice is transitioned to `REJECTED` or `VOID`, the active invoice lock on that PO is immediately released. Brands can review the rejection reason on the detail page, then navigate to `/portal/finance/new` to create and submit a corrected invoice for the PO with revised attachments. (MAN-B-FIN-001 Chapter 04 · Section 4.3 & Chapter 05 · Section 5.2)",
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
    id: "faq-fin-10",
    portal_scope: "BRAND",
    topic_id: "topic-finance",
    source_knowledge_id: "kno-finance-settlement-v10",
    source_version: "v1.0",
    source_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    question_ko: "브랜드 포털 사용자 역할에 따른 정산 메뉴 권한과 정산 관련 1:1 문의 채널은 어떻게 되나요?",
    question_en: "What permissions are granted by role for Finance, and how can I escalate settlement inquiries?",
    answer_ko: "관리자(Admin/Owner) 및 매니저(Manager/Operator)는 인보이스 작성, 수정, 제출, 삭제를 모두 실행할 수 있습니다. 조회 전용 사용자(Viewer)는 목록 및 상세 조회만 가능합니다. 정산 문의나 송금 일정 확인이 필요한 경우, 상세 화면의 `[💬 정산 문의]` 버튼을 클릭하면 카테고리(`finance`)와 AP/송장 번호가 사전 입력된 1:1 지원 센터(`https://portal.kselectnetwork.com/portal/support`)로 자동 연계됩니다. (MAN-B-FIN-001 Chapter 06 · Section 6.1 & Appendix D)",
    answer_en: "Admins/Owners and Managers have full permissions to create, edit, submit, and delete invoices. Viewer users have read-only access. For settlement or remittance inquiries, clicking `[💬 Settlement Inquiry]` pre-fills the ticket category (`finance`) and AP/Invoice context directly into the 1:1 Support Desk form (`https://portal.kselectnetwork.com/portal/support`). (MAN-B-FIN-001 Chapter 06 · Section 6.1 & Appendix D)",
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

async function publishFinFaqs() {
  console.log('====================================================');
  console.log('MAN-B-FIN-001 KNOWLEDGE CENTER FAQ PRODUCTION PUBLISH');
  console.log('====================================================');
  console.log('Target Knowledge ID: kno-finance-settlement-v10');
  console.log('Target Topic ID:     topic-finance');
  console.log(`Total FAQs to publish: ${finFaqs.length}\n`);

  for (const faq of finFaqs) {
    console.log(`Upserting ${faq.id} (${faq.question_ko.substring(0, 35)}...)...`);
    const { data, error } = await supabase.from('knowledge_faqs').upsert(faq, { onConflict: 'id' }).select();
    if (error) {
      console.error(`FAIL: Error upserting ${faq.id}:`, error);
      process.exit(1);
    }
    console.log(`✓ Upserted ${faq.id} (Display Order: ${faq.display_order}, Featured: ${faq.is_featured})`);
  }

  console.log('\n=== All 10 FIN FAQs successfully published to Supabase ===\n');
}

publishFinFaqs().catch(err => {
  console.error('Publication error:', err);
  process.exit(1);
});
