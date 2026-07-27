-- Notas al proponer un diseño de camiseta: aparte del título, un hueco para
-- explicar detalles ("la tela es más gruesa", "el logo va en la espalda"...).

alter table public.camisetas
  add column if not exists notas text;
