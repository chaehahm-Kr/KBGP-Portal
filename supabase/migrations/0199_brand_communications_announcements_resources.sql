-- 0199_brand_communications_announcements_resources.sql
-- TASK ID: BRAND-COMMS-001
-- Brand Portal Announcements & Resource Center — Admin-Managed System
-- Additive-only migration (zero destructive DDL).

-- 1. Brand Announcements
create table if not exists public.brand_announcements (
  id uuid primary key default gen_random_uuid(),
  title_ko text not null,
  title_en text,
  body_ko text not null,
  body_en text,
  category text not null default 'GENERAL'
    check (category in (
      'GENERAL',
      'IMPORTANT',
      'COMPLIANCE_REGULATIONS',
      'US_MARKET_INTELLIGENCE',
      'PRODUCT_OPERATIONS',
      'LOGISTICS_FULFILLMENT',
      'COMPANY_SPECIFIC'
    )),
  priority text not null default 'NORMAL'
    check (priority in ('NORMAL', 'IMPORTANT', 'ACTION_REQUIRED')),
  audience_mode text not null default 'ALL_COMPANIES'
    check (audience_mode in ('ALL_COMPANIES', 'SELECTED_COMPANIES')),
  is_pinned boolean not null default false,
  notification_enabled boolean not null default true,
  notification_sent_at timestamptz,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  related_insight_id uuid references public.insights_articles(id) on delete set null,
  related_insight_slug text,
  attachment_storage_path text,
  attachment_file_name text,
  attachment_mime_type text,
  attachment_file_size bigint,
  attachment_sha256 text,
  author_name text not null default 'K SELECT Operations',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brand_announcements_status_published
  on public.brand_announcements (status, is_pinned desc, published_at desc nulls last);
create index if not exists idx_brand_announcements_category
  on public.brand_announcements (category);
create index if not exists idx_brand_announcements_audience
  on public.brand_announcements (audience_mode);

-- 2. Brand Announcement Targets (canonical company_id)
create table if not exists public.brand_announcement_targets (
  announcement_id uuid not null references public.brand_announcements(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, company_id)
);

create index if not exists idx_brand_announcement_targets_company
  on public.brand_announcement_targets (company_id, announcement_id);

-- 3. Brand Announcement Reads (per-user read tracking)
create table if not exists public.brand_announcement_reads (
  announcement_id uuid not null references public.brand_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_brand_announcement_reads_user
  on public.brand_announcement_reads (user_id, announcement_id);

-- 4. Brand Resources (Resource Center)
create table if not exists public.brand_resources (
  id uuid primary key default gen_random_uuid(),
  title_ko text not null,
  title_en text,
  description_ko text,
  description_en text,
  category text not null default 'FDA_COMPLIANCE'
    check (category in (
      'FDA_COMPLIANCE',
      'BRAND_ONBOARDING',
      'PRODUCT_REGISTRATION',
      'IMPORT_LOGISTICS',
      'MARKETING_MARKET',
      'FORMS_TEMPLATES'
    )),
  source_type text not null default 'UPLOADED_FILE'
    check (source_type in ('UPLOADED_FILE', 'LINKED_INSIGHT_PDF')),
  linked_insight_id uuid references public.insights_articles(id) on delete set null,
  linked_insight_slug text,
  file_type text not null default 'PDF'
    check (file_type in ('PDF', 'XLSX', 'DOCX')),
  file_name text,
  storage_path text,
  mime_type text,
  file_size bigint,
  file_sha256 text,
  page_count integer,
  version text not null default 'v1.0',
  language text not null default 'KO'
    check (language in ('KO', 'EN', 'KO_EN')),
  audience_mode text not null default 'ALL_COMPANIES'
    check (audience_mode in ('ALL_COMPANIES', 'SELECTED_COMPANIES')),
  notification_enabled boolean not null default false,
  notification_sent_at timestamptz,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brand_resources_status_category
  on public.brand_resources (status, category, updated_at desc);
create index if not exists idx_brand_resources_audience
  on public.brand_resources (audience_mode);
create index if not exists idx_brand_resources_linked_insight
  on public.brand_resources (linked_insight_id) where linked_insight_id is not null;

-- 5. Brand Resource Targets (canonical company_id)
create table if not exists public.brand_resource_targets (
  resource_id uuid not null references public.brand_resources(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (resource_id, company_id)
);

create index if not exists idx_brand_resource_targets_company
  on public.brand_resource_targets (company_id, resource_id);

-- 6. Announcement <-> Resource Links (no file duplication)
create table if not exists public.brand_announcement_resources (
  announcement_id uuid not null references public.brand_announcements(id) on delete cascade,
  resource_id uuid not null references public.brand_resources(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (announcement_id, resource_id)
);

create index if not exists idx_brand_announcement_resources_resource
  on public.brand_announcement_resources (resource_id);

-- 7. Brand Communications Audit Logs
create table if not exists public.brand_comms_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('ANNOUNCEMENT', 'RESOURCE')),
  entity_id uuid not null,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_comms_audit_entity
  on public.brand_comms_audit_logs (entity_type, entity_id, created_at desc);

-- ============================================================================
-- Row Level Security (ENABLE + FORCE)
-- All writes are performed server-side via service_role after strict auth checks.
-- ============================================================================

alter table public.brand_announcements enable row level security;
alter table public.brand_announcements force row level security;

drop policy if exists "brand_announcements_select_policy" on public.brand_announcements;
create policy "brand_announcements_select_policy" on public.brand_announcements
  for select to authenticated
  using (
    public.auth_is_admin()
    or (
      status = 'PUBLISHED'
      and public.auth_company_id() is not null
      and (
        audience_mode = 'ALL_COMPANIES'
        or exists (
          select 1
          from public.brand_announcement_targets t
          where t.announcement_id = brand_announcements.id
            and t.company_id = public.auth_company_id()
        )
      )
    )
  );

alter table public.brand_announcement_targets enable row level security;
alter table public.brand_announcement_targets force row level security;

drop policy if exists "brand_announcement_targets_select_policy" on public.brand_announcement_targets;
create policy "brand_announcement_targets_select_policy" on public.brand_announcement_targets
  for select to authenticated
  using (
    public.auth_is_admin()
    or company_id = public.auth_company_id()
  );

alter table public.brand_announcement_reads enable row level security;
alter table public.brand_announcement_reads force row level security;

drop policy if exists "brand_announcement_reads_select_policy" on public.brand_announcement_reads;
create policy "brand_announcement_reads_select_policy" on public.brand_announcement_reads
  for select to authenticated
  using (
    public.auth_is_admin()
    or user_id = auth.uid()
  );

alter table public.brand_resources enable row level security;
alter table public.brand_resources force row level security;

drop policy if exists "brand_resources_select_policy" on public.brand_resources;
create policy "brand_resources_select_policy" on public.brand_resources
  for select to authenticated
  using (
    public.auth_is_admin()
    or (
      status = 'PUBLISHED'
      and public.auth_company_id() is not null
      and (
        audience_mode = 'ALL_COMPANIES'
        or exists (
          select 1
          from public.brand_resource_targets t
          where t.resource_id = brand_resources.id
            and t.company_id = public.auth_company_id()
        )
      )
    )
  );

alter table public.brand_resource_targets enable row level security;
alter table public.brand_resource_targets force row level security;

drop policy if exists "brand_resource_targets_select_policy" on public.brand_resource_targets;
create policy "brand_resource_targets_select_policy" on public.brand_resource_targets
  for select to authenticated
  using (
    public.auth_is_admin()
    or company_id = public.auth_company_id()
  );

alter table public.brand_announcement_resources enable row level security;
alter table public.brand_announcement_resources force row level security;

drop policy if exists "brand_announcement_resources_select_policy" on public.brand_announcement_resources;
create policy "brand_announcement_resources_select_policy" on public.brand_announcement_resources
  for select to authenticated
  using (
    public.auth_is_admin()
    or exists (
      select 1
      from public.brand_announcements a
      where a.id = brand_announcement_resources.announcement_id
        and a.status = 'PUBLISHED'
        and public.auth_company_id() is not null
        and (
          a.audience_mode = 'ALL_COMPANIES'
          or exists (
            select 1
            from public.brand_announcement_targets t
            where t.announcement_id = a.id
              and t.company_id = public.auth_company_id()
          )
        )
    )
  );

alter table public.brand_comms_audit_logs enable row level security;
alter table public.brand_comms_audit_logs force row level security;

drop policy if exists "brand_comms_audit_logs_admin_select" on public.brand_comms_audit_logs;
create policy "brand_comms_audit_logs_admin_select" on public.brand_comms_audit_logs
  for select to authenticated
  using (public.auth_is_admin());

-- Explicit PostgREST grants (read-only for authenticated under RLS; full access for service_role)
grant select on
  public.brand_announcements,
  public.brand_announcement_targets,
  public.brand_announcement_reads,
  public.brand_resources,
  public.brand_resource_targets,
  public.brand_announcement_resources,
  public.brand_comms_audit_logs
to authenticated;

grant all on
  public.brand_announcements,
  public.brand_announcement_targets,
  public.brand_announcement_reads,
  public.brand_resources,
  public.brand_resource_targets,
  public.brand_announcement_resources,
  public.brand_comms_audit_logs
to service_role;
