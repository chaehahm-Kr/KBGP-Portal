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
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: 'qa-retailer-test@letusto.com',
    options: { redirectTo: 'https://portal.kselecthub.com/reset-password' }
  });
  console.log('Action link:', data?.properties?.action_link);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await page.goto(data.properties.action_link, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());
  
  console.log('Filling password...');
  await page.fill('input[name="password"]', 'Password123!@#');
  await page.fill('input[name="confirmPassword"]', 'Password123!@#');
  console.log('Submitting form...');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  
  const body = await page.innerText('body');
  console.log('Body after submit:\n', body);
  await page.screenshot({ path: 'reports/reset_password_debug.png' });
  await browser.close();
}
test();
