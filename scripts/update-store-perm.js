const fs = require('fs');
const path = require('path');

const storePath = path.join(process.cwd(), 'lib/knowledge/store.ts');
let content = fs.readFileSync(storePath, 'utf8');

if (content.includes('kno-permissions-user-management-v10')) {
  console.log('kno-permissions-user-management-v10 is already in store.ts');
  process.exit(0);
}

// Item Code
const itemCode = `    {
      id: "kno-permissions-user-management-v10",
      document_url: "/api/admin/knowledge/asset/asset-permissions-user-management-v10",
      document_name: "MAN-B-PERM-001_Permissions-User-Management_V1.pdf",
      document_size: 1441842,
      document_type: "application/pdf",
      slug: "man-b-perm-001-permissions-user-management-guide",
      title: "MAN-B-PERM-001: Permissions & User Management Guide",
      title_ko: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      title_en: "K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001)",
      summary_ko: "K SELECT Brand Portal 소속 팀원 초대, 5대 역할 프리셋(restricted / viewer / staff / manager / admin), 9대 업무 영역 × 4단계 접근 레벨 ACL 매트릭스 설정, 6대 담당 업무 배정(Task Assignment) 및 세이프티 차단 규칙(Initial Owner / Last Admin / Self-delete protection) 통합 운영 매뉴얼",
      summary_en: "Operational guide for team member invitations, 5 role presets (restricted / viewer / staff / manager / admin), 9 ACL categories x 4 levels access matrix, 6 primary contact task assignments, and account safety protections.",
      content_ko: \`# K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001 v1.0)

## 1. 개요 및 권한 구조 (Overview & Architecture)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 회사 소속 멤버를 초대하고, 5대 역할 프리셋 및 9대 업무 영역의 ACL(Access Control List) 매트릭스를 설정하며, 6대 담당 업무를 배정하고 멤버 제거 및 보호 규칙을 관리하는 공식 실무 가이드입니다.

## 2. 5대 역할 프리셋 & 2대 DB 멤버십
- **Role Presets**: restricted(접근 제한), viewer(조회 사용자), staff(담당자), manager(매니저), admin(관리자)
- **DB Membership**: company_admin, company_staff

## 3. 9대 업무 영역 × 4단계 ACL 매트릭스
- **Categories**: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- **Levels**: none(0), read(1), write(2), manage(3)

## 4. 담당 업무 배정 ≠ ACL 권한 경계
6대 담당 업무 배정(company_apply, contract, product_cert, pricing_quote, logistics_inventory, settlement_inquiry)은 운영팀 소통 및 알림 수신 목적이며 포털 메뉴 권한에는 영향을 주지 않습니다.\`,
      content_en: \`# K SELECT Brand Portal Permissions & User Management Guide (MAN-B-PERM-001 v1.0)

## 1. Overview & Architecture
Official user manual for K SELECT Brand Portal partners managing team invitations, 5 role presets, 9-category ACL matrix, 6 primary contact task assignments, and safety protections.

## 2. 5 Role Presets & 2 DB Memberships
- Role Presets: restricted, viewer, staff, manager, admin
- DB Membership: company_admin, company_staff

## 3. 9 Categories x 4 Levels ACL Matrix
- Categories: application, brands, products, orders, finance, support, company_info, bank_info, agreements
- Levels: none, read, write, manage\`,
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
      effective_date: "2026-10-02",
      created_at: now,
      updated_at: now
    }`;

// Version Code
const versionCode = `    {
      id: "ver-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001 v1.0)",
      title_en: "K SELECT Brand Portal Permissions & User Management Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (15-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-permissions-user-management-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-permissions-user-management-v10")?.content_en || "",
      what_changed: "MAN-B-PERM-001 Permissions & User Management Guide 공식 배포 (v1.0)",
      why_changed: "브랜드 파트너사 사용자 초대, 권한 설정, 업무 배정 및 안전 계정 정책 가이드 정립",
      effective_date: "2026-10-02",
      created_by_name: "Brand Operations Desk",
      published_at: now,
      created_at: now
    }`;

// Relation Code
const relationCode = `    {
      id: "rel-perm-company-users",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Company & User Management",
      related_route: "/portal/company/users",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    },
    {
      id: "rel-perm-invite-accept",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "Invite Accept & Onboarding",
      related_route: "/portal/invite/accept",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    },
    {
      id: "rel-perm-my-account",
      knowledge_id: "kno-permissions-user-management-v10",
      related_portal: "Brand Portal",
      related_module: "COMPANY",
      related_menu: "My Account Settings",
      related_route: "/portal/account",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      created_at: now
    }`;

// Asset Code
const assetCode = `    {
      id: "asset-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      manual_title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드 (MAN-B-PERM-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-permissions-user-management-v10",
      file_name: "MAN-B-PERM-001_Permissions-User-Management_V1.pdf",
      file_size: 1441842,
      published_date: "2026-10-02",
      created_at: now
    }`;

// Log Code
const logCode = `    {
      id: "log-permissions-user-management-v10",
      knowledge_id: "kno-permissions-user-management-v10",
      user_id: "user-admin-01",
      user_name: "Brand Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 사용자, 역할 및 권한 관리 가이드", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-PERM-001 Official Publication",
      created_at: now
    }`;

// Precise insertion right before closing bracket of array assignments:
// 1. memoryItems insertion (before `memoryTopics = [`)
const topicsPos = content.indexOf('memoryTopics = [');
const itemInsertPos = content.lastIndexOf('    }', topicsPos);
content = content.slice(0, itemInsertPos + 5) + ',\n' + itemCode + content.slice(itemInsertPos + 5);

// 2. memoryVersions insertion (before `memoryRelations = [`)
const relationsPos = content.indexOf('memoryRelations = [');
const verInsertPos = content.lastIndexOf('    }', relationsPos);
content = content.slice(0, verInsertPos + 5) + ',\n' + versionCode + content.slice(verInsertPos + 5);

// 3. memoryRelations insertion (before `memoryAssets = [`)
const assetsPos = content.indexOf('memoryAssets = [');
const relInsertPos = content.lastIndexOf('    }', assetsPos);
content = content.slice(0, relInsertPos + 5) + ',\n' + relationCode + content.slice(relInsertPos + 5);

// 4. memoryAssets insertion (before `memoryLogs = [`)
const logsPos = content.indexOf('memoryLogs = [');
const assetInsertPos = content.lastIndexOf('    }', logsPos);
content = content.slice(0, assetInsertPos + 5) + ',\n' + assetCode + content.slice(assetInsertPos + 5);

// 5. memoryLogs insertion (before `memoryTriggers = [`)
const triggersPos = content.indexOf('memoryTriggers = [');
const logInsertPos = content.lastIndexOf('    }', triggersPos);
content = content.slice(0, logInsertPos + 5) + ',\n' + logCode + content.slice(logInsertPos + 5);

fs.writeFileSync(storePath, content, 'utf8');
console.log('Successfully inserted PERM Knowledge into store.ts!');
