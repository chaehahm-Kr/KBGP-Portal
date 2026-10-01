const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);

async function runAudit() {
  console.log('=== 1. AUDIT APPLICATIONS DUPLICATES BY EMAIL ===');
  const { data: apps, error: appErr } = await supabase
    .from('applications')
    .select('id, application_number, applicant_contact_email, applicant_company_name, partner_type, entry_mode, status, created_at, company_id')
    .order('created_at', { ascending: false });

  if (appErr) {
    console.error('Applications query error:', appErr);
    return;
  }

  console.log(`Total applications: ${apps.length}`);

  const emailMap = {};
  for (const app of apps) {
    const rawEmail = app.applicant_contact_email || '';
    const normEmail = rawEmail.trim().toLowerCase();
    if (!normEmail) continue;
    if (!emailMap[normEmail]) emailMap[normEmail] = [];
    emailMap[normEmail].push(app);
  }

  let dupEmailCount = 0;
  for (const [email, list] of Object.entries(emailMap)) {
    if (list.length > 1) {
      dupEmailCount++;
      console.log(`\nDuplicate Normalized Email: [${email}] (${list.length} records):`);
      list.forEach(a => {
        console.log(`  - ID: ${a.id} | APP#: ${a.application_number} | Type: ${a.partner_type} | Mode: ${a.entry_mode} | Status: ${a.status} | Company: ${a.applicant_company_name} | Created: ${a.created_at}`);
      });
    }
  }
  console.log(`\nTotal duplicate normalized emails in applications: ${dupEmailCount}`);

  console.log('\n=== 2. AUDIT COMPANY USERS BY EMAIL ===');
  const { data: cUsers, error: cuErr } = await supabase
    .from('company_users')
    .select('id, company_id, email, name, status, invited_at, created_at');

  if (!cuErr && cUsers) {
    const cuEmailMap = {};
    cUsers.forEach(cu => {
      const e = (cu.email || '').trim().toLowerCase();
      if (!e) return;
      if (!cuEmailMap[e]) cuEmailMap[e] = [];
      cuEmailMap[e].push(cu);
    });

    for (const [email, list] of Object.entries(cuEmailMap)) {
      if (list.length > 1) {
        console.log(`Duplicate company_users email: [${email}] (${list.length} rows):`, list);
      }
    }
  }

  console.log('\n=== 3. AUDIT RETAILER INVITATIONS BY EMAIL ===');
  const { data: retInv, error: rErr } = await supabase
    .from('retailer_invitations')
    .select('id, company_id, email, status, created_at');

  if (!rErr && retInv) {
    const rEmailMap = {};
    retInv.forEach(ri => {
      const e = (ri.email || '').trim().toLowerCase();
      if (!e) return;
      if (!rEmailMap[e]) rEmailMap[e] = [];
      rEmailMap[e].push(ri);
    });

    for (const [email, list] of Object.entries(rEmailMap)) {
      if (list.length > 1) {
        console.log(`Duplicate retailer_invitations email: [${email}] (${list.length} rows):`, list);
      }
    }
  }

  console.log('\n=== 4. AUDIT AUTH USERS ===');
  const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
  if (users) {
    console.log(`Total Auth Users: ${users.length}`);
  }
}

runAudit();
