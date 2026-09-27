export type AgreementStatus =
  | "pending"
  | "active"
  | "re_signature_required"
  | "expired"
  | "terminated"
  | "superseded";

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, { ko: string; en: string }> = {
  pending: { ko: "계약 서명 필요", en: "Pending Signature" },
  active: { ko: "계약 완료", en: "Active" },
  re_signature_required: { ko: "재서명 필요", en: "Re-signature Required" },
  expired: { ko: "계약 만료", en: "Expired" },
  terminated: { ko: "계약 해지", en: "Terminated" },
  superseded: { ko: "구 버전 (대체됨)", en: "Superseded" },
};

export const AGREEMENT_STATUS_STYLES: Record<AgreementStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  active: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  re_signature_required: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  expired: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  terminated: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700",
  superseded: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
};

export type AgreementType = "BRAND_SUPPLIER" | "RETAILER";

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, { ko: string; en: string }> = {
  BRAND_SUPPLIER: { ko: "브랜드 공급사 (Brand)", en: "Brand Agreement" },
  RETAILER: { ko: "리테일러 (Retailer)", en: "Retailer Agreement" },
};

export interface AgreementTemplateItem {
  id: string;
  agreement_type?: AgreementType;
  name: string;
  version: string;
  status: "draft" | "active" | "inactive" | "archived";
  source_pdf_path: string;
  letusto_signer_name: string;
  letusto_signer_title: string;
  letusto_company_name: string;
  letusto_address: string;
  initial_term_years: number;
  renewal_term_years: number;
  non_renewal_notice_days: number;
  notes?: string | null;
  created_by?: string | null;
  activated_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CompanyAgreementItem {
  id: string;
  agreement_id: string;
  company_id: string;
  template_id: string;
  version: string;
  status: AgreementStatus;
  signer_user_id?: string | null;
  signer_name?: string | null;
  signer_title?: string | null;
  signer_email?: string | null;
  authority_confirmed?: boolean;
  authority_confirmed_at?: string | null;
  consent_to_agreement?: boolean;
  consent_to_e_signature?: boolean;
  signed_at?: string | null;
  effective_date?: string | null;
  expiration_date?: string | null;
  next_renewal_date?: string | null;
  non_renewal_notice_deadline?: string | null;
  final_pdf_path?: string | null;
  final_pdf_hash?: string | null;
  created_at: string;
  updated_at: string;
  companyName?: string;
  companyAddress?: string;
  representativeName?: string;
}

export interface AgreementAuditLogItem {
  id: string;
  company_agreement_id: string;
  agreement_id: string;
  action: string;
  performed_by_user_id?: string | null;
  performed_by_name?: string | null;
  performed_by_email?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

export type RecipientRoleType = "signer" | "additional_recipient";

export interface AgreementRecipientItem {
  id: string;
  company_agreement_id: string;
  agreement_id: string;
  company_id: string;
  recipient_name: string;
  recipient_title: string;
  recipient_email: string;
  recipient_type: RecipientRoleType;
  sent_at?: string | null;
  delivery_status: "pending" | "sent" | "failed";
  created_at: string;
}

export interface AdditionalRecipientInput {
  name: string;
  title: string;
  email: string;
}

