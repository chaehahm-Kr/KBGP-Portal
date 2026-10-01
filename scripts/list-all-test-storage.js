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

async function listRecursively(bucket, currentPath = '') {
  let allFiles = [];
  const { data, error } = await admin.storage.from(bucket).list(currentPath);
  if (error) {
    console.error(`Error listing ${bucket}/${currentPath}:`, error);
    return allFiles;
  }
  for (const item of data || []) {
    const itemPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    if (item.id === null) {
      // Subdirectory
      const subFiles = await listRecursively(bucket, itemPath);
      allFiles = allFiles.concat(subFiles);
    } else {
      allFiles.push(itemPath);
    }
  }
  return allFiles;
}

async function listAllTestStorage() {
  const targetCids = [
    '9f37ece5-e164-4357-9ecb-3982ee118ad4',
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1',
    '053723dd-aa07-4200-9406-7b8773dd323e'
  ];

  for (const bucket of ['company-uploads', 'inquiry-uploads']) {
    console.log(`\n=== Bucket: ${bucket} ===`);
    for (const cid of targetCids) {
      const files = await listRecursively(bucket, cid);
      console.log(`Prefix '${cid}': ${files.length} files`);
      files.forEach(f => console.log(`  - ${f}`));
    }
  }

  // Also check agreements table for any final_pdf_path
  const { data: agrs } = await admin.from('company_agreements').select('id, company_id, final_pdf_path').in('company_id', targetCids);
  console.log("\n=== Agreements final_pdf_path ===", agrs);
}

listAllTestStorage().catch(console.error);
