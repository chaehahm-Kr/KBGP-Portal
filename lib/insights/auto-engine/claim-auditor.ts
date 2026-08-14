import {
  VerifiedClaim,
  AuditedClaim,
  ClaimRiskLevel,
  ClaimStatus,
  ClaimRiskSummary,
  ContentLayers,
  SourceItem,
  AuditorAction,
  InternalSourceType,
} from "./types";

export interface AuditResult {
  auditedClaims: AuditedClaim[];
  claimRiskSummary: ClaimRiskSummary;
  contentLayers: ContentLayers;
  auditedTitleKo: string;
  auditedTitleEn: string;
  universalFailures: string[];
}

/**
 * Classifies a claim text into HIGH, MEDIUM, or LOW Risk Level
 */
export function classifyClaimRisk(claimText: string): ClaimRiskLevel {
  const text = claimText.toLowerCase();

  // HIGH RISK: Regulatory rules, mandatory obligations, exact numbers (%, $), hard causal assertions
  const isRegulatory = /fda|mocra|cbp|ftc|regulation|mandatory|compliance|enforcement|recall|detention|certification|approval|inspection/.test(text);
  const isExactNumeric = /%|\$|\b\d+(\.\d+)?\b/.test(text) && !/top \d+/i.test(text);
  const isHardCausal = /guarantee|drives profit|increases sales by|produces higher|will increase|must increase|확실히|보장|무조건/.test(text);

  if (isRegulatory || isExactNumeric || isHardCausal) {
    return "HIGH";
  }

  // MEDIUM RISK: Market trends, category momentum, consumer search interest, shelf expansion
  const isMarketTrend = /trend|interest|growing|surging|shifting|expanding|demand|search|retailers are|category|포착|증가|확대/.test(text);
  if (isMarketTrend) {
    return "MEDIUM";
  }

  // LOW RISK: K SELECT recommendations, internal playbooks, display advice, checklists
  return "LOW";
}

/**
 * Detects Universal Critical Failures across claims
 */
export function checkUniversalCriticalFailures(
  claims: VerifiedClaim[],
  sources: SourceItem[],
  titleKo: string,
  titleEn: string
): string[] {
  const failures: string[] = [];

  // A. Fabricated Source check
  for (const src of sources) {
    if (!src.url || (!src.url.startsWith("http://") && !src.url.startsWith("https://"))) {
      failures.push(`Fabricated or invalid Source URL detected for source "${src.sourceName}"`);
    }
  }

  // B. Regulatory Overstatement check ("registration" -> "certification" or "product listing" -> "FDA approval")
  const fullText = (titleKo + " " + titleEn + " " + claims.map((c) => c.claim_text).join(" ")).toLowerCase();
  
  if (fullText.includes("fda certification") || fullText.includes("fda 승인") || fullText.includes("fda 허가")) {
    const hasFdaCertDoc = sources.some((s) => s.relevantClaim.toLowerCase().includes("fda certification"));
    if (!hasFdaCertDoc) {
      failures.push("REGULATORY_OVERSTATEMENT: Source mentions FDA Facility Registration/Listing, but draft claims FDA Certification/Approval.");
    }
  }

  if (fullText.includes("crackdown begins") || fullText.includes("fda 단속 개시")) {
    const hasEnforcementDoc = sources.some((s) => s.relevantClaim.toLowerCase().includes("enforcement") || s.relevantClaim.toLowerCase().includes("seizure"));
    if (!hasEnforcementDoc) {
      failures.push("REGULATORY_OVERSTATEMENT: Source mentions MoCRA compliance portal, but draft claims FDA Crackdown/Stock Seizure.");
    }
  }

  // C. False Causal Claim check
  if (fullText.includes("guarantees 50% profit") || fullText.includes("무조건 50% 수익 보장")) {
    failures.push("FALSE_CAUSAL_CLAIM: Unverified profit guarantee asserted in text.");
  }

  return failures;
}

/**
 * Performs Independent Claim Audit, Safe Downgrades, Rewrites, and Content Layering
 */
export function auditArticleClaims(
  rawClaims: VerifiedClaim[],
  sources: SourceItem[],
  titleKo: string,
  titleEn: string
): AuditResult {
  const auditedClaims: AuditedClaim[] = [];
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let verifiedCount = 0;
  let inferredCount = 0;
  let signalCount = 0;
  let internalCount = 0;
  let unsupportedCount = 0;
  let downgradedCount = 0;

  const universalFailures = checkUniversalCriticalFailures(rawClaims, sources, titleKo, titleEn);

  // Process Claims
  for (const claim of rawClaims) {
    const riskLevel = claim.risk_level || classifyClaimRisk(claim.claim_text);
    let status: ClaimStatus = (claim.status as ClaimStatus) || "VERIFIED";
    let action: AuditorAction = "PASS";
    let downgradeReason: string | undefined;
    let text = claim.claim_text;

    // Check backing source tier & authority
    const matchingSource = sources.find((s) => s.sourceName === claim.source_name || s.url === claim.source_url);
    const sourceTier = matchingSource?.sourceTier || "SIGNAL";

    if (riskLevel === "HIGH") {
      highRiskCount++;
      // HIGH RISK requires Tier A or Tier B supporting source
      if (sourceTier !== "TIER_A" && sourceTier !== "TIER_B") {
        // Safe Downgrade / Rewrite: Convert hard assertion to moderated phrasing or INFERRED/SIGNAL
        action = "DOWNGRADE";
        downgradedCount++;
        status = "SIGNAL";
        downgradeReason = "High risk claim backed by signal-level source; downgraded to SIGNAL status with moderated phrasing.";
        text = text.replace(/is increasing/i, "signals suggest potential growth in")
                   .replace(/crackdown/i, "compliance monitoring")
                   .replace(/exploding/i, "gaining attention");
      } else {
        status = claim.status || "VERIFIED";
      }
    } else if (riskLevel === "MEDIUM") {
      mediumRiskCount++;
      if (sourceTier === "SIGNAL") {
        status = "SIGNAL";
        action = "DOWNGRADE";
        downgradedCount++;
        downgradeReason = "Medium risk trend claim supported by search/social signal; classified as SIGNAL.";
      } else {
        status = claim.status || "VERIFIED";
      }
    } else {
      lowRiskCount++;
      // LOW RISK: Operational guidance / K SELECT recommendations
      status = claim.status || "INTERNAL";
      claim.internal_type = claim.internal_type || "K_SELECT_RECOMMENDATION";
    }

    // Tally Status
    if (status === "VERIFIED") verifiedCount++;
    else if (status === "INFERRED") inferredCount++;
    else if (status === "SIGNAL") signalCount++;
    else if (status === "INTERNAL") internalCount++;
    else if (status === "UNSUPPORTED") unsupportedCount++;

    auditedClaims.push({
      ...claim,
      claim_text: text,
      risk_level: riskLevel,
      status,
      auditor_action: action,
      downgrade_reason: downgradeReason,
      source_url: matchingSource?.url || claim.source_url,
      evidence_excerpt: matchingSource?.relevantClaim || claim.evidence_excerpt,
    });
  }

  // Headline Risk Check & Safe Rewrite
  let auditedTitleKo = titleKo;
  let auditedTitleEn = titleEn;
  let headlineAuditStatus: "PASS" | "REWRITTEN" = "PASS";

  const highRiskWordsRegex = /crackdown|seizure|banned|crackdown begins|단속 개시|압류|몰수/i;
  if (highRiskWordsRegex.test(titleEn) || highRiskWordsRegex.test(titleKo)) {
    const hasTierAHardDoc = sources.some((s) => s.sourceTier === "TIER_A" && /seizure|crackdown|enforcement action/i.test(s.relevantClaim));
    if (!hasTierAHardDoc) {
      headlineAuditStatus = "REWRITTEN";
      auditedTitleEn = auditedTitleEn.replace(/Port Inspections Begin|Crackdown Begins/i, "Compliance Guidance & Labeling Checklist")
                                     .replace(/Avoid Stock Seizures/i, "Ensure Uninterrupted Import Flow");
      auditedTitleKo = auditedTitleKo.replace(/통관 단속 개시|단속 강화/i, "Compliance 가이드라인 및 라벨 감사")
                                     .replace(/재고 압류 방지/i, "통관 지연 리스크 방지");
    }
  }

  // Construct Content Layers (MARKET_FACT, MARKET_SIGNAL, K_SELECT_VIEW, K_SELECT_ACTION)
  const contentLayers: ContentLayers = {
    market_facts: auditedClaims.filter((c) => c.status === "VERIFIED").map((c) => c.claim_text),
    market_signals: auditedClaims.filter((c) => c.status === "SIGNAL" || c.status === "ESTIMATE").map((c) => c.claim_text),
    k_select_views: auditedClaims.filter((c) => c.status === "INFERRED").map((c) => c.claim_text),
    k_select_actions: auditedClaims.filter((c) => c.status === "INTERNAL").map((c) => c.claim_text),
  };

  const factCheckStatus = universalFailures.length > 0 || unsupportedCount > 0 ? "NEEDS_ATTENTION" : "PASS";

  const claimRiskSummary: ClaimRiskSummary = {
    high_risk_count: highRiskCount,
    medium_risk_count: mediumRiskCount,
    low_risk_count: lowRiskCount,
    verified_count: verifiedCount,
    inferred_count: inferredCount,
    signal_count: signalCount,
    internal_count: internalCount,
    unsupported_count: unsupportedCount,
    downgraded_count: downgradedCount,
    fact_check_status: factCheckStatus,
    headline_audit: headlineAuditStatus,
  };

  return {
    auditedClaims,
    claimRiskSummary,
    contentLayers,
    auditedTitleKo,
    auditedTitleEn,
    universalFailures,
  };
}
