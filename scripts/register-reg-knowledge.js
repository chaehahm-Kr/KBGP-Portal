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

async function main() {
  const now = new Date().toISOString();
  
  // 1. Copy published PDF to private_assets/manuals
  const srcPdf = path.join(__dirname, '..', 'Manuals', 'MAN-B-REG-001_Regulatory-Compliance', '03_PUBLISHED', 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf');
  const destDir = path.join(__dirname, '..', 'private_assets', 'manuals');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPdf = path.join(destDir, 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf');
  fs.copyFileSync(srcPdf, destPdf);
  console.log(`Copied published PDF to ${destPdf}`);
  
  const pdfStats = fs.statSync(destPdf);
  console.log(`PDF Size: ${pdfStats.size} bytes`);

  // 2. Insert/Upsert knowledge_items
  const knowledgeItem = {
    id: 'kno-regulatory-compliance-v11',
    slug: 'man-b-reg-001-regulatory-compliance-guide',
    title: 'MAN-B-REG-001: Regulatory, Certification & Compliance User Guide',
    title_ko: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
    title_en: 'K SELECT Brand Portal Regulatory, Certification & Compliance User Guide (MAN-B-REG-001)',
    summary_ko: '미국 화장품 규제 현대화법(MoCRA) 및 FDA 기준에 맞춘 한/미 상표권(KIPO/USPTO), 전성분 실시간 영문 INCI 번역기, 5대 인허가 서류(FDA 등록증, 상표권, COA/MSDS 성분인증, 특허, 기타) 버전 관리 및 식별 바코드(UPC/EAN) 유효성 검증을 위한 공식 사용자 매뉴얼입니다.',
    summary_en: 'Official user manual for K SELECT Brand Portal covering KIPO/USPTO trademark declarations, dual-language ingredient declarations with real-time AI INCI translation, 5 certificate categories with lossless versioning, and UPC/EAN barcode validation.',
    content_ko: `# K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001 v1.1.0)

## 1. 개요 및 매뉴얼 목적 (Introduction & Purpose)
본 매뉴얼은 **K SELECT NETWORK Brand Portal**을 이용하는 브랜드 파트너사가 미국 화장품 규제 현대화법(MoCRA) 및 FDA 규정에 부합하도록 상표권 증빙, 이중언어 전성분(INCI), 5대 인허가 서류(FDA 등록, 상표권, MSDS/COA 성분인증, 특허, 기타) 및 식별 바코드(UPC/EAN)를 체계적으로 관리할 수 있도록 안내하는 공식 실무 가이드입니다.

---

## 2. 4대 규제 관리 영역 (4 Core Compliance Pillars)
1. **상표권 관리 (Policy 02)**: 상표권 미보유 브랜드도 포털 개설 가능하며, 한국(KIPO) 및 미국(USPTO) 등록번호와 증빙 서류(PDF/이미지) 첨부 및 교체 지원.
2. **이중언어 전성분 선언 & AI 번역기**: 국문 전성분 입력 시 화장품 국제 표준 INCI 용어로 실시간 AI 영문 번역 및 원클릭 필드 자동 반영 지원.
3. **5대 인허가 서류 버전 관리**: \`fda_registration\`, \`trademark\`, \`ingredient_certification\`(MSDS/COA), \`patent\`, \`other\` 서류 업로드 및 재업로드 시 \`v1 &rarr; v2\` 무손실 자동 버전 관리.
4. **글로벌 식별 바코드 검증**: 12자리 UPC 또는 13자리 EAN 정규식 유효성 검증 및 바코드 미보유 브랜드를 위한 전용 문의 채널 제공.

---

## 3. 어드민 심사 및 변경 감사 이력
브랜드가 등록한 모든 규제 서류는 어드민 상세 화면(\`/admin/brands/[brandId]\`, \`/admin/products/[id]\`)에서 실시간 대조 검증되며, 모든 수정 내역은 \`product_change_history\`에 불변 감사 로그로 기록됩니다.`,
    content_en: `# K SELECT Brand Portal Regulatory, Certification & Compliance User Guide (MAN-B-REG-001 v1.1.0)

## 1. Introduction & Purpose
Official user guide for K SELECT Brand Portal partners to comply with US MoCRA and FDA cosmetic regulations.

## 2. 4 Core Pillars
- Trademark Management (KIPO / USPTO with Policy 02)
- Dual-Language Ingredients & Real-Time AI INCI Translator
- 5 Certificate Categories (FDA, Trademark, Ingredients/COA/MSDS, Patent, Other) with lossless version control
- UPC (12-digit) / EAN (13-digit) Barcode Validation

## 3. Admin Verification & Audit History
Real-time proof verification in Admin and immutable diff change history logging.`,
    type: 'MANUAL',
    source_type: 'DOCUMENT',
    module: 'REGULATORY',
    category: 'Brand Portal',
    tags: ['MANUAL', 'REGULATORY', 'COMPLIANCE', 'CERTIFICATION', 'TRADEMARK', 'KIPO', 'USPTO', 'INGREDIENTS', 'INCI', 'FDA', 'CERTIFICATE', 'BARCODE', 'MAN-B-REG-001', 'OFFICIAL', '인허가', '상표권', '전성분'],
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
    current_version: 'v1.1.0',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-regulatory-compliance-v11',
    document_name: 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf',
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
    id: 'ver-regulatory-compliance-v11',
    knowledge_id: 'kno-regulatory-compliance-v11',
    version: 'v1.1.0',
    status: 'PUBLISHED',
    title_ko: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 v1.1.0',
    title_en: 'K SELECT Brand Portal Regulatory, Certification & Compliance User Guide v1.1.0',
    summary_ko: 'MAN-B-REG-001 첫 공식 배포 버전 (v1.1.0)입니다.',
    summary_en: 'Initial official publication of MAN-B-REG-001 v1.1.0.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-REG-001 Regulatory, Certification & Compliance User Guide 공식 배포 (v1.1.0)',
    why_changed: '미국 MoCRA 및 FDA 화장품 수출 규정 준수, 상표권 및 인허가 서류 버전 관리 표준화',
    effective_date: '2026-10-01',
    document_url: '/api/admin/knowledge/asset/asset-regulatory-compliance-v11',
    document_name: 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf',
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
    id: 'asset-regulatory-compliance-v11',
    knowledge_id: 'kno-regulatory-compliance-v11',
    manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
    version: 'v1.1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-regulatory-compliance-v11',
    file_name: 'MAN-B-REG-001_Regulatory-Compliance_V1.pdf',
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
      id: 'rel-reg-brand-new',
      knowledge_id: 'kno-regulatory-compliance-v11',
      related_portal: 'Brand Portal',
      related_module: 'REGULATORY',
      related_menu: 'New Brand Trademark Registration',
      related_route: '/portal/brands/new',
      manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
      created_at: now
    },
    {
      id: 'rel-reg-brand-detail',
      knowledge_id: 'kno-regulatory-compliance-v11',
      related_portal: 'Brand Portal',
      related_module: 'REGULATORY',
      related_menu: 'Brand Trademark & Document Edit',
      related_route: '/portal/brands/[id]',
      manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
      created_at: now
    },
    {
      id: 'rel-reg-product-detail',
      knowledge_id: 'kno-regulatory-compliance-v11',
      related_portal: 'Brand Portal',
      related_module: 'REGULATORY',
      related_menu: 'Product Ingredients & Certificates (Tab 1 & 6)',
      related_route: '/portal/products/[id]',
      manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
      created_at: now
    },
    {
      id: 'rel-admin-reg-brand',
      knowledge_id: 'kno-regulatory-compliance-v11',
      related_portal: 'Admin',
      related_module: 'REGULATORY',
      related_menu: 'Admin Brand Trademark Inspection',
      related_route: '/admin/brands/[brandId]',
      manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
      created_at: now
    },
    {
      id: 'rel-admin-reg-product',
      knowledge_id: 'kno-regulatory-compliance-v11',
      related_portal: 'Admin',
      related_module: 'REGULATORY',
      related_menu: 'Admin Product Certificates Audit',
      related_route: '/admin/products/[id]',
      manual_title: 'K SELECT Brand Portal 인허가, 상표권 및 증빙 서류 관리 매뉴얼 (MAN-B-REG-001)',
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
