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

const targetProductIds = [
  '007c67dd-c1c7-4c6b-8df1-d3cfad7ce632',
  '751c5ba2-4dff-4a9f-9d87-37ae14a7ba94',
  '4fcaeb00-8dcf-4743-be68-9bd697881847',
  '47ee85b1-54aa-481c-9f19-35fed602e706'
];

const targetBrandIds = [
  '4bc9f6ea-5cb8-4b23-a624-8db24b8f5c27',
  '3f8f1299-3da4-4397-8566-d7ed634d7a95',
  '61d74ec6-e986-483f-92ad-65486d68186b'
];

async function checkProductBrandDeps() {
  console.log("=== Checking Product Dependencies ===");
  for (const pid of targetProductIds) {
    const { error: err } = await admin.from('products').delete().eq('id', pid);
    if (err) {
      console.log(`Product ${pid} deletion error:`, err);
    } else {
      console.log(`Product ${pid} deleted successfully!`);
    }
  }

  console.log("\n=== Checking Brand Dependencies ===");
  for (const bid of targetBrandIds) {
    const { error: err } = await admin.from('brands').delete().eq('id', bid);
    if (err) {
      console.log(`Brand ${bid} deletion error:`, err);
    } else {
      console.log(`Brand ${bid} deleted successfully!`);
    }
  }
}

checkProductBrandDeps().catch(console.error);
