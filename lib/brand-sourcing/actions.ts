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
  extractSourcingDraft,
  findDuplicateCandidates,
  saveSourcingDraft,
  getSourcingCompanyById,
  listSourcingCompanies,
  updateSourcingCandidateComplete,
  updateSourcingEvaluation,
  deleteSourcingCandidate,
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
    const primaryWebsite = draft.websites[0]?.url;
    const primaryEmails = draft.contacts.map((c) => c.email).filter(Boolean);

    const duplicateCheck = await findDuplicateCandidates({
      sourceIdentifier: draft.source.sourceIdentifier,
      companyNameKr: draft.company.nameKr,
      companyNameEn: draft.company.nameEn || undefined,
      websiteUrl: primaryWebsite,
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
 */
export async function saveSourcingCandidateAction(
  draft: NormalizedCompanyDraft,
  evaluation?: SourcingEvaluationInput
): Promise<{
  success: boolean;
  companyId?: string;
  error?: string;
}> {
  try {
    await requireBrandStaffPermission("create");

    if (!draft || !draft.company || !draft.company.nameKr?.trim()) {
      return { success: false, error: "Company Korean Name is required." };
    }

    const res = await saveSourcingDraft(draft, evaluation);
    try { revalidatePath("/admin/brand-marketing"); } catch {}

    return {
      success: true,
      companyId: res.companyId,
    };
  } catch (err: any) {
    console.error("[saveSourcingCandidateAction] Save failed:", err);
    return {
      success: false,
      error: err.message || "Failed to save sourcing candidate",
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
 * Deletes a sourcing candidate by ID.
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

    await deleteSourcingCandidate(companyId);
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
