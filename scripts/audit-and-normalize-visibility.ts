import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envText.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== AUDITING EXISTING PRODUCT VISIBILITY & TRADING STATUS ===');

  const { data: products, error } = await client
    .from('products')
    .select(`
      id,
      name,
      name_en,
      letusto_sku,
      manufacture_sku,
      trading_status,
      retailer_visibility,
      trading_wholesale_price,
      price_krw_retail,
      estimated_retail_price,
      price_usd_fob,
      price_additional_info,
      carton_pack_qty,
      selection_status
    `);

  if (error || !products) {
    console.error('Failed to fetch products:', error);
    process.exit(1);
  }

  console.log(`Total Products in DB: ${products.length}`);

  let contradictionCount = 0;
  const contradictions: Array<{
    id: string;
    name: string;
    sku: string;
    trading_status: string;
    retailer_visibility: string;
    wholesale: number;
    retail: number;
    moq: number;
    reasons: string[];
  }> = [];

  for (const p of products) {
    const tStatus = p.trading_status || (p.selection_status === 'SELECTED' ? 'active' : 'inactive');
    const rVis = p.retailer_visibility || 'hidden';

    const info = (p.price_additional_info as any) || {};
    const policy = info.retailer_sales_policy || {};
    const overrides = info.admin_overrides || {};
    const tradingOverrides = info.trading_overrides || {};

    const wholesale =
      Number(p.trading_wholesale_price) > 0
        ? Number(p.trading_wholesale_price)
        : Number(policy.base_wholesale_price) > 0
        ? Number(policy.base_wholesale_price)
        : Number(tradingOverrides.wholesale_price) > 0
        ? Number(tradingOverrides.wholesale_price)
        : Number(overrides.price_usd_fob) > 0
        ? Number(overrides.price_usd_fob)
        : Number(p.price_usd_fob) > 0
        ? Number(p.price_usd_fob)
        : 0;

    const retail =
      Number(tradingOverrides.srp_price) > 0
        ? Number(tradingOverrides.srp_price)
        : Number(p.price_krw_retail) > 0
        ? Number(p.price_krw_retail)
        : Number(p.estimated_retail_price) > 0
        ? Number(p.estimated_retail_price)
        : Number(overrides.estimated_retail_price) > 0
        ? Number(overrides.estimated_retail_price)
        : 0;

    const moq =
      Number(policy.moq) > 0
        ? Number(policy.moq)
        : Number(p.carton_pack_qty) > 0
        ? Number(p.carton_pack_qty)
        : Number(overrides.carton_pack_qty) > 0
        ? Number(overrides.carton_pack_qty)
        : 0;

    const reasons: string[] = [];

    if (tStatus !== 'active' && rVis === 'visible') {
      reasons.push('inactive/historical but visible');
    }

    if (rVis === 'visible') {
      if (wholesale <= 0) reasons.push('missing wholesale price');
      if (retail <= 0) reasons.push('missing retail price');
      if (moq <= 0) reasons.push('missing MOQ');
    }

    if (reasons.length > 0) {
      contradictionCount++;
      contradictions.push({
        id: p.id,
        name: p.name || p.name_en || 'Unnamed',
        sku: p.letusto_sku || p.manufacture_sku || 'No SKU',
        trading_status: tStatus,
        retailer_visibility: rVis,
        wholesale,
        retail,
        moq,
        reasons,
      });
    }
  }

  console.log(`\nFound ${contradictionCount} contradicting products out of ${products.length}:`);
  contradictions.forEach((c, idx) => {
    console.log(
      `${idx + 1}. [${c.sku}] ${c.name} (${c.id})\n   Status: ${c.trading_status} | Visibility: ${c.retailer_visibility} | Wholesale: $${c.wholesale} | Retail: $${c.retail} | MOQ: ${c.moq}\n   Reasons: ${c.reasons.join(', ')}`
    );
  });
}

main().catch(console.error);
