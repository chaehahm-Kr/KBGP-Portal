import {
  TopicCandidate,
  ScoreBreakdown,
  CriticalConditions,
  RelationCheckResult,
} from "./types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EvaluatedTopic {
  candidate: TopicCandidate;
  scoreBreakdown: ScoreBreakdown;
  criticalConditions: CriticalConditions;
  relationCheck: RelationCheckResult;
  passedThreshold: boolean;
  networkSuitability: "HIGH" | "MEDIUM" | "LOW";
  hubSuitability: "HIGH" | "MEDIUM" | "LOW";
  isSharedCore: boolean;
  networkEnabled: boolean;
  hubEnabled: boolean;
}

/**
 * 100-Point Topic Evaluator & Critical Conditions Checker
 */
export async function evaluateCandidate(
  candidate: TopicCandidate,
  rulesWeights: {
    relevance?: number;
    actionability?: number;
    evidence_strength?: number;
    timeliness?: number;
    originality?: number;
    strategic_fit?: number;
  },
  minimumScoreThreshold: number = 80
): Promise<EvaluatedTopic> {
  // 1. Calculate 100-Point Score Breakdown
  const wRelevance = rulesWeights.relevance ?? 25;
  const wActionability = rulesWeights.actionability ?? 25;
  const wEvidence = rulesWeights.evidence_strength ?? 20;
  const wTimeliness = rulesWeights.timeliness ?? 15;
  const wOriginality = rulesWeights.originality ?? 10;
  const wStrategicFit = rulesWeights.strategic_fit ?? 5;

  const maxAudienceScore = Math.max(candidate.networkRelevanceScore, candidate.hubRelevanceScore);
  const relevance = Math.round((maxAudienceScore / 100) * wRelevance);
  const actionability = candidate.possibleAction ? Math.round(0.92 * wActionability) : Math.round(0.5 * wActionability);
  
  const hasTierA = candidate.supportingSources.some((s) => s.sourceTier === "TIER_A");
  const hasTierB = candidate.supportingSources.some((s) => s.sourceTier === "TIER_B");
  const evidence_strength = hasTierA ? wEvidence : hasTierB ? Math.round(0.85 * wEvidence) : Math.round(0.6 * wEvidence);
  
  const timeliness = candidate.whyNow ? wTimeliness : Math.round(0.7 * wTimeliness);
  const originality = Math.round(0.9 * wOriginality);
  const strategic_fit = wStrategicFit;

  const totalScore = relevance + actionability + evidence_strength + timeliness + originality + strategic_fit;

  const scoreBreakdown: ScoreBreakdown = {
    relevance,
    actionability,
    evidence_strength,
    timeliness,
    originality,
    strategic_fit,
    total: totalScore,
  };

  // 2. Perform Relation & Duplicate Check against existing articles in ALL statuses
  const relationCheck = await checkDuplicateAndRelation(candidate);

  // 3. Evaluate 5 Critical Conditions
  const failReasons: string[] = [];
  
  const evidence_quality: "PASS" | "FAIL" = candidate.supportingSources.length >= 1 && (hasTierA || hasTierB) ? "PASS" : "FAIL";
  if (evidence_quality === "FAIL") failReasons.push("Insufficient authoritative Tier A or Tier B source");

  const claim_validation: "PASS" | "FAIL" = candidate.supportingSources.every((s) => s.relevantClaim) ? "PASS" : "FAIL";
  if (claim_validation === "FAIL") failReasons.push("Core claims lack verifiable source citations");

  const duplicate_check: "PASS" | "FAIL" = relationCheck.relationType !== "DUPLICATE" ? "PASS" : "FAIL";
  if (duplicate_check === "FAIL") failReasons.push(`Duplicate topic detected: ${relationCheck.reason}`);

  const audience_relevance: "PASS" | "FAIL" = maxAudienceScore >= 70 ? "PASS" : "FAIL";
  if (audience_relevance === "FAIL") failReasons.push("Audience relevance score is below minimum cutoff (70)");

  const actionability_check: "PASS" | "FAIL" = candidate.possibleAction.length > 10 ? "PASS" : "FAIL";
  if (actionability_check === "FAIL") failReasons.push("Topic lacks clear, actionable decision guidance for audience");

  const all_passed = evidence_quality === "PASS" && claim_validation === "PASS" && duplicate_check === "PASS" && audience_relevance === "PASS" && actionability_check === "PASS";

  const criticalConditions: CriticalConditions = {
    evidence_quality,
    claim_validation,
    duplicate_check,
    audience_relevance,
    actionability: actionability_check,
    all_passed,
    fail_reasons: failReasons,
  };

  const passedThreshold = totalScore >= minimumScoreThreshold && all_passed;

  // 4. Channel Suitability & Shared Core Determination
  const networkEnabled = candidate.networkRelevanceScore >= 75;
  const hubEnabled = candidate.hubRelevanceScore >= 75;
  const isSharedCore = networkEnabled && hubEnabled;

  const networkSuitability = candidate.networkRelevanceScore >= 85 ? "HIGH" : candidate.networkRelevanceScore >= 75 ? "MEDIUM" : "LOW";
  const hubSuitability = candidate.hubRelevanceScore >= 85 ? "HIGH" : candidate.hubRelevanceScore >= 75 ? "MEDIUM" : "LOW";

  return {
    candidate,
    scoreBreakdown,
    criticalConditions,
    relationCheck,
    passedThreshold,
    networkSuitability,
    hubSuitability,
    isSharedCore,
    networkEnabled,
    hubEnabled,
  };
}

/**
 * Checks existing insights (AI_DRAFT, IN_REVIEW, APPROVED, SCHEDULED, PUBLISHED) for duplicates
 */
async function checkDuplicateAndRelation(candidate: TopicCandidate): Promise<RelationCheckResult> {
  try {
    const supabase = createAdminClient();
    const { data: existingArticles } = await supabase
      .from("insights_articles")
      .select("id, title, title_ko, title_en, status")
      .limit(100);

    if (!existingArticles || existingArticles.length === 0) {
      return { relationType: "NEW", reason: "No existing articles found in DB." };
    }

    const proposedNorm = candidate.proposedTopic.toLowerCase().replace(/[^\w\s]/g, "");

    for (const art of existingArticles) {
      const existingTitle = (art.title_ko || art.title_en || art.title || "").toLowerCase().replace(/[^\w\s]/g, "");
      
      // Calculate token overlap Jaccard similarity
      const propTokens = new Set(proposedNorm.split(/\s+/).filter((t: string) => t.length > 3));
      const existTokens = new Set(existingTitle.split(/\s+/).filter((t: string) => t.length > 3));
      
      if (propTokens.size === 0 || existTokens.size === 0) continue;

      let intersection = 0;
      propTokens.forEach((t) => {
        if (existTokens.has(t)) intersection++;
      });

      const overlap = intersection / Math.min(propTokens.size, existTokens.size);

      if (overlap >= 0.75) {
        return {
          relationType: "DUPLICATE",
          relatedInsightId: art.id,
          reason: `High topic similarity (${Math.round(overlap * 100)}%) with existing article [${art.status}]: "${art.title || art.title_ko}"`,
        };
      } else if (overlap >= 0.5) {
        return {
          relationType: "UPDATE",
          relatedInsightId: art.id,
          reason: `Related topic update opportunity identified with existing article ID ${art.id}`,
        };
      }
    }

    return { relationType: "NEW", reason: "Topic candidate is novel and distinct." };
  } catch (err) {
    return { relationType: "NEW", reason: "Defaulting to NEW due to check fallback." };
  }
}
