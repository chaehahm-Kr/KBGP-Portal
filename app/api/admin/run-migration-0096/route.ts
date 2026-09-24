import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
// @ts-ignore
import pg from "pg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dbPass = searchParams.get("pass");

  const supabase = createAdminClient();

  // Test if retailer tables already exist
  const { data: testProfiles, error: testProfilesErr } = await supabase
    .from("retailer_profiles")
    .select("company_id")
    .limit(1);

  const { data: testStores, error: testStoresErr } = await supabase
    .from("stores")
    .select("id, company_id")
    .limit(1);

  const { data: testRoles, error: testRolesErr } = await supabase
    .from("retailer_user_roles")
    .select("id")
    .limit(1);

  const { data: testAssets, error: testAssetsErr } = await supabase
    .from("published_product_assets")
    .select("id")
    .limit(1);

  if (!testProfilesErr && !testStoresErr && !testRolesErr && !testAssetsErr && !dbPass) {
    return NextResponse.json({
      success: true,
      message: "Migration 0096 tables and columns already exist in Supabase!",
      verifiedTables: ["stores", "retailer_profiles", "retailer_user_roles", "published_product_assets"]
    });
  }

  const sql = `
    -- 1. Extend app_role enum
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'retailer';

    -- 2. Extend & Secure public.stores table
    CREATE TABLE IF NOT EXISTS public.stores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
      store_code TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Independent Beauty Supply',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      phone TEXT,
      email TEXT,
      manager_name TEXT,
      manager_phone TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_code TEXT;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);
    CREATE INDEX IF NOT EXISTS idx_stores_status ON public.stores(status);

    ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.stores FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow authenticated read access on stores" ON public.stores;
    DROP POLICY IF EXISTS "Allow admin write access on stores" ON public.stores;
    DROP POLICY IF EXISTS "stores_admin_all" ON public.stores;
    DROP POLICY IF EXISTS "stores_retailer_select" ON public.stores;
    DROP POLICY IF EXISTS "stores_retailer_insert" ON public.stores;
    DROP POLICY IF EXISTS "stores_retailer_update" ON public.stores;

    CREATE POLICY "stores_admin_all"
      ON public.stores FOR ALL
      TO authenticated
      USING (public.auth_is_admin());

    CREATE POLICY "stores_retailer_select"
      ON public.stores FOR SELECT
      TO authenticated
      USING (company_id = public.auth_company_id());

    CREATE POLICY "stores_retailer_insert"
      ON public.stores FOR INSERT
      TO authenticated
      WITH CHECK (company_id = public.auth_company_id());

    CREATE POLICY "stores_retailer_update"
      ON public.stores FOR UPDATE
      TO authenticated
      USING (company_id = public.auth_company_id())
      WITH CHECK (company_id = public.auth_company_id());

    -- 3. Create retailer_profiles table
    CREATE TABLE IF NOT EXISTS public.retailer_profiles (
      company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_approval', 'suspended')),
      payment_terms TEXT NOT NULL DEFAULT 'PREPAID_CARD' CHECK (payment_terms IN ('PREPAID_CARD', 'PREPAID_ACH', 'NET_30', 'NET_45', 'NET_60', 'CUSTOM')),
      payment_terms_custom TEXT,
      credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (credit_limit >= 0),
      terms_approved_by_admin BOOLEAN NOT NULL DEFAULT false,
      stripe_customer_id TEXT,
      resale_certificate_number TEXT,
      tax_exempt_status BOOLEAN NOT NULL DEFAULT false,
      billing_contact_name TEXT,
      billing_contact_email TEXT,
      billing_contact_phone TEXT,
      billing_address TEXT,
      billing_city TEXT,
      billing_state TEXT,
      billing_zip TEXT,
      internal_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.retailer_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.retailer_profiles FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "retailer_profiles_admin_all" ON public.retailer_profiles;
    DROP POLICY IF EXISTS "retailer_profiles_retailer_select" ON public.retailer_profiles;
    DROP POLICY IF EXISTS "retailer_profiles_retailer_update" ON public.retailer_profiles;

    CREATE POLICY "retailer_profiles_admin_all"
      ON public.retailer_profiles FOR ALL
      TO authenticated
      USING (public.auth_is_admin());

    CREATE POLICY "retailer_profiles_retailer_select"
      ON public.retailer_profiles FOR SELECT
      TO authenticated
      USING (company_id = public.auth_company_id());

    CREATE POLICY "retailer_profiles_retailer_update"
      ON public.retailer_profiles FOR UPDATE
      TO authenticated
      USING (company_id = public.auth_company_id())
      WITH CHECK (company_id = public.auth_company_id());

    -- 4. Create retailer_user_roles table
    CREATE TABLE IF NOT EXISTS public.retailer_user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'buyer', 'store_manager', 'employee', 'accounting')),
      has_all_stores_access BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );

    CREATE INDEX IF NOT EXISTS idx_retailer_user_roles_user_id ON public.retailer_user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_retailer_user_roles_company_id ON public.retailer_user_roles(company_id);

    ALTER TABLE public.retailer_user_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.retailer_user_roles FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "retailer_user_roles_admin_all" ON public.retailer_user_roles;
    DROP POLICY IF EXISTS "retailer_user_roles_select_same_company" ON public.retailer_user_roles;
    DROP POLICY IF EXISTS "retailer_user_roles_write_owner" ON public.retailer_user_roles;

    CREATE POLICY "retailer_user_roles_admin_all"
      ON public.retailer_user_roles FOR ALL
      TO authenticated
      USING (public.auth_is_admin());

    CREATE POLICY "retailer_user_roles_select_same_company"
      ON public.retailer_user_roles FOR SELECT
      TO authenticated
      USING (company_id = public.auth_company_id());

    CREATE POLICY "retailer_user_roles_write_owner"
      ON public.retailer_user_roles FOR ALL
      TO authenticated
      USING (
        company_id = public.auth_company_id()
        AND (
          public.auth_is_admin()
          OR EXISTS (
            SELECT 1 FROM public.retailer_user_roles rur
            WHERE rur.user_id = auth.uid()
              AND rur.company_id = retailer_user_roles.company_id
              AND rur.role = 'owner'
          )
        )
      );

    -- 5. Create retailer_user_store_access table
    CREATE TABLE IF NOT EXISTS public.retailer_user_store_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
      can_submit_checks BOOLEAN NOT NULL DEFAULT true,
      can_print_tags BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, store_id)
    );

    CREATE INDEX IF NOT EXISTS idx_retailer_user_store_access_user_id ON public.retailer_user_store_access(user_id);
    CREATE INDEX IF NOT EXISTS idx_retailer_user_store_access_store_id ON public.retailer_user_store_access(store_id);

    ALTER TABLE public.retailer_user_store_access ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.retailer_user_store_access FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "retailer_user_store_access_admin_all" ON public.retailer_user_store_access;
    DROP POLICY IF EXISTS "retailer_user_store_access_select" ON public.retailer_user_store_access;
    DROP POLICY IF EXISTS "retailer_user_store_access_write_owner_mgr" ON public.retailer_user_store_access;

    CREATE POLICY "retailer_user_store_access_admin_all"
      ON public.retailer_user_store_access FOR ALL
      TO authenticated
      USING (public.auth_is_admin());

    CREATE POLICY "retailer_user_store_access_select"
      ON public.retailer_user_store_access FOR SELECT
      TO authenticated
      USING (company_id = public.auth_company_id());

    CREATE POLICY "retailer_user_store_access_write_owner_mgr"
      ON public.retailer_user_store_access FOR ALL
      TO authenticated
      USING (
        company_id = public.auth_company_id()
        AND (
          public.auth_is_admin()
          OR EXISTS (
            SELECT 1 FROM public.retailer_user_roles rur
            WHERE rur.user_id = auth.uid()
              AND rur.company_id = retailer_user_store_access.company_id
              AND rur.role IN ('owner', 'buyer')
          )
        )
      );

    -- 6. Helper functions
    CREATE OR REPLACE FUNCTION public.auth_is_retailer()
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'retailer'
      );
    $$;

    CREATE OR REPLACE FUNCTION public.auth_has_store_access(p_store_id uuid)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = p_store_id
          AND (
            public.auth_is_admin()
            OR (
              s.company_id = public.auth_company_id()
              AND (
                EXISTS (
                  SELECT 1 FROM public.retailer_user_roles rur
                  WHERE rur.user_id = auth.uid()
                    AND rur.company_id = s.company_id
                    AND (rur.has_all_stores_access OR rur.role IN ('owner', 'buyer', 'accounting'))
                )
                OR EXISTS (
                  SELECT 1 FROM public.retailer_user_store_access rusa
                  WHERE rusa.user_id = auth.uid()
                    AND rusa.store_id = p_store_id
                )
              )
            )
          )
      );
    $$;

    -- 7. Create published_product_assets table
    CREATE TABLE IF NOT EXISTS public.published_product_assets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      asset_type TEXT NOT NULL CHECK (asset_type IN ('packshot', 'gallery_image', 'usage_video', 'marketing_banner', 'training_media', 'specification_sheet')),
      title TEXT,
      description TEXT,
      storage_path TEXT NOT NULL,
      public_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_public_qr_visible BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_published_product_assets_product_id ON public.published_product_assets(product_id);
    CREATE INDEX IF NOT EXISTS idx_published_product_assets_is_active ON public.published_product_assets(is_active);

    ALTER TABLE public.published_product_assets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.published_product_assets FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "published_assets_select" ON public.published_product_assets;
    DROP POLICY IF EXISTS "published_assets_admin_all" ON public.published_product_assets;

    CREATE POLICY "published_assets_select"
      ON public.published_product_assets FOR SELECT
      TO authenticated, anon
      USING (
        is_active = true
        AND EXISTS (
          SELECT 1 FROM public.products p
          WHERE p.id = published_product_assets.product_id
            AND p.status IN ('selling', 'registered')
        )
      );

    CREATE POLICY "published_assets_admin_all"
      ON public.published_product_assets FOR ALL
      TO authenticated
      USING (public.auth_is_admin());
  `;

  // 1. If password provided via query param
  if (dbPass) {
    const hosts = [
      "aws-1-us-west-2.pooler.supabase.com",
      "aws-0-us-west-1.pooler.supabase.com",
      "aws-0-ap-northeast-2.pooler.supabase.com",
      "db.shzfrppdobpmrstcjfqu.supabase.co"
    ];

    for (const host of hosts) {
      try {
        const client = new pg.Client({
          user: host.includes("pooler") ? "postgres.shzfrppdobpmrstcjfqu" : "postgres",
          password: dbPass,
          host,
          port: host.includes("pooler") ? 6543 : 5432,
          database: "postgres",
          ssl: { rejectUnauthorized: false }
        });
        await client.connect();
        await client.query(sql);
        await client.end();
        return NextResponse.json({
          success: true,
          method: "pg_pass_param",
          host,
          message: "Migration 0096 executed successfully!"
        });
      } catch (err: any) {
        // try next host
      }
    }
  }

  // 2. Try direct pg connection with any available connection string
  const pgConn = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (pgConn) {
    try {
      const client = new pg.Client({ connectionString: pgConn, ssl: { rejectUnauthorized: false } });
      await client.connect();
      await client.query(sql);
      await client.end();
      return NextResponse.json({
        success: true,
        method: "pg_direct",
        message: "Migration 0096 applied via POSTGRES_URL!"
      });
    } catch (pgErr: any) {
      console.error("Direct pg error:", pgErr);
      return NextResponse.json({ success: false, method: "pg_direct", error: pgErr.message });
    }
  }

  // 3. Try RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc("exec_sql", { sql_query: sql });
  if (!rpcErr) {
    return NextResponse.json({ success: true, method: "rpc", message: "Migration 0096 applied via RPC!", data: rpcData });
  }

  return NextResponse.json({
    success: false,
    message: "No direct Postgres connection string available",
    testProfilesErr: testProfilesErr?.message,
    testStoresErr: testStoresErr?.message,
    testRolesErr: testRolesErr?.message,
    testAssetsErr: testAssetsErr?.message,
    rpcError: rpcErr?.message
  });
}
