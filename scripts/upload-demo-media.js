const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

const sb = createClient(url, key);

const SUPPLIER_COMPANY_ID = '4c845ae8-b93b-4db2-858f-bda3252e8167';

const productsMedia = [
  {
    sku: 'TEST-SKN-001',
    id: '5be4ca57-d0f6-44b8-8cbb-2b443a34752e',
    name: 'Barrier Repair Ceramide Serum',
    subtitle: '5-Ceramide + Madecassoside 50ml',
    color1: '#4338ca',
    color2: '#6366f1',
    bg: '#eef2ff',
    icon: '💧'
  },
  {
    sku: 'TEST-SKN-002',
    id: 'a6a6d39c-bb10-4e8c-877f-d85b9ba986fe',
    name: 'Brightening Triple-Vitamin Toner Pads',
    subtitle: 'Niacinamide 4% + Yuzu 60 pads',
    color1: '#d97706',
    color2: '#f59e0b',
    bg: '#fffbeb',
    icon: '✨'
  },
  {
    sku: 'TEST-SKN-003',
    id: '9696e486-5c6f-48d7-850c-f7bd529270dc',
    name: 'Cooling Hydrogel Caffeine Eye Patches',
    subtitle: 'Caffeine + Collagen 60 patches',
    color1: '#0284c7',
    color2: '#38bdf8',
    bg: '#f0f9ff',
    icon: '👁️'
  },
  {
    sku: 'TEST-CLN-001',
    id: 'c4f99487-1509-4382-b7e3-c12b4a3f0414',
    name: 'pH-Balancing Amino Acid Foam Cleanser',
    subtitle: '17 Amino Acids + Green Tea 150ml',
    color1: '#059669',
    color2: '#10b981',
    bg: '#ecfdf5',
    icon: '🫧'
  },
  {
    sku: 'TEST-HAR-001',
    id: 'e7bb4a61-a6c6-43b9-88af-1b400ec53169',
    name: 'Deep Protein Silk Repair Hair Mask',
    subtitle: 'Hydrolyzed Silk + Keratin 200ml',
    color1: '#7c3aed',
    color2: '#a855f7',
    bg: '#faf5ff',
    icon: '💆'
  },
  {
    sku: 'TEST-TRD-001',
    id: '5374514d-bca3-4679-94b6-4b59fd6cc457',
    name: 'Dewy Glow Tinted Lip & Cheek Balm',
    subtitle: 'Shea Butter + Rosehip 15g',
    color1: '#e11d48',
    color2: '#fb7185',
    bg: '#fff1f2',
    icon: '🌸'
  }
];

function generateSvg(p, isDetail = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="grad_${p.sku}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.color1}" />
      <stop offset="100%" stop-color="${p.color2}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.12"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="600" height="600" fill="${p.bg}" />
  <circle cx="500" cy="100" r="180" fill="url(#grad_${p.sku})" opacity="0.08" />
  <circle cx="100" cy="500" r="220" fill="url(#grad_${p.sku})" opacity="0.06" />

  <!-- Packaging Card -->
  <rect x="80" y="80" width="440" height="440" rx="32" fill="#FFFFFF" filter="url(#shadow)" stroke="#E4E4E7" stroke-width="1.5" />

  <!-- Brand Label -->
  <rect x="120" y="120" width="130" height="28" rx="14" fill="${p.bg}" />
  <text x="185" y="139" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="${p.color1}" text-anchor="middle" letter-spacing="1.5">K SELECT LAB</text>

  <!-- SKU Badge -->
  <text x="480" y="138" font-family="monospace" font-size="12" font-weight="700" fill="#A1A1AA" text-anchor="end">${p.sku}</text>

  <!-- Central Icon Graphic -->
  <circle cx="300" cy="250" r="70" fill="url(#grad_${p.sku})" opacity="0.12" />
  <circle cx="300" cy="250" r="54" fill="url(#grad_${p.sku})" opacity="0.2" />
  <text x="300" y="268" font-size="52" text-anchor="middle">${p.icon}</text>

  <!-- Title & Subtitle -->
  <text x="300" y="360" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="#18181B" text-anchor="middle">${p.name}</text>
  <text x="300" y="390" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="${p.color1}" text-anchor="middle">${p.subtitle}</text>

  <!-- Quality Stamp -->
  <line x1="140" y1="430" x2="460" y2="430" stroke="#F4F4F5" stroke-width="1.5" />
  <text x="300" y="465" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#71717A" text-anchor="middle" letter-spacing="1">MADE IN KOREA • DERMATOLOGIST TESTED</text>
  ${isDetail ? '<text x="300" y="485" font-family="-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif" font-size="10" font-weight="600" fill="#A1A1AA" text-anchor="middle">OFFICIAL K SELECT DEMO SPECIFICATION</text>' : ''}
</svg>`;
}

async function uploadMedia() {
  console.log('--- Uploading Demo Product Media ---');

  for (const p of productsMedia) {
    // 1. Generate primary image
    const primarySvg = generateSvg(p, false);
    const primaryPath = `${SUPPLIER_COMPANY_ID}/products/${p.id}/images/primary.svg`;

    const { error: upErr1 } = await sb.storage
      .from('company-uploads')
      .upload(primaryPath, Buffer.from(primarySvg, 'utf8'), {
        contentType: 'image/svg+xml',
        upsert: true
      });
    if (upErr1) console.error(`Primary upload error for ${p.sku}:`, upErr1);

    // 2. Generate detail image
    const detailSvg = generateSvg(p, true);
    const detailPath = `${SUPPLIER_COMPANY_ID}/products/${p.id}/images/detail_1.svg`;

    const { error: upErr2 } = await sb.storage
      .from('company-uploads')
      .upload(detailPath, Buffer.from(detailSvg, 'utf8'), {
        contentType: 'image/svg+xml',
        upsert: true
      });
    if (upErr2) console.error(`Detail upload error for ${p.sku}:`, upErr2);

    // 3. Clear existing product_images records for this product
    await sb.from('product_images').delete().eq('product_id', p.id);

    // 4. Insert image records
    await sb.from('product_images').insert([
      {
        product_id: p.id,
        company_id: SUPPLIER_COMPANY_ID,
        storage_path: primaryPath,
        position: 0
      },
      {
        product_id: p.id,
        company_id: SUPPLIER_COMPANY_ID,
        storage_path: detailPath,
        position: 1
      }
    ]);

    console.log(`Uploaded media for ${p.sku} (${p.name})`);
  }

  console.log('All demo product media uploaded and registered successfully!');
}

uploadMedia().catch(console.error);
