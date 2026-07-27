-- VYP — Chat interno de miembros + suscripciones de notificaciones push

-- =========================================================
-- CHAT INTERNO (solo miembros aprobados: ni ven ni escriben los demás)
-- =========================================================

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists mensajes_created_idx on public.mensajes(created_at desc);

alter table public.mensajes enable row level security;

-- A diferencia de media/pistas/comentarios, aquí NO hay política para anon:
-- el chat es invisible para quien no sea miembro aprobado.
drop policy if exists mensajes_select on public.mensajes;
create policy mensajes_select on public.mensajes
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists mensajes_insert on public.mensajes;
create policy mensajes_insert on public.mensajes
  for insert to authenticated
  with check ( private.es_miembro() and autor_id = auth.uid() );

drop policy if exists mensajes_delete on public.mensajes;
create policy mensajes_delete on public.mensajes
  for delete to authenticated
  using ( autor_id = auth.uid() or private.es_admin() );

revoke all on public.mensajes from anon;
grant select, insert, delete on public.mensajes to authenticated;

-- Realtime: para que el chat llegue en vivo sin recargar
alter publication supabase_realtime add table public.mensajes;

-- =========================================================
-- SUSCRIPCIONES PUSH (una por dispositivo/navegador)
-- =========================================================

create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subs_user_idx on public.push_subs(user_id);

alter table public.push_subs enable row level security;

-- Cada usuario solo gestiona sus propias suscripciones.
-- El envío real de notificaciones lo hace el servidor con service_role.
drop policy if exists push_subs_select on public.push_subs;
create policy push_subs_select on public.push_subs
  for select to authenticated
  using ( user_id = auth.uid() );

drop policy if exists push_subs_insert on public.push_subs;
create policy push_subs_insert on public.push_subs
  for insert to authenticated
  with check ( private.es_miembro() and user_id = auth.uid() );

drop policy if exists push_subs_delete on public.push_subs;
create policy push_subs_delete on public.push_subs
  for delete to authenticated
  using ( user_id = auth.uid() );

revoke all on public.push_subs from anon;
grant select, insert, delete on public.push_subs to authenticated;

-- =========================================================
-- Vista de autores públicos.
--
-- Los comentarios son públicos, así que el NOMBRE de quien los escribe debe
-- poder leerse por cualquiera. Pero la política RLS de `perfiles` solo deja ver
-- el perfil propio (o todos si eres admin), lo cual es correcto para no exponer
-- `rol`/`aprobado` de terceros.
--
-- Por eso esta vista se deja deliberadamente como SECURITY DEFINER (el defecto
-- de Postgres para vistas): expone ÚNICAMENTE `id` y `nombre`, nunca `rol`,
-- `aprobado` ni `created_at`. Es la excepción consciente a la regla de
-- security_invoker, y está acotada a dos columnas no sensibles.
-- =========================================================

create or replace view public.autores as
  select id, nombre from public.perfiles;

grant select on public.autores to anon, authenticated;
