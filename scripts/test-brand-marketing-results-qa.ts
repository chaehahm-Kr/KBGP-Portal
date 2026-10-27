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
 * QA Test Suite for Brand Marketing — Campaign Results Integration Readiness & Safety (ADM-BSRC-007-R1)
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
  console.log("ADM-BSRC-007-R1: Campaign Results Integration Readiness & Safety Review QA Suite");
  console.log("================================================================================\n");

  const {
    calculateCampaignSummaryMetrics,
    calculateFollowupDueStatus,
    updateCompanyInterestStatus,
    updateCompanyFollowup,
    recordVerifiedReply,
    setMockFallbackMode,
    isMockFallbackAllowed,
  } = await import("../lib/brand-marketing/results-data-access");

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

  const mockInterests = new Map<string, any>([
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

  assert(metrics.companiesContacted === 3, "Companies Contacted is exactly 3 (unique company IDs)");
  assert(metrics.emailsSent === 5, "Emails Sent is 5 (individual messages, test send excluded)");
  assert(metrics.delivered === 3, "Delivered is 3 (verified delivered messages)");
  assert(metrics.replied === 1, "Replied is 1 (unique responding company c_001)");
  assert(metrics.interestedCompanies === 1, "Interested Companies is 1 (c_001 marked INTERESTED)");
  assert(metrics.meetings === 1, "Meetings is 1");
  assert(metrics.partners === 1, "Partners is 1");

  // Rates verification:
  // deliveryRate = 3 / 5 = 0.6
  assert(metrics.deliveryRate === 0.6, `Delivery rate is 60.0% (got ${metrics.deliveryRate! * 100}%)`);
  // replyRate = 1 / 3 = 0.3333 (Company-level response rate)
  assert(
    metrics.replyRate !== null && Math.abs(metrics.replyRate - 0.3333) < 0.001,
    `Reply rate is ~33.3% company response rate`
  );
  // interestRate = 1 / 3 = 0.3333
  assert(
    metrics.interestRate !== null && Math.abs(metrics.interestRate - 0.3333) < 0.001,
    `Interest rate is ~33.3%`
  );
  // meetingConversionRate = 1 / 3 = 0.3333
  assert(
    metrics.meetingConversionRate !== null && Math.abs(metrics.meetingConversionRate - 0.3333) < 0.001,
    `Meeting conversion rate is ~33.3%`
  );
  // partnerConversionRate = 1 / 3 = 0.3333
  assert(
    metrics.partnerConversionRate !== null && Math.abs(metrics.partnerConversionRate - 0.3333) < 0.001,
    `Partner conversion rate is ~33.3%`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Denominator Edge Cases (No Data vs Measured Zero)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 2: Denominator Edge Cases (No Data vs Measured Zero) ---");
  const emptyCampaign = {
    id: "camp_empty_001",
    name: "Empty Campaign",
  };
  const emptyMetrics = calculateCampaignSummaryMetrics(emptyCampaign, []);

  assert(emptyMetrics.emailsSent === 0, "Empty campaign emailsSent is 0");
  assert(emptyMetrics.companiesContacted === 0, "Empty campaign companiesContacted is 0");
  assert(emptyMetrics.deliveryRate === null, "Delivery rate is null when 0 emails sent (not 0.0)");
  assert(emptyMetrics.replyRate === null, "Reply rate is null when 0 companies contacted");
  assert(emptyMetrics.interestRate === null, "Interest rate is null when 0 companies contacted");

  // Measured Zero Case (Dispatched emails with zero delivery)
  const failedRecipients = [
    { id: "r_f1", campaign_id: "camp_zero_001", company_id: "c_fail", status: "FAILED" },
    { id: "r_f2", campaign_id: "camp_zero_001", company_id: "c_fail", status: "BOUNCED" },
  ];
  const zeroMetrics = calculateCampaignSummaryMetrics(
    { id: "camp_zero_001", name: "All Failed Campaign" },
    failedRecipients
  );

  assert(zeroMetrics.emailsSent === 2, "2 emails dispatched");
  assert(zeroMetrics.delivered === 0, "0 delivered");
  assert(zeroMetrics.deliveryRate === 0, "Delivery rate is measured 0.0 (0%), NOT null");
  assert(zeroMetrics.replyRate === 0, "Reply rate is measured 0.0 (0%), NOT null");

  // --------------------------------------------------------------------------
  // TEST 3: Delivery & Engagement Reliability Disclosures
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 3: Engagement Telemetry & Reliability Disclosures ---");
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
  // TEST 4: Multiple Contacts Per Company (1 Row Aggregation)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 4: Multiple Contacts Per Company (One Row Rule) ---");
  const jdBioRecipients = [
    {
      id: "rec_jd_1",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "ceo@jdbio.com",
      status: "DELIVERED",
    },
    {
      id: "rec_jd_2",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "marketing@jdbio.com",
      status: "DELIVERED",
    },
    {
      id: "rec_jd_3",
      campaign_id: "camp_multi_001",
      company_id: "comp_jd_bio",
      recipient_email: "export@jdbio.com",
      status: "SENT",
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
  // TEST 5: Follow-up Due Status Calculation
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 5: Follow-up Due Status Calculation ---");
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
  // TEST 6: Production Persistence Safety (No Silent In-Memory Writes)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 6: Production Persistence Safety (No Silent In-Memory Writes) ---");
  // Force mock mode OFF to simulate production environment without DB connection
  setMockFallbackMode(false);
  assert(isMockFallbackAllowed() === false, "Mock fallback is strictly disabled");

  const prodUpdateRes = await updateCompanyInterestStatus({
    companyId: "comp_prod_001",
    interestStatus: "INTERESTED",
  });
  assert(
    prodUpdateRes.success === false,
    "Production update without DB returns success: false"
  );
  assert(
    typeof prodUpdateRes.error === "string" && prodUpdateRes.error.length > 0,
    `Clear error message returned: "${prodUpdateRes.error}"`
  );

  const prodFollowupRes = await updateCompanyFollowup({
    companyId: "comp_prod_001",
    nextFollowupDate: tomorrow,
  });
  assert(
    prodFollowupRes.success === false,
    "Production followup without DB returns success: false"
  );

  const prodReplyRes = await recordVerifiedReply("comp_prod_001");
  assert(
    prodReplyRes.success === false,
    "Production recordReply without DB returns success: false"
  );

  // Restore mock fallback for isolated test execution
  setMockFallbackMode(true);
  assert(isMockFallbackAllowed() === true, "Mock fallback re-enabled for isolated test");

  // --------------------------------------------------------------------------
  // TEST 7: Mock-Mode Persistence & Audit History
  // --------------------------------------------------------------------------
  console.log("\n--- TEST 7: Mock-Mode Persistence & Audit History ---");
  const testCompanyId = "comp_test_intercharm_001";

  const updateRes1 = await updateCompanyInterestStatus(
    {
      companyId: testCompanyId,
      interestStatus: "INTERESTED",
      notes: "Met at InterCHARM booth #B12, requested B2B pricing",
    },
    "staff_reviewer@letusto.com"
  );
  assert(updateRes1.success === true, "Interest updated to INTERESTED in test mode");
  assert(updateRes1.interestStatus === "INTERESTED", "Returned status is INTERESTED");

  const followupRes1 = await updateCompanyFollowup(
    {
      companyId: testCompanyId,
      nextFollowupDate: tomorrow,
      followupNote: "Call rep to discuss wholesale terms",
    },
    "sales_lead@letusto.com"
  );
  assert(followupRes1.success === true, "Follow-up saved successfully");

  const followupRes2 = await updateCompanyFollowup(
    {
      companyId: testCompanyId,
      markCompleted: true,
    },
    "sales_lead@letusto.com"
  );
  assert(followupRes2.success === true, "Follow-up marked completed successfully");

  const replyRes = await recordVerifiedReply(
    testCompanyId,
    "camp_test_001",
    undefined,
    "Prospect called directly asking for catalog",
    "operator@letusto.com"
  );
  assert(replyRes.success === true, "Verified reply signal recorded");

  console.log("\n================================================================================");
  console.log("🎉 ALL ADM-BSRC-007-R1 INTEGRATION READINESS & SAFETY TESTS PASSED (100%)");
  console.log("================================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("QA Test Suite Encountered Error:", err);
  process.exit(1);
});
