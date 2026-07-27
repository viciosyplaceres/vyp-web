-- VYP — Participantes ligados a miembros reales (uno por año) + Deudas

-- =========================================================
-- PARTICIPANTES: ahora es "talla + pago de este miembro en este año", no una
-- ficha manual con nombre libre. La tabla estaba vacía en producción, así que
-- se puede remodelar sin migrar datos.
-- =========================================================

alter table public.participantes add column if not exists perfil_id uuid
  references public.perfiles(id) on delete cascade;

alter table public.participantes drop column if exists nombre;
alter table public.participantes drop column if exists notas;

-- Un miembro no puede tener dos fichas el mismo año: se actualiza por upsert.
create unique index if not exists participantes_perfil_anio_unico
  on public.participantes (perfil_id, anio);

alter table public.participantes alter column perfil_id set not null;

-- =========================================================
-- DEUDAS: quién le debe dinero a quién. Cualquiera de las dos partes puede
-- ser "la peña" (VYP) en vez de un miembro concreto — por eso ambas columnas
-- son NULL-ables: NULL significa "VYP".
-- =========================================================

create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  deudor_id uuid references public.perfiles(id) on delete cascade,
  acreedor_id uuid references public.perfiles(id) on delete cascade,
  cantidad numeric(10,2) not null check (cantidad > 0),
  descripcion text,
  pagada boolean not null default false,
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Ambas a la vez "VYP" (las dos NULL) no tiene sentido, y tampoco que el
  -- mismo miembro sea deudor y acreedor de sí mismo.
  constraint deudas_no_ambas_vyp check (not (deudor_id is null and acreedor_id is null)),
  constraint deudas_no_a_si_mismo check (
    deudor_id is null or acreedor_id is null or deudor_id <> acreedor_id
  )
);

create index if not exists deudas_deudor_idx on public.deudas(deudor_id);
create index if not exists deudas_acreedor_idx on public.deudas(acreedor_id);

-- =========================================================
-- RLS: dinero de la peña, es cosa exclusiva de la directiva — igual que
-- `participantes` ya lo era.
-- =========================================================

alter table public.deudas enable row level security;

drop policy if exists deudas_all on public.deudas;
create policy deudas_all on public.deudas
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

grant select, insert, update, delete on public.deudas to authenticated;
revoke all on public.deudas from anon;
