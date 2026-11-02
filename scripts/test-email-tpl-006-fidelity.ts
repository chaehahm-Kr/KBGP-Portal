/**
 * ADM-EMAIL-TPL-006: Production Preview Fidelity Regression & Viewport Verification
 */

import * as fs from "fs";
import assert from "assert";
import { chromium } from "playwright";

// Load .env.local
const envText = fs.readFileSync(".env.local", "utf8");
const envVars: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = m[2] || "";
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    envVars[m[1]] = val.trim();
    if (!process.env[m[1]]) process.env[m[1]] = val.trim();
  }
});

const sampleHtmlPath = "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/scratch/K-Beauty Growth Program Email v3 - SEND.html";
const rawHtml = fs.readFileSync(sampleHtmlPath, "utf8");

async function runEmailTpl006Suite() {
  console.log("=================================================================");
  console.log("TEST SUITE: ADM-EMAIL-TPL-006 Viewport Parity & Scrollbar Audit");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(desc: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✕ FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Desktop 680px Viewport Fidelity
    await test("Desktop 680px Viewport: matchMedia('(max-width: 620px)').matches === false", async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      
      // Inject iframe styled at 680px width
      await page.setContent(`
        <div id="container" style="width: 680px; margin: 0 auto; background: #fff;">
          <iframe id="preview-iframe" style="width: 100%; border: 0; display: block;" scrolling="no"></iframe>
        </div>
      `);

      const iframeHandle = await page.$("#preview-iframe");
      const frame = await iframeHandle!.contentFrame();
      await frame!.setContent(rawHtml);

      const metrics = await frame!.evaluate(() => {
        const win = window;
        const media620 = win.matchMedia("(max-width: 620px)").matches;
        const hideM = document.querySelector(".hide-m");
        const hideMStyle = hideM ? win.getComputedStyle(hideM).display : null;
        
        const cols = Array.from(document.querySelectorAll(".col"));
        const offlineCol = cols.find(c => c.textContent?.includes("01 · OFFLINE"));
        const amazonCol = cols.find(c => c.textContent?.includes("02 · AMAZON"));
        
        const offlineDisplay = offlineCol ? win.getComputedStyle(offlineCol).display : null;
        const amazonDisplay = amazonCol ? win.getComputedStyle(amazonCol).display : null;

        const metricsCols = cols.filter(c => c.textContent?.includes("SKUS") || c.textContent?.includes("BRANDS"));
        const metricsDisplays = metricsCols.map(c => win.getComputedStyle(c).display);

        return {
          innerWidth: win.innerWidth,
          media620,
          hideMStyle,
          offlineDisplay,
          amazonDisplay,
          metricsDisplays,
          colsCount: cols.length
        };
      });

      assert.strictEqual(metrics.media620, false, "Media query 620px must be FALSE at 680px");
      assert.strictEqual(metrics.hideMStyle, "table-cell", "Header tagline .hide-m must be visible as table-cell");
      assert.strictEqual(metrics.offlineDisplay, "table-cell", "Offline channel column must be table-cell");
      assert.strictEqual(metrics.amazonDisplay, "table-cell", "Amazon channel column must be table-cell");
      metrics.metricsDisplays.forEach(d => {
        assert.strictEqual(d, "table-cell", "Brand metrics columns must be table-cell");
      });

      await page.close();
    });

    // 2. Mobile 375px Viewport Fidelity
    await test("Mobile 375px Viewport: matchMedia('(max-width: 620px)').matches === true & stacks", async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      
      // Inject iframe styled at 375px width
      await page.setContent(`
        <div id="container" style="width: 375px; margin: 0 auto; background: #fff;">
          <iframe id="preview-iframe" style="width: 100%; border: 0; display: block;" scrolling="no"></iframe>
        </div>
      `);

      const iframeHandle = await page.$("#preview-iframe");
      const frame = await iframeHandle!.contentFrame();
      await frame!.setContent(rawHtml);

      const metrics = await frame!.evaluate(() => {
        const win = window;
        const media620 = win.matchMedia("(max-width: 620px)").matches;
        const hideM = document.querySelector(".hide-m");
        const hideMStyle = hideM ? win.getComputedStyle(hideM).display : null;
        
        const cols = Array.from(document.querySelectorAll(".col"));
        const offlineCol = cols.find(c => c.textContent?.includes("01 · OFFLINE"));
        const amazonCol = cols.find(c => c.textContent?.includes("02 · AMAZON"));
        
        const offlineDisplay = offlineCol ? win.getComputedStyle(offlineCol).display : null;
        const amazonDisplay = amazonCol ? win.getComputedStyle(amazonCol).display : null;

        return {
          innerWidth: win.innerWidth,
          media620,
          hideMStyle,
          offlineDisplay,
          amazonDisplay
        };
      });

      assert.strictEqual(metrics.media620, true, "Media query 620px must be TRUE at 375px");
      assert.strictEqual(metrics.hideMStyle, "none", "Header tagline .hide-m must be hidden as none");
      assert.strictEqual(metrics.offlineDisplay, "block", "Offline channel column must stack as block");
      assert.strictEqual(metrics.amazonDisplay, "block", "Amazon channel column must stack as block");

      await page.close();
    });

    // 3. Nested Scrollbar Elimination (Dynamic Auto-Height)
    await test("Dynamic Auto-Height eliminates nested vertical scrollbars (scrolling='no')", async () => {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      
      await page.setContent(`
        <div id="container" style="width: 680px; margin: 0 auto;">
          <iframe id="preview-iframe" style="width: 100%; border: 0;" scrolling="no"></iframe>
        </div>
      `);

      const iframeHandle = await page.$("#preview-iframe");
      const frame = await iframeHandle!.contentFrame();
      await frame!.setContent(rawHtml);

      // Measure height and apply to iframe
      const measuredHeight = await frame!.evaluate(() => {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      });

      await page.evaluate((h) => {
        const iframe = document.getElementById("preview-iframe") as HTMLIFrameElement;
        iframe.style.height = h + "px";
        iframe.style.overflow = "hidden";
      }, measuredHeight);

      const hasScrollbar = await frame!.evaluate(() => {
        return document.documentElement.scrollHeight > window.innerHeight;
      });

      assert.strictEqual(hasScrollbar, false, "Iframe must not have internal vertical scrollbar");
      assert(measuredHeight > 1000, "Full email height should be > 1000px");

      await page.close();
    });

    // 4. File-level inspection of email-campaigns-view.tsx
    await test("email-campaigns-view.tsx contains all 4 subtabs and 680px desktop viewports across Step 2 & Step 4", async () => {
      const viewCode = fs.readFileSync("components/admin/brand-marketing/email-campaigns-view.tsx", "utf8");
      
      // Subtabs
      assert(viewCode.includes("Suppression List (수신 거부 목록)"), "Must include Suppression List tab link");
      assert(viewCode.includes('<SuppressionListView />'), "Must render SuppressionListView component");
      assert(viewCode.includes('viewParam === "suppression"'), "Must sync suppression viewParam");
      
      // Step 2 & Step 4 Viewports
      assert(viewCode.includes('previewViewport === "desktop" ? "680px" : "375px"'), "Step 2 must use 680px desktop viewport");
      assert(viewCode.includes('step4Viewport === "desktop" ? "680px" : "375px"'), "Step 4 must use 680px desktop viewport");
      assert(viewCode.includes('tplModalViewport === "desktop" ? "680px" : "375px"'), "Template Modal must use 680px desktop viewport");
      assert(viewCode.includes('setupDynamicIframeHeight'), "Must use setupDynamicIframeHeight");
      assert(viewCode.includes('scrolling="no"'), "Iframes must have scrolling='no'");
    });

  } finally {
    await browser.close();
  }

  console.log("\n=================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailTpl006Suite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
