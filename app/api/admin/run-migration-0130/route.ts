import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const sql = `
    CREATE SEQUENCE IF NOT EXISTS public.brand_code_seq START WITH 1 INCREMENT BY 1;

    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS brand_code TEXT;

    CREATE OR REPLACE FUNCTION public.generate_next_brand_code()
    RETURNS TEXT
    LANGUAGE plpgsql
    AS $$
    DECLARE
      next_val BIGINT;
    BEGIN
      next_val := nextval('public.brand_code_seq');
      RETURN 'BR-' || lpad(next_val::text, 6, '0');
    END;
    $$;

    DO $$
    DECLARE
      b RECORD;
      seq_num INT := 0;
    BEGIN
      FOR b IN (
        SELECT id FROM public.brands
        WHERE brand_code IS NULL OR brand_code = ''
        ORDER BY created_at ASC, id ASC
      ) LOOP
        seq_num := seq_num + 1;
        UPDATE public.brands
        SET brand_code = 'BR-' || lpad(seq_num::text, 6, '0')
        WHERE id = b.id;
      END LOOP;

      IF seq_num > 0 THEN
        PERFORM setval('public.brand_code_seq', seq_num);
      END IF;
    END $$;

    ALTER TABLE public.brands
      ALTER COLUMN brand_code SET DEFAULT public.generate_next_brand_code();

    ALTER TABLE public.brands
      ALTER COLUMN brand_code SET NOT NULL;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'brands_brand_code_unique'
      ) THEN
        ALTER TABLE public.brands ADD CONSTRAINT brands_brand_code_unique UNIQUE (brand_code);
      END IF;
    END $$;

    CREATE OR REPLACE FUNCTION public.prevent_brand_code_change()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF OLD.brand_code IS DISTINCT FROM NEW.brand_code THEN
        RAISE EXCEPTION 'brand_code is immutable and cannot be modified (attempted % -> %)', OLD.brand_code, NEW.brand_code;
      END IF;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trigger_prevent_brand_code_change ON public.brands;
    CREATE TRIGGER trigger_prevent_brand_code_change
      BEFORE UPDATE ON public.brands
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_brand_code_change();
  `;

  const { data, error } = await admin.rpc("exec_sql", { sql_query: sql });

  const { data: brands, error: selectErr } = await admin
    .from("brands")
    .select("id, brand_code, name, created_at")
    .order("created_at", { ascending: true });

  return NextResponse.json({
    rpcResult: data,
    rpcError: error?.message,
    tableReady: !selectErr,
    brandsCount: brands?.length || 0,
    brands,
    selectError: selectErr?.message,
  });
}
