-- Mini Agenda: biblioteca de contenido generado con IA.
-- Guarda cada resumen, test y repaso para poder reutilizarlo sin volver a llamar a Claude.
-- Pégalo en Supabase > SQL Editor > New query y pulsa Run. Se puede ejecutar más de una vez.

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
