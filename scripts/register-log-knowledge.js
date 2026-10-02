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
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function publishLogKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-LOG-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-LOG-001_Shipping-Logistics/03_PUBLISHED/MAN-B-LOG-001_Shipping-Logistics_V1.pdf');
  const assetPdfPath = path.join(process.cwd(), 'private_assets/manuals/MAN-B-LOG-001_Shipping-Logistics_V1.pdf');

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

  const now = new Date().toISOString();
  const today = '2026-10-01';

  // 2. Knowledge Item Definition
  const knowledgeItem = {
    id: "kno-shipping-logistics-v10",
    slug: "man-b-log-001-shipping-logistics-guide",
    title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    title_ko: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼",
    title_en: "K SELECT Brand Portal Shipping & International Logistics Guide",
    summary_ko: "국제 B2B 공급망 출고 준비(Goods Readiness), 운송 책임(LETUSTO_ARRANGED vs SUPPLIER_ARRANGED) 트랙, 무역 서류(P/L, C/I) 업로드, CBM 카고 스펙 산출, Inbound 선적 추적 및 미국 창고 입고 검수(Receiving) 통합 가이드",
    summary_en: "Operational guide for B2B shipping readiness submission, transport responsibility tracks (LETUSTO_ARRANGED vs SUPPLIER_ARRANGED), trade documents (P/L, C/I), CBM cargo specs, inbound shipment tracking, and US warehouse receiving inspection.",
    content_ko: `# K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 발주 확정(PO Confirmed) 후 출고 준비 완료 등록(Goods Readiness), 실측 패킹 스펙(카톤 수, 중량, CBM) 입력, 필수 무역 서류(P/L, C/I) 첨부, 운송 책임 분기별 선적 이행 및 미국 창고 입고 검수에 이르는 국제 물류 절차를 안내하는 공식 실무 가이드입니다.

---

## 2. 주요 관리 영역 및 핵심 규칙 (Core Modules & Governance)
1. **선적 & 출고 관리 허브 (\`/portal/orders/shipping\`)**:
   - 출고 준비 내역(Goods Readiness): PO 번호, 준비 예정일, 운송 책임, 인계 상태(DRAFT/READY_SUBMITTED/HANDED_OVER).
   - 선적 추적 내역(Shipments): 선적 번호(SHP-XXXX), 배송사(Carrier), ETD, ETA, 선적 상태.
2. **출고 준비 완료 등록 (\`/portal/orders/shipping/new\`)**:
   - 대상 발주서 선택: 승인 및 공급사 확정이 완료된(\`CONFIRMED\`) 발주서만 노출.
   - 4대 실측 패킹 스펙: 준비 완료 수량(Ready Qty), 박스 수(Cartons), 총중량(Gross Weight kg), 체적(CBM m³).
   - 필수 무역 서류: 패킹리스트(Packing List) 및 상업송장(Commercial Invoice) 첨부.
3. **수량 초과 방지 원칙 (Overage Protection)**:
   - 준비 가용 수량(\`availableReadiness\`)을 초과하는 수량 입력 시 붉은색 경고 표시 및 저장 엄격 차단.
4. **운송 책임별 이행 트랙 (Dual-Track Fulfillment)**:
   - **Track 1: LETUSTO_ARRANGED (FOB)**: 본사 지정 포워더 화물 픽업 후 \`[물품 인계 완료 (Handed Over)]\` 클릭.
   - **Track 2: SUPPLIER_ARRANGED (DDP)**: 자체 특송/운송사 발송 후 배송사, 송장/BL 번호, ETD/ETA 등록 (\`IN_TRANSIT\` 자동 전환).
5. **미국 창고 입고 검수 인계 (Warehouse Receiving Handoff)**:
   - 화물 도착(\`ARRIVED\`) 후 창고 실물 바코드 검수 및 3분류 판정: 정상 입고(\`received_qty\`), 파손(\`damaged_qty\`), 보류(\`hold_qty\`).
   - *(도메인 원칙: ARRIVED ≠ RECEIVED, RECEIVED ≠ COMPLETED, Shipping Complete ≠ Settlement Complete)*.

---

## 3. 관련 화면 및 기능 (Related Routes)
- \`/portal/orders/shipping\` (선적 & 출고 관리 허브)
- \`/portal/orders/shipping/new\` (새 출고 준비 등록)
- \`/portal/orders/shipping/[id]\` (출고 준비 상세 및 물류 인계 액션)
- \`/admin/orders/shipments\` (어드민 인바운드 선적 관리)
- \`/admin/orders/shipments/[id]\` (어드민 인바운드 선적 상세)
- \`/admin/warehouse/receiving/[id]\` (어드민 창고 입고 검수 콘솔)`,
    content_en: `# K SELECT Brand Portal Shipping & International Logistics Guide (MAN-B-LOG-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners submitting shipping readiness, uploading trade documents, tracking inbound shipments, and monitoring US warehouse receiving.

## 2. Core Functional Modules
1. **Shipping & Logistics Hub (\`/portal/orders/shipping\`)**: Goods Readiness list & Shipments tracking tabs.
2. **Goods Readiness Registration (\`/portal/orders/shipping/new\`)**: PO selection, 4 packaging specs (Qty, Cartons, Gross Weight, CBM), and document uploads (P/L, C/I).
3. **Overage Protection**: Strict validation blocking submissions exceeding available readiness quota.
4. **Dual-Track Fulfillment**:
   - Track 1: LETUSTO_ARRANGED (FOB) pickup & \`Handed Over\` confirmation.
   - Track 2: SUPPLIER_ARRANGED (DDP) carrier, tracking/BL, ETD/ETA registration.
5. **Warehouse Receiving Handoff**: Physical barcode inspection & 3-way categorization (received, damaged, hold).

## 3. Related Routes
- \`/portal/orders/shipping\`
- \`/portal/orders/shipping/new\`
- \`/portal/orders/shipping/[id]\`
- \`/admin/orders/shipments\`
- \`/admin/orders/shipments/[id]\`
- \`/admin/warehouse/receiving/[id]\``,
    type: "MANUAL",
    source_type: "DOCUMENT",
    linked_system_setting_key: null,
    linked_system_setting_name: null,
    linked_system_setting_value: null,
    module: "LOGISTICS",
    category: "Brand Portal",
    tags: [
      "MANUAL",
      "LOGISTICS",
      "SHIPPING",
      "EXPORT",
      "READINESS",
      "FOB",
      "DDP",
      "CBM",
      "MAN-B-LOG-001",
      "OFFICIAL",
      "물류",
      "선적",
      "출고",
      "입고검수"
    ],
    owner_id: "usr-admin-system",
    owner_name: "K SELECT Operations Team",
    status: "PUBLISHED",
    system_impact_status: "NORMAL",
    system_impact_reason: null,
    system_impact_updated_at: now,
    audience: ["BRAND", "INTERNAL", "ADMIN / MANAGEMENT"],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: "APPROVED",
    external_reviewer_id: "staff-superadmin-01",
    external_reviewed_at: now,
    current_version: "v1.0",
    effective_date: today,
    document_url: "/api/admin/knowledge/asset/asset-shipping-logistics-v10",
    document_name: "MAN-B-LOG-001_Shipping-Logistics_V1.pdf",
    document_size: assetBuf.length,
    document_type: "application/pdf",
    created_at: now,
    updated_at: now
  };

  // 3. Knowledge Version Definition
  const knowledgeVersion = {
    id: "ver-shipping-logistics-v10",
    knowledge_id: "kno-shipping-logistics-v10",
    version: "v1.0",
    status: "PUBLISHED",
    title_ko: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 v1.0",
    title_en: "K SELECT Brand Portal Shipping & International Logistics Guide v1.0",
    summary_ko: "MAN-B-LOG-001 최초 공식 배포 버전 (v1.0)",
    summary_en: "Initial official publication of MAN-B-LOG-001 v1.0.",
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: "MAN-B-LOG-001 Shipping & International Logistics Guide 공식 배포 (v1.0)",
    why_changed: "국제 B2B 공급망 출고 준비, Dual-Track 운송 책임, 무역 서류 업로드 및 창고 입고 검수 프로세스 표준화",
    effective_date: today,
    document_url: "/api/admin/knowledge/asset/asset-shipping-logistics-v10",
    document_name: "MAN-B-LOG-001_Shipping-Logistics_V1.pdf",
    created_by_id: "usr-admin-system",
    created_by_name: "K SELECT Operations Team",
    reviewer_id: "staff-superadmin-01",
    approver_id: "staff-superadmin-01",
    published_at: now,
    created_at: now
  };

  // 4. Knowledge Manual Asset Definition
  const knowledgeAsset = {
    id: "asset-shipping-logistics-v10",
    knowledge_id: "kno-shipping-logistics-v10",
    manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
    version: "v1.0",
    language: "KO",
    is_current: true,
    file_url: "/api/admin/knowledge/asset/asset-shipping-logistics-v10",
    file_name: "MAN-B-LOG-001_Shipping-Logistics_V1.pdf",
    file_size: assetBuf.length,
    published_date: today,
    created_at: now
  };

  // 5. Knowledge Relations Definition
  const knowledgeRelations = [
    {
      id: "rel-log-shipping-hub",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "Shipping & Logistics Hub",
      related_route: "/portal/orders/shipping",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-log-goods-readiness",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "New Goods Readiness",
      related_route: "/portal/orders/shipping/new",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-log-shipping-detail",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Brand Portal",
      related_module: "LOGISTICS",
      related_menu: "Goods Readiness Detail & Handover",
      related_route: "/portal/orders/shipping/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-shipments-mgmt",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Shipments Management",
      related_route: "/admin/orders/shipments",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-shipment-detail",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Inbound Shipment Detail",
      related_route: "/admin/orders/shipments/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    },
    {
      id: "rel-admin-warehouse-receiving",
      knowledge_id: "kno-shipping-logistics-v10",
      related_portal: "Admin",
      related_module: "LOGISTICS",
      related_menu: "Admin Warehouse Receiving Inspection",
      related_route: "/admin/warehouse/receiving/[id]",
      manual_title: "K SELECT Brand Portal 선적 및 국제 물류 관리 매뉴얼 (MAN-B-LOG-001)",
      created_at: now
    }
  ];

  // 6. Execute DB Upserts
  console.log('--- Upserting Knowledge Item ---');
  const { error: itemErr } = await admin.from('knowledge_items').upsert(knowledgeItem, { onConflict: 'id' });
  if (itemErr) {
    console.error('Error upserting knowledge_item:', itemErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Item upserted:', knowledgeItem.id);

  console.log('--- Upserting Knowledge Version ---');
  const { error: verErr } = await admin.from('knowledge_versions').upsert(knowledgeVersion, { onConflict: 'id' });
  if (verErr) {
    console.error('Error upserting knowledge_version:', verErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Version upserted:', knowledgeVersion.id);

  console.log('--- Upserting Knowledge Manual Asset ---');
  const { error: assetErr } = await admin.from('knowledge_manual_assets').upsert(knowledgeAsset, { onConflict: 'id' });
  if (assetErr) {
    console.error('Error upserting knowledge_manual_assets:', assetErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Manual Asset upserted:', knowledgeAsset.id);

  console.log('--- Upserting Knowledge Relations ---');
  for (const rel of knowledgeRelations) {
    const { error: relErr } = await admin.from('knowledge_relations').upsert(rel, { onConflict: 'id' });
    if (relErr) {
      console.error(`Error upserting relation ${rel.id}:`, relErr);
    } else {
      console.log(`✓ Knowledge Relation upserted: ${rel.id} -> ${rel.related_route}`);
    }
  }

  console.log('\n=== Knowledge Publish in DB Completed Successfully ===\n');
}

publishLogKnowledge().catch(console.error);
