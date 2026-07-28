-- Alta atómica de una tanda de artículos y todos sus encargados.
-- Si cualquier asignación falla, Postgres revierte también los artículos.

alter table public.lista_compra
  drop constraint if exists lista_compra_item_valido,
  add constraint lista_compra_item_valido
    check (char_length(btrim(item)) between 1 and 200),
  drop constraint if exists lista_compra_cantidad_valida,
  add constraint lista_compra_cantidad_valida
    check (cantidad between 1 and 9999),
  drop constraint if exists lista_compra_documento_completo,
  add constraint lista_compra_documento_completo check (
    (documento_url is null and documento_nombre is null)
    or (
      documento_url is not null
      and documento_nombre is not null
      and char_length(btrim(documento_nombre)) between 1 and 255
    )
  );

create or replace function public.crear_items_compra(
  p_anio integer,
  p_items jsonb,
  p_asignados uuid[],
  p_documento_url text,
  p_documento_nombre text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_ids uuid[];
  v_asignados uuid[] := coalesce(p_asignados, array[]::uuid[]);
begin
  if not exists (
    select 1
    from public.perfiles
    where id = (select auth.uid())
      and rol = 'admin'
      and aprobado
  ) then
    raise exception 'Solo la directiva puede añadir artículos a la compra.'
      using errcode = '42501';
  end if;

  if p_anio not between 2010 and 2100 then
    raise exception 'Año no válido.' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'La lista de artículos no es válida.' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(p_items);
  if v_total < 1 or v_total > 100 then
    raise exception 'La tanda debe contener entre 1 y 100 artículos.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entrada
    where jsonb_typeof(entrada) <> 'object'
      or jsonb_typeof(entrada -> 'item') <> 'string'
      or char_length(btrim(entrada ->> 'item')) not between 1 and 200
      or jsonb_typeof(entrada -> 'cantidad') <> 'number'
      or (entrada ->> 'cantidad') !~ '^[0-9]{1,4}$'
      or (entrada ->> 'cantidad')::integer not between 1 and 9999
  ) then
    raise exception 'Hay artículos o cantidades no válidos.' using errcode = '22023';
  end if;

  if cardinality(v_asignados) > 100 then
    raise exception 'No se pueden asignar más de 100 miembros por tanda.'
      using errcode = '22023';
  end if;

  if cardinality(v_asignados) <> (
    select count(distinct id)
    from unnest(v_asignados) as ids(id)
  ) then
    raise exception 'La lista de encargados contiene duplicados.' using errcode = '22023';
  end if;

  if cardinality(v_asignados) <> (
    select count(*)
    from public.perfiles
    where id = any(v_asignados) and aprobado
  ) then
    raise exception 'Algún encargado no existe o no es miembro aprobado.'
      using errcode = '22023';
  end if;

  if (p_documento_url is null) <> (p_documento_nombre is null)
     or (
       p_documento_url is not null
       and (
         p_documento_url !~* '^documentos/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,5}$'
         or char_length(btrim(p_documento_nombre)) not between 1 and 255
       )
     ) then
    raise exception 'El documento adjunto no es válido.' using errcode = '22023';
  end if;

  with entradas as (
    select
      btrim(valor ->> 'item') as item,
      (valor ->> 'cantidad')::integer as cantidad,
      orden
    from jsonb_array_elements(p_items) with ordinality as datos(valor, orden)
  ), creados as (
    insert into public.lista_compra (
      item,
      cantidad,
      comprado,
      anio,
      documento_url,
      documento_nombre
    )
    select
      item,
      cantidad,
      false,
      p_anio,
      p_documento_url,
      p_documento_nombre
    from entradas
    order by orden
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_ids
  from creados;

  if cardinality(v_asignados) > 0 then
    insert into public.compra_miembros (item_id, perfil_id)
    select item_id, perfil_id
    from unnest(v_ids) as items(item_id)
    cross join unnest(v_asignados) as miembros(perfil_id);
  end if;

  return v_total;
end;
$$;

revoke all on function public.crear_items_compra(integer, jsonb, uuid[], text, text)
  from public, anon;
grant execute on function public.crear_items_compra(integer, jsonb, uuid[], text, text)
  to authenticated;
