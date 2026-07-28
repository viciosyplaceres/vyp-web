# VYP — Peña Vicios y Placeres

Web de las fiestas de **Fuente Álamo de Murcia**: galería por años, música y sesiones, chat interno,
mapa de la peña y panel de gestión (cuotas, tallas de camiseta, lista de la compra).

En vivo: **https://www.viciosyplaceres.com**

Público: todo el mundo ve y escucha. Solo los miembros suben, comentan y entran en el chat.

SEO técnico: Next.js genera `/robots.txt` y `/sitemap.xml`; solo se indexan la
portada, música y la galería pública. Gestión, miembros, autenticación, chat y
API quedan fuera del rastreo. El host canonical es `https://www.viciosyplaceres.com`.

- Plan y decisiones del producto → [`docs/PLAN.md`](docs/PLAN.md)
- Cómo está construido por dentro → [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Auditoría integral del 28-07-2026 → [`docs/AUDITORIA-INTEGRAL-2026-07-28.md`](docs/AUDITORIA-INTEGRAL-2026-07-28.md)

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
| `/` | Todos | Carrusel de las últimas 6 fotos, últimas 5 pistas, mapa bajo demanda y cómo llegar; ubicación actualizada desde Gestión sin tocar código |
| `/galeria` · `/galeria/[año]` · `/galeria/[año]/[id]` | Todos | Años, cuadrícula y detalle con comentarios. **Miembros**: botón "Subir" arriba de la página |
| `/musica` | Todos | Sesiones y canciones, con reproductor que no se corta al navegar, filtro por miembro que sube la música y botón "Reproducir todo" que respeta ese filtro (la cola de "siguiente" también). **Miembros**: botón "Subir música" arriba de la página |
| `/chat` | **Miembros** | Chat interno en vivo, estilo grupo de WhatsApp: responder citando, editar y eliminar los propios mensajes, reacciones con emoji, doble check azul de leído y burbuja de no leídos en tiempo real en el menú inferior. La directiva puede purgar físicamente todo el historial desde Gestión. Sin subida de multimedia, a propósito, para no disparar el consumo de Cloudinary/R2 |
| `/perfil` | Con sesión | Avatar, nombre de usuario y **bio**, mis tareas, mi compra, mis fotos, mi música, ajustes y cerrar sesión. El avatar del header lleva una **burbuja en tiempo real** con el total de tareas y artículos de la compra que tienes pendientes. La galería y la música muestran solo las **últimas 9** con un botón "Ver todas" (evita que la página crezca sin límite), y cada foto/pista propia se puede **borrar** desde ahí |
| `/perfil/galeria` · `/perfil/musica` | Con sesión (miembro) | Todo lo que ha subido esa persona, sin límite, cada cosa con su botón de borrar |
| `/miembros` · `/miembros/[id]` | Con sesión (miembro) | Directorio de la peña y perfil público de cada uno (avatar, usuario, bio, sus tareas y compra asignada, sus últimas fotos y música), de solo lectura. Accesible desde "Miembros" en el menú (header en escritorio, barra inferior en móvil) |
| `/admin` · `/admin/camisetas` · `/admin/pagos` · `/admin/tareas` · `/admin/compras` · `/admin/deudas` · `/admin/dados` | **Miembros** | Organizar las fiestas lo hace la peña entera: **camisetas**, **pagos**, **tareas** sobre el rango real de las fiestas, **lista de la compra** con hasta 100 líneas por tanda y cantidades independientes, **limpieza** con fechas y plazas configurables, **deudas** y **dados**. Marcar pagos, crear/borrar compras y las acciones sensibles siguen siendo de la directiva |
| `/admin/miembros` · `/admin/almacenamiento` | **Directiva** | Aprobar y revocar altas, resetear contraseñas, eliminar cuentas y controlar Cloudinary/R2. La portada de Gestión también permite cambiar dirección, URL de Google Maps, coordenadas, fechas/plazas anuales y purgar por completo el chat. Roles: **miembro**, **tesorero** y **directiva/admin**; repartir roles sigue siendo un permiso separado |

## Arquitectura

Todo sobre capas gratuitas permanentes, alojado **fuera** del VPS propio:

- **Hosting**: Vercel (Hobby) — Next.js 16 App Router, build Webpack, TypeScript y Tailwind 4
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

Pensado para gente poco tecnológica: tras dejar que la página cargue aparece un **cartel de
instalación con un solo botón** (instalador nativo en Android; los dos pasos ilustrados en iPhone),
y al abrir la app ya instalada
**el permiso de notificaciones se pide solo**, sin que nadie tenga que buscar un ajuste. Para subir
fotos hay un único botón, sin forzar la cámara: el propio móvil ofrece elegir entre *Cámara*,
*Vídeo* o *Galería* en su desplegable nativo.

## Configuración local

```bash
npm install
# rellenar .env.local con los valores de CREDENCIALES.md
npm run dev
```

Comprobaciones antes de desplegar:

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

## Seguridad

- `CREDENCIALES.md` y `.env*.local` están en `.gitignore` y en `.vercelignore`.
- Solo las variables con prefijo `NEXT_PUBLIC_` llegan al navegador. La clave `service_role` de
  Supabase, el API Secret de Cloudinary, las de R2 y la clave privada VAPID son de servidor.
- Cada permiso se comprueba en tres capas: `proxy.ts`, el server action, y las políticas RLS de
  Postgres. La base de datos es la que manda.
- R2 separa por formato y por restricción SQL la música pública (`musica/`) de los documentos
  internos (`documentos/`); registrar una clave en el namespace equivocado se rechaza.
- Las tandas de compra se crean mediante una RPC `SECURITY INVOKER`: artículos y encargados se
  confirman juntos o se revierten juntos, siempre bajo RLS.

## Pendiente

- **Rotar el token de GitHub**: el actual funciona pero tiene permisos de administrador de toda la
  cuenta, muy por encima de lo necesario (ver aviso en `CREDENCIALES.md`).
- Cuando un miembro borra algo suyo, solo se borra el registro (el archivo sigue en Cloudinary/R2).
  Desde `/admin/almacenamiento` la directiva sí borra el archivo real, no solo la fila.
- Avisos push también al subir fotos nuevas (hoy solo avisa el chat).
