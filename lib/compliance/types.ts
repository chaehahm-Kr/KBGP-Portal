export type ComplianceReviewStatus =
  | "not_started"
  | "in_review"
  | "info_requested"
  | "needs_followup"
  | "completed";

export const COMPLIANCE_REVIEW_STATUSES: ComplianceReviewStatus[] = [
  "not_started",
  "in_review",
  "info_requested",
  "needs_followup",
  "completed",
];

export const COMPLIANCE_REVIEW_SECTIONS = [
  "overall",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "product_classification",
  "product_labeling",
  "fda_related",
  "mocra",
  "otc_drug_facts",
  "certifications_testing",
  "import_customs",
] as const;

export type ComplianceReviewSection = (typeof COMPLIANCE_REVIEW_SECTIONS)[number];

export interface ProductComplianceReviewItem {
  id: string;
  product_id: string;
  section_id: string;
  status: ComplianceReviewStatus;
  reviewer_id: string | null;
  notes: string | null;
  evidence_reference: string | null;
  related_inquiry_id: string | null;
  last_reviewed_at: string;
  created_at?: string;
  updated_at?: string;
  reviewer?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  inquiry?: {
    id: string;
    case_number: string | null;
    title: string;
    status: string;
  } | null;
}

export interface SaveComplianceReviewInput {
  productId: string;
  sectionId: string;
  status: ComplianceReviewStatus;
  notes?: string | null;
  evidenceReference?: string | null;
  relatedInquiryId?: string | null;
}

export const COMPLIANCE_REVIEW_STATUS_CONFIG: Record<
  ComplianceReviewStatus,
  {
    labelKo: string;
    labelEn: string;
    color: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  not_started: {
    labelKo: "미시작",
    labelEn: "Not Started",
    color: "zinc",
    badgeClass: "bg-zinc-800 text-zinc-400 border border-zinc-700/60",
    dotClass: "bg-zinc-500",
  },
  in_review: {
    labelKo: "검토 중",
    labelEn: "In Review",
    color: "blue",
    badgeClass: "bg-blue-500/10 text-blue-400 border border-blue-500/30",
    dotClass: "bg-blue-400 animate-pulse",
  },
  info_requested: {
    labelKo: "정보 요청",
    labelEn: "Info Requested",
    color: "amber",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  needs_followup: {
    labelKo: "후속 조치 필요",
    labelEn: "Needs Follow-up",
    color: "rose",
    badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
    dotClass: "bg-rose-400",
  },
  completed: {
    labelKo: "내부 검토 완료",
    labelEn: "Review Completed",
    color: "emerald",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
};
