-- VYP — Turnos de limpieza del 22 al 31 de agosto, sorteados a dados
--
-- Son 10 días: del 22 al 30 limpian 2 personas cada día, y el 31 —que no es
-- solo limpieza, sino "limpieza y desmontaje"— van 3. En total 21 turnos.
--
-- El reparto se sortea con un dado y se guarda aquí para que sea el mismo
-- para toda la peña: quien lo tira es la directiva, pero el resultado lo ve
-- (y lo sufre) todo el mundo, así que no puede vivir en el navegador de
-- nadie.

-- =========================================================
-- El número que le toca a cada uno en el dado
--
-- Se guarda en vez de derivarlo del orden alfabético porque el sorteo hay que
-- poder mirarlo después y que siga cuadrando: si entra alguien nuevo o alguien
-- se cambia el nombre, los números del sorteo ya hecho no deben moverse.
-- =========================================================

create table if not exists public.limpieza_numeros (
  anio int not null check (anio between 2010 and 2100),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  numero int not null check (numero >= 1),
  primary key (anio, perfil_id),
  -- Dos personas con el mismo número harían el sorteo imposible de leer.
  unique (anio, numero)
);

alter table public.limpieza_numeros enable row level security;

drop policy if exists limpieza_numeros_select on public.limpieza_numeros;
create policy limpieza_numeros_select on public.limpieza_numeros
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists limpieza_numeros_escribe on public.limpieza_numeros;
create policy limpieza_numeros_escribe on public.limpieza_numeros
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

revoke all on public.limpieza_numeros from anon;
grant select, insert, update, delete on public.limpieza_numeros to authenticated;

-- =========================================================
-- Quién limpia cada día
-- =========================================================

create table if not exists public.limpieza_turnos (
  anio int not null check (anio between 2010 and 2100),
  fecha date not null,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Nadie puede salir dos veces el mismo día: sería un turno regalado.
  primary key (anio, fecha, perfil_id)
);

create index if not exists limpieza_turnos_perfil_idx
  on public.limpieza_turnos (perfil_id, fecha);

alter table public.limpieza_turnos enable row level security;

-- Lo ve toda la peña (cada uno necesita saber qué día le toca), pero el
-- sorteo lo lanza y lo retoca solo la directiva.
drop policy if exists limpieza_turnos_select on public.limpieza_turnos;
create policy limpieza_turnos_select on public.limpieza_turnos
  for select to authenticated
  using ( private.es_miembro() );

drop policy if exists limpieza_turnos_escribe on public.limpieza_turnos;
create policy limpieza_turnos_escribe on public.limpieza_turnos
  for all to authenticated
  using ( private.es_admin() )
  with check ( private.es_admin() );

revoke all on public.limpieza_turnos from anon;
grant select, insert, update, delete on public.limpieza_turnos to authenticated;

-- Tiempo real: cuando la directiva tira los dados, el reparto aparece solo en
-- el móvil de todos sin tener que recargar.
do $$
begin
  begin
    alter publication supabase_realtime add table public.limpieza_turnos;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.limpieza_numeros;
  exception when duplicate_object then null;
  end;
end $$;
