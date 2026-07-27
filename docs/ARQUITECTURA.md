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
- **Burbuja de no leídos en tiempo real**: `BottomNav.tsx` se suscribe en solitario (no depende de
  que `/chat` esté montado) al canal de `mensajes`; si el chat está abierto se marca leído al
  instante y la burbuja se queda en cero, si no, va sumando.
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

- El número inicial se calcula en el servidor (`obtenerPendientesPerfil`, cruzando
  `tareas_miembros`/`compra_miembros` con `tareas.hecha`/`lista_compra.comprado` vía embed
  PostgREST) y se pasa como prop, igual que la burbuja de no leídos del chat.
- En el cliente se suscribe a un canal que escucha `UPDATE` en `tareas` y `lista_compra` (cualquier
  cambio de cualquiera, porque no se puede filtrar por "asignado a mí" directamente en esas tablas)
  y `*` en `tareas_miembros`/`compra_miembros` **filtrado por `perfil_id=eq.<yo>`** (asignaciones
  nuevas o quitadas). Cualquiera de los cuatro eventos vuelve a pedir el total al servidor.
- Solo se abre el canal si `esMiembro`: quien está pendiente de aprobación no tiene nada asignado.

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

## 8. Pendiente / ideas para más adelante

- Notificaciones también al subir fotos nuevas (hoy solo avisa el chat).
- Borrar el fichero de Cloudinary/R2 al borrar la fila (hoy se borra el registro, no el archivo).
- Página de perfil editable (cambiar nombre y foto).
