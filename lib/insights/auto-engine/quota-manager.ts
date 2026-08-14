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
 * Enforces Daily Quota Limits & Shared Core Counting Logic.
 * NETWORK Max: 3 Drafts / Day
 * HUB Max: 3 Drafts / Day
 * Shared Core (Both NETWORK & HUB) counts as 1 Unique Core while consuming 1 NETWORK quota and 1 HUB quota.
 */
export function applyDailyQuota(
  evaluatedTopics: EvaluatedTopic[],
  networkMax: number = 3,
  hubMax: number = 3
): QuotaAllocationResult {
  // Filter only topics that passed score threshold (>=80) and critical conditions
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
    const needsNetwork = topic.networkEnabled;
    const needsHub = topic.hubEnabled;

    const canFitNetwork = needsNetwork ? networkUsed < networkMax : true;
    const canFitHub = needsHub ? hubUsed < hubMax : true;

    if (canFitNetwork && canFitHub) {
      if (needsNetwork) networkUsed++;
      if (needsHub) hubUsed++;
      if (needsNetwork && needsHub) sharedCount++;
      
      selectedTopics.push(topic);
    }
  }

  const uniqueCoreCount = selectedTopics.length;

  return {
    selectedTopics,
    networkDraftsCount: networkUsed,
    hubDraftsCount: hubUsed,
    sharedCoreCount: sharedCount,
    uniqueCoreCount,
    quotaReason: `Allocated ${uniqueCoreCount} Unique Core Insights (NETWORK Quota: ${networkUsed}/${networkMax}, HUB Quota: ${hubUsed}/${hubMax}, Shared Cores: ${sharedCount}).`,
  };
}
