const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function testAuth() {
  console.log('Testing session generation for account@letusto.com...');
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'account@letusto.com'
  });
  if (linkErr) {
    console.error('generateLink error:', linkErr);
    return;
  }
  console.log('Generated magiclink properties:', Object.keys(linkData));
  const tokenHash = linkData.properties?.hashed_token;
  console.log('tokenHash:', tokenHash);

  // Let's test signing in with playwright
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2 // Crisp 2x retina screenshots
  });
  const page = await context.newPage();

  // Let's test Supabase auth verify
  const projectRef = 'shzfrppdobpmrstcjfqu';
  
  // Or verify via client auth
  const client = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink'
  });

  if (verifyErr) {
    console.error('verifyOtp error:', verifyErr);
  } else {
    console.log('Session obtained successfully for:', sessionData.user?.email);
    const sessionCookieValue = JSON.stringify({
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      token_type: 'bearer',
      user: sessionData.user
    });

    // Set cookie for portal.kselectnetwork.com
    await context.addCookies([
      {
        name: `portal-sb-${projectRef}-auth-token`,
        value: encodeURIComponent(sessionCookieValue),
        domain: 'portal.kselectnetwork.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      },
      {
        name: `sb-${projectRef}-auth-token`,
        value: encodeURIComponent(sessionCookieValue),
        domain: 'portal.kselectnetwork.com',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      }
    ]);

    await page.goto('https://portal.kselectnetwork.com/portal/products', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Products page URL:', page.url());
    console.log('Products page title:', await page.title());
    const content = await page.textContent('body');
    console.log('Body snippet:', content.slice(0, 200).replace(/\s+/g, ' '));
  }

  await browser.close();
}

testAuth().catch(console.error);
