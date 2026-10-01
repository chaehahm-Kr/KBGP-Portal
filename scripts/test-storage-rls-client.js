const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  envText.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://shzfrppdobpmrstcjfqu.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoemZycHBdobpmrstcjfquIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExODAwMDAsImV4cCI6MjA1Njc1NjAwMH0.test";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

console.log("Anon key present:", !!supabaseAnonKey);
console.log("Secret key present:", !!supabaseSecretKey);

const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, supabaseSecretKey);

async function testStorageClients() {
  const pathStr = "agreements/4c845ae8-b93b-4db2-858f-bda3252e8167/KSN-AGR-2026-000001.pdf";

  console.log("--- 1. Testing createSignedUrl with ANON / CLIENT key ---");
  const { data: d1, error: e1 } = await anonClient.storage
    .from("company-uploads")
    .createSignedUrl(pathStr, 3600);
  console.log("Anon client result:", e1 ? `Error: ${e1.message} (${e1.name || e1.code})` : d1?.signedUrl);

  console.log("\n--- 2. Testing createSignedUrl with ADMIN / SERVICE key ---");
  const { data: d2, error: e2 } = await adminClient.storage
    .from("company-uploads")
    .createSignedUrl(pathStr, 3600);
  console.log("Admin client result:", e2 ? `Error: ${e2.message}` : d2?.signedUrl);
}

testStorageClients().catch(console.error);
