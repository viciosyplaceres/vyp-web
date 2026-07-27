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
