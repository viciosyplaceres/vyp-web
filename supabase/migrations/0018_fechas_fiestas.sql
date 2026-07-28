-- Fechas de las fiestas de cada año, para que la limpieza (y cualquier otra
-- cosa que dependa de "cuándo son las fiestas") no dependa de un rango
-- escrito a mano en el código. Las fija la directiva desde Gestión.

create table if not exists public.fiestas_fechas (
  anio int primary key check (anio between 2010 and 2100),
  fecha_inicio date not null,
  fecha_fin date not null,
  actualizado_at timestamptz not null default now(),
  constraint fiestas_fechas_rango check (fecha_fin >= fecha_inicio)
);

alter table public.fiestas_fechas enable row level security;

drop policy if exists fiestas_fechas_select on public.fiestas_fechas;
create policy fiestas_fechas_select on public.fiestas_fechas
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists fiestas_fechas_escribe on public.fiestas_fechas;
create policy fiestas_fechas_escribe on public.fiestas_fechas
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

revoke all on public.fiestas_fechas from anon;
grant select, insert, update, delete on public.fiestas_fechas to authenticated;

-- Las fechas que ya estaban escritas a mano en el código para 2026, para que
-- nada cambie de golpe el día que se despliegue esto.
insert into public.fiestas_fechas (anio, fecha_inicio, fecha_fin)
values (2026, '2026-08-22', '2026-08-31')
on conflict (anio) do nothing;
