# Plan del proyecto — Peña Vicios y Placeres (VYP)

Fuente Álamo de Murcia · https://viciosyplaceres.com

---

## 1. Qué se va a construir

Web pública de la peña con una zona privada de gestión. Las fiestas son **una vez al año,
durante 10 días**, y ese ciclo anual organiza todo el contenido.

| Quién | Puede |
|---|---|
| **Cualquiera** (sin cuenta) | Ver todas las fotos y vídeos, escuchar toda la música, ver el mapa |
| **Miembro de la peña** | Todo lo anterior + subir fotos/vídeos/música + comentar |
| **Directiva (admin)** | Todo lo anterior + panel de gestión + aprobar miembros + moderar |

Regla central: **nadie que no sea miembro sube ni comenta nada.** Todo lo demás es abierto.

---

## 2. Corrección importante sobre lo ya montado

En la configuración inicial creé un *upload preset* **sin firmar** (`vyp_galeria`) en Cloudinary.
Eso servía cuando la galería iba a ser abierta, pero **es incompatible con el requisito de que
solo suban los miembros**: un preset sin firmar permite subir a cualquiera que lea el nombre del
preset en el JavaScript de la página, sin necesidad de cuenta.

**Cambio**: se elimina el preset sin firmar y las subidas pasan a ser **firmadas en el servidor**.
El navegador pide una firma a una ruta de Next.js, esa ruta comprueba la sesión de Supabase y solo
firma si el usuario es miembro aprobado. Sin firma válida, Cloudinary rechaza la subida.

---

## 3. Dónde vive cada cosa (y por qué)

Los límites reales de la cuenta gratuita de Cloudinary, ya verificados contra su API:

| Límite | Valor |
|---|---|
| Tamaño máximo de imagen | 10 MB |
| Tamaño máximo de vídeo | **100 MB** |
| Créditos totales | 25 (1 crédito ≈ 1 GB almacenado/mes ≈ 1 GB servido) |

Esto tiene una consecuencia dura: **una sesión de DJ de 1–2 horas (100–200 MB) no cabe en
Cloudinary.** Y aunque cupiera, la música se escucha entera y repetidamente, así que consumiría
los 25 créditos de tráfico en semanas.

Reparto propuesto:

| Contenido | Dónde | Motivo |
|---|---|---|
| Fotos | Cloudinary | Compresión y miniaturas automáticas, que es justo lo que se pide |
| Vídeos | Cloudinary | Transcodificación automática. Tope de 100 MB por fichero |
| **Música y sesiones subidas por la peña** | **R2 (almacenamiento de objetos)** | 10 GB gratis y **tráfico de salida gratuito**: ideal para escuchar en bucle |
| **Sesiones ya publicadas fuera** (DJ que ya la subió a Mixcloud/SoundCloud) | **Enlace incrustado**, sin copiar el fichero | No gasta cuota propia, y respeta el sitio original si ya existe |
| Datos (miembros, pagos, comentarios) | Supabase Postgres | 500 MB, de sobra para texto |

**R2 ya está activado** en la cuenta de Cloudflare. Modelo híbrido definitivo para `/musica`:
- **Subida directa a R2**: para canciones y sesiones propias que un miembro sube desde el móvil.
  Sirve tanto para MP3 sueltos como para sesiones de 1–2 horas, sin tocar los créditos de Cloudinary.
- **Enlace externo (Mixcloud/SoundCloud)**: un miembro pega la URL de una sesión ya subida a esas
  plataformas y la pista se guarda como tipo `externa`, embebiendo el reproductor oficial de
  Mixcloud/SoundCloud dentro de `/musica` en vez de un fichero propio. Útil para sesiones que el DJ
  ya subió por su cuenta, o como respaldo si algún día se quiere dejar de pagar/gestionar R2.
- El reproductor global de la web solo controla la reproducción de las pistas propias (R2); las
  pistas externas abren su propio mini-reproductor embebido (iframe oficial), porque Mixcloud y
  SoundCloud no permiten controlar su audio desde fuera de su embed.

---

## 4. Compresión al subir

Se hace en dos capas, porque casi todo se sube desde el móvil en la calle y con mala cobertura:

**Fotos**
1. En el propio navegador, antes de enviar: redimensionar a 2400 px de lado mayor y recomprimir
   (biblioteca `browser-image-compression`). Una foto de 8 MB del móvil baja a ~1 MB.
2. Al servir: Cloudinary aplica `q_auto` y `f_auto`, que entrega WebP o AVIF según el navegador.

**Vídeos**
- Comprimir vídeo dentro del navegador no es viable para ficheros grandes.
- Se sube el original (tope 100 MB, con aviso claro en la interfaz si se pasa) y Cloudinary lo
  transcodifica a 1080p con `q_auto`. Se guarda solo la versión transcodificada para no gastar
  cuota con el original.

**Música**
- No se recomprime: ya viene en MP3/M4A comprimido. Solo se normaliza el nombre y se guarda.

---

## 5. Modelo de datos (Supabase Postgres)

```
perfiles          id (→ auth.users), nombre, rol ('miembro'|'admin'), aprobado, created_at
media             id, tipo ('foto'|'video'), anio, storage_id, url, thumb_url,
                  ancho, alto, duracion_s, descripcion, subido_por, created_at
pistas            id, titulo, artista, tipo ('sesion'|'cancion'), anio,
                  origen ('r2'|'mixcloud'|'soundcloud'), url, embed_url,
                  duracion_s, subido_por, created_at
comentarios       id, media_id (nullable), pista_id (nullable), autor_id, texto, created_at
participantes     id, nombre, pagado, importe, talla_camiseta, notas, anio
lista_compra      id, item, cantidad, comprado, anio, notas
mensajes          id, autor_id, texto, created_at            (chat interno, solo miembros)
push_subs         id, user_id, endpoint (único), p256dh, auth, created_at
autores (vista)   id, nombre                                  (solo esas dos columnas)
```

`autores` es una **vista** que expone únicamente `id` y `nombre` de `perfiles`. Existe porque los
comentarios son públicos y hay que poder mostrar quién los escribió, pero la política de `perfiles`
—correctamente— no deja ver perfiles ajenos. Se deja como `SECURITY DEFINER` a propósito y acotada a
esas dos columnas: nunca expone `rol`, `aprobado` ni `created_at`.

`pistas.origen` distingue si `url` apunta a un objeto propio en R2 (reproducible desde el
reproductor global) o es una pista `mixcloud`/`soundcloud`: en ese caso `url` guarda el enlace que
pegó el miembro y `embed_url` la URL de embed ya calculada (p. ej.
`https://www.mixcloud.com/widget/iframe/?feed=<url-codificada>` o
`https://w.soundcloud.com/player/?url=<url-codificada>`), para no recalcularla en cada render.

`comentarios` lleva dos claves ajenas anulables con una restricción que obliga a que solo una esté
rellena: así vale igual para comentar una foto que una sesión de música, sin duplicar tablas.

### Seguridad a nivel de fila (RLS)

Esta es la pieza que hace cumplir el requisito, y va en la base de datos, no en el JavaScript
—donde sería puenteable—:

| Tabla | Ver | Escribir |
|---|---|---|
| `media`, `pistas` | todo el mundo | solo miembro aprobado |
| `comentarios` | todo el mundo | solo miembro aprobado (y solo puede borrar el suyo, o un admin) |
| `perfiles` | el propio + admin | solo admin cambia rol y aprobación |
| `participantes`, `lista_compra` | **solo admin** | solo admin |
| `mensajes` (chat) | **solo miembro aprobado** | solo miembro aprobado |
| `push_subs` | solo las propias | solo las propias |

Además, en las tablas que no son públicas (`participantes`, `lista_compra`, `mensajes`,
`push_subs`, `perfiles`) se ha hecho `revoke all ... from anon`: Supabase concede permisos al rol
`anon` por defecto en tablas nuevas, y aunque el RLS ya lo cubría, quitar también el permiso de
tabla deja dos cerraduras en vez de una.

La comprobación de "miembro aprobado" se hace con `private.es_miembro()` / `private.es_admin()`,
dos funciones `SECURITY DEFINER` en un esquema `private` **no expuesto por la Data API** (siguiendo
la recomendación de seguridad de Supabase: una función `SECURITY DEFINER` en `public` sería
invocable directamente por cualquiera). Un trigger en `auth.users` crea el perfil automáticamente
al registrarse (`aprobado = false`, `rol = 'miembro'`), y otro trigger en `perfiles` impide que un
usuario se autoapruebe o se autoasigne el rol admin (solo lo ignora si quien edita es el propio
usuario; las operaciones con la clave `service_role` —sin `auth.uid()`— no se ven afectadas).

**F2 verificado en vivo el 2026-07-27** (no solo "debería funcionar"): tablas y RLS aplicadas
directamente contra la base de datos real vía la Management API de Supabase
(`supabase/migrations/0001_esquema_base_auth_rls.sql`), y probado con un usuario de prueba real
(creado y borrado después): un visitante anónimo puede leer `media`/`pistas`/`comentarios` pero no
escribir ni ver `participantes`/`lista_compra`; un miembro recién registrado (sin aprobar) no puede
subir nada; tras aprobarlo puede subir y comentar; su intento de autoascenderse a `admin` queda
bloqueado por el trigger; sigue sin acceso a `participantes`.

**Interfaz de F2, hecha y desplegada** (`viciosyplaceres.com`): `/login`, `/registro` (con página
de confirmación) y `/admin/miembros` (lista de miembros, aprobar/revocar). Autenticación con
`@supabase/ssr`, sesión gestionada en `src/proxy.ts` (Next.js 16 renombró `middleware.ts` a
`proxy.ts`), que protege `/admin/*` y `/subir` redirigiendo a `/login` si no hay sesión — probado en
producción (`curl` confirma el 307). La única cuenta con `rol = 'admin'` es
`alvaroviniloo@gmail.com` (ver `CREDENCIALES.md`); el registro público siempre crea miembros sin
aprobar, y el panel de miembros solo es visible si `rol = 'admin' y aprobado = true`, comprobado dos
veces: en el propio código de la página y, por si acaso, en la política RLS de la base de datos.

---

## 6. Cómo se entra en la peña

Registro abierto → la cuenta nace **pendiente** (`aprobado = false`) → un admin la aprueba desde
`/admin/miembros`. Hasta entonces la persona ve la web como cualquier visitante.

Es el equilibrio razonable: no hay que dar de alta a mano a 40 personas, pero tampoco entra
cualquiera a subir cosas.

---

## 7. Páginas

| Ruta | Acceso | Contenido |
|---|---|---|
| `/` | público | Logo, próximas fiestas, últimas fotos, mapa, acceso a todo |
| `/galeria` | público | Los años en fichas, del más reciente al más antiguo |
| `/galeria/[anio]` | público | Cuadrícula de fotos y vídeos de ese año |
| `/galeria/[anio]/[id]` | público | Foto o vídeo a pantalla completa + comentarios |
| `/musica` | público | Sesiones y canciones, con el reproductor |
| `/donde` | público | Mapa, dirección y botón "Cómo llegar" |
| `/subir` | **miembros** | Subida de fotos, vídeos y música con barra de progreso |
| `/login` · `/registro` | público | Acceso y alta |
| `/admin` | **directiva** | Participantes: pagado, importe, talla de camiseta, notas |
| `/admin/compras` | **directiva** | Lista de la compra con casillas |
| `/admin/miembros` | **directiva** | Aprobar o revocar miembros |

---

## 8. Reproductor de música

Un único reproductor **que no se corta al navegar**: vive en el layout raíz, con el estado en un
contexto de React, así que se puede ir a la galería mientras suena una sesión. Barra fija abajo con
portada, título, play/pausa, anterior/siguiente, barra de progreso y volumen. Cola de reproducción
a partir de la lista de `/musica`, solo para pistas `origen = 'r2'`.

Las pistas `origen = 'mixcloud'` o `'soundcloud'` se listan en `/musica` con su propio reproductor
embebido (iframe oficial de la plataforma) en vez de sumarse a la cola global: cada una de esas
pistas se reproduce dentro de su propia tarjeta, con controles nativos de Mixcloud/SoundCloud.

---

## 9. Mapa y cómo llegar

- Dirección: **C. Asturias, 30320 Fuente Álamo, Murcia**
- Coordenadas: **37.717352, -1.173910** (37°43'02.5"N 1°10'26.1"W)
- **Mapa incrustado con OpenStreetMap** (`openstreetmap.org/export/embed.html`), interactivo de
  verdad (se puede mover y hacer zoom), teñido en blanco y negro con un filtro CSS
  (`grayscale invert`) para que encaje con el resto de la web. Sin clave de API.
- Botón grande **"Cómo llegar"** que abre Google Maps con la ruta ya puesta hacia la peña:
  `https://www.google.com/maps/dir/?api=1&destination=37.717352,-1.173910`
- En móvil abre directamente la app de Google Maps.

> **Corregido el 2026-07-27**: el primer intento usaba el embed de Google Maps sin clave
> (`/maps?q=...&output=embed`). Google cambió su comportamiento y esa URL ahora redirige a un
> endpoint interno que responde con `X-Frame-Options: SAMEORIGIN`, así que el navegador bloquea
> el iframe en cualquier dominio que no sea `google.com` — el recuadro se quedaba en blanco para
> todo el mundo. Verificado con cabeceras HTTP reales antes y después del cambio.

---

## 9-bis. Chat interno de la peña (`/chat`)

Un único grupo, estilo WhatsApp, **invisible para quien no sea miembro aprobado**. Esta es la
única parte de la web que no es pública.

- Tabla `mensajes`, con RLS que solo permite leer y escribir a `private.es_miembro()`.
- A diferencia del resto de tablas, `anon` **no tiene ni permiso de tabla** (`revoke all ... from
  anon`): aunque una política fallara, la Data API responde `permission denied`. Verificado.
- Mensajes en vivo con Supabase Realtime (`alter publication supabase_realtime add table
  mensajes`), sin recargar la página.
- Envío optimista (`useOptimistic`): el mensaje aparece al instante mientras viaja al servidor.
- Burbujas propias en blanco a la derecha, ajenas en gris a la izquierda, con separadores de día
  ("Hoy", "Ayer", fecha) y hora en cada mensaje.
- Enviar con Enter; Mayús+Enter hace salto de línea.

## 9-ter. PWA y avisos push (Android)

**Instalable como app**: `public/manifest.webmanifest` (modo `standalone`, iconos 192/512 y uno
`maskable`, atajos directos a Galería/Música/Chat) y `public/sw.js` como service worker.

La estrategia de caché es deliberadamente conservadora — **la red manda siempre**, y solo se tira de
caché si no hay conexión. Con una caché agresiva, alguien vería fotos o mensajes viejos, que es peor
que esperar un segundo. Nunca se cachean `/api/` ni audio/vídeo.

**Avisos push** cuando llega un mensaje al chat, incluso con la app cerrada:

- Claves VAPID propias (generadas con `web-push`, guardadas en `CREDENCIALES.md` y en Vercel).
  No hace falta cuenta de Firebase ni ningún servicio de pago.
- Cada dispositivo se registra en la tabla `push_subs` desde el botón "Activar avisos en este móvil"
  (en `/chat` y en `/cuenta`).
- Al enviar un mensaje se avisa a todos los miembros **menos al que escribe**.
- Las suscripciones muertas se limpian solas: si el navegador responde 404/410, se borran.
- Si el envío del aviso falla, **el mensaje se guarda igualmente** — el chat nunca depende de que
  las notificaciones funcionen.

> Nota de alcance: Android y escritorio admiten push desde el navegador. En iPhone solo funciona si
> la web se ha añadido antes a la pantalla de inicio (limitación de Apple, no del código).

## 9-quater. Móvil primero

El uso mayoritario será desde el móvil en la calle, así que la interfaz se diseñó en ese orden:

- **Barra de navegación inferior** fija tipo app nativa (Inicio · Galería · Música · Chat · Cuenta),
  visible solo en móvil; en pantalla grande se usa el menú del encabezado.
- Respeto de `env(safe-area-inset-bottom)` para que nada quede bajo la barra gestual del teléfono.
- **Objetivos táctiles de 44 px mínimo** en todo elemento pulsable, con 8 px de separación.
- Texto base de 16 px: por debajo, los navegadores móviles hacen zoom automático al enfocar un campo.
- `overscroll-behavior: contain` para evitar recargas accidentales al estirar la página.
- Se respeta `prefers-reduced-motion`, foco visible siempre, y todas las imágenes llevan texto
  alternativo.
- Iconos SVG (lucide-react), nunca emojis.

---

## 10. Identidad visual — CERRADA

- **Logotipo**: wordmark horizontal ("VICIOS & PLACERES" en una línea, serif elegante), pensado
  para un header de web real, no un badge circular que obligaría a un header gigante. Icono
  cuadrado aparte ("V&P" compacto) para favicon y app icon. Ambos vectoriales (Recraft V4.1),
  descartes en `design/logo-candidatos/`.
- **Paleta**: negro puro de fondo, blanco de texto. Sin modo claro — serio y sobrio, no festivo.
- Tipografía de sistema (Geist) para que cargue rápido con mala cobertura en el recinto.

> **Corregido el 2026-07-27**: el PNG exportado del wordmark (`vyp-wordmark.png`) tenía el texto
> ocupando solo el 24% superior del lienzo, con un bloque negro vacío debajo (2000×647 real vs.
> 1886×182 de contenido). Al usarlo en el header con una altura fija, esa proporción incorrecta
> hacía que el texto se viera diminuto. Se recortó a su contenido real; el header ya no necesita
> compensar el hueco muerto.
>
> También se añadió una **imagen para compartir** (`public/og-image.png`, 1200×630, wordmark
> centrado sobre negro) enlazada en `openGraph`/`twitter` de `layout.tsx`: sin ella, cualquier
> vista previa del enlace (compartir, fijar como app de escritorio, etc.) caía en un icono pequeño
> sobre una tarjeta en blanco — el efecto de "imagen que no cubre todo, con borde blanco".

---

## 11. Fases de construcción

| Fase | Contenido | Estado |
|---|---|---|
| **F0** | Base: Next.js, dominio, despliegue | Hecho |
| **F1** | Logo e identidad visual | Hecho |
| **F2** | Auth + tablas + RLS + aprobación de miembros | Hecho |
| **F3** | Galería por años + subida con compresión (firmada) | Hecho |
| **F4** | Comentarios | Hecho |
| **F5** | Música y reproductor global (R2 + Mixcloud/SoundCloud) | Hecho |
| **F6** | Mapa y cómo llegar | Hecho |
| **F7** | Panel de la directiva | Hecho |
| **F8** | Mobile-first, PWA instalable, avisos push, chat interno | Hecho |

Todo desplegado y verificado en `viciosyplaceres.com` el 2026-07-27.

### Cómo se verificó (no solo "compila")

Sobre la base de datos y el despliegue reales, no en local:

- **Ciclo completo de un miembro nuevo**: se creó un usuario de verdad, se comprobó que el trigger
  le crea el perfil sin aprobar, que **no puede escribir en el chat** (RLS lo rechaza) y que, con un
  mensaje real ya guardado en la tabla, **lo ve como lista vacía**. Tras aprobarlo desde la
  directiva, ese mismo mensaje sí aparece. Aprobado y todo, sigue sin ver `participantes`.
- **R2**: subida con URL prefirmada (200), lectura del contenido correcto (200) y borrado (404
  después). El bucket `vyp` funciona de verdad.
- **Comentarios públicos**: un visitante anónimo lee el comentario y el nombre de quien lo escribió
  a través de la vista `autores`.
- **Rutas**: las 7 públicas responden 200; las 5 privadas (`/subir`, `/cuenta`, `/admin`,
  `/admin/compras`, `/admin/miembros`) redirigen a `/login`. `/chat` sin sesión no filtra ni un
  mensaje.
- **PWA**: manifest, service worker e iconos servidos; el HTML lleva `manifest`, `theme-color` y
  `viewport-fit=cover`. Las claves VAPID generan una cabecera de autorización válida.
- Tipos (`tsc`), estilo (`eslint`) y build de producción sin errores ni avisos.

Los datos de prueba se borraron después: la base de datos quedó limpia, solo con la cuenta de la
directiva.

### Lo que no se pudo probar aquí

El **envío real de un aviso push a un móvil** necesita un teléfono de verdad suscrito: la
infraestructura está verificada (claves válidas, rutas y limpieza de suscripciones muertas), pero la
prueba de campo es abrir la web en el Android, pulsar "Activar avisos" y escribir desde otro
dispositivo.

---

## 12. Decisiones que hacen falta antes de seguir

1. ~~Qué logo de los cuatro candidatos.~~ **Cerrado** (sección 10).
2. ~~Dónde va la música.~~ **Cerrado**: R2 activado, bucket `vyp` ya creado y sus 4 variables
   (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) ya cargadas en
   `.env.local` y en Vercel (producción, cifradas) + enlaces Mixcloud/SoundCloud incrustados para
   sesiones ya publicadas fuera (sección 3).
3. **Años con contenido**: ¿de qué años hay fotos para sembrar la galería?

---

## 13. Riesgos anotados

| Riesgo | Mitigación |
|---|---|
| Agotar los 25 créditos de Cloudinary | Comprimir en cliente, sacar la música a R2, vigilar consumo |
| Un miembro sube algo inapropiado | Los admin pueden borrar cualquier cosa; queda registrado quién subió qué |
| Vídeos de más de 100 MB | Aviso claro en la interfaz antes de subir |
| Cuenta de la peña comprometida | Rotar los tokens al terminar (pendiente, ver `CREDENCIALES.md`) |
