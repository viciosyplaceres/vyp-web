-- Ventana anual de escrituras normales: 1 de agosto 00:00 (incluido) hasta
-- 11 de septiembre 00:00 (excluido), siempre en Europe/Madrid.

create or replace function private.temporada_abierta(
  p_ahora timestamptz default clock_timestamp()
)
returns boolean
language sql
stable
set search_path = ''
as $$
  with hora_madrid as (
    select p_ahora at time zone 'Europe/Madrid' as valor
  )
  select valor >= make_date(extract(year from valor)::integer, 8, 1)::timestamp
     and valor < make_date(extract(year from valor)::integer, 9, 11)::timestamp
  from hora_madrid;
$$;

revoke all on function private.temporada_abierta(timestamptz) from public;

-- Un único trigger aplica la regla a todas las tablas. RLS sigue decidiendo
-- quién está autorizado; este trigger añade solamente el límite temporal.
create or replace function private.exigir_temporada_escritura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if private.temporada_abierta(clock_timestamp())
     or current_setting('app.fabrica_provisioning', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_new := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_old := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;

  -- Las cascadas DELETE que nacen de un borrado permitido deben terminar.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  -- Los FK ON DELETE SET NULL son UPDATE anidados, no DELETE. Se permiten
  -- únicamente sus transiciones exactas, sin abrir una edición encubierta.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    if tg_table_name in ('media', 'pistas', 'camisetas')
       and v_new -> 'subido_por' = 'null'::jsonb
       and v_old -> 'subido_por' <> 'null'::jsonb
       and v_new - 'subido_por' = v_old - 'subido_por' then
      return new;
    end if;

    if tg_table_name = 'deudas'
       and v_new -> 'creado_por' = 'null'::jsonb
       and v_old -> 'creado_por' <> 'null'::jsonb
       and v_new - 'creado_por' = v_old - 'creado_por' then
      return new;
    end if;

    if tg_table_name = 'mensajes'
       and v_new -> 'respuesta_a' = 'null'::jsonb
       and v_old -> 'respuesta_a' <> 'null'::jsonb
       and v_new - 'respuesta_a' = v_old - 'respuesta_a' then
      return new;
    end if;

    if tg_table_name = 'tareas'
       and v_new <> v_old
       and (v_new -> 'hecha_por' = v_old -> 'hecha_por'
         or v_new -> 'hecha_por' = 'null'::jsonb)
       and (v_new -> 'creado_por' = v_old -> 'creado_por'
         or v_new -> 'creado_por' = 'null'::jsonb)
       and v_new - array['hecha_por', 'creado_por']
         = v_old - array['hecha_por', 'creado_por'] then
      return new;
    end if;
  end if;

  if tg_table_name = 'perfiles' then
    -- Fuera de temporada solo la fábrica puede provisionar perfiles. La marca
    -- vive en raw_app_meta_data, que solo modifica un cliente Auth de confianza;
    -- raw_user_meta_data nunca participa en esta decisión.
    if tg_op = 'INSERT' and exists (
      select 1
      from auth.users as usuario
      where usuario.id = (v_new ->> 'id')::uuid
        and usuario.raw_app_meta_data -> 'fabrica_provisioning' = 'true'::jsonb
    ) then
      return new;
    end if;

    -- Privacidad y seguridad siguen disponibles todo el año.
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE'
       and v_old -> 'aprobado' = 'true'::jsonb
       and v_new -> 'aprobado' = 'false'::jsonb
       and v_new - 'aprobado' = v_old - 'aprobado' then
      return new;
    end if;
  end if;

  -- Borrado autorizado de contenido ya existente, sin abrir ediciones.
  if tg_op = 'DELETE'
     and tg_table_name in ('media', 'pistas', 'comentarios', 'mensajes') then
    return old;
  end if;

  -- El chat usa borrado blando. Solo se permite false -> true y ninguna otra
  -- columna puede cambiar en la misma sentencia.
  if tg_op = 'UPDATE'
     and tg_table_name = 'mensajes'
     and v_old -> 'borrado' = 'false'::jsonb
     and v_new -> 'borrado' = 'true'::jsonb
     and v_new - 'borrado' = v_old - 'borrado' then
    return new;
  end if;

  raise exception 'La temporada de cambios está cerrada. Se abre cada año del 1 de agosto al 10 de septiembre.'
    using errcode = 'P0001';
end;
$$;

revoke all on function private.exigir_temporada_escritura() from public;

drop trigger if exists temporada_escritura on public.perfiles;
create trigger temporada_escritura before insert or update or delete on public.perfiles
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.media;
create trigger temporada_escritura before insert or update or delete on public.media
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.pistas;
create trigger temporada_escritura before insert or update or delete on public.pistas
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.comentarios;
create trigger temporada_escritura before insert or update or delete on public.comentarios
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.mensajes;
create trigger temporada_escritura before insert or update or delete on public.mensajes
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.mensaje_reacciones;
create trigger temporada_escritura before insert or update or delete on public.mensaje_reacciones
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.participantes;
create trigger temporada_escritura before insert or update or delete on public.participantes
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.lista_compra;
create trigger temporada_escritura before insert or update or delete on public.lista_compra
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.tareas;
create trigger temporada_escritura before insert or update or delete on public.tareas
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.tareas_miembros;
create trigger temporada_escritura before insert or update or delete on public.tareas_miembros
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.compra_miembros;
create trigger temporada_escritura before insert or update or delete on public.compra_miembros
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.deudas;
create trigger temporada_escritura before insert or update or delete on public.deudas
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.configuracion;
create trigger temporada_escritura before insert or update or delete on public.configuracion
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.pagos;
create trigger temporada_escritura before insert or update or delete on public.pagos
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.camisetas;
create trigger temporada_escritura before insert or update or delete on public.camisetas
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.camisetas_votos;
create trigger temporada_escritura before insert or update or delete on public.camisetas_votos
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.pedidos_camiseta;
create trigger temporada_escritura before insert or update or delete on public.pedidos_camiseta
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.limpieza_numeros;
create trigger temporada_escritura before insert or update or delete on public.limpieza_numeros
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.limpieza_turnos;
create trigger temporada_escritura before insert or update or delete on public.limpieza_turnos
  for each row execute function private.exigir_temporada_escritura();

drop trigger if exists temporada_escritura on public.fiestas_fechas;
create trigger temporada_escritura before insert or update or delete on public.fiestas_fechas
  for each row execute function private.exigir_temporada_escritura();

-- Excepciones completas y deliberadas: push_subs y chat_lecturas no llevan
-- trigger de temporada y conservan sus RLS actuales durante todo el año.
