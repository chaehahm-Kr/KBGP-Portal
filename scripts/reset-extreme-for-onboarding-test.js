const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function resetForOnboarding() {
  const applicationId = 'a51974d1-c520-4f58-accb-748da8fc5794';
  const companyId = '7d669d13-1c62-494e-a520-c2133348edbe';
  const userId = 'ea6e03fa-bc38-4612-aeeb-b2faee3e5d20';
  const adminUserId = '3fb39bf6-c417-45dd-9c39-8626990c8c9c';

  console.log('Resetting Extreme Inc (APP-20260928-0016) for Onboarding E2E Retest...');

  // 1. Application -> approved
  const { error: appErr } = await supabase
    .from('applications')
    .update({
      status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', applicationId);
  if (appErr) console.error('App update err:', appErr);

  // 2. Company User -> invited with fresh invitation timestamp
  const { error: userErr } = await supabase
    .from('company_users')
    .update({
      status: 'invited',
      invited_at: new Date().toISOString(),
      joined_at: null,
      invited_by: adminUserId,
      position: null,
    })
    .eq('id', userId);
  if (userErr) console.error('User update err:', userErr);

  // 3. Agreement -> pending (reset signatures)
  const { error: agrErr } = await supabase
    .from('company_agreements')
    .update({
      status: 'pending',
      signer_user_id: null,
      signer_name: null,
      signer_title: null,
      signer_email: null,
      authority_confirmed: false,
      authority_confirmed_at: null,
      consent_to_agreement: false,
      consent_to_e_signature: false,
      signed_at: null,
      effective_date: null,
      expiration_date: null,
      final_pdf_path: null,
      final_pdf_hash: null,
      updated_at: new Date().toISOString()
    })
    .eq('company_id', companyId);
  if (agrErr) console.error('Agreement update err:', agrErr);

  // 4. Company metadata -> clean all onboarding confirmation flags
  const { data: comp } = await supabase.from('companies').select('intro').eq('id', companyId).single();
  if (comp?.intro && comp.intro.startsWith('__COMPANY_METADATA__:')) {
    try {
      const meta = JSON.parse(comp.intro.substring('__COMPANY_METADATA__:'.length));
      delete meta.team_onboarding_skipped;
      delete meta.company_onboarding_confirmed_at;
      delete meta.admin_profile_onboarding_confirmed_at;
      delete meta.brand_onboarding_confirmed_at;
      await supabase.from('companies').update({
        intro: `__COMPANY_METADATA__:${JSON.stringify(meta)}`,
        updated_at: new Date().toISOString()
      }).eq('id', companyId);
    } catch (e) {
      console.error('Meta parse error:', e);
    }
  }

  // 5. Activity Log
  await supabase.from('activity_logs').insert({
    entity_type: 'application',
    entity_id: applicationId,
    before_state: 'submitted',
    after_state: 'approved',
    changed_by: adminUserId,
    reason: 'PORT_ONB_002_R2_RESET: Prepared Extreme Inc. for 6-Step Onboarding QA testing (0/6 Complete initial state).'
  });

  console.log('Reset complete! Verifying state:');

  const { data: appData } = await supabase
    .from('applications')
    .select('id, application_number, status, applicant_company_name, applicant_contact_name, applicant_contact_email')
    .eq('id', applicationId)
    .single();
  console.log('App:', appData);

  const { data: userData } = await supabase
    .from('company_users')
    .select('id, email, status, invited_at, joined_at, position, phone')
    .eq('id', userId)
    .single();
  console.log('Company User:', userData);

  const { data: compData } = await supabase
    .from('companies')
    .select('id, name, intro')
    .eq('id', companyId)
    .single();
  console.log('Company intro:', compData.intro);

  const { data: agrData } = await supabase
    .from('company_agreements')
    .select('id, agreement_id, status, signer_name, signed_at')
    .eq('company_id', companyId);
  console.log('Agreement:', agrData);
}

resetForOnboarding();
