const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);

async function main() {
  const now = new Date().toISOString();
  
  // 1. Copy published PDF to private_assets/manuals
  const srcPdf = path.join(__dirname, '..', 'Manuals', 'MAN-B-ORD-001_Order-Management', '03_PUBLISHED', 'MAN-B-ORD-001_Order-Management_V1.pdf');
  const destDir = path.join(__dirname, '..', 'private_assets', 'manuals');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPdf = path.join(destDir, 'MAN-B-ORD-001_Order-Management_V1.pdf');
  fs.copyFileSync(srcPdf, destPdf);
  console.log(`Copied published PDF to ${destPdf}`);
  
  const pdfStats = fs.statSync(destPdf);
  console.log(`PDF Size: ${pdfStats.size} bytes`);

  // 2. Insert/Upsert knowledge_items
  const knowledgeItem = {
    id: 'kno-order-management-v10',
    slug: 'man-b-ord-001-order-management-guide',
    title: 'MAN-B-ORD-001: Brand Portal Order Management & Purchase Order Guide',
    title_ko: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
    title_en: 'K SELECT Brand Portal Order Management & Purchase Order Guide (MAN-B-ORD-001)',
    summary_ko: 'K SELECT Brand Portal의 발주 요청(PO Request) 승인/거절, 정식 발주서(Official Purchase Order) 6단계 라이프사이클(ISSUED → SUPPLIER_CONFIRMED → PRODUCTION → PREPARING_SHIPMENT → SHIPPED → COMPLETED), 공급자 주문 확정, 물류 출고 연결, 인보이스(Invoice) 청구 자격 및 물류센터 입고/검수 종결을 위한 공식 사용자 매뉴얼입니다.',
    summary_en: 'Official user manual for K SELECT Brand Portal covering Retailer Purchase Requests, Official Purchase Order 6-step lifecycle (ISSUED -> SUPPLIER_CONFIRMED -> PRODUCTION -> PREPARING_SHIPMENT -> SHIPPED -> COMPLETED), supplier confirmation, logistics shipment, invoice eligibility, and warehouse receiving completion.',
    content_ko: `# K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001 v1.0)

## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 입점 브랜드 파트너사가 바이어/리테일러의 구매 의사 타진 단계인 **발주 요청(PO Request)**을 검토하고, 정식 계약 문서인 **발주서(Official Purchase Order)**의 6단계 라이프사이클에 따라 납기 확인, 공급자 승인, 물류 출고 및 정산 인보이스 청구까지 안전하게 완수할 수 있도록 제작된 공식 실무 가이드입니다.

---

## 2. 2-Phase 오더 아키텍처 (Two-Phase Order Architecture)
K SELECT 오더 시스템은 법적 구속력과 재고 할당 시점을 명확히 분리하기 위해 2단계 아키텍처를 적용합니다.
1. **Phase 1: 발주 요청 (Purchase Order Request)**: 바이어가 제품 구매 의사를 타진하는 사전 조율 단계입니다.
   - 3대 상태: \`PENDING\` (검토 대기), \`APPROVED\` (승인 완료), \`REJECTED\` (사유 명시 거절).
   - 상태 불변 원칙: 승인 또는 거절 처리 시 상태는 즉시 동결(Frozen)되며 되돌릴 수 없습니다.
2. **Phase 2: 정식 발주서 (Official Purchase Order)**: 법적 구속력을 갖는 정식 납품 계약입니다.
   - 전제 조건: \`APPROVED\`된 발주 요청에 대해 관리자가 정식 PO 번호(\`PO-YYYYMMDD-XXXX\`)를 부여하여 발행합니다.

---

## 3. 정식 PO 6단계 표준 라이프사이클 (Official PO 6-Step Lifecycle)
1. **1단계: 발주서 발행 (ISSUED)**: Admin이 정식 PO를 발행한 초기 상태입니다. 브랜드는 품목, 단가, 수량, 납기일을 검토합니다.
2. **2단계: 공급자 주문 확정 (SUPPLIER_CONFIRMED)**: 브랜드가 납기 및 생산 일정을 최종 승낙(Supplier Confirmation)한 상태입니다.
   - **중요 도메인 규칙**: \`supplier_confirmation_status = 'CONFIRMED'\` 완료 시 **MAN-B-FIN-001 (인보이스 및 정산)** 도메인으로 공급자 인보이스(Supplier Invoice) 청구 자격이 활성화됩니다.
3. **3단계: 생산 중 (PRODUCTION)**: 승인된 수량에 대해 제품 생산 또는 1차 포장 공정을 진행하는 단계입니다.
4. **4단계: 출고 준비 (PREPARING_SHIPMENT)**: 생산 완료 후 마스터 카톤 패킹, 바코드 라벨링, 선적 서류를 준비하는 단계입니다.
5. **5단계: 배송 중 (SHIPPED)**: 3PL 운송사에 화물을 인계하고 B/L 또는 트래킹 번호가 등록된 상태입니다.
6. **6단계: 입고/오더 완료 (COMPLETED)**: 미국 현지 물류센터(Fulfillment Center)에 화물이 실물 도착하여 입고 검수를 통과하고, 오더 이행이 최종 종결된 상태입니다.
   - **도메인 경계 주의**: \`COMPLETED\`는 물류센터 검수 및 오더 이행 종결(Order Fulfillment Completed)을 의미하며, 대금 정산 완료(\`PAID\`)와는 병렬로 독립 운영됩니다.

---

## 4. 4대 독립 상태 차원 (Status Dimensions)
1. **발주 요청 상태 (Request Status)**: \`PENDING\` / \`APPROVED\` / \`REJECTED\`
2. **공급자 확정 상태 (Supplier Confirmation Status)**: \`DRAFT\` / \`PENDING_CONFIRMATION\` / \`CONFIRMED\` / \`REJECTED\`
3. **오더 이행 상태 (Fulfillment Status)**: \`ISSUED\` → \`SUPPLIER_CONFIRMED\` → \`PRODUCTION\` → \`PREPARING_SHIPMENT\` → \`SHIPPED\` → \`COMPLETED\`
4. **결제 및 정산 상태 (Payment / Settlement Status)**: \`UNPAID\` / \`PARTIALLY_PAID\` / \`PAID\` (MAN-B-FIN-001 연계)

---

## 5. 도메인 연계 가이드
- **MAN-B-PROD-001 (상품 등록 & 관리)**: PO 품목의 SKU, FOB 수출가, 마스터 카톤 규격 원천 데이터 제공.
- **MAN-B-LOG-001 (배송 & 물류)**: \`PREPARING_SHIPMENT\` → \`SHIPPED\` 전환 시 화물 인계 및 트래킹 추적 연동.
- **MAN-B-FIN-001 (인보이스 & 정산)**: \`SUPPLIER_CONFIRMED\` 상태 달성 후 공급자 인보이스 발행 및 판매대금 지급 정산 연동.`,
    content_en: `# K SELECT Brand Portal Order Management Guide (MAN-B-ORD-001 v1.0)

## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to review Retailer Purchase Requests and execute Official Purchase Orders through the 6-step lifecycle.

## 2. Two-Phase Order Architecture
- Phase 1: Purchase Order Requests (/portal/orders/requests) - PENDING, APPROVED, REJECTED
- Phase 2: Official Purchase Orders (/portal/orders/purchase-orders) - Official POs

## 3. Official PO 6-Step Lifecycle
1. ISSUED
2. SUPPLIER_CONFIRMED (Eligible for Supplier Invoice in MAN-B-FIN-001)
3. PRODUCTION
4. PREPARING_SHIPMENT
5. SHIPPED
6. COMPLETED (Order Fulfillment Completed upon warehouse receiving inspection)

## 4. Status Dimensions & Domain Boundaries
- Parallel domain operation: Logistics (MAN-B-LOG-001) & Finance (MAN-B-FIN-001)
- COMPLETED means order fulfillment closed; PAID is managed in Finance.`,
    type: 'MANUAL',
    source_type: 'DOCUMENT',
    module: 'ORDERS',
    category: 'Brand Portal',
    tags: ['MANUAL', 'ORDERS', 'PURCHASE_ORDER', 'PO', 'PO_REQUEST', 'ORDER_MANAGEMENT', 'LOGISTICS', 'GUIDE', 'BRAND', 'MAN-B-ORD-001', 'OFFICIAL', '발주', '오더', '발주관리', '발주서', 'PURCHASING'],
    owner_id: 'usr-admin-system',
    owner_name: 'K SELECT Operations Team',
    status: 'PUBLISHED',
    system_impact_status: 'NORMAL',
    system_impact_reason: null,
    system_impact_updated_at: now,
    audience: ['BRAND', 'INTERNAL', 'ADMIN / MANAGEMENT'],
    is_sensitive_internal: false,
    requires_external_approval: true,
    external_review_status: 'APPROVED',
    external_reviewer_id: 'staff-superadmin-01',
    external_reviewed_at: now,
    current_version: 'v1.0',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-order-management-v10',
    document_name: 'MAN-B-ORD-001_Order-Management_V1.pdf',
    document_size: pdfStats.size,
    document_type: 'application/pdf',
    created_at: now,
    updated_at: now
  };

  console.log('Upserting knowledge_items:', knowledgeItem.id);
  const { data: itemData, error: itemError } = await supabase
    .from('knowledge_items')
    .upsert(knowledgeItem)
    .select();

  if (itemError) {
    console.error('Error upserting knowledge_item:', itemError);
  } else {
    console.log('Successfully upserted knowledge_item:', itemData[0].id);
  }

  // 3. Insert/Upsert knowledge_versions
  const versionRecord = {
    id: 'ver-order-management-v10',
    knowledge_id: 'kno-order-management-v10',
    version: 'v1.0',
    status: 'PUBLISHED',
    title_ko: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 v1.0',
    title_en: 'K SELECT Brand Portal Order Management & Purchase Order Guide v1.0',
    summary_ko: 'MAN-B-ORD-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-B-ORD-001.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-ORD-001 Brand Portal Order Management Guide 최초 공식 배포 (2-Phase 아키텍처 및 6단계 PO 라이프사이클)',
    why_changed: '브랜드 파트너사 발주 요청 검토 및 정식 PO 이행 표준 절차 가이드 정립',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-order-management-v10',
    document_name: 'MAN-B-ORD-001_Order-Management_V1.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  console.log('Upserting knowledge_versions:', versionRecord.id);
  const { data: verData, error: verError } = await supabase
    .from('knowledge_versions')
    .upsert(versionRecord)
    .select();

  if (verError) {
    console.error('Error upserting knowledge_version:', verError);
  } else {
    console.log('Successfully upserted knowledge_version:', verData[0].id);
  }

  // 4. Insert/Upsert knowledge_manual_assets
  const assetRecord = {
    id: 'asset-order-management-v10',
    knowledge_id: 'kno-order-management-v10',
    manual_title: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-order-management-v10',
    file_name: 'MAN-B-ORD-001_Order-Management_V1.pdf',
    file_size: pdfStats.size,
    published_date: '2026-10-01',
    created_at: now
  };

  console.log('Upserting knowledge_manual_assets:', assetRecord.id);
  const { data: assetData, error: assetError } = await supabase
    .from('knowledge_manual_assets')
    .upsert(assetRecord)
    .select();

  if (assetError) {
    console.error('Error upserting knowledge_manual_assets:', assetError);
  } else {
    console.log('Successfully upserted knowledge_manual_assets:', assetData[0].id);
  }

  // 5. Insert/Upsert knowledge_relations
  const relations = [
    {
      id: 'rel-order-requests',
      knowledge_id: 'kno-order-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'ORDERS',
      related_menu: 'Purchase Order Requests',
      related_route: '/portal/orders/requests',
      manual_title: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
      created_at: now
    },
    {
      id: 'rel-order-purchase-orders',
      knowledge_id: 'kno-order-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'ORDERS',
      related_menu: 'Purchase Orders',
      related_route: '/portal/orders/purchase-orders',
      manual_title: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
      created_at: now
    },
    {
      id: 'rel-order-shipping',
      knowledge_id: 'kno-order-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'ORDERS',
      related_menu: 'Shipments & Tracking',
      related_route: '/portal/orders/shipping',
      manual_title: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
      created_at: now
    },
    {
      id: 'rel-admin-orders-mgmt',
      knowledge_id: 'kno-order-management-v10',
      related_portal: 'Admin',
      related_module: 'ORDERS',
      related_menu: 'Purchase Orders Management',
      related_route: '/admin/orders',
      manual_title: 'K SELECT Brand Portal 발주 요청 및 오더 관리 매뉴얼 (MAN-B-ORD-001)',
      created_at: now
    }
  ];

  console.log('Upserting knowledge_relations...');
  const { data: relData, error: relError } = await supabase
    .from('knowledge_relations')
    .upsert(relations)
    .select();

  if (relError) {
    console.error('Error upserting knowledge_relations:', relError);
  } else {
    console.log(`Successfully upserted ${relData.length} relations`);
  }

  console.log('\n--- VERIFICATION QUERY ---');
  const { data: pubItems } = await supabase
    .from('knowledge_items')
    .select('id, title, status, current_version, document_name')
    .eq('status', 'PUBLISHED');

  console.log(`Total PUBLISHED items in DB: ${pubItems.length}`);
  pubItems.forEach(i => console.log(` - [${i.id}] ${i.title} (${i.current_version}) | File: ${i.document_name}`));
}

main().catch(console.error);
