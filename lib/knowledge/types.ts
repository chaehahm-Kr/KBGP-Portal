export type KnowledgeType =
  | "MANUAL"
  | "POLICY"
  | "SOP"
  | "FAQ"
  | "SYSTEM_RULE"
  | "DEFINITION"
  | "GUIDE"
  | "DECISION_RECORD"
  | "INTERNAL_RULE"
  | "TRAINING";

export type KnowledgeSourceType = "CONTENT" | "LIVE_SYSTEM" | "HYBRID";

export type KnowledgeStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";

export type AudienceType = "INTERNAL" | "ADMIN / MANAGEMENT" | "BRAND" | "RETAILER" | "PUBLIC";

export type SystemImpactStatus = "NORMAL" | "POTENTIALLY_OUTDATED";

export type ExternalReviewStatus = "NONE" | "REQUESTED" | "APPROVED" | "REJECTED";

export interface KnowledgeItem {
  id: string;
  slug: string;
  title: string;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  content_ko: string;
  content_en: string;
  type: KnowledgeType;
  source_type: KnowledgeSourceType;
  linked_system_setting_key?: string | null;
  linked_system_setting_name?: string | null;
  linked_system_setting_value?: string | null;
  category: string;
  tags: string[];
  owner_id?: string | null;
  owner_name: string;
  status: KnowledgeStatus;
  system_impact_status: SystemImpactStatus;
  system_impact_reason?: string | null;
  system_impact_updated_at?: string | null;
  audience: AudienceType[];
  is_sensitive_internal: boolean;
  requires_external_approval: boolean;
  external_review_status: ExternalReviewStatus;
  external_reviewer_id?: string | null;
  external_reviewed_at?: string | null;
  current_version: string;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeVersion {
  id: string;
  knowledge_id: string;
  version: string;
  status: KnowledgeStatus;
  title_ko: string;
  title_en: string;
  summary_ko: string;
  summary_en: string;
  content_ko: string;
  content_en: string;
  what_changed: string;
  why_changed: string;
  effective_date: string;
  created_by_id?: string | null;
  created_by_name: string;
  reviewer_id?: string | null;
  approver_id?: string | null;
  published_at?: string | null;
  created_at: string;
}

export interface KnowledgeRelation {
  id: string;
  knowledge_id: string;
  related_portal?: string | null;
  related_module?: string | null;
  related_menu?: string | null;
  related_route?: string | null;
  related_system_setting?: string | null;
  target_knowledge_id?: string | null;
  manual_title?: string | null;
  faq_question?: string | null;
  created_at: string;
}

export interface ManualAsset {
  id: string;
  knowledge_id: string;
  manual_title: string;
  version: string;
  language: "KO" | "EN" | "BOTH";
  is_current: boolean;
  file_url: string;
  file_name: string;
  file_size: number;
  published_date: string;
  created_at: string;
}

export interface KnowledgeAuditLog {
  id: string;
  knowledge_id: string;
  user_id?: string | null;
  user_name: string;
  action: string;
  previous_value?: Record<string, any>;
  new_value?: Record<string, any>;
  reason?: string | null;
  created_at: string;
}

export interface SystemImpactTrigger {
  id: string;
  setting_key: string;
  setting_name: string;
  old_value: string;
  new_value: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolved_by?: string | null;
  resolution_action?: "VERSION_CREATED" | "NO_UPDATE_REQUIRED" | null;
  resolution_reason?: string | null;
  created_at: string;
}

export type UserRole = "admin" | "brand" | "retailer" | "public" | "anonymous";

export interface SecurityUserContext {
  userId: string;
  role: UserRole;
  staffRoles?: string[];
  companyId?: string;
  brandId?: string;
  retailerId?: string;
}

export interface KnowledgeFilterOptions {
  type?: string;
  audience?: string;
  module?: string;
  status?: string;
  language?: string;
  search?: string;
  sortBy?: "latest" | "title" | "updated";
}

export type GuideActionType = "knowledge" | "manual" | "download" | "route" | "gap" | "library";

export interface GuideActionLink {
  label: string;
  url: string;
  type: GuideActionType;
}

export interface GuideSourceCitation {
  id: string;
  title: string;
  type: KnowledgeType;
  version: string;
  status: KnowledgeStatus;
  effectiveDate: string;
  isLiveRule?: boolean;
}

export interface GuideAnswerResponse {
  id: string;
  question: string;
  directAnswer: string;
  currentRuleBullets?: string[];
  liveRuleNote?: string | null;
  sources: GuideSourceCitation[];
  actions: GuideActionLink[];
  isUnknown: boolean;
  isReadonlyActionAttempt: boolean;
  createdAt: string;
}

export interface KnowledgeGapRecord {
  id: string;
  question: string;
  user_id: string;
  user_name: string;
  current_route: string;
  created_at: string;
}

export interface GuideFeedbackRecord {
  id: string;
  question: string;
  is_helpful: boolean;
  reason?: string | null;
  created_at: string;
}
