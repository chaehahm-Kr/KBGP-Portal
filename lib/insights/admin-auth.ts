import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminApiAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

export async function requireAdminApiSession(): Promise<AdminApiAuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Unauthorized: Admin login required." },
          { status: 401 }
        ),
      };
    }

    const adminDb = createAdminClient();
    const { data: profile } = await adminDb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Admin role required." },
          { status: 403 }
        ),
      };
    }

    const { data: staff } = await adminDb
      .from("staff_members")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (!staff || !["active", "invited", "setting_up"].includes(staff.status)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: Active staff account required." },
          { status: 403 }
        ),
      };
    }

    return {
      ok: true,
      userId: user.id,
      email: user.email || "admin@kselectnetwork.com",
    };
  } catch (err: any) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: err?.message || "Authentication check failed." },
        { status: 500 }
      ),
    };
  }
}
