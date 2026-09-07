-- OFEK RADAR - initial database schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','interviewer');
create type public.cycle_status as enum ('draft','active','completed','archived');
create type public.interview_status as enum ('scheduled','completed','cancelled','no_show');

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  role public.user_role not null default 'interviewer',
  unit_id uuid references public.units(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  recruitment_year int not null,
  starts_on date,
  ends_on date,
  status public.cycle_status not null default 'draft',
  interview_duration_minutes int not null default 30 check (interview_duration_minutes > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cycle_units (
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  interviewer_id uuid references public.profiles(id),
  primary key(cycle_id, unit_id)
);

create table public.interview_days (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  interview_date date not null,
  starts_at time not null,
  ends_at time not null,
  constraint valid_day_hours check (ends_at > starts_at)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  national_id text not null unique,
  full_name text not null,
  phone text,
  city text,
  photo_url text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cycle_candidates (
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  status text not null default 'new',
  target_unit_id uuid references public.units(id),
  primary key(cycle_id,candidate_id)
);

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  title text not null default 'שאלון מועמד',
  active_version int not null default 1,
  created_at timestamptz not null default now()
);

create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  version int not null,
  field_key text not null,
  label text not null,
  field_type text not null check (field_type in ('short_text','long_text','number','single_choice','multi_choice','date','yes_no','phone','email')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  position int not null default 0,
  maps_to_candidate_field text,
  unique(questionnaire_id,version,field_key)
);

create table public.questionnaire_links (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires(id),
  candidate_id uuid not null references public.candidates(id),
  cycle_id uuid not null references public.cycles(id),
  version int not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  unique(questionnaire_id,candidate_id,cycle_id)
);

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  unit_id uuid not null references public.units(id),
  interviewer_id uuid not null references public.profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.interview_status not null default 'scheduled',
  location text,
  created_at timestamptz not null default now(),
  unique(cycle_id,candidate_id,unit_id),
  constraint interview_time_valid check (ends_at > starts_at)
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  interviewer_id uuid not null references public.profiles(id),
  professional_score int check (professional_score between 1 and 5),
  personal_score int check (personal_score between 1 and 5),
  recommendation text check (recommendation in ('strong_yes','yes','maybe','no')),
  notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful role check
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true);
$$;

alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.cycles enable row level security;
alter table public.cycle_units enable row level security;
alter table public.interview_days enable row level security;
alter table public.candidates enable row level security;
alter table public.cycle_candidates enable row level security;
alter table public.questionnaires enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.questionnaire_links enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.interviews enable row level security;
alter table public.evaluations enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated read units" on public.units for select to authenticated using (true);
create policy "admin manage units" on public.units for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "self or admin read profiles" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "admin manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manage cycles" on public.cycles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "interviewer read assigned cycles" on public.cycles for select to authenticated using (
  public.is_admin() or exists(select 1 from public.cycle_units cu where cu.cycle_id=cycles.id and cu.interviewer_id=auth.uid())
);

create policy "admin manage cycle units" on public.cycle_units for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "interviewer read own cycle unit" on public.cycle_units for select to authenticated using (interviewer_id=auth.uid() or public.is_admin());
create policy "admin manage interview days" on public.interview_days for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "assigned interviewer read days" on public.interview_days for select to authenticated using (
  public.is_admin() or exists(select 1 from public.cycle_units cu where cu.cycle_id=interview_days.cycle_id and cu.interviewer_id=auth.uid())
);

create policy "admin manage candidates" on public.candidates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "interviewer read assigned candidates" on public.candidates for select to authenticated using (
  exists(select 1 from public.interviews i where i.candidate_id=candidates.id and i.interviewer_id=auth.uid())
);
create policy "admin manage cycle candidates" on public.cycle_candidates for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin manage questionnaires" on public.questionnaires for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage questionnaire questions" on public.questionnaire_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manage questionnaire links" on public.questionnaire_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read questionnaire responses" on public.questionnaire_responses for select to authenticated using (public.is_admin());

create policy "admin manage interviews" on public.interviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "interviewer read own interviews" on public.interviews for select to authenticated using (interviewer_id=auth.uid());
create policy "interviewer update own interviews" on public.interviews for update to authenticated using (interviewer_id=auth.uid()) with check (interviewer_id=auth.uid());

create policy "admin read evaluations" on public.evaluations for select to authenticated using (public.is_admin());
create policy "interviewer read own evaluations" on public.evaluations for select to authenticated using (interviewer_id=auth.uid());
create policy "interviewer insert own evaluations" on public.evaluations for insert to authenticated with check (interviewer_id=auth.uid());
create policy "interviewer update own evaluations" on public.evaluations for update to authenticated using (interviewer_id=auth.uid()) with check (interviewer_id=auth.uid());

create policy "admin read audit" on public.audit_log for select to authenticated using (public.is_admin());

-- Import audit and column mapping per cycle
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  file_name text not null,
  row_count int not null default 0,
  imported_count int not null default 0,
  rejected_count int not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.import_batches enable row level security;
create policy "admin manage import batches" on public.import_batches for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Evaluation form can evolve without code changes.
create table if not exists public.evaluation_templates (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid references public.cycles(id) on delete cascade,
  name text not null default 'חוות דעת ראיון',
  version int not null default 1,
  fields jsonb not null default '[{"key":"professional_score","label":"ציון מקצועי","type":"rating","min":1,"max":5},{"key":"personal_score","label":"ציון אישי","type":"rating","min":1,"max":5},{"key":"recommendation","label":"המלצה","type":"recommendation"},{"key":"notes","label":"הערות","type":"long_text"}]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.evaluation_templates enable row level security;
create policy "admin manage evaluation templates" on public.evaluation_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "interviewer read evaluation templates" on public.evaluation_templates for select to authenticated using (true);

-- Public questionnaire access is performed through SECURITY DEFINER functions.
-- The token is unguessable (UUID) and can expire; candidates never receive table-level access.
create or replace function public.get_public_questionnaire(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.questionnaire_links;
  v_questionnaire public.questionnaires;
  v_candidate public.candidates;
  v_questions jsonb;
begin
  select * into v_link
  from public.questionnaire_links
  where token = p_token
    and submitted_at is null
    and (expires_at is null or expires_at > now());

  if v_link.id is null then
    raise exception 'INVALID_OR_EXPIRED_TOKEN';
  end if;

  select * into v_questionnaire from public.questionnaires where cycle_id = v_link.cycle_id;
  select * into v_candidate from public.candidates where id = v_link.candidate_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'field_key', q.field_key,
    'label', q.label,
    'field_type', q.field_type,
    'required', q.required,
    'options', q.options,
    'position', q.position
  ) order by q.position), '[]'::jsonb)
  into v_questions
  from public.questionnaire_questions q
  where q.questionnaire_id = v_questionnaire.id
    and q.version = v_questionnaire.active_version;

  return jsonb_build_object(
    'questionnaire_id', v_questionnaire.id,
    'title', v_questionnaire.title,
    'version', v_questionnaire.active_version,
    'candidate_name', v_candidate.full_name,
    'questions', v_questions
  );
end;
$$;

create or replace function public.submit_public_questionnaire(p_token uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.questionnaire_links;
  v_questionnaire public.questionnaires;
begin
  select * into v_link
  from public.questionnaire_links
  where token = p_token
    and submitted_at is null
    and (expires_at is null or expires_at > now())
  for update;

  if v_link.id is null then
    raise exception 'INVALID_OR_EXPIRED_TOKEN';
  end if;

  select * into v_questionnaire from public.questionnaires where cycle_id = v_link.cycle_id;

  insert into public.questionnaire_responses(questionnaire_id, candidate_id, cycle_id, version, answers)
  values(v_questionnaire.id, v_link.candidate_id, v_link.cycle_id, v_questionnaire.active_version, coalesce(p_answers, '{}'::jsonb))
  on conflict(questionnaire_id, candidate_id, cycle_id)
  do update set answers = excluded.answers, version = excluded.version, submitted_at = now();

  update public.questionnaire_links set submitted_at = now() where id = v_link.id;

  return jsonb_build_object('ok', true, 'candidate_id', v_link.candidate_id, 'cycle_id', v_link.cycle_id);
end;
$$;

grant execute on function public.get_public_questionnaire(uuid) to anon, authenticated;
grant execute on function public.submit_public_questionnaire(uuid, jsonb) to anon, authenticated;

-- Interviewers may read the active questionnaire and the response only for candidates assigned to them.
create policy "interviewer read assigned questionnaires" on public.questionnaires for select to authenticated using (
  exists(select 1 from public.cycle_units cu where cu.cycle_id=questionnaires.cycle_id and cu.interviewer_id=auth.uid())
);
create policy "interviewer read assigned questionnaire questions" on public.questionnaire_questions for select to authenticated using (
  exists(
    select 1 from public.questionnaires qu
    join public.cycle_units cu on cu.cycle_id=qu.cycle_id
    where qu.id=questionnaire_questions.questionnaire_id and cu.interviewer_id=auth.uid()
  )
);
create policy "interviewer read assigned questionnaire responses" on public.questionnaire_responses for select to authenticated using (
  exists(
    select 1 from public.interviews i
    where i.candidate_id=questionnaire_responses.candidate_id
      and i.cycle_id=questionnaire_responses.cycle_id
      and i.interviewer_id=auth.uid()
  )
);
