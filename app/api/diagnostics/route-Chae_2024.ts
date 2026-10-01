import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    deployment: {
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local",
      commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE || "",
      branch: process.env.VERCEL_GIT_COMMIT_REF || "main",
      environment: process.env.VERCEL_ENV || "development",
      deploymentUrl: process.env.VERCEL_URL || "",
    },
    env: {
      NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL || "Not Configured",
      hasSupabaseSecretKey: !!serverEnv.SUPABASE_SECRET_KEY,
      hasResendApiKey: !!serverEnv.RESEND_API_KEY,
      emailFromAddress: serverEnv.EMAIL_FROM_ADDRESS || "Not Configured",
    }
  });
}
