-- Ubicación pública editable, reglas anuales de limpieza y purga total del chat.

-- La sede actual es configuración global: si la peña se muda basta cambiarla
-- desde Gestión. Se conservan los valores que ya estaban escritos en page.tsx.
alter table public.configuracion
  add column if not exists ubicacion_nombre text not null default 'Fuente Álamo · Murcia',
  add column if not exists ubicacion_direccion text not null default 'C. Asturias, 30320 Fuente Álamo, Murcia',
  add column if not exists ubicacion_maps_url text not null default 'https://www.google.com/maps/dir/?api=1&destination=37.717352,-1.17391',
  add column if not exists ubicacion_latitud double precision not null default 37.717352,
  add column if not exists ubicacion_longitud double precision not null default -1.17391,
  add column if not exists ubicacion_actualizada_at timestamptz not null default now();

alter table public.configuracion
  drop constraint if exists configuracion_latitud_valida,
  add constraint configuracion_latitud_valida
    check (ubicacion_latitud between -90 and 90),
  drop constraint if exists configuracion_longitud_valida,
  add constraint configuracion_longitud_valida
    check (ubicacion_longitud between -180 and 180);

-- Año y ubicación son datos públicos que ya aparecen en la portada. Las
-- actualizaciones siguen protegidas por la política admin existente.
drop policy if exists configuracion_select on public.configuracion;
create policy configuracion_select on public.configuracion
  for select to anon, authenticated
  using (id = true);

grant select on public.configuracion to anon, authenticated;
grant update on public.configuracion to authenticated;

-- La cantidad de personas por turno puede variar cada año igual que las
-- fechas; no debe obligar a tocar constantes ni textos de la aplicación.
alter table public.fiestas_fechas
  add column if not exists plazas_limpieza smallint not null default 2,
  add column if not exists plazas_desmontaje smallint not null default 3;

alter table public.fiestas_fechas
  drop constraint if exists fiestas_plazas_limpieza_validas,
  add constraint fiestas_plazas_limpieza_validas
    check (plazas_limpieza between 1 and 20),
  drop constraint if exists fiestas_plazas_desmontaje_validas,
  add constraint fiestas_plazas_desmontaje_validas
    check (plazas_desmontaje between 1 and 20);

-- Borrado físico y atómico. Es SECURITY DEFINER porque chat_lecturas no deja
-- borrar a usuarios normales; la comprobación interna y los grants impiden
-- que se convierta en una puerta trasera pública.
create or replace function public.vaciar_historial_chat()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  mensajes_borrados integer;
begin
  if not (select private.es_admin()) then
    raise exception 'Solo la directiva puede borrar el historial del chat.'
      using errcode = '42501';
  end if;

  delete from public.mensajes;
  get diagnostics mensajes_borrados = row_count;

  -- Las reacciones desaparecen por ON DELETE CASCADE desde mensajes.
  delete from public.chat_lecturas;

  return mensajes_borrados;
end;
$$;

revoke all on function public.vaciar_historial_chat() from public, anon;
grant execute on function public.vaciar_historial_chat() to authenticated;
