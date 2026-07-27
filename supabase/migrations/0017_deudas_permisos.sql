-- Deudas: quién puede marcarlas como pagadas y quién puede borrarlas.
--
-- Hasta ahora todo (crear, marcar, borrar) era `es_admin()`. Se separa:
--   - Marcar como pagada: la directiva, el tesorero, O el propio acreedor
--     (a quien se le debe), si es un miembro concreto. Cuando la acreedora
--     es la propia peña (acreedor_id = NULL) no hay "el propio acreedor" al
--     que dejar entrar, así que solo quedan directiva y tesorero.
--   - Borrar: solo directiva y tesorero, nadie más (ni el acreedor).
--   - Crear: sigue siendo solo `es_admin()`, sin cambios — no se pidió tocar esto.

drop policy if exists deudas_escribe on public.deudas;

create policy deudas_insert on public.deudas
  for insert to authenticated
  with check ( private.es_admin() );

create policy deudas_update on public.deudas
  for update to authenticated
  using (
    private.es_admin() or private.es_tesorero()
    or (acreedor_id is not null and acreedor_id = auth.uid())
  )
  with check (
    private.es_admin() or private.es_tesorero()
    or (acreedor_id is not null and acreedor_id = auth.uid())
  );

create policy deudas_delete on public.deudas
  for delete to authenticated
  using ( private.es_admin() or private.es_tesorero() );

-- El acreedor que marca su propia deuda solo puede tocar `pagada`: sin este
-- trigger podría, con la política de arriba, cambiar también la cantidad o
-- el concepto de su propia fila. Mismo patrón que `compra_solo_marcar`.
create or replace function public.deudas_solo_marcar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not (private.es_admin() or private.es_tesorero()) then
    new.deudor_id := old.deudor_id;
    new.acreedor_id := old.acreedor_id;
    new.cantidad := old.cantidad;
    new.descripcion := old.descripcion;
    new.ticket_url := old.ticket_url;
    new.ticket_storage_id := old.ticket_storage_id;
    new.creado_por := old.creado_por;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists deudas_before_update on public.deudas;
create trigger deudas_before_update
  before update on public.deudas
  for each row execute function public.deudas_solo_marcar();
