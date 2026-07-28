-- Los contadores globales del menú se calculaban con cuatro peticiones REST:
-- lectura del chat, mensajes posteriores, tareas pendientes y compra pendiente.
-- Esta función hace el mismo trabajo en una sola consulta y sigue respetando
-- RLS porque es SECURITY INVOKER.

create or replace function public.contadores_navegacion()
returns table (no_leidos bigint, pendientes bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (
      select count(*)
      from public.mensajes m
      where m.autor_id is distinct from (select auth.uid())
        and m.created_at > coalesce(
          (
            select cl.ultimo_leido_at
            from public.chat_lecturas cl
            where cl.perfil_id = (select auth.uid())
          ),
          '-infinity'::timestamptz
        )
    ) as no_leidos,
    (
      (
        select count(*)
        from public.tareas_miembros tm
        join public.tareas t on t.id = tm.tarea_id
        where tm.perfil_id = (select auth.uid())
          and not t.hecha
      )
      +
      (
        select count(*)
        from public.compra_miembros cm
        join public.lista_compra lc on lc.id = cm.item_id
        where cm.perfil_id = (select auth.uid())
          and not lc.comprado
      )
    ) as pendientes
  where exists (
    select 1
    from public.perfiles p
    where p.id = (select auth.uid())
      and p.aprobado
  );
$$;

revoke all on function public.contadores_navegacion() from public, anon;
grant execute on function public.contadores_navegacion() to authenticated;
