-- Secretary Office: meetings, correspondence, and visitor register.
-- Apply this migration to the Supabase/Postgres database before using the page.

create table if not exists public.secretary_meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  meeting_date date not null,
  meeting_time time,
  venue text,
  participants text,
  agenda text,
  minutes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  follow_up text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.secretary_correspondence (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('incoming', 'outgoing')),
  reference_number text,
  subject text not null check (char_length(trim(subject)) between 1 and 250),
  correspondent text,
  correspondence_date date not null default current_date,
  due_date date,
  status text not null default 'open' check (status in ('open', 'pending', 'replied', 'closed')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.secretary_visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null check (char_length(trim(visitor_name)) between 1 and 200),
  organization text,
  purpose text not null check (char_length(trim(purpose)) between 1 and 500),
  person_to_visit text,
  arrived_at timestamptz not null default now(),
  departed_at timestamptz,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists secretary_meetings_date_idx on public.secretary_meetings (meeting_date desc);
create index if not exists secretary_correspondence_date_idx on public.secretary_correspondence (correspondence_date desc);
create index if not exists secretary_visitors_arrived_idx on public.secretary_visitors (arrived_at desc);

alter table public.secretary_meetings enable row level security;
alter table public.secretary_correspondence enable row level security;
alter table public.secretary_visitors enable row level security;

drop policy if exists "Secretary office readers can view meetings" on public.secretary_meetings;
create policy "Secretary office readers can view meetings"
on public.secretary_meetings for select to authenticated
using (public.has_permission('secretary.view', auth.uid()));

drop policy if exists "Secretary office staff can create meetings" on public.secretary_meetings;
create policy "Secretary office staff can create meetings"
on public.secretary_meetings for insert to authenticated
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Secretary office staff can update meetings" on public.secretary_meetings;
create policy "Secretary office staff can update meetings"
on public.secretary_meetings for update to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
)
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

drop policy if exists "Secretary office staff can delete meetings" on public.secretary_meetings;
create policy "Secretary office staff can delete meetings"
on public.secretary_meetings for delete to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

drop policy if exists "Secretary office readers can view correspondence" on public.secretary_correspondence;
create policy "Secretary office readers can view correspondence"
on public.secretary_correspondence for select to authenticated
using (public.has_permission('secretary.view', auth.uid()));

drop policy if exists "Secretary office staff can create correspondence" on public.secretary_correspondence;
create policy "Secretary office staff can create correspondence"
on public.secretary_correspondence for insert to authenticated
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "Secretary office staff can update correspondence" on public.secretary_correspondence;
create policy "Secretary office staff can update correspondence"
on public.secretary_correspondence for update to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
)
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

drop policy if exists "Secretary office staff can delete correspondence" on public.secretary_correspondence;
create policy "Secretary office staff can delete correspondence"
on public.secretary_correspondence for delete to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

drop policy if exists "Secretary office readers can view visitors" on public.secretary_visitors;
create policy "Secretary office readers can view visitors"
on public.secretary_visitors for select to authenticated
using (public.has_permission('secretary.view', auth.uid()));

drop policy if exists "Secretary office staff can create visitors" on public.secretary_visitors;
create policy "Secretary office staff can create visitors"
on public.secretary_visitors for insert to authenticated
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
  and (recorded_by is null or recorded_by = auth.uid())
);

drop policy if exists "Secretary office staff can update visitors" on public.secretary_visitors;
create policy "Secretary office staff can update visitors"
on public.secretary_visitors for update to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
)
with check (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

drop policy if exists "Secretary office staff can delete visitors" on public.secretary_visitors;
create policy "Secretary office staff can delete visitors"
on public.secretary_visitors for delete to authenticated
using (
  public.has_permission('secretary.view', auth.uid())
  and (public.has_role('secretary'::public.app_role, auth.uid())
    or public.has_role('ceo'::public.app_role, auth.uid())
    or public.has_role('administrator'::public.app_role, auth.uid()))
);

create or replace function public.set_secretary_office_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists secretary_meetings_updated_at on public.secretary_meetings;
create trigger secretary_meetings_updated_at before update on public.secretary_meetings
for each row execute function public.set_secretary_office_updated_at();

drop trigger if exists secretary_correspondence_updated_at on public.secretary_correspondence;
create trigger secretary_correspondence_updated_at before update on public.secretary_correspondence
for each row execute function public.set_secretary_office_updated_at();
