-- VYP — Bio del perfil, visible entre miembros

alter table public.perfiles add column if not exists bio text check (char_length(bio) <= 300);

-- La bio es tan pública como el nombre/avatar (que ya vive en `autores`):
-- cualquiera puede leerla, la escribe cada uno de lo suyo.
create or replace view public.autores as
  select id, nombre, usuario, avatar_url, bio from public.perfiles;

grant select on public.autores to anon, authenticated;
