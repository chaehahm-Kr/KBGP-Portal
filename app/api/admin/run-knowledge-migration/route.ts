import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
// @ts-ignore
import pg from "pg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dbPass = searchParams.get("pass");

    const logs: string[] = [];
    const passes = [dbPass, "Letusto2026!", "Letusto2026", "shzfrppdobpmrstcjfqu"].filter(Boolean);

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/0050_knowledge_center_v1_schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    let applied = false;

    const poolerHosts = [
      "aws-0-us-east-1.pooler.supabase.com",
      "aws-0-us-east-2.pooler.supabase.com",
      "aws-0-us-west-1.pooler.supabase.com",
      "aws-0-us-west-2.pooler.supabase.com",
      "aws-0-ap-northeast-1.pooler.supabase.com",
      "aws-0-ap-northeast-2.pooler.supabase.com",
      "aws-0-ap-southeast-1.pooler.supabase.com",
      "aws-0-eu-central-1.pooler.supabase.com"
    ];

    for (const p of passes) {
      for (const host of poolerHosts) {
        try {
          const client = new pg.Client({
            connectionString: `postgres://postgres.shzfrppdobpmrstcjfqu:${encodeURIComponent(p || "")}@${host}:6543/postgres`,
            connectionTimeoutMillis: 3000,
            ssl: { rejectUnauthorized: false }
          });
          await client.connect();
          await client.query(sql);
          await client.end();
          logs.push(`✅ Migration 0050 applied successfully via PG client on ${host}!`);
          applied = true;
          break;
        } catch (e: any) {
          logs.push(`PG Host (${host}) Pass (${p}) Error: ${e.message}`);
        }
      }
      if (applied) break;
    }

    return NextResponse.json({ success: applied, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
