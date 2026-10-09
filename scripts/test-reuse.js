const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: 'qa-retailer-test@letusto.com',
    options: { redirectTo: 'https://portal.kselecthub.com/reset-password' }
  });
  const recoveryUrl = data.properties.action_link;
  console.log('Recovery URL:', recoveryUrl);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 1st visit
  await page.goto(recoveryUrl, { waitUntil: 'networkidle' });
  console.log('1st visit URL:', page.url());
  
  // 2nd visit to same link
  const page2 = await browser.newPage();
  await page2.goto(recoveryUrl, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(3000);
  console.log('2nd visit URL:', page2.url());
  console.log('2nd visit body:\n', await page2.innerText('body'));
  
  await browser.close();
}
test();
