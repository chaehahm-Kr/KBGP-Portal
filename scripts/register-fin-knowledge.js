const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const today = '2026-10-02';

// 1. Check published PDF asset
const pdfPath = path.join(process.cwd(), 'Manuals', 'MAN-B-FIN-001_Finance-Settlement', '03_PUBLISHED', 'MAN-B-FIN-001_Finance-Settlement_V1.pdf');
const pdfBytes = fs.readFileSync(pdfPath);
const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
const pdfSize = pdfBytes.length;

console.log('PDF Path:', pdfPath);
console.log('PDF Size:', pdfSize, 'bytes');
console.log('PDF Hash:', pdfHash);

const content_ko = `# K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 입점 브랜드 파트너사가 공식 발주 확정(PO Status: APPROVED / SENT 및 supplier_confirmation: CONFIRMED) 완료 후 대금 청구를 위한 공급사 인보이스(Supplier Invoice)를 작성·제출하고, 3대 독립 상태 차원(Invoice ≠ Payment ≠ Settlement) 및 실시간 미지급 잔액(balance_due)을 관리하며 본사 대금 결재/송금 집행을 완수할 수 있도록 안내하는 공식 실무 가이드입니다.

---

## 2. 3대 핵심 도메인 경계 원칙 (Core Governance & Disambiguation)
1. **발주 확정 병렬 전환 (ORD → FIN Parallel Handoff)**:
   - 공식 발주 확정 완료 시 물류(LOG)와 정산(FIN) 도메인으로 동시 전환되며, 인보이스 작성은 물류 입고 검수 완료를 직렬 전제조건으로 기다리지 않습니다.
2. **물류 완료 ≠ 정산 완료 (FIN ↔ LOG Boundary)**:
   - 물류 도메인의 배송 상태(SHIPPED / ARRIVED / RECEIVED)와 정산 도메인의 상태(Invoice, Payment, Settlement)는 상호 독립적인 상태 머신으로 작동합니다 (**Shipping Complete ≠ Settlement Complete**).
3. **3대 독립 상태 차원 (Tri-State Disambiguation: Invoice ≠ Payment ≠ Settlement)**:
   - **문서 상태 (Invoice Status)**: DRAFT(초안) → SUBMITTED(제출완료) → APPROVED(승인) / REJECTED(반려) / VOID(무효화)
   - **지급 상태 (Payment Status)**: 실시간 잔액 기반 동적 산출 UNPAID(미지급) → PARTIALLY_PAID(일부지급) → PAID(지급완료)
   - **정산 상태 (Settlement Status)**: 행정적 마감 상태 OPEN(정산대기) → SETTLED(정산종결)

---

## 3. 핵심 비즈니스 규칙 및 안전장치 (Key Business Rules)
1. **Single Active Invoice 단일 활성 인보이스 규칙**:
   - 1개 발주서(PO)에는 최대 1건의 활성 인보이스(invoice_status NOT IN ('VOID', 'REJECTED'))만 존재할 수 있으며, Application 사전 검증과 Database Partial Unique Index(\`idx_supplier_invoices_one_active_per_po\`) 양단계에서 중복 생성이 원천 차단됩니다.
2. **실시간 정산 및 잔액 연산 수식 (Real-Time Calculation Formulas)**:
   - \`subtotal = SUM(invoiced_qty * unit_price)\`
   - \`adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)\`
   - \`invoice_total = subtotal + adjustmentTotal\`
   - \`amount_paid = SUM(supplier_payments.payment_amount WHERE status = 'COMPLETED')\`
   - \`balance_due = invoice_total - amount_paid\`
3. **System Gaps (현재 미지원 / 미구현 기능 명시)**:
   - \`1:N 분할 인보이스 (Partial Invoicing)\`: 1개 PO에 대해 여러 차례 나누어 인보이스를 분할 발행하는 기능은 **지원되지 않습니다 (NOT SUPPORTED)**.
   - \`포털 내 PDF 자동 변환 (PDF Export)\`: 입력 데이터를 PDF로 자동 변환하는 기능은 **구현되어 있지 않으며 (NOT IMPLEMENTED)**, 공급사가 외부 작성 송장 PDF를 직접 첨부합니다.

---

## 4. 관련 화면 및 기능 (Related Routes)
- \`/portal/finance\` (정산 & 인보이스 관리 허브)
- \`/portal/finance/new\` (새 인보이스 작성 및 발주서 선택)
- \`/portal/finance/[id]\` (인보이스 상세 조회 및 실시간 잔액 확인)
- \`/portal/finance/[id]/edit\` (인보이스 초안 수정)
- \`/admin/finance/invoices\` (어드민 전체 인보이스 관리)
- \`/admin/finance/invoices/[id]\` (어드민 인보이스 심사 및 승인/반려/무효화)
- \`/admin/finance/payments\` (어드민 대금 송금 집행 관리)
- \`/admin/finance/payments/new\` (어드민 대금 이체 내역 등록)
- \`/admin/finance/payments/[id]\` (어드민 지급 내역 상세)`;

const content_en = `# K SELECT Brand Portal Finance & Settlement User Guide (MAN-B-FIN-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners to create supplier invoices following official PO Confirmation, track tri-state dimensions (Invoice ≠ Payment ≠ Settlement), manage settlement adjustments, monitor real-time balance_due, and verify headquarters payout remittances.

## 2. Core Operational Governance
1. **Parallel Domain Handoff (ORD → FIN)**: Official PO Confirmation immediately unlocks invoice creation without serial dependency on warehouse receiving.
2. **FIN ↔ LOG Boundary**: Shipping Complete ≠ Settlement Complete. Logistics shipping status operates independently from finance settlement status.
3. **Tri-State Disambiguation**:
   - Invoice Status: DRAFT / SUBMITTED / APPROVED / REJECTED / VOID
   - Payment Status (Computed): UNPAID / PARTIALLY_PAID / PAID
   - Settlement Status: OPEN / SETTLED

## 3. Business Rules & Safety Mechanisms
1. **Single Active Invoice**: Only 1 active invoice per PO enforced by application logic and database partial unique index (\`idx_supplier_invoices_one_active_per_po\`).
2. **Formulas**:
   - \`subtotal = SUM(invoiced_qty * unit_price)\`
   - \`adjustmentTotal = SUM(CHARGE) - SUM(CREDIT)\`
   - \`invoice_total = subtotal + adjustmentTotal\`
   - \`balance_due = invoice_total - amount_paid\`
3. **System Gaps (Explicitly Classified)**:
   - 1:N Partial Invoicing: NOT SUPPORTED
   - Portal PDF Auto Export: NOT IMPLEMENTED (Suppliers attach external PDF invoices).

## 4. Related Routes
- \`/portal/finance\`
- \`/portal/finance/new\`
- \`/portal/finance/[id]\`
- \`/portal/finance/[id]/edit\`
- \`/admin/finance/invoices\`
- \`/admin/finance/invoices/[id]\`
- \`/admin/finance/payments\`
- \`/admin/finance/payments/new\`
- \`/admin/finance/payments/[id]\``;

const knowledgeItem = {
  id: "kno-finance-settlement-v10",
  document_url: "/api/admin/knowledge/asset/asset-finance-settlement-v10",
  document_name: "MAN-B-FIN-001_Finance-Settlement_V1.pdf",
  document_size: pdfSize,
  document_type: "application/pdf",
  slug: "man-b-fin-001-finance-settlement-guide",
  title: "MAN-B-FIN-001: Finance & Settlement User Guide",
  title_ko: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
  title_en: "K SELECT Brand Portal Finance & Settlement User Guide (MAN-B-FIN-001)",
  summary_ko: "K SELECT Brand Portal의 공식 발주 확정(PO Confirmed) 후 인보이스 발행, 3대 독립 상태 분리(Invoice ≠ Payment ≠ Settlement), Single Active Invoice 단일 활성 인보이스 규칙, 실시간 미지급 잔액(balance_due) 연산, 단가/수량/파손 정산 조정(Adjustment) 및 본사 대금 결재/송금 집행을 위한 공식 사용자 매뉴얼입니다.",
  summary_en: "Official user manual for K SELECT Brand Portal covering post-PO confirmation invoice creation, strict tri-state disambiguation (Invoice ≠ Payment ≠ Settlement), Single Active Invoice dual enforcement, real-time balance_due calculation, settlement adjustments (shortage, damage, price differences), and admin remittance payout execution.",
  content_ko,
  content_en,
  type: "MANUAL",
  source_type: "CONTENT",
  module: "FINANCE",
  category: "Brand Portal",
  tags: ["MANUAL", "FINANCE", "SETTLEMENT", "INVOICE", "PAYMENT", "BALANCE_DUE", "Balance Due", "PARTIAL_PAYMENT", "Partial Payment", "ADJUSTMENT", "SINGLE_ACTIVE_INVOICE", "Single Active Invoice", "MAN-B-FIN-001", "OFFICIAL", "정산", "인보이스", "송장", "대금지급", "미지급잔액", "분할지급"],
  owner_id: "staff-finance-01",
  owner_name: "Finance Operations Desk",
  status: "PUBLISHED",
  system_impact_status: "NORMAL",
  audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
  is_sensitive_internal: false,
  requires_external_approval: true,
  external_review_status: "APPROVED",
  external_reviewer_id: "staff-superadmin-01",
  external_reviewed_at: "2026-10-02T12:00:00Z",
  current_version: "v1.0",
  effective_date: today,
  created_at: now,
  updated_at: now
};

const knowledgeVersion = {
  id: "ver-finance-settlement-v10",
  knowledge_id: "kno-finance-settlement-v10",
  version: "v1.0",
  status: "PUBLISHED",
  title_ko: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001 v1.0)",
  title_en: "K SELECT Brand Portal Finance & Settlement User Guide v1.0",
  summary_ko: "MAN-B-FIN-001 최초 공식 배포 버전 (21-Page Published PDF 배포)",
  summary_en: "Initial official publication of MAN-B-FIN-001 v1.0 (21-Page Published PDF).",
  content_ko,
  content_en,
  what_changed: "MAN-B-FIN-001 Finance & Settlement User Guide 공식 배포 (v1.0)",
  why_changed: "B2B 공급망 인보이스 발행, 3대 독립 상태 차원(Invoice ≠ Payment ≠ Settlement), Single Active Invoice 및 정산 조정 프로세스 표준화",
  effective_date: today,
  document_url: "/api/admin/knowledge/asset/asset-finance-settlement-v10",
  document_name: "MAN-B-FIN-001_Finance-Settlement_V1.pdf",
  created_by_id: "usr-admin-system",
  created_by_name: "Finance Operations Desk",
  reviewer_id: "staff-superadmin-01",
  approver_id: "staff-superadmin-01",
  published_at: now,
  created_at: now
};

const manualAsset = {
  id: "asset-finance-settlement-v10",
  knowledge_id: "kno-finance-settlement-v10",
  manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
  version: "v1.0",
  language: "KO",
  is_current: true,
  file_url: "/api/admin/knowledge/asset/asset-finance-settlement-v10",
  file_name: "MAN-B-FIN-001_Finance-Settlement_V1.pdf",
  file_size: pdfSize,
  published_date: today,
  created_at: now
};

const relations = [
  {
    id: "rel-fin-hub",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Brand Portal",
    related_module: "FINANCE",
    related_menu: "Finance & Invoices Hub",
    related_route: "/portal/finance",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-fin-new-invoice",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Brand Portal",
    related_module: "FINANCE",
    related_menu: "New Supplier Invoice",
    related_route: "/portal/finance/new",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-fin-invoice-detail",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Brand Portal",
    related_module: "FINANCE",
    related_menu: "Invoice Detail View",
    related_route: "/portal/finance/[id]",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-fin-invoice-edit",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Brand Portal",
    related_module: "FINANCE",
    related_menu: "Edit Invoice Draft",
    related_route: "/portal/finance/[id]/edit",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-admin-fin-invoices",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Admin",
    related_module: "FINANCE",
    related_menu: "Admin Invoices Management",
    related_route: "/admin/finance/invoices",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-admin-fin-invoice-detail",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Admin",
    related_module: "FINANCE",
    related_menu: "Admin Invoice Review & Approval",
    related_route: "/admin/finance/invoices/[id]",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-admin-fin-payments",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Admin",
    related_module: "FINANCE",
    related_menu: "Admin Payments Management",
    related_route: "/admin/finance/payments",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-admin-fin-payment-new",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Admin",
    related_module: "FINANCE",
    related_menu: "Admin New Payment Execution Form",
    related_route: "/admin/finance/payments/new",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  },
  {
    id: "rel-admin-fin-payment-detail",
    knowledge_id: "kno-finance-settlement-v10",
    related_portal: "Admin",
    related_module: "FINANCE",
    related_menu: "Admin Payment Detail View",
    related_route: "/admin/finance/payments/[id]",
    manual_title: "K SELECT Brand Portal 정산 관리 및 인보이스 발행 매뉴얼 (MAN-B-FIN-001)",
    created_at: now
  }
];

async function registerFinKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-FIN-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================\n');

  // 1. Upsert Knowledge Item
  console.log('1. Upserting knowledge_items (kno-finance-settlement-v10)...');
  const { data: itemData, error: itemError } = await supabase
    .from('knowledge_items')
    .upsert(knowledgeItem, { onConflict: 'id' })
    .select();
  if (itemError) {
    console.error('FAIL: Error upserting knowledge_items:', itemError);
    process.exit(1);
  }
  console.log('✓ knowledge_items upserted successfully:', itemData[0].id);

  // 2. Upsert Knowledge Version
  console.log('2. Upserting knowledge_versions (ver-finance-settlement-v10)...');
  const { data: verData, error: verError } = await supabase
    .from('knowledge_versions')
    .upsert(knowledgeVersion, { onConflict: 'id' })
    .select();
  if (verError) {
    console.error('FAIL: Error upserting knowledge_versions:', verError);
    process.exit(1);
  }
  console.log('✓ knowledge_versions upserted successfully:', verData[0].id);

  // 3. Upsert Manual Asset
  console.log('3. Upserting knowledge_manual_assets (asset-finance-settlement-v10)...');
  const { data: assetData, error: assetError } = await supabase
    .from('knowledge_manual_assets')
    .upsert(manualAsset, { onConflict: 'id' })
    .select();
  if (assetError) {
    console.error('FAIL: Error upserting knowledge_manual_assets:', assetError);
    process.exit(1);
  }
  console.log('✓ knowledge_manual_assets upserted successfully:', assetData[0].id);

  // 4. Upsert Relations
  console.log(`4. Upserting ${relations.length} knowledge_relations...`);
  for (const rel of relations) {
    const { error: relError } = await supabase
      .from('knowledge_relations')
      .upsert(rel, { onConflict: 'id' });
    if (relError) {
      console.error(`FAIL: Error upserting relation ${rel.id}:`, relError);
      process.exit(1);
    }
    console.log(`  ✓ Upserted relation: ${rel.id} -> ${rel.related_route}`);
  }

  console.log('\n====================================================');
  console.log('MAN-B-FIN-001 KNOWLEDGE CENTER PRODUCTION REGISTRATION SUCCESS');
  console.log('====================================================\n');
}

registerFinKnowledge().catch(err => {
  console.error('Registration failed:', err);
  process.exit(1);
});
