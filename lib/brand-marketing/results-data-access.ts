import "server-only";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  CompanyInterestStatus,
  CompanyResultItem,
  CampaignSummaryMetrics,
  RecipientEmailActivity,
  CompanyActivityItem,
  FollowupDueStatus,
  CompanyResultsFilterCriteria,
  UpdateCompanyInterestInput,
  UpdateCompanyFollowupInput,
  DeliveryResultStatus,
} from "./results-types";

// In-memory fallback persistence for isolated QA, tests, and pending DB migrations
const memoryCompanyInterest = new Map<string, CompanyInterestStatus>();
const memoryCompanyFollowups = new Map<
  string,
  {
    nextFollowupDate: string | null;
    followupNote: string | null;
    followupCompletedAt: string | null;
    lastContactDate: string | null;
  }
>();
const memoryActivities = new Map<string, CompanyActivityItem[]>();

// Explicit mock mode control to prevent silent in-memory writes in production
let mockFallbackModeOverride: boolean | null = null;

export function setMockFallbackMode(mode: boolean | null) {
  mockFallbackModeOverride = mode;
}

export function isMockFallbackAllowed(): boolean {
  if (mockFallbackModeOverride !== null) {
    return mockFallbackModeOverride;
  }
  // Strictly disallowed in production runtime
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  // Allowed in explicit test runners or development
  return (
    process.env.NODE_ENV === "test" ||
    process.env.NEXT_PUBLIC_APP_ENV === "test" ||
    process.env.MOCK_BRAND_RESULTS === "true" ||
    process.env.NODE_ENV === "development"
  );
}

async function getClient(customClient?: SupabaseClient): Promise<SupabaseClient | null> {
  if (customClient) return customClient;
  try {
    return await createClient();
  } catch (e) {
    return null;
  }
}

/**
 * Calculates follow-up due status based on date and completion timestamp.
 */
export function calculateFollowupDueStatus(
  nextFollowupDate?: string | null,
  followupCompletedAt?: string | null
): FollowupDueStatus {
  if (followupCompletedAt) return "COMPLETED";
  if (!nextFollowupDate) return "NO_DATE";

  const today = new Date().toISOString().slice(0, 10);
  const targetDate = nextFollowupDate.slice(0, 10);

  if (targetDate < today) return "OVERDUE";
  if (targetDate === today) return "DUE_TODAY";
  return "UPCOMING";
}

/**
 * Aggregates campaign summary metrics from campaign record and recipient snapshots.
 * Adheres strictly to ADM-BSRC-007 counting and reliability rules.
 */
export function calculateCampaignSummaryMetrics(
  campaign: {
    id: string;
    name: string;
    language?: "ko" | "en";
    status?: string;
    createdAt?: string;
    created_at?: string;
  },
  recipients: Array<{
    id: string;
    campaignId?: string;
    campaign_id?: string;
    companyId?: string;
    company_id?: string;
    status: string;
    sentAt?: string | null;
    sent_at?: string | null;
    deliveredAt?: string | null;
    delivered_at?: string | null;
    providerMessageId?: string | null;
    provider_message_id?: string | null;
  }>,
  companyInterests: Map<string, CompanyInterestStatus> = new Map(),
  activities: CompanyActivityItem[] = []
): CampaignSummaryMetrics {
  const campaignDate =
    campaign.createdAt ||
    campaign.created_at ||
    new Date().toISOString();

  // Filter out pure test mode messages if any
  const liveRecipients = recipients.filter(
    (r) => r.status !== "TEST_SENT" && r.status !== "PENDING"
  );

  const emailsSent = liveRecipients.filter(
    (r) => r.status === "SENT" || r.status === "DELIVERED" || r.status === "BOUNCED" || r.status === "FAILED"
  ).length;

  const delivered = liveRecipients.filter((r) => r.status === "DELIVERED").length;

  // Unique companies contacted
  const contactedCompanyIds = new Set<string>();
  liveRecipients.forEach((r) => {
    const cId = r.companyId || r.company_id;
    if (cId) contactedCompanyIds.add(cId);
  });
  const companiesContacted = contactedCompanyIds.size;

  // Count verified replies from activities or records
  const replyActivities = activities.filter(
    (a) =>
      a.campaignId === campaign.id &&
      (a.activityType === "REPLY_RECORDED" || a.activityType === "EMAIL_CLICKED")
  );
  const repliedCompanyIds = new Set<string>();
  replyActivities.forEach((a) => repliedCompanyIds.add(a.companyId));
  const replied = repliedCompanyIds.size;

  // Interested companies associated with this campaign
  let interestedCount = 0;
  contactedCompanyIds.forEach((cId) => {
    if (companyInterests.get(cId) === "INTERESTED") {
      interestedCount++;
    }
  });

  // Meetings and Partners conversion
  const meetings = activities.filter(
    (a) => a.campaignId === campaign.id && a.activityType === "MEETING_SCHEDULED"
  ).length;

  const partners = activities.filter(
    (a) => a.campaignId === campaign.id && a.activityType === "PARTNER_CONVERTED"
  ).length;

  // Rates (Return null when denominator is 0 to distinguish "No Data" from "Measured Zero")
  const deliveryRate = emailsSent > 0 ? Number((delivered / emailsSent).toFixed(4)) : null;
  const replyRate = companiesContacted > 0 ? Number((replied / companiesContacted).toFixed(4)) : null;
  const interestRate =
    companiesContacted > 0 ? Number((interestedCount / companiesContacted).toFixed(4)) : null;
  const meetingConversionRate =
    companiesContacted > 0 ? Number((meetings / companiesContacted).toFixed(4)) : null;
  const partnerConversionRate =
    companiesContacted > 0 ? Number((partners / companiesContacted).toFixed(4)) : null;

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignDate,
    campaignStatus: campaign.status || "COMPLETED",
    language: campaign.language || "ko",
    companiesContacted,
    emailsSent,
    delivered,
    openedEstimated: null, // Transparently disclosed as NOT_TRACKED without provider telemetry
    clicked: null, // Transparently disclosed as NOT_TRACKED without click redirect engine
    replied,
    interestedCompanies: interestedCount,
    meetings,
    partners,
    deliveryRate,
    replyRate,
    interestRate,
    meetingConversionRate,
    partnerConversionRate,
    openTrackingReliability: "NOT_TRACKED",
    clickTrackingSupported: false,
    replyTrackingMode: "MANUAL_VERIFIED",
    hasTestEmailsExcluded: true,
  };
}

/**
 * Sample fallback data for QA preview & testing when DB tables are empty or unmigrated.
 */
function getFallbackCampaignSummary(): CampaignSummaryMetrics {
  return {
    campaignId: "camp_autumn_outreach_2026",
    campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
    campaignDate: "2026-10-20",
    campaignStatus: "COMPLETED",
    language: "ko",
    companiesContacted: 18,
    emailsSent: 24,
    delivered: 22,
    openedEstimated: null,
    clicked: null,
    replied: 5,
    interestedCompanies: 4,
    meetings: 2,
    partners: 1,
    deliveryRate: 0.9167,
    replyRate: 0.2083,
    interestRate: 0.2222,
    meetingConversionRate: 0.1111,
    partnerConversionRate: 0.0556,
    openTrackingReliability: "NOT_TRACKED",
    clickTrackingSupported: false,
    replyTrackingMode: "MANUAL_VERIFIED",
    hasTestEmailsExcluded: true,
  };
}

function getFallbackCompanyResults(filter: CompanyResultsFilterCriteria = {}): CompanyResultItem[] {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const fallbackList: CompanyResultItem[] = [
    {
      companyId: "c_jd_bio_001",
      companyNameKr: "JD BIO (제이디바이오)",
      companyNameEn: "JD BIO Co., Ltd.",
      brandNames: ["JD DERMA", "BIO CLEAN"],
      grade: "A",
      businessTypes: ["MANUFACTURER", "BRAND_OWNER"],
      campaignId: "camp_autumn_outreach_2026",
      campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
      emailsSentCount: 3,
      latestEmailResult: "DELIVERED",
      latestEmailDate: "2026-10-21T01:10:00Z",
      hasReply: true,
      replyStatus: "VERIFIED_REPLIED",
      interestStatus: memoryCompanyInterest.get("c_jd_bio_001") || "INTERESTED",
      nextFollowupDate: memoryCompanyFollowups.get("c_jd_bio_001")?.nextFollowupDate ?? tomorrow,
      followupNote: memoryCompanyFollowups.get("c_jd_bio_001")?.followupNote ?? "Intro Zoom call scheduled with overseas business division",
      followupCompletedAt: memoryCompanyFollowups.get("c_jd_bio_001")?.followupCompletedAt ?? null,
      followupDueStatus: calculateFollowupDueStatus(
        memoryCompanyFollowups.get("c_jd_bio_001")?.nextFollowupDate ?? tomorrow,
        memoryCompanyFollowups.get("c_jd_bio_001")?.followupCompletedAt ?? null
      ),
      lastContactDate: "2026-10-21",
      recipients: [
        {
          id: "rec_jd_1",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_jd_bio_001",
          contactId: "ct_jd_1",
          contactName: "Park Jin-soo (CEO)",
          recipientEmail: "ceo@jdbio.co.kr",
          sentDate: "2026-10-21T01:00:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "VERIFIED_REPLIED",
          lastActivityAt: "2026-10-21T04:20:00Z",
        },
        {
          id: "rec_jd_2",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_jd_bio_001",
          contactId: "ct_jd_2",
          contactName: "Lee Min-ah (Export VP)",
          recipientEmail: "export@jdbio.co.kr",
          sentDate: "2026-10-21T01:05:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "NOT_TRACKED",
          lastActivityAt: "2026-10-21T01:06:00Z",
        },
        {
          id: "rec_jd_3",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_jd_bio_001",
          contactId: "ct_jd_3",
          contactName: "Kim Sung-ho (Marketing)",
          recipientEmail: "marketing@jdbio.co.kr",
          sentDate: "2026-10-21T01:10:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "NOT_TRACKED",
          lastActivityAt: "2026-10-21T01:11:00Z",
        },
      ],
      activities: memoryActivities.get("c_jd_bio_001") || [
        {
          id: "act_jd_1",
          companyId: "c_jd_bio_001",
          campaignId: "camp_autumn_outreach_2026",
          activityType: "REPLY_RECORDED",
          summary: "Verified reply received from CEO Park Jin-soo",
          details: { notes: "Requested US distribution catalog & terms", actor: "admin@kselectnetwork.com" },
          staffEmail: "admin@kselectnetwork.com",
          createdAt: "2026-10-21T04:20:00Z",
        },
        {
          id: "act_jd_2",
          companyId: "c_jd_bio_001",
          campaignId: "camp_autumn_outreach_2026",
          activityType: "INTEREST_CHANGED",
          summary: "Interest status set to INTERESTED",
          details: { newStatus: "INTERESTED", notes: "High potential brand", actor: "admin@kselectnetwork.com" },
          staffEmail: "admin@kselectnetwork.com",
          createdAt: "2026-10-21T04:30:00Z",
        },
      ],
    },
    {
      companyId: "c_cosmax_002",
      companyNameKr: "CosMax Beauty (코스맥스 뷰티)",
      companyNameEn: "CosMax Beauty",
      brandNames: ["PURE CELL"],
      grade: "A",
      businessTypes: ["MANUFACTURER"],
      campaignId: "camp_autumn_outreach_2026",
      campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
      emailsSentCount: 2,
      latestEmailResult: "DELIVERED",
      latestEmailDate: "2026-10-21T01:15:00Z",
      hasReply: false,
      replyStatus: "NO_REPLY",
      interestStatus: memoryCompanyInterest.get("c_cosmax_002") || "UNKNOWN",
      nextFollowupDate: memoryCompanyFollowups.get("c_cosmax_002")?.nextFollowupDate ?? today,
      followupNote: memoryCompanyFollowups.get("c_cosmax_002")?.followupNote ?? "Check if review completed by business lead",
      followupCompletedAt: memoryCompanyFollowups.get("c_cosmax_002")?.followupCompletedAt ?? null,
      followupDueStatus: calculateFollowupDueStatus(
        memoryCompanyFollowups.get("c_cosmax_002")?.nextFollowupDate ?? today,
        memoryCompanyFollowups.get("c_cosmax_002")?.followupCompletedAt ?? null
      ),
      lastContactDate: "2026-10-21",
      recipients: [
        {
          id: "rec_cos_1",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_cosmax_002",
          contactName: "Choi Yu-jin",
          recipientEmail: "yjchoi@cosmaxb.com",
          sentDate: "2026-10-21T01:15:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "NOT_TRACKED",
          lastActivityAt: "2026-10-21T01:15:30Z",
        },
      ],
      activities: memoryActivities.get("c_cosmax_002") || [],
    },
    {
      companyId: "c_nature_003",
      companyNameKr: "Nature Republic Partner (네이처리퍼블릭 협력사)",
      companyNameEn: "Nature Partner Co.",
      brandNames: ["GREEN THERAPY"],
      grade: "B",
      businessTypes: ["BRAND_OWNER"],
      campaignId: "camp_autumn_outreach_2026",
      campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
      emailsSentCount: 1,
      latestEmailResult: "DELIVERED",
      latestEmailDate: "2026-10-21T01:20:00Z",
      hasReply: true,
      replyStatus: "VERIFIED_REPLIED",
      interestStatus: memoryCompanyInterest.get("c_nature_003") || "INTERESTED",
      nextFollowupDate: memoryCompanyFollowups.get("c_nature_003")?.nextFollowupDate ?? yesterday,
      followupNote: memoryCompanyFollowups.get("c_nature_003")?.followupNote ?? "Overdue follow-up call regarding MOQ",
      followupCompletedAt: memoryCompanyFollowups.get("c_nature_003")?.followupCompletedAt ?? null,
      followupDueStatus: calculateFollowupDueStatus(
        memoryCompanyFollowups.get("c_nature_003")?.nextFollowupDate ?? yesterday,
        memoryCompanyFollowups.get("c_nature_003")?.followupCompletedAt ?? null
      ),
      lastContactDate: "2026-10-21",
      recipients: [
        {
          id: "rec_nat_1",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_nature_003",
          contactName: "Jung Tae-woo",
          recipientEmail: "twjung@naturepartner.kr",
          sentDate: "2026-10-21T01:20:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "VERIFIED_REPLIED",
          lastActivityAt: "2026-10-21T06:00:00Z",
        },
      ],
      activities: memoryActivities.get("c_nature_003") || [],
    },
    {
      companyId: "c_derma_004",
      companyNameKr: "Seoul Derma Labs (서울더마랩스)",
      companyNameEn: "Seoul Derma Labs",
      brandNames: ["DERMA LABS"],
      grade: "C",
      businessTypes: ["OEM_ODM"],
      campaignId: "camp_autumn_outreach_2026",
      campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
      emailsSentCount: 1,
      latestEmailResult: "BOUNCED",
      latestEmailDate: "2026-10-21T01:25:00Z",
      hasReply: false,
      replyStatus: "NO_REPLY",
      interestStatus: memoryCompanyInterest.get("c_derma_004") || "NOT_INTERESTED",
      nextFollowupDate: null,
      followupNote: null,
      followupCompletedAt: null,
      followupDueStatus: "NO_DATE",
      lastContactDate: "2026-10-21",
      recipients: [
        {
          id: "rec_der_1",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_derma_004",
          contactName: "Support Team",
          recipientEmail: "invalid-bounce@derma-labs.co.kr",
          sentDate: "2026-10-21T01:25:00Z",
          deliveryResult: "BOUNCED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "NOT_TRACKED",
          lastActivityAt: "2026-10-21T01:25:05Z",
          errorMessage: "550 5.1.1 User unknown",
        },
      ],
      activities: memoryActivities.get("c_derma_004") || [],
    },
    {
      companyId: "c_biokorea_005",
      companyNameKr: "Bio Korea Health (바이오코리아헬스)",
      companyNameEn: "Bio Korea Health Inc.",
      brandNames: ["VITA CARE"],
      grade: "A",
      businessTypes: ["MANUFACTURER"],
      campaignId: "camp_autumn_outreach_2026",
      campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
      emailsSentCount: 2,
      latestEmailResult: "DELIVERED",
      latestEmailDate: "2026-10-21T01:30:00Z",
      hasReply: true,
      replyStatus: "VERIFIED_REPLIED",
      interestStatus: memoryCompanyInterest.get("c_biokorea_005") || "INTERESTED",
      nextFollowupDate: yesterday,
      followupNote: "Onboarding pack sent and signed",
      followupCompletedAt: new Date().toISOString(),
      followupDueStatus: "COMPLETED",
      lastContactDate: "2026-10-21",
      recipients: [
        {
          id: "rec_bio_1",
          campaignId: "camp_autumn_outreach_2026",
          campaignName: "2026 K-Beauty Global Outreach (Autumn Batch)",
          companyId: "c_biokorea_005",
          contactName: "Han Dong-hoon",
          recipientEmail: "dhhan@biokorea.com",
          sentDate: "2026-10-21T01:30:00Z",
          deliveryResult: "DELIVERED",
          openedStatus: "NOT_TRACKED",
          clickedStatus: "NOT_TRACKED",
          repliedStatus: "VERIFIED_REPLIED",
          lastActivityAt: "2026-10-22T08:00:00Z",
        },
      ],
      activities: memoryActivities.get("c_biokorea_005") || [],
    },
  ];

  return fallbackList.filter((item) => {
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      const matchName =
        item.companyNameKr.toLowerCase().includes(q) ||
        (item.companyNameEn && item.companyNameEn.toLowerCase().includes(q)) ||
        item.brandNames.some((b) => b.toLowerCase().includes(q));
      if (!matchName) return false;
    }
    if (filter.emailResult && filter.emailResult !== "ALL") {
      if (item.latestEmailResult !== filter.emailResult) return false;
    }
    if (filter.replyStatus && filter.replyStatus !== "ALL") {
      if (filter.replyStatus === "REPLIED" && !item.hasReply) return false;
      if (filter.replyStatus === "NO_REPLY" && item.hasReply) return false;
    }
    if (filter.interestStatus && filter.interestStatus !== "ALL") {
      if (item.interestStatus !== filter.interestStatus) return false;
    }
    if (filter.followupDueStatus && filter.followupDueStatus !== "ALL") {
      if (item.followupDueStatus !== filter.followupDueStatus) return false;
    }
    return true;
  });
}

/**
 * Loads Campaign Summary Metrics for a specific campaign.
 */
export async function getCampaignResultsSummary(
  campaignId: string,
  customClient?: SupabaseClient
): Promise<CampaignSummaryMetrics | null> {
  try {
    const supabase = await getClient(customClient);
    if (!supabase) {
      if (campaignId === "camp_autumn_outreach_2026") {
        return getFallbackCampaignSummary();
      }
      return null;
    }

    // 1. Fetch Campaign
    const { data: campaign } = await supabase
      .from("marketing_campaigns")
      .select("id, name, language, status, created_at")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      if (campaignId === "camp_autumn_outreach_2026") {
        return getFallbackCampaignSummary();
      }
      return null;
    }

    // 2. Fetch Campaign Recipients
    const { data: recipients } = await supabase
      .from("marketing_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId);

    // 3. Fetch Company Interests
    const companyIds = Array.from(
      new Set((recipients || []).map((r: any) => r.company_id).filter(Boolean))
    );
    const interestsMap = new Map<string, CompanyInterestStatus>();

    if (companyIds.length > 0) {
      try {
        const { data: companies } = await supabase
          .from("sourcing_companies")
          .select("id, interest_status")
          .in("id", companyIds);

        if (companies) {
          companies.forEach((c: any) => {
            interestsMap.set(c.id, c.interest_status || "UNKNOWN");
          });
        }
      } catch (e) {
        // Fallback to memory
        companyIds.forEach((id) => {
          interestsMap.set(id, memoryCompanyInterest.get(id) || "UNKNOWN");
        });
      }
    }

    // 4. Fetch Activities
    let activities: CompanyActivityItem[] = [];
    try {
      const { data: actData } = await supabase
        .from("sourcing_company_activities")
        .select("*")
        .eq("campaign_id", campaignId);

      if (actData) {
        activities = actData.map((a: any) => ({
          id: a.id,
          companyId: a.company_id,
          campaignId: a.campaign_id,
          recipientId: a.recipient_id,
          activityType: a.activity_type,
          summary: a.summary,
          details: a.details || {},
          staffEmail: a.staff_email,
          createdAt: a.created_at,
        }));
      }
    } catch (e) {
      activities = Array.from(memoryActivities.values())
        .flat()
        .filter((a) => a.campaignId === campaignId);
    }

    return calculateCampaignSummaryMetrics(campaign, recipients || [], interestsMap, activities);
  } catch (err) {
    console.warn("[results:campaignSummary] Fallback for campaignId:", campaignId, err);
    return null;
  }
}

/**
 * Loads Company Results List, combining company master records, campaign recipients,
 * follow-up state, and activity logs.
 * One row per company for the selected campaign context.
 */
export async function listCompanyResults(
  filter: CompanyResultsFilterCriteria = {},
  customClient?: SupabaseClient
): Promise<CompanyResultItem[]> {
  try {
    const supabase = await getClient(customClient);
    if (!supabase) {
      if (!filter.campaignId || filter.campaignId === "ALL" || filter.campaignId === "camp_autumn_outreach_2026") {
        return getFallbackCompanyResults(filter);
      }
      return [];
    }

    // 1. Fetch campaigns map
    let campaignsMap = new Map<string, { id: string; name: string; created_at: string }>();
    try {
      const { data: campaigns } = await supabase
        .from("marketing_campaigns")
        .select("id, name, created_at");
      if (campaigns) {
        campaigns.forEach((c: any) => campaignsMap.set(c.id, c));
      }
    } catch {}

    // 2. Fetch recipients
    let recQuery = supabase.from("marketing_campaign_recipients").select("*");
    if (filter.campaignId && filter.campaignId !== "ALL") {
      recQuery = recQuery.eq("campaign_id", filter.campaignId);
    }
    const { data: recipientRows, error: recError } = await recQuery;

    if (recError || !recipientRows || recipientRows.length === 0) {
      if (!filter.campaignId || filter.campaignId === "ALL" || filter.campaignId === "camp_autumn_outreach_2026") {
        return getFallbackCompanyResults(filter);
      }
      return [];
    }

    // 3. Group recipients by company_id
    const companyRecipientsMap = new Map<string, any[]>();
    recipientRows.forEach((r: any) => {
      const list = companyRecipientsMap.get(r.company_id) || [];
      list.push(r);
      companyRecipientsMap.set(r.company_id, list);
    });

    const companyIds = Array.from(companyRecipientsMap.keys());
    if (companyIds.length === 0) return [];

    // 4. Fetch company master data
    const { data: companiesData } = await supabase
      .from("sourcing_companies")
      .select(`
        id,
        company_name_kr,
        company_name_en,
        grade,
        business_types,
        assigned_to,
        interest_status,
        next_followup_date,
        followup_note,
        followup_completed_at,
        last_contact_date,
        sourcing_brands (
          brand_name_kr,
          brand_name_en
        )
      `)
      .in("id", companyIds);

    const companyMasterMap = new Map<string, any>();
    if (companiesData) {
      companiesData.forEach((c: any) => companyMasterMap.set(c.id, c));
    }

    // 5. Fetch activities
    let activitiesMap = new Map<string, CompanyActivityItem[]>();
    try {
      const { data: actRows } = await supabase
        .from("sourcing_company_activities")
        .select("*")
        .in("company_id", companyIds)
        .order("created_at", { ascending: false });

      if (actRows) {
        actRows.forEach((a: any) => {
          const list = activitiesMap.get(a.company_id) || [];
          list.push({
            id: a.id,
            companyId: a.company_id,
            campaignId: a.campaign_id,
            recipientId: a.recipient_id,
            activityType: a.activity_type,
            summary: a.summary,
            details: a.details || {},
            staffEmail: a.staff_email,
            createdAt: a.created_at,
          });
          activitiesMap.set(a.company_id, list);
        });
      }
    } catch {}

    // 6. Build CompanyResultItem list
    const results: CompanyResultItem[] = [];

    companyRecipientsMap.forEach((recList, cId) => {
      const master = companyMasterMap.get(cId) || {};
      const companyActs = activitiesMap.get(cId) || memoryActivities.get(cId) || [];
      const memoryFollowup = memoryCompanyFollowups.get(cId);

      const interestStatus: CompanyInterestStatus =
        master.interest_status || memoryCompanyInterest.get(cId) || "UNKNOWN";

      const nextFollowupDate = master.next_followup_date || memoryFollowup?.nextFollowupDate || null;
      const followupNote = master.followup_note || memoryFollowup?.followupNote || null;
      const followupCompletedAt =
        master.followup_completed_at || memoryFollowup?.followupCompletedAt || null;
      const lastContactDate = master.last_contact_date || memoryFollowup?.lastContactDate || null;

      const followupDueStatus = calculateFollowupDueStatus(nextFollowupDate, followupCompletedAt);

      // Primary campaign context
      const firstRec = recList[0];
      const campInfo = campaignsMap.get(firstRec.campaign_id) || {
        id: firstRec.campaign_id,
        name: "Brand Outreach Campaign",
        created_at: firstRec.created_at,
      };

      // Recipient activities
      const recipients: RecipientEmailActivity[] = recList.map((r: any) => {
        let deliveryResult: DeliveryResultStatus = "SENT";
        if (r.status === "DELIVERED") deliveryResult = "DELIVERED";
        else if (r.status === "BOUNCED") deliveryResult = "BOUNCED";
        else if (r.status === "FAILED") deliveryResult = "FAILED";
        else if (r.status === "SENT") deliveryResult = "SENT";
        else if (r.status === "PENDING") deliveryResult = "PENDING";

        // Check if there are specific activities for this recipient
        const hasClick = companyActs.some(
          (a) => a.recipientId === r.id && a.activityType === "EMAIL_CLICKED"
        );
        const hasReply = companyActs.some(
          (a) => a.recipientId === r.id && a.activityType === "REPLY_RECORDED"
        );

        return {
          id: r.id,
          campaignId: r.campaign_id,
          campaignName: campInfo.name,
          companyId: r.company_id,
          contactId: r.contact_id,
          contactName: r.recipient_name,
          recipientEmail: r.recipient_email,
          sentDate: r.sent_at || r.created_at,
          deliveryResult,
          openedStatus: "NOT_TRACKED",
          clickedStatus: hasClick ? "TRACKED_CLICKED" : "NOT_TRACKED",
          repliedStatus: hasReply ? "VERIFIED_REPLIED" : "NOT_TRACKED",
          lastActivityAt: r.delivered_at || r.sent_at || r.created_at,
          errorMessage: r.error_message,
        };
      });

      // Latest email result
      const sortedRecs = [...recipients].sort(
        (a, b) => new Date(b.sentDate || 0).getTime() - new Date(a.sentDate || 0).getTime()
      );
      const latestEmailResult = sortedRecs[0]?.deliveryResult || "SENT";
      const latestEmailDate = sortedRecs[0]?.sentDate || null;

      // Has verified reply
      const hasReply = companyActs.some((a) => a.activityType === "REPLY_RECORDED");

      // Brand names
      const brandNames: string[] = [];
      if (master.sourcing_brands && Array.isArray(master.sourcing_brands)) {
        master.sourcing_brands.forEach((b: any) => {
          if (b.brand_name_kr) brandNames.push(b.brand_name_kr);
          else if (b.brand_name_en) brandNames.push(b.brand_name_en);
        });
      }
      if (brandNames.length === 0 && firstRec.brand_name) {
        brandNames.push(firstRec.brand_name);
      }

      const item: CompanyResultItem = {
        companyId: cId,
        companyNameKr: master.company_name_kr || firstRec.company_name_kr || "미등록 기업",
        companyNameEn: master.company_name_en || firstRec.company_name_en || null,
        brandNames,
        grade: master.grade || "UNRATED",
        businessTypes: master.business_types || [],
        campaignId: campInfo.id,
        campaignName: campInfo.name,
        campaignDate: campInfo.created_at,
        emailsSentCount: recipients.length,
        latestEmailResult,
        latestEmailDate,
        hasReply,
        replyStatus: hasReply ? "VERIFIED_REPLIED" : "NOT_TRACKED",
        interestStatus,
        nextFollowupDate,
        followupNote,
        followupCompletedAt,
        followupDueStatus,
        lastContactDate,
        assignedStaff: master.assigned_to || null,
        recipients,
        activities: companyActs,
      };

      // Apply Filters
      let matches = true;

      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        const inNameKr = item.companyNameKr.toLowerCase().includes(q);
        const inNameEn = (item.companyNameEn || "").toLowerCase().includes(q);
        const inBrand = item.brandNames.some((b) => b.toLowerCase().includes(q));
        const inEmail = item.recipients.some((r) => r.recipientEmail.toLowerCase().includes(q));
        if (!inNameKr && !inNameEn && !inBrand && !inEmail) matches = false;
      }

      if (filter.emailResult && filter.emailResult !== "ALL") {
        if (item.latestEmailResult !== filter.emailResult) matches = false;
      }

      if (filter.replyStatus && filter.replyStatus !== "ALL") {
        if (filter.replyStatus === "REPLIED" && !item.hasReply) matches = false;
        if (filter.replyStatus === "NO_REPLY" && item.hasReply) matches = false;
      }

      if (filter.interestStatus && filter.interestStatus !== "ALL") {
        if (item.interestStatus !== filter.interestStatus) matches = false;
      }

      if (filter.followupDueStatus && filter.followupDueStatus !== "ALL") {
        if (item.followupDueStatus !== filter.followupDueStatus) matches = false;
      }

      if (matches) {
        results.push(item);
      }
    });

    return results;
  } catch (err) {
    console.warn("[results:listCompanyResults] Failed to query DB:", err);
    return [];
  }
}

/**
 * Updates Company Interest Status manually.
 * Audits the change with actor and timestamp.
 */
export async function updateCompanyInterestStatus(
  input: UpdateCompanyInterestInput,
  actorEmail: string = "admin@kselectnetwork.com",
  customClient?: SupabaseClient
): Promise<{ success: boolean; interestStatus?: CompanyInterestStatus; error?: string }> {
  try {
    const supabase = await getClient(customClient);

    if (!supabase && !isMockFallbackAllowed()) {
      return {
        success: false,
        error: "Database client unavailable. Cannot persist interest status in production.",
      };
    }

    // Save in DB if client is available
    if (supabase) {
      const { error: dbError } = await supabase
        .from("sourcing_companies")
        .update({
          interest_status: input.interestStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.companyId);

      if (dbError) {
        if (!isMockFallbackAllowed()) {
          return {
            success: false,
            error: `Failed to persist interest status in DB: ${dbError.message}`,
          };
        }
        console.warn("[results:interest] DB update skipped or column missing:", dbError.message);
      }
    }

    // Update memory store for test/mock consistency
    memoryCompanyInterest.set(input.companyId, input.interestStatus);

    // Audit log
    const activity: CompanyActivityItem = {
      id: "act-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()),
      companyId: input.companyId,
      campaignId: input.campaignId,
      activityType: "INTEREST_CHANGED",
      summary: `Interest status set to ${input.interestStatus}`,
      details: {
        newStatus: input.interestStatus,
        notes: input.notes || null,
        actor: actorEmail,
      },
      staffEmail: actorEmail,
      createdAt: new Date().toISOString(),
    };

    let savedToDb = false;
    if (supabase) {
      try {
        const { error } = await supabase.from("sourcing_company_activities").insert({
          company_id: input.companyId,
          campaign_id: input.campaignId,
          activity_type: "INTEREST_CHANGED",
          summary: activity.summary,
          details: activity.details,
          staff_email: actorEmail,
        });
        if (!error) savedToDb = true;
      } catch (e) {}
    }

    if (!savedToDb) {
      const list = memoryActivities.get(input.companyId) || [];
      list.unshift(activity);
      memoryActivities.set(input.companyId, list);
    }

    return { success: true, interestStatus: input.interestStatus };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update interest status" };
  }
}

/**
 * Updates Company Follow-up Details (Date, Note, Mark Completed).
 */
export async function updateCompanyFollowup(
  input: UpdateCompanyFollowupInput,
  actorEmail: string = "admin@kselectnetwork.com",
  customClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getClient(customClient);

    if (!supabase && !isMockFallbackAllowed()) {
      return {
        success: false,
        error: "Database client unavailable. Cannot persist follow-up in production.",
      };
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      updated_at: now,
    };

    if (input.nextFollowupDate !== undefined) {
      updatePayload.next_followup_date = input.nextFollowupDate;
    }
    if (input.followupNote !== undefined) {
      updatePayload.followup_note = input.followupNote;
    }
    if (input.markCompleted) {
      updatePayload.followup_completed_at = now;
    }

    if (supabase) {
      const { error: dbError } = await supabase
        .from("sourcing_companies")
        .update(updatePayload)
        .eq("id", input.companyId);

      if (dbError) {
        if (!isMockFallbackAllowed()) {
          return {
            success: false,
            error: `Failed to persist follow-up in DB: ${dbError.message}`,
          };
        }
        console.warn("[results:followup] DB update skipped or column missing:", dbError.message);
      }
    }

    // Sync memory store
    const existing = memoryCompanyFollowups.get(input.companyId) || {
      nextFollowupDate: null,
      followupNote: null,
      followupCompletedAt: null,
      lastContactDate: null,
    };

    if (input.nextFollowupDate !== undefined) {
      existing.nextFollowupDate = input.nextFollowupDate;
    }
    if (input.followupNote !== undefined) {
      existing.followupNote = input.followupNote;
    }
    if (input.markCompleted) {
      existing.followupCompletedAt = now;
    }
    memoryCompanyFollowups.set(input.companyId, existing);

    // Audit log
    let activityType: CompanyActivityItem["activityType"] = "FOLLOWUP_NOTE_UPDATED";
    let summary = "Follow-up note updated";

    if (input.markCompleted) {
      activityType = "FOLLOWUP_COMPLETED";
      summary = "Follow-up marked completed";
    } else if (input.nextFollowupDate) {
      activityType = "FOLLOWUP_SCHEDULED";
      summary = `Follow-up scheduled for ${input.nextFollowupDate}`;
    }

    const activity: CompanyActivityItem = {
      id: "act-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()),
      companyId: input.companyId,
      campaignId: input.campaignId,
      activityType,
      summary,
      details: {
        nextFollowupDate: input.nextFollowupDate,
        followupNote: input.followupNote,
        completed: !!input.markCompleted,
        actor: actorEmail,
      },
      staffEmail: actorEmail,
      createdAt: now,
    };

    let savedToDb = false;
    if (supabase) {
      try {
        const { error } = await supabase.from("sourcing_company_activities").insert({
          company_id: input.companyId,
          campaign_id: input.campaignId,
          activity_type: activityType,
          summary,
          details: activity.details,
          staff_email: actorEmail,
        });
        if (!error) savedToDb = true;
      } catch (e) {}
    }

    if (!savedToDb) {
      const list = memoryActivities.get(input.companyId) || [];
      list.unshift(activity);
      memoryActivities.set(input.companyId, list);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update follow-up" };
  }
}

/**
 * Manually records a verified response / reply signal from a company contact.
 */
export async function recordVerifiedReply(
  companyId: string,
  campaignId?: string,
  recipientId?: string,
  notes?: string,
  actorEmail: string = "admin@kselectnetwork.com",
  customClient?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getClient(customClient);

    if (!supabase && !isMockFallbackAllowed()) {
      return {
        success: false,
        error: "Database client unavailable. Cannot record reply in production.",
      };
    }

    const now = new Date().toISOString();

    const activity: CompanyActivityItem = {
      id: "act-" + (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()),
      companyId,
      campaignId,
      recipientId,
      activityType: "REPLY_RECORDED",
      summary: "Verified reply received from company contact",
      details: { notes, verifiedBy: actorEmail },
      staffEmail: actorEmail,
      createdAt: now,
    };

    let savedToDb = false;
    if (supabase) {
      const { error: dbError } = await supabase.from("sourcing_company_activities").insert({
        company_id: companyId,
        campaign_id: campaignId,
        recipient_id: recipientId,
        activity_type: "REPLY_RECORDED",
        summary: activity.summary,
        details: activity.details,
        staff_email: actorEmail,
      });
      if (dbError) {
        if (!isMockFallbackAllowed()) {
          return {
            success: false,
            error: `Failed to record reply in DB: ${dbError.message}`,
          };
        }
        console.warn("[results:reply] DB insert failed, using test mock fallback:", dbError.message);
      } else {
        savedToDb = true;
      }
    }

    if (!savedToDb) {
      const list = memoryActivities.get(companyId) || [];
      list.unshift(activity);
      memoryActivities.set(companyId, list);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to record reply" };
  }
}
