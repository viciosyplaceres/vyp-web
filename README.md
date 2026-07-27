# VYP — Peña Vicios y Placeres

Web de la peña de las fiestas del pueblo: galería de fotos compartida + panel interno de gestión
(cuotas pagadas, tallas de camiseta, lista de la compra).

## Estado

| Fase | Estado |
|---|---|
| Cuentas de servicios creadas | Hecho |
| Credenciales verificadas | Hecho (ver `CREDENCIALES.md`, fichero local no versionado) |
| Preset de subida de fotos | Hecho — `vyp_galeria` (sin firmar) |
| Repositorio GitHub | Creado, vacío — **pendiente el primer push** (token actual sin permiso de escritura) |
| Código de la aplicación | Portada de bienvenida desplegada; falta galería y panel de gestión |
| Esquema de base de datos | Pendiente |
| Despliegue | **Hecho** — proyecto `vyp-web` en Vercel (equipo `vyp1`) |
| Dominio conectado | **Hecho** — https://viciosyplaceres.com y https://www.viciosyplaceres.com responden 200 |

## Arquitectura

Todo sobre capas gratuitas permanentes, alojado **fuera** del VPS propio:

- **Hosting**: Vercel (plan Hobby) — Next.js App Router + TypeScript + Tailwind
- **Base de datos y auth**: Supabase (Postgres 500 MB, free tier)
- **Fotos**: Cloudinary (free tier, 25 créditos) — subida directa desde el navegador con
  preset sin firmar, así el API Secret nunca sale del servidor
- **Dominio**: `viciosyplaceres.com`, DNS gestionado en el panel de la zona

## Páginas previstas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/` | público | Portada de la peña |
| `/galeria` | miembros | Fotos de las fiestas, subida desde el móvil |
| `/login` | público | Acceso de la directiva |
| `/admin` | directiva | Participantes: pagado, importe, talla de camiseta, notas |
| `/admin/compras` | directiva | Lista de la compra con checklist |

## Modelo de datos (previsto)

- `participantes` — nombre, pagado, importe, talla_camiseta, notas
- `lista_compra` — item, cantidad, comprado

Ambas tablas con RLS: solo la cuenta de la directiva puede leerlas o escribirlas.

## Configuración local

```bash
npm install
cp .env.example .env.local   # rellenar con los valores de CREDENCIALES.md
npm run dev
```

## Seguridad

- `CREDENCIALES.md` y `.env*.local` están en `.gitignore` (no van al repositorio) y en
  `.vercelignore` (no se suben al build de Vercel tampoco).
- Solo las variables con prefijo `NEXT_PUBLIC_` llegan al navegador. La clave `service_role` de
  Supabase y el API Secret de Cloudinary son exclusivamente de servidor.

## Pendiente

- Regenerar el token de GitHub con permiso "Contents: Read and write" para poder hacer el
  primer `git push` (el actual solo tiene lectura).
- Escribir la galería, el login de directiva y el panel `/admin`.
- Crear las tablas `participantes` y `lista_compra` en Supabase con RLS.
