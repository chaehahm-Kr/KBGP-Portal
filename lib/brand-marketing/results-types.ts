/**
 * Brand Marketing Phase 2 — Campaign Results & Company Follow-up Types
 * Task ID: ADM-BSRC-007
 * Standards: DEPLOY-STD-001, CONCURRENT-DEV-001, DEV-SQL-MIGRATION-STD-001, AGENTS.md Rule 27
 */

export type CompanyInterestStatus = "UNKNOWN" | "INTERESTED" | "NOT_INTERESTED";

export type DeliveryResultStatus =
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "OPENED_ESTIMATED"
  | "CLICKED"
  | "REPLIED"
  | "BOUNCED"
  | "FAILED"
  | "UNSUBSCRIBED";

export type FollowupDueStatus = "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "NO_DATE" | "COMPLETED";

export type CompanyActivityType =
  | "EMAIL_SENT"
  | "EMAIL_DELIVERED"
  | "EMAIL_FAILED"
  | "EMAIL_BOUNCED"
  | "EMAIL_CLICKED"
  | "REPLY_RECORDED"
  | "INTEREST_CHANGED"
  | "FOLLOWUP_SCHEDULED"
  | "FOLLOWUP_NOTE_UPDATED"
  | "FOLLOWUP_COMPLETED"
  | "MEETING_SCHEDULED"
  | "PARTNER_CONVERTED";

export interface CompanyActivityItem {
  id: string;
  companyId: string;
  campaignId?: string | null;
  campaignName?: string | null;
  recipientId?: string | null;
  activityType: CompanyActivityType;
  summary: string;
  details: Record<string, any>;
  staffEmail?: string | null;
  createdAt: string;
}

export interface RecipientEmailActivity {
  id: string;
  campaignId: string;
  campaignName: string;
  companyId: string;
  contactId?: string | null;
  contactName?: string | null;
  recipientEmail: string;
  sentDate?: string | null;
  deliveryResult: DeliveryResultStatus;
  openedStatus: "TRACKED_OPENED" | "NOT_TRACKED" | "UNOPENED";
  clickedStatus: "TRACKED_CLICKED" | "NOT_TRACKED" | "NOT_CLICKED";
  repliedStatus: "VERIFIED_REPLIED" | "NO_REPLY" | "NOT_TRACKED";
  lastActivityAt?: string | null;
  errorMessage?: string | null;
}

export interface CompanyResultItem {
  companyId: string;
  companyNameKr: string;
  companyNameEn?: string | null;
  brandNames: string[];
  grade: "A" | "B" | "C" | "UNRATED";
  businessTypes: string[];
  campaignId: string;
  campaignName: string;
  campaignDate?: string | null;
  emailsSentCount: number;
  latestEmailResult: DeliveryResultStatus;
  latestEmailDate?: string | null;
  hasReply: boolean;
  replyStatus: "VERIFIED_REPLIED" | "NO_REPLY" | "NOT_TRACKED";
  interestStatus: CompanyInterestStatus;
  nextFollowupDate?: string | null;
  followupNote?: string | null;
  followupCompletedAt?: string | null;
  followupDueStatus: FollowupDueStatus;
  lastContactDate?: string | null;
  assignedStaff?: string | null;
  recipients: RecipientEmailActivity[];
  activities: CompanyActivityItem[];
}

export interface CampaignSummaryMetrics {
  campaignId: string;
  campaignName: string;
  campaignDate: string;
  campaignStatus: string;
  language: "ko" | "en";
  companiesContacted: number; // unique company IDs
  emailsSent: number; // individual messages sent
  delivered: number;
  openedEstimated: number | null; // estimated, null if NOT_TRACKED
  clicked: number | null; // real click events, null if NOT_TRACKED
  replied: number; // unique responding companies / verified replies
  interestedCompanies: number; // unique companies marked INTERESTED
  meetings: number; // unique companies with meetings
  partners: number; // unique companies converted to partners

  // Rates (0 to 1)
  deliveryRate: number; // delivered / emailsSent
  replyRate: number; // replied / emailsSent
  interestRate: number; // interestedCompanies / companiesContacted
  meetingConversionRate: number; // meetings / companiesContacted
  partnerConversionRate: number; // partners / companiesContacted

  // Integration & Verification Disclosure
  openTrackingReliability: "ESTIMATED_ONLY" | "NOT_TRACKED";
  clickTrackingSupported: boolean;
  replyTrackingMode: "MANUAL_VERIFIED" | "PROVIDER_EVENT" | "NOT_TRACKED";
  hasTestEmailsExcluded: boolean;
}

export interface CompanyResultsFilterCriteria {
  campaignId?: string;
  searchQuery?: string;
  emailResult?: DeliveryResultStatus | "ALL";
  replyStatus?: "ALL" | "REPLIED" | "NO_REPLY";
  interestStatus?: CompanyInterestStatus | "ALL";
  followupDueStatus?: FollowupDueStatus | "ALL";
}

export interface UpdateCompanyInterestInput {
  companyId: string;
  interestStatus: CompanyInterestStatus;
  campaignId?: string;
  notes?: string;
}

export interface UpdateCompanyFollowupInput {
  companyId: string;
  nextFollowupDate?: string | null;
  followupNote?: string | null;
  markCompleted?: boolean;
  campaignId?: string;
}
