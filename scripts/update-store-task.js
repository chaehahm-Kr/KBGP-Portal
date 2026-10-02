const fs = require('fs');
const path = require('path');

const storePath = path.join(process.cwd(), 'lib/knowledge/store.ts');
let content = fs.readFileSync(storePath, 'utf8');

if (content.includes('kno-task-communication-v10')) {
  console.log('kno-task-communication-v10 is already in store.ts');
  process.exit(0);
}

// Item Code
const itemCode = `    {
      id: "kno-task-communication-v10",
      document_url: "/api/admin/knowledge/asset/asset-task-communication-v10",
      document_name: "MAN-B-TASK-001_Task-Communication_V1.pdf",
      document_size: 3664407,
      document_type: "application/pdf",
      slug: "man-b-task-001-task-communication-guide",
      title: "MAN-B-TASK-001: Task & Communication Guide",
      title_ko: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      title_en: "K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001)",
      summary_ko: "K SELECT Brand Portal 1:1 문의(partner_inquiries) 접수, 9대 업무 카테고리 분류, 4단계 케이스 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT), 교차 도메인 연동(PO 변경 real FK vs 정산/계약 prefill), support ACL(none/read/write/manage), 인앱/이메일 알림 규칙 및 20MB 첨부파일 보안 통합 가이드",
      summary_en: "Operational guide for Brand Portal 1:1 support inquiries (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, cross-domain linking, support ACL permissions, notifications, and 20MB private storage security.",
      content_ko: \`# K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001 v1.0)

## 1. 개요 및 파이프라인 구조 (Introduction & Pipeline)
본 매뉴얼은 **K SELECT NETWORK Brand Portal** 파트너사가 운영팀과의 1:1 문의(partner_inquiries) 접수 및 소통, 9대 업무 카테고리 분류, 4단계 상태 라이프사이클(RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), 만족도 평가(CSAT) 및 교차 도메인 연동을 관리하는 공식 실무 가이드입니다.

## 2. 핵심 경계 정의 (Critical Boundaries)
- **PERM ↔ TASK 경계**: PERM(company_task_assignments)의 6대 주 담당자는 소통 책임자 지정 및 알림 라우팅 용도이며, TASK(partner_inquiries)의 실시간 1:1 지원 케이스와 독립 구분됩니다.
- **어드민 내부 일감 경계**: /admin/tasks (public.tasks)는 운영팀 내부 작업 프로토타입이며 파트너 문의 케이스와 직접 연결되지 않습니다.
- **CLOSE ≠ CSAT**: 케이스 종결(CLOSED) 상태 전환과 CSAT 평가 제출은 별개 단계입니다.
- **교차 도메인 연동**: PO 변경 문의는 real DB FK(related_po_id)로 연결되며, 정산/계약 문의는 Pre-populated Context 방식으로 연동됩니다.\`,
      content_en: \`# K SELECT Brand Portal Task & Communication Guide (MAN-B-TASK-001 v1.0)

## 1. Overview & Pipeline Structure
Official user manual for K SELECT Brand Portal partners to submit and track 1:1 support cases (partner_inquiries), 9 categories, 4 case statuses (RECEIVED, UNDER_REVIEW, ACTION_REQUIRED, CLOSED), CSAT evaluation, and cross-domain linking.

## 2. Critical Boundaries
- PERM vs TASK: company_task_assignments (6 primary owner routing) vs partner_inquiries (dynamic 1:1 cases).
- Internal Admin Prototype: public.tasks / /admin/tasks is an unlinked internal prototype.
- CLOSE != CSAT: Case close and CSAT evaluation are separate steps.
- Cross-Domain FK: PO Change has real DB FK (related_po_id), while Settlement/Agreement uses Context Prefill.\`,
      type: "MANUAL",
      source_type: "CONTENT",
      module: "TASK",
      category: "Brand Portal",
      tags: ["MANUAL", "TASK", "SUPPORT", "INQUIRY", "COMMUNICATION", "PARTNER_INQUIRIES", "ACTION_REQUIRED", "CSAT", "ACL", "SUPPORT_DESK", "MAN-B-TASK-001", "OFFICIAL", "문의", "소통", "지원센터", "1대1문의", "케이스"],
      owner_id: "staff-support-01",
      owner_name: "Support Operations Desk",
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
      id: "ver-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      version: "v1.0",
      status: "PUBLISHED",
      title_ko: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001 v1.0)",
      title_en: "K SELECT Brand Portal Task & Communication Guide v1.0",
      summary_ko: "최초 공식 발행 버전 (22-Page Published PDF 배포)",
      summary_en: "Initial official published manual version",
      content_ko: memoryItems.find(i => i.id === "kno-task-communication-v10")?.content_ko || "",
      content_en: memoryItems.find(i => i.id === "kno-task-communication-v10")?.content_en || "",
      what_changed: "MAN-B-TASK-001 Task & Communication Guide 공식 배포 (v1.0)",
      why_changed: "브랜드 파트너사 1:1 문의 접수, 4단계 케이스 라이프사이클, CSAT 만족도 평가 및 교차 도메인 연동 가이드 정립",
      effective_date: "2026-10-02",
      created_by_name: "Support Operations Desk",
      published_at: now,
      created_at: now
    }`;

// Relation Code
const relationCode = `    {
      id: "rel-task-support-hub",
      knowledge_id: "kno-task-communication-v10",
      related_portal: "Brand Portal",
      related_module: "TASK",
      related_menu: "Support Center & 1:1 Inquiries",
      related_route: "/portal/support",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      created_at: now
    },
    {
      id: "rel-admin-task-inquiries",
      knowledge_id: "kno-task-communication-v10",
      related_portal: "Admin",
      related_module: "TASK",
      related_menu: "Admin Partner Inquiries Management",
      related_route: "/admin/partner-inquiries",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      created_at: now
    }`;

// Asset Code
const assetCode = `    {
      id: "asset-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      manual_title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼 (MAN-B-TASK-001)",
      version: "v1.0",
      language: "KO",
      is_current: true,
      file_url: "/api/admin/knowledge/asset/asset-task-communication-v10",
      file_name: "MAN-B-TASK-001_Task-Communication_V1.pdf",
      file_size: 3664407,
      published_date: "2026-10-02",
      created_at: now
    }`;

// Log Code
const logCode = `    {
      id: "log-task-communication-v10",
      knowledge_id: "kno-task-communication-v10",
      user_id: "user-admin-01",
      user_name: "Support Operations Desk",
      action: "Published",
      previous_value: {},
      new_value: { title: "K SELECT Brand Portal 1:1 문의 및 비즈니스 소통 관리 매뉴얼", audience: ["BRAND", "INTERNAL"] },
      reason: "MAN-B-TASK-001 Official Publication",
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
console.log('Successfully inserted TASK Knowledge into store.ts!');
