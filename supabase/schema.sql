-- Mini Agenda: tablas, reglas de acceso y contador de uso de la IA.
-- Pégalo entero en Supabase > SQL Editor > New query y pulsa Run.

-- Tareas (exámenes, deberes, proyectos). Cada fila guarda la tarea completa en "data".
create table if not exists public.tasks (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Perfil: nombre, edad y curso de quien usa la agenda.
create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cuántas veces al día usa cada persona la IA (para poner un tope de gasto).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day     date not null default current_date,
  count   int  not null default 0,
  primary key (user_id, day)
);

-- Cada persona solo puede ver y cambiar lo suyo.
alter table public.tasks    enable row level security;
alter table public.profiles enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "tasks: own rows" on public.tasks;
create policy "tasks: own rows" on public.tasks
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ai_usage no tiene políticas: solo se toca a través de esta función.
create or replace function public.bump_ai_usage()
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;

-- Avisos en tiempo real, para que lo apuntado en un dispositivo aparezca en los demás.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

-- Biblioteca de contenido generado con IA (también en supabase/biblioteca.sql).
create table if not exists public.ai_library (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  kind       text not null check (kind in ('study', 'quiz', 'review')),
  topic_key  text not null,
  lang       text not null,
  subject    text,
  topic      text,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_library_lookup
  on public.ai_library (user_id, topic_key, lang, kind, created_at desc);

alter table public.ai_library enable row level security;

drop policy if exists "ai_library: own rows" on public.ai_library;
create policy "ai_library: own rows" on public.ai_library
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
