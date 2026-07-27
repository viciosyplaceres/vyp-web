-- VYP — Chat profesional: responder, editar, eliminar, reacciones, visto y no leídos
-- Nada de multimedia aquí: eso ya vive en galería/música y así seguirá, para no
-- disparar el consumo de Cloudinary/R2 desde un canal que no se puede limitar.

-- =========================================================
-- MENSAJES: responder / editar / eliminar (borrado blando)
-- =========================================================

alter table public.mensajes
  add column if not exists respuesta_a uuid references public.mensajes(id) on delete set null,
  add column if not exists respuesta_texto text,
  add column if not exists respuesta_autor text,
  add column if not exists editado_at timestamptz,
  add column if not exists borrado boolean not null default false;

-- Igual que en `perfiles`: el autor puede tocar su propio mensaje (editarlo o
-- borrarlo en blando), pero no puede reasignárselo a otro ni falsear la fecha.
create or replace function public.mensajes_proteger_columnas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.es_admin() and auth.uid() is not null then
    new.autor_id := old.autor_id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists mensajes_before_update on public.mensajes;
create trigger mensajes_before_update
  before update on public.mensajes
  for each row execute function public.mensajes_proteger_columnas();

drop policy if exists mensajes_update on public.mensajes;
create policy mensajes_update on public.mensajes
  for update to authenticated
  using ( autor_id = auth.uid() or private.es_admin() )
  with check ( autor_id = auth.uid() or private.es_admin() );

-- El borrado ahora es una actualización (borrado=true), no un delete real:
-- así el hueco en la conversación se ve como "Mensaje eliminado", igual que en
-- WhatsApp, en vez de desaparecer sin dejar rastro. Se deja el delete físico
-- por si hiciera falta purgar algo a mano desde el panel de Supabase.
grant update on public.mensajes to authenticated;

-- =========================================================
-- REACCIONES (un emoji por persona y mensaje, como WhatsApp)
-- =========================================================

create table if not exists public.mensaje_reacciones (
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (mensaje_id, perfil_id)
);

alter table public.mensaje_reacciones enable row level security;

drop policy if exists mensaje_reacciones_select on public.mensaje_reacciones;
create policy mensaje_reacciones_select on public.mensaje_reacciones
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists mensaje_reacciones_upsert on public.mensaje_reacciones;
create policy mensaje_reacciones_upsert on public.mensaje_reacciones
  for insert to authenticated
  with check ( private.es_miembro() and perfil_id = auth.uid() );

drop policy if exists mensaje_reacciones_update on public.mensaje_reacciones;
create policy mensaje_reacciones_update on public.mensaje_reacciones
  for update to authenticated
  using ( perfil_id = auth.uid() )
  with check ( perfil_id = auth.uid() );

drop policy if exists mensaje_reacciones_delete on public.mensaje_reacciones;
create policy mensaje_reacciones_delete on public.mensaje_reacciones
  for delete to authenticated
  using ( perfil_id = auth.uid() );

revoke all on public.mensaje_reacciones from anon;
grant select, insert, update, delete on public.mensaje_reacciones to authenticated;

-- =========================================================
-- LECTURAS (para el doble check azul y la burbuja de no leídos)
--
-- Una fila por persona con la marca de tiempo de "hasta aquí he leído". No
-- hace falta una fila por mensaje: comparar `created_at` del mensaje contra
-- esta marca de cada miembro basta para saber quién lo ha visto y cuántos
-- mensajes tiene pendientes cualquiera.
-- =========================================================

create table if not exists public.chat_lecturas (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  ultimo_leido_at timestamptz not null default now()
);

alter table public.chat_lecturas enable row level security;

drop policy if exists chat_lecturas_select on public.chat_lecturas;
create policy chat_lecturas_select on public.chat_lecturas
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists chat_lecturas_upsert on public.chat_lecturas;
create policy chat_lecturas_upsert on public.chat_lecturas
  for insert to authenticated
  with check ( private.es_miembro() and perfil_id = auth.uid() );

drop policy if exists chat_lecturas_update on public.chat_lecturas;
create policy chat_lecturas_update on public.chat_lecturas
  for update to authenticated
  using ( perfil_id = auth.uid() )
  with check ( perfil_id = auth.uid() );

revoke all on public.chat_lecturas from anon;
grant select, insert, update on public.chat_lecturas to authenticated;

-- Tiempo real para las tres cosas: mensajes editados/borrados, reacciones que
-- llegan de otros, y marcas de lectura que mueven el doble check a azul.
alter publication supabase_realtime add table public.mensaje_reacciones;
alter publication supabase_realtime add table public.chat_lecturas;
