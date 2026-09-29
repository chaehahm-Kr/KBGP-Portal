import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envFiles = [".env.local", ".env.production.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY!;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const companyId = "7d669d13-1c62-494e-a520-c2133348edbe";
  const userEmail = "tammyhahm77@gmail.com";

  console.log("=== STEP 1: Profile Persistence Verification ===");
  const testPayload = {
    name: "박은애",
    title: "이사",
    position: "영업팀",
    phone: "+82 10-1111-2222",
  };

  // 1. Update company_users
  const { data: updatedUser, error: uErr } = await admin
    .from("company_users")
    .update({
      name: testPayload.name,
      title: testPayload.title,
      position: testPayload.position,
      phone: testPayload.phone,
    })
    .eq("email", userEmail)
    .select("id, company_id, name, title, position, phone")
    .single();

  if (uErr) {
    console.error("Update error:", uErr);
    process.exit(1);
  }

  // 2. Read back from DB
  const { data: readBackUser, error: rErr } = await admin
    .from("company_users")
    .select("id, company_id, name, title, position, phone")
    .eq("id", updatedUser.id)
    .single();

  if (rErr) {
    console.error("Read back error:", rErr);
    process.exit(1);
  }

  console.log("Read-back verification:", {
    nameMatch: readBackUser.name === testPayload.name,
    titleMatch: readBackUser.title === testPayload.title,
    positionMatch: readBackUser.position === testPayload.position,
    phoneMatch: readBackUser.phone === testPayload.phone,
  });

  if (
    readBackUser.name !== testPayload.name ||
    readBackUser.title !== testPayload.title ||
    readBackUser.position !== testPayload.position ||
    readBackUser.phone !== testPayload.phone
  ) {
    console.error("FAILED: Read-back mismatch!");
    process.exit(1);
  }
  console.log("PASS: Authoritative Profile Persistence Verified!");

  console.log("\n=== STEP 2: Batch Task Assignment Verification ===");
  const tasks = [
    "application",
    "contract",
    "product",
    "pricing",
    "logistics",
    "settlement",
  ];

  for (const taskCode of tasks) {
    await admin.from("company_task_assignments").upsert(
      {
        company_id: companyId,
        user_id: updatedUser.id,
        task_code: taskCode,
        is_primary: true,
        email_notify: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id,user_id,task_code" }
    );
  }

  const { data: assignments, error: aErr } = await admin
    .from("company_task_assignments")
    .select("task_code, is_primary, email_notify")
    .eq("company_id", companyId)
    .eq("is_primary", true);

  if (aErr) {
    console.error("Tasks read error:", aErr);
    process.exit(1);
  }

  console.log("Active primary assignments count:", assignments?.length);
  if (assignments?.length === 6) {
    console.log("PASS: All 6 operational roles assigned successfully in batch!");
  } else {
    console.error("FAILED: Expected 6 assigned tasks, got", assignments?.length);
    process.exit(1);
  }

  console.log("\n=== ALL QA VERIFICATIONS PASSED ===");
}

main().catch(console.error);
