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

async function inspectTargetProducts() {
  const targetCompanyIds = [
    '9f37ece5-e164-4357-9ecb-3982ee118ad4', // John
    '0ec853ef-45dc-4f8f-aa63-59debeaf4af1', // Carmel
    '053723dd-aa07-4200-9406-7b8773dd323e', // Carmel2
  ];

  for (const cid of targetCompanyIds) {
    const { data: comp } = await admin.from('companies').select('id, name').eq('id', cid).single();
    console.log(`\n==============================================`);
    console.log(`Company: ${comp.name} (${comp.id})`);
    
    const { data: prods } = await admin.from('products').select('*').eq('company_id', cid);
    console.log(`Products (${prods?.length || 0}):`);
    for (const p of prods || []) {
      console.log(`  - Product ID: ${p.id} | Name: ${p.name} | SKU: ${p.letusto_sku} / ${p.manufacture_sku}`);
      
      const { data: imgs } = await admin.from('product_images').select('*').eq('product_id', p.id);
      console.log(`    Images (${imgs?.length || 0}):`, imgs?.map(i => i.storage_path));
      
      const { data: certs } = await admin.from('product_certificates').select('*').eq('product_id', p.id);
      console.log(`    Certs (${certs?.length || 0}):`, certs?.map(c => c.storage_path));
      
      const { data: vids } = await admin.from('product_videos').select('*').eq('product_id', p.id);
      console.log(`    Videos (${vids?.length || 0}):`, vids?.map(v => v.storage_path));

      const { data: logs } = await admin.from('product_change_logs').select('*').eq('product_id', p.id);
      console.log(`    Change Logs (${logs?.length || 0})`);

      const { data: attrs } = await admin.from('product_attribute_values').select('*').eq('product_id', p.id);
      console.log(`    Attribute Values (${attrs?.length || 0})`);
    }

    const { data: brands } = await admin.from('brands').select('*').eq('company_id', cid);
    console.log(`Brands (${brands?.length || 0}):`, brands);
  }
}

inspectTargetProducts().catch(console.error);
