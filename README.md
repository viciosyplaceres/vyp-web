# VYP — Peña Vicios y Placeres

Web de las fiestas de **Fuente Álamo de Murcia**: galería por años, música y sesiones, chat interno,
mapa de la peña y panel de gestión (cuotas, tallas de camiseta, lista de la compra).

En vivo: **https://viciosyplaceres.com**

Público: todo el mundo ve y escucha. Solo los miembros suben, comentan y entran en el chat.

- Plan y decisiones del producto → [`docs/PLAN.md`](docs/PLAN.md)
- Cómo está construido por dentro → [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)

## Qué hay hecho

| Fase | Estado |
|---|---|
| **F0** Base, dominio y despliegue | Hecho |
| **F1** Identidad visual (logotipo horizontal, negro/blanco) | Hecho |
| **F2** Auth, tablas, RLS y aprobación de miembros | Hecho |
| **F3** Galería por años + subida con compresión firmada | Hecho |
| **F4** Comentarios (solo miembros) | Hecho |
| **F5** Música: R2 + enlaces Mixcloud/SoundCloud + reproductor global | Hecho |
| **F6** Mapa y "cómo llegar" | Hecho |
| **F7** Panel de la directiva | Hecho |
| **F8** Móvil primero, PWA instalable, avisos push, chat interno | Hecho |

## Páginas

| Ruta | Quién entra | Qué hay |
|---|---|---|
| `/` | Todos | Carrusel de las últimas 10 fotos, últimas 5 pistas, mapa y cómo llegar |
| `/galeria` · `/galeria/[año]` · `/galeria/[año]/[id]` | Todos | Años, cuadrícula y detalle con comentarios |
| `/musica` | Todos | Sesiones y canciones, con reproductor que no se corta al navegar |
| `/chat` | **Miembros** | Chat interno en vivo, estilo grupo de WhatsApp |
| `/subir` | **Miembros** | Fotos, vídeos y música |
| `/cuenta` | Con sesión | Perfil, avisos push, cerrar sesión |
| `/admin` · `/admin/compras` · `/admin/miembros` | **Directiva** | Pagos y tallas, lista de la compra, aprobar altas |

## Arquitectura

Todo sobre capas gratuitas permanentes, alojado **fuera** del VPS propio:

- **Hosting**: Vercel (Hobby) — Next.js 16 App Router + TypeScript + Tailwind 4
- **Base de datos y auth**: Supabase (Postgres 500 MB) con RLS en todas las tablas
- **Fotos y vídeos**: Cloudinary — subida **firmada en el servidor**, así el API Secret nunca sale
  del servidor y solo firman los miembros aprobados
- **Música y sesiones**: Cloudflare R2 (bucket `vyp`), 10 GB y **salida gratis**, con URLs
  prefirmadas; alternativa de enlazar Mixcloud/SoundCloud sin gastar espacio
- **Avisos push**: `web-push` con claves VAPID propias — sin Firebase ni servicios de pago.
  Se notifica **todo** (chat, fotos, música, comentarios, altas y gestión), con los avisos de
  gestión y altas restringidos a la directiva
- **Dominio**: `viciosyplaceres.com`, DNS en Cloudflare

## Móvil primero

El uso mayoritario es desde el móvil, así que: barra de navegación inferior tipo app, objetivos
táctiles de 44 px, texto de 16 px (evita el zoom automático al escribir), respeto de las zonas
seguras del teléfono, y la web **se puede instalar como app** desde el propio navegador.

Pensado para gente poco tecnológica: al entrar sale un **cartel de instalación con un solo botón**
(instalador nativo en Android; los dos pasos ilustrados en iPhone), y al abrir la app ya instalada
**el permiso de notificaciones se pide solo**, sin que nadie tenga que buscar un ajuste. Para subir
fotos hay tres botones directos: *Hacer foto*, *Grabar vídeo* y *De la galería*.

## Configuración local

```bash
npm install
# rellenar .env.local con los valores de CREDENCIALES.md
npm run dev
```

Comprobaciones antes de desplegar:

```bash
npx tsc --noEmit && npx eslint src && npm run build
```

## Seguridad

- `CREDENCIALES.md` y `.env*.local` están en `.gitignore` y en `.vercelignore`.
- Solo las variables con prefijo `NEXT_PUBLIC_` llegan al navegador. La clave `service_role` de
  Supabase, el API Secret de Cloudinary, las de R2 y la clave privada VAPID son de servidor.
- Cada permiso se comprueba en tres capas: `proxy.ts`, el server action, y las políticas RLS de
  Postgres. La base de datos es la que manda.

## Pendiente

- **Rotar el token de GitHub**: el actual funciona pero tiene permisos de administrador de toda la
  cuenta, muy por encima de lo necesario (ver aviso en `CREDENCIALES.md`).
- Al borrar una foto o pista se borra el registro, pero el archivo sigue en Cloudinary/R2.
- Avisos push también al subir fotos nuevas (hoy solo avisa el chat).
