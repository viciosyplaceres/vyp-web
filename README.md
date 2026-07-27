# VYP — Peña Vicios y Placeres

Web de las fiestas de **Fuente Álamo de Murcia**: galería por años, música y sesiones,
mapa de la peña y panel interno de gestión (cuotas, tallas de camiseta, lista de la compra).

Público: todo el mundo ve y escucha. Solo los miembros suben y comentan.

**El plan completo del proyecto está en [`docs/PLAN.md`](docs/PLAN.md).**

## Estado

| Fase | Estado |
|---|---|
| Cuentas de servicios creadas | Hecho |
| Credenciales verificadas | Hecho (ver `CREDENCIALES.md`, fichero local no versionado) |
| Preset de subida de fotos | Hecho — `vyp_galeria`, **modo firmado** (solo miembros) |
| Plan del proyecto | **Hecho** — `docs/PLAN.md` |
| Identidad visual | **Hecho** — logotipo horizontal (`public/logo/vyp-wordmark.png`), icono cuadrado para favicon, paleta negro/blanco, header con el logo |
| Repositorio GitHub | **Hecho** — código subido a `viciosyplaceres/vyp-web`, rama `main` |
| Código de la aplicación | Portada de bienvenida desplegada; falta galería y panel de gestión |
| Esquema de base de datos | Pendiente |
| Despliegue | **Hecho** — proyecto `vyp-web` en Vercel (equipo `vyp1`) |
| Dominio conectado | **Hecho** — https://viciosyplaceres.com y https://www.viciosyplaceres.com responden 200 |

## Arquitectura

Todo sobre capas gratuitas permanentes, alojado **fuera** del VPS propio:

- **Hosting**: Vercel (plan Hobby) — Next.js App Router + TypeScript + Tailwind
- **Base de datos y auth**: Supabase (Postgres 500 MB, free tier)
- **Fotos y vídeos**: Cloudinary (free tier, 25 créditos) — subida **firmada en el servidor**,
  así el API Secret nunca sale del servidor y solo firman los miembros aprobados
- **Música y sesiones**: almacenamiento de objetos aparte (no caben en Cloudinary: tope 100 MB)
- **Dominio**: `viciosyplaceres.com`, DNS gestionado en el panel de la zona

Ver `docs/PLAN.md` para el detalle de páginas, modelo de datos, roles y fases.

## Identidad visual

- **Logotipo horizontal** (`public/logo/vyp-wordmark.svg` + `.png`): wordmark serio en serif,
  pensado para un header real — no un badge circular. Se usa en `Header.tsx` a 32-36px de alto.
- **Icono cuadrado** (`public/logo/vyp-icon.svg`): monograma "V&P" compacto, usado como favicon
  y app icon (funciona a tamaños pequeños, a diferencia del wordmark).
- **Paleta**: negro puro de fondo, blanco de texto. Sin modo claro.
- Ambos generados con Higgsfield (Recraft V4.1, vectorial) — fuente y variantes descartadas en
  `design/logo-candidatos/`.

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

- Rotar el token de GitHub: el actual funciona pero tiene permisos de administrador de toda la
  cuenta, muy por encima de lo necesario (ver aviso en `CREDENCIALES.md`).
- Escribir la galería, el login de directiva y el panel `/admin`.
- Crear las tablas `participantes` y `lista_compra` en Supabase con RLS.
