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

> **Corregido el 2026-07-27**: subir música fallaba en el navegador con un error de CORS. El bucket
> de R2 no tenía política CORS, así que el navegador cancelaba la subida antes de empezar (el
> servidor sí podía subir, por eso las pruebas anteriores pasaban: solo los navegadores hacen esa
> comprobación previa). Se aplicó la política con `scripts/configurar-cors-r2.mjs` — que queda en el
> repositorio porque esa configuración vive en el bucket y se perdería si se recreara. De paso se
> desactivó el checksum automático del SDK, que metía en la URL firmada la huella de un fichero
> vacío. Verificado de extremo a extremo contra producción: firma → preflight → subida → reproducción.

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

### Cómo se eligen las fotos: cámara o galería

> **Cambiado el 2026-07-27**: ya no existe la página `/subir` ni el botón "Subir" del header. Subir
> vive **directamente en `/galeria` y en `/musica`**, con un botón propio arriba de cada página
> (`PanelSubir.tsx`) que despliega el formulario justo debajo, cerrado por defecto para no ensuciar
> la vista a quien solo entra a mirar. En `/galeria` también hay uno igual, ya con el año puesto,
> dentro de la página de cada año.

El selector de fotos es **un único botón**, sin el atributo `capture`: así es el propio móvil quien
ofrece su desplegable nativo con *Cámara*, *Vídeo* y *Galería* juntos en un solo menú, en vez de que
la web decida por él saltando directa a la cámara. Es el comportamiento de serie de Android/iOS
cuando un campo de fichero acepta imagen y vídeo sin forzar la captura.

Lo elegido se **acumula** en una lista con su tamaño y un botón para quitar cada cosa, así se pueden
encadenar varias fotos seguidas sin volver a abrir el selector.

---

## 5. Modelo de datos (Supabase Postgres)

```
perfiles          id (→ auth.users), nombre, usuario (único), avatar_url,
                  rol ('miembro'|'admin'), aprobado, created_at
media             id, tipo ('foto'|'video'), anio, storage_id, url, thumb_url,
                  ancho, alto, duracion_s, descripcion, subido_por, created_at
pistas            id, titulo, artista, tipo ('sesion'|'cancion'), anio,
                  origen ('r2'|'mixcloud'|'soundcloud'), url, embed_url,
                  duracion_s, subido_por, created_at
comentarios       id, media_id (nullable), pista_id (nullable), autor_id, texto, created_at
participantes     id, perfil_id (único junto a anio), talla_camiseta, pagado, importe, anio
lista_compra      id, item, cantidad, comprado, anio, notas
deudas            id, deudor_id, acreedor_id (NULL en cualquiera de los dos = "VYP"),
                  cantidad, descripcion, pagada, creado_por, created_at
mensajes          id, autor_id, texto, created_at            (chat interno, solo miembros)
tareas            id, titulo, descripcion, fecha, hecha, hecha_por, hecha_en,
                  documento_url, documento_nombre, creado_por, created_at
tareas_miembros   tarea_id + perfil_id   (quién se encarga; puede ser más de uno)
compra_miembros   item_id  + perfil_id   (quién compra cada cosa)
push_subs         id, user_id, endpoint (único), p256dh, auth, created_at
configuracion     id (siempre true, fila única), anio_activo
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
`proxy.ts`), que protege `/admin/*` redirigiendo a `/login` si no hay sesión — probado en
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
| `/` | público | Logo, estadísticas, **carrusel de las últimas 10 fotos**, **últimas 5 pistas**, mapa y cómo llegar, invitación a unirse |
| `/galeria` | público | Los años en fichas, del más reciente al más antiguo |
| `/galeria/[anio]` | público | Cuadrícula de fotos y vídeos de ese año |
| `/galeria/[anio]/[id]` | público | Foto o vídeo a pantalla completa + comentarios |
| `/musica` | público | Sesiones y canciones, con el reproductor |
| `/subir` | **miembros** | Hacer foto · grabar vídeo · elegir de la galería, y subida de música |
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

> **Cambiado el 2026-07-27**: ya no es una página aparte (`/donde`). El señor pidió que ese
> contenido, tal cual se veía, viviera directamente en la portada — así que ahora es la última
> sección de `/` (con ancla `#donde`; el enlace "Dónde" del menú apunta a `/#donde`). La página
> `/donde` se eliminó.

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

## 9-pre-quinquies. Nombre y avatar de quien sube cada cosa (2026-07-27)

Todo lo que sube un miembro queda firmado con su nombre y su foto, en el mismo sitio en toda la
web: avatar a la izquierda del nombre, usando el componente `Avatar.tsx` ya existente (foto si la
tiene, iniciales sobre fondo gris si no).

- **Galería**: la cuadrícula de cada año lleva una insignia con el avatar en la esquina de cada
  miniatura; la página de detalle dice "Subido por [avatar] Nombre" antes de la descripción; el
  carrusel de la portada lleva la misma insignia en miniatura. En el detalle de una foto, se pasa
  a la anterior o siguiente del mismo año deslizando horizontalmente en móvil, con flechas y
  teclas izquierda/derecha en escritorio. El selector al subir fotos o vídeos admite de 2010 a
  2040, para no requerir cambios anuales.
- **Música**: cada pista de `/musica` y de la portada lleva el avatar de quien la subió (o pegó el
  enlace de Mixcloud/SoundCloud) al final de la fila.
- **Comentarios**: el avatar aparece junto al nombre que ya se mostraba.
- **Chat, al estilo WhatsApp**: avatar a la izquierda de los mensajes de los demás (nunca en los
  propios, igual que hace WhatsApp), con el nombre encima del texto dentro de la propia burbuja.

Todo sale de la relación `media.subido_por` / `pistas.subido_por` / `comentarios.autor_id` /
`mensajes.autor_id` hacia la vista `autores` (que ya traía `avatar_url` desde que se añadió el
perfil con foto). Verificado insertando contenido de prueba real: aparece el avatar correcto en
cuadrícula, detalle, portada, música y chat — incluido un mensaje de un miembro sin foto todavía,
que muestra sus iniciales.

---

## 9-pre-quater. Año de gestión activo (2026-07-27)

Antes había que elegir el año cada vez que se entraba a Tareas o a Participantes. Ahora la
directiva lo fija **una vez** desde `/admin` ("Año de gestión") y todo lo hereda:

- **Tareas**: el calendario de agosto ya no está fijo a 2026 — usa siempre el año activo, y la
  lista solo muestra las tareas de ese año (más las que no tienen día puesto, que no son de ningún
  año en concreto).
- **Participantes**: si no hay `?anio=` en la URL, se usa el año activo. El selector de la propia
  página se mantiene, para poder mirar otro año puntualmente sin cambiar el activo.
- **Lista de la compra**: el año por defecto al añadir algo nuevo es el activo (el listado en sí
  sigue mostrando todos los años agrupados, como ya hacía).

Guardado en una tabla `configuracion` de una sola fila (`id boolean primary key default true`: la
propia clave primaria impide que exista una segunda fila). Cualquier miembro con sesión puede
**leerlo** — hace falta para que un miembro vea correctamente "sus tareas" en el perfil —, pero
**solo la directiva puede cambiarlo**, verificado insertando directo contra la API con la sesión de
un miembro normal: la fila no se movió.

Verificado también en caliente: cambiar el año activo a 2027 (sin tocar nada más) hizo que Tareas,
Participantes y la Compra lo reflejaran los tres a la vez, sin haber pasado por ningún selector.

---

## 9-pre-ter. Control de almacenamiento (`/admin/almacenamiento`, 2026-07-27)

Todo el proyecto está pensado para no pagar nunca, así que hacía falta una manera de **verlo venir**
antes de pasarse de las cuentas gratuitas, no enterarse cuando ya sea tarde.

- **Cloudinary**: se consulta su propia API de uso (`cloudinary.api.usage()`, créditos reales de la
  cuenta, no una estimación) — fotos, vídeos y avatares comparten esos 25 créditos.
- **R2**: se recorre el bucket entero sumando el tamaño de cada objeto (`ListObjectsV2`, con
  paginación). A la escala de una peña son pocos ficheros, así que es instantáneo.
- Dos barras de progreso en `/admin/almacenamiento`, con el número exacto al lado.

**La restricción de verdad** vive en el servidor, no en la interfaz: `/api/cloudinary/firma` y
`/api/r2/subir` comprueban el uso **antes de firmar nada** y devuelven `507` si se pasaría del 90%
del plan gratuito (el umbral es más bajo que el límite a propósito, para no dejar a alguien a mitad
de subir sin sitio donde caer). Verificado con la fórmula real: al 92% de Cloudinary bloquea, al
0,44% actual deja pasar — y las dos rutas, probadas contra la cuenta real, siguen firmando con
normalidad hoy.

**Vaciar espacio de verdad, no solo la fila.** Antes, borrar una foto o una pista solo quitaba el
registro de la base de datos: el archivo se quedaba ocupando espacio en Cloudinary o R2 sin que
nadie lo supiera. Las nuevas acciones (`borrarMediaAdmin`, `borrarPistaAdmin`) primero borran el
**archivo real** (`cloudinary.uploader.destroy` / `DeleteObjectCommand`) y solo después la fila.
Verificado subiendo un fichero de prueba a R2 y confirmando con `HeadObjectCommand` que, tras
borrarlo desde el panel, el objeto ya no existe en el bucket (antes: `ContentLength: 500000`;
después: `NotFound`).

El panel lista fotos/vídeos y música propia **ordenados de mayor a menor tamaño**, para que la
directiva sepa exactamente qué borrar primero si hay que hacer sitio. El tamaño de cada archivo se
guarda al subirlo (columna `bytes` en `media` y `pistas`) para no tener que preguntarle a
Cloudinary/R2 uno por uno.

---

## 9-pre-bis. Participantes por año y Deudas (2026-07-27)

### Participantes (`/admin/participantes`)

Antes había que dar de alta a cada participante a mano, con un nombre libre. Ahora **la lista sale
sola**: son todos los miembros aprobados, y `participantes` pasa de ser una ficha manual a ser
"la talla y el pago de este miembro en este año concreto" — una fila por `(perfil_id, año)`, con un
índice único que lo garantiza.

- Selector de año de **2026 a 2040** arriba de la página (`?anio=` en la URL).
- Cada miembro es una fila con casilla de pagado, talla y un importe opcional. Cualquier cambio se
  guarda solo, con un `upsert` sobre `(perfil_id, anio)` — no hay botón "guardar" ni que crear o
  borrar a nadie.
- Sigue siendo **solo para la directiva**, como ya lo era.

### Deudas (`/admin/deudas`)

Sección nueva: quién le debe dinero a quién, con **dos desplegables** (quién debe → a quién) sobre
los miembros aprobados, más una opción extra en ambos: **"VYP (la peña)"**, para cuando la deuda es
con la propia peña y no con una persona. Se guarda como `NULL` en la columna correspondiente.

Dos comprobaciones en la propia base de datos, no solo en el formulario (probadas insertando
directo contra la API):
- Deudor y acreedor no pueden ser los dos "VYP" a la vez (no tendría sentido).
- Nadie puede deberse dinero a sí mismo.

Solo directiva, igual que `participantes`.

> Nota: el señor pidió el nombre "puas" para esta sección; se ha titulado **"Deudas"** por claridad
> (no es una palabra reconocida en español para este uso). Si prefiere otro nombre, es un cambio de
> una palabra.

---

## 9-pre. Tareas de agosto y perfil personal (2026-07-27)

### Tareas (`/admin/tareas`)

Reparto del trabajo de las fiestas, con **calendario de agosto de 2026**: los 31 días en cuadrícula,
cada uno con un punto si tiene tareas (apagado si ya están todas hechas). Al tocar un día se filtra
la lista; se vuelve a tocar y se ven todas otra vez.

Cada tarea tiene **nombre, descripción, día, uno o varios encargados y un documento adjunto**
opcional (PDF, imagen, Word, Excel o texto, hasta 20 MB, guardado en R2 bajo `documentos/`).

Quién puede qué:

| | Ver | Crear/editar/borrar | Marcar hecha |
|---|---|---|---|
| Visitante | no | no | no |
| Miembro | sí | no | **solo las suyas** |
| Directiva | sí | sí | sí |

Lo de "solo las suyas" tiene truco: el RLS de Postgres decide por **filas**, no por columnas, así
que dejar a un encargado actualizar su tarea le permitiría también cambiarle el título o la fecha.
Por eso hay un **trigger** (`tareas_solo_marcar`) que revierte cualquier campo que no sea el estado
si quien edita no es admin — el mismo patrón que ya protegía `rol`/`aprobado` en `perfiles`.
Verificado en vivo: un miembro intentó renombrar su tarea y el título se quedó como estaba.

### Lista de la compra: ahora con encargados

`lista_compra` pasa de ser **solo-admin** a que **los miembros la vean** (necesitan saber qué les
toca) y puedan marcar comprado **lo que tienen asignado**, con el mismo trigger de protección.
Crear y borrar sigue siendo de la directiva. **`participantes` (pagos y tallas) no cambia: sigue
siendo solo-admin.**

### Perfil (`/perfil`)

Sustituye a la antigua `/cuenta`. Cada miembro pone su **foto de avatar y su nombre de usuario**
(único, en minúsculas, 3–20 caracteres). El avatar sale **en el encabezado** y al pulsarlo se llega
aquí. Dentro: sus tareas, lo que le toca comprar (ambas marcables), sus fotos, su música, y los
**ajustes** — notificaciones (vienen activadas; aquí se apagan) y cerrar sesión.

La vista `autores` se amplía con `usuario` y `avatar_url`: son datos públicos (quién comenta, quién
sube), y sigue sin exponer `rol` ni `aprobado`.

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

> **Corregido el 2026-07-27 — "Invalid Date" al escribir.** Cada mensaje enviado aparecía como una
> burbuja rota: sin texto, con autor "Miembro" y fecha "Invalid Date". La causa se vio espiando el
> WebSocket desde un navegador real, no leyendo el código:
>
> ```json
> {"table":"mensajes","type":"INSERT","record":{},"columns":[],
>  "errors":["Error 401: Unauthorized"]}
> ```
>
> El canal de Realtime se conecta con la **clave pública**, y `mensajes` solo la pueden leer los
> miembros aprobados. Al no llevar el token del usuario, Supabase entregaba el evento con el
> registro **vacío** (`record: {}`), y ese `{}` se pintaba tal cual. Nótese que la Data API sí
> funcionaba: el fallo era exclusivo del canal en vivo, por eso las pruebas con `curl` lo pasaban.
>
> Tres arreglos, de causa a síntoma:
> 1. **`supabase.realtime.setAuth(token)`** antes de suscribirse. `createBrowserClient` restaura la
>    sesión de la cookie, pero no se la pasa al socket por su cuenta.
> 2. `enviarMensaje` **devuelve la fila creada** y el cliente la añade él mismo: el mensaje propio ya
>    no depende de que el tiempo real llegue.
> 3. Se descartan los registros sin `id` o sin fecha, y las funciones de fecha devuelven cadena vacía
>    ante una fecha inválida. Nunca más una burbuja rota en pantalla.
>
> El índice de nombres pasó a una `ref`: era dependencia del efecto y, al ser un objeto nuevo en cada
> render del servidor, reabría el canal continuamente.

## 9-ter. PWA y avisos push (Android)

**Instalable como app**: `public/manifest.webmanifest` (modo `standalone`, iconos 192/512 y uno
`maskable`, atajos directos a Galería/Música/Chat) y `public/sw.js` como service worker.

La estrategia de caché es deliberadamente conservadora — **la red manda siempre**, y solo se tira de
caché si no hay conexión. Con una caché agresiva, alguien vería fotos o mensajes viejos, que es peor
que esperar un segundo. Nunca se cachean `/api/` ni audio/vídeo.

### Instalación guiada (`InstalarApp.tsx`)

La peña no es gente de tecnología, así que **no se puede esperar a que alguien encuentre "añadir a
pantalla de inicio" en el menú del navegador**. Al abrir la web sale un cartel a pantalla completa
con el icono, una frase de para qué sirve y un solo botón grande:

- **Android/Chrome**: usa el instalador nativo del navegador (evento `beforeinstallprompt`). Un
  toque y la app queda en el móvil.
- **iPhone**: ese instalador no existe, así que se enseñan los **dos pasos con los iconos reales**
  que verá (Compartir → Añadir a inicio), en vez de describirlos con palabras.
- Si lo cierra, no se vuelve a mostrar en una semana (no dar la lata).
- No aparece nunca si la app ya está instalada.

### Permiso de avisos automático (`ActivarAvisosAuto.tsx`)

Igual que arriba: nadie va a buscar un botón para activar notificaciones. **Al abrir la app ya
instalada**, si el permiso todavía no se ha decidido, se pide directamente — en Android el teléfono
muestra su ventana de permisos ahí mismo, sin que el usuario tenga que hacer nada.

Safari en iPhone **exige un gesto del usuario** antes de poder pedir el permiso, así que en ese caso
(y si el intento automático falla por lo que sea) aparece un cartel pequeño con un botón grande que
hace exactamente lo mismo.

Solo se intenta **una vez por dispositivo**: si alguien dice que no, no se vuelve a insistir — entre
otras cosas porque el navegador ya no permitiría volver a preguntar, y machacar con el prompt es la
forma más rápida de que lo bloqueen para siempre.

Fuera de la app instalada no se molesta a nadie: para eso está el botón manual de `/cuenta`.

### Qué se notifica (todo)

| Cuándo | A quién |
|---|---|
| Mensaje nuevo en el chat | Miembros, menos quien escribe |
| Fotos o vídeos subidos a la galería | Miembros, menos quien sube |
| Sesión o canción nueva (subida o enlace) | Miembros, menos quien sube |
| Comentario nuevo en una foto | Miembros, menos quien comenta |
| Alguien se registra y espera aprobación | **Solo la directiva** |
| Participante nuevo, pago marcado | **Solo la directiva** |
| Apunte nuevo en la compra, algo comprado | **Solo la directiva** |
| Te han aprobado como miembro | **Solo a esa persona** |
| Miembro nuevo aprobado | Miembros |

**Quién recibe qué se decide en el servidor** (`src/lib/push.ts`), cruzando `push_subs` con el rol
del perfil. Registrar un dispositivo no da derecho a recibirlo todo: los pagos y las tallas solo
salen hacia la directiva. Verificado con suscripciones de prueba de ambos roles.

Detalles que importan en el uso real:

- Subir 20 fotos manda **un solo aviso**, no veinte: el aviso va en una acción aparte
  (`finalizarSubidaGaleria`) que el cliente llama al terminar toda la tanda. Esa misma acción es la
  que revalida la ruta de la galería — y solo esa, nunca las llamadas intermedias (ver el porqué
  justo debajo).
- Cada tipo de aviso lleva su propia `tag`, así una tanda de fotos no entierra los mensajes del chat.
- Claves VAPID propias (`web-push`), sin cuenta de Firebase ni servicios de pago.
- Las suscripciones muertas se limpian solas (404/410 → se borran).
- **Un fallo al notificar nunca tumba la acción**: si no se puede avisar, la foto ya está subida y el
  mensaje ya está enviado. Todas las llamadas pasan por un envoltorio que traga el error.

> Nota de alcance: Android y escritorio admiten push desde el navegador. En iPhone solo funciona si
> la web se ha añadido antes a la pantalla de inicio (limitación de Apple, no del código) — otra
> razón para el cartel de instalación.

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

## 10-bis. Portada — segunda versión (2026-07-27)

Las tarjetas de "acceso a Galería/Música/Chat" del primer rediseño se sustituyeron por vista previa
real del contenido, y el mapa se trajo aquí desde `/donde` (sección anterior):

- **Galería**: `CarruselFotos.tsx`, cinta horizontal con las **últimas 10 fotos/vídeos en bucle
  infinito**, sin JavaScript — la lista se duplica una vez y una animación CSS (`@keyframes
  carrusel` en `globals.css`) desplaza el conjunto exactamente el 50% de su ancho, así el final del
  primer bloque enlaza sin costura con el principio del segundo. Se detiene sola con "reducir
  movimiento" activado (regla global ya existente) y en pausa al pasar el cursor por encima.
- **Música**: `MusicaCompacta.tsx`, las **últimas 5 pistas** con botón de play directo para las
  propias (R2) y un icono de enlace externo para Mixcloud/SoundCloud — sin los iframes incrustados,
  que se quedan en `/musica` para no cargar la portada.
- **Chat**: sin tarjeta. Es la única parte privada de la web; no tiene sentido anunciarla en la
  página pública.
- Ambas secciones llevan su botón **"Ver todas"** hacia la página completa correspondiente.

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
