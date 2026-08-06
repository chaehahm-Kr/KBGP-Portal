const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let supabaseUrl = '';
let supabaseServiceKey = '';

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'SUPABASE_SECRET_KEY') supabaseServiceKey = val;
    }
  });
}

async function run() {
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // 1. 이미 존재하는 BT_FACE_MIST 에 대해 카테고리 저장
  const payload = {
    code: "BT_FACE_MIST",
    name_ko: "미스트",
    name_en: "Mist",
    depth: 3,
    parent_code: "BT_FACE",
    is_final: true,
    is_active: true
  };

  console.log("Upserting category again...");
  const { error: catError } = await admin
    .from("categories")
    .upsert(payload, { onConflict: "code" });

  if (catError) {
    console.error("saveCategory query FAILED:", catError);
    return;
  }
  console.log("saveCategory query SUCCESS!");

  // 2. Mapping 저장
  console.log("Deleting existing mapping for BT_FACE_MIST...");
  const { error: delError } = await admin
    .from("category_profile_mappings")
    .delete()
    .eq("category_code", "BT_FACE_MIST");

  if (delError) {
    console.error("delete mapping FAILED:", delError);
    return;
  }

  console.log("Inserting new mapping for BT_FACE_MIST...");
  const { error: insError } = await admin
    .from("category_profile_mappings")
    .insert({
      category_code: "BT_FACE_MIST",
      profile_code: "PF_FACE_TOOLS",
      is_active: true
    });

  if (insError) {
    console.error("insert mapping FAILED:", insError);
  } else {
    console.log("insert mapping SUCCESS!");
  }
}

run();
