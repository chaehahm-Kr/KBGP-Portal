import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: publicEnv.NEXT_PUBLIC_SUPABASE_URL || "Not Configured",
      hasSupabaseSecretKey: !!serverEnv.SUPABASE_SECRET_KEY,
      hasResendApiKey: !!serverEnv.RESEND_API_KEY,
      emailFromAddress: serverEnv.EMAIL_FROM_ADDRESS || "Not Configured",
    }
  });
}
