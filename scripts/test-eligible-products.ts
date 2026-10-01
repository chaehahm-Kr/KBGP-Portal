import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const envVars: Record<string, string> = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});

process.env.NEXT_PUBLIC_SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SECRET_KEY = envVars.SUPABASE_SECRET_KEY;

import { getProductsForSupplier } from '../lib/purchase-order/actions';

async function test() {
  const products = await getProductsForSupplier('4c845ae8-b93b-4db2-858f-bda3252e8167');
  console.log('Eligible Products Count for Brands Global Inc.:', products.length);
  console.log('Products:', products.map((p: any) => ({ id: p.id, name: p.name, sku: p.letusto_sku })));
}
test();
