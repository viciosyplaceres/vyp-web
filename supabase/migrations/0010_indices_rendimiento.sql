-- VYP — Índices para las consultas que la app hace de verdad
--
-- Comprobado con EXPLAIN ANALYZE sobre la base de datos real: filtrar `media`
-- por `subido_por` hacía un Seq Scan (recorrer la tabla entera). Hoy da igual
-- —con 20 filas Postgres seguirá prefiriendo el escaneo, porque en una tabla
-- diminuta es más rápido que abrir un índice— así que esto NO acelera nada
-- ahora mismo: es para que siga yendo bien cuando la peña lleve unos cuantos
-- veranos subiendo fotos y estas tablas tengan miles de filas.

-- Perfil propio (`/perfil`, `/perfil/galeria`, `/perfil/musica`) y perfil
-- público de cualquier miembro (`/miembros/[id]`): siempre se filtra por quién
-- lo subió y se ordena por fecha, así que el índice lleva las dos columnas en
-- ese orden y sirve para el filtro y para la ordenación a la vez.
create index if not exists media_subido_por_fecha_idx
  on public.media (subido_por, created_at desc);

create index if not exists pistas_subido_por_fecha_idx
  on public.pistas (subido_por, created_at desc);

-- Portada y listados: "lo último que se ha subido", sin filtrar por nadie.
create index if not exists media_created_idx
  on public.media (created_at desc);

create index if not exists pistas_created_idx
  on public.pistas (created_at desc);
