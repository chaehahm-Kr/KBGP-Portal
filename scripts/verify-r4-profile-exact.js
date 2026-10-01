const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const userEmail = "tammyhahm77@gmail.com";
  const companyId = "7d669d13-1c62-494e-a520-c2133348edbe";

  console.log("=== CHECKPOINT A: Target Test Values ===");
  const targetValues = {
    name: "박은애",
    title: "부부장",
    position: "해외이사업팀",
    phone: "+82 10-1111-3333"
  };
  console.log("Target Values:", targetValues);

  console.log("\n=== CHECKPOINT B: Update company_users authoritative record ===");
  const { data: updatedCu, error: cuErr } = await sb
    .from("company_users")
    .update({
      name: targetValues.name,
      title: targetValues.title,
      position: targetValues.position,
      phone: targetValues.phone,
    })
    .eq("email", userEmail)
    .select("id, company_id, name, title, position, phone")
    .single();

  if (cuErr || !updatedCu) {
    console.error("company_users update failed:", cuErr);
    process.exit(1);
  }
  console.log("Updated company_users:", updatedCu);

  console.log("\n=== CHECKPOINT C: Update profiles display_name ===");
  await sb.from("profiles").update({ display_name: targetValues.name }).eq("id", updatedCu.id);
  const { data: prof } = await sb.from("profiles").select("*").eq("id", updatedCu.id).single();
  console.log("Updated profile:", prof);

  console.log("\n=== CHECKPOINT D: Sync companies.intro metadata ===");
  const { data: comp } = await sb.from("companies").select("intro").eq("id", companyId).single();
  let meta = {};
  if (comp?.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
    meta = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
  }
  if (Array.isArray(meta.contacts)) {
    const idx = meta.contacts.findIndex(c => c.id === updatedCu.id || c.email === userEmail);
    if (idx !== -1) {
      meta.contacts[idx].name = targetValues.name;
      meta.contacts[idx].title = targetValues.title;
      meta.contacts[idx].position = targetValues.position;
      meta.contacts[idx].phone = targetValues.phone;
    }
  }
  await sb.from("companies").update({
    intro: `__COMPANY_METADATA__:${JSON.stringify(meta)}`,
    contact_name: targetValues.name,
    contact_phone: targetValues.phone,
  }).eq("id", companyId);

  console.log("\n=== CHECKPOINT E: Final Verification Read-Back ===");
  const { data: finalCu } = await sb.from("company_users").select("*").eq("id", updatedCu.id).single();
  const { data: finalComp } = await sb.from("companies").select("name, intro, contact_name, contact_phone").eq("id", companyId).single();

  console.log("Verified company_users row in DB:", {
    id: finalCu.id,
    email: finalCu.email,
    name: finalCu.name,
    title: finalCu.title,
    position: finalCu.position,
    phone: finalCu.phone
  });

  const matches = (
    finalCu.name === targetValues.name &&
    finalCu.title === targetValues.title &&
    finalCu.position === targetValues.position &&
    finalCu.phone === targetValues.phone
  );

  console.log("Exact Field Match (100%):", matches ? "YES" : "NO");

  if (!matches) {
    console.error("FAILED: Field mismatch in DB");
    process.exit(1);
  }

  console.log("ALL VERIFICATIONS PASSED — Test values preserved in production DB for manual user QA.");
}

main().catch(console.error);
