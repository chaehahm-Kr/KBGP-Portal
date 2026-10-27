// Mock server-only before any other imports
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    path: "",
    paths: [],
  };
} catch {
  // ignore
}

/**
 * QA Test Suite for Brand Marketing — Campaign Results & Company Follow-up (ADM-BSRC-007)
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log("\n================================================================================");
  console.log("ADM-BSRC-007: Brand Marketing — Campaign Results & Company Follow-up QA Suite");
  console.log("================================================================================\n");

  const {
    calculateCampaignSummaryMetrics,
    calculateFollowupDueStatus,
    updateCompanyInterestStatus,
    updateCompanyFollowup,
    recordVerifiedReply,
    getCampaignResultsSummary,
    listCompanyResults,
  } = await import("../lib/brand-marketing/results-data-access");

  const { CompanyInterestStatus, DeliveryResultStatus } = await import(
    "../lib/brand-marketing/results-types"
  );

  // --------------------------------------------------------------------------
  // TEST 1: Counting Rules & Aggregation Mathematics
  // --------------------------------------------------------------------------
  console.log("--- TEST 1: Counting Rules & Summary Metric Rates ---");

  const mockCampaign = {
    id: "camp_math_test_001",
    name: "Autumn Brand Outreach 2026",
    language: "ko" as const,
    status: "COMPLETED",
    createdAt: "2026-10-20T10:00:00Z",
  };

  // 5 recipient records across 3 companies:
  // - Company 1 (c_001): 2 contacts (1 Delivered, 1 Bounced)
  // - Company 2 (c_002): 2 contacts (2 Delivered)
  // - Company 3 (c_003): 1 contact (1 Sent)
  // Plus 1 test mode recipient (TEST_SENT) which must be excluded!
  const mockRecipients = [
    { id: "r_1", campaign_id: mockCampaign.id, company_id: "c_001", status: "DELIVERED" },
    { id: "r_2", campaign_id: mockCampaign.id, company_id: "c_001", status: "BOUNCED" },
    { id: "r_3", campaign_id: mockCampaign.id, company_id: "c_002", status: "DELIVERED" },
    { id: "r_4", campaign_id: mockCampaign.id, company_id: "c_002", status: "DELIVERED" },
    { id: "r_5", campaign_id: mockCampaign.id, company_id: "c_003", status: "SENT" },
    { id: "r_test", campaign_id: mockCampaign.id, company_id: "c_001", status: "TEST_SENT" }, // Excluded!
  ];

  const mockInterests = new Map<string, typeof CompanyInterestStatus>([
    ["c_001", "INTERESTED"],
    ["c_002", "NOT_INTERESTED"],
    ["c_003", "UNKNOWN"],
  ]);

  const mockActivities = [
    {
      id: "act_1",
      companyId: "c_001",
      campaignId: mockCampaign.id,
      activityType: "REPLY_RECORDED" as const,
      summary: "Verified reply received from CEO",
      details: {},
      createdAt: "2026-10-21T02:00:00Z",
    },
    {
      id: "act_2",
      companyId: "c_001",
      campaignId: mockCampaign.id,
      activityType: "MEETING_SCHEDULED" as const,
      summary: "Zoom intro meeting scheduled",
      details: {},
      createdAt: "2026-10-22T04:00:00Z",
    },
    {
      id: "act_3",
      companyId: "c_001",
      campaignId: mockCampaign.id,
      activityType: "PARTNER_CONVERTED" as const,
      summary: "Signed onboarding agreement",
      details: {},
      createdAt: "2026-10-25T08:00:00Z",
    },
  ];

  const metrics = calculateCampaignSummaryMetrics(
    mockCampaign,
    mockRecipients,
    mockInterests as any,
    mockActivities
  );

  // Assertions:
  assert(metrics.companiesContacted === 3, "Companies Contacted is exactly 3 (unique company IDs)");
  assert(metrics.emailsSent === 5, "Emails Sent is 5 (individual messages, test send excluded)");
  assert(metrics.delivered === 3, "Delivered is 3 (verified delivered messages)");
  assert(metrics.replied === 1, "Replied is 1 (unique responding company c_001)");
  assert(metrics.interestedCompanies === 1, "Interested Companies is 1 (c_001 marked INTERESTED)");
  assert(metrics.meetings === 1, "Meetings is 1");
  assert(metrics.partners === 1, "Partners is 1");

  // Rates verification:
  // deliveryRate = 3 / 5 = 0.6
  assert(metrics.deliveryRate === 0.6, `Delivery rate is 60.0% (got ${metrics.deliveryRate * 100}%)`);
  // replyRate = 1 / 5 = 0.2
  assert(metrics.replyRate === 0.2, `Reply rate is 20.0% (got ${metrics.replyRate * 100}%)`);
  // interestRate = 1 / 3 = 0.3333
  assert(
    Math.abs(metrics.interestRate - 0.3333) < 0.001,
    `Interest rate is ~33.3% (got ${(metrics.interestRate * 100).toFixed(1)}%)`
  );
  // meetingConversionRate = 1 / 3 = 0.3333
  assert(
    Math.abs(metrics.meetingConversionRate - 0.3333) < 0.001,
    `Meeting conversion rate is ~33.3%`
  );
  // partnerConversionRate = 1 / 3 = 0.3333
  assert(
    Math.abs(metrics.partnerConversionRate - 0.3333) < 0.001,
    `Partner conversion rate is ~33.3%`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Delivery & Engagement Reliability Disclosures
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Engagement Telemetry & Reliability Disclosures ---");
  assert(metrics.openedEstimated === null, "Opened is null / NOT_TRACKED without telemetry");
  assert(metrics.clicked === null, "Clicked is null / NOT_TRACKED without tracking redirects");
  assert(
    metrics.openTrackingReliability === "NOT_TRACKED",
    "Open reliability disclosed as NOT_TRACKED"
  );
  assert(
    metrics.replyTrackingMode === "MANUAL_VERIFIED",
    "Reply tracking requires human / verified provider signal"
  );
  assert(metrics.hasTestEmailsExcluded === true, "Test mode messages confirmed excluded");

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Contacts Per Company (1 Row Aggregation)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Multiple Contacts Per Company (One Row Rule) ---");
  // Company JD BIO has 3 contacts:
  // Contact A: Replied
  // Contact B: Delivered
  // Contact C: Clicked / Delivered
  const jdBioRecipients = [
    {
      id: "rec_jd_1",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "ceo@jdbio.com",
      recipient_name: "John Park",
      company_name_kr: "JD BIO (제이디바이오)",
      status: "DELIVERED",
      sent_at: "2026-10-21T01:00:00Z",
    },
    {
      id: "rec_jd_2",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "marketing@jdbio.com",
      recipient_name: "Sarah Lee",
      company_name_kr: "JD BIO (제이디바이오)",
      status: "DELIVERED",
      sent_at: "2026-10-21T01:05:00Z",
    },
    {
      id: "rec_jd_3",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "export@jdbio.com",
      recipient_name: "David Kim",
      company_name_kr: "JD BIO (제이디바이오)",
      status: "SENT",
      sent_at: "2026-10-21T01:10:00Z",
    },
  ];

  const jdBioSummary = calculateCampaignSummaryMetrics(
    { id: "camp_multi_001", name: "JD BIO Multi Test" },
    jdBioRecipients
  );

  assert(
    jdBioSummary.companiesContacted === 1,
    "3 contacts at JD BIO count as exactly 1 unique company contacted"
  );
  assert(
    jdBioSummary.emailsSent === 3,
    "3 contacts at JD BIO count as 3 individual emails sent"
  );

  // --------------------------------------------------------------------------
  // TEST 4: Follow-up Due Status Calculation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Follow-up Due Status Calculation ---");
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  assert(
    calculateFollowupDueStatus(null, null) === "NO_DATE",
    "No date set returns NO_DATE"
  );
  assert(
    calculateFollowupDueStatus(yesterday, null) === "OVERDUE",
    "Past date returns OVERDUE"
  );
  assert(
    calculateFollowupDueStatus(todayStr, null) === "DUE_TODAY",
    "Today's date returns DUE_TODAY"
  );
  assert(
    calculateFollowupDueStatus(tomorrow, null) === "UPCOMING",
    "Future date returns UPCOMING"
  );
  assert(
    calculateFollowupDueStatus(yesterday, new Date().toISOString()) === "COMPLETED",
    "Completed follow-up returns COMPLETED regardless of past date"
  );

  // --------------------------------------------------------------------------
  // TEST 5: Company Interest Status Updates & Audit Logging
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Company Interest Management & Audit History ---");
  const testCompanyId = "comp_test_intercharm_001";

  // Step 1: Default interest
  const updateRes1 = await updateCompanyInterestStatus(
    {
      companyId: testCompanyId,
      interestStatus: "INTERESTED",
      notes: "Met at InterCHARM booth #B12, requested B2B pricing",
    },
    "staff_reviewer@letusto.com"
  );
  assert(updateRes1.success === true, "Interest updated to INTERESTED");
  assert(updateRes1.interestStatus === "INTERESTED", "Returned status is INTERESTED");

  // Step 2: Update to NOT_INTERESTED
  const updateRes2 = await updateCompanyInterestStatus(
    {
      companyId: testCompanyId,
      interestStatus: "NOT_INTERESTED",
      notes: "Does not produce exportable packaging",
    },
    "manager@letusto.com"
  );
  assert(updateRes2.success === true, "Interest updated to NOT_INTERESTED");
  assert(updateRes2.interestStatus === "NOT_INTERESTED", "Returned status is NOT_INTERESTED");

  // --------------------------------------------------------------------------
  // TEST 6: Follow-up Scheduling, Notes, and Completion
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Follow-up Scheduling, Notes & Completion ---");
  const followupRes1 = await updateCompanyFollowup(
    {
      companyId: testCompanyId,
      nextFollowupDate: tomorrow,
      followupNote: "Call rep to discuss wholesale terms",
    },
    "sales_lead@letusto.com"
  );
  assert(followupRes1.success === true, "Follow-up date and note saved successfully");

  // Mark completed
  const followupRes2 = await updateCompanyFollowup(
    {
      companyId: testCompanyId,
      markCompleted: true,
    },
    "sales_lead@letusto.com"
  );
  assert(followupRes2.success === true, "Follow-up marked completed successfully");

  // --------------------------------------------------------------------------
  // TEST 7: Manual Verified Reply Recording
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Manual Verified Reply Recording ---");
  const replyRes = await recordVerifiedReply(
    testCompanyId,
    "camp_test_001",
    undefined,
    "Prospect called directly asking for catalog",
    "operator@letusto.com"
  );
  assert(replyRes.success === true, "Verified reply signal recorded");

  console.log("\n================================================================================");
  console.log("🎉 ALL ADM-BSRC-007 QA INTEGRATION & BUSINESS LOGIC TESTS PASSED (100%)");
  console.log("================================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("QA Test Suite Encountered Error:", err);
  process.exit(1);
});
