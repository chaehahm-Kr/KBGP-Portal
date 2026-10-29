"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession, getAdminStaffContext } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NormalizedCompanyDraft,
  DuplicateCheckCriteria,
  DuplicateMatchResult,
  SourcingEvaluationInput,
  SourcingListParams,
  SourcingDocumentItem,
  AdminDuplicateExceptionInput,
  LinkSourceResult,
  DuplicateAuditReport,
  extractSourcingDraft,
  findDuplicateCandidates,
  saveSourcingDraft,
  linkSourcingSource,
  getSourcingDuplicateAuditReport,
  getSourcingCompanyById,
  listSourcingCompanies,
  updateSourcingCandidateComplete,
  updateSourcingEvaluation,
  deleteSourcingCandidate,
  archiveSourcingCandidate,
  bulkArchiveSourcingCompanies,
  restoreSourcingCandidate,
  bulkRestoreSourcingCompanies,
  getClient,
} from "./index";
import { validateSafeExternalUrl } from "./security";

/**
 * Asserts that the calling staff member has permission to access Brand Marketing.
 * Super Admin or staff with applications/products view/create/edit permissions are authorized.
 */
export async function requireBrandStaffPermission(action: "view" | "create" | "edit" | "delete" = "view") {
  await verifyAdminSession();
  const staff = await getAdminStaffContext();

  if (staff.isSuperAdmin) {
    return staff;
  }

  const canAccess =
    staff.hasPermission("applications", action) ||
    staff.hasPermission("products", action);

  if (!canAccess) {
    throw new Error("[SECURITY] Unauthorized: Brand Marketing access requires Brand staff or Super Admin permission.");
  }

  return staff;
}

/**
 * Extracts and normalizes company info from an exhibitor detail URL (e.g. InterCHARM).
 * Also runs multi-vector duplicate detection against existing candidates & partner companies.
 */
export async function extractSourcingDraftAction(
  url: string,
  options?: { enrichWithOfficialWebsite?: boolean }
): Promise<{
  success: boolean;
  draft?: NormalizedCompanyDraft;
  duplicateCheck?: DuplicateMatchResult;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");

    // 1. SSRF and syntax validation
    validateSafeExternalUrl(url);

    // 2. Server-side extraction
    const enrichWebsite = options?.enrichWithOfficialWebsite !== false;
    const draft = await extractSourcingDraft(url, { enrichWebsite });

    // 3. Pre-check for duplicate candidate records
    const primaryEmails = draft.contacts.map((c) => c.email).filter(Boolean);
    const draftBrands = (draft.brands || []).map((b) => ({ nameKr: b.nameKr, nameEn: b.nameEn }));

    const duplicateCheck = await findDuplicateCandidates({
      sourceUrl: url,
      sourceIdentifier: draft.source.sourceIdentifier,
      companyNameKr: draft.company.nameKr,
      companyNameEn: draft.company.nameEn || undefined,
      brands: draftBrands,
      emails: primaryEmails,
    });

    return {
      success: true,
      draft,
      duplicateCheck,
    };
  } catch (err: any) {
    console.error("[extractSourcingDraftAction] Extraction failed:", err);
    return {
      success: false,
      error: err.message || "Failed to extract sourcing draft from URL",
    };
  }
}

/**
 * Runs duplicate candidate detection based on criteria.
 */
export async function checkDuplicatesAction(
  criteria: DuplicateCheckCriteria
): Promise<{
  success: boolean;
  duplicateCheck?: DuplicateMatchResult;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");
    const duplicateCheck = await findDuplicateCandidates(criteria);
    return { success: true, duplicateCheck };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to check duplicates" };
  }
}

/**
 * Persists a new sourcing candidate draft and evaluation into the dedicated sourcing tables.
 * Enforces atomic server-side duplicate protection and records admin exceptions.
 */
export async function saveSourcingCandidateAction(
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput,
  options?: {
    allowDuplicateConfirmed?: boolean;
    matchedCompanyIds?: string[];
    matchedFields?: string[];
    exception?: AdminDuplicateExceptionInput;
  }
): Promise<{
  success: boolean;
  companyId?: string;
  error?: string;
  isDuplicate?: boolean;
}> {
  try {
    const staff = await requireBrandStaffPermission("create");

    if (!draft || !draft.company || !draft.company.nameKr?.trim()) {
      return { success: false, error: "Company Korean Name is required." };
    }

    const res = await saveSourcingDraft(draft, evaluation, {
      allowDuplicateConfirmed: options?.allowDuplicateConfirmed,
      matchedCompanyIds: options?.matchedCompanyIds,
      matchedFields: options?.matchedFields,
      exception: options?.exception,
      adminUserId: staff.session.userId || staff.staffId,
    });
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return {
      success: true,
      companyId: res.companyId,
    };
  } catch (err: any) {
    console.error("[saveSourcingCandidateAction] Save failed:", err);
    const msg = err.message || "Failed to save sourcing candidate";
    const isDup = msg.includes("[DUPLICATE_");
    return {
      success: false,
      error: msg,
      isDuplicate: isDup,
    };
  }
}

/**
 * Links new sourcing information to an existing company record without
 * overwriting verified fields or modifying marketing consent.
 */
export async function linkSourcingSourceAction(
  input: {
    targetCompanyId: string;
    draft: NormalizedCompanyDraft;
    overrideReason?: string;
  }
): Promise<{
  success: boolean;
  result?: LinkSourceResult;
  error?: string;
}> {
  try {
    const staff = await requireBrandStaffPermission("create");

    const result = await linkSourcingSource({
      ...input,
      adminUserId: staff.session.userId || staff.staffId,
      adminUserEmail: staff.email,
    });

    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true, result };
  } catch (err: any) {
    console.error("[linkSourcingSourceAction] Link failed:", err);
    return {
      success: false,
      error: err.message || "Failed to link source to existing company",
    };
  }
}

/**
 * Generates a comprehensive read-only audit report of duplicate records in Brand Sourcing.
 */
export async function getSourcingDuplicateAuditReportAction(): Promise<{
  success: boolean;
  report?: DuplicateAuditReport;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");
    const report = await getSourcingDuplicateAuditReport();
    return { success: true, report };
  } catch (err: any) {
    console.error("[getSourcingDuplicateAuditReportAction] Report failed:", err);
    return {
      success: false,
      error: err.message || "Failed to generate duplicate audit report",
    };
  }
}

/**
 * Fully updates an existing sourcing candidate and related entities.
 */
export async function updateSourcingCandidateAction(
  companyId: string,
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("edit");

    if (!companyId) {
      return { success: false, error: "Company ID is required" };
    }

    await updateSourcingCandidateComplete(companyId, draft, evaluation);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("[updateSourcingCandidateAction] Update failed:", err);
    return {
      success: false,
      error: err.message || "Failed to update sourcing candidate",
    };
  }
}

/**
 * Reversibly archives a sourcing candidate by ID (soft delete).
 * Preserves all related contacts, brands, activities, and audit history.
 */
export async function archiveSourcingCandidateAction(
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("delete");

    if (!companyId) {
      return { success: false, error: "Company ID is required" };
    }

    await archiveSourcingCandidate(companyId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("[archiveSourcingCandidateAction] Archive failed:", err);
    return {
      success: false,
      error: err.message || "Failed to archive sourcing candidate",
    };
  }
}

/**
 * Reversibly archives multiple sourcing candidates in bulk (soft delete).
 * Preserves all related contacts, brands, activities, and audit history.
 */
export async function bulkArchiveSourcingCandidatesAction(
  companyIds: string[]
): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("delete");

    if (!companyIds || companyIds.length === 0) {
      return { success: false, error: "No company IDs provided for deletion" };
    }

    const res = await bulkArchiveSourcingCompanies(companyIds);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true, count: res.count };
  } catch (err: any) {
    console.error("[bulkArchiveSourcingCandidatesAction] Bulk archive failed:", err);
    return {
      success: false,
      error: err.message || "Failed to archive selected sourcing candidates",
    };
  }
}

/**
 * Restores multiple archived sourcing companies by setting status back to 'SAVED'.
 */
export async function bulkRestoreSourcingCandidatesAction(
  companyIds: string[]
): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("edit");

    if (!companyIds || companyIds.length === 0) {
      return { success: false, error: "No company IDs provided for restore" };
    }

    const res = await bulkRestoreSourcingCompanies(companyIds);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true, count: res.count };
  } catch (err: any) {
    console.error("[bulkRestoreSourcingCandidatesAction] Bulk restore failed:", err);
    return {
      success: false,
      error: err.message || "Failed to restore selected sourcing candidates",
    };
  }
}

/**
 * Restores a single archived sourcing company by ID.
 */
export async function restoreSourcingCandidateAction(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireBrandStaffPermission("edit");

    if (!companyId) return { success: false, error: "Company ID is required" };
    await restoreSourcingCandidate(companyId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("[restoreSourcingCandidateAction] Restore failed:", err);
    return {
      success: false,
      error: err.message || "Failed to restore sourcing candidate",
    };
  }
}

/**
 * Deletes a sourcing candidate by ID (preserved for compatibility; archives if restricted).
 */
export async function deleteSourcingCandidateAction(
  companyId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("delete");

    if (!companyId) {
      return { success: false, error: "Company ID is required" };
    }

    // Attempt archiving first to preserve business records and protect audit history
    await archiveSourcingCandidate(companyId);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return { success: true };
  } catch (err: any) {
    console.error("[deleteSourcingCandidateAction] Delete failed:", err);
    return {
      success: false,
      error: err.message || "Failed to delete sourcing candidate",
    };
  }
}

/**
 * Lists sourcing candidate companies with pagination and filters.
 */
export async function listSourcingCandidatesAction(
  params?: SourcingListParams
): Promise<{
  success: boolean;
  candidates?: any[];
  total?: number;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");
    const { data, total } = await listSourcingCompanies(params);
    return { success: true, candidates: data || [], total };
  } catch (err: any) {
    console.error("[listSourcingCandidatesAction] Query failed:", err);
    return {
      success: false,
      error: err.message || "Failed to list sourcing candidates",
    };
  }
}

/**
 * Retrieves full details for a single sourcing candidate.
 */
export async function getSourcingCandidateDetailAction(
  companyId: string
): Promise<{
  success: boolean;
  candidate?: any;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");
    const candidate = await getSourcingCompanyById(companyId);
    return { success: true, candidate };
  } catch (err: any) {
    console.error("[getSourcingCandidateDetailAction] Fetch failed:", err);
    return {
      success: false,
      error: err.message || "Failed to fetch candidate details",
    };
  }
}

/**
 * Updates evaluation fields only (grade, status, assignedTo, internalNotes).
 */
export async function updateSourcingEvaluationAction(
  companyId: string,
  evaluation: SourcingEvaluationInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("edit");
    await updateSourcingEvaluation(companyId, evaluation);
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update evaluation",
    };
  }
}

/**
 * Fetches active staff members for assignment dropdown.
 */
export async function getActiveStaffMembersAction(): Promise<{
  success: boolean;
  staff?: Array<{ id: string; name: string; email: string }>;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("view");
    const client = getClient();
    const { data, error } = await client
      .from("staff_members")
      .select("id, name, email")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return {
      success: true,
      staff: data || [],
    };
  } catch (err: any) {
    console.error("[getActiveStaffMembersAction] Fetch failed:", err);
    return {
      success: false,
      error: err.message || "Failed to fetch active staff members",
    };
  }
}

/**
 * Updates a candidate's evaluation grade inline (A, B, C, UNRATED).
 */
export async function updateSourcingCandidateGradeAction(
  companyId: string,
  grade: "A" | "B" | "C" | "UNRATED"
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireBrandStaffPermission("edit");
    const allowed = ["A", "B", "C", "UNRATED"];
    if (!allowed.includes(grade)) {
      return { success: false, error: `Invalid grade: ${grade}` };
    }
    await updateSourcingEvaluation(companyId, { grade });
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true };
  } catch (err: any) {
    console.error("[updateSourcingCandidateGradeAction] Failed:", err);
    return { success: false, error: err.message || "Failed to update grade" };
  }
}

/**
 * Updates candidate company documents (attachments, brochures, catalogs).
 */
export async function updateSourcingCandidateDocumentsAction(
  companyId: string,
  documents: SourcingDocumentItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireBrandStaffPermission("edit");
    await updateSourcingEvaluation(companyId, { documents });
    try { revalidatePath("/admin/brand-marketing"); } catch {}
    return { success: true };
  } catch (err: any) {
    console.error("[updateSourcingCandidateDocumentsAction] Failed:", err);
    return { success: false, error: err.message || "Failed to update documents" };
  }
}
