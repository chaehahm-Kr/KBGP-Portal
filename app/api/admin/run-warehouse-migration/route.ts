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

    const sqlPath = path.resolve(process.cwd(), "supabase/migrations/0051_warehouses.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    const logs: string[] = [];
    
    // We try direct database connection hostname first, then pooler hosts
    const targets = [
      { host: "db.shzfrppdobpmrstcjfqu.supabase.co", port: 5432, user: "postgres" },
      { host: "aws-0-ap-northeast-2.pooler.supabase.com", port: 6543, user: "postgres.shzfrppdobpmrstcjfqu" },
      { host: "aws-0-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres.shzfrppdobpmrstcjfqu" },
      { host: "aws-0-us-east-1.pooler.supabase.com", port: 6543, user: "postgres.shzfrppdobpmrstcjfqu" },
      { host: "aws-0-us-east-2.pooler.supabase.com", port: 6543, user: "postgres.shzfrppdobpmrstcjfqu" },
      { host: "aws-0-eu-central-1.pooler.supabase.com", port: 6543, user: "postgres.shzfrppdobpmrstcjfqu" }
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
        logs.push("✅ Migration SQL 0051 executed successfully!");

        // Find Letusto Inc. company record
        const companyRes = await client.query(
          "SELECT id FROM public.companies WHERE name = 'Letusto Inc.' ORDER BY created_at ASC LIMIT 1;"
        );

        if (companyRes.rows.length > 0) {
          const companyId = companyRes.rows[0].id;
          logs.push(`Found Letusto Inc. Company ID: ${companyId}`);

          // Check if default warehouse exists
          const wCheck = await client.query("SELECT id FROM public.warehouses WHERE code = 'NJ1';");
          if (wCheck.rows.length === 0) {
            await client.query(`
              INSERT INTO public.warehouses (
                name, code, company_id, type, status, is_default_receiving,
                address1, city, state, zip_code, country, internal_note
              ) VALUES (
                'NJ Main Warehouse', 'NJ1', $1, 'own', 'active', true,
                '23B Roland Avenue', 'Mount Laurel', 'NJ', '08054', 'United States',
                'Letusto 기본 입고 물류창고 (NJ Main Warehouse)'
              );
            `, [companyId]);
            logs.push("NJ Main Warehouse (NJ1) seeded successfully!");
          } else {
            logs.push("NJ Main Warehouse (NJ1) already exists.");
          }
        } else {
          logs.push("Could not find Letusto Inc. company in the database.");
        }

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
