-- VYP — Tamaño de cada archivo, para poder controlar el almacenamiento
--
-- Sin esto, saber qué se está comiendo el espacio gratuito obligaría a
-- preguntarle a Cloudinary/R2 archivo por archivo. Guardando el tamaño al
-- subir, el panel de almacenamiento puede listar y ordenar sin más peticiones.

alter table public.media add column if not exists bytes bigint;
alter table public.pistas add column if not exists bytes bigint;
