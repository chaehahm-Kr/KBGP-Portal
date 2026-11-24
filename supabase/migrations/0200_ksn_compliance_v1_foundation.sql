-- 0200_ksn_compliance_v1_foundation.sql
-- TASK ID: KSN-CMP-001-R1 (PROJECT: KSN-COMPLIANCE-V1)
-- Additive-only database foundation for Manufacturing Facilities,
-- Product-Facility Associations, Product Regulatory Compliance,
-- Private Admin Notes, Evidence Documents, and Audit Logs.
--
-- SAFETY GUARANTEES:
-- - Zero destructive DDL (no DROP TABLE / DROP COLUMN / DELETE).
-- - Preserves products.manufacture_sku, company_shipping_origins, warehouses, po_requests,
--   product_compliance_reviews (0174), and all existing regulatory Common Attributes.
-- - Does NOT activate new mandatory facility cutover or retire legacy attributes (handled in KSN-CMP-010).

-- ============================================================================
-- 1. Extend public.company_shipping_origins (Unified Locations: Shipping + Manufacturing)
-- ============================================================================
alter table public.company_shipping_origins
  add column if not exists location_type text not null default 'SHIPPING_ORIGIN',
  add column if not exists is_default_manufacturing boolean not null default false,
  add column if not exists facility_code text,
  add column if not exists manufacturer_legal_name_en text,
  add column if not exists manufacturer_name_ko text,
  add column if not exists contact_name_en text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_shipping_origins_location_type'
  ) then
    alter table public.company_shipping_origins
      add constraint chk_company_shipping_origins_location_type
      check (location_type in ('SHIPPING_ORIGIN', 'MANUFACTURING_FACILITY', 'SHIPPING_AND_MANUFACTURING'));
  end if;
end $$;

create unique index if not exists idx_company_locations_facility_code_unique
  on public.company_shipping_origins (company_id, facility_code)
  where facility_code is not null;

create unique index if not exists idx_company_locations_default_mfg_unique
  on public.company_shipping_origins (company_id)
  where is_default_manufacturing = true;

create index if not exists idx_company_locations_type
  on public.company_shipping_origins (company_id, location_type, status);

-- Concurrency-safe per-company facility code sequence (MFG-001, MFG-002, ...)
create table if not exists public.company_facility_code_sequences (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_seq integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.company_facility_code_sequences enable row level security;
alter table public.company_facility_code_sequences force row level security;

create or replace function public.next_company_facility_code(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  insert into public.company_facility_code_sequences (company_id, last_seq, updated_at)
  values (p_company_id, 1, now())
  on conflict (company_id)
  do update set
    last_seq = public.company_facility_code_sequences.last_seq + 1,
    updated_at = now()
  returning last_seq into v_seq;

  return 'MFG-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- ============================================================================
-- 2. Extend public.products with grandfathering flag (default false; cutover in KSN-CMP-010)
-- ============================================================================
alter table public.products
  add column if not exists compliance_facility_grandfathered boolean not null default false;

-- ============================================================================
-- 3. Manufacturing Facility Compliance (1:1 per Manufacturing Location)
-- ============================================================================
create table if not exists public.manufacturing_facility_compliance (
  facility_id uuid primary key references public.company_shipping_origins(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  fei_status text not null default 'UNKNOWN'
    check (fei_status in ('UNKNOWN', 'NOT_ISSUED', 'IN_PROGRESS', 'ISSUED')),
  fei_number text,
  mocra_facility_status text not null default 'UNKNOWN'
    check (mocra_facility_status in (
      'UNKNOWN', 'NOT_STARTED', 'IN_PROGRESS', 'REGISTERED', 'EXEMPT_SMALL_BUSINESS', 'NOT_APPLICABLE'
    )),
  mocra_exemption_reason text,
  mocra_registered_at date,
  mocra_next_renewal_date date,
  otc_facility_status text not null default 'UNKNOWN'
    check (otc_facility_status in ('UNKNOWN', 'NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'REGISTERED')),
  otc_na_reason text,
  otc_registered_at date,
  otc_next_renewal_date date,
  -- Authoritative verification summary (public-safe; private admin notes live in compliance_admin_notes)
  verification_status text not null default 'UNREVIEWED'
    check (verification_status in (
      'UNREVIEWED', 'UNDER_REVIEW', 'VERIFIED', 'NEEDS_INFO',
      'RE_REVIEW_REQUIRED', 'VALIDITY_REVIEW_REQUIRED', 'REJECTED'
    )),
  verified_by uuid references public.staff_members(id) on delete set null,
  verified_at timestamptz,
  verification_method text,
  verification_basis text,
  public_review_comment text,
  import_readiness_status text not null default 'NOT_EVALUATED'
    check (import_readiness_status in ('NOT_EVALUATED', 'READY', 'CONDITIONAL', 'BLOCKED', 'EXEMPT')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_facility_fei_required_when_issued
    check (fei_status <> 'ISSUED' or nullif(btrim(fei_number), '') is not null),
  constraint chk_facility_fei_required_when_mocra_registered
    check (mocra_facility_status <> 'REGISTERED' or nullif(btrim(fei_number), '') is not null),
  constraint chk_facility_fei_required_when_otc_registered
    check (otc_facility_status <> 'REGISTERED' or nullif(btrim(fei_number), '') is not null)
);

create index if not exists idx_mfg_facility_compliance_company
  on public.manufacturing_facility_compliance (company_id, verification_status);
create index if not exists idx_mfg_facility_compliance_renewals
  on public.manufacturing_facility_compliance (mocra_next_renewal_date, otc_next_renewal_date);

-- ============================================================================
-- 4. Product <-> Manufacturing Facility Associations (1 Primary + N Additional)
-- ============================================================================
create table if not exists public.product_manufacturing_facilities (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  facility_id uuid not null references public.company_shipping_origins(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete cascade,
  is_primary boolean not null default false,
  role_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint uq_product_manufacturing_facility unique (product_id, facility_id)
);

create unique index if not exists idx_product_primary_facility_unique
  on public.product_manufacturing_facilities (product_id)
  where is_primary = true;

create index if not exists idx_product_mfg_facilities_facility
  on public.product_manufacturing_facilities (facility_id);
create index if not exists idx_product_mfg_facilities_company
  on public.product_manufacturing_facilities (company_id, product_id);

-- DB-level tenant ownership & location_type enforcement trigger (anti cross-company ID injection)
create or replace function public.validate_product_facility_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod_company uuid;
  v_fac_company uuid;
  v_fac_type text;
begin
  select b.company_id into v_prod_company
  from public.products p
  join public.brands b on b.id = p.brand_id
  where p.id = new.product_id;

  select company_id, location_type into v_fac_company, v_fac_type
  from public.company_shipping_origins
  where id = new.facility_id;

  if v_prod_company is null then
    raise exception 'Product not found for manufacturing facility link.';
  end if;
  if v_fac_company is null then
    raise exception 'Manufacturing facility not found.';
  end if;
  if v_prod_company <> v_fac_company or new.company_id <> v_prod_company then
    raise exception 'Cross-company manufacturing facility association is forbidden.';
  end if;
  if v_fac_type not in ('MANUFACTURING_FACILITY', 'SHIPPING_AND_MANUFACTURING') then
    raise exception 'Shipping-only locations cannot be assigned as manufacturing facilities.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_product_facility_link on public.product_manufacturing_facilities;
create trigger trg_validate_product_facility_link
  before insert or update on public.product_manufacturing_facilities
  for each row execute function public.validate_product_facility_link();

-- Immutability & referenced-facility type protection trigger on company_shipping_origins
create or replace function public.guard_company_location_mutations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Facility code is immutable once assigned
  if old.facility_code is not null and new.facility_code is distinct from old.facility_code then
    raise exception 'Facility code is immutable after creation.';
  end if;

  -- Prevent downgrading a manufacturing location to shipping-only while referenced by products
  if old.location_type in ('MANUFACTURING_FACILITY', 'SHIPPING_AND_MANUFACTURING')
     and new.location_type = 'SHIPPING_ORIGIN' then
    if exists (
      select 1 from public.product_manufacturing_facilities
      where facility_id = old.id
    ) then
      raise exception 'Cannot change location type to SHIPPING_ORIGIN while linked to existing products.';
    end if;
  end if;

  -- Shipping-only cannot be default manufacturing facility
  if new.location_type = 'SHIPPING_ORIGIN' and new.is_default_manufacturing = true then
    new.is_default_manufacturing := false;
  end if;

  -- Facility-only cannot be default shipping origin
  if new.location_type = 'MANUFACTURING_FACILITY' and new.is_default = true then
    new.is_default := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_company_location_mutations on public.company_shipping_origins;
create trigger trg_guard_company_location_mutations
  before update on public.company_shipping_origins
  for each row execute function public.guard_company_location_mutations();

-- Atomic RPC for replacing product manufacturing facilities in one transaction
create or replace function public.replace_product_manufacturing_facilities(
  p_product_id uuid,
  p_company_id uuid,
  p_primary_facility_id uuid,
  p_additional_facility_ids uuid[],
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_add_id uuid;
begin
  delete from public.product_manufacturing_facilities
  where product_id = p_product_id;

  if p_primary_facility_id is not null then
    insert into public.product_manufacturing_facilities (
      product_id, facility_id, company_id, is_primary, created_by
    ) values (
      p_product_id, p_primary_facility_id, p_company_id, true, p_actor_id
    );
  end if;

  if p_additional_facility_ids is not null then
    foreach v_add_id in array p_additional_facility_ids loop
      if v_add_id is not null and (p_primary_facility_id is null or v_add_id <> p_primary_facility_id) then
        insert into public.product_manufacturing_facilities (
          product_id, facility_id, company_id, is_primary, created_by
        ) values (
          p_product_id, v_add_id, p_company_id, false, p_actor_id
        )
        on conflict (product_id, facility_id) do nothing;
      end if;
    end loop;
  end if;
end;
$$;

-- ============================================================================
-- 5. Product Regulatory Compliance (1:1 per Product)
-- ============================================================================
create table if not exists public.product_regulatory_compliance (
  product_id uuid primary key references public.products(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  -- Section 1: US Regulatory Classification
  us_classification text not null default 'UNDETERMINED'
    check (us_classification in ('UNDETERMINED', 'COSMETIC', 'OTC_DRUG', 'COSMETIC_OTC_DUAL', 'NOT_APPLICABLE')),
  otc_applicability text not null default 'UNKNOWN'
    check (otc_applicability in ('UNKNOWN', 'APPLICABLE', 'NOT_APPLICABLE', 'DUAL_REVIEW_REQUIRED')),
  otc_dual_mocra_applicable boolean,
  classification_rationale text,
  -- Section 3: Cosmetic Product Listing (MoCRA)
  mocra_listing_status text not null default 'UNKNOWN'
    check (mocra_listing_status in (
      'UNKNOWN', 'NOT_STARTED', 'IN_PROGRESS', 'LISTED', 'EXEMPT_SMALL_BUSINESS', 'NOT_APPLICABLE'
    )),
  mocra_listing_number text,
  mocra_exemption_reason text,
  mocra_listed_at date,
  mocra_next_renewal_date date,
  -- Section 4: OTC Drug Listing & Labeling
  otc_listing_status text not null default 'UNKNOWN'
    check (otc_listing_status in ('UNKNOWN', 'NOT_APPLICABLE', 'NOT_STARTED', 'IN_PROGRESS', 'LISTED')),
  otc_ndc_number text,
  otc_na_reason text,
  otc_listed_at date,
  otc_next_renewal_date date,
  drug_facts_status text not null default 'UNKNOWN'
    check (drug_facts_status in ('UNKNOWN', 'NOT_APPLICABLE', 'NOT_STARTED', 'DRAFT', 'READY', 'VERIFIED')),
  -- Legacy preservation (populated during KSN-CMP-010 without data loss)
  fda_legacy_status text,
  legacy_migration_snapshot jsonb,
  -- Section 6: Authoritative Admin Verification Summary (public-safe)
  verification_status text not null default 'UNREVIEWED'
    check (verification_status in (
      'UNREVIEWED', 'UNDER_REVIEW', 'VERIFIED', 'NEEDS_INFO',
      'RE_REVIEW_REQUIRED', 'VALIDITY_REVIEW_REQUIRED', 'REJECTED'
    )),
  verified_by uuid references public.staff_members(id) on delete set null,
  verified_at timestamptz,
  verification_method text,
  verification_basis text,
  public_review_comment text,
  import_readiness_status text not null default 'NOT_EVALUATED'
    check (import_readiness_status in ('NOT_EVALUATED', 'READY', 'CONDITIONAL', 'BLOCKED', 'EXEMPT')),
  last_brand_submitted_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_product_mocra_number_when_listed
    check (mocra_listing_status <> 'LISTED' or nullif(btrim(mocra_listing_number), '') is not null),
  constraint chk_product_ndc_number_when_listed
    check (otc_listing_status <> 'LISTED' or nullif(btrim(otc_ndc_number), '') is not null)
);

create index if not exists idx_product_reg_compliance_company
  on public.product_regulatory_compliance (company_id, verification_status, import_readiness_status);
create index if not exists idx_product_reg_compliance_renewals
  on public.product_regulatory_compliance (mocra_next_renewal_date, otc_next_renewal_date);

-- ============================================================================
-- 6. Private Admin Notes & Correction Requests (Admin-ONLY table; zero Portal RLS access)
-- ============================================================================
create table if not exists public.compliance_admin_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  target_type text not null check (target_type in ('FACILITY', 'PRODUCT')),
  facility_id uuid references public.company_shipping_origins(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  private_note text not null,
  correction_request text,
  created_by uuid references public.staff_members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chk_admin_notes_target_consistency check (
    (target_type = 'FACILITY' and facility_id is not null and product_id is null)
    or (target_type = 'PRODUCT' and product_id is not null and facility_id is null)
  )
);

create index if not exists idx_compliance_admin_notes_facility
  on public.compliance_admin_notes (facility_id, created_at desc) where facility_id is not null;
create index if not exists idx_compliance_admin_notes_product
  on public.compliance_admin_notes (product_id, created_at desc) where product_id is not null;

-- ============================================================================
-- 7. Compliance Evidence Documents (Optional Supporting Evidence)
-- ============================================================================
create table if not exists public.compliance_evidence_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  target_type text not null check (target_type in ('FACILITY', 'PRODUCT')),
  facility_id uuid references public.company_shipping_origins(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  document_category text not null check (document_category in (
    'FEI_CONFIRMATION',
    'MOCRA_FACILITY_RECEIPT',
    'MOCRA_PRODUCT_LISTING',
    'OTC_FACILITY_RECEIPT',
    'OTC_NDC_LISTING',
    'DRUG_FACTS_LABEL',
    'EXEMPTION_STATEMENT',
    'OTHER'
  )),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  sha256 text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint chk_evidence_target_consistency check (
    (target_type = 'FACILITY' and facility_id is not null and product_id is null)
    or (target_type = 'PRODUCT' and product_id is not null and facility_id is null)
  )
);

create index if not exists idx_compliance_evidence_facility
  on public.compliance_evidence_documents (facility_id, created_at desc) where facility_id is not null;
create index if not exists idx_compliance_evidence_product
  on public.compliance_evidence_documents (product_id, created_at desc) where product_id is not null;

create or replace function public.validate_compliance_evidence_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_company uuid;
begin
  if new.target_type = 'FACILITY' then
    select company_id into v_owner_company
    from public.company_shipping_origins
    where id = new.facility_id;
  else
    select b.company_id into v_owner_company
    from public.products p
    join public.brands b on b.id = p.brand_id
    where p.id = new.product_id;
  end if;

  if v_owner_company is null or v_owner_company <> new.company_id then
    raise exception 'Evidence document target ownership mismatch.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_compliance_evidence_ownership on public.compliance_evidence_documents;
create trigger trg_validate_compliance_evidence_ownership
  before insert or update on public.compliance_evidence_documents
  for each row execute function public.validate_compliance_evidence_ownership();

-- ============================================================================
-- 8. Compliance Audit Logs (Admin-only SELECT)
-- ============================================================================
create table if not exists public.compliance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  target_type text not null check (target_type in ('FACILITY', 'PRODUCT', 'SYSTEM')),
  facility_id uuid references public.company_shipping_origins(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system',
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_compliance_audit_logs_target
  on public.compliance_audit_logs (target_type, facility_id, product_id, created_at desc);

-- ============================================================================
-- 9. Row Level Security (ENABLE + FORCE) & Explicit Grants
-- ============================================================================
alter table public.manufacturing_facility_compliance enable row level security;
alter table public.manufacturing_facility_compliance force row level security;
drop policy if exists "mfg_facility_compliance_select" on public.manufacturing_facility_compliance;
create policy "mfg_facility_compliance_select"
  on public.manufacturing_facility_compliance for select to authenticated
  using (public.auth_is_admin() or public.auth_company_id() = company_id);

alter table public.product_manufacturing_facilities enable row level security;
alter table public.product_manufacturing_facilities force row level security;
drop policy if exists "product_mfg_facilities_select" on public.product_manufacturing_facilities;
create policy "product_mfg_facilities_select"
  on public.product_manufacturing_facilities for select to authenticated
  using (public.auth_is_admin() or public.auth_company_id() = company_id);

alter table public.product_regulatory_compliance enable row level security;
alter table public.product_regulatory_compliance force row level security;
drop policy if exists "product_reg_compliance_select" on public.product_regulatory_compliance;
create policy "product_reg_compliance_select"
  on public.product_regulatory_compliance for select to authenticated
  using (public.auth_is_admin() or public.auth_company_id() = company_id);

alter table public.compliance_evidence_documents enable row level security;
alter table public.compliance_evidence_documents force row level security;
drop policy if exists "compliance_evidence_docs_select" on public.compliance_evidence_documents;
create policy "compliance_evidence_docs_select"
  on public.compliance_evidence_documents for select to authenticated
  using (public.auth_is_admin() or public.auth_company_id() = company_id);

-- STRICT ADMIN-ONLY TABLES (Zero Brand Portal or Retailer direct DB access!)
alter table public.compliance_admin_notes enable row level security;
alter table public.compliance_admin_notes force row level security;
drop policy if exists "compliance_admin_notes_admin_select" on public.compliance_admin_notes;
create policy "compliance_admin_notes_admin_select"
  on public.compliance_admin_notes for select to authenticated
  using (public.auth_is_admin());

alter table public.compliance_audit_logs enable row level security;
alter table public.compliance_audit_logs force row level security;
drop policy if exists "compliance_audit_logs_admin_select" on public.compliance_audit_logs;
create policy "compliance_audit_logs_admin_select"
  on public.compliance_audit_logs for select to authenticated
  using (public.auth_is_admin());

grant select on
  public.manufacturing_facility_compliance,
  public.product_manufacturing_facilities,
  public.product_regulatory_compliance,
  public.compliance_evidence_documents,
  public.compliance_admin_notes,
  public.compliance_audit_logs
to authenticated;

grant all on
  public.company_facility_code_sequences,
  public.manufacturing_facility_compliance,
  public.product_manufacturing_facilities,
  public.product_regulatory_compliance,
  public.compliance_evidence_documents,
  public.compliance_admin_notes,
  public.compliance_audit_logs
to service_role;
