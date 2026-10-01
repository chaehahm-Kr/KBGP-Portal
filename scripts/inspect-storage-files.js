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

const targetCompanyIds = [
  '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
  '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
  '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
];

async function inspectStorage() {
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) {
    console.error("Error listing buckets:", bErr);
    return;
  }

  console.log("All Buckets:", buckets.map(b => b.name));

  for (const bucket of buckets) {
    console.log(`\n--- Bucket: ${bucket.name} ---`);
    for (const cid of targetCompanyIds) {
      const { data: files } = await admin.storage.from(bucket.name).list(cid);
      if (files && files.length > 0) {
        console.log(`  Found under prefix '${cid}':`, files.map(f => f.name));
      }
      
      // Also search nested
      const { data: allFiles } = await admin.storage.from(bucket.name).list('', { limit: 100 });
      const matching = (allFiles || []).filter(f => f.name.includes(cid) || f.name.includes('John') || f.name.includes('Carmel'));
      if (matching.length > 0) {
        console.log(`  Found matching in root:`, matching.map(f => f.name));
      }
    }
  }
}

inspectStorage().catch(console.error);
