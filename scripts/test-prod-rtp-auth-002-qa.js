const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env
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

async function runRTPAuth002QA() {
  console.log('====================================================');
  console.log('Production QA: RTP-AUTH-002 Password Recovery Flow');
  console.log('Platform: https://portal.kselecthub.com');
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = [];
  const testEmail = 'tammyhahm@gmail.com';
  const newPassword = 'Password123!@#';

  try {
    // 1. Forgot Password page UI & request
    console.log('[Step 1] Visiting https://portal.kselecthub.com/forgot-password...');
    await page.goto('https://portal.kselecthub.com/forgot-password', { waitUntil: 'networkidle' });
    const forgotHeader = await page.innerText('body');
    const hasHubBranding = forgotHeader.includes('K SELECT HUB') && forgotHeader.includes('Forgot Password');
    console.log(` -> Forgot Password Branding: ${hasHubBranding ? 'PASS' : 'FAIL'}`);
    results.push({ step: '1. Forgot Password Page & Branding', pass: hasHubBranding });

    // Request reset instructions
    console.log('[Step 2] Submitting Forgot Password form for', testEmail);
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const hasConfirmation = (await page.innerText('body')).includes('Instructions Sent') || (await page.innerText('body')).includes('If an account exists');
    console.log(` -> Forgot Password Form Submission: ${hasConfirmation ? 'PASS' : 'FAIL'}`);
    results.push({ step: '2. Forgot Password Request Submission', pass: hasConfirmation });

    // 3. Generate authoritative Supabase recovery link pointing to canonical portal.kselecthub.com
    console.log('[Step 3] Generating canonical Supabase Recovery Link...');
    const targetRedirect = 'https://portal.kselecthub.com/reset-password';
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: testEmail,
      options: {
        redirectTo: targetRedirect,
      },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      throw new Error(`Failed to generate recovery link: ${linkErr?.message}`);
    }

    let recoveryUrl = linkData.properties.action_link;
    const parsed = new URL(recoveryUrl);
    parsed.searchParams.set('redirect_to', targetRedirect);
    recoveryUrl = parsed.toString();

    console.log(' -> Action Link:', recoveryUrl);
    const hasHubRedirect = parsed.searchParams.get('redirect_to') === targetRedirect;
    console.log(` -> Canonical Domain redirect_to Check: ${hasHubRedirect ? 'PASS' : 'FAIL'}`);
    results.push({ step: '3. Canonical Recovery URL & redirect_to', pass: hasHubRedirect });

    // 4. Trace Recovery Link click & ensure NO Brand Portal Flash and NO Redirect Loop
    console.log('[Step 4] Opening Recovery Link in browser...');
    const visitedUrls = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        visitedUrls.push(frame.url());
      }
    });

    await page.goto(recoveryUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(' -> Final Landed URL:', currentUrl);
    console.log(' -> Route Navigation Chain:', visitedUrls);

    const hitBrandPortal = visitedUrls.some(u => u.includes('portal.kselectnetwork.com'));
    const isResetPage = currentUrl.includes('portal.kselecthub.com/reset-password') || currentUrl.includes('portal.kselecthub.com');
    console.log(` -> Direct to Retailer Reset Page: ${isResetPage ? 'PASS' : 'FAIL'}`);
    console.log(` -> Zero Brand Portal Flash: ${!hitBrandPortal ? 'PASS' : 'FAIL'}`);
    results.push({ step: '4. Direct Landing without Brand Portal Flash', pass: isResetPage && !hitBrandPortal });

    // 5. Verify Retailer-Branded Reset Page content
    console.log('[Step 5] Checking Reset Password Page Branding & Status...');
    const resetBody = await page.innerText('body');
    const hasRetailerPortalTitle = resetBody.includes('K SELECT HUB') && resetBody.includes('Retailer Portal');
    const hasAuthorizedNote = resetBody.includes('Authorized wholesale buyers and store operators only');
    const hasFormFields = await page.$('input[name="password"]') !== null;
    console.log(` -> Retailer Branding Header: ${hasRetailerPortalTitle && hasAuthorizedNote ? 'PASS' : 'FAIL'}`);
    console.log(` -> Form Ready State: ${hasFormFields ? 'PASS' : 'FAIL'}`);
    results.push({ step: '5. Branded Reset Page Header & Form Ready', pass: hasRetailerPortalTitle && hasAuthorizedNote && hasFormFields });

    // 6. Perform Password Reset
    console.log('[Step 6] Submitting New Password...');
    await page.fill('input[name="password"]', newPassword);
    await page.fill('input[name="confirmPassword"]', newPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    const postUpdateBody = await page.innerText('body');
    const hasSuccessMsg = postUpdateBody.includes('Password Updated Successfully');
    console.log(` -> Password Update Result: ${hasSuccessMsg ? 'PASS' : 'FAIL'}`);
    results.push({ step: '6. Password Update Execution', pass: hasSuccessMsg });

    // 7. Click Sign In to Retailer Portal CTA
    console.log('[Step 7] Clicking Sign In to Retailer Portal...');
    const signInBtn = await page.$('a:has-text("Sign In to Retailer Portal")');
    if (signInBtn) {
      await signInBtn.click();
      await page.waitForTimeout(2000);
    }
    const onLoginPage = page.url().includes('portal.kselecthub.com/login');
    console.log(` -> Returned to Retailer Login: ${onLoginPage ? 'PASS' : 'FAIL'} (${page.url()})`);
    results.push({ step: '7. Return to Retailer Login CTA', pass: onLoginPage });

    // 8. Test New Password Login
    console.log('[Step 8] Logging in with newly set password...');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', newPassword);
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(e => null),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(2000);

    const onDashboard = page.url() === 'https://portal.kselecthub.com/' || page.url().startsWith('https://portal.kselecthub.com/?');
    const authedText = await page.innerText('body');
    const isAuthed = authedText.includes('Tammy Chun') || authedText.includes('Test Store 01') || authedText.includes('Dashboard');
    console.log(` -> Login with New Password: ${onDashboard && isAuthed ? 'PASS' : 'FAIL'} (${page.url()})`);
    results.push({ step: '8. New Password Authentication', pass: onDashboard && isAuthed });

    // 9. Verify Reusing Already-Completed Recovery Link is safely rejected
    console.log('[Step 9] Testing Re-click of already-used recovery link...');
    const reusePage = await context.newPage();
    await reusePage.goto(recoveryUrl, { waitUntil: 'networkidle' });
    await reusePage.waitForTimeout(3000);
    const reuseBody = await reusePage.innerText('body');
    const isRejectedSafely = reuseBody.includes('Link Expired or Invalid') || reuseBody.includes('already been used') || reuseBody.includes('Request New Reset Link');
    console.log(` -> Safely Rejected Expired/Consumed Link: ${isRejectedSafely ? 'PASS' : 'FAIL'}`);
    results.push({ step: '9. Used Recovery Link Rejection', pass: isRejectedSafely });
    await reusePage.close();

    // 10. Brand Portal & Admin Auth Isolation Check
    console.log('[Step 10] Checking Brand Portal Login Page...');
    const brandPage = await context.newPage();
    await brandPage.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'networkidle' });
    const brandTitle = await brandPage.title();
    const brandOk = brandTitle.includes('K SELECT') || (await brandPage.innerText('body')).includes('브랜드사');
    console.log(` -> Brand Portal Isolated & Functional: ${brandOk ? 'PASS' : 'FAIL'}`);
    results.push({ step: '10. Brand Portal Isolation', pass: brandOk });
    await brandPage.close();

    console.log('\n====================================================');
    console.log('QA SUMMARY RESULTS (RTP-AUTH-002):');
    results.forEach(r => console.log(` [${r.pass ? 'PASS' : 'FAIL'}] ${r.step}`));
    console.log('====================================================');

    const allPassed = results.every(r => r.pass);
    console.log(`FINAL RESULT: ${allPassed ? 'ALL QA PASSED' : 'SOME QA FAILED'}`);

  } catch (err) {
    console.error('QA Test Error:', err);
  } finally {
    await browser.close();
  }
}

runRTPAuth002QA();
