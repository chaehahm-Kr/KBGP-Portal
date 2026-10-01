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
  
  if (!supabaseKey) {
    console.error("SUPABASE_SECRET_KEY is missing");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("company_users")
    .select("id, name, email, company_role, permissions, company_id")
    .limit(10);

  if (error) {
    console.error("Error querying company_users:", error);
  } else {
    console.log("Sample company_users permissions:", JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
