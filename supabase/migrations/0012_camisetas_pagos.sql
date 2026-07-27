-- VYP — Gestión abierta a todos los miembros: camisetas, pagos y tickets
--
-- Hasta ahora `Gestión` entera era cosa de la directiva. Se abre a cualquier
-- miembro aprobado, porque organizar las fiestas lo hace la peña, no solo la
-- junta. Siguen siendo SOLO de la directiva las dos cosas que de verdad lo
-- son: aprobar/eliminar cuentas y borrar archivos del almacenamiento.
--
-- Además se parte lo que era "participantes" (una ficha con talla + pago
-- mezclados) en dos cosas separadas, que es como se usan de verdad:
--   * `pagos`             → ¿ha pagado la cuota de este año? sí/no
--   * `pedidos_camiseta`  → cuántas camisetas quiere y de qué talla cada una
-- y se añade la votación del diseño de la camiseta.

-- =========================================================
-- PAGOS — solo si ha pagado o no. Sin importes.
-- =========================================================

create table if not exists public.pagos (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  anio int not null check (anio between 2010 and 2100),
  pagado boolean not null default false,
  actualizado_at timestamptz not null default now(),
  primary key (perfil_id, anio)
);

alter table public.pagos enable row level security;

-- Lo ve toda la peña (saber quién va al día es parte de organizarse), pero
-- marcar la casilla es de la directiva: es quien cobra.
drop policy if exists pagos_select on public.pagos;
create policy pagos_select on public.pagos
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists pagos_escribe on public.pagos;
create policy pagos_escribe on public.pagos
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

revoke all on public.pagos from anon;
grant select, insert, update, delete on public.pagos to authenticated;

-- =========================================================
-- CAMISETAS — los diseños propuestos, con foto, y su votación
-- =========================================================

create table if not exists public.camisetas (
  id uuid primary key default gen_random_uuid(),
  anio int not null check (anio between 2010 and 2100),
  titulo text check (titulo is null or char_length(titulo) <= 120),
  url text not null,
  storage_id text not null,
  bytes bigint,
  subido_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists camisetas_anio_idx on public.camisetas (anio, created_at desc);

alter table public.camisetas enable row level security;

-- Cualquier miembro propone un diseño; cada uno borra el suyo y la directiva
-- cualquiera (es la que limpia el almacenamiento).
drop policy if exists camisetas_select on public.camisetas;
create policy camisetas_select on public.camisetas
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists camisetas_insert on public.camisetas;
create policy camisetas_insert on public.camisetas
  for insert to authenticated
  with check ( private.es_miembro() and subido_por = auth.uid() );

drop policy if exists camisetas_delete on public.camisetas;
create policy camisetas_delete on public.camisetas
  for delete to authenticated
  using ( subido_por = auth.uid() or private.es_admin() );

revoke all on public.camisetas from anon;
grant select, insert, delete on public.camisetas to authenticated;

-- Un voto por persona y AÑO (no por camiseta): así "la más votada" del año
-- sale sola, y cambiar de opinión es mover tu único voto, no acumular.
create table if not exists public.camisetas_votos (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  anio int not null check (anio between 2010 and 2100),
  camiseta_id uuid not null references public.camisetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, anio)
);

create index if not exists camisetas_votos_camiseta_idx
  on public.camisetas_votos (camiseta_id);

alter table public.camisetas_votos enable row level security;

drop policy if exists camisetas_votos_select on public.camisetas_votos;
create policy camisetas_votos_select on public.camisetas_votos
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists camisetas_votos_insert on public.camisetas_votos;
create policy camisetas_votos_insert on public.camisetas_votos
  for insert to authenticated
  with check ( private.es_miembro() and perfil_id = auth.uid() );

drop policy if exists camisetas_votos_update on public.camisetas_votos;
create policy camisetas_votos_update on public.camisetas_votos
  for update to authenticated
  using ( perfil_id = auth.uid() )
  with check ( perfil_id = auth.uid() );

drop policy if exists camisetas_votos_delete on public.camisetas_votos;
create policy camisetas_votos_delete on public.camisetas_votos
  for delete to authenticated
  using ( perfil_id = auth.uid() );

revoke all on public.camisetas_votos from anon;
grant select, insert, update, delete on public.camisetas_votos to authenticated;

-- =========================================================
-- PEDIDOS DE CAMISETA — cuántas quiere cada uno y de qué talla
--
-- Las tallas van en un array de texto: una posición por camiseta pedida, así
-- que la cantidad es sencillamente cuántas tallas hay. Evita una tabla aparte
-- con un índice por camiseta para algo que siempre se lee y se guarda junto.
-- =========================================================

create table if not exists public.pedidos_camiseta (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  anio int not null check (anio between 2010 and 2100),
  tallas text[] not null default '{}',
  actualizado_at timestamptz not null default now(),
  primary key (perfil_id, anio),
  -- Un tope sano: nadie pide 500 camisetas, y evita que un fallo llene la fila.
  constraint pedidos_camiseta_tope check (array_length(tallas, 1) is null or array_length(tallas, 1) <= 20)
);

alter table public.pedidos_camiseta enable row level security;

-- Cada uno apunta lo suyo; la directiva puede corregir el de cualquiera
-- (siempre hay quien lo dice de palabra y no lo mete).
drop policy if exists pedidos_camiseta_select on public.pedidos_camiseta;
create policy pedidos_camiseta_select on public.pedidos_camiseta
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists pedidos_camiseta_insert on public.pedidos_camiseta;
create policy pedidos_camiseta_insert on public.pedidos_camiseta
  for insert to authenticated
  with check ( private.es_miembro() and (perfil_id = auth.uid() or private.es_admin()) );

drop policy if exists pedidos_camiseta_update on public.pedidos_camiseta;
create policy pedidos_camiseta_update on public.pedidos_camiseta
  for update to authenticated
  using ( perfil_id = auth.uid() or private.es_admin() )
  with check ( perfil_id = auth.uid() or private.es_admin() );

drop policy if exists pedidos_camiseta_delete on public.pedidos_camiseta;
create policy pedidos_camiseta_delete on public.pedidos_camiseta
  for delete to authenticated
  using ( perfil_id = auth.uid() or private.es_admin() );

revoke all on public.pedidos_camiseta from anon;
grant select, insert, update, delete on public.pedidos_camiseta to authenticated;

-- =========================================================
-- DEUDAS — ahora las ve toda la peña y admiten foto del ticket
-- =========================================================

alter table public.deudas
  add column if not exists ticket_url text,
  add column if not exists ticket_storage_id text;

-- Antes era `for all` solo-admin, así que un miembro normal ni las veía. Se
-- separa: leer toda la peña, tocar solo la directiva (es dinero).
drop policy if exists deudas_all on public.deudas;

drop policy if exists deudas_select on public.deudas;
create policy deudas_select on public.deudas
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists deudas_escribe on public.deudas;
create policy deudas_escribe on public.deudas
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

-- =========================================================
-- Tiempo real: la votación de la camiseta y las casillas de pago se ven
-- cambiar sin recargar, igual que ya pasa con las tareas y la compra.
-- =========================================================

do $$
begin
  begin
    alter publication supabase_realtime add table public.camisetas_votos;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.camisetas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pagos;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pedidos_camiseta;
  exception when duplicate_object then null;
  end;
end $$;
