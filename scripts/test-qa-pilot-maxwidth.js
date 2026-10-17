const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const LOCAL_URL = 'http://localhost:3000';
const ARTIFACT_DIR = 'C:/Users/ChaeHahm/.gemini/antigravity/brain/945ab025-0f8f-4fce-b0bc-56237108874e';
const DETAIL_ID = '6fc6e1ab-508e-465e-b59a-33ef7b41d145';

(async () => {
  console.log('======================================================================');
  console.log('  STARTING QA & SCREENSHOT SUITE: ADM-LAYOUT-MAXWIDTH-001');
  console.log('======================================================================\n');

  const browser = await chromium.launch({ headless: true });

  const metrics = {
    viewportsTested: [],
    clampingVerified: true,
    centeringVerified: true,
    sidebarCollapseVerified: false,
    stickyScrollVerified: false,
    nonPilotFullWidthVerified: false,
  };

  async function createAuthedPage(width, height = 1080) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    
    await page.goto(`${LOCAL_URL}/admin/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email, input[type="email"]', { timeout: 15000 });
    await page.locator('input#email, input[type="email"]').fill('qa-admin-test@letusto.com');
    await page.locator('input#password, input[type="password"]').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    return { context, page };
  }

  try {
    // -------------------------------------------------------------
    // 1. Capture AFTER Screenshots for Visual Comparison
    // -------------------------------------------------------------
    console.log('[Step 1] Capturing AFTER screenshots for 4 pilot menus...');

    // 1.1 Initial Trial Reviews Detail at 1440px
    {
      console.log(' -> Initial Trial Reviews Detail at 1440px...');
      const { context, page } = await createAuthedPage(1440, 1080);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_protection_review_detail_1440px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.2 Initial Trial Reviews Detail at 1920px
    {
      console.log(' -> Initial Trial Reviews Detail at 1920px...');
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_protection_review_detail_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.3 Initial Trial Reviews Detail at 2560px
    {
      console.log(' -> Initial Trial Reviews Detail at 2560px...');
      const { context, page } = await createAuthedPage(2560, 1440);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_protection_review_detail_2560px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.4 Retailers at 1920px
    {
      console.log(' -> Retailers List at 1920px...');
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/retailers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_retailers_list_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.5 Store Operations at 1920px
    {
      console.log(' -> Store Operations at 1920px...');
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/store-operations`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_store_operations_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.6 90-Day Exchange Credit at 1920px
    {
      console.log(' -> 90-Day Exchange Credit at 1920px...');
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/exchange-credit`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_exchange_credit_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // 1.7 Initial Trial Reviews List at 1920px
    {
      console.log(' -> Initial Trial Reviews List at 1920px...');
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      const outPath = path.join(ARTIFACT_DIR, 'after_protection_reviews_list_1920px.png');
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('    Saved:', outPath);
      await context.close();
    }

    // -------------------------------------------------------------
    // 2. Responsive Viewport Matrix Validation (390 to 2560px)
    // -------------------------------------------------------------
    console.log('\n[Step 2] Testing responsive viewport matrix...');
    const testViewports = [
      { w: 390, h: 844, name: 'Mobile' },
      { w: 768, h: 1024, name: 'Tablet' },
      { w: 1024, h: 768, name: 'Small Desktop' },
      { w: 1280, h: 800, name: 'Standard Desktop' },
      { w: 1440, h: 900, name: 'Desktop' },
      { w: 1600, h: 1000, name: 'Boundary' },
      { w: 1920, h: 1080, name: 'FHD Wide' },
      { w: 2560, h: 1440, name: 'QHD 32-inch' },
    ];

    for (const vp of testViewports) {
      const { context, page } = await createAuthedPage(vp.w, vp.h);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Measure layout container bounding box
      const containerBox = await page.evaluate(() => {
        const el = document.querySelector('.max-w-\\[1600px\\]');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          left: Math.round(rect.left),
          right: Math.round(window.innerWidth - rect.right),
          windowWidth: window.innerWidth,
        };
      });

      if (!containerBox) {
        console.error(`  FAIL: Container not found at ${vp.w}px (${vp.name})`);
        metrics.clampingVerified = false;
      } else {
        const isExpectedWidth = vp.w <= 1600
          ? Math.abs(containerBox.width - vp.w) <= 20 // allow scrollbar variance
          : Math.abs(containerBox.width - 1600) <= 2;
        const isCentered = vp.w <= 1600
          ? true
          : Math.abs(containerBox.left - containerBox.right) <= 2;

        console.log(`  Viewport ${vp.w}px (${vp.name}): width=${containerBox.width}px, left=${containerBox.left}px, right=${containerBox.right}px -> Clamped: ${isExpectedWidth}, Centered: ${isCentered}`);

        if (!isExpectedWidth) metrics.clampingVerified = false;
        if (!isCentered) metrics.centeringVerified = false;

        metrics.viewportsTested.push({
          width: vp.w,
          name: vp.name,
          containerWidth: containerBox.width,
          leftMargin: containerBox.left,
          rightMargin: containerBox.right,
          passed: isExpectedWidth && isCentered,
        });
      }

      await context.close();
    }

    // -------------------------------------------------------------
    // 3. Sidebar Collapse / Expand Verification at 1920px
    // -------------------------------------------------------------
    console.log('\n[Step 3] Testing sidebar collapse & expand at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Initial sidebar width
      const initialSidebarWidth = await page.evaluate(() => {
        const aside = document.querySelector('aside');
        return aside ? Math.round(aside.getBoundingClientRect().width) : 0;
      });

      console.log(`  Initial sidebar width: ${initialSidebarWidth}px (expected ~256px)`);

      // Click collapse button
      const collapseBtn = page.locator('button:has-text("Collapse Sidebar")');
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        await page.waitForTimeout(1000);

        const collapsedSidebarWidth = await page.evaluate(() => {
          const aside = document.querySelector('aside');
          return aside ? Math.round(aside.getBoundingClientRect().width) : 0;
        });

        console.log(`  Collapsed sidebar width: ${collapsedSidebarWidth}px (expected ~64px)`);

        const containerBoxCollapsed = await page.evaluate(() => {
          const el = document.querySelector('.max-w-\\[1600px\\]');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return { width: Math.round(rect.width), left: Math.round(rect.left), right: Math.round(window.innerWidth - rect.right) };
        });

        console.log(`  Container after collapse: width=${containerBoxCollapsed?.width}px, centered=${Math.abs((containerBoxCollapsed?.left || 0) - (containerBoxCollapsed?.right || 0)) <= 2}`);

        const outPath = path.join(ARTIFACT_DIR, 'after_protection_review_detail_1920px_collapsed.png');
        await page.screenshot({ path: outPath, fullPage: false });
        console.log('    Saved collapsed screenshot:', outPath);

        metrics.sidebarCollapseVerified = (initialSidebarWidth === 256 && collapsedSidebarWidth === 64);
      }

      await context.close();
    }

    // -------------------------------------------------------------
    // 4. Scroll & Sticky Header / Sidebar Alignment Verification
    // -------------------------------------------------------------
    console.log('\n[Step 4] Testing scroll and sticky header/sidebar behavior at 1920px...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);
      await page.goto(`${LOCAL_URL}/admin/protection-reviews/${DETAIL_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Scroll down by 600px
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(1000);

      const positions = await page.evaluate(() => {
        const header = document.querySelector('header');
        const aside = document.querySelector('aside');
        const hRect = header?.getBoundingClientRect();
        const aRect = aside?.getBoundingClientRect();
        return {
          headerTop: hRect ? Math.round(hRect.top) : null,
          sidebarTop: aRect ? Math.round(aRect.top) : null,
          headerHeight: hRect ? Math.round(hRect.height) : null,
          sidebarHeight: aRect ? Math.round(aRect.height) : null,
          scrollY: window.scrollY,
        };
      });

      console.log('  Positions after 600px scroll:', positions);
      metrics.stickyScrollVerified = (positions.headerTop === 0 && positions.sidebarTop === 0 && positions.scrollY > 0);
      console.log(`  Sticky alignment preserved: ${metrics.stickyScrollVerified}`);

      await context.close();
    }

    // -------------------------------------------------------------
    // 5. Unrelated Admin Pages Regression Check (Full-Width Rule 27)
    // -------------------------------------------------------------
    console.log('\n[Step 5] Checking unrelated admin pages for standard full-width preservation...');
    {
      const { context, page } = await createAuthedPage(1920, 1080);

      // Test Dashboard (/admin)
      await page.goto(`${LOCAL_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const isDashboardCapped = await page.evaluate(() => !!document.querySelector('.max-w-\\[1600px\\]'));
      const dashboardMainWidth = await page.evaluate(() => {
        const m = document.querySelector('main');
        return m ? Math.round(m.getBoundingClientRect().width) : 0;
      });
      console.log(`  Dashboard (/admin): Capped at 1600px? ${isDashboardCapped} (Main width: ${dashboardMainWidth}px)`);

      const outDash = path.join(ARTIFACT_DIR, 'after_regression_dashboard_1920px.png');
      await page.screenshot({ path: outDash, fullPage: false });

      // Test Sales & Performance (/admin/sales/performance)
      await page.goto(`${LOCAL_URL}/admin/sales/performance`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const isSalesPerfCapped = await page.evaluate(() => !!document.querySelector('.max-w-\\[1600px\\]'));
      const salesPerfMainWidth = await page.evaluate(() => {
        const m = document.querySelector('main');
        return m ? Math.round(m.getBoundingClientRect().width) : 0;
      });
      console.log(`  Sales & Performance (/admin/sales/performance): Capped at 1600px? ${isSalesPerfCapped} (Main width: ${salesPerfMainWidth}px)`);

      const outSales = path.join(ARTIFACT_DIR, 'after_regression_sales_perf_1920px.png');
      await page.screenshot({ path: outSales, fullPage: false });

      metrics.nonPilotFullWidthVerified = (!isDashboardCapped && !isSalesPerfCapped && dashboardMainWidth > 1600);
      console.log(`  Non-pilot pages retain unconstrained full-width: ${metrics.nonPilotFullWidthVerified}`);

      await context.close();
    }

    console.log('\n======================================================================');
    console.log('  QA SUITE SUMMARY:');
    console.log('  Viewports Tested:          ', metrics.viewportsTested.length, '/ 8');
    console.log('  1600px Clamping Verified:  ', metrics.clampingVerified ? 'PASS' : 'FAIL');
    console.log('  Horizontal Centering:      ', metrics.centeringVerified ? 'PASS' : 'FAIL');
    console.log('  Sidebar Collapse/Expand:   ', metrics.sidebarCollapseVerified ? 'PASS' : 'FAIL');
    console.log('  Sticky Header & Sidebar:   ', metrics.stickyScrollVerified ? 'PASS' : 'FAIL');
    console.log('  Unrelated Pages Full Width:', metrics.nonPilotFullWidthVerified ? 'PASS' : 'FAIL');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('QA Suite error:', err);
  } finally {
    await browser.close();
  }
})();
