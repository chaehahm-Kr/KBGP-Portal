import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Mock server-only for standalone execution
try {
  const serverOnlyPath = require.resolve("server-only");
  (require.cache as any)[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    children: [],
    path: "",
    paths: [],
  };
} catch {}

async function runProdVerification() {
  console.log("================================================================================");
  console.log("PRODUCTION SMOKE & BROWSER QA: ADM-BSRC-008");
  console.log("Domains: https://admin.kselectnetwork.com & https://portal.kselectnetwork.com");
  console.log("Deployed SHA: eab01f557f4d53d2282a0613d978e270db314971");
  console.log("================================================================================\n");

  const artifactsDir = "C:\\Users\\ChaeHahm\\.gemini\\antigravity\\brain\\945ab025-0f8f-4fce-b0bc-56237108874e";
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const { generateUnsubscribeToken } = await import("../lib/brand-marketing/unsubscribe");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------------------
    // 1. ADMIN LOGIN PAGE ON PRODUCTION
    // -------------------------------------------------------------------------
    console.log("[Prod Step 1] Verifying Production Admin Login (https://admin.kselectnetwork.com/admin/login)...");
    const adminLoginRes = await page.goto("https://admin.kselectnetwork.com/admin/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    console.log(`   Admin Login HTTP Status: ${adminLoginRes?.status()}`);

    const shot01 = path.join(artifactsDir, "bsrc-008-prod-01-admin-login.png");
    await page.screenshot({ path: shot01, fullPage: false });
    console.log("   ✓ Saved Screenshot:", shot01);

    // -------------------------------------------------------------------------
    // 2. BRAND PORTAL LOGIN PAGE ON PRODUCTION
    // -------------------------------------------------------------------------
    console.log("\n[Prod Step 2] Verifying Production Brand Portal Login (https://portal.kselectnetwork.com/portal/login)...");
    const portalLoginRes = await page.goto("https://portal.kselectnetwork.com/portal/login", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    console.log(`   Brand Portal Login HTTP Status: ${portalLoginRes?.status()}`);

    const shot02 = path.join(artifactsDir, "bsrc-008-prod-02-portal-login.png");
    await page.screenshot({ path: shot02, fullPage: false });
    console.log("   ✓ Saved Screenshot:", shot02);

    // -------------------------------------------------------------------------
    // 3. PUBLIC ZERO-LOGIN UNSUBSCRIBE ROUTE ON PRODUCTION
    // -------------------------------------------------------------------------
    console.log("\n[Prod Step 3] Verifying Production Zero-Login Unsubscribe Route...");
    const sampleToken = generateUnsubscribeToken("partner-verification@example.com", "camp-prod-verify");
    const unsubUrl = `https://admin.kselectnetwork.com/unsubscribe?token=${encodeURIComponent(sampleToken)}`;

    // Zero-cookie incognito context
    const incognitoContext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const unsubPage = await incognitoContext.newPage();
    const unsubRes = await unsubPage.goto(unsubUrl, { waitUntil: "networkidle", timeout: 30000 });
    console.log(`   Unsubscribe Route HTTP Status: ${unsubRes?.status()}`);
    await unsubPage.waitForTimeout(1500);

    const shot03 = path.join(artifactsDir, "bsrc-008-prod-03-public-unsubscribe.png");
    await unsubPage.screenshot({ path: shot03, fullPage: false });
    console.log("   ✓ Saved Screenshot:", shot03);
    await incognitoContext.close();

    // -------------------------------------------------------------------------
    // 4. VERIFY DIAGNOSTICS DEPLOYMENT SHA FINGERPRINT
    // -------------------------------------------------------------------------
    console.log("\n[Prod Step 4] Verifying Live Diagnostics Fingerprint...");
    const adminDiagRes = await fetch("https://admin.kselectnetwork.com/api/diagnostics");
    const adminDiag = await adminDiagRes.json();
    console.log("   Admin Diagnostics Commit SHA:", adminDiag?.deployment?.commitSha);

    const portalDiagRes = await fetch("https://portal.kselectnetwork.com/api/diagnostics");
    const portalDiag = await portalDiagRes.json();
    console.log("   Portal Diagnostics Commit SHA:", portalDiag?.deployment?.commitSha);

    const expectedSha = process.env.EXPECTED_SHA || "d542a2fe1e4a67e89e765f1d4d83f2be88ffaa80";
    if (
      adminDiag?.deployment?.commitSha === expectedSha &&
      portalDiag?.deployment?.commitSha === expectedSha
    ) {
      console.log(`\n🎉 PRODUCTION DEPLOYMENT FINGERPRINT VERIFIED: 100% MATCH (${expectedSha})!`);
    } else {
      console.error(`\n❌ FINGERPRINT MISMATCH! Expected ${expectedSha}, got Admin: ${adminDiag?.deployment?.commitSha}, Portal: ${portalDiag?.deployment?.commitSha}`);
      process.exit(1);
    }

  } finally {
    await browser.close();
  }
}

runProdVerification().catch((err) => {
  console.error("Production verification error:", err);
  process.exit(1);
});
