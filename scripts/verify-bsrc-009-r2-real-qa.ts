import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

// Load QA environment
const content = fs.readFileSync(".env.qa.local", "utf8");
const lines = content.split(/\r?\n/);
let qaDbUrl = "";
let qaUrl = "";
let qaSecretKey = "";
let qaAnonKey = "";

for (const line of lines) {
  if (line.startsWith("QA_DATABASE_URL=")) {
    qaDbUrl = line.substring("QA_DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
  } else if (line.startsWith("QA_SUPABASE_URL=")) {
    qaUrl = line.substring("QA_SUPABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
  } else if (line.startsWith("QA_SECRET_KEY=") || line.startsWith("QA_SUPABASE_SECRET_KEY=")) {
    qaSecretKey = line.substring(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
  } else if (line.startsWith("QA_SUPABASE_PUBLISHABLE_KEY=") || line.startsWith("QA_SUPABASE_ANON_KEY=")) {
    qaAnonKey = line.substring(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

if (!qaDbUrl || qaDbUrl.includes("shzfrppdobpmrstcjfqu")) {
  console.error("❌ FATAL: QA_DATABASE_URL invalid or targeting production! Aborting immediately.");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runQaVerification() {
  console.log("================================================================================");
  console.log("ADM-BSRC-009-R2: REAL QA DATABASE VERIFICATION & AUDIT SUITE");
  console.log("Target Database: QA Supabase (elkgizqgksshukxgcndy)");
  console.log("================================================================================\n");

  const pgClient = new Client({
    connectionString: qaDbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await pgClient.connect();
  console.log("Connected to QA PostgreSQL database successfully.\n");

  const adminSupabase = createClient(qaUrl, qaSecretKey);
  const anonSupabase = createClient(qaUrl, qaAnonKey);

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Apply Migration 0188 to QA Database
    // -------------------------------------------------------------------------
    console.log("--- STEP 1: APPLY MIGRATION 0188 TO QA DATABASE ---");
    const migrationSql = fs.readFileSync("supabase/migrations/0188_marketing_footer_and_assets.sql", "utf8");
    await pgClient.query(migrationSql);
    console.log("Applied supabase/migrations/0188_marketing_footer_and_assets.sql successfully.\n");

    // -------------------------------------------------------------------------
    // STEP 2: Verify Schema and Columns
    // -------------------------------------------------------------------------
    console.log("--- STEP 2: SCHEMA & COLUMN VERIFICATION ---");
    const tableRes = await pgClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('marketing_footer_settings', 'marketing_template_assets');
    `);
    const tables = tableRes.rows.map((r: any) => r.table_name);
    assert(tables.includes("marketing_footer_settings"), "Table 'marketing_footer_settings' exists");
    assert(tables.includes("marketing_template_assets"), "Table 'marketing_template_assets' exists");

    const campCols = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'marketing_campaigns' AND column_name IN ('preview_text', 'landing_page_url');
    `);
    const colNames = campCols.rows.map((r: any) => r.column_name);
    assert(colNames.includes("preview_text"), "Column 'marketing_campaigns.preview_text' exists");
    assert(colNames.includes("landing_page_url"), "Column 'marketing_campaigns.landing_page_url' exists");

    // -------------------------------------------------------------------------
    // STEP 3: Verify Official Footer Seed & Non-Destructive Idempotency
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3: OFFICIAL SEED & NON-DESTRUCTIVE IDEMPOTENCY ---");
    const seedRes = await pgClient.query(`
      SELECT * FROM public.marketing_footer_settings WHERE id = 'central_marketing_footer';
    `);
    assert(seedRes.rows.length === 1, "Singleton footer settings row exists");
    const footer = seedRes.rows[0];
    assert(footer.brand_display_name === "K SELECT NETWORK", "Seed brand_display_name is 'K SELECT NETWORK'");
    assert(footer.legal_company_name === "Operated by Letusto Inc.", "Seed legal_company_name is 'Operated by Letusto Inc.'");
    assert(footer.physical_address === "23B Roland Ave., Mount Laurel, NJ 08054, USA", "Seed address is '23B Roland Ave., Mount Laurel, NJ 08054, USA'");
    assert(footer.contact_email === "Contact@letusto.com", "Seed email is 'Contact@letusto.com'");
    assert(footer.contact_website === "https://www.kselectnetwork.com", "Seed website is 'https://www.kselectnetwork.com'");
    assert(footer.default_language === "ko", "Seed default_language is 'ko'");

    // Test Idempotency: Change a value, re-run migration, verify it does NOT overwrite
    console.log("\nTesting non-destructive idempotency (ON CONFLICT DO NOTHING)...");
    await pgClient.query(`
      UPDATE public.marketing_footer_settings 
      SET contact_email = 'custom-owner-modified@letusto.com' 
      WHERE id = 'central_marketing_footer';
    `);

    // Re-apply migration 0188
    await pgClient.query(migrationSql);

    const recheckRes = await pgClient.query(`
      SELECT contact_email FROM public.marketing_footer_settings WHERE id = 'central_marketing_footer';
    `);
    assert(
      recheckRes.rows[0].contact_email === "custom-owner-modified@letusto.com",
      "Repeat migration execution preserved custom-owner-modified@letusto.com (zero overwrite)"
    );

    // Restore official email
    await pgClient.query(`
      UPDATE public.marketing_footer_settings 
      SET contact_email = 'Contact@letusto.com' 
      WHERE id = 'central_marketing_footer';
    `);
    console.log("Restored contact_email to 'Contact@letusto.com'.\n");

    // -------------------------------------------------------------------------
    // STEP 4: Table Privileges and RLS Enforcement
    // -------------------------------------------------------------------------
    console.log("--- STEP 4: TABLE PRIVILEGES & RLS ENFORCEMENT ---");

    // 4.1 Anon role test via raw SQL
    await pgClient.query("BEGIN;");
    await pgClient.query("SET LOCAL ROLE anon;");
    let anonSelectBlocked = false;
    try {
      await pgClient.query("SELECT * FROM public.marketing_footer_settings;");
    } catch (err: any) {
      anonSelectBlocked = err.message.includes("permission denied");
    }
    assert(anonSelectBlocked, "Anon role raw SQL SELECT is blocked with permission denied");
    await pgClient.query("ROLLBACK;");

    await pgClient.query("BEGIN;");
    await pgClient.query("SET LOCAL ROLE anon;");
    let anonUpdateBlocked = false;
    try {
      await pgClient.query("UPDATE public.marketing_footer_settings SET brand_display_name = 'Hacked';");
    } catch (err: any) {
      anonUpdateBlocked = err.message.includes("permission denied");
    }
    assert(anonUpdateBlocked, "Anon role raw SQL UPDATE is blocked with permission denied");
    await pgClient.query("ROLLBACK;");

    // 4.2 Anon role test via Supabase JS client
    const { data: anonData, error: anonErr } = await anonSupabase
      .from("marketing_footer_settings")
      .select("*")
      .eq("id", "central_marketing_footer");
    assert(
      Boolean(anonErr && anonErr.message.includes("permission denied")),
      "Anon Supabase JS client SELECT blocked with permission denied"
    );

    // 4.3 Non-admin Authenticated role test (Retailer user: 00000000-0000-4000-c000-000000000003)
    await pgClient.query("BEGIN;");
    await pgClient.query("SET LOCAL ROLE authenticated;");
    await pgClient.query("SET LOCAL \"request.jwt.claim.sub\" = '00000000-0000-4000-c000-000000000003';");

    let nonAdminSelectAllowed = false;
    try {
      const res = await pgClient.query("SELECT id, brand_display_name FROM public.marketing_footer_settings;");
      nonAdminSelectAllowed = res.rows.length === 1;
    } catch {}
    assert(nonAdminSelectAllowed, "Non-admin authenticated user CAN SELECT footer settings (read allowed)");

    let nonAdminUpdateBlocked = false;
    try {
      const res = await pgClient.query("UPDATE public.marketing_footer_settings SET brand_display_name = 'NonAdminHacked';");
      nonAdminUpdateBlocked = res.rowCount === 0;
    } catch (err: any) {
      nonAdminUpdateBlocked = err.message.includes("violates row-level security") || err.message.includes("permission denied");
    }
    const checkUpdate = await pgClient.query("SELECT brand_display_name FROM public.marketing_footer_settings;");
    const nonAdminDidNotMutate = checkUpdate.rows[0].brand_display_name !== "NonAdminHacked";
    assert(
      nonAdminUpdateBlocked && nonAdminDidNotMutate,
      "Non-admin authenticated user CANNOT update footer settings (RLS blocked mutation)"
    );
    await pgClient.query("ROLLBACK;");

    // 4.4 Admin Authenticated role test (Admin user: 00000000-0000-4000-c000-000000000001)
    await pgClient.query("BEGIN;");
    await pgClient.query("SET LOCAL ROLE authenticated;");
    await pgClient.query("SET LOCAL \"request.jwt.claim.sub\" = '00000000-0000-4000-c000-000000000001';");

    let adminUpdateAllowed = false;
    try {
      const updateRes = await pgClient.query(`
        UPDATE public.marketing_footer_settings 
        SET brand_display_name = 'K SELECT NETWORK — Verified Admin' 
        WHERE id = 'central_marketing_footer';
      `);
      const checkAdmin = await pgClient.query("SELECT brand_display_name FROM public.marketing_footer_settings;");
      adminUpdateAllowed = checkAdmin.rows[0].brand_display_name === "K SELECT NETWORK — Verified Admin";
    } catch (err: any) {
      console.error("Admin update error:", err);
    }
    assert(adminUpdateAllowed, "Admin authenticated user CAN update footer settings (RLS allowed)");
    await pgClient.query("ROLLBACK;");

    // -------------------------------------------------------------------------
    // STEP 5: End-to-End DAL Verification (Supabase JS Admin Client)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5: APPLICATION DAL VERIFICATION ---");
    // Verify admin client reads settings
    const { data: adminRead, error: readErr } = await adminSupabase
      .from("marketing_footer_settings")
      .select("*")
      .eq("id", "central_marketing_footer")
      .single();
    assert(!readErr && Boolean(adminRead), "Admin Supabase JS client successfully loaded footer settings");

    // Test upsert via admin client
    const testUpdatedAddress = "23B Roland Ave., Mount Laurel, NJ 08054, USA (Verified)";
    const { error: upsertErr } = await adminSupabase
      .from("marketing_footer_settings")
      .upsert({
        id: "central_marketing_footer",
        ...adminRead,
        physical_address: testUpdatedAddress,
        updated_at: new Date().toISOString(),
      });
    assert(!upsertErr, "Admin Supabase JS client successfully executed upsert on footer settings");

    // Confirm persisted value
    const { data: checkPersisted } = await adminSupabase
      .from("marketing_footer_settings")
      .select("physical_address")
      .eq("id", "central_marketing_footer")
      .single();
    assert(
      checkPersisted?.physical_address === testUpdatedAddress,
      "Updated physical address persisted and reloaded from QA DB"
    );

    // Revert to official address
    await adminSupabase.from("marketing_footer_settings").upsert({
      id: "central_marketing_footer",
      ...adminRead,
      physical_address: "23B Roland Ave., Mount Laurel, NJ 08054, USA",
      updated_at: new Date().toISOString(),
    });
    console.log("Restored official physical address in QA DB.\n");

    // -------------------------------------------------------------------------
    // STEP 6: Unsubscribe Opt-Out Persistence in QA DB
    // -------------------------------------------------------------------------
    console.log("--- STEP 6: UNSUBSCRIBE & SUPPRESSION PERSISTENCE IN QA DB ---");
    const testEmail = "test-r2-suppression-qa@example.com";

    // Clean up any leftover
    await pgClient.query("DELETE FROM public.marketing_suppression_list WHERE email = $1;", [testEmail]);

    // Insert suppression record via Supabase Admin Client
    const { error: suppInsertErr } = await adminSupabase
      .from("marketing_suppression_list")
      .insert({
        email: testEmail,
        reason: "UNSUBSCRIBED",
        notes: "ADM-BSRC-009-R2 QA Verification Suite",
        suppressed_at: new Date().toISOString(),
        created_by: "system:test_suite",
      });
    assert(!suppInsertErr, "Suppression row inserted into QA DB via Admin Supabase client");

    // Verify record exists in DB
    const suppCheck = await pgClient.query(
      "SELECT id, email, reason FROM public.marketing_suppression_list WHERE email = $1;",
      [testEmail]
    );
    assert(suppCheck.rows.length === 1, "Suppression row verified in QA DB table");
    assert(suppCheck.rows[0].email === testEmail, "Email stored normalized in QA DB");
    assert(suppCheck.rows[0].reason === "UNSUBSCRIBED", "Reason stored as UNSUBSCRIBED");

    // Test unique constraint on duplicate
    const { error: dupErr } = await adminSupabase
      .from("marketing_suppression_list")
      .insert({
        email: testEmail,
        reason: "UNSUBSCRIBED",
        notes: "Duplicate attempt",
      });
    assert(
      Boolean(dupErr && (dupErr.code === "23505" || dupErr.message.includes("unique"))),
      "Duplicate suppression insert rejected by unique constraint"
    );

    // Clean up test record and any previous uppercase test remnants
    await pgClient.query("DELETE FROM public.marketing_suppression_list WHERE email ILIKE '%suppression%' OR email ILIKE '%uppercase%';");

    // Test automatic normalization trigger: inserting uppercase stores as lowercase
    const upperRes = await pgClient.query(`
      INSERT INTO public.marketing_suppression_list (
        id, email, reason, notes, suppressed_at, created_by
      ) VALUES (
        gen_random_uuid(), 'UPPERCASE_TEST_AUTO_NORM@EXAMPLE.COM', 'UNSUBSCRIBED', 'Case QA Test', now(), 'system:test_suite'
      ) RETURNING email;
    `);
    assert(
      upperRes.rows[0].email === "uppercase_test_auto_norm@example.com",
      "DB trigger trg_normalize_suppression_email automatically normalized uppercase email to lowercase"
    );

    // Test case-insensitive duplicate rejection
    let duplicateCaseRejected = false;
    try {
      await pgClient.query(`
        INSERT INTO public.marketing_suppression_list (
          id, email, reason, notes, suppressed_at, created_by
        ) VALUES (
          gen_random_uuid(), 'Uppercase_Test_Auto_Norm@example.com', 'UNSUBSCRIBED', 'Mixed case duplicate', now(), 'system:test_suite'
        );
      `);
    } catch (err: any) {
      duplicateCaseRejected = err.code === "23505";
    }
    assert(
      duplicateCaseRejected,
      "Mixed-case duplicate insert rejected by unique constraint (23505) via normalized email"
    );

    // Clean up test record
    await pgClient.query("DELETE FROM public.marketing_suppression_list WHERE email ILIKE '%suppression%' OR email ILIKE '%uppercase%';");
    console.log("Cleaned up test suppression records from QA DB.\n");

    // -------------------------------------------------------------------------
    // STEP 7: Template Assets Registry and Foreign Key Constraints
    // -------------------------------------------------------------------------
    console.log("--- STEP 7: TEMPLATE ASSETS REGISTRY & INTEGRITY ---");
    const fakeTemplateId = "11111111-2222-3333-4444-555555555555";

    // Insert temporary test template
    await pgClient.query(`
      INSERT INTO public.marketing_templates (
        id, name, subject, version, language, template_type, html_content, status, created_at, updated_at
      ) VALUES (
        $1, 'QA Test Template For Assets', 'Test Subject', '1.0', 'ko', 'HTML', '<p>Test</p>', 'ACTIVE', now(), now()
      ) ON CONFLICT (id) DO NOTHING;
    `, [fakeTemplateId]);

    // Insert asset linked to template
    const assetId = "22222222-3333-4444-5555-666666666666";
    await pgClient.query(`
      INSERT INTO public.marketing_template_assets (
        id, template_id, original_filename, storage_path, public_url, content_type, byte_size
      ) VALUES (
        $1, $2, 'hero-banner.png', 'marketing/qa-test/hero-banner.png', '/api/marketing/assets/qa-test/hero-banner.png', 'image/png', 1024
      );
    `, [assetId, fakeTemplateId]);

    const assetCheck = await pgClient.query(
      "SELECT id, original_filename, public_url FROM public.marketing_template_assets WHERE id = $1;",
      [assetId]
    );
    assert(assetCheck.rows.length === 1, "Template asset record created in QA DB");
    assert(assetCheck.rows[0].public_url === "/api/marketing/assets/qa-test/hero-banner.png", "Asset public_url matches standard route");

    // Test Cascade Delete: deleting template cascades to assets
    await pgClient.query("DELETE FROM public.marketing_templates WHERE id = $1;", [fakeTemplateId]);
    const assetAfterDelete = await pgClient.query(
      "SELECT id FROM public.marketing_template_assets WHERE id = $1;",
      [assetId]
    );
    assert(assetAfterDelete.rows.length === 0, "Deleting template safely cascades to remove unreferenced asset registry row");

    // -------------------------------------------------------------------------
    // STEP 8: Inspect Claude Test Package ZIP Fixture
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 8: CLAUDE EMAIL ZIP FIXTURE INSPECTION ---");
    const zipPath = path.resolve("tests/fixtures/valid-email-package.zip");
    assert(fs.existsSync(zipPath), "ZIP fixture tests/fixtures/valid-email-package.zip exists");

    const zipBuffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const fileNames = Object.keys(zip.files);
    assert(fileNames.includes("index.html"), "ZIP fixture contains index.html");
    assert(fileNames.some(f => f.startsWith("images/")), "ZIP fixture contains images/ directory with assets");

    const htmlContent = await zip.file("index.html")!.async("string");
    assert(htmlContent.includes("img src="), "index.html references image assets");

  } finally {
    await pgClient.end();
  }

  console.log("\n================================================================================");
  console.log(`QA VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runQaVerification().catch((err) => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
