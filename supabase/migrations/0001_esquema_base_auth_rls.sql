-- VYP — F2: esquema base, auth, RLS
-- Esquema privado para funciones que no deben ser callables desde la Data API
create schema if not exists private;

-- =========================================================
-- TABLAS
-- =========================================================

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text not null default 'miembro' check (rol in ('miembro','admin')),
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('foto','video')),
  anio int not null check (anio between 2010 and 2100),
  storage_id text not null,
  url text not null,
  thumb_url text,
  ancho int,
  alto int,
  duracion_s int,
  descripcion text,
  subido_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pistas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  artista text,
  tipo text not null check (tipo in ('sesion','cancion')),
  anio int check (anio between 2010 and 2100),
  origen text not null check (origen in ('r2','mixcloud','soundcloud')),
  url text not null,
  embed_url text,
  duracion_s int,
  subido_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  media_id uuid references public.media(id) on delete cascade,
  pista_id uuid references public.pistas(id) on delete cascade,
  autor_id uuid references public.perfiles(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  created_at timestamptz not null default now(),
  constraint comentarios_un_solo_destino check (
    ((media_id is not null)::int + (pista_id is not null)::int) = 1
  )
);

create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pagado boolean not null default false,
  importe numeric(10,2),
  talla_camiseta text,
  notas text,
  anio int not null check (anio between 2010 and 2100)
);

create table if not exists public.lista_compra (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  cantidad int not null default 1,
  comprado boolean not null default false,
  anio int not null check (anio between 2010 and 2100),
  notas text
);

create index if not exists media_anio_idx on public.media(anio);
create index if not exists pistas_anio_idx on public.pistas(anio);
create index if not exists comentarios_media_idx on public.comentarios(media_id);
create index if not exists comentarios_pista_idx on public.comentarios(pista_id);
create index if not exists participantes_anio_idx on public.participantes(anio);
create index if not exists lista_compra_anio_idx on public.lista_compra(anio);

-- =========================================================
-- FUNCIONES PRIVADAS (no expuestas por la Data API)
-- =========================================================

create or replace function private.es_miembro()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and aprobado = true
  );
$$;

create or replace function private.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and aprobado = true
  );
$$;

revoke all on function private.es_miembro() from public;
revoke all on function private.es_admin() from public;
grant execute on function private.es_miembro() to authenticated;
grant execute on function private.es_admin() to authenticated;

-- =========================================================
-- ALTA AUTOMÁTICA DE PERFIL AL REGISTRARSE
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol, aprobado)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)), 'miembro', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Impide que un miembro se autoapruebe o se autoasigne rol admin
create or replace function public.perfiles_bloquea_autopromocion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.es_admin() then
    new.rol := old.rol;
    new.aprobado := old.aprobado;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_before_update on public.perfiles;
create trigger perfiles_before_update
  before update on public.perfiles
  for each row execute function public.perfiles_bloquea_autopromocion();

-- =========================================================
-- RLS
-- =========================================================

alter table public.perfiles enable row level security;
alter table public.media enable row level security;
alter table public.pistas enable row level security;
alter table public.comentarios enable row level security;
alter table public.participantes enable row level security;
alter table public.lista_compra enable row level security;

-- perfiles: cada uno ve el suyo, admin ve todos
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using ( id = auth.uid() or private.es_admin() );

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using ( id = auth.uid() or private.es_admin() )
  with check ( id = auth.uid() or private.es_admin() );

-- media: todo el mundo ve, solo miembros aprobados suben, dueño o admin borra/edita
drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to anon, authenticated
  using ( true );

drop policy if exists media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated
  with check ( private.es_miembro() and subido_por = auth.uid() );

drop policy if exists media_update on public.media;
create policy media_update on public.media
  for update to authenticated
  using ( subido_por = auth.uid() or private.es_admin() )
  with check ( subido_por = auth.uid() or private.es_admin() );

drop policy if exists media_delete on public.media;
create policy media_delete on public.media
  for delete to authenticated
  using ( subido_por = auth.uid() or private.es_admin() );

-- pistas: igual que media
drop policy if exists pistas_select on public.pistas;
create policy pistas_select on public.pistas
  for select to anon, authenticated
  using ( true );

drop policy if exists pistas_insert on public.pistas;
create policy pistas_insert on public.pistas
  for insert to authenticated
  with check ( private.es_miembro() and subido_por = auth.uid() );

drop policy if exists pistas_update on public.pistas;
create policy pistas_update on public.pistas
  for update to authenticated
  using ( subido_por = auth.uid() or private.es_admin() )
  with check ( subido_por = auth.uid() or private.es_admin() );

drop policy if exists pistas_delete on public.pistas;
create policy pistas_delete on public.pistas
  for delete to authenticated
  using ( subido_por = auth.uid() or private.es_admin() );

-- comentarios: todo el mundo ve, solo miembros aprobados comentan, autor o admin borra
drop policy if exists comentarios_select on public.comentarios;
create policy comentarios_select on public.comentarios
  for select to anon, authenticated
  using ( true );

drop policy if exists comentarios_insert on public.comentarios;
create policy comentarios_insert on public.comentarios
  for insert to authenticated
  with check ( private.es_miembro() and autor_id = auth.uid() );

drop policy if exists comentarios_delete on public.comentarios;
create policy comentarios_delete on public.comentarios
  for delete to authenticated
  using ( autor_id = auth.uid() or private.es_admin() );

-- participantes y lista_compra: solo admin, ni siquiera lectura pública
drop policy if exists participantes_all on public.participantes;
create policy participantes_all on public.participantes
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

drop policy if exists lista_compra_all on public.lista_compra;
create policy lista_compra_all on public.lista_compra
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

-- =========================================================
-- GRANTS (la Data API no expone tablas nuevas por SQL crudo sin esto)
-- =========================================================

grant usage on schema public to anon, authenticated;

grant select on public.media, public.pistas, public.comentarios to anon, authenticated;
grant insert, update, delete on public.media, public.pistas, public.comentarios to authenticated;

grant select, update on public.perfiles to authenticated;

grant select, insert, update, delete on public.participantes, public.lista_compra to authenticated;
