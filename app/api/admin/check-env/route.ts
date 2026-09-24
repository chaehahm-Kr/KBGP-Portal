import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const envKeys = Object.keys(process.env);
  const dbKeys = envKeys.filter((k) =>
    k.includes("DB") || k.includes("POSTGRES") || k.includes("DATABASE") || k.includes("SUPABASE") || k.includes("PASS") || k.includes("SECRET")
  );

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    dbKeys,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasSupabaseDbPass: !!process.env.SUPABASE_DB_PASSWORD || !!process.env.POSTGRES_PASSWORD,
  });
}
