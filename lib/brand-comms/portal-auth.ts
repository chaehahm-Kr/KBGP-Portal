import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonationSession } from "@/lib/auth/impersonation";

export type PortalApiCompanyContextResult =
  | {
      ok: true;
      userId: string;
      companyId: string;
      companyName: string;
      companyRole: string;
      isImpersonating: boolean;
    }
  | { ok: false; response: NextResponse };

/**
 * Strict server-side tenant authorization for Brand Portal API routes.
 * - Never trusts browser-supplied company_id.
 * - Verifies authenticated session (or verified Admin BRAND impersonation).
 * - Verifies profiles.role === 'portal', company_users.status === 'active',
 *   and companies.status === 'active'.
 */
export async function requirePortalApiCompanyContext(): Promise<PortalApiCompanyContextResult> {
  try {
    const adminDb = createAdminClient();
    const impSession = await getImpersonationSession();

    let effectiveUserId: string | null = null;
    let isImpersonating = false;

    if (impSession && impSession.portalType === "BRAND") {
      effectiveUserId = impSession.targetUserId;
      isImpersonating = true;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Unauthorized: Brand Portal login required." },
            { status: 401 }
          ),
        };
      }

      const { data: profile } = await adminDb
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "portal") {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Forbidden: Brand Portal role required." },
            { status: 403 }
          ),
        };
      }

      effectiveUserId = user.id;
    }

    const { data: membership } = await adminDb
      .from("company_users")
      .select("company_id, company_role, status")
      .eq("id", effectiveUserId)
      .maybeSingle();

    if (!membership || membership.status !== "active" || !membership.company_id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Active company membership required." },
          { status: 403 }
        ),
      };
    }

    const { data: company } = await adminDb
      .from("companies")
      .select("id, name, status")
      .eq("id", membership.company_id)
      .maybeSingle();

    if (!company || company.status !== "active") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Company account is not active." },
          { status: 403 }
        ),
      };
    }

    return {
      ok: true,
      userId: effectiveUserId,
      companyId: company.id,
      companyName: company.name || "Partner Company",
      companyRole: membership.company_role || "company_staff",
      isImpersonating,
    };
  } catch (err: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: err?.message || "Portal authorization check failed." },
        { status: 500 }
      ),
    };
  }
}

/**
 * Pure server-side audience check helper for announcements & resources.
 */
export function isCompanyAuthorizedForAudience(params: {
  status: string;
  audienceMode: string;
  targetCompanyIds: string[];
  companyId: string;
}): boolean {
  if (params.status !== "PUBLISHED") return false;
  if (params.audienceMode === "ALL_COMPANIES") return true;
  if (params.audienceMode === "SELECTED_COMPANIES") {
    return params.targetCompanyIds.includes(params.companyId);
  }
  return false;
}
