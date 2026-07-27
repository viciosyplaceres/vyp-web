-- Adjuntar un documento (recibo, catálogo, lo que sea) a un artículo de la
-- lista de la compra, igual que ya se podía en las tareas.

alter table public.lista_compra
  add column if not exists documento_url text,
  add column if not exists documento_nombre text;

-- El trigger que solo dejaba tocar `comprado` a quien no es admin tiene que
-- proteger también estas dos columnas nuevas: si no, cualquier miembro con
-- algo asignado podría cambiar el documento adjunto al marcarlo comprado.
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
    new.documento_url := old.documento_url;
    new.documento_nombre := old.documento_nombre;
  end if;
  return new;
end;
$$;
