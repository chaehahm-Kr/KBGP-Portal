# K SELECT DEVELOPMENT HANDOFF REPORT

==================================================
1. TASK OBJECTIVE
==================================================
Task ID: RTP-QA-001
Title: K SELECT End-to-End Demo Product Dataset
Project: K SELECT Retailer Portal & Admin Suite
Production URL: https://portal.kselecthub.com
Status: COMPLETED

The objective of RTP-QA-001 is to establish a high-quality, realistic fictional K-Beauty demo product dataset (6 products) under a clearly identifiable TEST brand (`K SELECT LAB`, SKUs starting with `TEST-`) in Production Supabase. This dataset validates the real operating flow across all modules and establishes reusable test data for training and regression testing:
- Admin Master Catalog & Curation
- Retailer Catalog & Purchasing / Ordering
- Store Assortment & Price Tag Generation (`/tags`)
- Public Canonical Consumer Product Pages & QR Validation (`/products/[id]`)
- Weekly Product Check (`/check`)
- Mobile Fast Count QR Scanner (`jsQR`)
- Sales Performance & Reorder Recommendations (`/sales`)

==================================================
2. DEMO BRAND SPECIFICATION
==================================================
- **Brand Name:** K SELECT LAB
- **Brand ID:** `d2ecc685-a7c5-4fd3-9eab-1d81989ff0d1`
- **Company ID:** `4c845ae8-b93b-4db2-858f-bda3252e8167`
- **Status:** Active
- **Description:** Demo laboratory brand for K SELECT test curation, quality assurance, and retailer onboarding demonstrations.

==================================================
3. DEMO PRODUCTS SPECIFICATION
==================================================

### 1. Barrier Repair Ceramide Serum 50ml
- **Product ID:** `5be4ca57-d0f6-44b8-8cbb-2b443a34752e`
- **SKU:** `TEST-SKN-001`
- **Barcode / UPC:** `8809990010015`
- **Category:** Skincare (`skincare`)
- **Wholesale Cost:** $8.50
- **MSRP (Suggested Retail):** $22.00
- **Store 01 Regular Price:** $22.00
- **Store 01 Promotional Sale Price:** $18.99 (Save 14%)
- **MOQ / Case Pack:** 12 units
- **Key Selling Points:** 5-Ceramide complex + 2% Niacinamide, restores damaged skin barrier, non-sticky absorption, fragrance-free.
- **How to Use:** After cleansing and toning, apply 2-3 drops evenly over face and gently pat until fully absorbed.

### 2. Brightening Triple-Vitamin Toner Pads 60ea
- **Product ID:** `a6a6d39c-bb10-4e8c-877f-d85b9ba986fe`
- **SKU:** `TEST-SKN-002`
- **Barcode / UPC:** `8809990010022`
- **Category:** Skincare (`skincare`)
- **Wholesale Cost:** $9.50
- **MSRP (Suggested Retail):** $24.00
- **Store 01 Regular Price:** $24.00
- **Store 01 Promotional Sale Price:** None (Regular)
- **MOQ / Case Pack:** 12 units
- **Key Selling Points:** Vitamin C, B3 (Niacinamide), B5 (Panthenol), dual-sided embossed cotton pads for gentle exfoliation and radiant skin tone.
- **How to Use:** Wipe embossed side across face avoiding eyes, then pat with smooth side for hydration.

### 3. Cooling Hydrogel Caffeine Eye Patches 60ea
- **Product ID:** `9696e486-5c6f-48d7-850c-f7bd529270dc`
- **SKU:** `TEST-SKN-003`
- **Barcode / UPC:** `8809990010039`
- **Category:** Skincare (`skincare`)
- **Wholesale Cost:** $6.00
- **MSRP (Suggested Retail):** $16.00
- **Store 01 Regular Price:** $16.00
- **Store 01 Promotional Sale Price:** $13.50 (Save 16%)
- **MOQ / Case Pack:** 24 units
- **Key Selling Points:** Real coffee bean extract + 1% Caffeine + Collagen, instant de-puffing and brightening for tired under-eyes.
- **How to Use:** Place patches under eyes using enclosed spatula. Relax for 15-20 minutes, discard patches, and pat remaining essence.

### 4. pH-Balancing Amino Acid Foam Cleanser 150ml
- **Product ID:** `c4f99487-1509-4382-b7e3-c12b4a3f0414`
- **SKU:** `TEST-CLN-001`
- **Barcode / UPC:** `8809990010046`
- **Category:** Daily Care / Cleanser (`daily_care`)
- **Wholesale Cost:** $4.50
- **MSRP (Suggested Retail):** $12.00
- **Store 01 Regular Price:** $12.00
- **Store 01 Promotional Sale Price:** None (Regular)
- **MOQ / Case Pack:** 24 units
- **Key Selling Points:** 17 Amino acid complex, gentle pH 5.5 micro-bubble foam, deep pore cleansing without stripping natural moisture barrier.
- **How to Use:** Dispense adequate amount onto wet hands, lather into rich foam, massage onto face, and rinse thoroughly with lukewarm water.

### 5. Deep Protein Silk Repair Hair Mask 200ml
- **Product ID:** `e7bb4a61-a6c6-43b9-88af-1b400ec53169`
- **SKU:** `TEST-HAR-001`
- **Barcode / UPC:** `8809990010053`
- **Category:** Hair & Scalp (`hair_scalp`)
- **Wholesale Cost:** $11.00
- **MSRP (Suggested Retail):** $28.00
- **Store 01 Regular Price:** $28.00
- **Store 01 Promotional Sale Price:** None (Regular)
- **MOQ / Case Pack:** 12 units
- **Key Selling Points:** Hydrolyzed Silk & Keratin + Argan Oil, intensive salon-grade salon repair for bleached, heat-damaged, and brittle hair.
- **How to Use:** After shampooing, apply generously to mid-lengths and ends. Leave on for 5-10 minutes before rinsing thoroughly.

### 6. Dewy Glow Tinted Lip & Cheek Balm 15g
- **Product ID:** `5374514d-bca3-4679-94b6-4b59fd6cc457`
- **SKU:** `TEST-TRD-001`
- **Barcode / UPC:** `8809990010060`
- **Category:** Trendy / Color (`trendy_k`)
- **Wholesale Cost:** $5.00
- **MSRP (Suggested Retail):** $14.00
- **Store 01 Regular Price:** $14.00
- **Store 01 Promotional Sale Price:** $11.99 (Save 14%)
- **MOQ / Case Pack:** 24 units
- **Key Selling Points:** Multi-use buildable dewy tint, Shea Butter + Rosehip Seed Oil, glass-skin finish with sheer flattering flush.
- **How to Use:** Warm a small amount with fingertips and tap onto lips and high points of cheeks for an instant dewy flush.

==================================================
4. CURATION & STORE PRICING MATRIX
==================================================
Target Store: **Test Store 01** (`effe7832-096c-4ae1-86c7-3cb189b59731`)
Target Retailer: **K SELECT Test Retailer** (`dc9249be-a9e0-4975-a4c9-b602bb2baa47`)

| SKU | Product Name | Wholesale | MSRP | Store Regular | Store Sale | Discount % | Case Pack |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `TEST-SKN-001` | Barrier Repair Ceramide Serum | $8.50 | $22.00 | $22.00 | $18.99 | 14% | 12 |
| `TEST-SKN-002` | Brightening Toner Pads | $9.50 | $24.00 | $24.00 | — | — | 12 |
| `TEST-SKN-003` | Cooling Eye Patches | $6.00 | $16.00 | $16.00 | $13.50 | 16% | 24 |
| `TEST-CLN-001` | Amino Acid Foam Cleanser | $4.50 | $12.00 | $12.00 | — | — | 24 |
| `TEST-HAR-001` | Silk Repair Hair Mask | $11.00 | $28.00 | $28.00 | — | — | 12 |
| `TEST-TRD-001` | Tinted Lip & Cheek Balm | $5.00 | $14.00 | $14.00 | $11.99 | 14% | 24 |

==================================================
5. MEDIA & PRODUCT ASSETS
==================================================
- High-fidelity vector SVG product images generated with packaging rendering, botanical accent elements, and clear product typography.
- Primary product images uploaded to Supabase Storage bucket `company-uploads`.
- Registered with `is_primary: true` in table `product_images` for all 6 products.

==================================================
6. END-TO-END FLOW VERIFICATION
==================================================
1. **Catalog & Purchasing Flow:**
   - Products are selectable in Retailer Portal `/catalog` and `/products/[id]`.
   - Wholesale costs ($4.50 - $11.00) and MOQs (12 or 24) are respected in cart quantity incrementors.
2. **Price Tag Generation (`/tags`):**
   - Store prices (regular and promotional sale prices with badges) display properly.
   - Print layout generates standard 3x2 shelf tags with common product QR codes.
3. **Public Product QR Page (`/products/[id]`):**
   - Scanned QR resolves to `https://www.kselecthub.com/products/{productId}` (or `https://portal.kselecthub.com/products/{productId}`).
   - Displays brand, title, description, key benefits, usage instructions, ingredients, and retail MSRP.
   - Strict security check: Zero wholesale pricing or internal retailer margin data is exposed to public consumers.
4. **Weekly Product Check (`/check`):**
   - All 6 demo products are linked to `Test Store 01` in `retailer_store_products`.
   - Included in Weekly Check sessions and Stepper mode.
5. **Fast Count Mobile QR Scanner:**
   - Product QR codes are decoded via `jsQR` and resolved via `parseKSelectProductQr()`.
   - Validates store membership, opens fast count sheet, and increments count seamlessly.
6. **Sales Performance & Reorder Recommendations (`/sales`):**
   - Integrates with submitted weekly count snapshots.
   - Calculates movement, estimated retail sales, gross profit, weeks of supply, and reorder alerts.

==================================================
7. SCRIPTS & REPRODUCIBILITY
==================================================
- `scripts/seed-demo-products.js`: Creates/updates `products`, `product_curations`, `retailer_store_products`, and `retailer_store_product_prices`.
- `scripts/upload-demo-media.js`: Generates SVG packaging artwork and registers `product_images`.
- `scripts/verify-demo-dataset.js`: Validates all 6 products across database tables, pricing, storage images, and HTTP public endpoints with strict timeouts.

==================================================
8. TRAINING READINESS (RTP-TRN-001)
==================================================
- Dataset is fully isolated to brand `K SELECT LAB` and SKUs starting with `TEST-`.
- Ready for immediate use in training materials, user walkthroughs, screenshots, and live demos without risk to actual vendor merchandise.
