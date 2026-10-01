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

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY!;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = "ea6e03fa-bc38-4612-aeeb-b2faee3e5d20";
  const userEmail = "tammyhahm77@gmail.com";

  console.log("=== Checking current state for user ===");
  const { data: cuBefore } = await adminClient.from("company_users").select("*").eq("id", userId).single();
  console.log("company_users before:", cuBefore);

  console.log("=== Simulating updateMyAccountProfileAction ===");
  const payload = {
    name: "박은애",
    phone: "+82 10-1234-1234",
    title: "이사",
    position: "영업팀",
  };

  // 1. Update company_users
  const { data: updatedUser, error: updateError } = await adminClient
    .from("company_users")
    .update({
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      title: payload.title.trim(),
      position: payload.position?.trim() || null,
    })
    .eq("id", userId)
    .select("company_id")
    .single();

  console.log("company_users update result:", { updatedUser, updateError });

  // 2. Update profiles
  const { error: profError } = await adminClient
    .from("profiles")
    .update({ display_name: payload.name.trim() })
    .eq("id", userId);
  console.log("profiles update result:", profError);

  // 3. Mark admin_profile_onboarding_confirmed_at on company metadata AND sync contacts
  if (updatedUser?.company_id) {
    const { data: comp } = await adminClient
      .from("companies")
      .select("intro")
      .eq("id", updatedUser.company_id)
      .single();

    let metaObj: Record<string, any> = {};
    if (comp?.intro && comp.intro.startsWith("__COMPANY_METADATA__:")) {
      try {
        metaObj = JSON.parse(comp.intro.substring("__COMPANY_METADATA__:".length));
      } catch {}
    }
    metaObj.admin_profile_onboarding_confirmed_at = new Date().toISOString();

    // Sync contacts in metaObj
    if (Array.isArray(metaObj.contacts)) {
      const idx = metaObj.contacts.findIndex((c: any) => c.id === userId || c.email === userEmail);
      if (idx !== -1) {
        metaObj.contacts[idx].name = payload.name.trim();
        metaObj.contacts[idx].phone = payload.phone.trim();
        metaObj.contacts[idx].title = payload.title.trim();
        metaObj.contacts[idx].position = payload.position?.trim() || "";
      } else {
        metaObj.contacts.push({
          id: userId,
          name: payload.name.trim(),
          phone: payload.phone.trim(),
          email: userEmail,
          title: payload.title.trim(),
          position: payload.position?.trim() || "",
          isPrimary: true,
          status: "active",
        });
      }
    }

    const { error: compError } = await adminClient
      .from("companies")
      .update({
        intro: `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`,
        contact_name: payload.name.trim(),
        contact_phone: payload.phone.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedUser.company_id);

    console.log("companies update result:", compError);
  }

  // Read back
  const { data: cuAfter } = await adminClient.from("company_users").select("*").eq("id", userId).single();
  console.log("company_users after read back:", {
    name: cuAfter?.name,
    title: cuAfter?.title,
    position: cuAfter?.position,
    phone: cuAfter?.phone,
  });

  const { data: compAfter } = await adminClient.from("companies").select("intro, contact_name, contact_phone").eq("id", cuBefore.company_id).single();
  console.log("companies after read back:", compAfter);
}

run().catch(console.error);
