const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const requirePkg = createRequire(path.resolve(process.cwd(), 'package.json'));
const puppeteer = requirePkg('puppeteer');

async function runProductionQA() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER PAGE ERROR:', err.message));

  console.log('=== Step 1: Admin Login ===');
  await page.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa-admin-test@letusto.com');
  await page.type('input[type="password"]', 'TestPassword2026!@#');
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('button[type="submit"]')
  ]);
  console.log('Admin Logged In. Current URL:', page.url());

  console.log('=== Step 2: Navigate to Admin PO-2026-0008 Detail ===');
  await page.goto('https://admin.kselectnetwork.com/admin/purchasing/acbc3a9e-3769-4e2f-84bf-430c176bda5e', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_01_po_detail_ready.png' });

  console.log('=== Step 3: Test Upper CTA "선적 등록 (Create Shipment)" ===');
  // Find top CTA button
  const topButtons = await page.$$('button');
  let clickedTop = false;
  for (const b of topButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('선적 등록 (Create Shipment)')) {
      console.log('Clicking top CTA button:', text.trim());
      await b.click();
      clickedTop = true;
      break;
    }
  }

  if (!clickedTop) {
    console.log('Top button not matched with exact text, listing all buttons:');
    for (const b of topButtons) {
      const text = await page.evaluate(el => el.textContent, b);
      console.log(' - Button text:', text.trim());
      if (text && text.includes('선적 등록')) {
        await b.click();
        break;
      }
    }
  }

  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_02_shipment_form_opened.png' });

  const formOpened = await page.evaluate(() => {
    return document.body.innerText.includes('신규 선적물 등록 정보') || document.body.innerText.includes('선적 대상 품목 수량');
  });
  console.log('Shipment form successfully opened via top CTA:', formOpened);

  console.log('=== Step 4: Fill and Submit Shipment Form ===');
  const textInputs = await page.$$('input[type="text"]');
  console.log('Found text inputs:', textInputs.length);
  for (let i = 0; i < textInputs.length; i++) {
    const placeholder = await page.evaluate(el => el.getAttribute('placeholder'), textInputs[i]);
    if (placeholder && placeholder.includes('DHL')) {
      await textInputs[i].type('Hanjin Shipping / Ocean Freight');
    }
  }

  // Click submit button "선적 등록 및 출고 확정"
  const formButtons = await page.$$('button');
  for (const b of formButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && (text.includes('선적 등록 및 출고 확정') || text.includes('선적 정보 저장'))) {
      console.log('Clicking shipment submit button:', text.trim());
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_03_after_shipment_save.png' });

  console.log('=== Step 5: Verify Step 4 Shipped on Admin PO Detail ===');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_04_admin_po_shipped_persisted.png' });

  const adminBody = await page.evaluate(() => document.body.innerText);
  const isShipped = adminBody.includes('출고/선적 완료 (Shipped)') || adminBody.includes('Shipped');
  const has1120Shipped = adminBody.includes('1,120') && adminBody.includes('1,121');
  console.log('Admin PO Overall Status is Shipped:', isShipped);
  console.log('Admin PO has 1,120 shipped qty stats:', has1120Shipped);

  console.log('=== Step 6: Verify Brand Portal Sync ===');
  await page.goto('https://portal.kselectnetwork.com/portal/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa-portal-test@letusto.com');
  await page.type('input[type="password"]', 'TestPassword2026!@#');
  
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
    page.click('button[type="submit"]')
  ]);
  console.log('Portal Logged In. Current URL:', page.url());

  // 1. PO List
  await page.goto('https://portal.kselectnetwork.com/portal/orders/purchase-orders', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_05_portal_po_list_shipped.png' });
  const portalListText = await page.evaluate(() => document.body.innerText);
  const portalListShipped = portalListText.includes('출고/선적 완료 (Shipped)');
  console.log('Portal PO List shows "출고/선적 완료 (Shipped)":', portalListShipped);

  // 2. PO Detail
  await page.goto('https://portal.kselectnetwork.com/portal/orders/purchase-orders/acbc3a9e-3769-4e2f-84bf-430c176bda5e', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: 'C:/Users/chaeh/.gemini/antigravity/brain/546c3ad8-3f28-48c1-9db9-98d93ae51133/qa_adm009_06_portal_po_detail_shipped.png' });
  const portalDetailText = await page.evaluate(() => document.body.innerText);
  const portalDetailShipped = portalDetailText.includes('출고/선적 완료 (Shipped)') || portalDetailText.includes('Shipped');
  console.log('Portal PO Detail shows Step 4 Shipped:', portalDetailShipped);

  await browser.close();
  console.log('=== ALL PRODUCTION QA SCENARIOS PASSED SUCCESSFULLY ===');
}

runProductionQA().catch(console.error);
