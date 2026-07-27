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
| **Música y sesiones** | **R2 (almacenamiento de objetos)** | 10 GB gratis y **tráfico de salida gratuito**: ideal para escuchar en bucle |
| Datos (miembros, pagos, comentarios) | Supabase Postgres | 500 MB, de sobra para texto |

**Requiere una acción tuya**: R2 no está activado en la cuenta (la API responde *"Please enable R2
through the dashboard"*). Activarlo suele pedir una tarjeta en el perfil aunque el uso siga siendo
gratuito dentro de los 10 GB. Si prefieres no darla, la alternativa es limitar la música a
canciones sueltas en Supabase Storage (1 GB) y enlazar las sesiones largas desde Mixcloud o
SoundCloud incrustadas.

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
pistas            id, titulo, artista, tipo ('sesion'|'cancion'), anio, url,
                  duracion_s, subido_por, created_at
comentarios       id, media_id (nullable), pista_id (nullable), autor_id, texto, created_at
participantes     id, nombre, pagado, importe, talla_camiseta, notas, anio
lista_compra      id, item, cantidad, comprado, anio, notas
```

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

La comprobación de "miembro aprobado" se hace con una función `es_miembro()` en Postgres, para no
repetir la misma condición en cada política.

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
a partir de la lista de `/musica`.

---

## 9. Mapa y cómo llegar

- Dirección: **C. Asturias, 30320 Fuente Álamo, Murcia**
- Coordenadas: **37.717352, -1.173910** (37°43'02.5"N 1°10'26.1"W)
- Mapa incrustado sin necesidad de clave de API.
- Botón grande **"Cómo llegar"** y mapa entero pulsable, que abren Google Maps con la ruta ya
  puesta hacia la peña:
  `https://www.google.com/maps/dir/?api=1&destination=37.717352,-1.173910`
- En móvil abre directamente la app de Google Maps.

---

## 10. Identidad visual — CERRADA

- **Logotipo**: wordmark horizontal ("VICIOS & PLACERES" en una línea, serif elegante), pensado
  para un header de web real, no un badge circular que obligaría a un header gigante. Icono
  cuadrado aparte ("V&P" compacto) para favicon y app icon. Ambos vectoriales (Recraft V4.1),
  descartes en `design/logo-candidatos/`.
- **Paleta**: negro puro de fondo, blanco de texto. Sin modo claro — serio y sobrio, no festivo.
- Tipografía de sistema (Geist) para que cargue rápido con mala cobertura en el recinto.

---

## 11. Fases de construcción

| Fase | Contenido | Estado |
|---|---|---|
| **F0** | Base: Next.js, dominio, despliegue | Hecho |
| **F1** | Logo e identidad visual | Candidatos generados, falta elegir |
| **F2** | Auth + tablas + RLS + aprobación de miembros | Pendiente |
| **F3** | Galería por años + subida con compresión (firmada) | Pendiente |
| **F4** | Comentarios | Pendiente |
| **F5** | Música y reproductor global | Pendiente (depende de decidir el almacenamiento) |
| **F6** | Mapa y cómo llegar | Pendiente |
| **F7** | Panel de la directiva | Pendiente |
| **F8** | Pulido, móvil, rendimiento | Pendiente |

---

## 12. Decisiones que hacen falta antes de seguir

1. **Qué logo** de los cuatro candidatos.
2. **Dónde va la música**: activar R2 (mejor opción, 10 GB y tráfico gratis) o quedarse en
   Supabase Storage (1 GB) y enlazar las sesiones largas desde fuera.
3. **Años con contenido**: ¿de qué años hay fotos para sembrar la galería?

---

## 13. Riesgos anotados

| Riesgo | Mitigación |
|---|---|
| Agotar los 25 créditos de Cloudinary | Comprimir en cliente, sacar la música a R2, vigilar consumo |
| Un miembro sube algo inapropiado | Los admin pueden borrar cualquier cosa; queda registrado quién subió qué |
| Vídeos de más de 100 MB | Aviso claro en la interfaz antes de subir |
| Cuenta de la peña comprometida | Rotar los tokens al terminar (pendiente, ver `CREDENCIALES.md`) |
