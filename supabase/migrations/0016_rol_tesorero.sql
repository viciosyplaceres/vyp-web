-- Rol "tesorero": puede marcar quién ha pagado la cuota, igual que la
-- directiva, pero no puede aprobar miembros ni tocar el almacenamiento (esas
-- dos siguen siendo solo de `rol = 'admin'`).
--
-- Además, dar o quitar roles pasa a ser un permiso aparte
-- (`puede_asignar_roles`), no algo que traiga de serie ser admin: por
-- defecto solo lo tiene quien ya era admin antes de esta migración. Si esa
-- persona asciende a alguien más a admin o a tesorero, el ascendido NO
-- hereda la capacidad de repartir roles — solo la reparte quien ya la tenía.

alter table public.perfiles
  drop constraint if exists perfiles_rol_check;
alter table public.perfiles
  add constraint perfiles_rol_check check (rol in ('miembro','tesorero','admin'));

alter table public.perfiles
  add column if not exists puede_asignar_roles boolean not null default false;

update public.perfiles set puede_asignar_roles = true where rol = 'admin';

create or replace function private.es_tesorero()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'tesorero' and aprobado = true
  );
$$;

revoke all on function private.es_tesorero() from public;
grant execute on function private.es_tesorero() to authenticated;

create or replace function private.puede_asignar_roles()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and puede_asignar_roles = true and aprobado = true
  );
$$;

revoke all on function private.puede_asignar_roles() from public;
grant execute on function private.puede_asignar_roles() to authenticated;

-- Pagos: el tesorero marca igual que la directiva. El resto sigue viendo
-- pero no tocando (política de solo lectura ya existente, sin cambios).
drop policy if exists pagos_escribe on public.pagos;
create policy pagos_escribe on public.pagos
  for all to authenticated
  using ( private.es_admin() or private.es_tesorero() )
  with check ( private.es_admin() or private.es_tesorero() );

-- Nadie puede cambiar el rol (propio o ajeno) ni concederse la capacidad de
-- repartir roles sin tenerla ya. La política de `perfiles` deja escribir el
-- propio perfil o, siendo admin, el de cualquiera — hace falta un trigger
-- para proteger estas dos columnas en concreto, igual que ya se hace con
-- `compra_solo_marcar` en la lista de la compra.
create or replace function public.perfiles_solo_rol_con_permiso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.rol is distinct from old.rol
      or new.puede_asignar_roles is distinct from old.puede_asignar_roles)
     and not private.puede_asignar_roles() then
    new.rol := old.rol;
    new.puede_asignar_roles := old.puede_asignar_roles;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_before_update_rol on public.perfiles;
create trigger perfiles_before_update_rol
  before update on public.perfiles
  for each row execute function public.perfiles_solo_rol_con_permiso();
