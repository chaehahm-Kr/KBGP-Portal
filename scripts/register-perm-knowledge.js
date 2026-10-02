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

async function publishPermKnowledge() {
  console.log('====================================================');
  console.log('MAN-B-PERM-001 KNOWLEDGE CENTER PRODUCTION PUBLISH');
  console.log('====================================================');

  // 1. Verify Source PDF & Private Asset SHA
  const sourcePdfPath = path.join(process.cwd(), 'Manuals/MAN-B-PERM-001_Permissions-User-Management/03_PUBLISHED/MAN-B-PERM-001_Permissions-User-Management_V1.pdf');
  const destDir = path.join(process.cwd(), 'private_assets/manuals');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const assetPdfPath = path.join(destDir, 'MAN-B-PERM-001_Permissions-User-Management_V1.pdf');

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
  const today = '2026-10-02';

  // 2. Knowledge Item Definition
  const knowledgeItem = {
    id: "kno-permissions-user-management-v10",
    slug: "man-b-perm-001-permissions-user-management-guide",
    title: "MAN-B-PERM-001: Permissions & User Management Guide",
    title_ko: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
    title_en: "K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001)",
    summary_ko: "K SELECT Brand Portal 소속 팀원 초대, 5대 역할 프리셋(restricted / viewer / staff / manager / admin), 9대 업무 영역 × 4단계 접근 레벨 ACL 매트릭스 설정, 6대 담당 업무 배정(Task Assignment) 및 세이프티 차단 규칙(Initial Owner / Last Admin / Self-delete protection) 통합 운영 매뉴얼",
    summary_en: "Operational guide for team member invitations, 5 role presets (restricted / viewer / staff / manager / admin), 9 ACL categories x 4 levels access matrix, 6 primary contact task assignments, and account safety protections.",
    content_ko: `# K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001 v1.0)

## 1. 개요 및 권한 구조 (Overview & Architecture)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 회사 소속 멤버를 초대하고, 5대 역할 프리셋 및 9대 업무 영역의 ACL(Access Control List) 매트릭스를 설정하며, 6대 담당 업무를 배정하고 멤버 제거 및 보호 규칙을 관리하는 공식 실무 가이드입니다.

## 2. 5대 역할 프리셋 & 2대 DB 멤버십
- **Role Presets**: restricted(접근 제한), viewer(조회 사용자), staff(담당자), manager(매니저), admin(관리자)
- **DB Membership**: company_admin, company_staff

## 3. 9대 업무 영역 × 4단계 ACL 매트릭스
- **Categories**: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- **Levels**: none(0), read(1), write(2), manage(3)

## 4. 담당 업무 배정 ≠ ACL 권한 경계
6대 담당 업무 배정(company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry)은 운영팀 소통 및 알림 수신 목적이며 포털 메뉴 권한에는 영향을 주지 않습니다.`,
    content_en: `# K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001 v1.0)

## 1. Overview & Architecture
Official user manual for K SELECT Brand Portal partners managing team invitations, 5 role presets, 9-category ACL matrix, 6 primary contact task assignments, and safety protections.

## 2. 5 Role Presets & 2 DB Memberships
- Role Presets: restricted, viewer, staff, manager, admin
- DB Membership: company_admin, company_staff

## 3. 9 Categories x 4 Levels ACL Matrix
- Categories: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- Levels: none, read, write, manage`,
    type: "MANUAL",
    source_type: "CONTENT",
    module: "COMPANY",
    category: "Brand Portal",
    tags: ["MANUAL", "PERMISSIONS", "USERS", "COMPANY", "ACL", "ROLES", "PRESETS", "TASK_ASSIGNMENT", "MAN-B-PERM-001", "OFFICIAL", "권한", "사용자", "팀원", "역할"],
    owner_id: "staff-admin-01",
    owner_name: "Brand Operations Desk",
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

  // Upsert Knowledge Item into DB
  const { error: itemErr } = await admin
    .from('knowledge_items')
    .upsert(knowledgeItem, { onConflict: 'id' });

  if (itemErr) {
    console.error('Error upserting knowledge item:', itemErr);
    process.exit(1);
  }
  console.log('✓ Knowledge Item kno-permissions-user-management-v10 registered in DB');

  // 3. Upsert Version Record
  const versionRecord = {
    id: 'ver-permissions-user-management-v10',
    knowledge_id: 'kno-permissions-user-management-v10',
    version_tag: 'v1.0',
    title_ko: 'K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 v1.0',
    title_en: 'K SELECT Brand Portal Permissions & User Management Guide v1.0',
    summary_ko: 'MAN-B-PERM-001 첫 공식 배포 버전입니다.',
    summary_en: 'Initial official publication of MAN-B-PERM-001.',
    content_ko: knowledgeItem.content_ko,
    content_en: knowledgeItem.content_en,
    what_changed: 'MAN-B-PERM-001 Brand Portal Permissions & User Management Guide 최초 공식 배포 (5대 역할 프리셋 & 9대 ACL 매트릭스)',
    why_changed: '브랜드 파트너사 사용자 초대, 권한 설정, 업무 배정 및 안전 계정 정책 가이드 정립',
    effective_date: today,
    document_url: '/api/admin/knowledge/asset/asset-permissions-user-management-v10',
    document_name: 'MAN-B-PERM-001_Permissions-User-Management_V1.pdf',
    created_by_id: 'usr-admin-system',
    created_by_name: 'K SELECT Operations Team',
    reviewer_id: 'staff-superadmin-01',
    approver_id: 'staff-superadmin-01',
    published_at: now,
    created_at: now
  };

  await admin.from('knowledge_versions').upsert(versionRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Version ver-permissions-user-management-v10 registered in DB');

  // 4. Upsert Asset Record
  const assetRecord = {
    id: 'asset-permissions-user-management-v10',
    knowledge_id: 'kno-permissions-user-management-v10',
    manual_title: 'K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)',
    version: 'v1.0',
    language: 'KO',
    is_current: true,
    file_url: '/api/admin/knowledge/asset/asset-permissions-user-management-v10',
    file_name: 'MAN-B-PERM-001_Permissions-User-Management_V1.pdf',
    file_size: pdfStats.size,
    published_date: today,
    created_at: now
  };

  await admin.from('knowledge_manual_assets').upsert(assetRecord, { onConflict: 'id' });
  console.log('✓ Knowledge Asset asset-permissions-user-management-v10 registered in DB');

  // 5. Upsert Relations
  const relations = [
    {
      id: 'rel-perm-company-users',
      knowledge_id: 'kno-permissions-user-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'COMPANY',
      related_menu: 'Company & User Management',
      related_route: '/portal/company/users',
      manual_title: 'K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)',
      created_at: now
    },
    {
      id: 'rel-perm-invite-accept',
      knowledge_id: 'kno-permissions-user-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'COMPANY',
      related_menu: 'Invite Accept & Onboarding',
      related_route: '/portal/invite/accept',
      manual_title: 'K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)',
      created_at: now
    },
    {
      id: 'rel-perm-my-account',
      knowledge_id: 'kno-permissions-user-management-v10',
      related_portal: 'Brand Portal',
      related_module: 'COMPANY',
      related_menu: 'My Account Settings',
      related_route: '/portal/account',
      manual_title: 'K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)',
      created_at: now
    }
  ];

  await admin.from('knowledge_relations').upsert(relations, { onConflict: 'id' });
  console.log('✓ Knowledge Relations registered in DB');

  console.log('\n====================================================');
  console.log('MAN-B-PERM-001 KNOWLEDGE CENTER PUBLISH COMPLETE');
  console.log('====================================================');
}

publishPermKnowledge().catch(err => {
  console.error('Publish failed:', err);
  process.exit(1);
});
