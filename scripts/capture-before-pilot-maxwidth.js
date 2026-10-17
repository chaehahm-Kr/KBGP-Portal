const { chromium } = require('playwright');
const path = require('path');

const ADMIN_URL = 'https://admin.kselectnetwork.com';
const ARTIFACT_DIR = 'C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e';

(async () => {
  console.log('Capturing remaining BEFORE screenshots from Production...');
  const browser = await chromium.launch({ headless: true });
  
  async function createAuthedPage(width, height = 1080) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email, input[type="email"]', { timeout: 15000 });
    await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
    await page.locator('input#password, input[type="password"]').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    return { context, page };
  }

  try {
    // 4. Retailers at 1920px
    console.log('4. Capturing Retailers list at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${ADMIN_URL}/admin/retailers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const outPath = path.join(ARTIFACT_DIR, 'before_retailers_list_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('Saved:', outPath);
      await context.close();
    }

    // 5. Store Operations at 1920px
    console.log('5. Capturing Store Operations at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${ADMIN_URL}/admin/store-operations`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const outPath = path.join(ARTIFACT_DIR, 'before_store_operations_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('Saved:', outPath);
      await context.close();
    }

    // 6. 90-Day Exchange Credit at 1920px
    console.log('6. Capturing 90-Day Exchange Credit at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${ADMIN_URL}/admin/exchange-credit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const outPath = path.join(ARTIFACT_DIR, 'before_exchange_credit_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('Saved:', outPath);
      await context.close();
    }

    // 7. Initial Trial Reviews List at 1920px
    console.log('7. Capturing Initial Trial Reviews list at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${ADMIN_URL}/admin/protection-reviews`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      const outPath = path.join(ARTIFACT_DIR, 'before_protection_reviews_list_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('Saved:', outPath);
      await context.close();
    }

    console.log('All remaining BEFORE screenshots captured successfully!');
  } catch (err) {
    console.error('Error capturing remaining before screenshots:', err);
  } finally {
    await browser.close();
  }
})();
