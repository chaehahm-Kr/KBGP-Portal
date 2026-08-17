import { EvaluatedTopic } from "./topic-evaluator";

export interface QuotaAllocationResult {
  selectedTopics: EvaluatedTopic[];
  networkDraftsCount: number;
  hubDraftsCount: number;
  sharedCoreCount: number;
  uniqueCoreCount: number;
  quotaReason: string;
}

/**
 * Enforces Daily Quota Limits & Shared Topic Allocation Logic.
 * Rule: NETWORK Target = 3 Drafts / Day, HUB Target = 3 Drafts / Day.
 * Shared topics (useful to both Brands & Retailers) are allocated to both channels
 * without artificial caps or truncation.
 */
export function applyDailyQuota(
  evaluatedTopics: EvaluatedTopic[],
  networkMax: number = 3,
  hubMax: number = 3
): QuotaAllocationResult {
  // Filter topics passing score threshold (>=80) and critical conditions
  const qualified = evaluatedTopics.filter((t) => t.passedThreshold);

  if (qualified.length === 0) {
    return {
      selectedTopics: [],
      networkDraftsCount: 0,
      hubDraftsCount: 0,
      sharedCoreCount: 0,
      uniqueCoreCount: 0,
      quotaReason: "No qualifying Insight candidates today (0 topics passed >=80 points & critical conditions).",
    };
  }

  // Sort by total score descending
  qualified.sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);

  const selectedTopics: EvaluatedTopic[] = [];
  let networkUsed = 0;
  let hubUsed = 0;
  let sharedCount = 0;

  for (const topic of qualified) {
    // If both quotas are filled, stop selecting further topics
    if (networkUsed >= networkMax && hubUsed >= hubMax) {
      break;
    }

    const isUsefulForNetwork = topic.candidate.targetAudience === "BOTH" || 
      topic.candidate.targetAudience === "NETWORK" || 
      (topic.candidate.networkRelevanceScore || 0) >= 70;

    const isUsefulForHub = topic.candidate.targetAudience === "BOTH" || 
      topic.candidate.targetAudience === "HUB" || 
      (topic.candidate.hubRelevanceScore || 0) >= 70;

    let allocateNetwork = false;
    let allocateHub = false;

    if (networkUsed < networkMax && isUsefulForNetwork) {
      allocateNetwork = true;
    }

    if (hubUsed < hubMax && isUsefulForHub) {
      allocateHub = true;
    }

    // Fallback: If a channel still needs allocation and candidate was not strictly tagged, allocate to fulfill target
    if (!allocateNetwork && networkUsed < networkMax && !isUsefulForHub) {
      allocateNetwork = true;
    }
    if (!allocateHub && hubUsed < hubMax && !isUsefulForNetwork) {
      allocateHub = true;
    }

    if (allocateNetwork || allocateHub) {
      // Clone topic to assign active channel flags for this run
      const allocatedTopic: EvaluatedTopic = {
        ...topic,
        networkEnabled: allocateNetwork,
        hubEnabled: allocateHub,
      };

      if (allocateNetwork) networkUsed++;
      if (allocateHub) hubUsed++;
      if (allocateNetwork && allocateHub) sharedCount++;

      selectedTopics.push(allocatedTopic);
    }
  }

  const uniqueCoreCount = selectedTopics.length;

  return {
    selectedTopics,
    networkDraftsCount: networkUsed,
    hubDraftsCount: hubUsed,
    sharedCoreCount: sharedCount,
    uniqueCoreCount,
    quotaReason: `Allocated Daily Content Goals: NETWORK ${networkUsed}/${networkMax} Drafts, HUB ${hubUsed}/${hubMax} Drafts (Unique Core Topics: ${uniqueCoreCount}, Shared Topics: ${sharedCount}).`,
  };
}
