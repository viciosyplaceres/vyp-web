-- =========================================================
-- 0011 · Publicar en Realtime las tablas de gestión
-- =========================================================
-- La burbuja de pendientes del avatar escucha `tareas`, `lista_compra`,
-- `tareas_miembros` y `compra_miembros`, pero ninguna de las cuatro estaba en
-- la publicación `supabase_realtime`: solo lo estaban las tres del chat. El
-- servidor respondía "Unable to subscribe to changes with given parameters" y
-- —lo importante— al fallar un solo binding tumba el canal entero, así que
-- ese contador nunca se actualizó en vivo desde que se creó.
--
-- Regla para el futuro: toda tabla que se escuche desde `lib/realtime.ts`
-- tiene que estar aquí. RLS se sigue aplicando a los eventos: cada miembro
-- solo recibe las filas que ya podría leer.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tareas'
  ) then
    alter publication supabase_realtime add table public.tareas;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lista_compra'
  ) then
    alter publication supabase_realtime add table public.lista_compra;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tareas_miembros'
  ) then
    alter publication supabase_realtime add table public.tareas_miembros;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'compra_miembros'
  ) then
    alter publication supabase_realtime add table public.compra_miembros;
  end if;
end $$;
