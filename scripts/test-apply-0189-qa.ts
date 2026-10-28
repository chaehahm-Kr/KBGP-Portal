import { Client } from 'pg';
import * as fs from 'fs';
import {
  normalizeSourceUrl,
  normalizeKoreanCompanyName,
  normalizeEnglishCompanyName,
} from '../lib/brand-sourcing/duplicate-detector';

// Read .env.qa.local safely
const content = fs.readFileSync('.env.qa.local', 'utf8');
const lines = content.split(/\r?\n/);
let qaDbUrl = '';
for (const line of lines) {
  if (line.startsWith('QA_DATABASE_URL=')) {
    qaDbUrl = line.substring('QA_DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!qaDbUrl || qaDbUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: QA script cannot run on Production ref shzfrppdobpmrstcjfqu! Aborting.');
  process.exit(1);
}

const client = new Client({
  connectionString: qaDbUrl,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('================================================================================');
  console.log('ADM-BSRC-010-R1: Migration 0189 Final Hardening QA & Repeat-Safety Test');
  console.log('Target QA DB: elkgizqgksshukxgcndy');
  console.log('================================================================================\n');

  const sql0189Path = 'supabase/migrations/0189_brand_sourcing_duplicate_prevention.sql';
  const sql0189 = fs.readFileSync(sql0189Path, 'utf8');

  // Step 1: Apply Migration 0189 First Pass
  console.log('[Step 1] Applying Migration 0189 (Pass 1)...');
  await client.query('BEGIN');
  try {
    await client.query(sql0189);
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('0189_brand_sourcing_duplicate_prevention')
      ON CONFLICT DO NOTHING;
    `);
    await client.query('COMMIT');
    console.log('✓ Migration 0189 applied successfully on Pass 1.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Migration 0189 Pass 1 failed:', err.message);
    process.exit(1);
  }

  // Step 2: Repeat Execution Test (Pass 2 - Idempotency & Repeat Safety)
  console.log('\n[Step 2] Testing Repeat Execution (Pass 2 - Idempotency)...');
  await client.query('BEGIN');
  try {
    await client.query(sql0189);
    await client.query('COMMIT');
    console.log('✓ Pass 2 (Repeat execution) succeeded cleanly with ZERO errors.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Repeat execution failed:', err.message);
    process.exit(1);
  }

  // Step 3: Verify SQL Normalization Functions match TypeScript logic 100%
  console.log('\n[Step 3] Verifying SQL Normalization Functions against TypeScript...');
  
  // Test URLs including raw Korean characters
  const testUrls = [
    'https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.org-123.html#/',
    'https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.test.org-123.html#overview',
    'https://www.intercharmkorea.com/ko-kr/exhibitor_detail?idx=999&utm_source=email&ref=newsletter',
    'https://example.com/exhibitor/',
    'https://www.intercharmkorea.com/ko-kr/exhibitor_directory/Exhibitor_detail.주제이코모.org-ec0b85bc-960d-49d4-9dca-146c10ae59cb.html#/',
    'HTTPS://WWW.InterCHARMKorea.COM/ko-kr/exhibitor_detail?idx=123',
  ];

  for (const rawUrl of testUrls) {
    const tsNorm = normalizeSourceUrl(rawUrl);
    const { rows } = await client.query('SELECT public.fn_normalize_sourcing_url($1) as sql_norm', [rawUrl]);
    const sqlNorm = rows[0].sql_norm;
    console.log(`  Raw: "${rawUrl}"`);
    console.log(`    TS:  "${tsNorm}"`);
    console.log(`    SQL: "${sqlNorm}"`);
    if (tsNorm !== sqlNorm) {
      console.error(`  ❌ Mismatch in URL normalization!`);
      process.exit(1);
    }
  }
  console.log('  ✓ URL normalization logic in SQL and TypeScript matches 100%.');

  // Test Korean Names
  const testNamesKr = [
    '(주)코스맥스',
    '코스맥스 주식회사',
    '㈜코스맥스 ',
    '(유) 코스맥스',
    '주식회사 동동구리무',
  ];

  for (const rawKr of testNamesKr) {
    const tsNorm = normalizeKoreanCompanyName(rawKr);
    const { rows } = await client.query('SELECT public.fn_normalize_company_name_kr($1) as sql_norm', [rawKr]);
    const sqlNorm = rows[0].sql_norm;
    console.log(`  Raw: "${rawKr}" -> TS: "${tsNorm}" | SQL: "${sqlNorm}"`);
    if (tsNorm !== sqlNorm) {
      console.error(`  ❌ Mismatch in Korean name normalization!`);
      process.exit(1);
    }
  }
  console.log('  ✓ Korean name normalization logic matches 100%.');

  // Test English Names
  const testNamesEn = [
    'Cosmax Co., Ltd.',
    'Cosmax Inc.',
    'Cosmax LLC',
    'Cosmax Corporation',
  ];

  for (const rawEn of testNamesEn) {
    const tsNorm = normalizeEnglishCompanyName(rawEn);
    const { rows } = await client.query('SELECT public.fn_normalize_company_name_en($1) as sql_norm', [rawEn]);
    const sqlNorm = rows[0].sql_norm;
    console.log(`  Raw: "${rawEn}" -> TS: "${tsNorm}" | SQL: "${sqlNorm}"`);
    if (tsNorm !== sqlNorm) {
      console.error(`  ❌ Mismatch in English name normalization!`);
      process.exit(1);
    }
  }
  console.log('  ✓ English name normalization logic matches 100%.');

  // Step 4: Verify Triggers Automatically Synchronize & Correctly Clear NULLs (Requirement 5)
  console.log('\n[Step 4] Verifying Triggers Handle NULL and Cleared Values (No Stale Values)...');
  
  const runId = Date.now();
  const { rows: compRows } = await client.query(`
    INSERT INTO public.sourcing_companies (company_name_kr, company_name_en)
    VALUES ($1, $2)
    RETURNING id, normalized_name_kr, normalized_name_en;
  `, [`(주)트리거테스트_${runId}`, `Trigger Test Co., Ltd. ${runId}`]);

  const testCompId = compRows[0].id;
  console.log(`  Inserted company: normalized_name_kr="${compRows[0].normalized_name_kr}"`);

  // Test clearing company_name_kr to empty/stripped string and company_name_en to NULL
  const { rows: clearKrRows } = await client.query(`
    UPDATE public.sourcing_companies
    SET company_name_kr = '(주)',
        company_name_en = NULL
    WHERE id = $1
    RETURNING normalized_name_kr, normalized_name_en;
  `, [testCompId]);

  console.log(`  Cleared company_name_kr to '(주)' -> normalized_name_kr:`, clearKrRows[0].normalized_name_kr);
  console.log(`  Cleared company_name_en to NULL -> normalized_name_en:`, clearKrRows[0].normalized_name_en);
  if (clearKrRows[0].normalized_name_kr !== null || clearKrRows[0].normalized_name_en !== null) {
    console.error('  ❌ Trigger failed to clear normalized names when inputs were cleared!');
    process.exit(1);
  }
  console.log('  ✓ Trigger correctly clears normalized names to NULL when company names are cleared.');

  // Test sourcing_sources trigger with insert and clear
  const { rows: srcRows } = await client.query(`
    INSERT INTO public.sourcing_sources (company_id, provider, source_url, source_identifier)
    VALUES ($1, 'MANUAL', $2, $3)
    RETURNING id, canonical_source_url;
  `, [testCompId, `https://test-trigger-${runId}.com/exhibitor/#/`, `test-ident-${runId}`]);

  console.log(`  Inserted source: canonical_source_url="${srcRows[0].canonical_source_url}"`);

  // Now update source_url to empty string ''
  const { rows: clearSrcRows } = await client.query(`
    UPDATE public.sourcing_sources
    SET source_url = ''
    WHERE id = $1
    RETURNING canonical_source_url;
  `, [srcRows[0].id]);

  console.log(`  Cleared source_url to '' -> canonical_source_url:`, clearSrcRows[0].canonical_source_url);
  if (clearSrcRows[0].canonical_source_url !== null) {
    console.error('  ❌ Trigger failed to clear canonical_source_url when source_url cleared!');
    process.exit(1);
  }
  console.log('  ✓ Trigger correctly clears canonical_source_url to NULL when source_url is cleared.');

  // Step 5: Verify Append-Only Immutability on sourcing_duplicate_exceptions (Requirement 6)
  console.log('\n[Step 5] Verifying Append-Only Immutability on sourcing_duplicate_exceptions...');
  
  // Insert a test matched company
  const { rows: matchedCompRows } = await client.query(`
    INSERT INTO public.sourcing_companies (company_name_kr)
    VALUES ($1) RETURNING id;
  `, [`(주)매치테스트_${runId}`]);
  const matchedCompId = matchedCompRows[0].id;

  // Insert exception audit record
  const { rows: excRows } = await client.query(`
    INSERT INTO public.sourcing_duplicate_exceptions (
      company_id, matched_company_id, matched_rule, reason, evidence
    ) VALUES ($1, $2, 'SAME_NAME_KR', '테스트 예외', '{"test": true}'::jsonb)
    RETURNING id;
  `, [testCompId, matchedCompId]);
  const excId = excRows[0].id;
  console.log(`  Inserted exception audit record: ${excId}`);

  // Test UPDATE attempt (Must be blocked by trigger)
  let updateBlocked = false;
  try {
    await client.query(`
      UPDATE public.sourcing_duplicate_exceptions
      SET reason = '수정시도'
      WHERE id = $1;
    `, [excId]);
  } catch (err: any) {
    if (err.message.includes('append-only audit log')) {
      updateBlocked = true;
    }
  }
  console.log(`  UPDATE blocked by append-only trigger: ${updateBlocked ? 'YES (SUCCESS)' : 'NO (FAIL)'}`);
  if (!updateBlocked) {
    console.error('  ❌ UPDATE was not blocked on sourcing_duplicate_exceptions!');
    process.exit(1);
  }

  // Test DELETE attempt (Must be blocked by trigger)
  let deleteBlocked = false;
  try {
    await client.query(`
      DELETE FROM public.sourcing_duplicate_exceptions
      WHERE id = $1;
    `, [excId]);
  } catch (err: any) {
    if (err.message.includes('append-only audit log')) {
      deleteBlocked = true;
    }
  }
  console.log(`  DELETE blocked by append-only trigger: ${deleteBlocked ? 'YES (SUCCESS)' : 'NO (FAIL)'}`);
  if (!deleteBlocked) {
    console.error('  ❌ DELETE was not blocked on sourcing_duplicate_exceptions!');
    process.exit(1);
  }

  // Clean up: temporarily disable trigger for test row cleanup
  await client.query('ALTER TABLE public.sourcing_duplicate_exceptions DISABLE TRIGGER trg_prevent_sourcing_dup_exceptions_mod;');
  await client.query('DELETE FROM public.sourcing_duplicate_exceptions WHERE id = $1;', [excId]);
  await client.query('ALTER TABLE public.sourcing_duplicate_exceptions ENABLE TRIGGER trg_prevent_sourcing_dup_exceptions_mod;');
  await client.query('DELETE FROM public.sourcing_sources WHERE company_id = $1;', [testCompId]);
  await client.query('DELETE FROM public.sourcing_companies WHERE id IN ($1, $2);', [testCompId, matchedCompId]);

  // Step 6: Verify Permissions & RLS Policies (Requirement 6)
  console.log('\n[Step 6] Verifying Table Grants & RLS Policies...');
  const { rows: polRows } = await client.query(`
    SELECT policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = 'sourcing_duplicate_exceptions';
  `);

  console.log('  Policies on sourcing_duplicate_exceptions:');
  for (const p of polRows) {
    console.log(`    - Policy: "${p.policyname}" | Roles: ${p.roles} | Cmd: ${p.cmd} | Qual: "${p.qual}" | WithCheck: "${p.with_check}"`);
  }
  const hasUpdatePol = polRows.some(p => p.cmd === 'UPDATE');
  const hasDeletePol = polRows.some(p => p.cmd === 'DELETE');
  if (hasUpdatePol || hasDeletePol) {
    console.error('  ❌ Found unsafe UPDATE or DELETE policy on sourcing_duplicate_exceptions!');
    process.exit(1);
  }
  console.log('  ✓ Verified: Zero UPDATE or DELETE policies exist for authenticated users.');

  // Check Table Grants
  const { rows: grantRows } = await client.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_name = 'sourcing_duplicate_exceptions';
  `);
  const authGrants = grantRows.filter(g => g.grantee === 'authenticated').map(g => g.privilege_type);
  console.log('  Authenticated role grants:', authGrants);
  if (authGrants.includes('UPDATE') || authGrants.includes('DELETE')) {
    console.error('  ❌ authenticated role has unsafe UPDATE or DELETE table privilege!');
    process.exit(1);
  }
  console.log('  ✓ Verified: authenticated role granted only append-only (SELECT, INSERT) privileges.');

  console.log('\n================================================================================');
  console.log('MIGRATION 0189 FINAL HARDENING QA VERIFIED SUCCESSFULLY ON QA DB');
  console.log('================================================================================');

  await client.end();
}

main().catch(err => {
  console.error('FATAL ERROR in main:', err);
  process.exit(1);
});
