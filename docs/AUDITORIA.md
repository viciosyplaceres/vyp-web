# Auditoría de calidad y rendimiento

Auditoría continua del código de la web de la peña. Solo calidad y rendimiento:
la parte de seguridad queda fuera por decisión del señor.

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
