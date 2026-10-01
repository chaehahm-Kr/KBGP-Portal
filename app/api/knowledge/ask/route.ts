import { NextRequest, NextResponse } from "next/server";
import { processAskQuestion } from "@/lib/knowledge/ask-engine";
import { SecurityUserContext, UserRole, AudienceType } from "@/lib/knowledge/types";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, currentRoute, selectedModule, audience: requestedAudience } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Question string is required" }, { status: 400 });
    }

    // Server-Side Authentication & Authorization Context Resolution
    let userId = "anon-user";
    let userRole: UserRole = "anonymous";
    let isAuthenticated = false;

    try {
      const allCookies = request.cookies.getAll();
      const mappedCookies = allCookies.map(c => {
        if (c.name.startsWith("admin-sb-")) return { name: c.name.replace("admin-sb-", "sb-"), value: c.value };
        if (c.name.startsWith("portal-sb-")) return { name: c.name.replace("portal-sb-", "sb-"), value: c.value };
        return c;
      });

      const supabase = createServerClient(
        publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          cookies: {
            getAll: () => mappedCookies,
            setAll: () => {}
          }
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        isAuthenticated = true;
        userId = user.id;

        // Query Trusted Server DB Profile Role (never trust client metadata alone)
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role) {
          userRole = profile.role as UserRole;
        } else {
          userRole = (user.app_metadata?.role || user.user_metadata?.role || "brand") as UserRole;
        }
      }
    } catch (e) {
      // Fallback unauthenticated
    }

    // Role Spoofing Defense:
    // If client sends custom header x-user-role, only allow non-escalated simulation OR require actual admin session.
    const clientHeaderRole = request.headers.get("x-user-role");
    const clientHeaderId = request.headers.get("x-user-id");

    if (clientHeaderRole) {
      if (!isAuthenticated && (clientHeaderRole === "admin" || clientHeaderRole === "brand" || clientHeaderRole === "retailer")) {
        // Block privilege escalation for unauthenticated clients sending spoofed headers
        userRole = "anonymous";
      } else if (isAuthenticated) {
        // Only allow testing role simulation if session is authenticated admin
        if (userRole === "admin") {
          userRole = clientHeaderRole as UserRole;
          if (clientHeaderId) userId = clientHeaderId;
        }
      }
    }

    // Allow explicit test header in local dev/QA testing scripts if present
    if (process.env.NODE_ENV === "development" && clientHeaderRole) {
      userRole = clientHeaderRole as UserRole;
      if (clientHeaderId) userId = clientHeaderId;
    }

    const userContext: SecurityUserContext = {
      userId,
      role: userRole
    };

    // Process Natural Language Question with Audience-Grounded Engine
    const answer = await processAskQuestion({
      question,
      audience: requestedAudience as AudienceType,
      userContext,
      currentRoute: currentRoute || "/portal/help",
      selectedModule
    });

    return NextResponse.json(answer);
  } catch (error: any) {
    console.error("POST /api/knowledge/ask error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Knowledge Assistant Engine Error" },
      { status: 500 }
    );
  }
}
