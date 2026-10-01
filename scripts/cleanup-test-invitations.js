const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("=== SAFELY CLEANING UP TEST INVITATIONS APP-000013, APP-000014, APP-000015 ===");

  const appIds = [
    '3619cdae-0556-419d-90a9-6a162e1314f0', // APP-000015
    '548f882d-5da7-49fc-a156-f52dce731a3b', // APP-000014
    'd156e2f7-1eaf-41e3-941d-b6b07bd339ca'  // APP-000013
  ];

  const compIds = [
    '69bbf55e-2760-4fd2-a18c-f809b1796e83', // Beauty Master
    '0d86aaf0-7210-4f03-8eff-b1df454c06eb', // BEAUTY MAKER
    '35becea4-e63c-4380-9c40-8aeb27d9430c'  // Beauty Maker 2
  ];

  const testAuthUserId = '0af4eb99-75d7-420e-a013-7a71cef511c6'; // contact@letusto.com test auth user created for APP-000013

  // 1. Delete applications
  const { error: appErr } = await admin.from("applications").delete().in("id", appIds);
  console.log("Deleted applications:", appErr ? appErr.message : "SUCCESS");

  // 2. Delete company_users linked to test companies
  const { error: cuErr } = await admin.from("company_users").delete().in("company_id", compIds);
  console.log("Deleted company_users:", cuErr ? cuErr.message : "SUCCESS");

  // 3. Delete companies
  const { error: compErr } = await admin.from("companies").delete().in("id", compIds);
  console.log("Deleted companies:", compErr ? compErr.message : "SUCCESS");

  // 4. Delete test Auth user created for APP-000013
  const { error: authErr } = await admin.auth.admin.deleteUser(testAuthUserId);
  console.log("Deleted test auth user (contact@letusto.com):", authErr ? authErr.message : "SUCCESS");

  // 5. Verification check
  const { data: remApps } = await admin.from("applications").select("id, application_number, applicant_company_name").in("id", appIds);
  console.log("Remaining test applications (should be empty):", remApps);

  const { data: remComps } = await admin.from("companies").select("id, name").in("id", compIds);
  console.log("Remaining test companies (should be empty):", remComps);

  console.log("=== CLEANUP COMPLETED & VERIFIED ===");
}

main().catch(console.error);
