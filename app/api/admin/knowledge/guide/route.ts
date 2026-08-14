import { NextRequest, NextResponse } from "next/server";
import { processGuideQuestion } from "@/lib/knowledge/guide/engine";
import { SecurityUserContext, UserRole } from "@/lib/knowledge/types";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env/public";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, currentRoute } = body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Question string is required" }, { status: 400 });
    }

    // Server-Side Authentication & Authorization Context Resolution
    let userId = "anon-user";
    let userRole: UserRole = "anonymous";
    let isAuthenticated = false;

    try {
      const supabase = createServerClient(
        publicEnv.NEXT_PUBLIC_SUPABASE_URL,
        publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: () => {}
          }
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        isAuthenticated = true;
        userId = user.id;
        // Server-resolved role from Supabase metadata
        userRole = (user.user_metadata?.role || user.app_metadata?.role || "admin") as UserRole;
      }
    } catch (e) {
      // Fallback unauthenticated
    }

    // Role Spoofing Defense:
    // If client sends custom header x-user-role, only allow non-escalated simulation OR require actual admin session.
    // In production, unauthenticated client sending x-user-role: admin CANNOT escalate privileges.
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

    // Default to admin for legitimate logged-in admin users visiting /admin routes
    if (!isAuthenticated && request.nextUrl.pathname.startsWith("/api/admin")) {
      // In local dev/test fallback, check if running in server context
      const isLocalDev = process.env.NODE_ENV === "development";
      if (isLocalDev && clientHeaderRole) {
        // Allow explicit test header only if role is passed explicitly in test script
        userRole = clientHeaderRole as UserRole;
        if (clientHeaderId) userId = clientHeaderId;
      }
    }

    const userContext: SecurityUserContext = {
      userId,
      role: userRole
    };

    // Process Natural Language Question with Deny-Before-Generation Security
    const answer = await processGuideQuestion(question, userContext, currentRoute || "/admin");

    return NextResponse.json(answer);
  } catch (error: any) {
    console.error("POST /api/admin/knowledge/guide error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Guide Engine Error" },
      { status: 500 }
    );
  }
}
