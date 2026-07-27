-- VYP — Tareas de las fiestas, avatares/usuario en el perfil y reparto de la compra

-- =========================================================
-- PERFILES: avatar y nombre de usuario
-- =========================================================

alter table public.perfiles add column if not exists avatar_url text;
alter table public.perfiles add column if not exists usuario text;

-- Único sin distinguir mayúsculas: "Pepe" y "pepe" no pueden coexistir.
create unique index if not exists perfiles_usuario_unico
  on public.perfiles (lower(usuario))
  where usuario is not null;

-- =========================================================
-- TAREAS
-- =========================================================

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  descripcion text,
  fecha date,
  hecha boolean not null default false,
  hecha_por uuid references public.perfiles(id) on delete set null,
  hecha_en timestamptz,
  documento_url text,
  documento_nombre text,
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tareas_fecha_idx on public.tareas(fecha);

-- Quién se encarga de cada tarea (puede ser más de uno)
create table if not exists public.tareas_miembros (
  tarea_id uuid not null references public.tareas(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  primary key (tarea_id, perfil_id)
);

create index if not exists tareas_miembros_perfil_idx
  on public.tareas_miembros(perfil_id);

-- Quién compra cada cosa de la lista (puede ser más de uno)
create table if not exists public.compra_miembros (
  item_id uuid not null references public.lista_compra(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  primary key (item_id, perfil_id)
);

create index if not exists compra_miembros_perfil_idx
  on public.compra_miembros(perfil_id);

-- =========================================================
-- Helpers: ¿me han asignado esto?
-- Viven en `private` (esquema no expuesto) porque son SECURITY DEFINER.
-- =========================================================

create or replace function private.tarea_asignada(p_tarea uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tareas_miembros
    where tarea_id = p_tarea and perfil_id = auth.uid()
  );
$$;

create or replace function private.compra_asignada(p_item uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.compra_miembros
    where item_id = p_item and perfil_id = auth.uid()
  );
$$;

revoke all on function private.tarea_asignada(uuid) from public;
revoke all on function private.compra_asignada(uuid) from public;
grant execute on function private.tarea_asignada(uuid) to authenticated;
grant execute on function private.compra_asignada(uuid) to authenticated;

-- =========================================================
-- Triggers: un miembro asignado solo puede marcar HECHO/COMPRADO
--
-- El RLS de Postgres decide por FILAS, no por columnas. Sin esto, dejar que
-- un asignado actualice su tarea le permitiría también cambiarle el título o
-- la fecha. El trigger revierte cualquier otro campo si no eres admin, igual
-- que ya se hace en `perfiles` con rol/aprobado.
-- =========================================================

create or replace function public.tareas_solo_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not private.es_admin() then
    new.titulo := old.titulo;
    new.descripcion := old.descripcion;
    new.fecha := old.fecha;
    new.documento_url := old.documento_url;
    new.documento_nombre := old.documento_nombre;
    new.creado_por := old.creado_por;
  end if;
  return new;
end;
$$;

drop trigger if exists tareas_before_update on public.tareas;
create trigger tareas_before_update
  before update on public.tareas
  for each row execute function public.tareas_solo_marcar();

create or replace function public.compra_solo_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not private.es_admin() then
    new.item := old.item;
    new.cantidad := old.cantidad;
    new.anio := old.anio;
    new.notas := old.notas;
  end if;
  return new;
end;
$$;

drop trigger if exists compra_before_update on public.lista_compra;
create trigger compra_before_update
  before update on public.lista_compra
  for each row execute function public.compra_solo_marcar();

-- =========================================================
-- RLS
-- =========================================================

alter table public.tareas enable row level security;
alter table public.tareas_miembros enable row level security;
alter table public.compra_miembros enable row level security;

-- Tareas: las ven todos los miembros (es la organización de la peña),
-- las crea y edita la directiva, y las marca hechas quien las tiene asignadas.
drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists tareas_insert on public.tareas;
create policy tareas_insert on public.tareas
  for insert to authenticated
  with check ( private.es_admin() );

drop policy if exists tareas_update on public.tareas;
create policy tareas_update on public.tareas
  for update to authenticated
  using ( private.es_admin() or private.tarea_asignada(id) )
  with check ( private.es_admin() or private.tarea_asignada(id) );

drop policy if exists tareas_delete on public.tareas;
create policy tareas_delete on public.tareas
  for delete to authenticated
  using ( private.es_admin() );

-- Asignaciones de tareas: visibles para miembros, solo la directiva reparte.
drop policy if exists tareas_miembros_select on public.tareas_miembros;
create policy tareas_miembros_select on public.tareas_miembros
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists tareas_miembros_insert on public.tareas_miembros;
create policy tareas_miembros_insert on public.tareas_miembros
  for insert to authenticated
  with check ( private.es_admin() );

drop policy if exists tareas_miembros_delete on public.tareas_miembros;
create policy tareas_miembros_delete on public.tareas_miembros
  for delete to authenticated
  using ( private.es_admin() );

-- Asignaciones de compra: igual.
drop policy if exists compra_miembros_select on public.compra_miembros;
create policy compra_miembros_select on public.compra_miembros
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists compra_miembros_insert on public.compra_miembros;
create policy compra_miembros_insert on public.compra_miembros
  for insert to authenticated
  with check ( private.es_admin() );

drop policy if exists compra_miembros_delete on public.compra_miembros;
create policy compra_miembros_delete on public.compra_miembros
  for delete to authenticated
  using ( private.es_admin() );

-- =========================================================
-- lista_compra: ahora los miembros la VEN (necesitan saber qué les toca)
-- y pueden marcar comprado lo suyo. Crear y borrar sigue siendo de la
-- directiva. `participantes` (pagos y tallas) NO cambia: sigue solo-admin.
-- =========================================================

drop policy if exists lista_compra_all on public.lista_compra;

drop policy if exists lista_compra_select on public.lista_compra;
create policy lista_compra_select on public.lista_compra
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists lista_compra_insert on public.lista_compra;
create policy lista_compra_insert on public.lista_compra
  for insert to authenticated
  with check ( private.es_admin() );

drop policy if exists lista_compra_update on public.lista_compra;
create policy lista_compra_update on public.lista_compra
  for update to authenticated
  using ( private.es_admin() or private.compra_asignada(id) )
  with check ( private.es_admin() or private.compra_asignada(id) );

drop policy if exists lista_compra_delete on public.lista_compra;
create policy lista_compra_delete on public.lista_compra
  for delete to authenticated
  using ( private.es_admin() );

-- =========================================================
-- GRANTS (Supabase no expone tablas nuevas sin esto; y `anon` no pinta nada
-- en la organización interna de la peña)
-- =========================================================

grant select, insert, update, delete on public.tareas to authenticated;
grant select, insert, delete on public.tareas_miembros to authenticated;
grant select, insert, delete on public.compra_miembros to authenticated;

revoke all on public.tareas from anon;
revoke all on public.tareas_miembros from anon;
revoke all on public.compra_miembros from anon;

-- La vista de autores ahora incluye el avatar y el nombre de usuario: son
-- datos públicos (quién comenta, quién sube), nunca rol ni aprobación.
create or replace view public.autores as
  select id, nombre, usuario, avatar_url from public.perfiles;

grant select on public.autores to anon, authenticated;
