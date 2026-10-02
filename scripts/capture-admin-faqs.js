const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function captureAdmin() {
  const { data: users } = await client.auth.admin.listUsers();
  const adminUser = users.users.find(u => u.email === 'qa-admin-test@letusto.com');
  if (adminUser) {
    await client.auth.admin.updateUserById(adminUser.id, { password: 'Password123!@#' });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light'
  });
  const page = await context.newPage();

  console.log('Navigating to admin login...');
  await page.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
  await page.locator('input#password, input[type="password"]').fill('Password123!@#');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  const outDir = path.resolve('Manuals/MAN-B-FAQ-001_Knowledge-FAQ/02_CLAUDE_PACKAGE/02_SCREENSHOTS');

  console.log('Navigating to /admin/knowledge/topics-faq...');
  await page.goto('https://admin.kselectnetwork.com/admin/knowledge/topics-faq', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'SCR-B-FAQ-009.png') });

  console.log('Navigating to /admin/knowledge/library...');
  await page.goto('https://admin.kselectnetwork.com/admin/knowledge/library', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, 'SCR-B-FAQ-010.png') });

  await browser.close();
  console.log('SCR-B-FAQ-009 & 010 captured successfully!');
}

captureAdmin().catch(console.error);
