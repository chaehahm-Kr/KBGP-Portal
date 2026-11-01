/**
 * ADM-EMAIL-TPL-005: Exact Send-Ready Email Preview Fidelity, QR Validation & Unsubscribe Safety Test
 */

// Mock server-only before imports
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as any;
} catch {}

import * as fs from "fs";
import assert from "assert";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

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

const {
  personalizeEmail,
  validateSendReadyHtml,
} = require("../lib/brand-marketing/personalization-engine");
const {
  assembleEmailWithMarketingFooter,
  DEFAULT_MARKETING_FOOTER,
} = require("../lib/brand-marketing/marketing-footer");
const {
  listMarketingSuppressionList,
} = require("../lib/brand-marketing/campaign-data-access");

async function runTests() {
  console.log("=================================================================");
  console.log("TEST SUITE: ADM-EMAIL-TPL-005 Preview Fidelity, QR & Preflight QA");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(desc: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✕ FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(desc: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✕ FAIL: ${desc} -> ${err.message}`);
      failed++;
    }
  }

  console.log("--- 1. Preflight Validation Engine Tests ---");

  test("Rejects unresolved required placeholder in subject as BLOCKING", () => {
    const html = "<p>Hello world</p>";
    const subject = "Partnership with {{company_name}} for {{UNRESOLVED_TOKEN}}";
    const res = validateSendReadyHtml(html, subject);
    assert.strictEqual(res.isValid, false, "Should be invalid due to blocking issue");
    assert(res.blockingCount >= 1, "Should have at least 1 blocking issue");
    const hasToken = res.issues.some((i: any) => i.token === "unresolved_token");
    assert(hasToken, "Should identify unresolved_token");
  });

  test("Rejects unresolved {{KAKAO_OPENCHAT_URL}} in HTML as BLOCKING", () => {
    const html = `<p>Connect with us:</p><a href="{{KAKAO_OPENCHAT_URL}}"><img src="https://admin.kselectnetwork.com/qr.png" /></a>`;
    const res = validateSendReadyHtml(html, "Subject");
    assert.strictEqual(res.isValid, false, "Should be invalid");
    const issue = res.issues.find((i: any) => i.token === "kakao_openchat_url");
    assert(issue, "Should flag kakao_openchat_url as BLOCKING");
    assert.strictEqual(issue?.severity, "BLOCKING");
  });

  test("Rejects local or invalid image origins (e.g. localhost, 127.0.0.1, file://) as BLOCKING", () => {
    const html = `<img src="http://localhost:3000/assets/logo.png" alt="Logo" /><p>Content</p>`;
    const res = validateSendReadyHtml(html, "Subject");
    assert.strictEqual(res.isValid, false);
    const issue = res.issues.find((i: any) => i.category === "IMAGE");
    assert(issue, "Should flag localhost image origin");
  });

  test("Flags dummy '#' href as WARNING (not blocking)", () => {
    const html = `<p>Test <a href="#">Click here</a></p>`;
    const res = validateSendReadyHtml(html, "Subject");
    const issue = res.issues.find((i: any) => i.category === "LINK" && i.severity === "WARNING");
    assert(issue, "Should flag '#' link as warning");
  });

  test("Passes clean send-ready HTML with 0 blocking issues", () => {
    const html = `<!DOCTYPE html><html><body>
      <p>Dear Valued Partner,</p>
      <a href="https://www.kselectnetwork.com">Learn more</a>
      <img src="https://admin.kselectnetwork.com/assets/logo.png" alt="Logo" />
      <p><a href="https://admin.kselectnetwork.com/unsubscribe?token=abc">수신거부</a></p>
    </body></html>`;
    const res = validateSendReadyHtml(html, "Official Partnership Notice");
    assert.strictEqual(res.isValid, true, "Clean HTML must pass preflight validation");
    assert.strictEqual(res.blockingCount, 0);
  });

  console.log("\n--- 2. Personalization Engine with Kakao & System Tokens ---");

  test("Resolves kakao_openchat_url, kakao_url, and kakao_qr_url", () => {
    const tpl = `<p>Chat: <a href="{{kakao_openchat_url}}">OpenChat</a> and QR: <img src="{{kakao_qr_url}}" /></p>`;
    const rendered = personalizeEmail("Subject", tpl, "", {
      companyName: "Amorepacific",
      kakaoOpenchatUrl: "https://open.kakao.com/o/sKSelectNetwork",
      kakaoQrUrl: "https://admin.kselectnetwork.com/assets/qr.png",
    });
    assert(rendered.html.includes("https://open.kakao.com/o/sKSelectNetwork"), "Should replace kakao_openchat_url");
    assert(rendered.html.includes("https://admin.kselectnetwork.com/assets/qr.png"), "Should replace kakao_qr_url");
    assert(!rendered.html.includes("{{kakao_openchat_url}}"), "Should leave no placeholder");
  });

  console.log("\n--- 3. Browser Viewport Fidelity Tests (Desktop 680px vs Mobile 375px) ---");

  await asyncTest("Desktop Viewport (680px) renders header tagline 'K-BEAUTY GROWTH PROGRAM' and two-column layout", async () => {
    const sampleHtmlPath = "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/scratch/K-Beauty Growth Program Email v3 - SEND.html";
    const rawHtml = fs.readFileSync(sampleHtmlPath, "utf8");

    const personalized = personalizeEmail(
      "[K SELECT] K-Beauty Growth Program 선정 제안",
      rawHtml,
      "",
      {
        companyName: "(주)아모레퍼시픽",
        contactName: "김대표",
        brandName: "라네즈",
        landingUrl: "https://www.kselectnetwork.com",
        kakaoOpenchatUrl: "https://open.kakao.com/o/sKSelectNetwork",
      }
    );

    const assembled = assembleEmailWithMarketingFooter(personalized.html, {
      footerSettings: DEFAULT_MARKETING_FOOTER,
      language: "ko",
      unsubscribeUrl: "https://admin.kselectnetwork.com/unsubscribe?token=sample-test-token",
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 680, height: 1000 } });
      const page = await context.newPage();
      await page.setContent(assembled, { waitUntil: "domcontentloaded" });

      // Check header tagline node (.hide-m)
      const taglineHandle = await page.$(".hide-m");
      assert(taglineHandle, "Tagline element .hide-m must exist in DOM");

      const display = await page.evaluate((el) => window.getComputedStyle(el).display, taglineHandle);
      const isVisible = await taglineHandle.isVisible();
      const text = (await page.evaluate((el) => el.textContent, taglineHandle)) || "";

      assert.strictEqual(display, "table-cell", "At 680px desktop, .hide-m display must be table-cell (NOT none)");
      assert.strictEqual(isVisible, true, "Tagline must be visible at 680px desktop");
      assert(text.includes("K-BEAUTY"), "Text must contain K-BEAUTY");
      assert(text.includes("GROWTH PROGRAM"), "Text must contain GROWTH PROGRAM");

      // Verify two-column layout (.col is table-cell, not block)
      const colHandle = await page.$(".col");
      if (colHandle) {
        const colDisplay = await page.evaluate((el) => window.getComputedStyle(el).display, colHandle);
        assert.strictEqual(colDisplay, "table-cell", "At 680px desktop, .col must be table-cell (side-by-side desktop layout)");
      }

      // Capture desktop evidence screenshot
      await page.screenshot({
        path: "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/adm-email-tpl-005-desktop-680-verified.png",
        fullPage: false,
      });

      await context.close();
    } finally {
      await browser.close();
    }
  });

  await asyncTest("Mobile Viewport (375px) hides .hide-m and triggers responsive single-column stacking", async () => {
    const sampleHtmlPath = "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/scratch/K-Beauty Growth Program Email v3 - SEND.html";
    const rawHtml = fs.readFileSync(sampleHtmlPath, "utf8");

    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
      const page = await context.newPage();
      await page.setContent(rawHtml, { waitUntil: "domcontentloaded" });

      const taglineHandle = await page.$(".hide-m");
      assert(taglineHandle, "Tagline element .hide-m must exist");

      const display = await page.evaluate((el) => window.getComputedStyle(el).display, taglineHandle);
      assert.strictEqual(display, "none", "At 375px mobile, .hide-m display must be none");

      // Verify columns stack to 100% block
      const colHandle = await page.$(".col");
      if (colHandle) {
        const colDisplay = await page.evaluate((el) => window.getComputedStyle(el).display, colHandle);
        assert.strictEqual(colDisplay, "block", "At 375px mobile, .col must be block (stacked mobile column)");
      }

      // Capture mobile evidence screenshot
      await page.screenshot({
        path: "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/adm-email-tpl-005-mobile-375-verified.png",
        fullPage: false,
      });

      await context.close();
    } finally {
      await browser.close();
    }
  });

  console.log("\n--- 4. Suppression List Admin Data Access Tests ---");

  await asyncTest("Queries authoritative suppression list without errors", async () => {
    const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);
    const res = await listMarketingSuppressionList(undefined, supabase);
    assert.strictEqual(res.success, true, "Should return success: true");
    assert(Array.isArray(res.suppressions), "Should return suppressions array");
    console.log(`    Found ${res.suppressions.length} suppression entries in authoritative DB.`);
  });

  await asyncTest("Filters suppression list by email search query", async () => {
    const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);
    const res = await listMarketingSuppressionList("brand-network.com", supabase);
    assert.strictEqual(res.success, true, "Search query should succeed");
    assert(res.suppressions.length >= 1, "Should find at least 1 match for brand-network.com");
    for (const item of res.suppressions) {
      assert(item.email.includes("brand-network.com"), "All results must match query");
    }
  });

  console.log("\n=================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
