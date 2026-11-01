/**
 * ADM-EMAIL-TPL-001: Verification Test Suite
 * End-to-End Email Delivery Fidelity & Template Manager Redesign
 */

// Bypass server-only guard for standalone script runner
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as any;
} catch {}

// Set environment variables before any module loads
process.env.NEXT_PUBLIC_ADMIN_URL = "https://admin.kselectnetwork.com";
process.env.NEXT_PUBLIC_SITE_URL = "https://admin.kselectnetwork.com";

const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const { importZipPackage } = require("../lib/brand-marketing/package-importer");
const { personalizeEmail } = require("../lib/brand-marketing/personalization-engine");
const {
  assembleEmailWithMarketingFooter,
  DEFAULT_MARKETING_FOOTER,
} = require("../lib/brand-marketing/marketing-footer");
const { sanitizeEmailHtml } = require("../lib/brand-marketing/template-parser");

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failCount++;
  }
}

async function runTests() {
  console.log("===============================================================");
  console.log("TEST SUITE: ADM-EMAIL-TPL-001 Email Fidelity & Template Manager");
  console.log("===============================================================\n");

  // TEST 1: Authoritative SEND File Selection in ZIP Packages
  console.log("Test Group 1: Authoritative Template Selection in Importer");
  {
    const zip = new JSZip();
    zip.file("Email Preview.dc.html", "<html><body>Design Canvas Preview (Do Not Send)</body></html>");
    zip.file("email/K-Beauty Growth Program Email v3 - LINK MAP.html", "<html><body>Link Map Preview</body></html>");
    zip.file("email/K-Beauty Growth Program Email v3.html", "<html><body>Local Browser Preview v3</body></html>");
    zip.file(
      "email/K-Beauty Growth Program Email v3 - SEND.html",
      `<!DOCTYPE html><html><head><style>@media only screen and (max-width:620px){.col{width:100%!important;}}</style></head>
      <body><a href="{{LANDING_URL}}?utm_source=email">Click</a><img src="{{IMAGE_HOST}}/kbgp/ksn-logo.png"></body></html>`
    );
    zip.file("email/assets/ksn-logo.png", Buffer.from("fake-png-data"));

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const res = await importZipPackage(zipBuffer, "test-tpl-001");

    assert(res.isValid, "ZIP package is valid");
    assert(
      res.selectedHtmlFile === "email/K-Beauty Growth Program Email v3 - SEND.html",
      `Selected file is authoritative SEND-ready file (got: "${res.selectedHtmlFile}")`
    );
    assert(res.htmlContent.includes("Click"), "HTML content contains expected body text");
    assert(
      res.htmlContent.includes("@media only screen and (max-width:620px)"),
      "Responsive CSS media query is preserved"
    );
  }

  // TEST 2: HTML Sanitization & MSO / Media Query Preservation
  console.log("\nTest Group 2: Sanitization Fidelity & MSO Preservation");
  {
    const rawWithDanger = `
      <!--[if mso]><table width="600"><tr><td>MSO Word Engine Table</td></tr></table><![endif]-->
      <!--[if mso]><v:rect href="https://example.com" fillcolor="#7A1F2B"><center>CTA Button</center></v:rect><![endif]-->
      <style>@media only screen and (max-width:620px){.wrap{width:100%!important;}}</style>
      <script>window.location='https://attacker.com';</script>
      <div onclick="evil()">Safe Container</div>
      <a href="javascript:alert(1)">Unsafe Link</a>
    `;

    const sanitized = sanitizeEmailHtml(rawWithDanger);
    assert(!sanitized.includes("<script"), "Stripped <script> tag");
    assert(!sanitized.includes("attacker.com"), "Stripped script body");
    assert(!sanitized.includes('onclick="evil()"'), "Stripped onclick attribute");
    assert(!sanitized.includes('href="javascript:'), "Stripped javascript: URL");
    assert(sanitized.includes("<!--[if mso]>"), "Preserved MSO conditional comment");
    assert(sanitized.includes("<v:rect"), "Preserved Outlook VML rectangle CTA button");
    assert(sanitized.includes("MSO Word Engine Table"), "Preserved MSO table contents");
    assert(sanitized.includes("@media only screen and (max-width:620px)"), "Preserved mobile media query");
  }

  // TEST 3: Personalization Case-Insensitivity & ESP Merge Tag Resolution
  console.log("\nTest Group 3: Case-Insensitive Personalization & Merge Tags");
  {
    const templateHtml = `
      <p>안녕하세요 {{COMPANY_NAME}} {{CONTACT_NAME}}님</p>
      <p>귀사 브랜드: {{BRAND_NAME}}</p>
      <p>메시지: {{CUSTOM_MESSAGE}}</p>
      <a href="{{LANDING_URL}}?utm_content=hero_cta">파트너십 신청하기</a>
    `;

    const personalized = personalizeEmail(
      "{{COMPANY_NAME}} K-Beauty Growth Program 선정 제안",
      templateHtml,
      undefined,
      {
        companyName: "아이소이 (isoi)",
        contactName: "이진수 이사",
        brandName: "isoi",
        customMessage: "미국 10개 매장 및 Amazon 진출 파트너십",
        landingUrl: "https://www.kselectnetwork.com",
      }
    );

    assert(
      personalized.subject === "아이소이 (isoi) K-Beauty Growth Program 선정 제안",
      `Subject personalized correctly: "${personalized.subject}"`
    );
    assert(personalized.html.includes("안녕하세요 아이소이 (isoi) 이진수 이사님"), "Resolved {{COMPANY_NAME}} & {{CONTACT_NAME}}");
    assert(personalized.html.includes("귀사 브랜드: isoi"), "Resolved {{BRAND_NAME}}");
    assert(personalized.html.includes("메시지: 미국 10개 매장 및 Amazon 진출 파트너십"), "Resolved {{CUSTOM_MESSAGE}}");
    assert(personalized.html.includes("https://www.kselectnetwork.com?utm_content=hero_cta"), "Resolved {{LANDING_URL}}");
    assert(personalized.unresolvedPlaceholders.length === 0, `Zero unresolved placeholders (got: ${JSON.stringify(personalized.unresolvedPlaceholders)})`);
  }

  // TEST 4: Full Assembly with Central Marketing Footer & Tokenized Unsubscribe
  console.log("\nTest Group 4: Central Marketing Footer Assembly & Unsubscribe Token");
  {
    const baseHtml = `<!DOCTYPE html><html><body><h1>Header</h1><p>Body</p></body></html>`;
    const testUnsubUrl = "https://admin.kselectnetwork.com/unsubscribe?token=verified_token_999";

    const assembled = assembleEmailWithMarketingFooter(baseHtml, {
      footerSettings: DEFAULT_MARKETING_FOOTER,
      language: "ko",
      unsubscribeUrl: testUnsubUrl,
      landingPageUrl: "https://www.kselectnetwork.com",
      previewText: "미국 10개 파트너 매장 런칭",
    });

    assert(assembled.includes("<!-- MARKETING_FOOTER_START -->"), "Assembled marketing footer start marker");
    assert(assembled.includes("<!-- MARKETING_FOOTER_END -->"), "Assembled marketing footer end marker");
    assert(assembled.includes(testUnsubUrl), "Included tokenized unsubscribe URL in footer");
    assert(assembled.includes("23B Roland Ave., Mount Laurel, NJ 08054, USA"), "Included physical business address in footer");
    assert(assembled.includes("K SELECT NETWORK"), "Included brand display name in footer");
    assert(assembled.includes("PREHEADER PREVIEW TEXT"), "Injected preheader preview text snippet");
  }

  // TEST 5: Real Authoritative SEND File Verification
  console.log("\nTest Group 5: Authoritative SEND File End-to-End Pipeline Fidelity");
  {
    const scratchSendPath = "C:/Users/ChaeHahm/.gemini/antigravity/brain/60393d8e-2782-4539-8c9d-c53f4b39baf6/scratch/K-Beauty Growth Program Email v3 - SEND.html";
    if (fs.existsSync(scratchSendPath)) {
      const sendHtml = fs.readFileSync(scratchSendPath, "utf-8");

      const sanitized = sanitizeEmailHtml(sendHtml);
      assert(sanitized.length === sendHtml.length, "Sanitization had 0 unexpected byte drop");

      const personalized = personalizeEmail(
        "{{COMPANY_NAME}} K-Beauty Growth Program 제안서",
        sanitized,
        undefined,
        {
          companyName: "아이소이 (isoi)",
          contactName: "이진수 이사",
          brandName: "isoi",
          landingUrl: "https://www.kselectnetwork.com",
        }
      );

      const assembled = assembleEmailWithMarketingFooter(personalized.html, {
        footerSettings: DEFAULT_MARKETING_FOOTER,
        language: "ko",
        unsubscribeUrl: "https://admin.kselectnetwork.com/unsubscribe?token=demo_tok_123",
        landingPageUrl: "https://www.kselectnetwork.com",
      });

      assert(!assembled.includes("{{LANDING_URL}}"), "All {{LANDING_URL}} instances replaced");
      assert(!assembled.includes("{{IMAGE_HOST}}"), "All {{IMAGE_HOST}} instances replaced");
      assert(assembled.includes("v:rect"), "Outlook VML CTA preserved");
      assert(assembled.includes("@media only screen and (max-width:620px)"), "Mobile media queries preserved");
    } else {
      console.log("  (Scratch SEND file not present at path, skipping local scratch load)");
    }
  }

  console.log("\n===============================================================");
  console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("===============================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw error:", err);
  process.exit(1);
});
