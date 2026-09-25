-- ==============================================================================
-- Migration 0102: Retailer Product Training Foundation
-- Task ID: RTP-TRN-001
-- Description:
-- 1. Creates retailer_product_training_progress for user-level completion tracking
-- 2. Creates retailer_product_training_content for rich product staff training
-- 3. Enables RLS with tenant isolation and user-level completion security
-- 4. Seeds rich training content for the 6 K SELECT LAB demo products
-- ==============================================================================

-- 1. Table: retailer_product_training_content
CREATE TABLE IF NOT EXISTS public.retailer_product_training_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  training_summary text,
  target_customer text,
  key_benefits jsonb DEFAULT '[]'::jsonb,
  how_to_use text,
  key_ingredients text,
  selling_points jsonb DEFAULT '[]'::jsonb,
  important_notes text,
  video_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retailer_training_content_product 
  ON public.retailer_product_training_content(product_id);

CREATE INDEX IF NOT EXISTS idx_retailer_training_content_published 
  ON public.retailer_product_training_content(is_published);

-- 2. Table: retailer_product_training_progress
CREATE TABLE IF NOT EXISTS public.retailer_product_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'in_progress')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_retailer_training_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_retailer_training_prog_user 
  ON public.retailer_product_training_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_retailer_training_prog_company 
  ON public.retailer_product_training_progress(company_id);

CREATE INDEX IF NOT EXISTS idx_retailer_training_prog_product 
  ON public.retailer_product_training_progress(product_id);

-- 3. Enable RLS
ALTER TABLE public.retailer_product_training_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_product_training_progress ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: retailer_product_training_content
-- Authenticated users (retailers, admins, portal users) can read published training content
DROP POLICY IF EXISTS "Anyone authenticated can view published training content" ON public.retailer_product_training_content;
CREATE POLICY "Anyone authenticated can view published training content"
  ON public.retailer_product_training_content
  FOR SELECT
  TO authenticated
  USING (is_published = true OR auth.role() = 'service_role');

-- Service role / Admins can manage training content
DROP POLICY IF EXISTS "Service role manages training content" ON public.retailer_product_training_content;
CREATE POLICY "Service role manages training content"
  ON public.retailer_product_training_content
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- 5. RLS Policies: retailer_product_training_progress
-- Users can view their own training progress, or Company Owner/Admin can view team progress
DROP POLICY IF EXISTS "Users can view own or company training progress" ON public.retailer_product_training_progress;
CREATE POLICY "Users can view own or company training progress"
  ON public.retailer_product_training_progress
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- Users can insert their own training progress
DROP POLICY IF EXISTS "Users can insert own training progress" ON public.retailer_product_training_progress;
CREATE POLICY "Users can insert own training progress"
  ON public.retailer_product_training_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.company_users WHERE id = auth.uid()
    )
  );

-- Users can update their own training progress
DROP POLICY IF EXISTS "Users can update own training progress" ON public.retailer_product_training_progress;
CREATE POLICY "Users can update own training progress"
  ON public.retailer_product_training_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own training progress (reset)
DROP POLICY IF EXISTS "Users can delete own training progress" ON public.retailer_product_training_progress;
CREATE POLICY "Users can delete own training progress"
  ON public.retailer_product_training_progress
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 6. Seed Realistic High-Quality Training Content for the 6 Demo Products
INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'A lightweight, lipid-replenishing barrier serum formulated with 5 essential ceramides and 2% niacinamide to restore compromised moisture barriers without greasiness.',
  'Customers experiencing dry, flaky, irritated, or over-exfoliated skin looking for gentle everyday barrier repair.',
  '[
    "5-Ceramide complex (EOP, NS, NP, AS, AP) mirrors natural skin lipids for rapid barrier recovery",
    "2% Niacinamide calms redness, balances oil-water levels, and evens tone",
    "Triple-weight Hyaluronic Acid delivers deep multi-layer hydration",
    "Fast-absorbing milky-gel texture that layers seamlessly under makeup and creams"
  ]'::jsonb,
  'After cleansing and toning, dispense 2–3 drops onto fingertips and gently pat over face and neck until fully absorbed. Use morning and night before heavier moisturizers.',
  '5-Ceramide Complex (10,000ppm), Niacinamide (2%), Centella Asiatica Extract, Panthenol (Pro-Vitamin B5), Triple Hyaluronic Acid',
  '[
    "Perfect companion product to recommend alongside strong exfoliants, retinoids, or acne treatments",
    "Fragrance-free, essential-oil-free, and non-comedogenic — ideal for sensitive skin",
    "High profit margin ($8.50 wholesale vs $22.00 retail) makes it an easy primary add-on at checkout"
  ]'::jsonb,
  'For external use only. Patch test recommended on sensitive skin. Store away from direct sunlight.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-001'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'Dual-sided embossed toning pads soaked in a triple-vitamin brightening essence (Vitamin C, B3 Niacinamide, B5 Panthenol) for effortless daily exfoliation and glow.',
  'Customers concerned about dull skin, post-acne dark spots, rough texture, or looking for a fast morning routine.',
  '[
    "Triple-Vitamin Synergy (C + B3 + B5) brightens dull tone and promotes radiant skin",
    "Dual-textured 100% pure cotton pad: embossed side exfoliates, soft side hydrates",
    "Mild PHA (Gluconolactone) dissolves dead skin cells without stinging or peeling",
    "60 pre-soaked large pads providing a full 1–2 month daily supply"
  ]'::jsonb,
  'After washing face, use embossed side to gently wipe along skin texture, avoiding immediate eye area. Flip pad to smooth side and pat remaining essence into skin until absorbed.',
  'Ascorbic Acid (Vitamin C), Niacinamide (Vitamin B3 3%), Panthenol (Vitamin B5), PHA (Gluconolactone), Hippophae Rhamnoides (Sea Buckthorn) Fruit Extract',
  '[
    "Extremely popular format among younger K-Beauty shoppers seeking quick morning glow routines",
    "Can be used as a targeted 5-minute sheet mask on cheeks and forehead before makeup application",
    "Sealed inner lid with hygienic mini tweezers included inside each jar"
  ]'::jsonb,
  'Close container tightly after each use to keep pads moist. Always recommend daily SPF when using Vitamin C products.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-002'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'Cooling water-soluble hydrogel eye patches infused with 1% active caffeine, marine collagen, and peptide complex to de-puff, firm, and brighten tired under-eyes.',
  'Customers with puffy morning eyes, dark circles, fine lines, or anyone needing quick visible under-eye revitalization.',
  '[
    "1% Caffeine stimulates micro-circulation to visibly reduce morning puffiness in 15 minutes",
    "Hydrolyzed Marine Collagen and Peptide complex plump fine dehydration lines",
    "Thermo-sensitive hydrogel melts gently against skin temperature for maximum essence delivery",
    "Includes 60 patches (30 pairs) with hygienic spatula"
  ]'::jsonb,
  'Use enclosed spatula to lift two patches. Apply directly onto clean, dry under-eye skin (narrow end toward inner corner or vice-versa). Relax for 15–20 minutes, remove, and pat remaining serum.',
  'Caffeine (10,000ppm), Hydrolyzed Marine Collagen, Acetyl Hexapeptide-8, Allantoin, Green Tea Extract, Sodium Hyaluronate',
  '[
    "Great self-care impulse purchase; recommend storing in refrigerator for enhanced cooling sensation",
    "Can also be applied on smile lines (nasolabial folds) and forehead frown lines",
    "Noticeable before-and-after results in under 20 minutes makes it easy to demo and sell"
  ]'::jsonb,
  'Single-use patches; discard after use. Avoid getting essence directly into eyes.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-SKN-003'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'A gentle, slightly acidic (pH 5.5) micro-foam cleanser enriched with 17 amino acids that dissolves impurities, excess sebum, and light makeup without stripping moisture.',
  'All skin types, especially sensitive, dry, or combination skin that feels tight or dry after normal soap cleansers.',
  '[
    "Natural amino-acid surfactant base creates dense, cushiony micro-bubbles with zero harsh sulfates",
    "Maintains optimal skin pH balance (5.5) to protect natural acid mantle and prevent irritation",
    "17 Amino Acid Complex + Ceramide NP leaves skin supple and moisturized post-cleanse",
    "Generous 150ml tube for daily morning and evening cleansing"
  ]'::jsonb,
  'Dispense a dime-sized amount onto wet hands and rub to create a rich lather. Gently massage foam over entire face in circular motions, then rinse thoroughly with lukewarm water.',
  '17 Amino Acid Complex (Glycine, Alanine, Serine, etc.), Potassium Cocoyl Glycinate, Ceramide NP, Glycerin, Centella Asiatica Extract',
  '[
    "Essential staple product for any skincare routine; easy cross-sell with any serum or toner pad",
    "Does NOT leave the squeaky, tight, stripped feeling that customers often dislike in harsh cleansers",
    "Sulfate-free, paraben-free, artificial fragrance-free"
  ]'::jsonb,
  'If product gets into eyes, rinse immediately with clean water. For heavy waterproof makeup, recommend double cleansing with an oil cleanser first.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-CLN-001'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'An intensive salon-grade Korean hair rehabilitation treatment packed with Hydrolyzed Silk, Keratin, and Argan Oil to resurrect severely damaged, heat-styled, and bleached hair.',
  'Customers with heat damage from flat irons/blowouts, bleached or chemically treated hair, split ends, and frizzy coarse hair.',
  '[
    "High-potency Hydrolyzed Silk & Keratin proteins penetrate and seal compromised hair cuticles",
    "Cold-pressed Argan Oil, Camellia Seed Oil, and Jojoba Oil impart lustrous shine without weighing hair down",
    "Reduces hair breakage by up to 85% with regular 1–2 weekly treatments",
    "Deluxe salon floral musk scent with long-lasting freshness"
  ]'::jsonb,
  'After shampooing, gently squeeze out excess water. Apply generous amount from mid-lengths to ends. Leave on for 5–10 minutes (or up to 15 minutes with a shower cap for deep conditioning), then rinse thoroughly.',
  'Hydrolyzed Silk, Hydrolyzed Keratin, Argania Spinosa (Argan) Kernel Oil, Camellia Japonica Seed Oil, Simmondsia Chinensis (Jojoba) Seed Oil, Ceramide NP, Panthenol',
  '[
    "High-ticket salon treatment experience at an attractive retail price ($28.00 retail / $11.00 wholesale)",
    "Customers see and feel immediate softness and detangling results after the very first shower",
    "Excellent repeat purchase rate once customers experience the salon aroma and shine"
  ]'::jsonb,
  'Apply primarily to hair lengths and ends rather than directly on scalp. Rinse thoroughly with water.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-HAR-001'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.retailer_product_training_content (
  product_id,
  training_summary,
  target_customer,
  key_benefits,
  how_to_use,
  key_ingredients,
  selling_points,
  important_notes,
  is_published
)
SELECT
  p.id,
  'A multi-use buildable cream balm infused with Shea Butter and Rosehip Seed Oil that delivers a healthy sheer flush of color and juicy glass-skin glow to lips and cheeks.',
  'Customers who love the clean girl aesthetic, quick 2-in-1 makeup routines, and natural radiant dewiness on lips and cheeks.',
  '[
    "2-in-1 versatile formula designed for both lips and cheeks in a sleek pocket-friendly jar",
    "Nourishing Shea Butter and Rosehip Seed Oil melt effortlessly into skin without stickiness",
    "Buildable sheer-to-medium pigment that flatters diverse skin tones with natural flush",
    "Glass-skin glow finish that hydrates dry lips while highlighting cheekbones"
  ]'::jsonb,
  'Warm a small amount with clean fingertips or brush. Tap onto the apples of cheeks and blend upward. Dab onto lips for a natural dewy tint. Layer for increased color intensity.',
  'Shea Butter, Rosehip Seed Oil, Tocopherol (Vitamin E), Jojoba Esters, Castor Seed Oil, Phytosteryl Isostearyl Dimer Dilinoleate',
  '[
    "High-appeal checkout counter impulse buy; trending multi-use format",
    "Compact 15g travel size fits in any purse or pocket",
    "Very easy to demo on the back of a customer hand to showcase the smooth texture and natural dewy finish"
  ]'::jsonb,
  'Keep cap firmly closed and avoid leaving in hot cars to prevent softening of natural botanical butters.',
  true
FROM public.products p
WHERE p.letusto_sku = 'TEST-TRD-001'
ON CONFLICT (product_id) DO UPDATE SET
  training_summary = EXCLUDED.training_summary,
  target_customer = EXCLUDED.target_customer,
  key_benefits = EXCLUDED.key_benefits,
  how_to_use = EXCLUDED.how_to_use,
  key_ingredients = EXCLUDED.key_ingredients,
  selling_points = EXCLUDED.selling_points,
  important_notes = EXCLUDED.important_notes,
  is_published = EXCLUDED.is_published,
  updated_at = now();
