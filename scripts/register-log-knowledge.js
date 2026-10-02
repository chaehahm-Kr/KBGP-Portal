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
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function publishLogKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-LOG-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-LOG-001_Shipping-Logistics/03_PUBLISHED/MAN-B-LOG-001_Shipping-Logistics_V1.pdf');
  const destDir = path.join(process.cwd(), 'private_assets/manuals');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const assetPdfPath = path.join(destDir, 'MAN-B-LOG-001_Shipping-Logistics_V1.pdf');

  if (!fs.existsSync(assetPdfPath)) {
    fs.copyFileSync(sourcePdfPath, assetPdfPath);
  }

  const srcBuf = fs.readFileSync(sourcePdfPath);
  const assetBuf = fs.readFileSync(assetPdfPath);
  const srcHash = crypto.createHash('sha256').update(srcBuf).digest('hex');
  const assetHash = crypto.createHash('sha256').update(assetBuf).digest('hex');

  console.log(`Source PDF SHA: ${srcHash}`);
  console.log(`Asset  PDF SHA: ${assetHash}`);
  if (srcHash !== assetHash) {
    console.error('FAIL: Source PDF and Asset PDF SHA-256 do not match!');
    process.exit(1);
  }
  console.log('✓ Source PDF ↔ Asset PDF SHA-256 MATCH VERIFIED\n');

  const pdfStats = fs.statSync(assetPdfPath);
  const now = new Date().toISOString();
  const today = '2026-10-01';

  // 2. Knowledge Item Definition
  const knowledgeItem = {
    id: "kno-shipping-logistics-v10",
    slug: "man-b-log-001-shipping-logistics-guide",
    title: "MAN-B-LOG-001: Shipping & International Logistics Guide",
    title_ko: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    title_en: "K SELECT Brand Portal Shipping & International Logistics Guide (MAN-B-LOG-001)",
    summary_ko: "국제 B2B 공급망 출고 준비(Goods Readiness), 운송 책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED) 트랙, 무역 서류(P/L, C/I) 업로드, CBM 카고 스펙 산출, Inbound 선적 추적 및 미국 창고 입고 검수(Receiving) 통합 가이드",
    summary_en: "Operational guide for B2B shipping readiness submission, transport responsibility tracks (LETUSTO_ARRANGED vs SUPPLIER_ARRANGED), trade documents (P/L, C/I), CBM cargo specs, inbound shipment tracking, and US warehouse receiving inspection.",
    content_ko: `# K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 발주 확정 후 출고 준비 완료 등록(Goods Readiness), 무역 서류 첨부, 선적 모니터링, 미국 창고 입고 검수에 이르는 국제 물류 절차를 안내하는 공식 실무 가이드입니다.

## 2. 운송 책임 트랙 (Shipping Responsibility Tracks)
1. **Track 1: LETUSTO_ARRANGED (본사 지정 운송 - FOB 등)**: 본사 지정 포워더가 공급사 창고에서 화물을 수거하여 국제 운송 및 입고를 담당합니다.
2. **Track 2: SUPPLIER_ARRANGED (공급사 자체 운송 - DDP 등)**: 공급사가 자체 물류망을 이용해 미국 현지 물류센터 도크까지 직접 운송을 수행합니다.

## 3. 핵심 규칙 및 수량 차단 (Overage Protection)
- **가용 출고 수량 (\`availableReadiness\`)**: 발주 수량에서 기존 출고 완료 수량을 차단한 잔여 범위 내에서만 출고 등록이 허용됩니다.
- **2대 필수 무역 서류**: 패킹리스트(Packing List) 및 상업송장(Commercial Invoice)을 PDF/이미지 형태로 필수 첨부해야 합니다.`,
    content_en: `# K SELECT Brand Portal Shipping & International Logistics Guide (MAN-B-LOG-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners submitting shipping readiness, uploading trade documents, tracking inbound shipments, and monitoring US warehouse receiving.

## 2. Transport Responsibility Tracks
1. Track 1: LETUSTO_ARRANGED (FOB): Headquarters-designated freight forwarder handles pickup and international transport.
2. Track 2: SUPPLIER_ARRANGED (DDP): Supplier handles direct shipment to US fulfillment center dock.`,
    type: "MANUAL",
    source_type: "CONTENT",
    module: "LOGISTICS",
    category: "Brand Portal",
    tags: ["LOGISTICS", "SHIPPING", "EXPORT", "PORTAL"],
    owner_id: "staff-logistics-01",
    owner_name: "Logistics Operations Desk",
    status: "PUBLISHED",
    system_impact_status: "NORMAL",
    audience: ["BRAND", "INTERNAL"],
    is_sensitive_internal: false,
    requires_external_approval: false,
    external_review_status: "APPROVED",
    current_version: "v1.0",
    effective_date: today,
    created_at: now,
    updated_at: now
  };

  // Upsert Knowledge Item into DB
  const { error: itemErr } = await admin
    .from('knowledge_items')
    .upsert(knowledgeItem, { onConflict: 'id' });

  if (itemErr) {
    console.error('Error upserting knowledge item:', itemErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Item kno-shipping-logistics-v10 registered in DB');

  // 3. Upsert Version Record
  const versionRecord = {
    id: 'ver-log-v10',
    knowledge_id: 'kno-shipping-logistics-v10',
    version_tag: 'v1.0',
    title_ko: 'K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 v1.0',
    title_en: 'K SELECT Brand Portal Shipping & International Logistics Guide v1.0',
    summary_ko: 'MAN-B-LOG-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-B-LOG-001.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-LOG-001 Brand Portal Shipping Logistics Guide 최초 공식 배포 (Dual-Track 운송 책임 및 6단계 출고 파이프라인)',
    why_changed: '브랜드 파트너사 선적 준비 및 국제 물류 표준 절차 가이드 정립',
    effective_date: today,
    document_url: '/api/admin/knowledge/asset/asset-shipping-logistics-v10',
    document_name: 'MAN-B-LOG-001_Shipping-Logistics_V1.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  await admin.from('knowledge_versions').upsert(versionRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Version ver-log-v10 registered in DB');

  // 4. Upsert Asset Record
  const assetRecord = {
    id: 'asset-shipping-logistics-v10',
    knowledge_id: 'kno-shipping-logistics-v10',
    manual_title: 'K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-shipping-logistics-v10',
    file_name: 'MAN-B-LOG-001_Shipping-Logistics_V1.pdf',
    file_size: pdfStats.size,
    published_date: today,
    created_at: now
  };

  await admin.from('knowledge_manual_assets').upsert(assetRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Asset asset-shipping-logistics-v10 registered in DB');

  // 5. Upsert Relations
  const relations = [
    {
      id: 'rel-log-shipping-hub',
      knowledge_id: 'kno-shipping-logistics-v10',
      related_portal: 'Brand Portal',
      related_module: 'LOGISTICS',
      related_menu: 'Shipping & Logistics Hub',
      related_route: '/portal/orders/shipping',
      manual_title: 'K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)',
      created_at: now
    },
    {
      id: 'rel-log-goods-readiness',
      knowledge_id: 'kno-shipping-logistics-v10',
      related_portal: 'Brand Portal',
      related_module: 'LOGISTICS',
      related_menu: 'New Goods Readiness',
      related_route: '/portal/orders/shipping/new',
      manual_title: 'K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)',
      created_at: now
    }
  ];

  await admin.from('knowledge_relations').upsert(relations, { onConflict: 'id' });
  console.log('✓ Knowledge Relations registered in DB');

  // 6. Define 10 LOG FAQs
  const logFaqs = [
    {
      id: "faq-log-01",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 1,
      question_ko: "선적 및 출고 관리(Shipping & Logistics) 프로세스는 어떤 단계로 진행되나요?",
      question_en: "How does the Shipping & International Logistics process work?",
      answer_ko: "발주 확정(PO Status: APPROVED / SENT 및 SUPPLIER_CONFIRMED) 완료 후, 출고 준비 등록(Goods Readiness) → 필수 무역 서류(P/L, C/I) 첨부 → 운송책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED)별 배송 진행 → 미국 창고 입고 검수(Receiving) 순으로 진행됩니다.",
      answer_en: "After PO Confirmation, the process moves through Goods Readiness submission -> Trade Documents (P/L, C/I) upload -> Shipping Execution by track -> US Warehouse Receiving inspection."
    },
    {
      id: "faq-log-02",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 2,
      question_ko: "운송 책임 트랙인 LETUSTO_ARRANGED와 SUPPLIER_ARRANGED의 차이는 무엇인가요?",
      question_en: "What is the difference between LETUSTO_ARRANGED and SUPPLIER_ARRANGED shipping tracks?",
      answer_ko: "LETUSTO_ARRANGED(FOB 등)는 본사 지정 포워더가 공급사 창고에서 화물을 수거 및 국제 운송을 담당하며, SUPPLIER_ARRANGED(DDP 등)는 공급사가 자체 포워더를 통해 미국 물류센터 도크까지 직접 운송을 이행합니다.",
      answer_en: "LETUSTO_ARRANGED (FOB) uses headquarters-designated freight forwarders for pickup and transport, while SUPPLIER_ARRANGED (DDP) means the supplier delivers directly to the US warehouse dock."
    },
    {
      id: "faq-log-03",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 3,
      question_ko: "하나의 발주서(PO)에 대해 여러 번 나누어 분할 출고(Partial Shipment)를 진행할 수 있나요?",
      question_en: "Can I perform partial shipments for a single Purchase Order (PO)?",
      answer_ko: "네, 가능합니다. 발주서의 품목별 잔여 가용 수량(availableReadiness) 범위 내라면 여러 차례 나누어 출고 준비(Goods Readiness)를 등록할 수 있습니다. 단, 잔여 수량을 초과하는 출고 등록은 원천 차단됩니다.",
      answer_en: "Yes, partial shipments are allowed as long as requested quantities stay within availableReadiness limits. Overage registration is automatically blocked."
    },
    {
      id: "faq-log-04",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: true,
      display_order: 4,
      question_ko: "출고 준비(Goods Readiness) 등록 시 필수로 첨부해야 하는 무역 서류는 무엇인가요?",
      question_en: "What mandatory trade documents are required for Goods Readiness submission?",
      answer_ko: "국제 운송 및 미국 수입 통관을 위해 패킹리스트(Packing List, P/L)와 상업송장(Commercial Invoice, C/I) 2대 필수 무역 서류를 PDF 또는 이미지 형태로 업로드해야 합니다 (파일당 최대 20MB 제한).",
      answer_en: "Packing List (P/L) and Commercial Invoice (C/I) are mandatory attachments for US import customs clearance (PDF/Image formats, up to 20MB per file)."
    },
    {
      id: "faq-log-05",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 5,
      question_ko: "CBM(Cubic Meter, 입방미터)과 마스터 카톤 수량은 어떻게 산출 및 등록해야 하나요?",
      question_en: "How are CBM and master carton specifications calculated and submitted?",
      answer_ko: "마스터 카톤의 가로(W) × 세로(L) × 높이(H) (cm)를 1,000,000으로 나누어 박스당 CBM을 산출한 뒤 총 박스 수를 곱합니다. 출고 등록 화면에서 품목별 규격 입력 시 총 CBM이 자동 연산되어 표시됩니다.",
      answer_en: "Box CBM = (Width x Length x Height in cm) / 1,000,000. Total CBM is calculated automatically based on total master carton count during submission."
    },
    {
      id: "faq-log-06",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 6,
      question_ko: "물류 출고 완료(Shipped / Arrived) 상태가 되면 정산(Finance) 및 대금 지급이 자동으로 완료되나요?",
      question_en: "Does shipment completion automatically trigger payment settlement?",
      answer_ko: "아니요, 물류(LOG)와 정산(FIN)은 독립된 병렬 도메인입니다. 물류 배송 상태(SHIPPED / ARRIVED)와 인보이스 결재 승인 및 이행 상태(PAID)는 별도의 수식 및 절차에 의해 종결됩니다.",
      answer_en: "No, Shipping/Logistics (LOG) and Finance/Settlement (FIN) operate in parallel as independent domains with separate lifecycle states."
    },
    {
      id: "faq-log-07",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 7,
      question_ko: "발주서 진행 상태(ORD)와 물류 및 입고 상태(LOG)는 어떻게 구별되나요?",
      question_en: "How are Order Status (ORD) and Shipping/Logistics Status (LOG) disambiguated?",
      answer_ko: "ORD는 발주서 라이프사이클(DRAFT, ISSUED, SUPPLIER_CONFIRMED 등)을 관리하며, LOG는 출고 준비(READY_DRAFT, READY_SUBMITTED) 및 선적 추적 상태(IN_TRANSIT, ARRIVED, RECEIVED)를 독자적으로 다룹니다.",
      answer_en: "ORD governs the purchase order status, while LOG manages shipping readiness and inbound transit tracking states independently."
    },
    {
      id: "faq-log-08",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 8,
      question_ko: "미국 창고에 화물이 도착한 후 진행되는 입고 검수(Receiving) 및 입고 완료 절차는 어떻게 되나요?",
      question_en: "How is warehouse receiving and inspection processed upon arrival in the US?",
      answer_ko: "화물이 현지 물류센터 도크에 도착(ARRIVED)하면 실물 입고 검수가 개시되며, 수량 및 파손 여부를 대조한 후 입고 완료(RECEIVED) 상태로 전환됩니다. 오차 발생 시 서면 조율이 진행됩니다.",
      answer_en: "Upon arrival at the US warehouse dock, physical receiving inspection checks carton counts and item condition before marking status as RECEIVED."
    },
    {
      id: "faq-log-09",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 9,
      question_ko: "브랜드 포털에서 물류 및 선적 현황을 조회하고 서류를 제출하려면 어떤 권한이 필요한가요?",
      question_en: "What permissions are required to manage shipping and logistics in Brand Portal?",
      answer_ko: "orders:read 권한을 가진 사용자는 출고 및 선적 현황을 조회할 수 있으며, orders:write 권한 이상을 보유한 사용자만 신규 출고 준비 등록 및 서류 제출이 허용됩니다.",
      answer_en: "orders:read permission allows viewing shipping status, while orders:write or higher is required to submit goods readiness and trade documents."
    },
    {
      id: "faq-log-10",
      kind: "FAQ",
      topic_id: "topic-logistics",
      source_knowledge_id: "kno-shipping-logistics-v10",
      portal_scope: "BRAND",
      audience: ["BRAND"],
      status: "APPROVED",
      is_featured: false,
      display_order: 10,
      question_ko: "출고 정보 변경이나 선적 지연이 발생할 경우 1:1 지원 센터와 어떻게 연계되나요?",
      question_en: "How are shipment delays or modifications escalated to Support Desk?",
      answer_ko: "선적 화면에서 [선적 문의] 버튼을 클릭하면 카테고리(logistics)와 해당 선적/발주 번호 컨텍스트가 kselect_support_handoff로 자동 주입되어 지원 센터 폼에 사전 입력됩니다.",
      answer_en: "Clicking [Shipment Inquiry] automatically pre-fills the support inquiry form with category=logistics and shipment context via kselect_support_handoff."
    }
  ];

  // Insert/Upsert FAQs into DB
  for (const faq of logFaqs) {
    const { error: faqErr } = await admin
      .from('knowledge_faqs')
      .upsert(faq, { onConflict: 'id' });

    if (faqErr) {
      console.error(`Error upserting ${faq.id}:`, faqErr);
    } else {
      console.log(`✓ ${faq.id} (${faq.is_featured ? '⭐ Featured' : 'Normal'}) registered in DB`);
    }
  }

  console.log('\n====================================================');
  console.log('MAN-B-LOG-001 KNOWLEDGE CENTER PUBLISH COMPLETE');
  console.log('====================================================');
}

publishLogKnowledge().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
