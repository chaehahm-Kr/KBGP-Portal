// Phase 2 Auto Insight Engine Type Definitions

export type SourceTier = "TIER_A" | "TIER_B" | "TIER_C" | "SIGNAL";

export interface SourceItem {
  id?: string;
  sourceName: string;
  sourceTitle: string;
  url: string;
  publishedDate?: string;
  accessedDate: string;
  sourceLanguage: "KO" | "EN";
  sourceTier: SourceTier;
  keyFinding: string;
  relevantClaim: string;
  audienceRelevance: "NETWORK" | "HUB" | "BOTH";
}

export interface TopicCandidate {
  id: string;
  proposedTopic: string;
  proposedHeadline: string;
  primarySignal: string;
  whyNow: string;
  targetAudience: "NETWORK" | "HUB" | "BOTH";
  networkRelevanceScore: number; // 0-100
  hubRelevanceScore: number;     // 0-100
  possibleDecision: string;
  possibleAction: string;
  supportingSources: SourceItem[];
  riskOrCounterEvidence: string;
  initialConfidence: number;     // 0-100
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

export type RelationType = "NEW" | "UPDATE" | "FOLLOW_UP" | "DUPLICATE";

export interface RelationCheckResult {
  relationType: RelationType;
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

export interface VerifiedClaim {
  claim_text: string;
  source_name: string;
  status: "VERIFIED" | "INFERRED" | "UNSUPPORTED";
  metric_type?: "%" | "$" | "Market Size" | "Growth Rate" | "Ranking" | "Year" | "Sales" | "Regulatory";
}

export interface VisualAssetPayload {
  id: string;
  type: "hero" | "thumbnail" | "chart" | "infographic" | "illustration";
  source_type: "AI_GENERATED" | "DATA_GENERATED" | "LICENSED" | "UPLOADED" | "EXTERNAL_REFERENCE";
  title: string;
  url: string;
  caption?: string;
  copyright_clean: boolean;
}

export interface AnimationRecommendation {
  type: "Count-up" | "Chart Reveal" | "Data Highlight" | "Scroll Reveal" | "Infographic Motion" | "Category Motion";
  status: "Suggested" | "Ready for Review" | "Approved" | "Rejected" | "Disabled";
  description: string;
}

export interface GeneratedArticlePayload {
  primary_language: "KO" | "EN";
  analysis_confidence: number;
  topic_score: number;
  topic_score_breakdown: ScoreBreakdown;
  critical_conditions: CriticalConditions;
  relation_type: RelationType;
  related_insight_id?: string;
  research_brief: CoreResearchBrief;
  
  // Titles & Core Summaries
  title_ko: string;
  title_en: string;
  subtitle_ko: string;
  subtitle_en: string;
  summary_ko: string;
  summary_en: string;
  body_blocks_ko: any[];
  body_blocks_en: any[];
  
  // NETWORK Channel Adaptation
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
  
  // HUB Channel Adaptation
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
  
  // Verifications & Visuals
  sources_detail: SourceItem[];
  claims: VerifiedClaim[];
  visuals: VisualAssetPayload[];
  visual_status: "APPROVED" | "PENDING_REVIEW" | "FAILED";
  animation_recommendations: AnimationRecommendation[];
  
  // Terminal Status (STRICTLY AI_DRAFT)
  status: "AI_DRAFT";
}

export interface EngineRunOptions {
  mode: "SCHEDULED" | "MANUAL" | "DRY_RUN";
  triggeredBy?: string;
}

export interface EngineRunResult {
  runId: string;
  runMode: "SCHEDULED" | "MANUAL" | "DRY_RUN";
  runDate: string;
  scheduledTime: string;
  timezone: string;
  startedAt: string;
  completedAt: string;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  
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
  
  visualSuccess: number;
  visualFailed: number;
  errorCount: number;
  errors: Array<{ candidateId?: string; message: string; step: string }>;
  noDraftReason?: string;
  createdDraftIds: string[];
}
