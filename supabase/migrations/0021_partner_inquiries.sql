-- Create partner_inquiries table
create table public.partner_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  category varchar(50) not null,
  title varchar(150) not null,
  content text not null,
  attachment_path text,                                                         -- 첨부파일 스토리지 경로
  attachment_filename text,                                                     -- 첨부파일 원본 파일명
  status varchar(20) not null default 'pending' check (status in ('pending', 'replied')),
  reply_content text,
  replied_by uuid references public.staff_members(id) on delete set null,
  replied_at timestamptz,
  is_action_required boolean not null default false,                            -- 조치 필요 여부 (Action Required)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.partner_inquiries enable row level security;
alter table public.partner_inquiries force row level security;

-- SELECT policy: Portal users can select their own company's inquiries, Admin can select all
create policy "partner_inquiries_select_own_or_admin"
  on public.partner_inquiries for select
  to authenticated
  using (company_id = public.auth_company_id() or public.auth_is_admin());

-- INSERT policy: Portal users can insert their own company's inquiries
create policy "partner_inquiries_insert_own"
  on public.partner_inquiries for insert
  to authenticated
  with check (company_id = public.auth_company_id());

-- UPDATE policy: Portal users can update their own company's inquiries only when pending or when action is required
create policy "partner_inquiries_update_own"
  on public.partner_inquiries for update
  to authenticated
  using (company_id = public.auth_company_id() and (status = 'pending' or is_action_required = true))
  with check (company_id = public.auth_company_id());
