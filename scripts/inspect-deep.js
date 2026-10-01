const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co', process.env.SUPABASE_SECRET_KEY);

async function inspectAllRelated() {
  const targetCompanyIds = [
    '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
    '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
  ];

  console.log("=== Applications for target companies ===");
  const { data: apps } = await admin
    .from('applications')
    .select('*')
    .or(`company_id.in.(${targetCompanyIds.join(',')}),onboarded_company_id.in.(${targetCompanyIds.join(',')})`);
  
  console.log(apps.map(a => ({
    id: a.id,
    app_no: a.application_number,
    company_id: a.company_id,
    onboarded_company_id: a.onboarded_company_id,
    applicant_company_name: a.applicant_company_name,
    applicant_contact_name: a.applicant_contact_name,
    applicant_contact_email: a.applicant_contact_email,
    status: a.status,
    invitation_id: a.invitation_id
  })));

  console.log("\n=== Also check all applications with applicant_company_name or email matching John/Carmel ===");
  const { data: allApps } = await admin.from('applications').select('*');
  const matchingAllApps = allApps.filter(a => {
    const s = JSON.stringify(a).toLowerCase();
    return s.includes('john') || s.includes('carmel') || s.includes('david.lee.tact') || s.includes('jinseoklee81');
  });
  console.log(matchingAllApps.map(a => ({
    id: a.id,
    app_no: a.application_number,
    company_id: a.company_id,
    onboarded_company_id: a.onboarded_company_id,
    applicant_company_name: a.applicant_company_name,
    applicant_contact_name: a.applicant_contact_name,
    applicant_contact_email: a.applicant_contact_email,
    status: a.status,
    invitation_id: a.invitation_id
  })));

  console.log("\n=== Invitations for target companies ===");
  const { data: invites } = await admin.from('company_invitations').select('*');
  const matchingInvites = (invites || []).filter(i => {
    const s = JSON.stringify(i).toLowerCase();
    return targetCompanyIds.includes(i.company_id) || s.includes('john') || s.includes('carmel') || s.includes('david.lee.tact') || s.includes('jinseoklee81');
  });
  console.log(matchingInvites);

  console.log("\n=== Auth Users matching target emails / metadata ===");
  const { data: authList } = await admin.auth.admin.listUsers();
  const matchingAuthUsers = (authList?.users || []).filter(u => {
    const s = JSON.stringify(u).toLowerCase();
    return s.includes('john') || s.includes('carmel') || s.includes('david.lee.tact') || s.includes('jinseoklee81');
  });
  console.log(matchingAuthUsers.map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    metadata: u.user_metadata,
    app_metadata: u.app_metadata
  })));
}

inspectAllRelated().catch(console.error);
