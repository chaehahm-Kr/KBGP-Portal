export type SourceTier = "TIER_A" | "TIER_B" | "TIER_C" | "SIGNAL";

export type ClaimRiskLevel = "HIGH" | "MEDIUM" | "LOW";

export type ClaimStatus =
  | "VERIFIED"
  | "INFERRED"
  | "ESTIMATE"
  | "SIGNAL"
  | "INTERNAL"
  | "UNSUPPORTED";

export type InternalSourceType =
  | "K_SELECT_INTERNAL_DATA"
  | "K_SELECT_INTERNAL_RULE"
  | "K_SELECT_EXPERIENCE"
  | "K_SELECT_RECOMMENDATION";

export type AuditorAction = "PASS" | "DOWNGRADE" | "REWRITE" | "REMOVE" | "FAIL";

export interface SourceItem {
  id: string;
  sourceName: string;
  sourceTitle: string;
  url: string;
  publishedDate: string | null;
  accessedDate: string;
  sourceLanguage: "KO" | "EN";
  sourceTier: SourceTier;
  keyFinding: string;
  relevantClaim: string;
  audienceRelevance: "NETWORK" | "HUB" | "BOTH";
}

export interface VerifiedClaim {
  claim_text: string;
  source_name: string;
  source_url?: string;
  status: ClaimStatus;
  risk_level?: ClaimRiskLevel;
  metric_type?: "%" | "$" | "Sales" | "Ranking" | "Regulatory" | "Internal";
  internal_type?: InternalSourceType;
  evidence_excerpt?: string;
  auditor_action?: AuditorAction;
  downgrade_reason?: string;
}

export interface AuditedClaim extends VerifiedClaim {
  risk_level: ClaimRiskLevel;
  auditor_action: AuditorAction;
}

export interface ClaimRiskSummary {
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  verified_count: number;
  inferred_count: number;
  signal_count: number;
  internal_count: number;
  unsupported_count: number;
  downgraded_count: number;
  fact_check_status: "PASS" | "NEEDS_ATTENTION";
  headline_audit: "PASS" | "REWRITTEN";
}

export interface ContentLayers {
  market_facts: string[];
  market_signals: string[];
  k_select_views: string[];
  k_select_actions: string[];
}

export interface TopicCandidate {
  id: string;
  proposedTopic: string;
  proposedHeadline: string;
  primarySignal: string;
  whyNow: string;
  targetAudience: "NETWORK" | "HUB" | "BOTH";
  networkRelevanceScore: number;
  hubRelevanceScore: number;
  possibleDecision: string;
  possibleAction: string;
  supportingSources: SourceItem[];
  riskOrCounterEvidence: string;
  initialConfidence: number;
}

export interface ScoreBreakdown {
  relevance: number;        // Max 25
  actionability: number;    // Max 25
  evidence_strength: number;// Max 20
  timeliness: number;       // Max 15
  originality: number;      // Max 10
  strategic_fit: number;    // Max 5
  total: number;            // Max 100
}

export interface CriticalConditions {
  evidence_quality: "PASS" | "FAIL";
  claim_validation: "PASS" | "FAIL";
  duplicate_check: "PASS" | "FAIL";
  audience_relevance: "PASS" | "FAIL";
  actionability: "PASS" | "FAIL";
  all_passed: boolean;
  fail_reasons: string[];
}

export interface RelationCheckResult {
  relationType: "NEW" | "UPDATE" | "FOLLOW_UP" | "DUPLICATE";
  relatedInsightId?: string;
  reason: string;
}

export interface CoreResearchBrief {
  topic: string;
  whyNow: string;
  primarySignal: string;
  keyQuestion: string;
  keyEvidence: string[];
  supportingSources: SourceItem[];
  counterEvidence: string;
  uncertainty: string;
  confidence: number;
  recommendedAngle: string;
  networkImplication: string;
  hubImplication: string;
}

export interface VisualAssetPayload {
  id: string;
  type: "hero" | "chart" | "infographic" | "thumbnail";
  source_type: "AI_GENERATED" | "DATA_GENERATED" | "REAL_PHOTO" | "USER_UPLOADED";
  title: string;
  url: string;
  caption: string;
  copyright_clean: boolean;
}

export interface AnimationRecommendation {
  type: string;
  status: "Ready for Review" | "Approved";
  description: string;
}

export interface GeneratedArticlePayload {
  primary_language: "KO" | "EN";
  analysis_confidence: number;
  topic_score: number;
  topic_score_breakdown: ScoreBreakdown;
  critical_conditions: CriticalConditions;
  relation_type: "NEW" | "UPDATE" | "FOLLOW_UP" | "DUPLICATE";
  related_insight_id?: string;
  research_brief: CoreResearchBrief;
  
  title_ko: string;
  title_en: string;
  subtitle_ko: string;
  subtitle_en: string;
  summary_ko: string;
  summary_en: string;
  body_blocks_ko: any[];
  body_blocks_en: any[];
  
  network_enabled: boolean;
  network_category: string;
  network_brand_takeaway_ko: string;
  network_brand_takeaway_en: string;
  network_brand_actions_ko: string[];
  network_brand_actions_en: string[];
  network_implication_ko: string;
  network_implication_en: string;
  network_cta_ko: string;
  network_cta_en: string;
  network_suitability: "HIGH" | "MEDIUM" | "LOW";
  
  hub_enabled: boolean;
  hub_category: string;
  hub_retailer_takeaway_ko: string;
  hub_retailer_takeaway_en: string;
  hub_retailer_actions_ko: string[];
  hub_retailer_actions_en: string[];
  hub_checklist_ko: string[];
  hub_checklist_en: string[];
  hub_opportunity_ko: string;
  hub_opportunity_en: string;
  hub_cta_ko: string;
  hub_cta_en: string;
  hub_suitability: "HIGH" | "MEDIUM" | "LOW";
  
  sources_detail: SourceItem[];
  claims: VerifiedClaim[];
  claim_risk_summary?: ClaimRiskSummary;
  content_layers?: ContentLayers;
  visuals: VisualAssetPayload[];
  visual_status: "APPROVED" | "PENDING";
  animation_recommendations: AnimationRecommendation[];
  
  status: "AI_DRAFT";
}

export interface EngineRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  scheduledTime: string;
  timezone: string;
  sourcesScanned: number;
  sourcesAccepted: number;
  candidatesGenerated: number;
  candidatesScored: number;
  candidatesGte80: number;
  criticalRejects: number;
  duplicateRejects: number;
  networkDrafts: number;
  hubDrafts: number;
  sharedCoreDrafts: number;
  uniqueCoreDrafts: number;
  createdDraftIds: string[];
  highRiskClaimsCount?: number;
  highRiskPassedCount?: number;
  mediumRiskClaimsCount?: number;
  claimsDowngradedCount?: number;
  unsupportedNumericCount?: number;
  regulatoryFailuresCount?: number;
  draftsRewrittenByAuditor?: number;
  visualSuccess: number;
  visualFailed: number;
  errorCount: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED_DUPLICATE" | "SKIPPED_TIME_WINDOW";
  noDraftReason?: string;
  runMode: "SCHEDULED" | "MANUAL" | "DRY_RUN";
}
