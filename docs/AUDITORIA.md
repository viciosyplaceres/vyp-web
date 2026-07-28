# Auditoría de calidad y rendimiento

La auditoría transversal más reciente (producción, PWA, accesibilidad, SEO
técnico, dependencias y cambios pendientes) está en
[`AUDITORIA-INTEGRAL-2026-07-28.md`](./AUDITORIA-INTEGRAL-2026-07-28.md).

Auditoría continua del código de la web de la peña. Desde la ronda 4 incluye
también seguridad, RLS, accesibilidad, SEO y PWA.

Regla de la casa: **nada entra aquí sin medirlo antes y después**. Si una
mejora no se puede demostrar con un número, se dice que no se ha podido
demostrar, en vez de venderla.

---

## Ronda 1 — 2026-07-27

### R1.1 · La sesión se resolvía cinco veces por página · RENDIMIENTO

`getSesion()` consulta Supabase Auth y luego la tabla `perfiles`. Se llamaba
desde el layout, desde su contador de no leídos, desde el header, desde el
contador de pendientes del header y desde la propia página. Ninguno sabía de
los otros.

- **Medido (local, sesión de un miembro real, instrumentando la función):**
  5 llamadas por render de la portada — 152 + 150 + 10 + 6 + 2 = **320 ms**.
- **Arreglo:** envolver `getSesion` en `cache()` de React, que memoriza el
  resultado dentro de una misma petición (jamás entre peticiones ni entre
  usuarios: cada render arranca de cero).
- **Resultado medido:** **1 llamada, 138 ms**. Unos 180 ms menos de trabajo por
  render y cinco veces menos peticiones contra un Supabase de plan gratuito.
- **Honestidad:** en el TTYFB no se aprecia una mejora clara (0,32–0,41 s antes,
  0,32–0,43 s después, misma máquina). Las tres últimas llamadas ya salían
  baratas porque supabase-js reaprovecha la conexión. La ganancia es de carga,
  no de latencia percibida.

### R1.2 · La portada se traía la tabla `media` entera · RENDIMIENTO

Para pintar "12 años de fiestas" y "20+ fotos" se hacía
`select("anio")` **sin límite**: se descargaba la columna de todas las filas
para medir el largo del array y buscarle el mínimo en memoria.

- **Arreglo:** un `count` exacto con `head: true` para el total, y una única
  fila ordenada por año ascendente para el primer año.
- **Efecto:** de traer N filas a traer 1. Hoy son 20 filas, pero es la página
  más visitada y esa tabla solo crece.
- **Verificado en producción:** la portada anónima sigue mostrando exactamente
  `12 / 20+ / 2` con sus tres etiquetas.

### R1.3 · El compresor de imágenes lo descargaba todo el mundo · RENDIMIENTO

`browser-image-compression` (51 KB ya empaquetado) se importaba de forma
estática en `SubirMedia`, así que entraba en el JS de `/galeria` para
cualquiera — aunque la inmensa mayoría solo entra a mirar fotos.

- **Arreglo:** `await import(...)` dentro de la función que comprime.
- **Verificado:** el HTML de `/galeria` ya no referencia ese fragmento
  (`grep` sobre la respuesta real: 0 apariciones). **51 KB menos** de descarga
  para quien no sube nada.

### R1.4 · Foto y comentarios se pedían en cadena · RENDIMIENTO

En el detalle de una foto se esperaba a la foto y solo entonces se pedían sus
comentarios, aunque los comentarios se filtran por el id que ya venía en la
URL y no dependían de la primera consulta. Ahora van en un `Promise.all`.

### R1.5 · Faltaban índices para las consultas del perfil · PREVENCIÓN

`EXPLAIN ANALYZE` sobre la base de datos real confirmó un **Seq Scan** al
filtrar `media` por `subido_por` (la consulta de `/perfil`, `/perfil/galeria`
y `/miembros/[id]`).

- **Arreglo:** migración `0010`, índices compuestos `(subido_por, created_at desc)`
  en `media` y `pistas`, más `(created_at desc)` para los listados.
- **Honestidad:** hoy **no acelera nada** — con 20 filas Postgres seguirá
  eligiendo el escaneo, que en una tabla diminuta es más rápido. Es para dentro
  de unos veranos.

### R1.6 · Duplicación eliminada · LIMPIEZA

- `type RelAutor` estaba declarado **siete veces** (dos de ellas en el mismo
  fichero) para desenvolver siempre lo mismo → `lib/relaciones.ts`
  (`autorDe`, `unaRelacion`, `aplanarRelacion`).
- La función `aplanar()` estaba copiada en dos páginas → la misma.
- `Number(fecha.slice(8, 10))} de agosto` repetido en tres pantallas, con el
  mes escrito a mano → `lib/formato.ts` (`diaLegible`), que ahora deriva el mes
  de la propia fecha. No corregía ningún fallo actual (el panel solo deja
  elegir días de agosto), pero deja de ser mentira si algún día se apunta algo
  de julio.
- `formatearBytes()` vivía suelto dentro de un componente → `lib/formato.ts`.

**Comprobación:** `grep` de los cuatro patrones en todo `src/` fuera de
`lib/`: cero apariciones.

### Estado al cerrar la ronda

`tsc --noEmit` limpio · `eslint --max-warnings=0` limpio · build correcto ·
las 11 rutas con sesión y las 3 anónimas responden 200 en producción · la
portada y el detalle de foto muestran exactamente el mismo contenido que antes.

---

## Ronda 2 — 2026-07-27

### R2.1 · Teclear en el chat repintaba toda la conversación · RENDIMIENTO

El texto que se está escribiendo vivía en el mismo componente que la lista de
mensajes, así que **cada pulsación de tecla volvía a pintar todas las
burbujas**.

- **Medido** (Chromium real, sesión del admin, contador dentro de cada
  burbuja, 9 mensajes en la conversación): teclear 10 caracteres →
  **90 renders de burbuja** (9 × 10). Vaciar el campo → 9 más.
- **Arreglo:** `Chat.tsx` pasa a orquestador (662 → 230 líneas) y reparte en
  `components/chat/`: `BarraEscritura.tsx` (se queda el texto en curso),
  `BurbujaMensaje.tsx` (envuelta en `memo`, recibe datos ya resueltos y
  funciones estables con `useCallback`), `useRealtimeChat.ts` y `tipos.ts`.
- **Resultado medido, mismo escenario:** **0 renders de burbuja** al teclear
  esos 10 caracteres, y 0 al vaciar el campo. Con 200 mensajes cargados (el
  límite de la página) serían 2.000 renders evitados por cada 10 teclas.
- **Honestidad:** el tiempo de tecleo medido no mejora de forma apreciable
  (808 ms → 783 ms para 10 teclas con 30 ms de espera forzada entre ellas):
  con 9 mensajes el trabajo evitado es pequeño. Lo que se demuestra es el
  trabajo eliminado, no una mejora perceptible **a este tamaño**.
- **Verificado igual que antes** en navegador real: enviar, recibir en vivo,
  citar respuesta, editar (con su etiqueta "editado"), reaccionar, eliminar y
  teclado de emojis. Diez de diez correctos, sin errores de consola.

### R2.2 · Tres canales de Realtime, y uno de ellos roto · RENDIMIENTO + FALLO REAL

Al leer los frames del WebSocket en un navegador real apareció algo que no se
veía en el código: el canal de pendientes recibía
`"Unable to subscribe to changes with given parameters"` y **Supabase tumba el
canal entero cuando falla un solo binding**.

- **Causa, comprobada contra la base de datos real:**
  `select tablename from pg_publication_tables where pubname='supabase_realtime'`
  devolvía solo `mensajes`, `mensaje_reacciones` y `chat_lecturas`. Las cuatro
  tablas de gestión (`tareas`, `lista_compra`, `tareas_miembros`,
  `compra_miembros`) nunca se publicaron → **la burbuja de pendientes del
  avatar jamás se actualizó en vivo** desde que se creó.
- **Arreglo 1 (migración `0011_realtime_gestion.sql`, ya aplicada):** publicar
  esas cuatro tablas.
- **Arreglo 2 (`lib/realtime.ts`):** un único canal `vyp` para toda la app, con
  la unión de las escuchas de quien esté montado.
- **Medido con los frames del WebSocket (mismo escenario, mensaje ajeno
  insertado en la base de datos real):**

  | | Antes | Después |
  |---|---|---|
  | Canales fuera del chat | 2 | **1** |
  | Canales dentro del chat | 3 | **1** |
  | Frames `postgres_changes` por un mensaje | 4 | **2** |

  Los 4 frames de antes eran: el mensaje por duplicado (dos canales escuchando
  el mismo INSERT) más dos marcas de lectura, porque `Chat` y `BottomNav`
  llamaban **los dos** a `marcarChatLeido()` — dos escrituras en
  `chat_lecturas` por cada mensaje recibido. Ahora solo lo hace el chat.
- **Verificado en producción** con sesión real: la burbuja de pendientes pasa
  de no existir a marcar **1** sin recargar la página, al asignar una tarea de
  prueba desde fuera (y vuelve a cero al borrarla). Antes de esta ronda eso no
  ocurría.

### R2.3 · Contar pendientes descargaba las filas · RENDIMIENTO

`obtenerPendientesPerfil` traía **todas** las asignaciones del miembro (con la
tarea o el artículo embebido dentro) para contarlas con un `filter().length`.

- **Medido** contra la base de datos real, sembrando 6 tareas (4 pendientes) y
  4 artículos (3 pendientes) asignados al admin: **10 filas descargadas** →
  **0 filas** (dos `count` exactos con `head: true`). Mismo resultado en ambas
  formas: 7 pendientes. Mediana de 103 ms → 70 ms.
- Los datos de prueba se borraron al terminar (verificado: 0 filas restantes).

### R2.4 · El chat pedía las reacciones de toda su historia · RENDIMIENTO

`/chat` hacía cuatro consultas en paralelo, una de ellas
`from("mensaje_reacciones").select(...)` **sin filtro**: descargaba las
reacciones de todos los mensajes que han existido, aunque solo se pintan 200.
Ahora vienen embebidas en la propia consulta de mensajes.

- **Medido** (8 repeticiones, mediana): 4 consultas → **3 consultas**, 67 ms →
  60 ms.
- **Honestidad:** hoy no se puede demostrar el ahorro de filas, porque la
  conversación real no tiene ninguna reacción guardada (0 filas en ambos
  casos). Lo que sí queda demostrado es una consulta menos por carga del chat.
- **De paso, un fallo latente:** los mensajes se pedían con
  `order("created_at", ascending: true).limit(200)`, es decir los **200 más
  antiguos**. El día que la peña pase de 200 mensajes, el chat habría dejado de
  mostrar la conversación reciente. Ahora se piden descendentes y se les da la
  vuelta al pintarlos.

### R2.5 · Ningún fichero pasa de 400 líneas · LIMPIEZA

- `Chat.tsx` 662 → **230** (R2.1).
- `PanelTareas.tsx` 427 → **160**, extrayendo `tareas/FormularioTarea.tsx` y
  `tareas/CalendarioAgosto.tsx`.
- Duplicación eliminada: el chat declaraba sus propias `hora()` y
  `diaLegible()`, esta última con el **mismo nombre pero distinto significado**
  que la de `lib/formato.ts` (una recibe un instante, la otra una fecha suelta).
  Ahora son `horaCorta()` y `diaRelativo()` en `lib/formato.ts`, documentadas
  para no volver a confundirlas.
- **Comprobado:** el fichero más largo de `src/` es ahora
  `SubirMusica.tsx` con 347 líneas.

### Estado al cerrar la ronda

`tsc --noEmit` limpio · `eslint --max-warnings=0` limpio · build correcto ·
desplegado en producción · las 12 rutas con sesión real responden 200 **y
contienen su contenido** (portada, galería, detalle de foto, música, chat,
perfil, miembros, gestión, tareas, almacenamiento, galería y música propias) ·
todos los datos de prueba insertados en la base de datos real fueron borrados
y comprobados a cero.

**Pendiente para la ronda 3:** revisar los 29 componentes con `"use client"`,
`SubirMusica.tsx` (347) y `SubirMedia.tsx` (299), y buscar `await` encadenados
en las páginas de galería y música.

---

## Ronda 3 — 2026-07-28

### R3.1 · La ruta crítica global cruzaba el Atlántico varias veces · RENDIMIENTO

La inspección de cabeceras mostró funciones Vercel en `iad1` (Washington) y Supabase en
Europa/Madrid. Además, cada navegación autenticada esperaba la validación de Auth en el proxy,
otra llamada a Auth desde `getSesion()`, la consulta de perfil, dos consultas secuenciales para el
chat y dos consultas para pendientes.

- **Medido antes en producción, Chromium con sesión real:** portada **859 ms** de TTFB; galería
  **1469 ms**; música **781 ms**; chat **925 ms**; miembros **957 ms**; gestión **1145 ms**; perfil
  **1008 ms**. Las páginas anónimas estaban entre **0,18 y 0,57 s**, lo que aisló el coste en el
  camino autenticado.
- **Arreglo de red:** `vercel.json` fija `cdg1` (París), una región permitida en Hobby y cercana a
  la base europea.
- **Arreglo de Auth:** después de validar/refrescar el JWT, `proxy.ts` reenvía su `sub` mediante una
  cabecera interna y elimina antes cualquier valor homónimo enviado por el navegador. `getSesion()`
  evita la segunda llamada a Auth y la autorización sigue dependiendo de `perfiles` con RLS.
- **Arreglo de consultas:** la migración `20260728005711_contadores_navegacion.sql` añade una RPC
  `SECURITY INVOKER` que calcula mensajes no leídos, tareas y compra en una única llamada. El layout
  la ejecuta en paralelo con el perfil y pasa sesión y pendientes al header, eliminando su trabajo
  servidor duplicado. Las visitas anónimas no llaman a la RPC.
- **Respuesta percibida:** `app/loading.tsx` muestra el emblema circular de VYP durante la espera
  de las rutas dinámicas, con una animación de respiración basada solo en `transform`/`opacity` y
  desactivada para quien prefiere reducir movimiento.
- **Verificación disponible antes del despliegue:** RPC aplicada y ejecutada correctamente bajo
  rol `authenticated`; las siete rutas autenticadas responden 200 en un build local de producción;
  una petición anónima a `/perfil` con `x-vyp-user-id` falsificada sigue redirigiendo a login;
  `tsc --noEmit`, ESLint y build correctos. En ese build local, los TTFB quedaron entre **74 y
  127 ms**, pero no se comparan con producción porque la máquina y el trayecto de red son distintos.
- **Resultado medido después:** pendiente. Vercel bloqueó temporalmente más builds por el límite
  del plan Hobby; no se presenta como mejora demostrada hasta repetir exactamente la medición en
  producción con la nueva región.

---

## Ronda 4 — 2026-07-28

### R4.1 · El service worker todavía podía cachear respuestas de sesión · SEGURIDAD / PWA

- **Reproducción:** una navegación App Router usa RSC (`RSC: 1`, `text/x-component`) y llega con
  `destination` vacío. Por tanto no entraba en la exclusión de documentos y acababa en el caché GET
  genérico. Cache Storage no separa por usuario ni obedece por sí solo el `private/no-store` HTTP.
- **Arreglo:** `sw.js` usa una lista blanca de recursos estáticos; ninguna respuesta desconocida se
  cachea. La versión sube a `vyp-v5` para borrar la caché anterior al activar el nuevo worker.
- **Regresión:** `tests/service-worker.test.mjs` cubre RSC/API, caché estática y fallback offline.

### R4.2 · Un documento interno podía registrarse como música pública · SEGURIDAD / RLS

- **Reproducción:** `registrarPistaR2` aceptaba cualquier clave y la ruta pública de reproducción
  solo comprobaba que existiera en `pistas`. Un miembro podía registrar una clave `documentos/` que
  conociera y obtener después una URL pública prefirmada.
- **Arreglo:** validación estricta en action y rutas, más tres restricciones `CHECK` en Postgres para
  música, documentos de tareas y documentos de compra. La migración está aplicada en Supabase.
- **Evidencia:** las 2 pistas R2 existentes cumplen el formato; las 3 restricciones están validadas;
  una inserción válida dentro de una transacción con rollback fue aceptada y una clave cruzada fue
  rechazada. `tests/r2-claves.test.mjs` cubre ambos namespaces.

### R4.3 · URLs duplicadas y bloqueos de accesibilidad · SEO / ACCESIBILIDAD

- El detalle de galería valida el año y filtra por `(id, anio)`: una URL mal formada o con el año de
  otra foto ya no puede renderizar contenido duplicado con canonical falso.
- Portada y detalle tienen `h1`; el `<dl>` de estadísticas vuelve a ser semánticamente válido; los
  textos que Lighthouse señaló suben a contraste suficiente y los selectores reciben nombre.
- Las flechas de una foto dejan de navegar cuando el foco está en el formulario de comentarios.

### R4.4 · Dependencias de producción sin avisos corregibles · SEGURIDAD

- Next 16.2.12 incluye `postcss@8.4.31` y `sharp@0.34.5`; la rama oficial 16.3 ya usa PostCSS
  8.5.x y Sharp 0.35.3. Se fijan `postcss@8.5.23` y `sharp@0.35.3` sin cambiar Next estable.
- **Resultado:** `npm audit --omit=dev` pasa de 3 avisos altos a **0 vulnerabilidades**. Sharp 0.35.3
  procesó el wordmark real con libvips 8.18.3 y el build completo sigue siendo correcto.
- La auditoría con dependencias de desarrollo conserva 9 avisos altos en ESLint/minimatch. No hay
  parche compatible: los plugins publicados más recientes exigen `minimatch ^3.1.2` y la primera
  rama corregida es 10.0.3+. Forzar ese salto violaría su API; no afecta al bundle ni al servidor.

Validación local de esta ronda: 4/4 pruebas, TypeScript, ESLint, build y auditoría npm de
dependencias de producción correctos. Lighthouse y la comprobación funcional postcambio siguen
pendientes de despliegue.

**Estado de producción a las 05:00 CEST:** todavía sirve `sw.js` con `vyp-v4`, devuelve 404 en
`/robots.txt` y `/sitemap.xml`, y acepta con 200 los años de galería falso y no numérico usados en
la reproducción. No se atribuye a producción ninguna corrección local. La tarea automática #71 se
actualizó inicialmente para verificar el lote completo mediante Deploys a las 07:14 CEST; la #74 se
eliminó por ser un segundo intento duplicado que consumiría otra compilación de Vercel. Al consultar
después la ventana móvil real de la API, el único reintento se trasladó a las 16:05 CEST.

---

## Ronda 5 — 2026-07-28

### R5.1 · La compra por lotes podía quedar a medias · INTEGRIDAD / RLS

- **Reproducción:** el action insertaba primero `lista_compra` y después `compra_miembros`. Ante un
  fallo del segundo paso intentaba compensar borrando, pero ignoraba un posible error del borrado.
- **Arreglo:** `crear_items_compra()` es una RPC `SECURITY INVOKER`; limita a 100 artículos y 100
  encargados, comprueba miembros aprobados, cantidades, año y documento, y deja que el RLS proteja
  ambas tablas. Toda la llamada es una única transacción PostgreSQL.
- **Defensa adicional:** tres restricciones `CHECK` impiden artículos vacíos, cantidades fuera de
  1–9999 y documentos incompletos incluso mediante la Data API directa.
- **Prueba remota con rollback:** una directiva creó 2 artículos × 2 encargados dentro de una
  transacción; se observaron 2 filas y 4 asignaciones. Un miembro y `anon` fueron rechazados. Se
  forzó un fallo en `compra_miembros` y se comprobaron 0 artículos huérfanos. Todos los ensayos se
  revirtieron y el recuento residual fue 0.
- **Regresión local:** `tests/compra.test.mjs` cubre normalización, límites, cantidades, UUID y
  deduplicación. La suite pasa ahora de 4 a 7 pruebas.

Producción web continúa sin este lote y la tarea Deploys #71 sigue pendiente para las 16:05 CEST;
la migración de Supabase sí está aplicada y es compatible con el frontend actualmente servido.

---

## Ronda 6 — 2026-07-28

### R6.1 · Publicación autorizada y estado real de producción

- Se añadió `scripts/vercel-api-deploy.mjs`: sube únicamente fuentes no sensibles por SHA-1 a la
  API de Vercel, crea el deployment de producción y espera a `READY`. Así el flujo
  `/api/deploys/launch` no depende del CLI de Vercel, que abría listeners aleatorios rechazados por
  el control de puertos de JARVIS.
- El deployment `dpl_4FcsuzW54wRES5u5mgcnZv5QnUbA` quedó `READY` y asociado a
  `www.viciosyplaceres.com`. Producción sirve `sw.js` `vyp-v5`, `/robots.txt` y `/sitemap.xml` con
  200. La vista previa del host permanece registrada en el puerto cedido 20441.
- La última promoción fue rechazada literalmente por Vercel con: `Resource is limited - try again
  in 24 hours (more than 100, code: "api-deployments-young-hobby-team-24h")`. El deployment previo
  sigue sano. A las 07:02 CEST, la API aún devolvía 100 deployments dentro de la ventana móvil; el
  más antiguo de esos 100 vence a las 16:02:56 CEST. La tarea automática #71 conserva un único
  intento, reprogramado con margen para las 16:05 CEST.

### R6.2 · Ruta crítica de portada

- El hero se envía sin esperar las consultas de galería, música, estadísticas y sesión. Las
  secciones inferiores usan fronteras de `Suspense` pequeñas y coordinadas; el experimento de
  liberar consultas fuera de orden produjo `CLS 0,096` y se descartó.
- El iframe de OpenStreetMap no hace ninguna petición hasta pulsar “Ver mapa interactivo”; en la
  prueba funcional pasó de 0 a 1 petición y no produjo errores de consola.
- Supabase Realtime se importa dinámicamente solo para miembros. En anónimo desaparece el chunk de
  66 KiB que Lighthouse marcaba 95% sin usar. Registro SW, instalación y avisos se difieren ocho
  segundos; el SW seguía registrado a los 12 s y el cartel no interrumpió la primera interacción.
- El wordmark conserva su relación de aspecto y la portada limita la cinta a seis fotos. Webpack
  reduce el conjunto JS inicial medido de 554 a 473 KiB sin comprimir.

### R6.3 · Verificación final y límite restante

- Producción Webpack: escritorio **100/100/100/100**; móvil **98–99/100/100/100** en ejecuciones
  limpias de Lighthouse 13.4.1. La mejor pasada móvil midió FCP 1,1 s, LCP 1,6 s, TBT 80 ms,
  CLS 0, 40 peticiones y ~315 KiB. El punto residual varía con la ejecución del runtime React en
  el host ARM y ya no corresponde a una oportunidad concreta de aplicación.
- La revisión final del host devuelve 404 real para `/galeria/1900` y `/galeria/02024`, y 200 para
  `/galeria/2024`. Producción aún devuelve 200 + `noindex` para el año falso porque esa corrección
  temprana de `proxy.ts` es exactamente la promoción bloqueada por la cuota de 24 horas.
- Validación final: 7/7 pruebas, TypeScript, ESLint, `git diff --check`, build Webpack y
  `npm audit --omit=dev` sin vulnerabilidades de producción. La validación completa se repitió a
  las 07:01 CEST antes de calcular la nueva ventana y obtuvo el mismo resultado.
