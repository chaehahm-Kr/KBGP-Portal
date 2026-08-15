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

    if (!dbPass) {
      return NextResponse.json(
        { success: false, error: "Database password is required as ?pass=..." },
        { status: 400 }
      );
    }

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/0056_product_supplier_relationship.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const logs: string[] = [];
    
    // We try direct database connection hostname first, then pooler hosts
    const targets = [
      { host: "db.shzfrppdobpmrstcjfqu.supabase.co", port: 5432, user: "postgres" },
      { host: "aws-0-ap-northeast-2.pooler.supabase.com", port: 6543, user: "postgres.shzfrppdobpmrstcjfqu" },
      { host: "aws-0-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres.shzfrppdobpmrstcjfqu" }
    ];

    let applied = false;
    let client;

    for (const target of targets) {
      try {
        const connStr = `postgres://${target.user}:${encodeURIComponent(dbPass)}@${target.host}:${target.port}/postgres`;
        logs.push(`Trying: ${target.host}:${target.port} as ${target.user}...`);
        
        client = new pg.Client({
          connectionString: connStr,
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false }
        });
        
        await client.connect();
        logs.push(`✅ Connected to database at ${target.host}!`);
        
        await client.query(sql);
        logs.push("✅ Migration SQL 0056 executed successfully!");

        await client.end();
        applied = true;
        break;
      } catch (e: any) {
        logs.push(`Error on ${target.host}: ${e.message}`);
        if (client) {
          try { await client.end(); } catch {}
        }
      }
    }

    return NextResponse.json({ success: applied, logs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, stack: err.stack },
      { status: 500 }
    );
  }
}
