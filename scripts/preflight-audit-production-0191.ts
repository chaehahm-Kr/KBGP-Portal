import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Read .env.local.production_backup safely
const prodEnvPath = path.resolve(__dirname, '../.env.local.production_backup');
if (!fs.existsSync(prodEnvPath)) {
  console.error('Missing .env.local.production_backup');
  process.exit(1);
}

const lines = fs.readFileSync(prodEnvPath, 'utf8').split(/\r?\n/);
let prodUrl = '';
let prodKey = '';

for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    prodUrl = line.substring('NEXT_PUBLIC_SUPABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '');
  } else if (line.startsWith('SUPABASE_SECRET_KEY=')) {
    prodKey = line.substring('SUPABASE_SECRET_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
  }
}

if (!prodUrl.includes('shzfrppdobpmrstcjfqu')) {
  console.error('FATAL: Not pointing to Production ref shzfrppdobpmrstcjfqu');
  process.exit(1);
}

const supabase = createClient(prodUrl, prodKey, {
  auth: { persistSession: false },
});

async function main() {
  console.log('================================================================================');
  console.log('ADM-BSRC-014-R1: Production Read-Only Preflight Audit');
  console.log('Target Ref: shzfrppdobpmrstcjfqu (STRICT READ-ONLY)');
  console.log('Target URL:', prodUrl);
  console.log('================================================================================\n');

  // 1. Existing providers in sourcing_sources
  console.log('1. Checking existing provider values in sourcing_sources...');
  const { data: sources, error: srcErr } = await supabase
    .from('sourcing_sources')
    .select('id, provider, source_url, canonical_source_url, source_identifier, event_edition_id, created_at')
    .limit(100);

  if (srcErr) {
    console.error('  Error fetching sourcing_sources:', srcErr.message);
  } else {
    console.log(`  Total sample sources fetched: ${sources?.length || 0}`);
    const providerCounts: Record<string, number> = {};
    for (const s of sources || []) {
      providerCounts[s.provider] = (providerCounts[s.provider] || 0) + 1;
    }
    console.log('  Provider distribution in sample:', providerCounts);
    if (sources && sources.length > 0) {
      console.log('  Sample row:', {
        id: sources[0].id,
        provider: sources[0].provider,
        source_url: sources[0].source_url?.substring(0, 50) + '...',
        canonical_source_url: sources[0].canonical_source_url?.substring(0, 50) + '...',
        source_identifier: sources[0].source_identifier,
      });
    }
  }

  // 2. Check nullability of source_url in production rows
  console.log('\n2. Checking source_url values in sourcing_sources...');
  const { data: nullUrls, error: nullErr } = await supabase
    .from('sourcing_sources')
    .select('id')
    .is('source_url', null)
    .limit(5);

  if (nullErr) {
    console.error('  Error checking null source_url:', nullErr.message);
  } else {
    console.log(`  Rows with source_url IS NULL: ${nullUrls?.length || 0}`);
  }

  // 3. Verify compatibility with migration 0189 (canonical_source_url & duplicate tables)
  console.log('\n3. Verifying migration 0189 compatibility...');
  const { data: dupExceptions, error: dupErr } = await supabase
    .from('sourcing_duplicate_exceptions')
    .select('id')
    .limit(1);

  if (dupErr) {
    console.log('  sourcing_duplicate_exceptions table status:', dupErr.message);
  } else {
    console.log('  ✓ sourcing_duplicate_exceptions table exists');
  }

  const { data: compCols, error: compErr } = await supabase
    .from('sourcing_companies')
    .select('id, normalized_name_kr, normalized_name_en, primary_product_categories, primary_categories_confirmed')
    .limit(1);

  if (compErr) {
    console.log('  sourcing_companies 0189/0190 columns status:', compErr.message);
  } else {
    console.log('  ✓ sourcing_companies normalized_name_kr, primary_product_categories columns exist');
  }

  // 4. Verify compatibility with migration 0190 (primary_product_categories)
  console.log('\n4. Verifying migration 0190 compatibility...');
  const { data: catSample, error: catErr } = await supabase
    .from('sourcing_companies')
    .select('id, primary_product_categories, primary_categories_confirmed')
    .not('primary_product_categories', 'is', null)
    .limit(3);

  if (catErr) {
    console.log('  Migration 0190 check:', catErr.message);
  } else {
    console.log(`  ✓ Migration 0190 is applied in Production (${catSample?.length || 0} rows found with primary categories)`);
  }

  console.log('\n================================================================================');
  console.log('Preflight Audit Complete!');
  console.log('================================================================================');
}

main().catch(console.error);
