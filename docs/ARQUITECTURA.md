# Arquitectura técnica — Web de la peña VYP

Documento de referencia para mantener o ampliar la web. El *qué* y el *por qué* del producto están
en `PLAN.md`; aquí está el *cómo*.

Actualizado: 2026-07-27

---

## 1. Dónde vive cada cosa

| Pieza | Servicio | Coste |
|---|---|---|
| Web (Next.js 16, App Router) | Vercel Hobby | Gratis |
| Base de datos + autenticación | Supabase (proyecto `mrqfbxkisrlngjkyahjv`) | Gratis (500 MB) |
| Fotos y vídeos | Cloudinary (`f0rmj6pg`) | Gratis (25 créditos) |
| Música y sesiones | Cloudflare R2, bucket `vyp` | Gratis (10 GB, salida gratis) |
| Dominio y DNS | `viciosyplaceres.com` en Cloudflare | Dominio de pago, DNS gratis |

Nada de esto corre en el VPS: son cuentas propias del señor.

---

## 2. Mapa del código

```
src/
  app/
    layout.tsx              Encabezado, navegación inferior, reproductor global, PWA
    page.tsx                Portada: carrusel de fotos, música compacta, mapa ("#donde"), invitación
    galeria/                Años → cuadrícula → detalle con comentarios. Botón "Subir" propio (miembros)
    musica/                 Lista de pistas (R2 + embeds externos). Botón "Subir música" propio (miembros)
    chat/                   Chat interno de miembros
    perfil/                 Avatar, usuario, mis tareas/compra/fotos/música, ajustes, salir
    admin/                  Año de gestión activo · participantes · deudas · tareas · compras ·
                            miembros · almacenamiento
    login/ registro/        Acceso y alta
    actions/                Server actions (toda la escritura pasa por aquí)
    api/                    Rutas que el navegador llama directamente
  components/               Interfaz (los que llevan "use client" son interactivos)
    InstalarApp.tsx         Cartel de "instala la app" (nativo en Android, guiado en iPhone)
    ActivarAvisosAuto.tsx   Pide el permiso de avisos al abrir la app instalada
    CarruselFotos.tsx       Cinta en bucle infinito (CSS puro) de la portada
    MusicaCompacta.tsx      Últimas 5 pistas para la portada, sin iframes
    PanelSubir.tsx          Botón desplegable genérico: cerrado por defecto, abre el formulario debajo
  lib/
    auth.ts                 getSesion / exigirMiembro / exigirAdmin
    supabase/{client,server,admin}.ts
    r2.ts                   Cliente S3 apuntando a R2
    embeds.ts               Mixcloud/SoundCloud + formato de duración
    push.ts                 Envío de avisos con web-push (filtra por rol)
    push-cliente.ts         Conversión de la clave VAPID en el navegador
  proxy.ts                  Refresco de sesión + protección de rutas
supabase/migrations/        Historial del esquema (0001, 0002)
public/                     manifest.webmanifest, sw.js, logos
```

> **Ojo con `proxy.ts`**: en Next.js 16 el fichero `middleware.ts` pasó a llamarse `proxy.ts`, y la
> función exportada `middleware` pasó a `proxy`. Si algún día se renombra a lo antiguo, deja de
> refrescarse la sesión y la gente se desloguea sola.

---

## 3. Las tres capas de seguridad

Cada regla se comprueba en más de un sitio a propósito. El orden importa:

1. **`proxy.ts`** — redirige a `/login` si se entra sin sesión a `/admin/*`. En `/galeria` y
   `/musica` el botón de subir simplemente no se pinta si no eres miembro (`PanelSubir` vive dentro
   de un `{sesion?.esMiembro && ...}` en la propia página). Es comodidad, no seguridad: solo evita
   ver un botón que no va a funcionar.
2. **Server actions y páginas** — `exigirMiembro()` / `exigirAdmin()` antes de tocar nada. Aquí sí
   se corta de verdad, porque el navegador no puede saltárselo.
3. **RLS en Postgres** — la última palabra. Aunque alguien llame a la API de Supabase directamente
   con la clave pública, la base de datos aplica sus políticas.

La regla de oro: **si una comprobación solo existe en el JavaScript del navegador, no existe.**

### Subidas: por qué van firmadas

Ni Cloudinary ni R2 reciben ficheros del navegador sin permiso previo:

- **Fotos/vídeos**: el navegador pide una firma a `/api/cloudinary/firma`. Esa ruta comprueba que
  quien la pide es miembro aprobado y firma con el `API_SECRET`, que nunca sale del servidor. Sin
  firma válida, Cloudinary rechaza la subida.
- **Música**: `/api/r2/subir` devuelve una URL prefirmada de 30 minutos. **La clave del objeto la
  decide el servidor**, no el cliente: así nadie elige dónde escribe dentro del bucket.
- **Escuchar**: `/api/r2/reproducir?clave=…` redirige a una URL prefirmada de lectura. Antes
  comprueba que esa clave corresponde a una pista registrada, para que nadie use la ruta como
  visor del bucket entero.

### CORS del bucket R2 — imprescindible, y no está en el código

La música se sube **del navegador directamente a R2**, saltándose el servidor de Next (que tiene
límite de tamaño de petición y no aguantaría una sesión de 200 MB). Al ser otro dominio, el
navegador manda antes una petición `OPTIONS` de comprobación; si el bucket no tiene política CORS,
R2 responde sin `Access-Control-Allow-Origin` y **el navegador cancela la subida**:

```
has been blocked by CORS policy: Response to preflight request doesn't pass
access control check: No 'Access-Control-Allow-Origin' header is present
```

Esa política vive **en el bucket, no en el repositorio**. Para (re)aplicarla:

```bash
node --env-file=.env.local scripts/configurar-cors-r2.mjs
```

Permite `PUT`, `GET` y `HEAD` desde `viciosyplaceres.com`, `www.viciosyplaceres.com` y
`localhost:3000`. Los dos primeros hacen falta por separado: para el navegador, con y sin `www` son
sitios distintos. Tarda unos segundos en propagarse por el edge de Cloudflare — si justo después el
preflight da 403, es eso; espera y reintenta.

### Por qué `requestChecksumCalculation: "WHEN_REQUIRED"` en `lib/r2.ts`

Las versiones recientes del SDK de AWS meten en la URL firmada un `x-amz-checksum-crc32` calculado
sobre un cuerpo **vacío** (al firmar todavía no hay fichero). R2 lo tolera, pero obliga al navegador
a reproducir exactamente lo que firmó el servidor. Desactivarlo deja una firma mínima y quita una
fuente de fallos difícil de diagnosticar. **No quitar esta opción.**

---

## 4. Reproductor de música

Vive en `ReproductorProvider` (contexto de React) montado en el layout raíz, así que **sigue sonando
al cambiar de página**. `BarraReproductor` es la barra fija de abajo.

Solo entran en la cola las pistas `origen = 'r2'`. Las de Mixcloud y SoundCloud usan el iframe
oficial de cada plataforma dentro de su tarjeta, porque esas plataformas no permiten controlar su
audio desde fuera de su reproductor.

Está enganchado a la **Media Session API**, así que se controla desde la pantalla de bloqueo y los
auriculares.

---

## 5. Variables de entorno

Están en `.env.local` (local) y en Vercel (producción). Los valores reales, en `CREDENCIALES.md`
—que no se sube a git—.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | Cliente de Supabase (pueden ser públicas) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreta.** Se salta el RLS; solo servidor |
| `CLOUDINARY_API_KEY` / `..._SECRET` | Firmar subidas de fotos |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Construir las URLs de imagen |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Música en R2 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Suscribir el móvil a los avisos |
| `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | **Secretas.** Firmar el envío de avisos |

Cualquier variable que empiece por `NEXT_PUBLIC_` **llega al navegador**. Nunca poner ahí un secreto.

---

## 6. Cómo trabajar en el proyecto

```bash
npm run dev                 # desarrollo en local
npx tsc --noEmit            # comprobar tipos
npx eslint src              # comprobar estilo y errores de React
npm run build               # build de producción
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"

# Solo si se recrea el bucket o se añade un dominio nuevo:
node --env-file=.env.local scripts/configurar-cors-r2.mjs
```

**Cambios de esquema**: escribir un fichero nuevo en `supabase/migrations/` (numerado) y aplicarlo
con la Management API de Supabase usando el token `sbp_…`. No editar tablas a mano por el panel sin
dejar el SQL en el repositorio, o la próxima persona no sabrá por qué la base de datos no coincide
con el código.

---

## 7. Límites que conviene vigilar

| Recurso | Límite | Qué pasa al acercarse |
|---|---|---|
| Cloudinary | 25 créditos (≈25 GB) | Bajar la calidad de compresión o pasar fotos antiguas a R2 |
| Cloudinary vídeo | 100 MB por fichero | La interfaz avisa antes de subir |
| R2 | 10 GB, salida gratis | De sobra para años de sesiones |
| Supabase | 500 MB de base de datos | Solo texto: tardará mucho en llenarse |
| Vercel Hobby | Sin límite práctico aquí | — |

El reparto está pensado justo para esto: lo que se escucha en bucle (música) va donde la salida es
gratis, y lo que se ve una vez (fotos) donde hay optimización automática.

**Ya no hace falta vigilarlo a mano**: `/admin/almacenamiento` (ver `lib/almacenamiento.ts`) muestra
el uso real de Cloudinary y R2, y `/api/cloudinary/firma` + `/api/r2/subir` bloquean subidas nuevas
al llegar al 90% de cada plan gratuito — antes de firmar, no a mitad de subida. Desde ese mismo panel
se puede borrar cualquier foto, vídeo o pista para hacer sitio: el borrado admin elimina el archivo
real en Cloudinary/R2, no solo la fila (a diferencia de `borrarMedia`/`borrarPista`, pensados para
que un miembro quite lo suyo, que solo tocan la base de datos).

---

## 7bis. Chat profesional (migración `0008_chat_pro.sql`)

El chat (`components/Chat.tsx` + `app/actions/chat.ts`) tiene todas las funciones habituales de una
app de mensajería **menos la subida de multimedia**, excluida a propósito para no poder disparar el
consumo de Cloudinary/R2 desde un canal sin límite de tamaño de conversación:

- **Responder**: al citar, el texto y autor del mensaje original se copian en columnas propias
  (`respuesta_texto`, `respuesta_autor`) en el momento de enviar. Es una foto fija a propósito: si el
  original se edita o se borra después, la cita no cambia, igual que en WhatsApp.
- **Editar**: solo el autor (columna `editado_at`, se ve "editado" junto a la hora).
- **Eliminar**: borrado *blando* — `borrado = true`, el texto se queda tal cual en la base de datos
  (la columna exige entre 1 y 4000 caracteres, así que no se puede vaciar) y es la interfaz la que
  oculta el contenido y muestra "Mensaje eliminado".
- **Reacciones** (`mensaje_reacciones`): un emoji por persona y mensaje; upsert por `(mensaje_id,
  perfil_id)`, así que reaccionar dos veces con emojis distintos reemplaza la reacción, no la suma.
- **Visto / doble check azul** (`chat_lecturas`): una fila por persona con "hasta qué momento he
  leído", no una fila por mensaje — comparar `created_at` del mensaje contra esa marca de cada
  miembro basta para saber si alguien más ya lo vio.
- **Burbuja de no leídos en tiempo real**: `BottomNav.tsx` escucha `mensajes` por su cuenta (no
  depende de que `/chat` esté montado). Con el chat abierto no hace nada: es el propio chat quien
  marca leído (antes lo hacían los dos y se escribía dos veces en `chat_lecturas` por cada mensaje
  recibido) y la burbuja ya se pinta en cero.
- **Piezas del chat** (ronda 2 de la auditoría): `Chat.tsx` es el orquestador y reparte el trabajo
  en `components/chat/` — `BurbujaMensaje.tsx` (memorizada con `memo`), `BarraEscritura.tsx` (el
  texto en curso vive ahí dentro, de modo que teclear no repinta la lista), `useRealtimeChat.ts` y
  `tipos.ts`.
- Los mensajes se piden **descendentes con `limit(200)` y se invierten al pintarlos**: ordenar
  ascendente dejaba fuera la conversación reciente en cuanto el chat pasara de 200 mensajes. Las
  reacciones vienen embebidas en la misma consulta (`mensaje_reacciones(...)`), no en una aparte.
- Igual que en `perfiles`, un trigger `mensajes_before_update` impide que alguien que no sea admin
  reasigne `autor_id` o falsee `created_at` al editar su propio mensaje.

Gotcha real encontrado al verificar en producción: el primer intento de borrado blando ponía
`texto: ""`, y saltaba el `check` de la columna (`char_length(texto) between 1 and 4000`). Arreglado
dejando el texto tal cual en la base de datos; la ocultación es solo de interfaz.

---

## 7ter. Burbuja de pendientes en el avatar

`components/AvatarPendientes.tsx` + `app/actions/pendientes.ts`: el avatar del header (única
puerta a `/perfil` desde que se quitó el botón redundante del menú inferior) lleva una burbuja roja
en tiempo real con el total de **tareas asignadas sin marcar como hechas** más **artículos de la
lista de la compra asignados sin marcar como comprados**. A propósito no cuenta nada de música ni
fotos: ahí no existe un estado "pendiente", solo "subido".

- El número inicial se calcula en el servidor (`obtenerPendientesPerfil`) con **dos `count` exactos**
  (`head: true`) filtrando por la tabla relacionada (`tareas.hecha = false`), y se pasa como prop,
  igual que la burbuja de no leídos del chat. Antes se descargaba cada asignación del miembro para
  contarlas con un `filter().length` en memoria.
- En el cliente escucha `UPDATE` en `tareas` y `lista_compra` (cualquier cambio de cualquiera,
  porque no se puede filtrar por "asignado a mí" directamente en esas tablas) y `*` en
  `tareas_miembros`/`compra_miembros` **filtrado por `perfil_id=eq.<yo>`** (asignaciones nuevas o
  quitadas). Cualquiera de los cuatro eventos vuelve a pedir el total al servidor.
- Solo escucha si `esMiembro`: quien está pendiente de aprobación no tiene nada asignado.
- **Estuvo roto desde el principio** y se arregló en la ronda 2 de la auditoría: esas cuatro tablas
  no estaban en la publicación `supabase_realtime` (migración `0011`), así que el servidor
  respondía "Unable to subscribe to changes with given parameters" y tumbaba el canal entero. El
  número inicial salía bien, pero no se movía hasta recargar.

---

## 7ter-bis. Un solo canal de Realtime para toda la app (`lib/realtime.ts`)

Había tres canales abiertos a la vez (`chat-vyp`, `chat-badge-vyp`, `pendientes-perfil-vyp`), cada
uno con su `getSession()` y su `setAuth`, y dos de ellos escuchando lo mismo: cada mensaje del chat
llegaba **dos veces** por el WebSocket y contaba doble en la cuota del plan gratuito.

`suscribirRealtime(escuchas, callback)` registra oyentes, suma sus escuchas y abre **un único canal
`vyp`** con la unión. Si alguien se suscribe pidiendo una escucha nueva (entrar en `/chat`), el
canal se rehace: los bindings de `postgres_changes` se mandan en el `phx_join` y no se pueden
añadir a un canal ya conectado.

> **Regla**: toda tabla que se escuche desde aquí tiene que estar en la publicación
> `supabase_realtime` (ver `0011_realtime_gestion.sql`). Si un solo binding no es suscribible,
> Supabase tumba **el canal completo** — y ahora el canal es común a todo el sitio.

---

## 7quater. Previa de 9 + borrado propio en `/perfil`

`/perfil` mostraba **todas** las fotos y **toda** la música de quien fuera, sin límite — de hecho
la consulta de música ni siquiera tenía `.limit()`. Con años de fiestas subiendo contenido eso
crecía sin tope y hacía la página cada vez más pesada (lo que el señor llamó "scroll infinito").

- `app/perfil/page.tsx` ahora limita ambas consultas a `LIMITE_PREVIA = 9` y pide el total aparte
  con `{ count: "exact", head: true }`; el enlace "Ver todas" solo aparece si hay más de 9.
- `/perfil/galeria` y `/perfil/musica` (páginas nuevas) listan **todo** lo de esa persona sin
  límite: es la vista explícita a la que se llega solo si se pide, no la que carga por defecto.
- `components/MiGaleria.tsx` y `components/MiMusica.tsx` son los mismos listados pero con un botón
  de borrar por elemento (`borrarMedia`/`borrarPista`, ya existentes). La política RLS de `media` y
  `pistas` (`subido_por = auth.uid() or es_admin()`) es la que de verdad decide quién puede borrar
  qué: cualquier miembro borra lo suyo, la directiva borra lo de cualquiera. El botón de la
  interfaz nunca es la única barrera.
- Igual que en la subida por lotes, `borrarMedia`/`borrarPista` revalidan `/perfil`,
  `/perfil/galeria|musica` y `/` además de `/galeria`/`/musica`, para que el carrusel de la home no
  se quede enseñando algo recién borrado.
- Sigue pendiente lo de siempre (ver más abajo): esto borra la fila, no el archivo real en
  Cloudinary/R2. Para borrar el archivo de verdad, la directiva usa `/admin/almacenamiento`
  (`borrarMediaAdmin`/`borrarPistaAdmin`), que ya lista y permite borrar el contenido de **todos**
  los perfiles, no solo el propio.

---

## 7quinquies. Resetear contraseña y eliminar miembro (`/admin/miembros`)

Dos acciones nuevas en `app/actions/miembros.ts`, aparte de aprobar/revocar, ambas usando
`createAdminClient()` (`service_role`) porque tocan la API de administración de Auth, no una tabla
propia con RLS:

- **`resetearContrasena(id)`**: no hay SMTP transaccional configurado, así que no hay email de
  "restablece tu contraseña". En su lugar se genera una contraseña temporal aleatoria (10
  caracteres, sin `0/O/1/l/I` para que se pueda copiar a mano sin confusiones) con
  `auth.admin.updateUserById`, y se enseña **una sola vez** en pantalla (`AccionesMiembro.tsx`) para
  que la directiva se la pase al miembro por WhatsApp o como sea.
- **`eliminarMiembro(id)`**: borra la cuenta de Auth con `auth.admin.deleteUser`, y de ahí en
  cascada su fila de `perfiles` (`perfiles.id references auth.users(id) on delete cascade`). Lo
  importante es qué le pasa a lo demás:
  - `media.subido_por` y `pistas.subido_por` son `on delete set null` desde el principio (migración
    0001): sus fotos, vídeos y música **sobreviven**, solo se quedan sin autor.
  - `comentarios.autor_id`, `mensajes.autor_id`, `tareas_miembros`/`compra_miembros` sí son
    `on delete cascade`: sus comentarios, sus mensajes del chat y sus asignaciones desaparecen con
    la cuenta. Es una consecuencia real y deliberadamente no se ha tocado el esquema para
    evitarlo — solo se pidió no perder las subidas, que es justo lo que ya garantizaba el esquema.
  - Ambas acciones llaman a un guardia (`exigirObjetivoNoAdmin`) que impide tocar la cuenta de la
    directiva por error, comprobando el rol de la cuenta OBJETIVO (no de quien pide la acción).
- Verificado end-to-end contra Supabase real (no solo RLS en teoría): usuario de prueba creado con
  la API de administración, aprobado, con una foto asignada; reseteo confirmado con login real
  usando la contraseña nueva; borrado confirmado con el perfil desaparecido y la foto intacta con
  `subido_por = null`. Datos de prueba limpiados después.

---

## 7sexies. Bio y directorio de miembros (migración `0009_bio_perfiles.sql`)

- Columna `bio` en `perfiles` (máx. 300 caracteres), editable desde `EditarPerfil.tsx` /
  `guardarPerfil`, e incluida en la vista `autores` (ya era pública el nombre/avatar, la bio es del
  mismo nivel de sensibilidad).
- `/miembros` y `/miembros/[id]` son de solo lectura para cualquier miembro aprobado: directorio y
  perfil público (avatar, usuario, bio, sus tareas y compra asignada, sus últimas 9 fotos/pistas).
  **Gotcha real**: la política RLS de `perfiles` es `id = auth.uid() or es_admin()` — un miembro
  normal no puede leer la fila de otro por la vía normal. Estas dos páginas usan
  `createAdminClient()` a propósito para leer `perfiles`, exponiendo solo columnas no sensibles
  (nombre, usuario, avatar, bio, rol), igual que ya se hizo para el contador de miembros de la home.
  `tareas`/`tareas_miembros`/`lista_compra`/`compra_miembros` SÍ son legibles por cualquier
  miembro con el cliente normal (es organización de la peña, no algo privado), a diferencia de
  `deudas`/`participantes`, que siguen siendo solo de la directiva y no aparecen aquí.
- Al principio el enlace a `/miembros` solo vivía como un texto discreto dentro de `/perfil`, y el
  señor no lo encontraba. Se añadió "Miembros" al menú de escritorio (`Header.tsx`) y a la barra
  inferior móvil (`BottomNav.tsx`, icono `Users`), que es donde de verdad se descubre.

---

## 7septies. Bug real: aprobar un miembro no le dejaba entrar

Un miembro real (`juaniyo`) fue aprobado por la directiva y no podía iniciar sesión con su usuario y
contraseña. Causa: Supabase exige confirmar el email antes de dejar entrar por contraseña
(`mailer_autoconfirm = false`), y esta web no tiene SMTP propio configurado — usa el mailer por
defecto de Supabase, que es lento, con límite de 2 envíos/hora y a menudo cae en spam o no llega.
**Aprobar un registro (`aprobarMiembro`) y confirmar el email eran dos cosas totalmente
independientes**: la directiva daba el visto bueno en `/admin/miembros`, pero por debajo la cuenta
seguía con `email_confirmed_at = null`, y Supabase seguía rechazando el login.

Arreglo en `app/actions/miembros.ts`: `aprobarMiembro` ahora también llama a
`auth.admin.updateUserById(id, { email_confirm: true })` con el cliente de servicio, a la vez que
marca `aprobado = true`. La aprobación manual de la directiva ya es el filtro de confianza real de
esta peña; pedir además una confirmación por email que puede no llegar solo rompía el acceso sin
aportar nada. Verificado con un registro de prueba de extremo a extremo (crear sin confirmar →
aprobar → login con contraseña funciona) y arreglada a mano la cuenta de `juaniyo`, que ya puede
entrar.

---

## 7octies. Bug real: el chat "perdía" el historial al reabrir la app

No era un problema de persistencia — los mensajes siempre estuvieron a salvo en `mensajes` — sino de
**lectura**: desde que la migración del chat pro (`0008_chat_pro.sql`) añadió `mensaje_reacciones`
(con FKs a `mensajes` Y a `perfiles`), PostgREST encuentra **dos caminos** distintos desde `mensajes`
hasta `autores` (uno directo por `autor_id`, otro atravesando `mensaje_reacciones`). Un embed
`autores(nombre, avatar_url)` sin desambiguar, en ese contexto, no es un error de RLS ni de datos:
PostgREST **rechaza la consulta entera** con `PGRST201`. `app/chat/page.tsx` no comprobaba el
`error` de esa consulta en concreto, así que cada vez que se abría `/chat` la petición fallaba en
silencio y la interfaz mostraba "Aún no hay mensajes" — pareciendo que la conversación se había
borrado, cuando en realidad ni siquiera había llegado a leerse.

Arreglo: nombrar la relación a propósito, `autores!mensajes_autor_id_fkey(...)`, en las dos
consultas afectadas (`app/chat/page.tsx` y la cita de respuesta en `app/actions/chat.ts`). Se añadió
además un `console.error` si esa consulta vuelve a fallar alguna vez, para que un fallo así no vuelva
a pasar desapercibido. Verificado contra producción real con sesión de admin: antes del arreglo la
consulta devolvía `PGRST201` y el HTML no traía ningún mensaje; después, los 9 mensajes reales de la
conversación aparecen todos.

De paso: el botón de activar/desactivar avisos (`AvisosPush`) estaba montado dos veces — en `/perfil`
y dentro del propio `Chat.tsx` — así que aparecía en dos sitios distintos de la app. Se ha quitado
del chat: vive solo en `/perfil`, que es donde tiene sentido como ajuste de la cuenta.

---

## 7nonies. Bug real: el service worker podía dejar a un miembro "sin acceso a nada"

Un miembro real (`juaniyo`, ya aprobado y con el email confirmado) reportó no poder entrar a
ninguna sección aunque el inicio de sesión funcionaba. Servidor, RLS y páginas se comprobaron uno
por uno con su sesión real (curl con su cookie de verdad) y **todo respondía 200 correctamente** —
la app no tenía ningún bloqueo de verdad para un miembro normal.

La causa estaba en `public/sw.js`: la estrategia de caché guardaba **cualquier** respuesta GET
exitosa, incluidas las páginas HTML, que dependen de quién ha iniciado sesión (aprobado o no, admin
o no). Si alguien visitaba `/chat`, `/galeria`, etc. **antes** de que la directiva le aprobara, esa
página con el mensaje de "cuenta pendiente" se guardaba en caché; más tarde, con un fallo de red de
un instante (típico en móvil), el service worker podía servir esa respuesta vieja en vez de ir a la
red — aunque la cuenta llevara ya aprobada un buen rato. Es un fallo de diseño real: el Cache API
guarda por URL, no por sesión, así que cachear documentos autenticados es intrínsecamente
arriesgado (hasta podría servir el HTML de una sesión a otra distinta).

Arreglo: las peticiones de documento (`req.mode === "navigate"` o `destination === "document"`) ya
NUNCA se cachean ni tienen respaldo de caché — van siempre a la red, y si no hay conexión, que el
navegador muestre su aviso de siempre en vez de arriesgarse a enseñar la página de otra sesión. Solo
se siguen cacheando los recursos estáticos (JS, CSS, iconos), que son iguales para todo el mundo.
Se subió además la versión de caché (`vyp-v2` → `vyp-v3`) para que el `activate` del service worker
borre cualquier caché vieja ya guardada en los móviles de la gente.

---

## 7decies. Gestión abierta a la peña: camisetas, pagos y tickets (migración `0012`)

Hasta ahora `Gestión` entera era de la directiva. Se abre a cualquier miembro aprobado, porque
organizar las fiestas lo hace la peña; siguen siendo exclusivas las dos cosas que de verdad lo son:
`/admin/miembros` (dar de alta y echar gente) y `/admin/almacenamiento` (borrar archivos).

**Gotcha que habría roto todo al abrirla:** las pantallas de gestión leían la lista de gente con
`from("perfiles")`, y la RLS de esa tabla es `id = auth.uid() or es_admin()`. Para un miembro
normal eso devuelve **su propia fila y nada más**, así que repartir tareas o la compra se habría
quedado sin nadie a quien asignar. Lo mismo con los joins anidados `perfiles(...)` de
`tareas_miembros` y `compra_miembros`. Se centraliza en `lib/miembros.ts` (`listarMiembros`,
`indiceMiembros`), que usa el cliente de servicio y expone solo nombre, usuario y avatar —nunca el
rol ni la aprobación—, cacheado por petición.

- **`participantes` se retira.** Mezclaba talla, pago e importe en una ficha. Se parte en lo que de
  verdad son dos cosas: `pagos` (sí/no, sin importes) y `pedidos_camiseta` (cuántas quiere cada uno
  y de qué talla). Las tallas van en un `text[]`, una posición por camiseta, así que la cantidad es
  cuántas hay.
- **Camisetas** (`camisetas` + `camisetas_votos`): cualquiera propone un diseño con foto y hay
  **un voto por persona y año** —no por camiseta—, con la clave primaria `(perfil_id, anio)`
  haciéndolo cumplir. Así "la más votada" cuadra siempre con cuánta gente hay, y cambiar de
  opinión mueve el voto en vez de acumular.
- **Deudas**: pasan de `for all` solo-admin a leerlas toda la peña y escribirlas solo la directiva,
  y admiten foto del ticket (`ticket_url`).
- El flujo de subida firmada a Cloudinary estaba copiado en el avatar y en la galería; con
  camisetas y tickets iban a ser cuatro copias, así que vive en `lib/subir-cloudinary.ts`.

**Fallo real encontrado de paso:** `alternarComprado` exigía ser admin, mientras su gemela
`marcarTarea` solo exigía ser miembro. La RLS de `lista_compra` ya permitía
`es_admin() or compra_asignada(id)`, así que un miembro podía dar por hecha su tarea desde el
perfil pero al tachar su compra le saltaba "Solo la directiva puede hacer esto". Ahora pide ser
miembro y decide la base de datos, como debía.

**URLs de imagen que llegan del navegador.** El archivo se sube directo a Cloudinary y al servidor
solo viaja la URL resultante, así que es un dato de fuera. Importa sobre todo en el ticket de una
deuda, que se pinta como `<a href>` y ahora lo ve **toda la peña**: una `javascript:...` ahí sería
un enlace malicioso para todos. `lib/cloudinary-url.ts` (sin `"use client"`, porque lo usan los dos
lados) exige `https` y el host exacto `res.cloudinary.com` con `new URL()`, que compara el host ya
normalizado y no se deja engañar por `https://res.cloudinary.com.otrositio.com/`. Se aplica en
`crearDeuda` y en `registrarCamiseta`. Comprobado con los ocho casos habituales
(`javascript:`, `JavaScript:`, `data:`, `http:`, host suplantado, protocolo relativo y vacío).

**Verificado en producción con la sesión real de un miembro normal (Paco):** entra en gestión,
camisetas, pagos, tareas, compra y deudas; se topa con "solo para la directiva" en miembros y
almacenamiento; ve a los tres miembros en Pagos pero sin poder marcar la casilla; y contra la base
de datos con su propio token, intentar marcarse el pago o tocar el pedido de otro devuelve
`42501` (violación de RLS). Datos de prueba limpiados después.

---

## 7undecies. Bug real: las acciones del chat no existían en el móvil

Responder, editar, borrar y reaccionar estaban implementadas y funcionando, pero **no había forma
humana de llegar a ellas desde un teléfono**. Los botones vivían en un contenedor con
`opacity-0 pointer-events-none` que solo se activaba con `group-hover/msg`: en una pantalla táctil
no existe el `:hover`, así que eran invisibles *y* además intocables. La app es "móvil primero",
o sea que el fallo se comía justo el caso de uso principal.

Arreglo, con el gesto de cualquier app de mensajería:

- `usePulsacionLarga.ts` — detecta mantener pulsado (450 ms). Lo delicado es que el dedo también
  baja sobre un mensaje al desplazar la conversación, así que el gesto se cancela en cuanto el
  contacto se aparta más de 10 px del punto inicial. Con ratón, un clic normal hace lo mismo
  (más descubrible que un botón que solo aparece al pasar por encima); con el dedo, un toque suelto
  no hace nada, como en WhatsApp. `onContextMenu` se anula para que el menú propio sustituya al del
  navegador.
- `HojaAcciones.tsx` — el menú va **anclado abajo**, no flotando junto a la burbuja: así no se sale
  de la pantalla ni lo recorta la lista, caiga el mensaje donde caiga. Se dibuja **una sola vez** en
  el chat, no una por mensaje (son 200 en pantalla). Incluye "Copiar texto", que compensa el
  `select-none` que hace falta para que el móvil no empiece a seleccionar a media pulsación.
- Se elimina de paso el estado `picketaAbierta`: el selector de emojis suelto y el menú hacían lo
  mismo por dos caminos distintos. Ahora hay uno.
- En escritorio queda un botón "···" al pasar por encima que abre ese mismo menú.
- La cabecera del chat lo explica ("Mantén pulsado un mensaje para…"): el gesto hay que contarlo,
  nadie lo adivina.

**Verificado en un Chromium real con pantalla táctil simulada (390×844, `has_touch`)**, no con
curl: un toque suelto no abre nada; mantener pulsado abre el menú; responder deja la cita en la
barra de escritura; editar, reaccionar y borrar se ven en pantalla **y quedan guardados en la base
de datos** (`editado_at` con fecha, `borrado = true`, la reacción en su tabla). En escritorio, clic
abre y Escape cierra. Sin errores de consola. Datos de prueba limpiados.

---

## 7duodecies. Cierre de brecha: avisos directos sin comprobar "aprobado" en el envío

El señor pidió confirmar que quien no esté registrado y aprobado no reciba ni un solo aviso.
`/api/push/suscribir` ya exigía `esMiembro` para poder suscribirse, así que alguien sin aprobar
nunca podía tener una fila en `push_subs` — ese caso ya estaba cerrado. Pero `avisarUsuario()`
(usada para "ya eres de la peña", tarea asignada, contraseña reseteada…) filtraba por `user_id` sin
volver a comprobar `aprobado` en el momento del envío, a diferencia de `avisarMiembros`/
`avisarAdmins`, que sí lo hacían. Si a alguien se le revocaba la cuenta **después** de haberse
suscrito, seguía siendo alcanzable por avisos dirigidos a su id.

Arreglo en `lib/push.ts`: el filtro `perfiles.aprobado = true` se aplica ahora a los tres tipos de
destinatario desde el principio de la consulta, no solo a "miembros"/"admins". Verificado contra la
base de datos real (sin enviar ningún push de verdad): con la cuenta de un miembro aprobada, la
consulta que usa `avisarUsuario` devuelve su suscripción; revocando `aprobado` a mano, la misma
consulta deja de devolver nada; restaurado el estado original después.

---

## 7terdecies. Visor a pantalla completa para los diseños de camiseta

Las miniaturas de `PanelCamisetas` (200×200 recortadas) no dejaban ver el detalle real de la
camiseta. Ahora la miniatura es un botón que abre `VisorImagen.tsx` (nuevo, reutilizable): fondo
oscuro, imagen a `object-contain` (se ve entera, sin recortar), cierre con el botón, con un clic
fuera de la imagen o con Escape.

**Bug real encontrado al probarlo en un Chromium con pantalla táctil (no con curl, aquí no sirve):**
el botón de cerrar quedaba **tapado** por el contenedor de la imagen. Ambos son hijos directos del
mismo `fixed inset-0` sin `z-index`, así que el orden en el DOM decidía qué se pinta encima — y el
contenedor de la imagen, que viene después, ganaba. El clic en la esquina donde debía estar la "X"
en realidad caía sobre la imagen. Arreglado dándole `z-10` al botón de cerrar.

Verificado con Playwright (viewport móvil, táctil): la miniatura abre el visor, la imagen ocupa la
pantalla completa, el botón de cerrar funciona, Escape también. Datos de prueba limpiados.

---

## 8. Pendiente / ideas para más adelante

- Notificaciones también al subir fotos nuevas (hoy solo avisa el chat).
- Borrar el fichero de Cloudinary/R2 al borrar la fila (hoy se borra el registro, no el archivo).
- Página de perfil editable (cambiar nombre y foto).
