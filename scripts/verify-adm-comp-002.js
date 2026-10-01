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

async function runVerification() {
  console.log('=== 1. VERIFYING COMPANIES AND ONBOARDING STATUS ON PROD DB ===');
  const { data: companies, error: compErr } = await admin.from('companies').select('*');
  const { data: users, error: userErr } = await admin.from('company_users').select('*');
  const { data: tasks, error: taskErr } = await admin.from('company_task_assignments').select('*');
  const { data: agreements, error: agrErr } = await admin.from('company_agreements').select('*');
  const { data: products, error: prodErr } = await admin.from('products').select('*');

  if (compErr || userErr) {
    console.error('Fetch error:', compErr || userErr);
    return;
  }

  console.log(`Total Companies: ${companies.length}, Total Users: ${users.length}, Total Agreements: ${agreements.length}`);

  for (const c of companies) {
    const cUsers = users.filter(u => u.company_id === c.id);
    const cTasks = tasks.filter(t => t.company_id === c.id);
    const cAgreements = agreements.filter(a => a.company_id === c.id);
    const cProducts = products.filter(p => p.company_id === c.id);

    const step1 = !!(c.name && c.country && c.business_registration_number);
    const primaryUser = cUsers.find(u => u.is_primary) || cUsers[0];
    const engName = primaryUser?.english_name || primaryUser?.permissions?.english_name;
    const step2 = !!(primaryUser && primaryUser.name && engName && primaryUser.title && primaryUser.phone);
    const step3 = cUsers.length > 1 || !!c.metadata?.onboarding_step_team_completed;
    const step4 = !!c.metadata?.onboarding_step_brand_completed;
    const approvedProducts = cProducts.filter(p => p.selection_status === 'APPROVED' || p.status === 'COMPLETE' || (p.status !== 'DRAFT' && p.english_name));
    const step5 = approvedProducts.length > 0;
    const step6 = [
      'BUSINESS_OPERATION_LOGISTICS',
      'CUSTOMER_SERVICE',
      'ACCOUNTING_SETTLEMENT',
      'SALES_MARKETING',
      'QUALITY_ASSURANCE',
      'IMPORT_CUSTOMS'
    ].every(code => cTasks.some(t => t.task_code === code && t.is_primary));
    const step7 = cAgreements.some(a => a.status === 'active');

    const completed = [step1, step2, step3, step4, step5, step6, step7].filter(Boolean).length;
    console.log(`Company: "${c.name}" | Country: "${c.country}" | Progress: ${completed} / 7 | Steps: [1:${step1}, 2:${step2}, 3:${step3}, 4:${step4}, 5:${step5}, 6:${step6}, 7:${step7}]`);
  }

  console.log('\n=== 2. VERIFYING EXTREME INC. USER & BILINGUAL DATA ===');
  const extremeUser = users.find(u => u.email === 'tammyhahm77@gmail.com');
  console.log('User:', extremeUser ? {
    id: extremeUser.id,
    name: extremeUser.name,
    english_name: extremeUser.english_name || extremeUser.permissions?.english_name,
    title: extremeUser.title,
    position: extremeUser.position,
    phone: extremeUser.phone,
    permissions_english_name: extremeUser.permissions?.english_name
  } : 'Not found');
}

runVerification().catch(console.error);
