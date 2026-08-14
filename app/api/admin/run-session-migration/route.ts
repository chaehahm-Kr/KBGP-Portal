import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dbPass = searchParams.get("pass");

  const supabase = createAdminClient();
  const logs: string[] = [];

  if (dbPass) {
    try {
      const pg = require("pg");
      const client = new pg.Client({
        user: "postgres.shzfrppdobpmrstcjfqu",
        password: dbPass,
        host: "aws-0-ap-northeast-2.pooler.supabase.com",
        port: 6543,
        database: "postgres",
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      await client.query(`
        ALTER TABLE public.simulation_results
          ADD COLUMN IF NOT EXISTS simulation_code TEXT,
          ADD COLUMN IF NOT EXISTS base_simulation_id UUID REFERENCES public.simulation_results(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS revision_no INT DEFAULT 0,
          ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;

        CREATE INDEX IF NOT EXISTS idx_simulation_results_code ON public.simulation_results (simulation_code);
        CREATE INDEX IF NOT EXISTS idx_simulation_results_base_id ON public.simulation_results (base_simulation_id);
        CREATE INDEX IF NOT EXISTS idx_simulation_results_latest ON public.simulation_results (is_latest) WHERE is_latest = TRUE;
      `);
      await client.end();
      logs.push("✅ DDL ALTER TABLE Executed successfully via PG Client!");
    } catch (e: any) {
      logs.push(`PG Error: ${e.message}`);
    }
  }

  // Backfill existing rows
  try {
    const { data: rows, error: fetchErr } = await supabase
      .from("simulation_results")
      .select("id, created_at, simulation_code, base_simulation_id, revision_no, is_latest");

    if (fetchErr) {
      return NextResponse.json({ success: false, error: fetchErr.message, logs });
    }

    let updated = 0;
    for (const r of rows || []) {
      const updates: Record<string, any> = {};
      if (!r.base_simulation_id) updates.base_simulation_id = r.id;
      if (r.revision_no === null || r.revision_no === undefined) updates.revision_no = 0;
      if (r.is_latest === null || r.is_latest === undefined) updates.is_latest = true;

      if (!r.simulation_code) {
        const dt = new Date(r.created_at);
        const yy = String(dt.getUTCFullYear()).slice(2);
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(dt.getUTCDate()).padStart(2, '0');
        const hh = String(dt.getUTCHours()).padStart(2, '0');
        const min = String(dt.getUTCMinutes()).padStart(2, '0');
        const ss = String(dt.getUTCSeconds()).padStart(2, '0');
        const suffix = String(r.id).replace(/-/g, '').slice(0, 4).toUpperCase();
        updates.simulation_code = `GS-${yy}${mm}${dd}-${hh}${min}${ss}-${suffix}`;
      }

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await supabase
          .from("simulation_results")
          .update(updates)
          .eq("id", r.id);
        if (!upErr) updated++;
        else logs.push(`Backfill error for ${r.id}: ${upErr.message}`);
      }
    }

    logs.push(`Backfilled ${updated} / ${rows?.length} records.`);
    return NextResponse.json({ success: true, updated, total: rows?.length, logs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, logs });
  }
}
