const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
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

const TEST_EMAIL = 'tammyhahm@gmail.com';
const TEST_PASSWORD = process.env.TEST_RETAILER_PASSWORD || 'Password123!@#';
const BASE_URL = 'https://portal.kselecthub.com';

const ROUTES_TO_TEST = [
  '/',
  '/products',
  '/orders',
  '/check',
  '/sales',
  '/stores',
  '/account',
  '/settings/company',
  '/settings/team',
];

async function run15MinuteSessionQA() {
  console.log('================================================================');
  console.log('HUB-AUTH-001-R2: 15-Minute Continuous Production Session Verification');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Account: ${TEST_EMAIL}`);
  console.log('================================================================\n');

  const startTime = new Date();
  console.log(`[START] Verification started at: ${startTime.toISOString()}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const refreshEvents = [];
  const navigationLogs = [];
  let errorEncountered = null;

  // Monitor network traffic for token refresh and auth requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/auth/v1/token') || url.includes('/api/auth/refresh') || url.includes('grant_type=refresh_token')) {
      const status = response.status();
      const eventTime = new Date().toISOString();
      refreshEvents.push({ time: eventTime, status, urlPattern: 'token-refresh' });
      console.log(`[REFRESH EVENT] Token Refresh intercepted at ${eventTime} -> HTTP ${status}`);
    }
  });

  try {
    // 1. Initial Login
    console.log(`[00:00] Navigating to ${BASE_URL}/login...`);
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.fill('input#email', TEST_EMAIL);
    await page.fill('input#password', TEST_PASSWORD);

    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForTimeout(3000);
    const initialUrl = page.url();
    const initialBody = await page.innerText('body');
    const isInitialAuthed = !initialUrl.includes('/login') && (initialBody.includes('Test Store') || initialBody.includes('Tammy Chun') || initialBody.includes('Dashboard'));

    if (!isInitialAuthed) {
      throw new Error(`Initial login failed at ${initialUrl}. Body snippet: ${initialBody.slice(0, 200)}`);
    }

    console.log(`[00:00] Initial login successful. Landed on: ${initialUrl}`);
    await page.screenshot({ path: 'reports/rtp_session_15min_00m.png' });

    // Target duration: 16 minutes = 960 seconds
    const totalDurationSec = 16 * 60;
    const intervalSec = 60;
    let elapsedSec = 0;
    let stepCount = 0;

    while (elapsedSec < totalDurationSec) {
      await new Promise(r => setTimeout(r, intervalSec * 1000));
      elapsedSec += intervalSec;
      stepCount++;

      const currentMins = Math.floor(elapsedSec / 60);
      const currentSecs = elapsedSec % 60;
      const timeTag = `[${String(currentMins).padStart(2, '0')}:${String(currentSecs).padStart(2, '0')}]`;

      const targetRoute = ROUTES_TO_TEST[stepCount % ROUTES_TO_TEST.length];
      const targetUrl = `${BASE_URL}${targetRoute}`;

      console.log(`${timeTag} Step ${stepCount}: Navigating to ${targetUrl}...`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const landedUrl = page.url();
      const bodyText = await page.innerText('body');

      const isAuthed = !landedUrl.includes('/login') && !bodyText.includes('Invalid email or password') && !bodyText.includes('Sign in to your account');
      if (!isAuthed) {
        throw new Error(`Session lost at ${timeTag} while visiting ${targetUrl}. Landed on: ${landedUrl}`);
      }

      navigationLogs.push({ time: new Date().toISOString(), route: targetRoute, status: 'OK' });
      console.log(`${timeTag} -> OK (Session active)`);

      // Test page reload every 3 minutes
      if (stepCount % 3 === 0) {
        console.log(`${timeTag} -> Testing page reload...`);
        await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500);
        if (page.url().includes('/login')) {
          throw new Error(`Session lost on page reload at ${timeTag}`);
        }
        console.log(`${timeTag} -> Reload PASS`);
      }

      // Test multi-tab concurrent access every 5 minutes
      if (stepCount % 5 === 0) {
        console.log(`${timeTag} -> Testing multi-tab concurrency (opening secondary tab)...`);
        const tab2 = await context.newPage();
        await tab2.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle', timeout: 30000 });
        await tab2.waitForTimeout(2000);
        const tab2Url = tab2.url();
        const tab2Body = await tab2.innerText('body');
        const isTab2Authed = !tab2Url.includes('/login') && (tab2Body.includes('Products') || tab2Body.includes('Catalog') || tab2Body.includes('Search'));
        await tab2.close();

        if (!isTab2Authed) {
          throw new Error(`Multi-tab concurrency failed at ${timeTag}`);
        }
        console.log(`${timeTag} -> Multi-tab PASS`);
      }

      // Capture milestone screenshots
      if (currentMins === 5) {
        await page.screenshot({ path: 'reports/rtp_session_15min_05m.png' });
      } else if (currentMins === 10) {
        await page.screenshot({ path: 'reports/rtp_session_15min_10m.png' });
      } else if (currentMins === 15) {
        await page.screenshot({ path: 'reports/rtp_session_15min_15m.png' });
      }
    }

    // Final check at conclusion
    console.log('\n[FINAL CHECK] Performing final navigation & dashboard state check...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    const finalBody = await page.innerText('body');
    const isFinalAuthed = !finalUrl.includes('/login') && (finalBody.includes('Test Store') || finalBody.includes('Tammy Chun') || finalBody.includes('Dashboard'));

    await page.screenshot({ path: 'reports/rtp_session_15min_final.png' });

    const endTime = new Date();
    const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log('\n================================================================');
    console.log('15-MINUTE CONTINUOUS SESSION QA SUMMARY');
    console.log('================================================================');
    console.log(`Start Time:       ${startTime.toISOString()}`);
    console.log(`End Time:         ${endTime.toISOString()}`);
    console.log(`Total Duration:   ${durationMinutes} minutes`);
    console.log(`Total Steps:      ${stepCount} navigations`);
    console.log(`Token Refreshes:  ${refreshEvents.length} refresh event(s) recorded`);
    console.log(`Multi-tab Tests:  PASSED`);
    console.log(`Page Reloads:     PASSED`);
    console.log(`Session Status:   ${isFinalAuthed ? 'STABLE & PERSISTENT (PASS)' : 'FAILED'}`);
    console.log('================================================================\n');

    const reportData = {
      test: 'HUB-AUTH-001-R2 15-Minute Session Verification',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: parseFloat(durationMinutes),
      stepCount,
      refreshEventsCount: refreshEvents.length,
      refreshEvents,
      navigationLogsCount: navigationLogs.length,
      finalUrl,
      isFinalAuthed,
      status: isFinalAuthed ? 'PASS' : 'FAIL',
    };

    fs.writeFileSync('reports/hub_15min_session_report.json', JSON.stringify(reportData, null, 2));

  } catch (err) {
    console.error('\n❌ QA TEST ERROR:', err);
    errorEncountered = err;
    await page.screenshot({ path: 'reports/rtp_session_15min_error.png' }).catch(() => null);
  } finally {
    await browser.close();
    if (errorEncountered) {
      process.exit(1);
    }
  }
}

run15MinuteSessionQA();
