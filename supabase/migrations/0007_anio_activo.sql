-- VYP — Año de gestión activo: se elige una vez y todo lo demás lo hereda
--
-- Antes había que elegir el año cada vez que se entraba a Tareas o
-- Participantes. Con esto la directiva lo fija una vez al año y el resto del
-- tiempo no hay que tocarlo — aunque en Participantes se deja la posibilidad
-- de mirar otros años, por si hace falta repasar un año anterior.

create table if not exists public.configuracion (
  id boolean primary key default true,
  anio_activo int not null default 2026 check (anio_activo between 2010 and 2100),
  -- Una sola fila para siempre: si alguien intentara insertar una segunda,
  -- el propio tipo de la clave primaria (siempre `true`) lo impide.
  constraint configuracion_fila_unica check (id)
);

insert into public.configuracion (id, anio_activo)
values (true, 2026)
on conflict (id) do nothing;

alter table public.configuracion enable row level security;

-- Cualquiera con sesión puede leerlo (hace falta para pintar "Tareas de
-- agosto de <año>" en el perfil de un miembro normal); solo la directiva
-- puede cambiarlo.
drop policy if exists configuracion_select on public.configuracion;
create policy configuracion_select on public.configuracion
  for select to authenticated
  using ( true );

drop policy if exists configuracion_update on public.configuracion;
create policy configuracion_update on public.configuracion
  for update to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

grant select, update on public.configuracion to authenticated;
revoke all on public.configuracion from anon;
