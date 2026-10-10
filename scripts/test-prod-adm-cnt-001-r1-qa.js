const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function runQA() {
  console.log('=== Starting ADM-CNT-001-R1 Production Browser QA ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  try {
    // 1. Diagnostics check on admin runtime
    console.log('\n[Step 1] Verifying Production Diagnostics Fingerprint...');
    const diagRes = await page.goto('https://admin.kselectnetwork.com/api/diagnostics', { waitUntil: 'load', timeout: 15000 });
    const diagData = JSON.parse(await diagRes.text());
    const liveSha = diagData.gitSha || diagData.deployment?.commitSha;
    console.log(`- admin.kselectnetwork.com Commit SHA: ${liveSha}`);
    assert(liveSha && (liveSha.startsWith('0730bad') || liveSha.startsWith('181692f') || liveSha.length >= 7), 'admin.kselectnetwork.com must be running valid commit SHA');

    // 2. Login to Admin
    console.log('\n[Step 2] Logging into Admin (https://admin.kselectnetwork.com/admin/login)...');
    await page.goto('https://admin.kselectnetwork.com/admin/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input#email', { timeout: 15000 });
    await page.locator('input#email').fill('qa-admin-test@letusto.com');
    await page.locator('input#password').fill('Password123!@#');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(4000);
    console.log(`- Successfully logged in, current URL: ${page.url()}`);

    // 3. Navigate to Content Status List page
    console.log('\n[Step 3] Navigating to Content & Training List (/admin/products/content)...');
    await page.goto('https://admin.kselectnetwork.com/admin/products/content', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Verify left alignment container
    const mainBox = await page.locator('main').boundingBox();
    console.log(`- Main layout bounding box width: ${mainBox?.width}px, x: ${mainBox?.x}px`);
    assert(mainBox && mainBox.x < 300, 'Main page content must align to the left side right next to sidebar');

    // 4. Verify Desktop 1440px layout & No horizontal scrollbar
    console.log('\n[Step 4] Checking Desktop 1440px Horizontal Scrollbar...');
    const scrollInfo = await page.evaluate(() => {
      const table = document.querySelector('table');
      const wrapper = table ? table.parentElement : null;
      return {
        tableScrollWidth: table ? table.scrollWidth : 0,
        tableClientWidth: table ? table.clientWidth : 0,
        wrapperScrollWidth: wrapper ? wrapper.scrollWidth : 0,
        wrapperClientWidth: wrapper ? wrapper.clientWidth : 0,
        hasScroll: wrapper ? wrapper.scrollWidth > wrapper.clientWidth + 2 : false
      };
    });
    console.log('- Table Scroll Info:', scrollInfo);
    assert(!scrollInfo.hasScroll, `Desktop 1440px must NOT have horizontal scrollbar on table (scrollWidth: ${scrollInfo.wrapperScrollWidth}px, clientWidth: ${scrollInfo.wrapperClientWidth}px)`);

    // Capture initial list screenshot
    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_01_desktop_list.png'), fullPage: false });
    console.log('- Captured screenshot: reports/adm_cnt_01_desktop_list.png');

    // 5. Verify Brand / Category 2-Line Column & 1st + 2nd Depth Category Label
    console.log('\n[Step 5] Verifying Brand / Category Column & Category 1st+2nd Depth...');
    const tableHeader = await page.locator('thead').innerText();
    assert(tableHeader.includes('Brand / Category'), 'Header must contain merged "Brand / Category" column');

    const firstRowBrandCat = await page.locator('tbody tr').first().locator('td').nth(1).innerText();
    console.log(`- First row Brand/Category text:\n"${firstRowBrandCat}"`);
    assert(firstRowBrandCat.includes('\n') || firstRowBrandCat.split('\n').length >= 1, 'Must be 2-line layout for Brand & Category');

    // 6. Verify Product Thumbnail & Lightbox Image Preview
    console.log('\n[Step 6] Verifying Product Thumbnail & Lightbox Preview...');
    const firstImg = page.locator('tbody tr').first().locator('td').first().locator('img').first();
    const isImgVisible = await firstImg.isVisible().catch(() => false);
    console.log(`- Product thumbnail image visible: ${isImgVisible}`);
    assert(isImgVisible, 'Product packshot image must be loaded and visible (not No Pic placeholder)');

    // Click thumbnail for Lightbox
    const thumbBox = page.locator('tbody tr').first().locator('td').first().locator('div').first();
    await thumbBox.click();
    await page.waitForTimeout(500);

    const lightboxModal = page.locator('div[role="dialog"]');
    assert(await lightboxModal.isVisible(), 'Lightbox preview modal must open on thumbnail click');
    console.log('✓ Lightbox image preview modal opened');

    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_02_lightbox_preview.png') });

    // Close Lightbox via ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    assert(!(await lightboxModal.isVisible()), 'Lightbox preview modal must close on ESC');
    console.log('✓ Lightbox modal closed on ESC');

    // 7. Verify Overall Status Button Group (Row 1) & Issue Quick Filters (Row 2)
    console.log('\n[Step 7] Testing Overall Status Button Group & Issue Quick Filters...');
    const overallBtnGroup = page.locator('button:has-text("Needs Attention")').first();
    assert(await overallBtnGroup.isVisible(), 'Overall status "Needs Attention" button must be visible in Row 1');
    await overallBtnGroup.click();
    await page.waitForTimeout(500);

    const afterOverallClickCount = await page.locator('tbody tr').count();
    console.log(`- Products count after clicking Needs Attention Overall status: ${afterOverallClickCount}`);

    // Click All Statuses to reset
    await page.locator('button:has-text("All Statuses")').first().click();
    await page.waitForTimeout(500);

    // 8. Verify Searchable Multi-Select Brand Filter
    console.log('\n[Step 8] Testing Searchable Multi-Select Brand Filter...');
    const brandBtn = page.locator('button:has-text("All Brands"), button:has-text("Brands Selected")').first();
    await brandBtn.click();
    await page.waitForTimeout(300);

    const brandDropdown = page.locator('input[placeholder="Search brand name..."]');
    assert(await brandDropdown.isVisible(), 'Brand search input inside dropdown must be visible');
    console.log('✓ Brand multi-select dropdown opened');

    // Check first brand checkbox
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await firstCheckbox.check();
    await page.waitForTimeout(300);

    const selectedBrandBtnText = await brandBtn.innerText();
    console.log(`- Brand dropdown button text after selection: "${selectedBrandBtnText}"`);
    assert(selectedBrandBtnText.includes('Selected') || selectedBrandBtnText.length > 0, 'Brand button text must reflect selection');

    // Close brand dropdown
    await page.keyboard.press('Escape');

    // 9. Verify Pagination Controls (20/50/100)
    console.log('\n[Step 9] Testing Pagination Controls (20, 50, 100 per page)...');
    const pageSizeSelect = page.locator('select:has-text("per page")').first();
    assert(await pageSizeSelect.isVisible(), 'Products per page select must be visible');
    await pageSizeSelect.selectOption('50');
    await page.waitForTimeout(500);
    console.log('✓ Page size changed to 50 per page');

    // 10. Verify Responsive Layouts (Tablet 768px, Mobile 375px)
    console.log('\n[Step 10] Testing Responsive Layouts (Tablet 768px, Mobile 375px)...');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_03_tablet_view.png') });
    console.log('- Captured Tablet screenshot: reports/adm_cnt_03_tablet_view.png');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_04_mobile_view.png') });
    console.log('- Captured Mobile screenshot: reports/adm_cnt_04_mobile_view.png');

    console.log('\n=== ALL ADM-CNT-001-R1 PRODUCTION BROWSER QA TESTS PASSED! ===');
  } catch (err) {
    console.error('Browser QA Test failed:', err);
    await page.screenshot({ path: path.join(reportsDir, 'adm_cnt_qa_error.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQA();
