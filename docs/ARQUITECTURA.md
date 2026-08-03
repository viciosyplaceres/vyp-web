# Arquitectura técnica — Web de la peña VYP

Documento de referencia para mantener o ampliar la web. El *qué* y el *por qué* del producto están
en `PLAN.md`; aquí está el *cómo*.

Actualizado: 2026-08-03

---

## Descubrimiento público

- `app/robots.ts` permite rastrear portada, galería y música, bloqueando las
  zonas privadas, autenticación y API; enlaza el sitemap oficial.
- `app/sitemap.ts` publica portada, música, índice de galería, años y archivos
  públicos. Consulta `media` con la clave pública y conserva las rutas estáticas
  si Supabase no responde, evitando un sitemap con error 500. Se regenera como
  máximo cada hora para incorporar nuevas subidas sin desplegar de nuevo.
- Las páginas públicas declaran canonical bajo `www.viciosyplaceres.com`; las
  páginas privadas mantienen `noindex` en su metadata.

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
    loading.tsx             Estado inmediato mientras termina una navegación dinámica
    page.tsx                Portada: carrusel de fotos, música compacta, mapa ("#donde"), invitación
    galeria/                Años → cuadrícula → detalle con comentarios. Botón "Subir" propio (miembros)
    musica/                 Lista de pistas (R2 + embeds externos). Botón "Subir música" propio (miembros)
    chat/                   Chat interno de miembros
    perfil/                 Avatar, usuario, mis tareas/compra/fotos/música, ajustes, salir
    admin/                  Año de gestión activo · participantes · deudas · tareas · compras ·
                            miembros · almacenamiento
    login/ registro/        Acceso y alta
    actions/                Server actions + lectura combinada de contadores de navegación
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
    r2-claves.ts            Valida los namespaces y el formato de las claves R2
    embeds.ts               Mixcloud/SoundCloud + formato de duración
    push.ts                 Envío de avisos con web-push (filtra por rol)
    push-cliente.ts         Conversión de la clave VAPID en el navegador
  proxy.ts                  Refresco de sesión + protección de rutas
supabase/migrations/        Historial completo del esquema y funciones SQL
public/                     manifest.webmanifest, sw.js, logos
tests/                      Pruebas Node del service worker y los namespaces R2
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

### Ventana anual de escritura

`src/lib/temporada.ts` es una función pura y la fuente de verdad en TypeScript: convierte el
instante recibido a `Europe/Madrid` con `Intl.DateTimeFormat` y abre desde el 1 de agosto 00:00
incluido hasta el 11 de septiembre 00:00 excluido. `tests/temporada.test.mjs` fija los cuatro bordes
UTC/Madrid y comprueba que el `TZ` del proceso no cambia el resultado.

La defensa se reparte así:

1. `components/Temporada.tsx` mantiene el estado global alineado al segundo, pinta el banner al
   cerrar y permite ocultar registro/subidas. `Chat.tsx` pasa a solo lectura: sin compositor,
   respuesta, edición ni reacciones; copiar, información y borrado propio siguen accesibles.
2. `lib/temporada-servidor.ts` expone `exigirTemporadaAbierta()`. Todas las Server Actions que crean
   o cambian contenido normal lo llaman antes de su primera escritura. También lo hacen
   `/api/cloudinary/firma` y `/api/r2/subir` antes de consultar cuota o emitir una firma.
3. `supabase/migrations/20260803014636_temporada_escrituras.sql` define
   `private.temporada_abierta(timestamptz)` y un único trigger genérico
   `private.exigir_temporada_escritura()`, instalado como `BEFORE INSERT OR UPDATE OR DELETE` en
   todas las tablas de contenido y gestión. Así una escritura directa por PostgREST o una RPC no
   evita la temporada. La migración es idempotente y usa referencias `public.`/`private.` completas
   para que JARVIS pueda reescribir los esquemas de cada app fabricada. Aplicada en producción el
   2026-08-03 tanto a `public` (VYP) como, ya adaptada, a `pena_akelarre`: 20 tablas y 60 eventos de
   trigger por schema.

Fuera de temporada el trigger conserva exactamente estas excepciones, siempre subordinadas al RLS
existente:

| Escritura | Motivo |
|---|---|
| `push_subs` INSERT/UPDATE/DELETE | Activar o retirar avisos todo el año |
| `chat_lecturas` INSERT/UPDATE/DELETE | No leídos y checks de lectura |
| `perfiles` DELETE | Baja y privacidad |
| `perfiles` UPDATE solo `aprobado: true -> false` | Revocación de acceso inmediata |
| `media`, `pistas`, `comentarios`, `mensajes` DELETE | Borrado autorizado de contenido existente |
| `mensajes` UPDATE solo `borrado: false -> true` | Borrado blando sin edición encubierta |
| DELETE en cascada nacido de uno de los borrados anteriores | La baja/purga no queda a medias |
| UPDATE anidado que solo pone a NULL una FK con `ON DELETE SET NULL` | Conserva media, música, camisetas, tareas, deudas y respuestas al borrar su autor/origen |

Login, logout, cambios/reset de contraseña y SSO actúan en Auth o generan una redirección, no en
las tablas bloqueadas, y permanecen disponibles. Lecturas y reproducción nunca pasan por el trigger.
Las acciones `borrarMedia*`, `borrarPista*`, `borrarComentario`, `borrarMensaje`,
`vaciarHistorialChat`, `revocarMiembro` y `eliminarMiembro` no llevan guardia estacional a propósito.

El alta normal de Auth termina insertando `public.perfiles`; fuera de temporada ese INSERT solo se
acepta si la fila correspondiente de `auth.users` contiene el booleano
`raw_app_meta_data.fabrica_provisioning = true`. Esa metadata de aplicación solo la establece un
cliente de confianza. `raw_user_meta_data` no se consulta ni se considera autorización bajo ningún
concepto.

### Subidas: por qué van firmadas

Ni Cloudinary ni R2 reciben ficheros del navegador sin permiso previo:

- **Fotos/vídeos**: el navegador pide una firma a `/api/cloudinary/firma`. Esa ruta comprueba que
  quien la pide es miembro aprobado y firma con el `API_SECRET`, que nunca sale del servidor. Sin
  firma válida, Cloudinary rechaza la subida. En la última hora del 10 de septiembre, el timestamp
  se antedata para que la validez máxima de una hora termine justo con la temporada.
- **Música**: `/api/r2/subir` devuelve una URL prefirmada de 30 minutos. **La clave del objeto la
  decide el servidor**, no el cliente: así nadie elige dónde escribe dentro del bucket. En los
  últimos 30 minutos de temporada, su caducidad se recorta al cierre.
- **Escuchar**: `/api/r2/reproducir?clave=…` redirige a una URL prefirmada de lectura. Antes
  comprueba que la clave tiene el formato `musica/<uuid>.<ext>` y corresponde a una pista
  registrada, para que nadie use la ruta como visor del bucket entero.
- **Documentos de tareas y de la compra**: `/api/r2/documento?clave=…` hace lo mismo pero
  exige `documentos/<uuid>.<ext>` y comprueba que la clave está en `tareas.documento_url` **o** en
  `lista_compra.documento_url` (una sola ruta para las dos). La migración
  `20260728024741_aislar_namespaces_r2.sql`, aplicada el 28-07-2026, impone las mismas reglas en
  Postgres: una llamada directa a la Data API tampoco puede publicar un documento como música.

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

**Filtro por miembro y "Reproducir todo"** (`ListaMusica.tsx`): un desplegable con quien ha subido
algo filtra la lista a solo su música. La cola que se pasa a `reproducir()` se calcula siempre a
partir de la lista **ya filtrada**, así que da igual si arrancas con "Reproducir todo" o tocas una
canción suelta: "siguiente" se mueve dentro de esa persona mientras el filtro siga puesto, porque
la cola nunca llega a incluir canciones de nadie más.

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
npm test                    # service worker y separación de namespaces R2
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

### Dependencias corregidas antes que Next estable

`package.json` fija mediante `overrides` `postcss@8.5.23` y `sharp@0.35.3`. Next 16.2.12 todavía
declara versiones vulnerables, pero la rama oficial 16.3 ya usa esas mismas ramas corregidas. Se
mantiene Next estable y se verifican build y transformación real con Sharp. `npm audit --omit=dev`
queda en cero; la auditoría completa conserva los avisos de `minimatch` del ecosistema ESLint hasta
que sus plugins publiquen una versión compatible.

---

## 7. Límites que conviene vigilar

| Recurso | Límite | Qué pasa al acercarse |
|---|---|---|
| Cloudinary | 25 créditos compartidos | Bajar la calidad de compresión o pasar fotos antiguas a R2 |
| Cloudinary vídeo | 100 MB por fichero | La interfaz avisa antes de subir |
| R2 | 10 GB, salida gratis | De sobra para años de sesiones |
| Supabase | 500 MB de base de datos | Solo texto: tardará mucho en llenarse |
| Vercel Hobby | Sin límite práctico aquí | — |

El reparto está pensado justo para esto: lo que se escucha en bucle (música) va donde la salida es
gratis, y lo que se ve una vez (fotos) donde hay optimización automática.

Un crédito de Cloudinary no equivale a 1 GB garantizado de almacenamiento: la misma bolsa mensual
se consume con almacenamiento, transformaciones y tráfico. La interfaz consulta el uso real de la
cuenta, no promete una capacidad fija de 25 GB.

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
  depende de que `/chat` esté montado). Al entrar en `/chat` resetea su estado local y el propio
  chat guarda la lectura; así, al salir del chat la burbuja no puede reaparecer con un contador
  obsoleto. Antes ambos marcaban leído por cada mensaje recibido, duplicando escrituras en
  `chat_lecturas`.
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

## 7ter. Actividad diaria de Supabase

`vercel.json` programa a las 04:17 UTC la ruta `GET /api/mantenimiento/supabase` mediante Vercel
Cron, fuera del VPS. La ruta ejecuta tres lecturas de una fila (`media`, `pistas` y `comentarios`)
con la clave anónima pública, no devuelve contenido y nunca escribe ni borra datos. Mantiene la
actividad diaria que Supabase recomienda para que un proyecto Free no se pause tras siete días sin
uso. Se desactiva automáticamente si se elimina ese cron del despliegue o se sube el proyecto a un
plan de pago, donde Supabase no aplica la pausa automática.

---

## 7quater. Burbuja de pendientes en el avatar

`components/AvatarPendientes.tsx` + `app/actions/pendientes.ts`: el avatar del header (única
puerta a `/perfil` desde que se quitó el botón redundante del menú inferior) lleva una burbuja roja
en tiempo real con el total de **tareas asignadas sin marcar como hechas** más **artículos de la
lista de la compra asignados sin marcar como comprados**. A propósito no cuenta nada de música ni
fotos: ahí no existe un estado "pendiente", solo "subido".

- El número inicial se calcula junto al de mensajes no leídos mediante
  `contadores_navegacion()` (ver el apartado 7septvicies). Los refrescos de Realtime siguen usando
  `obtenerPendientesPerfil`: son eventos aislados posteriores al render y ahí los dos `count`
  exactos (`head: true`) evitan descargar las asignaciones. Antes se descargaba cada fila para
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

**Segunda corrección, auditoría del 28-07-2026:** las navegaciones internas de Next.js no son
documentos, sino respuestas RSC con `destination` vacío. La condición anterior no las cubría y el
bloque genérico de GET podía guardarlas. La política final (`vyp-v5`) ya no intenta enumerar qué es
privado: solo permite en caché `/_next/static/`, logos, manifest, favicon y Open Graph. HTML, RSC,
API, imágenes optimizadas y cualquier futura ruta de datos quedan en red por defecto. Cuatro pruebas
con `node:test` verifican la exclusión de RSC/API, la lista blanca y el fallback sin conexión.

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
- La ayuda inicial explicaba el gesto en la cabecera. Se retiró después para maximizar el espacio
  útil de lectura; el menú contextual y el botón "···" de escritorio mantienen las acciones
  accesibles sin reservar una cabecera permanente.

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

## 7quaterdecies. "Mis tareas" no decía con quién se compartía la tarea

`/admin/tareas` (la gestión) siempre mostró el avatar y nombre de cada encargado — eso ya
funcionaba. El hueco estaba en `/perfil` ("Mis tareas" y "Lo que me toca comprar"): el tipo
`MiTarea` ni siquiera tenía un campo `asignados`, así que si una tarea o un artículo de la compra
se repartía entre varias personas, cada una veía la suya sin ninguna pista de con quién la
compartía.

Arreglo: `perfil/page.tsx` pide en un segundo viaje (los ids solo se conocen tras el primero) las
filas de `tareas_miembros`/`compra_miembros` de esas tareas/artículos concretos, las cruza con
`indiceMiembros()` (ya se usaba para las deudas) y `MisPendientes.tsx` pinta avatar + nombre de
cada encargado — marcando "Tú" en vez de tu propio nombre. Solo se muestra cuando de verdad hay
más de una persona: ver "Tú" en solitario en cada tarea sería ruido, no información.

Verificado con una tarea real compartida entre dos miembros (admin + un miembro sin foto de
avatar): en el perfil del admin aparece "Tú" con su foto y el nombre del otro miembro con su
avatar por iniciales, tal cual llegan de la base de datos. Datos de prueba limpiados.

---

## 7quindecies. El "···" del chat solo se veía con el ratón

La ronda anterior (7undecies) arregló que en el móvil no hubiera NINGUNA forma de tocar
responder/editar/borrar/reaccionar, añadiendo el gesto de mantener pulsado. Pero el botón visible
—el "···"— seguía viviendo en un contenedor `opacity-0` que solo se hacía visible con
`group-hover/msg`, restringido además a `md:flex` (invisible por debajo del punto de corte de
escritorio). Es decir: el **gesto** funcionaba en el móvil, pero no había ningún **indicio visual**
de que existiera — exactamente lo que el señor señaló: "en escritorio veo los tres puntos, ¿pero en
el móvil cómo los veo?". Para una app pensada para gente poco tecnológica, un gesto invisible sin
pista no es una solución completa.

Arreglo: el botón "···" pasa a vivir **dentro de la propia burbuja**, en la fila de la hora, junto a
los checks de leído — **siempre visible**, en móvil y en escritorio, sin depender de hover ni de
ningún gesto. La pulsación larga se queda como atajo adicional para quien la conozca de otras apps,
pero ya no es la única vía. Al estar el botón dentro del área que también escucha la pulsación
larga, se le corta la propagación del puntero (`stopPropagation` en `onPointerDown`) para que
tocarlo no arme además el temporizador del padre y acabe abriendo el menú por partida doble en
ratón.

Verificado con Playwright en tres escenarios reales (no solo compilación): viewport móvil sin tocar
nada — los 10 botones ya están visibles de entrada; un toque simple (no una pulsación larga) sobre
el botón abre el menú completo; la pulsación larga sigue funcionando en paralelo como atajo; y en
escritorio, tanto el botón como el clic siguen funcionando. Capturas de pantalla revisadas a mano.

---

## 7sexdecies. React #418: las horas se escribían en dos zonas horarias distintas

El señor vio un `Minified React error #418` en el móvil. Es un desajuste de hidratación de **texto**:
el HTML que manda el servidor y lo que el navegador calcula al hidratar no coinciden.

**Causa, reproducida:** `horaCorta`, `diaRelativo` y la fecha de los comentarios usaban
`toLocaleTimeString`/`toLocaleDateString` **sin fijar `timeZone`**, así que cada lado usaba la suya:
Vercel corre en **UTC** y el móvil de la peña en **Europe/Madrid**. El mismo mensaje salía como
`19:22` en el HTML del servidor y como `21:22` al hidratar → React tira el árbol servido y vuelve a
pintar entero en el cliente.

**Arreglo:** `timeZone: "Europe/Madrid"` fijado en `lib/formato.ts` (constante `ZONA`) para las tres
funciones. Para "Hoy"/"Ayer" no basta con comparar los componentes de la fecha en bruto: se compara
el día **ya convertido a hora de aquí** (`diaEnMadrid`, con locale `en-CA` porque da formato ISO
comparable como texto). Si no, un mensaje de las 00:30 de Madrid —23:30 UTC del día anterior—
contaba como de otro día según quién mirase. De paso, la hora que se ve es siempre la de las
fiestas aunque alguien abra la web desde fuera de España.

**Verificado de las dos maneras**, con un Chromium en `timezone_id="Europe/Madrid"` contra un
servidor arrancado con `TZ=UTC` (el escenario exacto de Vercel): con el código anterior
(`git stash`) el error #418 **se reproduce**; con el arreglo, cero errores de hidratación y las
horas correctas en hora española. Repetido después contra producción con la sesión de un miembro
normal.

**Nota de proceso (fallo mío):** el "Email o contraseña incorrectos" que el señor veía con las
cuentas de miembro NO era un fallo de la app — las cuentas estaban confirmadas, aprobadas y sin
bloqueo. Era que en rondas anteriores probé el acceso de esos miembros **cambiándoles la contraseña
real** y no había forma de restaurarla (no se conoce la original). Para probar sesiones ajenas hay
que crear una cuenta desechable y borrarla al terminar, nunca tocar la de alguien que la está
usando.

---

## 7septdecies. Registro sin correo de confirmación

El señor no quería que Supabase mandara un email de "confirma tu cuenta" en cada registro: la
directiva ya hace de filtro real aprobando a mano en `/admin/miembros`, así que pedir además
confirmar el correo era un segundo cerrojo redundante — el mismo motivo por el que
`aprobarMiembro()` ya confirmaba el email al aprobar (7septies).

Causa raíz, en el proyecto de Supabase (no en el código): `mailer_autoconfirm = false` en la
configuración de Auth. Con eso activo, cada `signUp()` deja la cuenta con `email_confirmed_at` en
blanco y dispara el correo de confirmación por defecto de Supabase (el mismo mailer lento y
limitado de siempre, sin SMTP propio).

**Arreglo**: `mailer_autoconfirm = true` vía la Management API del proyecto. Con esto,
`supabase.auth.signUp()` confirma la cuenta al instante y **no manda ningún correo** — la persona
queda con sesión iniciada de inmediato, igual que si hubiera hecho login, solo que con
`aprobado = false` hasta que la directiva la apruebe. De paso se quitó de
`registro/gracias/page.tsx` la frase "revisa tu correo para confirmar la cuenta", que ya no aplica.

Con esto activo, el parche de `aprobarMiembro()` de la ronda 7septies queda como defensa de
respaldo (por si alguien cambia esta opción sin saberlo), no como el único camino.

Verificado con un registro real de extremo a extremo con una cuenta desechable en Mailinator: el
`signUp` devuelve `access_token` y `email_confirmed_at` relleno en la misma respuesta, sin ningún
correo de por medio; el perfil se crea con `aprobado = false`, tal cual debe quedar hasta que se
apruebe a mano. Cuenta de prueba borrada después.

---

## 7octodecies. "Info del mensaje": quién lo ha visto y quién no

Nuevo botón "Info del mensaje" dentro de `HojaAcciones.tsx` (el menú de los tres puntos), disponible
para cualquier mensaje que ya exista de verdad en el servidor (no para el envío optimista con id
`temp-...`, que todavía no existe para nadie más). Abre `PanelInfoLectura.tsx`, con dos listas:
"Visto por" y "Todavía no lo ha visto".

**No hace falta ninguna consulta ni tabla nueva**: `chat_lecturas` ya guardaba, desde el chat con
reacciones (7octies), "hasta qué momento ha leído cada uno" —el mismo dato que mueve el doble check
azul—, y esos datos ya viajaban completos a `Chat.tsx` (`autores` con todos los miembros,
`lecturas` con la última marca de cada uno) y se mantienen al día en vivo por Realtime. Alguien
cuenta como "visto" si su última lectura es igual o posterior al instante del mensaje; la hora que
se enseña es esa última lectura, no el momento exacto en que pasó por ESE mensaje en concreto —
`chat_lecturas` no guarda una marca por mensaje, así que es la aproximación más fiel que hay sin
añadir una fila por persona y por mensaje (que para un chat de peña sería mucho para poco).

Verificado de extremo a extremo con dos cuentas de miembro desechables (creadas, usadas y borradas
en la misma prueba, no las cuentas reales de la peña): la cuenta A manda un mensaje real, la cuenta
B visita `/chat` (lo que marca su lectura en el servidor, como siempre), y al abrir "Info del
mensaje" desde A aparece B en "Visto por 1" con su avatar y hora, y el resto de miembros reales
—que no visitaron el chat durante la prueba— en "Todavía no lo ha visto". Captura de pantalla
revisada a mano. Datos y cuentas de prueba borrados después.

---

## 7novodecies. El directorio de miembros no tenía enlace en la navegación móvil

`/miembros` (el directorio público de la peña, distinto de `/admin/miembros`, que es solo de la
directiva) ya funcionaba de sobra para cualquier miembro aprobado — ni el código de la página ni
`proxy.ts` lo restringían a admin. Lo que faltaba era **cómo llegar ahí**: su único enlace vivía en
`Header.tsx`, en un `<nav>` marcado `hidden md:flex` (solo escritorio). En el móvil —el uso
principal de la app, según la propia razón de ser de este proyecto— no había ningún botón ni icono
que llevara a esa página; solo se podía llegar tecleando la URL a mano, que es justo como el señor
la encontró "que falta".

Arreglo: nuevo ítem "Miembros" (icono `Users`) en `BottomNav.tsx`, junto a Chat y Gestión, visible
para cualquier `esMiembro`. Con él la barra inferior pasa a tener 6 elementos como máximo (para
quien ve Chat y Gestión); comprobado que caben con holgura incluso en el iPhone SE (375 px, la
pantalla habitual más estrecha).

Verificado con una cuenta de miembro **no-admin** desechable (creada, usada y borrada en la misma
prueba): la barra inferior muestra el ítem "Miembros", tocarlo lleva a `/miembros` de verdad (no
redirige a `/login` ni a `/perfil`), la página carga "Miembros de la peña" y lista al propio
miembro de prueba en el directorio. Captura de pantalla revisada a mano.

---

## 7vicies. Editar una tarea: no había forma de arreglar un reparto olvidado

El señor reportó una tarea real ("Chuparse un pie", con descripción, día y un documento adjunto)
sin avatares en `/admin/tareas`. Comprobado contra la base de datos real: la tarea existía, pero
`tareas_miembros` estaba vacía para ella — la asignación nunca llegó a guardarse, no era un
problema de visualización.

Causa raíz: **no había ningún botón de editar**. `PanelTareas.tsx` solo permitía crear, marcar
hecha o borrar. `editarTarea()` ya existía en `actions/tareas.ts` desde hacía tiempo, pero
huérfano, sin ningún componente que lo llamara. Si al crear una tarea se te olvidaba marcar a
alguien —fácil, "Crear tarea" no obliga a elegir a nadie— la única forma de arreglarlo era borrar
la tarea entera y escribirla de nuevo desde cero, perdiendo la descripción y el documento.

Arreglo: `FormularioTarea.tsx` pasa a servir para las dos cosas. Con una prop `tareaExistente`
llega precargado (título, descripción, día, encargados y documento) y guarda con `editarTarea` en
vez de `crearTarea`; el documento adjunto se puede mantener, quitar o sustituir por otro sin tocar
el resto. Nuevo botón "Editar" (lápiz) junto al de borrar en `PanelTareas.tsx`. De paso, una tarea
sin nadie asignado ahora dice explícitamente **"Sin asignar todavía"** en ámbar, en vez de no
mostrar nada — así el hueco se ve a la primera, no hay que fijarse en que falta algo.

**Verificado contra la tarea real** (con cuidado de dejarla tal como estaba, no es una tarea de
prueba): antes de editar mostraba "Sin asignar todavía"; el formulario de edición cargó
correctamente su título, su documento existente ("ChatGPT Image…") y ofreció "Guardar cambios"; al
marcar un miembro y guardar, `tareas_miembros` pasó a tener la fila real y la lista mostró su
avatar. Deshecho ese cambio de prueba después (vuelto a dejar sin asignar) para que el señor la
reparta él mismo a quien corresponda. También se descartó un posible bug de interacción
documento+miembro simultáneos: el único fallo al probarlo en local fue un CORS del bucket R2, que
solo permite el puerto 3000 y el dominio real —no 3111, donde corría el servidor de prueba—, nada
que ver con la aplicación.

---

## 7unvicies. Limpieza: reparto del 22 al 31 de agosto sorteado a dados

Página nueva `/admin/limpieza`, visible para cualquier miembro; el sorteo solo lo lanza la
directiva. Del 22 al 30 limpian 2 personas al día y el 31 —**limpieza y desmontaje**— van 3: 21
turnos en total.

**El reparto justo, que era la pregunta de fondo.** Con 9 miembros, 21 turnos no se reparten
enteros (21 / 9 = 2,33). Lo más equilibrado posible es: **todos limpian 2 días**, y los 3 turnos
que sobran caen exactamente en el desmontaje. Así nadie pasa de 2 salvo donde no queda otra, que
es justo lo que pidió el señor.

Eso NO se consigue repartiendo cupos a mano, sino con una sola regla:
**nadie puede llevar más de un turno por encima de quien menos lleva**. El sorteo se equilibra él
solo, y sigue funcionando si la peña crece o mengua (con 12 miembros sale 1-2 turnos por cabeza;
con 6, 3-4). Además, quien va rezagado entra con prioridad natural en el desmontaje, porque los
que ya van servidos no pueden subir mientras quede alguien por debajo.

El mínimo técnico son **3 miembros aprobados**, porque el desmontaje exige tres personas distintas.
Si todavía hay menos, el botón queda desactivado y muestra cuántas faltan. La acción del servidor
devuelve ese estado como resultado controlado en vez de lanzar una excepción: antes, con los 2
miembros aprobados que había, Next convertía el aviso esperado en un error 500 sin explicación.

**Por qué un dado de 10 caras y no dos de seis.** Con dos dados sumados el resultado NO es
uniforme: el 7 sale seis veces más que el 2, así que quien tuviera los números centrales limpiaría
muchísimo más. Se usa un solo dado con más caras que miembros (con 9 → d10), y el número que no es
de nadie obliga a repetir la tirada, que es literalmente lo que pidió el señor.

**El sorteo corre en el servidor**, no en el navegador: es el reparto oficial de la peña, no puede
depender de la máquina de quien pulsa ni repetirse hasta que salga algo que convenga. Lo que se
devuelve al cliente es el **guion completo de tiradas, incluidas las descartadas**, para que la
animación enseñe lo que pasó de verdad y no una recreación inventada.

En `/perfil`, cada uno ve sus días y cuál es **el próximo** (los ya pasados salen tachados). "Hoy"
se calcula en hora de Madrid por lo de siempre: el servidor va en UTC y si no, el día cambiaría
antes de tiempo.

**Validación antes de escribir la app**: se prototipó el algoritmo y se simuló **20.000 sorteos con
9 miembros** → 0 repartos inválidos, 0 bloqueos, y desviación máxima del **1,7%** entre miembros a
la hora de cargar con el tercer turno (ruido estadístico normal). Repetido para N = 3, 5, 6, 9, 10,
12 y 15 sin un solo fallo, y con error controlado por debajo de 3 miembros. Después, probado de
extremo a extremo en navegador con 9 miembros reales (2 de la peña + 7 desechables, borrados
luego): la animación corre, el reparto guardado cumple las 21 plazas, nadie repite día, y salen 6
personas con 2 turnos y 3 con 3 —las del desmontaje—. Datos de prueba eliminados.

---

## 7duovicies. Dados: decidir algo al momento (`/admin/dados`)

Aprovecha el mismo mecanismo de la limpieza (un dado con más caras que
opciones, repitiendo la tirada si sale una que no cuenta) pero para una
decisión suelta, sin guardar nada en la base de datos — vive entero en
`lib/dados.ts`, sin tabla ni server action.

Dos modos:

- **Mayor o menor de 6**: dado de 12 caras (con uno de 6 nunca podría salir
  "mayor de 6"). Del 1 al 5 gana menor, del 7 al 12 gana mayor; el 6 es
  empate y se repite.
- **Por miembro**: igual que en la limpieza — un dado de `carasDado(N)` caras,
  cada miembro tiene la suya y el número que sobra obliga a repetir. Sin la
  restricción de "no más de un turno de diferencia" de la limpieza, porque
  aquí no hay turnos: es una tirada suelta, no un calendario.

Como no persiste nada, la lista de miembros llega del servidor en el orden
alfabético de siempre (`listarMiembros()`) y así se queda mientras dura la
página.

**El mismo dado, dentro de `SelectorMiembros`.** Repartir una tarea o un
artículo de la compra a dados no necesitaba página propia: el botón "Tirar
dados" vive directamente en `SelectorMiembros.tsx` (`permitirDados`, activado
por defecto), así que sale solo en los tres sitios donde ya se elegía gente a
mano — crear/editar tarea, apuntar la compra y repartirla después—. Usa
`tirarMiembroLibre()` (`lib/dados.ts`), que es `tirarPorMiembro` con un
extra: si el dado saca a alguien que **ya estaba elegido**, también se repite
la tirada. Así cada tirada nueva añade a alguien distinto —tiene sentido
tirar dos o tres veces para repartir entre varios— y si a quien le toca no
quiere o no puede, se le quita tocando su chip, como a cualquier otro.

---

## 7tervicies. Bug real: el service worker convertía un fallo puntual en la app rota

Síntoma que llegó desde el móvil: al abrir `/admin/limpieza` salía un 500 del
servidor y, detrás, estos dos errores en consola:

```
The FetchEvent for ".../admin/limpieza" resulted in a network error response:
  the promise was rejected.
sw.js:1 Uncaught (in promise) TypeError: Failed to convert value to 'Response'.
```

El 500 fue **transitorio** (una ventana en la que el despliegue vigente aún no
traía esa ruta, porque los deploys de ese rato se quedaron bloqueados por el
tope de 100 despliegues/24 h del plan gratuito de Vercel). Lo que no era
transitorio era la reacción del service worker, que tenía dos fallos y
convertía cualquier tropiezo de red en una pantalla en blanco:

1. **Navegaciones**: `event.respondWith(fetch(req))`, sin `catch`. Si el
   `fetch` rechaza, a `respondWith` le llega una promesa rota y el navegador
   tumba la petición entera ("the promise was rejected") — ni siquiera se ve
   el aviso de "sin conexión" del propio navegador.
2. **Recursos estáticos**: el respaldo era `.catch(() => caches.match(req))`, y
   `caches.match` devuelve `undefined` cuando ese recurso nunca se guardó.
   `respondWith(undefined)` revienta con "Failed to convert value to
   'Response'" — que es, literalmente, el segundo error de la consola.

Arreglado dejando que **las dos ramas acaben siempre en una `Response` real**:
las navegaciones caen en una página "Sin conexión" generada al vuelo por el
propio service worker (no cacheada: el contenido de las páginas depende de la
sesión y no se guarda nunca, ver arriba), y los estáticos en `Response.error()`,
que es un fallo de red normal y corriente que el navegador ya sabe manejar.
Comprobado en navegador con la red cortada: antes rompía, ahora sale el aviso
con su botón de "Reintentar" y al volver la conexión se recupera solo. La
versión de caché sube a `vyp-v4` para tirar la anterior.

---

## 7quatervicies. Rol tesorero y "quién puede repartir roles" (migración `0016`)

Hasta ahora `rol` solo tenía dos valores: `miembro` y `admin` (la directiva
entera, con todos los permisos). Se pidió un tercer rol, **tesorero**, que
pueda marcar quién ha pagado la cuota —lo único que le hace falta— sin las
dos cosas de verdad delicadas: aprobar altas y tocar el almacenamiento.

**El permiso de repartir roles va aparte del rol.** No basta con "ser admin"
para poder ascender a alguien a tesorero o a la propia directiva: eso abriría
la puerta a que cualquier nuevo admin fuera repartiendo el cargo a su vez, sin
control. Se añadió `perfiles.puede_asignar_roles` (booleano, `false` por
defecto), y la migración se lo dio solo a quien ya era admin en ese momento.
Si esa persona asciende a alguien más —a tesorero o a la propia directiva—,
el ascendido **no** hereda esa capacidad: solo la reparte quien ya la tenía
antes. Así se puede tener más gente en la directiva sin que se multiplique
sin control quién puede tocar los roles de los demás.

**Por qué un trigger y no solo RLS.** La política de `perfiles` ya deja
escribir el propio perfil, o el de cualquiera si eres admin (`perfiles_update`
en la migración `0001`) — hace falta que alguien pueda cambiar su nombre o
bio, o que la directiva apruebe altas, sin pasar por esto. RLS decide fila por
fila, no columna por columna, así que para proteger *solo* `rol` y
`puede_asignar_roles` (y dejar todo lo demás igual) hace falta un trigger,
igual que ya se hacía con `compra_solo_marcar` en la lista de la compra: si
quien escribe no tiene `puede_asignar_roles()`, esas dos columnas se
revierten a su valor anterior en el propio trigger, pase lo que pase por
encima (RLS, la API, o incluso una llamada directa con la clave
`service_role`, que no lleva `auth.uid()` y por tanto tampoco pasa el
permiso — comprobado a mano tirando de la Management API).

**Aprobar con rol elegido.** `aprobarMiembro(id, rol)` deja fijar de una vez
el rol al aprobar una cuenta pendiente, pero solo aparece el desplegable en
la interfaz a quien tiene `puede_asignar_roles`; el resto de la directiva ve
el botón sencillo de siempre y aprueba como miembro normal. Si alguien sin
permiso intentara forzar un rol distinto igualmente (saltándose la interfaz),
la propia acción lo rechaza con un error claro antes de llegar a la base de
datos, que además lo bloquearía en el trigger.

**Cambiar el rol después.** `cambiarRolMiembro(id, rol)` hace lo mismo para
alguien ya aprobado (ascender, degradar, dar o quitar tesorero/directiva),
con el mismo permiso exigido y bloqueando explícitamente cambiarse el rol a
uno mismo (para no poder quitarse la directiva por error).

**Pagos.** La política de escritura de `pagos` pasó de `es_admin()` a
`es_admin() or es_tesorero()`; la de lectura no cambió (la ve cualquier
miembro, y sigue sin poder tocarla).

Verificado de extremo a extremo con cuentas desechables: un admin sin
`puede_asignar_roles` no ve ningún desplegable de rol y una llamada directa a
la API con su sesión para forzar `rol = 'admin'` en otra cuenta devuelve 200
pero el trigger lo revierte (el rol se queda igual); un tesorero de prueba
pudo marcar un pago pero no pudo entrar en `/admin/miembros` ni en
`/admin/almacenamiento`.

---

## 7quinvicies. Deudas: quién marca y quién borra (migración `0017`)

Hasta ahora crear, marcar y borrar una deuda era todo `es_admin()`. Se pidió
repartirlo:

- **Marcar como saldada**: la directiva, el tesorero, o **el propio
  acreedor** (a quien se le debe) si es un miembro concreto. Cuando la
  acreedora es la peña entera (`acreedor_id = NULL`), no hay "el propio
  acreedor" al que dejar entrar, así que ahí solo quedan directiva y
  tesorero — sale solo de la condición `acreedor_id = auth.uid()`, que nunca
  es cierta si la columna es NULL.
- **Borrar**: solo directiva y tesorero, nunca el acreedor (aunque sea su
  deuda).
- **Apuntar/crear**: sin cambios, sigue siendo solo `es_admin()`.

**El acreedor solo puede tocar `pagada`.** La política de `UPDATE` decide SI
puede escribir la fila, pero no qué columnas — así que sin más, el acreedor
podría colarse y cambiar también la cantidad o el concepto de su propia
deuda. Se añadió `deudas_solo_marcar()` (mismo patrón que
`compra_solo_marcar` y `perfiles_solo_rol_con_permiso`): si quien escribe no
es directiva ni tesorero, el trigger revierte todo salvo `pagada` al valor
anterior.

Verificado con cuentas desechables y por API directa (saltándose la
interfaz): el acreedor pudo marcar su propia deuda pero no la de VYP; un
intento de cambiar la cantidad junto con `pagada` en la misma petición dejó
la cantidad intacta y solo aplicó el cambio de estado; un intento de borrar
su propia deuda fue rechazado sin más.

---

## 7sexvicies. Fechas de las fiestas configurables (migración `0018`) y compra sin selector de año

Dos ajustes relacionados, pedidos juntos:

**La lista de la compra ya no pregunta el año.** El desplegable de año del
formulario (2010-2040) desapareció; el artículo se apunta siempre para
`anioActivo` (el mismo "año de gestión" que ya usan tareas, camisetas y
pagos), como un `<input type="hidden">`. La lista sigue agrupando por año al
mostrarse —eso no cambia, por si queda algo de años anteriores—, pero ya no
se puede elegir uno distinto al crear.

**Las fechas de la limpieza ya no están escritas en el código.** Antes
`lib/limpieza.ts` tenía `DIA_INICIO = 22`, `DIA_FIN = 31` y
`MES_LIMPIEZA = 8` fijos: cada año, alguien iba a tener que tocar código
para mover las fiestas. Ahora hay una tabla `fiestas_fechas` (`anio` clave
primaria, `fecha_inicio`, `fecha_fin`), que la directiva rellena desde
Gestión → "Solo la directiva" → **Fechas de las fiestas**, con dos
`<input type="date">` (el calendario nativo del navegador, igual en móvil
que en escritorio). Se guardan solas al cambiar cualquiera de las dos, sin
botón de confirmar.

- `diasLimpieza()` pasó de recibir un año a recibir `(fechaInicio, fechaFin)`
  y genera los días con aritmética en UTC (evita el desfase de un día que
  daría sumar con el reloj local). Ya no asume ningún mes: si las fiestas
  cruzan de agosto a septiembre, lo pinta bien (probado de verdad
  cambiándolas a "29 de agosto - 3 de septiembre" y sorteando encima).
- `sortearLimpieza()` pasó de recibir un año a recibir directamente los
  `dias` ya calculados — sigue siendo una función pura, fácil de simular en
  miles de tiradas como se hizo la primera vez.
- Los textos que decían "de agosto" a mano (el calendario, la animación del
  dado, el resumen del perfil) ahora usan `diaLegible()`/`rangoLegible()`
  (`lib/formato.ts`), que derivan el mes de la fecha real.
- Si la directiva todavía no ha puesto las fechas del año, `/admin/limpieza`
  no intenta pintar nada: avisa de que faltan y dice dónde ponerlas. Tirar
  los dados sin fechas puestas da un error claro en vez de reventar.
- `/perfil` y `/miembros/[id]` ya no necesitan generar el calendario entero
  para saber si un turno es el de desmontaje: basta comparar la fecha del
  turno con `fecha_fin`, que es más barato y más simple.

Verificado con Playwright cambiando las fechas de 2026 a un rango real que
cruza de mes, sorteando encima y mirando perfil/miembro/calendario, y
dejando las fechas como estaban (22-31 de agosto) al terminar.

---

## 7septvicies. Ruta crítica del render global (migración `20260728005711`)

Cada página pasaba antes por demasiadas esperas globales: el proxy validaba el JWT contra Auth,
`getSesion()` volvía a llamar a Auth, el layout contaba los mensajes no leídos con dos consultas y
`Header` resolvía de nuevo la sesión más otros dos contadores de pendientes. Aunque `cache()` ya
deduplicaba `getSesion()`, las consultas seguían formando una cadena antes de poder enviar HTML.

- Después de `getClaims()`, `proxy.ts` pasa el `sub` ya validado a Server Components mediante una
  cabecera interna. Primero borra siempre cualquier `x-vyp-user-id` enviado por el navegador, por
  lo que no se puede suplantar. `getSesion()` evita así una segunda llamada a Auth y consulta el
  perfil mediante PostgREST/RLS; sin una fila visible devuelve `null`.
- `RootLayout` resuelve el perfil y `contadores_navegacion()` en paralelo. La función SQL
  `SECURITY INVOKER` devuelve los no leídos y pendientes juntos respetando las políticas del
  usuario y sustituye cuatro peticiones REST por una. Sin identidad validada no hace esa llamada.
  El layout pasa la sesión y el contador inicial a `Header`, que deja de ser un componente servidor
  asíncrono y no vuelve a consultar nada.
- `vercel.json` fija la única región Hobby en `cdg1` (París). Las respuestas anteriores mostraban
  que la función corría en `iad1` (Washington) mientras Supabase estaba en Europa/Madrid; acercarlas
  evita que cada consulta cruce el Atlántico.
- `app/loading.tsx` da respuesta visual inmediata mientras una navegación dinámica termina. Usa el
  emblema circular original (`vyp-logo-192.png`) con una respiración suave que solo anima
  `transform` y `opacity`; no añade JavaScript ni bloquea la carga. `prefers-reduced-motion` ya
  desactiva estas animaciones globalmente. No reduce el TTFB del servidor, pero evita que un toque
  parezca ignorado.

La migración se aplicó y se ejecutó como rol `authenticated` contra la base real: ambos contadores
devolvieron valores no negativos. Tipos, ESLint y build están limpios. La medición posterior de
producción queda pendiente del siguiente despliegue por el límite temporal de Vercel Hobby.

---

## 7octovicies. Configuración sin tocar código y operaciones en lote (migración `20260728012324`)

La revisión de valores que podían caducar cada año dejó cuatro cambios operativos:

- **Ubicación pública:** `configuracion` guarda nombre breve, dirección, URL exacta de Google Maps,
  latitud y longitud. `ConfiguracionUbicacion.tsx` permite a la directiva cambiarlos y contiene las
  instrucciones para obtenerlos. La portada genera el iframe de OpenStreetMap desde las coordenadas
  y usa la URL guardada en “Cómo llegar”. El pie técnico de MapLibre se oculta mediante recorte del
  iframe, pero la atribución mínima enlazada a OpenStreetMap queda visible fuera de él. La fila es
  legible por `anon` porque todo su contenido ya es público; su `UPDATE` sigue protegido por
  `private.es_admin()` y RLS.
- **Calendario anual real:** Tareas consume `fiestas_fechas`, igual que Limpieza, mediante
  `lib/fechas.ts`. `CalendarioTareas.tsx` no presupone agosto, admite rangos que cruzan de mes y el
  selector de año crece respecto al año actual. `SubirMedia` usa el año de gestión y dejó de arrancar
  por error en 2040.
- **Reglas de limpieza:** `fiestas_fechas` guarda también `plazas_limpieza` y
  `plazas_desmontaje`. La directiva las cambia junto a las fechas; el sorteo, sus validaciones y los
  textos derivan las cifras de esos datos. Se eliminó la frase fija de “9 miembros previstos”.
- **Compra por lotes:** `PanelCompras` mantiene hasta 100 líneas de artículo/cantidad y
  `crearItemCompra()` llama a `crear_items_compra()` (migración
  `20260728031256_compra_atomica.sql`). La función es `SECURITY INVOKER`: valida año, cantidades,
  documento y hasta 100 miembros aprobados, mientras las políticas RLS siguen siendo la autoridad.
  Inserta `lista_compra` y `compra_miembros` en la misma transacción; ya no existe una compensación
  posterior cuyo borrado pudiera fallar.

### Purga irreversible del chat

`VaciarChat.tsx` vive en “Solo la directiva” y exige una segunda confirmación en un modal. Llama a
`vaciar_historial_chat()`, función `SECURITY DEFINER` necesaria para borrar también
`chat_lecturas`, pero cerrada de tres formas: comprobación interna `private.es_admin()`, `EXECUTE`
revocado a `PUBLIC`/`anon` y concedido solo a `authenticated`. El borrado de `mensajes`, reacciones
por `ON DELETE CASCADE` y lecturas ocurre en una sola transacción. Realtime escucha ahora `DELETE`
en `mensajes`, así que un chat abierto se vacía sin recargar.

La revisión dejó fuera deliberadamente los límites de Cloudinary/R2 y los permisos de roles: son
controles técnicos o de seguridad, no datos que deban editarse desde una web. El catálogo de tallas
y el máximo de camisetas sí podrían variar por proveedor; se mantienen como posible configuración
anual si la peña confirma que cambian de un año a otro.

Verificado en build local de producción con sesión de directiva y viewport móvil: guardado real de
la ubicación sin alterar sus valores, alta conjunta de dos compras con cantidades 2 y 5, calendario
sin referencias fijas a agosto, apertura/cancelación del modal y mapa público. Las compras de prueba
se eliminaron y la base confirmó cero restos. La purga se ejecutó dentro de una transacción revertida:
la función y sus cascadas se comprobaron sin borrar el chat real.

---

## 7novovicies. Portada progresiva y despliegue sin CLI (2026-07-28)

La portada ya no espera todas sus consultas antes de enviar el hero. Estadísticas, galería, música,
ubicación e invitación viven tras fronteras `Suspense` pequeñas; comparten la misma tanda de datos
para aparecer en orden y conservar `CLS 0`. Liberarlas según terminaba cada consulta se midió y se
descartó porque desplazaba contenido (`CLS 0,096`). La cinta muestra seis fotos en portada; la
galería completa no cambia.

El primer `MapaDiferido.tsx` sustituyó el iframe inicial por un botón. Después se recuperó el mapa
directo por decisión de producto, pero `loading="lazy"` no bastó: Chrome puede precargar iframes a
varias pantallas de distancia y OpenStreetMap llegó a bloquear 3,3 s de hilo principal bajo CPU
móvil simulada. `MapaAlAcercarse.tsx` conserva el mapa automático e interactivo, pero no monta el
iframe hasta que queda a 200 px de entrar en pantalla. `BottomNav` y `AvatarPendientes` importan
`lib/realtime` solo cuando hay un miembro, por lo que visitantes anónimos no descargan Supabase
Realtime. El service worker y el cartel PWA se montan directamente desde `layout.tsx`: así Android
recibe a tiempo `beforeinstallprompt` y conserva el botón nativo de instalación. `InstalarApp.tsx`
solo ofrece el cartel en iPhone/iPad o Android; nunca en ordenadores, aunque Chrome soporte instalar
PWA.

La carga del chat evita tres costes que no aportaban interfaz: `app/chat/loading.tsx` crea una
frontera de navegación inmediata para esta ruta dinámica; la consulta principal ya no repite nombre
y avatar dentro de cada mensaje porque reutiliza el índice completo de autores; y la actualización
de `chat_lecturas` se programa con `after()` usando la sesión ya validada, una vez enviada la
respuesta. Se mantienen el límite de 200 mensajes, las reacciones embebidas y las tres consultas de
lectura en paralelo.

El build de producción usa `next build --webpack`: en esta aplicación reduce los ficheros JS
iniciales de 554 a 473 KiB sin comprimir y la medición de red de 65 peticiones/~850 KiB a
40/~315 KiB. Lighthouse 13.4.1 da 100/100/100/100 en escritorio y 98–99/100/100/100 en móvil;
el TBT móvil restante (80–130 ms) varía en el runtime React bajo CPU simulada.

`scripts/vercel-api-deploy.mjs` permite que `/api/deploys/launch` publique sin ejecutar el CLI de
Vercel: omite secretos y artefactos, sube fuentes por digest SHA-1, crea un deployment de producción
y espera a `READY`. El deployment Webpack publicado es `dpl_4FcsuzW54wRES5u5mgcnZv5QnUbA`.
La siguiente revisión añade en `proxy.ts` un 404 anterior al streaming para años no canónicos o
fuera de 2010–2100; está validada en el host, pero Vercel rechazó su promoción al superar el límite
Hobby de 100 deployments/24 h. La API confirmó que el primer hueco posible de la ventana móvil es
el 28 de julio a las 16:02:56 CEST; la tarea automática #71 conserva un único reintento autorizado
a las 16:05 CEST.

---

## 8. Pendiente / ideas para más adelante

- Notificaciones también al subir fotos nuevas (hoy solo avisa el chat).
- Borrar el fichero de Cloudinary/R2 al borrar la fila (hoy se borra el registro, no el archivo).
- Página de perfil editable (cambiar nombre y foto).
- Si el proveedor cambia cada año, hacer configurables por año las tallas disponibles y el máximo
  de camisetas por miembro.
