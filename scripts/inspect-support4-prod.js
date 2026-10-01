const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envContent = fs.readFileSync(".env.local", "utf8");
const envVars = {};
envContent.split("\n").forEach((line) => {
  const [key, ...vals] = line.split("=");
  if (key && vals.length > 0) {
    envVars[key.trim()] = vals.join("=").trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const secretKey = envVars.SUPABASE_SECRET_KEY;

const admin = createClient(supabaseUrl, secretKey);

async function main() {
  const userId = "f18765a1-5395-4615-9aa1-f3378e667c0e";
  console.log("=== CHECKING PROFILES TABLE FOR support4@letusto.com ===");
  const { data: profile, error } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Profiles query error:", error);
  } else {
    console.log("Profile Record:", profile);
  }
}

main().catch(console.error);
