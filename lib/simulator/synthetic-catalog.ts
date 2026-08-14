export interface SyntheticProduct {
  id: string;
  sku: string;
  name: string;
  brand_name: string;
  category_code: string;
  category_name: string;
  status: "selling";
  sales_status: "ON_SALE";
  selection_status: "SELECTED";
  estimated_retail_price: number;
  wholesale_price: number;
  curation_role: "HERO" | "CORE" | "TRIAL" | "TREND" | "MARGIN";
  ap_codes: ("AP-01" | "AP-02" | "AP-03" | "AP-04" | "AP-05" | "AP-06")[];
  image_url: string;
  is_synthetic: boolean;
}

export const SYNTHETIC_PRODUCT_CATALOG: SyntheticProduct[] = [
  // --- SKINCARE & CLEANSER ---
  {
    id: "synth-sku-001",
    sku: "SYNTH-SK-001",
    name: "Cica Mild Gentle Gel Cleanser 200ml",
    brand_name: "DermaPure K-Beauty",
    category_code: "SK_CLEANSER",
    category_name: "Cleanser",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 18.0,
    wholesale_price: 9.0,
    curation_role: "CORE",
    ap_codes: ["AP-01", "AP-02", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cleaner_01.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-002",
    sku: "SYNTH-SK-002",
    name: "Deep Hydration Hyaluronic Cleansing Foam 150ml",
    brand_name: "AquaGlow Lab",
    category_code: "SK_CLEANSER",
    category_name: "Cleanser",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 16.0,
    wholesale_price: 8.0,
    curation_role: "TRIAL",
    ap_codes: ["AP-01", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cleanser_02.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-003",
    sku: "SYNTH-SK-003",
    name: "Heartleaf Soothing Calming Toner 250ml",
    brand_name: "PhytoCalm Botanicals",
    category_code: "SK_TONER",
    category_name: "Toner",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 24.0,
    wholesale_price: 12.0,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-02", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/toner_01.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-004",
    sku: "SYNTH-SK-004",
    name: "BHA Clarifying Exfoliating Essence Toner 180ml",
    brand_name: "PorePerfect Solutions",
    category_code: "SK_TONER",
    category_name: "Toner",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 22.0,
    wholesale_price: 11.0,
    curation_role: "CORE",
    ap_codes: ["AP-02", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/toner_02.jpg",
    is_synthetic: true
  },

  // --- SERUMS & ESSENCES ---
  {
    id: "synth-sku-005",
    sku: "SYNTH-SK-005",
    name: "Snail Mucin 96 Power Repairing Essence 100ml",
    brand_name: "BioSecret K-Skin",
    category_code: "SK_SERUM",
    category_name: "Serum / Essence",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 25.0,
    wholesale_price: 12.5,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-02", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/essence_01.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-006",
    sku: "SYNTH-SK-006",
    name: "Niacinamide 10% + Zinc Brightening Ampoule 30ml",
    brand_name: "RadianceFormula",
    category_code: "SK_SERUM",
    category_name: "Serum / Essence",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 22.0,
    wholesale_price: 10.0,
    curation_role: "MARGIN",
    ap_codes: ["AP-02", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/ampoule_01.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-007",
    sku: "SYNTH-SK-007",
    name: "PDRN Collagen Firming Lifting Serum 50ml",
    brand_name: "LuxuryCell Stem",
    category_code: "SK_SERUM",
    category_name: "Serum / Essence",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 45.0,
    wholesale_price: 21.0,
    curation_role: "HERO",
    ap_codes: ["AP-06"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/serum_pdrn.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-008",
    sku: "SYNTH-SK-008",
    name: "Centella Asiatica Barrier Relief Ampoule 50ml",
    brand_name: "PhytoCalm Botanicals",
    category_code: "SK_SERUM",
    category_name: "Serum / Essence",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 28.0,
    wholesale_price: 13.0,
    curation_role: "CORE",
    ap_codes: ["AP-01", "AP-02", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cica_ampoule.jpg",
    is_synthetic: true
  },

  // --- MOISTURIZERS & CREAMS ---
  {
    id: "synth-sku-009",
    sku: "SYNTH-SK-009",
    name: "Ceramide NP Barrier Recovery Cream 80ml",
    brand_name: "DermaPure K-Beauty",
    category_code: "SK_CREAM",
    category_name: "Cream / Moisturizer",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 26.0,
    wholesale_price: 12.5,
    curation_role: "CORE",
    ap_codes: ["AP-01", "AP-02", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cream_ceramide.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-010",
    sku: "SYNTH-SK-010",
    name: "Water Bank Hydro Gel Cream 50ml",
    brand_name: "AquaGlow Lab",
    category_code: "SK_CREAM",
    category_name: "Cream / Moisturizer",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 23.0,
    wholesale_price: 11.0,
    curation_role: "TRIAL",
    ap_codes: ["AP-01", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cream_waterbank.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-011",
    sku: "SYNTH-SK-011",
    name: "Peptide Anti-Aging Youth Repair Cream 50ml",
    brand_name: "LuxuryCell Stem",
    category_code: "SK_CREAM",
    category_name: "Cream / Moisturizer",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 48.0,
    wholesale_price: 22.0,
    curation_role: "TREND",
    ap_codes: ["AP-06"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/cream_peptide.jpg",
    is_synthetic: true
  },

  // --- SHEET MASKS & PATCHES ---
  {
    id: "synth-sku-012",
    sku: "SYNTH-SK-012",
    name: "Hydrogel Real Deep Collagen Mask (4 Packs)",
    brand_name: "BioSecret K-Skin",
    category_code: "SK_MASK",
    category_name: "Sheet Mask",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 19.0,
    wholesale_price: 8.5,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-02", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/mask_collagen.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-013",
    sku: "SYNTH-SK-013",
    name: "Invisible Hydrocolloid Acne Pimple Master Patch 36 Patches",
    brand_name: "PorePerfect Solutions",
    category_code: "SK_PATCH",
    category_name: "Patch",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 10.0,
    wholesale_price: 4.5,
    curation_role: "MARGIN",
    ap_codes: ["AP-01", "AP-04", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/pimple_patch.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-014",
    sku: "SYNTH-SK-014",
    name: "Micro-Needle Hyaluronic Acid Eye Spot Patch (2 Packs)",
    brand_name: "RadianceFormula",
    category_code: "SK_PATCH",
    category_name: "Patch",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 14.0,
    wholesale_price: 6.5,
    curation_role: "TREND",
    ap_codes: ["AP-02", "AP-05", "AP-06"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/eye_patch.jpg",
    is_synthetic: true
  },

  // --- LIP CARE & SUN CARE ---
  {
    id: "synth-sku-015",
    sku: "SYNTH-SK-015",
    name: "Overnight Berry Lip Sleeping Mask 20g",
    brand_name: "AquaGlow Lab",
    category_code: "SK_LIP",
    category_name: "Lip Care",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 15.0,
    wholesale_price: 7.0,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-04", "AP-05"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/lip_mask.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-016",
    sku: "SYNTH-SK-016",
    name: "Relief Watery Sunscreen Essence SPF50+ PA++++ 50ml",
    brand_name: "PhytoCalm Botanicals",
    category_code: "SK_SUN",
    category_name: "Sun Care",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 21.0,
    wholesale_price: 10.0,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-02", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/sunscreen.jpg",
    is_synthetic: true
  },

  // --- HAIR CARE & SCALP CARE ---
  {
    id: "synth-sku-017",
    sku: "SYNTH-HR-001",
    name: "Anti-Hair Loss Root Strengthening Shampoo 500ml",
    brand_name: "K-Scalp Lab",
    category_code: "HR_SHAMPOO",
    category_name: "Hair Care",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 28.0,
    wholesale_price: 13.5,
    curation_role: "HERO",
    ap_codes: ["AP-01", "AP-03"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/shampoo_scalp.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-018",
    sku: "SYNTH-HR-002",
    name: "Miracle 7-Second Protein Hair Treatment Mask 200ml",
    brand_name: "SilkBond Professional",
    category_code: "HR_TREATMENT",
    category_name: "Hair Treatment",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 26.0,
    wholesale_price: 12.0,
    curation_role: "HERO",
    ap_codes: ["AP-03"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/hair_treatment.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-019",
    sku: "SYNTH-HR-003",
    name: "Scalp Cooling Scaling Tonic 120ml",
    brand_name: "K-Scalp Lab",
    category_code: "HR_SCALP",
    category_name: "Scalp Care",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 22.0,
    wholesale_price: 10.5,
    curation_role: "CORE",
    ap_codes: ["AP-03"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/scalp_tonic.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-020",
    sku: "SYNTH-HR-004",
    name: "Argan Oil Moisture Hair Serum 100ml",
    brand_name: "SilkBond Professional",
    category_code: "HR_STYLING",
    category_name: "Styling",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 20.0,
    wholesale_price: 9.5,
    curation_role: "TRIAL",
    ap_codes: ["AP-03"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/hair_oil.jpg",
    is_synthetic: true
  },

  // --- BEAUTY TOOLS & PERSONAL CARE ---
  {
    id: "synth-sku-021",
    sku: "SYNTH-TL-001",
    name: "Microcurrent Face Lifting Gua Sha Tool",
    brand_name: "BioSecret K-Skin",
    category_code: "TL_DEVICE",
    category_name: "Beauty Tool",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 38.0,
    wholesale_price: 18.0,
    curation_role: "TREND",
    ap_codes: ["AP-05", "AP-06"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/guasha_tool.jpg",
    is_synthetic: true
  },
  {
    id: "synth-sku-022",
    sku: "SYNTH-BD-001",
    name: "Body Acne Clarifying AHA Spray 150ml",
    brand_name: "PorePerfect Solutions",
    category_code: "BD_PERSONAL",
    category_name: "Body Care",
    status: "selling",
    sales_status: "ON_SALE",
    selection_status: "SELECTED",
    estimated_retail_price: 22.0,
    wholesale_price: 10.0,
    curation_role: "CORE",
    ap_codes: ["AP-01", "AP-04"],
    image_url: "https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/body_spray.jpg",
    is_synthetic: true
  },

  // --- ADDITIONAL 28 SYNTHETIC SKUS TO COVER ALL 6 APS & ALL CURATION ROLES UP TO 50 SKUS ---
  ...Array.from({ length: 28 }).map((_, i) => {
    const idx = i + 23;
    const apList: ("AP-01" | "AP-02" | "AP-03" | "AP-04" | "AP-05" | "AP-06")[][] = [
      ["AP-01", "AP-04"],
      ["AP-02", "AP-05"],
      ["AP-03"],
      ["AP-01", "AP-02", "AP-06"],
      ["AP-04", "AP-05"],
      ["AP-06"]
    ];
    const roles: ("HERO" | "CORE" | "TRIAL" | "TREND" | "MARGIN")[] = ["HERO", "CORE", "TRIAL", "TREND", "MARGIN"];
    const cats = [
      { code: "SK_SERUM", name: "Serum / Essence" },
      { code: "SK_CREAM", name: "Cream / Moisturizer" },
      { code: "SK_TONER", name: "Toner" },
      { code: "SK_CLEANSER", name: "Cleanser" },
      { code: "HR_SHAMPOO", name: "Hair Care" },
      { code: "SK_PATCH", name: "Patch" }
    ];
    const brandList = ["DermaPure K-Beauty", "AquaGlow Lab", "PhytoCalm Botanicals", "BioSecret K-Skin", "SilkBond Professional", "LuxuryCell Stem"];

    const catObj = cats[i % cats.length];
    const role = roles[i % roles.length];
    const price = Math.floor(12 + (i * 1.35) % 36);
    const wholesale = Math.round(price * 0.48 * 10) / 10;

    return {
      id: `synth-sku-${idx < 100 ? "0" + idx : idx}`,
      sku: `SYNTH-VAR-${idx}`,
      name: `K-Beauty Advanced Formula ${catObj.name} Vol.${i + 1} 100ml`,
      brand_name: brandList[i % brandList.length],
      category_code: catObj.code,
      category_name: catObj.name,
      status: "selling" as const,
      sales_status: "ON_SALE" as const,
      selection_status: "SELECTED" as const,
      estimated_retail_price: price,
      wholesale_price: wholesale,
      curation_role: role,
      ap_codes: apList[i % apList.length],
      image_url: `https://shzfrppdobpmrstcjfqu.supabase.co/storage/v1/object/public/company-uploads/synthetic/item_${idx}.jpg`,
      is_synthetic: true
    };
  })
];

export function getSyntheticProductsForAp(apCode: string): SyntheticProduct[] {
  return SYNTHETIC_PRODUCT_CATALOG.filter(p => p.ap_codes.includes(apCode as any));
}
