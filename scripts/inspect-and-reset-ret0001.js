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
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const companyId = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
  console.log('=== Checking RET-0001 Company & Agreement Data ===');

  const { data: comp, error: compErr } = await admin
    .from('companies')
    .select('id, name, address, contact_name, city, state, zip')
    .eq('id', companyId)
    .single();
  console.log('Company Profile:', comp);

  const { data: agreements, error: agErr } = await admin
    .from('company_agreements')
    .select('*')
    .eq('company_id', companyId);

  // Controlled Reset for RET-0001
  if (agreements && agreements.length > 0) {
    const target = agreements[0];
    console.log(`Resetting agreement ${target.agreement_id} (ID: ${target.id}) to clean PENDING state...`);
    
    // 1. Delete recipients
    const { error: recDelErr } = await admin
      .from('company_agreement_recipients')
      .delete()
      .eq('company_agreement_id', target.id);
    console.log('Recipients delete status:', recDelErr || 'Success');

    // 2. Reset company agreement fields to clean pending
    const { error: resetErr } = await admin
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
        next_renewal_date: null,
        non_renewal_notice_deadline: null,
        final_pdf_path: null,
        final_pdf_hash: null,
      })
      .eq('id', target.id);

    if (resetErr) {
      console.error('Failed to reset agreement:', resetErr);
    } else {
      console.log(`✅ Agreement ${target.agreement_id} successfully reset to PENDING.`);
    }

    // 3. Verify clean state
    const { data: verified } = await admin
      .from('company_agreements')
      .select('*')
      .eq('id', target.id)
      .single();
    console.log('Verified Agreement Record:', {
      id: verified.id,
      agreement_id: verified.agreement_id,
      status: verified.status,
      signer_name: verified.signer_name,
      final_pdf_path: verified.final_pdf_path,
    });
  }
}

main();
