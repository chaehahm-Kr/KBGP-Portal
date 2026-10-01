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

async function resetExtremeApp() {
  const applicationId = 'a51974d1-c520-4f58-accb-748da8fc5794';
  const companyId = '7d669d13-1c62-494e-a520-c2133348edbe';
  const adminUserId = '3fb39bf6-c417-45dd-9c39-8626990c8c9c';

  console.log('Resetting Extreme Inc application APP-20260928-0016...');

  // 1. Reset applications table
  const { error: appErr } = await supabase
    .from('applications')
    .update({
      status: 'submitted',
      invitation_id: null,
      review_notes: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', applicationId);

  if (appErr) {
    console.error('Failed to reset application:', appErr);
    process.exit(1);
  }

  // 2. Reset company_users invited_at
  const { error: cuErr } = await supabase
    .from('company_users')
    .update({
      status: 'invited',
      invited_at: null,
      invited_by: null
    })
    .eq('company_id', companyId);

  if (cuErr) {
    console.error('Failed to reset company_users:', cuErr);
  }

  // 3. Log activity log
  const { error: logErr } = await supabase
    .from('activity_logs')
    .insert({
      entity_type: 'application',
      entity_id: applicationId,
      before_state: 'rejected',
      after_state: 'submitted',
      changed_by: adminUserId,
      reason: 'APPLICATION_TEST_RESET: Application state reset to initial submitted state for Brand Portal invitation email verification. (Company: Extreme Inc.)'
    });

  if (logErr) {
    console.error('Failed to log activity:', logErr);
  }

  console.log('Reset completed successfully! Verify state:');

  const { data: appData } = await supabase
    .from('applications')
    .select('id, application_number, status, applicant_company_name, applicant_contact_name, applicant_contact_email, submitted_at, invitation_id, review_notes')
    .eq('id', applicationId)
    .single();

  console.log('Application state:', appData);

  const { data: cuData } = await supabase
    .from('company_users')
    .select('id, email, status, invited_at')
    .eq('company_id', companyId);

  console.log('Company users state:', cuData);
}

resetExtremeApp();
