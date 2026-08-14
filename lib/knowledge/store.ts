import {
  KnowledgeItem,
  KnowledgeVersion,
  KnowledgeRelation,
  ManualAsset,
  KnowledgeAuditLog,
  SystemImpactTrigger,
  KnowledgeFilterOptions,
  SecurityUserContext
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

// In-Memory Seed Storage for Fallback and State Guarantee
let INITIALIZED = false;

let memoryItems: KnowledgeItem[] = [];
let memoryVersions: KnowledgeVersion[] = [];
let memoryRelations: KnowledgeRelation[] = [];
let memoryAssets: ManualAsset[] = [];
let memoryLogs: KnowledgeAuditLog[] = [];
let memoryTriggers: SystemImpactTrigger[] = [];

export function initSeedData() {
  if (INITIALIZED) return;

  const now = new Date().toISOString();
  const today = new Date().toISOString().split("T")[0];

  memoryItems = [
    {
      id: "kno-001-internal-manual",
      slug: "admin-sourcing-sop-v1",
      title: "Admin Brand Sourcing & Verification Operations SOP",
      title_ko: "관리자 브랜드 소싱 및 검증 표준 운영 절차 (SOP)",
      title_en: "Admin Brand Sourcing & Verification Operations SOP",
      summary_ko: "신규 K-뷰티 브랜드 입점 신청서 검증, 내부 마진율 조건 및 규정 준수 평가 프로세스",
      summary_en: "Standard operating procedure for verifying new K-Beauty brand applications and compliance.",
      content_ko: `## 1. 개요 (Overview)
본 SOP는 K SELECT NETWORK 내부 관리자가 신규 한국 브랜드사의 입점 신청서를 검증할 때 준수해야 하는 표준 절차입니다.

## 2. 세부 검증 절차 (Verification Process)
- **사업자 등록증 검증**: 한국 국세청 사업자 등록 상태 확인
- **FDA MoCRA 등록 여부**: 미국 수출 가능 여부 1차 스크리닝
- **내부 마진율 타당성**: 최소 65% 이상의 FOB 마진 보장 여부 검토

> [!IMPORTANT]
> 본 문서는 Letusto 내부 전용 보안 문서(INTERNAL ONLY)입니다. 브랜드사 또는 리테일러에게 절대로 전달하거나 노출해서는 안 됩니다.`,
      content_en: `## 1. Overview
Standard procedure for internal managers verifying new brand applications.

## 2. Verification Process
- Business registration check
- FDA MoCRA compliance screening
- Internal margin logic validation (Min 65% FOB margin)`,
      type: "SOP",
      source_type: "CONTENT",
      category: "OPERATIONS",
      tags: ["SOP", "Internal", "Sourcing", "Verification"],
      owner_id: "staff-admin-01",
      owner_name: "Operations Governance Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL"],
      is_sensitive_internal: true,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.2",
      effective_date: today,
      created_at: "2026-08-01T10:00:00Z",
      updated_at: now
    },
    {
      id: "kno-002-brand-faq",
      slug: "brand-partner-onboarding-faq",
      title: "Brand Partner Onboarding & Product Listing FAQ",
      title_ko: "브랜드 파트너 온보딩 및 제품 등록 안내 FAQ",
      title_en: "Brand Partner Onboarding & Product Listing FAQ",
      summary_ko: "미국 유통 네트워크 입점을 원하는 한국 브랜드사를 위한 자주 묻는 질문 및 절차 안내",
      summary_en: "Frequently asked questions and guides for Korean brand partners entering US retail network.",
      content_ko: `## Q1. K SELECT NETWORK 입점 자격 요건은 무엇인가요?
미국 시장 진출을 희망하는 정식 등록 한국 화장품 브랜드사로서, FDA 등록 및 영문 성분표 준비가 완료된 제품을 보유한 기업입니다.

## Q2. 제품 등록 시 필수 서류는 무엇인가요?
1. 전성분 표 (국문 및 영문)
2. 제품 고화질 누끼 이미지 (최소 1장)
3. FDA / MoCRA 관련 등록 증빙 문서`,
      content_en: `## Q1. What are the qualification criteria?
Korean cosmetic brands with FDA registration and English ingredient lists looking to enter the US market.

## Q2. What documents are required?
1. Full ingredient list (KO & EN)
2. Product high-resolution image
3. FDA / MoCRA compliance documents`,
      type: "FAQ",
      source_type: "CONTENT",
      category: "ONBOARDING",
      tags: ["FAQ", "Brand", "Onboarding", "Registration"],
      owner_id: "staff-admin-02",
      owner_name: "Brand Sourcing Team",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["BRAND", "PUBLIC"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-08-05T14:30:00Z",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-05T09:00:00Z",
      updated_at: now
    },
    {
      id: "kno-003-hybrid-setting-rule",
      slug: "insights-editorial-topic-score-policy",
      title: "Insights Auto-Engine Topic Score Threshold Rule",
      title_ko: "인사이트 자동 발행 엔진 최소 토픽 스코어 정책 (System Rule)",
      title_en: "Insights Engine Minimum Topic Score Policy",
      summary_ko: "인사이트 자동 생성 엔진이 초안 작성을 승인하기 위한 최소 밸류에이션 점수 80점 정책",
      summary_en: "Minimum topic score threshold policy (80 points) required for AI insights engine candidate qualification.",
      content_ko: `## 1. 정책 개요 (Policy Overview)
K SELECT Insights Engine은 스캐닝된 시장 기사 및 데이터 중 최소 토픽 스코어가 기준 이상인 경우에만 AI Draft를 자동 생성합니다.

## 2. 라이브 연동 시스템 설정 (Live Linked System Setting)
- **연결 메뉴**: Insights → Editorial Rules
- **시스템 설정 항목**: Minimum Topic Score Threshold
- **현재 적용 기준값**: **80 점**

> [!NOTE]
> 해당 설정값이 시스템에서 변경될 경우 본 Knowledge 항목은 자동 검토 대상(POTENTIALLY_OUTDATED)으로 지정됩니다.`,
      content_en: `## 1. Overview
Insights Engine only generates AI Drafts when scanned candidates meet the minimum topic score threshold.

## 2. Linked System Setting
- Menu: Insights → Editorial Rules
- Setting Parameter: Minimum Topic Score
- Current Live Value: 80`,
      type: "SYSTEM_RULE",
      source_type: "HYBRID",
      linked_system_setting_key: "insights_min_topic_score",
      linked_system_setting_name: "Insights Editorial Rules → Minimum Topic Score",
      linked_system_setting_value: "80",
      category: "INSIGHTS",
      tags: ["Insights", "SystemRule", "Hybrid", "TopicScore"],
      owner_id: "staff-admin-01",
      owner_name: "Compliance Operations Team",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["INTERNAL", "ADMIN / MANAGEMENT"],
      is_sensitive_internal: false,
      requires_external_approval: false,
      external_review_status: "NONE",
      current_version: "v1.1",
      effective_date: today,
      created_at: "2026-08-10T11:00:00Z",
      updated_at: now
    },
    {
      id: "kno-004-retailer-policy",
      slug: "retailer-network-fulfillment-policy",
      title: "U.S. Offline Retailer Fulfillment & Sample Delivery Policy",
      title_ko: "미국 오프라인 리테일러 샘플 발송 및 물류 가이드",
      title_en: "U.S. Offline Retailer Sample Delivery Policy",
      summary_ko: "독립 뷰티 수플라이 및 리테일 매장 매칭 시 제공되는 표준 샘플 키트 구성 및 물류 전달 정책",
      summary_en: "Fulfillment & sample delivery policy for matched independent U.S. retail beauty stores.",
      content_ko: `## 1. 리테일 매장 샘플 지원 정책
입점이 확정된 오프라인 매장에는 K SELECT 지원 센터에서 직접 검증된 브랜드 샘플 키트를 제공합니다.

## 2. 발송 및 물류 조건
- 주문 확정 후 영업일 기준 3일 이내 출고
- 배송비: K SELECT 전액 지원`,
      content_en: `## 1. Retailer Sample Policy
Verified brand sample kits are dispatched to confirmed offline retail partners.

## 2. Logistics & Delivery Terms
- Dispatch within 3 business days post-confirmation
- Shipping costs fully sponsored by K SELECT`,
      type: "POLICY",
      source_type: "CONTENT",
      category: "RETAIL_NETWORK",
      tags: ["Retailer", "Policy", "Logistics", "Samples"],
      owner_id: "staff-admin-03",
      owner_name: "Retail Operations Desk",
      status: "PUBLISHED",
      system_impact_status: "NORMAL",
      audience: ["RETAILER"],
      is_sensitive_internal: false,
      requires_external_approval: true,
      external_review_status: "APPROVED",
      external_reviewer_id: "staff-superadmin-01",
      external_reviewed_at: "2026-08-12T16:00:00Z",
      current_version: "v1.0",
      effective_date: today,
      created_at: "2026-08-12T09:00:00Z",
      updated_at: now
    }
  ];

  memoryVersions = [
    {
      id: "ver-001-v10",
      knowledge_id: "kno-001-internal-manual",
      version: "v1.0",
      status: "SUPERSEDED",
      title_ko: "관리자 브랜드 소싱 검증 SOP (v1.0)",
      title_en: "Admin Brand Sourcing SOP (v1.0)",
      summary_ko: "최초 작성 버전",
      summary_en: "Initial draft version",
      content_ko: "초기 소싱 검증 절차",
      content_en: "Initial sourcing procedure",
      what_changed: "최초 개정 작성",
      why_changed: "시스템 신규 오픈",
      effective_date: "2026-08-01",
      created_by_name: "Operations Governance Desk",
      published_at: "2026-08-01T10:00:00Z",
      created_at: "2026-08-01T10:00:00Z"
    },
    {
      id: "ver-001-v12",
      knowledge_id: "kno-001-internal-manual",
      version: "v1.2",
      status: "PUBLISHED",
      title_ko: "관리자 브랜드 소싱 및 검증 표준 운영 절차 (SOP)",
      title_en: "Admin Brand Sourcing & Verification Operations SOP",
      summary_ko: "MoCRA 규정 강화에 따른 마진 검증 기준 65% 상향 개정판",
      summary_en: "Updated with 65% FOB margin requirement under MoCRA guidelines.",
      content_ko: memoryItems[0].content_ko,
      content_en: memoryItems[0].content_en,
      what_changed: "최소 FOB 마진 60% -> 65% 상향 및 FDA MoCRA 필수 체크리스트 추가",
      why_changed: "미국 통관 및 물류 비용 증가 반영",
      effective_date: today,
      created_by_name: "Operations Governance Desk",
      published_at: now,
      created_at: now
    }
  ];

  memoryRelations = [
    {
      id: "rel-001",
      knowledge_id: "kno-001-internal-manual",
      related_portal: "Admin",
      related_module: "Applications",
      related_menu: "Applications Review",
      related_route: "/admin/applications",
      related_system_setting: "company_configs_fob_margin",
      manual_title: "Admin Brand Sourcing & Verification Guide PDF",
      created_at: now
    },
    {
      id: "rel-002",
      knowledge_id: "kno-003-hybrid-setting-rule",
      related_portal: "Admin",
      related_module: "Insights",
      related_menu: "Editorial Rules",
      related_route: "/admin/insights/rules",
      related_system_setting: "insights_min_topic_score",
      created_at: now
    }
  ];

  memoryAssets = [
    {
      id: "asset-001",
      knowledge_id: "kno-001-internal-manual",
      manual_title: "K SELECT Admin Sourcing & Verification Manual v1.2",
      version: "v1.2",
      language: "KO",
      is_current: true,
      file_url: "/manuals/admin_sourcing_verification_v1.2.pdf",
      file_name: "admin_sourcing_verification_v1.2.pdf",
      file_size: 2450000,
      published_date: today,
      created_at: now
    }
  ];

  memoryLogs = [
    {
      id: "log-001",
      knowledge_id: "kno-001-internal-manual",
      user_id: "user-admin-01",
      user_name: "Operations Governance Desk",
      action: "Created",
      previous_value: {},
      new_value: { title: "Admin Brand Sourcing & Verification Operations SOP", audience: ["INTERNAL"] },
      reason: "Initial Document Setup",
      created_at: "2026-08-01T10:00:00Z"
    },
    {
      id: "log-002",
      knowledge_id: "kno-001-internal-manual",
      user_id: "user-admin-01",
      user_name: "Operations Governance Desk",
      action: "Published",
      previous_value: { status: "DRAFT" },
      new_value: { status: "PUBLISHED", version: "v1.2" },
      reason: "Approved internal operational policy release",
      created_at: now
    }
  ];

  memoryTriggers = [];

  INITIALIZED = true;
}

// Ensure memory store is initialized
initSeedData();

// Storage Methods with Supabase Sync & In-Memory Fallback
export async function getStoreKnowledgeItems(): Promise<KnowledgeItem[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_items")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data as KnowledgeItem[];
    }
  } catch (e) {
    // Return memory fallback cleanly
  }
  return memoryItems;
}

export async function getStoreKnowledgeById(id: string): Promise<KnowledgeItem | null> {
  const items = await getStoreKnowledgeItems();
  return items.find(item => item.id === id || item.slug === id) || null;
}

export async function saveStoreKnowledgeItem(item: KnowledgeItem): Promise<KnowledgeItem> {
  initSeedData();
  const existingIdx = memoryItems.findIndex(i => i.id === item.id);
  if (existingIdx >= 0) {
    memoryItems[existingIdx] = { ...item, updated_at: new Date().toISOString() };
  } else {
    memoryItems.unshift(item);
  }

  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_items").upsert(item);
  } catch (e) {}

  return item;
}

export async function getStoreVersions(knowledgeId: string): Promise<KnowledgeVersion[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_versions")
      .select("*")
      .eq("knowledge_id", knowledgeId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as KnowledgeVersion[];
  } catch (e) {}

  return memoryVersions.filter(v => v.knowledge_id === knowledgeId);
}

export async function saveStoreVersion(version: KnowledgeVersion): Promise<KnowledgeVersion> {
  initSeedData();
  memoryVersions.unshift(version);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_versions").insert(version);
  } catch (e) {}
  return version;
}

export async function getStoreRelations(knowledgeId: string): Promise<KnowledgeRelation[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_relations")
      .select("*")
      .eq("knowledge_id", knowledgeId);
    if (data && data.length > 0) return data as KnowledgeRelation[];
  } catch (e) {}

  return memoryRelations.filter(r => r.knowledge_id === knowledgeId);
}

export async function saveStoreRelation(relation: KnowledgeRelation): Promise<KnowledgeRelation> {
  initSeedData();
  memoryRelations.push(relation);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_relations").insert(relation);
  } catch (e) {}
  return relation;
}

export async function getStoreAssets(knowledgeId: string): Promise<ManualAsset[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_manual_assets")
      .select("*")
      .eq("knowledge_id", knowledgeId);
    if (data && data.length > 0) return data as ManualAsset[];
  } catch (e) {}

  return memoryAssets.filter(a => a.knowledge_id === knowledgeId);
}

export async function saveStoreAsset(asset: ManualAsset): Promise<ManualAsset> {
  initSeedData();
  memoryAssets.unshift(asset);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_manual_assets").insert(asset);
  } catch (e) {}
  return asset;
}

export async function getStoreAuditLogs(knowledgeId: string): Promise<KnowledgeAuditLog[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_audit_logs")
      .select("*")
      .eq("knowledge_id", knowledgeId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as KnowledgeAuditLog[];
  } catch (e) {}

  return memoryLogs.filter(l => l.knowledge_id === knowledgeId);
}

export async function addStoreAuditLog(log: KnowledgeAuditLog): Promise<KnowledgeAuditLog> {
  initSeedData();
  memoryLogs.unshift(log);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_audit_logs").insert(log);
  } catch (e) {}
  return log;
}

export async function getStoreTriggers(): Promise<SystemImpactTrigger[]> {
  initSeedData();
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("knowledge_system_impact_triggers")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) return data as SystemImpactTrigger[];
  } catch (e) {}

  return memoryTriggers;
}

export async function addStoreTrigger(trigger: SystemImpactTrigger): Promise<SystemImpactTrigger> {
  initSeedData();
  memoryTriggers.unshift(trigger);
  try {
    const supabase = createAdminClient();
    await supabase.from("knowledge_system_impact_triggers").insert(trigger);
  } catch (e) {}
  return trigger;
}
