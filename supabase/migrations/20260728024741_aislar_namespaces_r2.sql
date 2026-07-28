-- Impide convertir documentos internos de R2 en pistas públicas y viceversa.
-- Las claves válidas siempre las genera /api/r2/subir con UUID v4.

alter table public.pistas
  drop constraint if exists pistas_clave_r2_valida,
  add constraint pistas_clave_r2_valida check (
    origen <> 'r2'
    or url ~* '^musica/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,5}$'
  );

alter table public.tareas
  drop constraint if exists tareas_clave_documento_valida,
  add constraint tareas_clave_documento_valida check (
    documento_url is null
    or documento_url ~* '^documentos/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,5}$'
  );

alter table public.lista_compra
  drop constraint if exists lista_compra_clave_documento_valida,
  add constraint lista_compra_clave_documento_valida check (
    documento_url is null
    or documento_url ~* '^documentos/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{1,5}$'
  );
