-- Create partner_inquiry_messages table to support threaded conversations
create table public.partner_inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.partner_inquiries(id) on delete cascade,
  sender_type varchar(20) not null check (sender_type in ('partner', 'admin')),
  sender_id uuid not null,                                                      -- auth.users.id (또는 profiles.id, staff_members.id)
  sender_name varchar(100) not null,
  content text not null,
  attachment_path text,                                                         -- 첨부파일 스토리지 경로 (선택)
  attachment_filename text,                                                     -- 첨부파일 원본 파일명 (선택)
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.partner_inquiry_messages enable row level security;
alter table public.partner_inquiry_messages force row level security;

-- SELECT policy: Portal users can select messages for their company's inquiries, Admin can select all
create policy "partner_inquiry_messages_select_own_or_admin"
  on public.partner_inquiry_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.partner_inquiries pi
      where pi.id = inquiry_id
      and (pi.company_id = public.auth_company_id() or public.auth_is_admin())
    )
  );

-- INSERT policy: authenticated users can insert if they belong to the company or are admin
create policy "partner_inquiry_messages_insert_own_or_admin"
  on public.partner_inquiry_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.partner_inquiries pi
      where pi.id = inquiry_id
      and (pi.company_id = public.auth_company_id() or public.auth_is_admin())
    )
  );
