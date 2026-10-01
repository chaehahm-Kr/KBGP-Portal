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

async function syncAndVerify() {
  const companyId = '7d669d13-1c62-494e-a520-c2133348edbe';
  const { data: comp } = await admin.from('companies').select('*').eq('id', companyId).single();
  
  let metaObj = {};
  if (comp?.intro && comp.intro.startsWith('__COMPANY_METADATA__:')) {
    try {
      metaObj = JSON.parse(comp.intro.substring('__COMPANY_METADATA__:'.length));
    } catch {}
  }

  if (Array.isArray(metaObj.contacts)) {
    const idx = metaObj.contacts.findIndex(c => c.email === 'tammyhahm77@gmail.com' || c.id === 'ea6e03fa-bc38-4612-aeeb-b2faee3e5d20');
    if (idx !== -1) {
      metaObj.contacts[idx].name = '박은애';
      metaObj.contacts[idx].englishName = 'Tammy Hahm';
      metaObj.contacts[idx].title = '부부장';
      metaObj.contacts[idx].position = '해외영업사업팀';
      metaObj.contacts[idx].phone = '+82 10-3333-4444';
    }
  }

  await admin.from('companies').update({
    intro: `__COMPANY_METADATA__:${JSON.stringify(metaObj)}`,
    contact_name: '박은애',
    contact_phone: '+82 10-3333-4444',
  }).eq('id', companyId);

  console.log('Synchronized company metadata contacts successfully.');
}

syncAndVerify().catch(console.error);
