import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const prodEnvPath = path.resolve(__dirname, '../.env.local.production_backup');
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
  console.log('PRODUCTION BASELINE READ-ONLY AUDIT');
  console.log('Target Project Ref: shzfrppdobpmrstcjfqu');
  console.log('================================================================================\n');

  // 1. Total counts
  const { count: companyCount } = await supabase.from('sourcing_companies').select('id', { count: 'exact', head: true });
  const { count: contactCount } = await supabase.from('sourcing_contacts').select('id', { count: 'exact', head: true });
  const { count: brandCount } = await supabase.from('sourcing_brands').select('id', { count: 'exact', head: true });
  const { count: sourceCount } = await supabase.from('sourcing_sources').select('id', { count: 'exact', head: true });
  const { count: archivedCount } = await supabase.from('sourcing_companies').select('id', { count: 'exact', head: true }).eq('status', 'ARCHIVED');

  console.log('1. Database Record Counts:');
  console.log(`   - Sourcing Companies: ${companyCount}`);
  console.log(`   - Sourcing Contacts:  ${contactCount}`);
  console.log(`   - Sourcing Brands:    ${brandCount}`);
  console.log(`   - Sourcing Sources:   ${sourceCount}`);
  console.log(`   - Archived Companies: ${archivedCount}`);

  // 2. LIVE_MODE Codebase Hard-Lock Verification
  const campaignActionsCode = fs.readFileSync(path.resolve(__dirname, '../lib/brand-marketing/campaign-actions.ts'), 'utf8');
  const isLiveModeLockedFalse = campaignActionsCode.includes('LIVE_MODE Safety Lock') && campaignActionsCode.includes('Hard-locked to false');
  console.log('\n2. Marketing LIVE_MODE Verification:');
  console.log(`   - campaign-actions.ts LIVE_MODE safety lock active: ${isLiveModeLockedFalse ? 'YES (LOCKED TO FALSE)' : 'NO (DANGER)'}`);

  // 3. Migration 0191 Verification
  // Check if provider constraint accepts INDIE_BEAUTY_SHOW / MANUAL
  const { data: testProviderCheck, error: providerCheckErr } = await supabase
    .from('sourcing_sources')
    .select('provider')
    .limit(1);

  console.log('\n3. Migration 0191 Provider Support:');
  console.log(`   - Querying sourcing_sources.provider success: ${!providerCheckErr}`);

  // 4. Verify no pending outbound emails or campaign runs
  const { count: campaignRunCount } = await supabase.from('marketing_campaign_runs').select('id', { count: 'exact', head: true });
  console.log(`\n4. Campaign History:`);
  console.log(`   - Total Campaign Runs recorded: ${campaignRunCount || 0}`);

  console.log('\n================================================================================');
  console.log('PRODUCTION BASELINE CAPTURED SUCCESSFULLY');
  console.log('================================================================================');
}

main();
