const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

if (!url || !key) {
  console.error("Missing Supabase URL or Secret Key");
  process.exit(1);
}

const sb = createClient(url, key);

const SUPPLIER_COMPANY_ID = '4c845ae8-b93b-4db2-858f-bda3252e8167';
const TEST_RETAILER_COMPANY_ID = 'dc9249be-a9e0-4975-a4c9-b602bb2baa47';
const TEST_STORE_01_ID = 'effe7832-096c-4ae1-86c7-3cb189b59731';

async function seed() {
  console.log('--- 1. Ensuring Brand K SELECT LAB ---');
  let { data: brand } = await sb
    .from('brands')
    .select('id, name')
    .eq('name', 'K SELECT LAB')
    .maybeSingle();

  if (!brand) {
    const { data: newBrand, error: brandErr } = await sb
      .from('brands')
      .insert({
        company_id: SUPPLIER_COMPANY_ID,
        name: 'K SELECT LAB',
        intro: 'Fictional K-Beauty Demo Brand for QA, Fast Count & Retail Training',
        is_active: true
      })
      .select()
      .single();
    if (brandErr) throw brandErr;
    brand = newBrand;
    console.log('Created Brand:', brand.id);
  } else {
    console.log('Found Existing Brand:', brand.id);
  }

  const BRAND_ID = brand.id;

  const demoProducts = [
    {
      sku: 'TEST-SKN-001',
      manufacture_sku: 'KS-LAB-BRS-50',
      upc: '880999100001',
      name: 'Barrier Repair Ceramide Serum',
      name_en: 'Barrier Repair Ceramide Serum 50ml',
      category: 'skincare',
      category_code: null,
      volume: '50ml / 1.69 fl.oz',
      origin: 'Republic of Korea',
      wholesale_price: 8.50,
      msrp: 22.00,
      store_regular_price: 22.00,
      store_sale_price: 18.99,
      moq: 12,
      carton_pack_qty: 12,
      description: 'A concentrated barrier-strengthening serum formulated with 5-Ceramide complex (10,000ppm), high-purity Madecassoside, and Panthenol to soothe redness and restore fragile, sensitized skin moisture barrier.',
      bullet_points: [
        '5-Ceramide Complex deeply replenishes lipid moisture barrier',
        'Centella Asiatica & Madecassoside instantly calm irritation and redness',
        'Non-greasy, fast-absorbing milky gel texture suitable for morning and evening',
        'Dermatologist-tested hypoallergenic formula free from artificial fragrance'
      ],
      ingredients_text: 'Water/Aqua/Eau, Butylene Glycol, Glycerin, Dipropylene Glycol, 1,2-Hexanediol, Niacinamide, Panthenol, Ceramide NP, Ceramide NS, Ceramide AS, Ceramide AP, Ceramide EOP, Centella Asiatica Extract, Madecassoside, Asiatic Acid, Asiaticoside, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Octyldodecanol, Hydrogenated Lecithin, Caprylic/Capric Triglyceride, Phytosphingosine, Cholesterol, Stearic Acid, Carbomer, Tromethamine, Ethylhexylglycerin, Disodium EDTA.'
    },
    {
      sku: 'TEST-SKN-002',
      manufacture_sku: 'KS-LAB-BTP-60',
      upc: '880999100002',
      name: 'Brightening Triple-Vitamin Toner Pads',
      name_en: 'Brightening Triple-Vitamin Toner Pads 60ea',
      category: 'skincare',
      category_code: null,
      volume: '60 pads / 150ml (5.07 fl.oz)',
      origin: 'Republic of Korea',
      wholesale_price: 9.50,
      msrp: 24.00,
      store_regular_price: 24.00,
      store_sale_price: null,
      moq: 12,
      carton_pack_qty: 12,
      description: 'Pre-soaked dual-sided embossed exfoliating and brightening toner pads infused with Niacinamide (4%), Vitamin C (Sodium Ascorbyl Phosphate), and Citrus Junos (Yuzu) Fruit Extract to clarify tone and smooth rough texture.',
      bullet_points: [
        'Dual-textured 100% pure cotton pads: embossed side exfoliates, smooth side hydrates',
        'Triple Vitamin complex (C, B3, B5) visibly illuminates dull complexion',
        'Low-irritation PHA (Gluconolactone) gently unclogs pores without peeling',
        'Sealed hygienic container with built-in mini tweezers'
      ],
      ingredients_text: 'Water/Aqua/Eau, Citrus Junos Fruit Extract, Glycerin, Niacinamide, Butylene Glycol, Dipropylene Glycol, 1,2-Hexanediol, Gluconolactone, Sodium Ascorbyl Phosphate, Tranexamic Acid, Panthenol, Allantoin, Betaine, Hydroxyethylcellulose, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Citrus Aurantium Bergamia (Bergamot) Fruit Oil, Disodium EDTA, Sodium Hyaluronate.'
    },
    {
      sku: 'TEST-SKN-003',
      manufacture_sku: 'KS-LAB-HEP-60',
      upc: '880999100003',
      name: 'Cooling Hydrogel Caffeine Eye Patches',
      name_en: 'Cooling Hydrogel Caffeine Eye Patches 60ea',
      category: 'skincare',
      category_code: null,
      volume: '60 patches / 30 pairs (90g / 3.17 oz)',
      origin: 'Republic of Korea',
      wholesale_price: 6.00,
      msrp: 16.00,
      store_regular_price: 16.00,
      store_sale_price: 13.50,
      moq: 24,
      carton_pack_qty: 24,
      description: 'Refreshing hydrogel eye masks formulated with Caffeine, Marine Collagen, and 6-Peptide complex to instantly depuff tired under-eyes, brighten dark circles, and smooth fine dehydration lines.',
      bullet_points: [
        'Instant thermal cooling effect (-3°C) reduces morning under-eye puffiness',
        'Caffeine and Niacinamide awaken and visibly brighten dark circles',
        'Marine Collagen and Acetyl Hexapeptide-8 enhance elasticity and firm eye contours',
        'Biodegradable water-soluble hydrogel melts comfortably without slipping'
      ],
      ingredients_text: 'Water/Aqua/Eau, Glycerin, Dipropylene Glycol, Chondrus Crispus Powder, Ceratonia Siliqua (Carob) Gum, Caffeine, Hydrolyzed Collagen, Niacinamide, Acetyl Hexapeptide-8, Copper Tripeptide-1, Palmitoyl Pentapeptide-4, Allantoin, Adenosine, Betaine, Butylene Glycol, 1,2-Hexanediol, Hydroxyacetophenone, Potassium Chloride, Xanthan Gum, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Disodium EDTA, Mica, Titanium Dioxide.'
    },
    {
      sku: 'TEST-CLN-001',
      manufacture_sku: 'KS-LAB-AFC-150',
      upc: '880999100004',
      name: 'pH-Balancing Amino Acid Foam Cleanser',
      name_en: 'pH-Balancing Amino Acid Foam Cleanser 150ml',
      category: 'skincare',
      category_code: null,
      volume: '150ml / 5.07 fl.oz',
      origin: 'Republic of Korea',
      wholesale_price: 4.50,
      msrp: 12.00,
      store_regular_price: 12.00,
      store_sale_price: null,
      moq: 24,
      carton_pack_qty: 24,
      description: 'A gentle, low-pH (5.5) micro-bubble cleanser powered by 17 Amino Acids, Green Tea Water, and Centella Asiatica that effectively removes daily sunscreen, light makeup, and impurities without stripping natural skin moisture.',
      bullet_points: [
        'pH 5.5 balanced formula protects the acid mantle',
        '17 Amino Acid surfactant complex creates dense, cushiony micro-foam',
        'Camellia Sinensis (Green Tea) Leaf Water purifies and controls excess sebum',
        'Non-stripping, zero tight feeling after rinsing'
      ],
      ingredients_text: 'Water/Aqua/Eau, Camellia Sinensis Leaf Water, Sodium Cocoyl Isethionate, Glycerin, Sodium Methyl Cocoyl Taurate, Potassium Cocoyl Glycinate, 1,2-Hexanediol, Centella Asiatica Extract, Glycine, Serine, Glutamic Acid, Aspartic Acid, Leucine, Alanine, Lysine, Arginine, Tyrosine, Phenylalanine, Proline, Threonine, Valine, Isoleucine, Histidine, Cysteine, Methionine, Salicylic Acid, Allantoin, Panthenol, Polyquaternium-67, Citric Acid, Disodium EDTA, Sodium Chloride, Ethylhexylglycerin.'
    },
    {
      sku: 'TEST-HAR-001',
      manufacture_sku: 'KS-LAB-RHM-200',
      upc: '880999100005',
      name: 'Deep Protein Silk Repair Hair Mask',
      name_en: 'Deep Protein Silk Repair Hair Mask 200ml',
      category: 'hair_scalp',
      category_code: null,
      volume: '200ml / 6.76 fl.oz',
      origin: 'Republic of Korea',
      wholesale_price: 11.00,
      msrp: 28.00,
      store_regular_price: 28.00,
      store_sale_price: null,
      moq: 12,
      carton_pack_qty: 12,
      description: 'An intensive salon-grade Korean hair rehabilitation treatment packed with Hydrolyzed Silk, Keratin, Argan Oil, and 7 Natural Seed Oils to resurrect severely damaged, heat-styled, and bleached strands with mirror-like shine.',
      bullet_points: [
        'High-protein formula binds to compromised hair cuticles to stop breakage',
        'Hydrolyzed Silk and Keratin restore elastic resilience and silky softness',
        'Cold-pressed Argan and Camellia Oils seal in moisture without weighing down fine hair',
        'Salon-quality floral musk fragrance with 24-hour aroma retention'
      ],
      ingredients_text: 'Water/Aqua/Eau, Cetearyl Alcohol, Dimethicone, Behentrimonium Chloride, Glycerin, Hydrolyzed Silk, Hydrolyzed Keratin, Argania Spinosa Kernel Oil, Camellia Japonica Seed Oil, Simmondsia Chinensis (Jojoba) Seed Oil, Ceramide NP, Panthenol, Hydrolyzed Collagen, Butylene Glycol, Dipropylene Glycol, 1,2-Hexanediol, Isopropyl Alcohol, Stearamidopropyl Dimethylamine, Lactic Acid, Ethylhexylglycerin, Disodium EDTA, Fragrance/Parfum.'
    },
    {
      sku: 'TEST-TRD-001',
      manufacture_sku: 'KS-LAB-LCB-15',
      upc: '880999100006',
      name: 'Dewy Glow Tinted Lip & Cheek Balm',
      name_en: 'Dewy Glow Tinted Lip & Cheek Balm 15g',
      category: 'daily_care',
      category_code: null,
      volume: '15g / 0.52 oz',
      origin: 'Republic of Korea',
      wholesale_price: 5.00,
      msrp: 14.00,
      store_regular_price: 14.00,
      store_sale_price: 11.99,
      moq: 24,
      carton_pack_qty: 24,
      description: 'A multi-use melting moisture balm infused with Shea Butter, Rosehip Oil, and Hyaluronic Acid that glides effortlessly onto lips and cheeks to deliver a fresh, natural flush with a dewy glass-like finish.',
      bullet_points: [
        '2-in-1 multi-balm for effortless monochrome lip and cheek makeup',
        'Melting jelly-balm texture hydrates dry lips for up to 8 hours',
        'Universal flattering soft berry-rose tint that adapts to skin undertones',
        'Portable pocket-sized pot for on-the-go touch-ups'
      ],
      ingredients_text: 'Diisostearyl Malate, Phytosteryl/Isostearyl/Cetyl/Stearyl/Behenyl Dimer Dilinoleate, Bis-Diglyceryl Polyacyladipate-2, Hydrogenated Polyisobutene, Butyrospermum Parkii (Shea) Butter, Synthetic Wax, Rosa Canina Fruit Oil, Simmondsia Chinensis (Jojoba) Seed Oil, Tocopherol, Sodium Hyaluronate, Microcrystalline Wax, Polyglyceryl-2 Triisostearate, 1,2-Hexanediol, Ethylhexylglycerin, Red 28 Lake (CI 45410), Red 7 Lake (CI 15850), Titanium Dioxide (CI 77891), Iron Oxides (CI 77491).'
    }
  ];

  console.log('--- 2. Upserting 6 Demo Products ---');
  const createdProductIds = [];

  for (let i = 0; i < demoProducts.length; i++) {
    const item = demoProducts[i];
    let { data: existing } = await sb
      .from('products')
      .select('id')
      .eq('letusto_sku', item.sku)
      .maybeSingle();

    const productPayload = {
      brand_id: BRAND_ID,
      company_id: SUPPLIER_COMPANY_ID,
      letusto_sku: item.sku,
      manufacture_sku: item.manufacture_sku,
      upc: item.upc,
      name: item.name,
      name_en: item.name_en,
      category: item.category,
      category_code: item.category_code,
      volume: item.volume,
      origin: item.origin,
      description: item.description,
      bullet_points: item.bullet_points,
      ingredients_text: item.ingredients_text,
      estimated_retail_price: item.msrp,
      price_usd_fob: item.wholesale_price,
      carton_pack_qty: item.carton_pack_qty,
      status: 'selling',
      selection_status: 'SELECTED',
      sales_status: 'ON_SALE',
      trading_status: 'active',
      price_additional_info: {
        admin_overrides: {
          name: item.name,
          name_en: item.name_en,
          letusto_sku: item.sku,
          description: item.description,
          bullet_points: item.bullet_points,
          origin: item.origin,
          volume: item.volume,
          carton_pack_qty: item.carton_pack_qty
        }
      },
      updated_at: new Date().toISOString()
    };

    let pId = null;
    if (existing) {
      pId = existing.id;
      const { error: updErr } = await sb.from('products').update(productPayload).eq('id', pId);
      if (updErr) console.error('Product update error:', updErr);
      console.log('Updated ' + item.sku + ': ' + pId);
    } else {
      const { data: newProd, error: insErr } = await sb
        .from('products')
        .insert({
          ...productPayload,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      pId = newProd.id;
      console.log('Inserted ' + item.sku + ': ' + pId);
    }

    createdProductIds.push({ productId: pId, ...item });

    // Upsert curation
    await sb.from('product_curations').upsert({
      product_id: pId,
      status: 'active',
      wholesale_price: item.wholesale_price,
      suggest_retail_price: item.msrp,
      landed_cost: Number((item.wholesale_price * 0.7).toFixed(2)),
      curator: 'K SELECT Master Curator',
      updated_at: new Date().toISOString()
    }, { onConflict: 'product_id' });

    // Upsert store assortment for Test Store 01
    await sb.from('retailer_store_products').upsert({
      company_id: TEST_RETAILER_COMPANY_ID,
      store_id: TEST_STORE_01_ID,
      product_id: pId,
      is_active: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'store_id,product_id' });

    // Upsert store price for Test Store 01
    const { error: priceErr } = await sb.from('retailer_store_product_prices').upsert({
      company_id: TEST_RETAILER_COMPANY_ID,
      store_id: TEST_STORE_01_ID,
      product_id: pId,
      regular_price: item.store_regular_price,
      sale_price: item.store_sale_price,
      sale_start_date: item.store_sale_price ? '2026-09-01' : null,
      sale_end_date: item.store_sale_price ? '2026-12-31' : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'store_id,product_id' });
    if (priceErr) console.error('Price upsert error for ' + item.sku + ':', priceErr);
  }

  console.log('--- 3. Seeding Completed Successfully! ---');
  console.log(JSON.stringify(createdProductIds.map(p => ({
    sku: p.sku,
    id: p.productId,
    name: p.name,
    wholesale: p.wholesale_price,
    msrp: p.msrp,
    sale: p.store_sale_price
  })), null, 2));
}

seed().catch(err => {
  console.error('Seed execution failed:', err);
  process.exit(1);
});
