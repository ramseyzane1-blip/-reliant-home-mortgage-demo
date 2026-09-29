-- Reliant Home Mortgage demo: stores pre-qualifications and form submissions.
-- Insert-only from the browser. There are no select policies, so submissions can only be
-- read from the Supabase dashboard or with the service role.

create table if not exists public.reliant_prequal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  goal text check (char_length(goal) <= 40),
  answers jsonb not null default '{}'::jsonb check (pg_column_size(answers) <= 8000),
  first_name text not null check (char_length(first_name) between 1 and 80),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  loan_officer text check (char_length(loan_officer) <= 80),
  wants_quote boolean not null default false,
  constraint reliant_prequal_has_contact check (phone is not null or email is not null)
);

create table if not exists public.reliant_form_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form text not null check (char_length(form) between 1 and 60),
  fields jsonb not null default '{}'::jsonb check (pg_column_size(fields) <= 8000)
);

-- browser roles may only insert (RLS below narrows what they can insert)
revoke all on public.reliant_prequal, public.reliant_form_submissions from anon, authenticated;
grant insert on public.reliant_prequal, public.reliant_form_submissions to anon, authenticated;

alter table public.reliant_prequal enable row level security;
alter table public.reliant_form_submissions enable row level security;

drop policy if exists "Visitors can submit a pre-qualification" on public.reliant_prequal;
create policy "Visitors can submit a pre-qualification" on public.reliant_prequal
  for insert to anon, authenticated
  with check (char_length(first_name) > 0 and (phone is not null or email is not null));

drop policy if exists "Visitors can submit a form" on public.reliant_form_submissions;
create policy "Visitors can submit a form" on public.reliant_form_submissions
  for insert to anon, authenticated
  with check (form in ('Question', 'Reliant Letter signup'));

create index if not exists reliant_prequal_created_at_idx on public.reliant_prequal (created_at desc);
create index if not exists reliant_form_submissions_created_at_idx on public.reliant_form_submissions (created_at desc);
