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
    admin/                  Participantes · deudas · tareas · compras · miembros (solo directiva)
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

---

## 8. Pendiente / ideas para más adelante

- Notificaciones también al subir fotos nuevas (hoy solo avisa el chat).
- Borrar el fichero de Cloudinary/R2 al borrar la fila (hoy se borra el registro, no el archivo).
- Página de perfil editable (cambiar nombre y foto).
