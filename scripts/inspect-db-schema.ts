import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function getEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return process.env;
  const content = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return { ...process.env, ...env };
}

async function main() {
  const env = getEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey!);

  // Check company_users columns
  const { data, error } = await supabase.rpc("exec_sql", { sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'company_users';" });
  if (error) {
    console.log("RPC exec_sql not available, checking via direct table query...");
  } else {
    console.log("company_users columns:", data);
  }
}

main().catch(console.error);
