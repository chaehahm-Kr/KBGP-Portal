import { EngineRunResult, GeneratedArticlePayload } from "./types";
import { performDailyMarketResearch, performAdditionalMarketResearch } from "./market-researcher";
import { evaluateCandidate } from "./topic-evaluator";
import { applyDailyQuota } from "./quota-manager";
import { generateDraftPayload } from "./draft-generator";
import { createAdminClient } from "@/lib/supabase/admin";

interface RunOptions {
  mode: "SCHEDULED" | "MANUAL" | "DRY_RUN";
  triggeredBy?: string;
}

/**
 * Main Orchestrator for Daily Auto Insight Engine (Phase 2.1)
 */
export async function runAutoInsightEngine(options: RunOptions): Promise<EngineRunResult> {
  const startedAt = new Date().toISOString();
  const runId = `run-${Date.now()}`;
  const todayStr = startedAt.split("T")[0];

  console.log(`[Engine] Starting Phase 2.1 Auto Insight Engine (${options.mode}) - Run ID: ${runId}`);

  let sourcesScanned = 0;
  let sourcesAccepted = 0;
  let candidatesGenerated = 0;
  let candidatesScored = 0;
  let candidatesGte80 = 0;
  let criticalRejects = 0;
  let duplicateRejects = 0;
  let networkDraftsCount = 0;
  let hubDraftsCount = 0;
  let sharedCoreDraftsCount = 0;
  let uniqueCoreDraftsCount = 0;

  // Phase 2.1 Quality Metrics
  let totalHighRiskClaims = 0;
  let totalHighRiskPassed = 0;
  let totalMediumRiskClaims = 0;
  let totalClaimsDowngraded = 0;
  let totalUnsupportedNumeric = 0;
  let totalRegulatoryFailures = 0;
  let totalDraftsRewrittenByAuditor = 0;

  const createdDraftIds: string[] = [];
  let errorCount = 0;
  let noDraftReason: string | undefined;

  try {
    const supabase = createAdminClient();

    // 1. Fetch Editorial Rules Config
    let minScoreThreshold = 80;
    let rulesWeights = {
      relevance: 25,
      actionability: 25,
      evidence_strength: 20,
      timeliness: 15,
      originality: 10,
      strategic_fit: 5,
    };

    try {
      const { data: rules } = await supabase
        .from("insights_editorial_rules")
        .select("*")
        .eq("rule_key", "DEFAULT_MASTER_RULES")
        .maybeSingle();

      if (rules) {
        if (rules.min_topic_score_threshold) minScoreThreshold = rules.min_topic_score_threshold;
        if (rules.topic_score_weights) rulesWeights = { ...rulesWeights, ...rules.topic_score_weights };
      }
    } catch (err) {
      console.warn("[Engine] Warning: Could not fetch editorial rules from DB; using defaults.", err);
    }

    // 2. Perform Live Market Research
    const researchResult = await performDailyMarketResearch();
    sourcesScanned = researchResult.sourcesScanned;
    sourcesAccepted = researchResult.acceptedSources.length;
    const candidates = researchResult.topicCandidates;
    candidatesGenerated = candidates.length;

    // 3. Evaluate & Score Topic Candidates
    const evaluatedList = [];
    for (const cand of candidates) {
      try {
        candidatesScored++;
        const evalRes = await evaluateCandidate(cand, rulesWeights, minScoreThreshold);

        if (!evalRes.criticalConditions.all_passed) {
          if (evalRes.criticalConditions.duplicate_check === "FAIL") duplicateRejects++;
          else criticalRejects++;
          console.log(`[Engine] Candidate "${cand.proposedTopic.slice(0, 40)}" rejected by Critical Conditions:`, evalRes.criticalConditions.fail_reasons);
          continue;
        }

        if (evalRes.passedThreshold) {
          candidatesGte80++;
          evaluatedList.push(evalRes);
        } else {
          criticalRejects++;
          console.log(`[Engine] Candidate "${cand.proposedTopic.slice(0, 40)}" failed score threshold (${evalRes.scoreBreakdown.total} < ${minScoreThreshold})`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[Engine] Error evaluating candidate "${cand.id}":`, err);
      }
    }

    // 4. Enforce Channel Daily Quotas & Shared Core Logic (1st Pass)
    let quotaResult = applyDailyQuota(evaluatedList);
    
    // 4b. ADM-INS-002-R1: 2nd-Pass Additional Research if NETWORK < 3 or HUB < 3
    const neededChannels: ("NETWORK" | "HUB")[] = [];
    if (quotaResult.networkDraftsCount < 3) neededChannels.push("NETWORK");
    if (quotaResult.hubDraftsCount < 3) neededChannels.push("HUB");

    if (neededChannels.length > 0) {
      console.log(`[Engine] Triggering 2nd-Pass Additional Research for channels: ${neededChannels.join(", ")}...`);
      try {
        const addCandidates = await performAdditionalMarketResearch(neededChannels);
        for (const cand of addCandidates) {
          candidatesGenerated++;
          candidatesScored++;
          const evalRes = await evaluateCandidate(cand, rulesWeights, minScoreThreshold);
          if (evalRes.criticalConditions.all_passed && evalRes.passedThreshold) {
            candidatesGte80++;
            evaluatedList.push(evalRes);
          } else {
            criticalRejects++;
          }
        }
        // Re-apply quota allocation with additional evaluated candidates
        quotaResult = applyDailyQuota(evaluatedList);
      } catch (addErr) {
        console.warn("[Engine] Additional research warning:", addErr);
      }
    }

    const selectedTopics = quotaResult.selectedTopics;

    networkDraftsCount = quotaResult.networkDraftsCount;
    hubDraftsCount = quotaResult.hubDraftsCount;
    sharedCoreDraftsCount = quotaResult.sharedCoreCount;
    uniqueCoreDraftsCount = quotaResult.uniqueCoreCount;

    // Construct explicit run reason per ADM-INS-002-R1 requirement
    const netReason = networkDraftsCount >= 3 ? "NETWORK 3/3 — COMPLETE" : `NETWORK ${networkDraftsCount}/3 — No additional NETWORK candidates met score >=80 and critical conditions.`;
    const hubReason = hubDraftsCount >= 3 ? "HUB 3/3 — COMPLETE" : `HUB ${hubDraftsCount}/3 — No additional HUB candidates met score >=80 and critical conditions.`;
    noDraftReason = `${netReason} | ${hubReason}`;

    // 5. Generate Draft Payloads & Audit Claims (Strict Human Gate: status = 'AI_DRAFT')
    const draftPayloads: GeneratedArticlePayload[] = [];
    for (const item of selectedTopics) {
      try {
        const payload = generateDraftPayload(item);
        draftPayloads.push(payload);

        // Aggregate Phase 2.1 Quality Metrics
        if (payload.claim_risk_summary) {
          const s = payload.claim_risk_summary;
          totalHighRiskClaims += s.high_risk_count;
          totalHighRiskPassed += (s.high_risk_count - s.unsupported_count);
          totalMediumRiskClaims += s.medium_risk_count;
          totalClaimsDowngraded += s.downgraded_count;
          totalUnsupportedNumeric += s.unsupported_count;
          if (s.headline_audit === "REWRITTEN") totalDraftsRewrittenByAuditor++;
        }
      } catch (err) {
        errorCount++;
        console.error(`[Engine] Error generating draft payload for candidate "${item.candidate.id}":`, err);
      }
    }

    // 6. Persist to Database (If not DRY_RUN)
    if (options.mode !== "DRY_RUN") {
      for (const draft of draftPayloads) {
        try {
          const draftId = crypto.randomUUID();
          const slug = draft.title_en
            ? draft.title_en.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${Date.now().toString().slice(-4)}`
            : `insight-${Date.now()}`;

          // Primary DB Row Payload
          const dbRow: Record<string, any> = {
            id: draftId,
            title: draft.title_ko,
            slug,
            subtitle: draft.subtitle_ko,
            category: draft.network_category || "U.S. MARKET ENTRY",
            content_type: "ARTICLE",
            hero_image: draft.visuals[0]?.url || "https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=1200&auto=format&fit=crop",
            excerpt: draft.summary_ko,
            body_blocks: draft.body_blocks_ko,
            author: "K SELECT Auto Insight Engine",
            publish_date: todayStr,
            sources: draft.sources_detail,
            claims: draft.claims,
            claim_risk_summary: draft.claim_risk_summary,
            content_layers: draft.content_layers,
            research_brief: draft.research_brief,
            seo_title: draft.title_ko,
            meta_description: draft.summary_ko,
            status: "AI_DRAFT", // STRICT HUMAN GATE
            audience: draft.network_enabled && draft.hub_enabled ? "BOTH" : draft.hub_enabled ? "HUB" : "NETWORK",
            publish_channels: [
              ...(draft.network_enabled ? ["NETWORK"] : []),
              ...(draft.hub_enabled ? ["HUB"] : []),
            ],
            featured: false,
            trending: true,
            brand_takeaway: draft.network_brand_takeaway_ko,
            brand_actions: draft.network_brand_actions_ko,
            retailer_takeaway: draft.hub_retailer_takeaway_en,
            retailer_actions: draft.hub_retailer_actions_en,
          };

          let { error: insertErr } = await supabase.from("insights_articles").insert(dbRow);
          if (insertErr) {
            console.error("[Engine] Error inserting draft into insights_articles:", JSON.stringify(insertErr));
            errorCount++;
          } else {
            createdDraftIds.push(draftId);
          }
        } catch (err) {
          errorCount++;
          console.error("[Engine] Error writing draft row:", err);
        }
      }
    }

    const completedAt = new Date().toISOString();
    const finalStatus = errorCount === 0 ? "COMPLETED" : createdDraftIds.length > 0 || options.mode === "DRY_RUN" ? "PARTIAL" : "FAILED";

    // 7. Log Execution Summary to insights_automation_runs
    try {
      const runRow: Record<string, any> = {
        run_date: todayStr,
        started_at: startedAt,
        completed_at: completedAt,
        scheduled_time: "05:00 AM",
        timezone: "America/New_York",
        sources_scanned: sourcesScanned,
        sources_accepted: sourcesAccepted,
        candidates_found: candidatesGenerated,
        candidates_generated: candidatesGenerated,
        candidates_scored: candidatesScored,
        candidates_gte_80: candidatesGte80,
        candidates_rejected: criticalRejects + duplicateRejects,
        critical_rejects: criticalRejects,
        duplicate_rejects: duplicateRejects,
        network_drafts_created: networkDraftsCount,
        network_drafts: networkDraftsCount,
        hub_drafts_created: hubDraftsCount,
        hub_drafts: hubDraftsCount,
        shared_drafts_created: sharedCoreDraftsCount,
        shared_core_drafts: sharedCoreDraftsCount,
        unique_core_drafts: uniqueCoreDraftsCount,
        high_risk_claims_count: totalHighRiskClaims,
        high_risk_passed_count: totalHighRiskPassed,
        medium_risk_claims_count: totalMediumRiskClaims,
        claims_downgraded_count: totalClaimsDowngraded,
        unsupported_numeric_count: totalUnsupportedNumeric,
        regulatory_failures_count: totalRegulatoryFailures,
        drafts_rewritten_by_auditor: totalDraftsRewrittenByAuditor,
        visual_success: draftPayloads.length * 3,
        visual_failed: 0,
        error_count: errorCount,
        status: finalStatus,
        run_mode: options.mode,
        no_draft_reason: noDraftReason,
      };

      const { error: runErr } = await supabase.from("insights_automation_runs").insert(runRow);
      if (runErr) {
        // Fallback for automation runs logging
        delete runRow.high_risk_claims_count;
        delete runRow.high_risk_passed_count;
        delete runRow.medium_risk_claims_count;
        delete runRow.claims_downgraded_count;
        delete runRow.unsupported_numeric_count;
        delete runRow.regulatory_failures_count;
        delete runRow.drafts_rewritten_by_auditor;
        await supabase.from("insights_automation_runs").insert(runRow);
      }
    } catch (logErr) {
      console.error("[Engine] Error writing run record to insights_automation_runs:", logErr);
    }

    console.log(`[Engine] Phase 2.1 Auto Insight Engine completed with status "${finalStatus}". Created ${createdDraftIds.length} drafts.`);

    return {
      runId,
      startedAt,
      completedAt,
      scheduledTime: "05:00 AM",
      timezone: "America/New_York",
      sourcesScanned,
      sourcesAccepted,
      candidatesGenerated,
      candidatesScored,
      candidatesGte80,
      criticalRejects,
      duplicateRejects,
      networkDrafts: networkDraftsCount,
      hubDrafts: hubDraftsCount,
      sharedCoreDrafts: sharedCoreDraftsCount,
      uniqueCoreDrafts: uniqueCoreDraftsCount,
      createdDraftIds,
      highRiskClaimsCount: totalHighRiskClaims,
      highRiskPassedCount: totalHighRiskPassed,
      mediumRiskClaimsCount: totalMediumRiskClaims,
      claimsDowngradedCount: totalClaimsDowngraded,
      unsupportedNumericCount: totalUnsupportedNumeric,
      regulatoryFailuresCount: totalRegulatoryFailures,
      draftsRewrittenByAuditor: totalDraftsRewrittenByAuditor,
      visualSuccess: draftPayloads.length * 3,
      visualFailed: 0,
      errorCount,
      status: finalStatus,
      noDraftReason,
      runMode: options.mode,
    };
  } catch (fatalErr: any) {
    console.error("[Engine] Fatal error running Auto Insight Engine:", fatalErr);
    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      scheduledTime: "05:00 AM",
      timezone: "America/New_York",
      sourcesScanned,
      sourcesAccepted,
      candidatesGenerated,
      candidatesScored,
      candidatesGte80,
      criticalRejects,
      duplicateRejects,
      networkDrafts: 0,
      hubDrafts: 0,
      sharedCoreDrafts: 0,
      uniqueCoreDrafts: 0,
      createdDraftIds: [],
      visualSuccess: 0,
      visualFailed: 0,
      errorCount: errorCount + 1,
      status: "FAILED",
      noDraftReason: fatalErr.message || "Fatal error during engine execution",
      runMode: options.mode,
    };
  }
}
