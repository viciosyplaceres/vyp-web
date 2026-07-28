# Auditoría integral de VYP

Fecha: 2026-07-28
Alcance: producción pública, PWA, rendimiento, accesibilidad, SEO técnico,
cabeceras de seguridad, dependencias y cambios locales pendientes.

## Estado de la auditoría

- Producción revisada: `https://www.viciosyplaceres.com`.
- Navegación comprobada en Chromium en escritorio y móvil: portada, galería,
  música, chat, login, miembros y gestión. No hubo errores JavaScript; las
  rutas protegidas redirigen a login sin sesión.
- Calidad local: `npm run lint`, `npx tsc --noEmit`, `npm run build` y
  `git diff --check` correctos.
- El lote funcional y de rendimiento está publicado mediante Deploys en
  `dpl_4FcsuzW54wRES5u5mgcnZv5QnUbA`. Solo el 404 HTTP temprano para años de
  galería inválidos permanece en la revisión del host, pendiente de promoción
  por la cuota temporal de Vercel Hobby. El único reintento está programado para
  las 16:05 CEST, después del primer hueco medido de la ventana móvil.
- No se usaron ni modificaron cuentas reales ni datos de producción.

## Iteración autónoma 1

- Se reprodujo un riesgo no recogido en la primera pasada: `sw.js` excluía HTML,
  pero no las respuestas RSC de las navegaciones internas de Next. Se sustituyó
  la caché genérica de GET por una lista blanca estricta de recursos estáticos y
  se subió su versión a `vyp-v5`.
- Se cerró el cruce de namespaces R2 que permitía registrar una clave interna
  `documentos/` como pista pública. Hay validación en las rutas, en el server
  action y en tres restricciones `CHECK` ya aplicadas y verificadas en Supabase.
- El detalle de galería valida ahora el año y consulta por `(id, anio)`, evitando
  duplicados como `/galeria/2099/<id>` o años no numéricos.
- Se corrigieron los bloqueos de accesibilidad ya medidos: contraste, `h1`,
  estructura del `<dl>` y nombre accesible de dos selectores. Las flechas de la
  galería ya no sacan al usuario del campo de comentario.
- Se añadió `npm test`: 4 pruebas sin dependencias para service worker y R2.
  TypeScript, ESLint y build están limpios.
- Se fijaron las ramas corregidas `postcss@8.5.23` y `sharp@0.35.3`, ya usadas
  por la rama oficial Next 16.3. `npm audit --omit=dev` pasa de 3 avisos altos a
  0. Quedan 9 avisos solo de desarrollo en la cadena ESLint/minimatch, sin parche
  compatible publicado: los plugins actuales exigen minimatch 3 y la rama segura
  empieza en 10.0.3.
- Producción todavía no contiene este lote: a las 05:00 CEST seguía en `vyp-v4`,
  robots/sitemap devolvían 404 y las URLs de detalle con año falso respondían 200.
  El único reintento automático es la tarea #71, obligada a usar el flujo Deploys;
  se eliminó la tarea #74 por duplicada y, tras medir la ventana real, la #71 quedó
  programada para las 16:05 CEST.

## Iteración autónoma 2

- La creación múltiple de compras ya no usa dos peticiones con borrado
  compensatorio. La RPC `crear_items_compra()` inserta artículos y asignaciones
  dentro de una sola transacción y conserva RLS mediante `SECURITY INVOKER`.
- Aplicación y Postgres limitan cada tanda a 100 artículos y 100 encargados. La
  base también valida textos, cantidades 1–9999, miembros aprobados y documentos.
- Verificación remota sin residuos: 2 artículos, 4 asignaciones, rechazo de
  miembro y anónimo, y rollback completo ante un fallo de asignación provocado.
  Las tres restricciones están validadas y no quedó ninguna fila de prueba.
- Se añadieron 3 pruebas unitarias; la suite suma 7. Producción web sigue en el
  lote anterior porque el intento autorizado #71 espera la ventana de las 16:05 CEST.

## Iteración autónoma 3

- Se reemplazó el CLI de Vercel por una integración REST ejecutada dentro de
  Deploys. El script excluye `.env`, credenciales, builds y dependencias, sube
  fuentes por SHA-1 y espera el estado `READY` sin abrir puertos auxiliares.
- La portada transmite el hero antes que los datos inferiores, divide el trabajo
  en fronteras `Suspense`, conserva `CLS 0` y reduce la cinta a seis fotos.
- OpenStreetMap se carga solo al pulsarlo. Realtime solo se importa para miembros
  y las tareas PWA no críticas arrancan ocho segundos después. El cartel de
  instalación aparece después, sin bloquear la primera interacción.
- Webpack redujo el JS inicial sin comprimir un 15% respecto a Turbopack. En la
  red de Lighthouse la portada pasó de 65 peticiones y ~850 KiB a 40 y ~315 KiB.
- El proxy de la revisión final rechaza años no canónicos o fuera de 2010–2100
  antes del streaming: en el host, `1900` y `02024` son 404 y `2024` es 200.
  Vercel bloqueó su promoción al superar 100 deployments/24 h; producción
  conserva de forma segura el deployment anterior y responde 200 + `noindex`
  para el caso falso hasta el único reintento automático. A las 07:02 CEST, los
  100 deployments más recientes seguían dentro de la ventana móvil y el más
  antiguo vencía a las 16:02:56 CEST; el reintento quedó fijado a las 16:05.

## Medición de producción

Medición inicial de Lighthouse sobre la portada, con caché limpia:

| Perfil | Rendimiento | Accesibilidad | Buenas prácticas | SEO | FCP | LCP | TBT | Interactivo | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Móvil simulado | 94 | No medido en esta pasada | No medido en esta pasada | No medido en esta pasada | 1,6 s | 1,6 s | 220 ms | 4,5 s | 0,015 |
| Escritorio | 76 | 93 | 100 | 100 | 1,1 s | 1,6 s | 1.200 ms | 5,0 s | 0 |

Los resultados no contradicen la sensación de lentitud: el contenido aparece
rápido, pero el primer uso puede esperar hasta 4,5–5 segundos por JavaScript e
hidratación. El mayor consumidor es el chunk `19uhmwv55f9em.js` (hasta 1,71 s
de ejecución medida en escritorio).

Medición posterior al deployment optimizado, Lighthouse 13.4.1:

| Perfil | Rendimiento | Accesibilidad | Buenas prácticas | SEO | FCP | LCP | TBT | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Móvil simulado, rango de 2 pasadas | 98–99 | 100 | 100 | 100 | 0,9–1,1 s | 1,6–2,1 s | 80–130 ms | 0 |
| Escritorio | 100 | 100 | 100 | 100 | 0,3 s | 0,5 s | 10 ms | 0,002 |

TTFB HTTP observado desde este entorno:

| Ruta pública | TTFB |
| --- | ---: |
| `/` | 0,87 s |
| `/galeria` | 0,56 s |
| `/musica` | 0,33 s |
| `/miembros` | 0,36 s (redirige a login sin sesión) |
| `/chat` | 0,21 s |
| `/login` | 0,26 s |

Estas son medidas puntuales de red, no percentiles de usuarios reales.

## Hallazgos priorizados

### Alta prioridad

1. **Dependencias de producción (corregido localmente).** `npm audit --omit=dev`
   detectaba vulnerabilidades heredadas de `postcss` y `sharp` a través de
   `next@16.2.12`. En vez de aceptar la degradación automática a Next 9, se fijan
   las versiones corregidas que ya usa la rama oficial Next 16.3. Resultado: 0
   vulnerabilidades de producción, build correcto y transformación Sharp real.
   La cadena ESLint/minimatch mantiene 9 avisos solo de desarrollo sin versión
   compatible disponible; se revisará cuando sus plugins abandonen minimatch 3.

2. **Toda la respuesta HTML pública se sirve con `Cache-Control: private,
   no-cache, no-store`.** Está confirmado en `/`, `/chat` y `/login`. Impide
   caché de CDN y bfcache incluso en la portada anónima; Lighthouse confirma que
   la navegación atrás/adelante no puede restaurarse. Separar el layout público
   del que lee sesión permitiría hacer la portada y la galería públicas estáticas
   o ISR, sin cachear nunca páginas con datos privados.

### Prioridad media

3. **La portada ejecutaba demasiado JavaScript (corregido).** Realtime dejó de
   entrar en el bundle anónimo, mapa y PWA se difieren, el hero se transmite
   antes que los datos y Webpack reduce el conjunto inicial. Escritorio baja de
   1.200 ms a 10 ms de TBT; móvil queda en 80–130 ms según la ejecución.

4. **La creación múltiple de compras no era atómica (corregido).** La RPC
   `crear_items_compra()` inserta artículos y asignaciones en una transacción
   `SECURITY INVOKER`; un fallo forzado dejó 0 filas huérfanas.

5. **La cobertura automatizada sigue incompleta.** Ya existe `npm test` con
   cobertura del service worker y namespaces R2. Quedan sin cobertura
   `src/proxy.ts:30-56`, `src/lib/auth.ts:43-74`, las RPC de contadores y la
   purga administrativa de chat. Añadir pruebas de integración para roles,
   cabecera falsificada, RLS y función destructiva antes de nuevas ampliaciones.

6. **Faltan cabeceras de endurecimiento.** Producción solo expone HSTS. No se
   observan CSP, `X-Content-Type-Options`, `Referrer-Policy` ni
   `Permissions-Policy`. Deben añadirse en `next.config.ts` tras inventariar los
   orígenes legítimos de Supabase, Cloudinary, R2, Google Maps y push, para no
   romper cargas existentes.

7. **Accesibilidad: contraste y marcado semántico (corregido localmente).** Lighthouse identificó
   texto `text-white/40` insuficiente sobre negro en la portada y el botón
   "Ahora no" de instalación. También detecta que el bloque de estadísticas usa
   un `<dl>` con grupos `div > p`; cambiar cada grupo a `div > dt + dd` elimina
   el aviso sin cambiar el diseño.

8. **Faltaba el mínimo técnico SEO para descubrimiento (corregido localmente).**
   `/robots.txt` y `/sitemap.xml` devolvían 404. Se añadieron ambos, el sitemap
   incluye las rutas públicas y la galería real, y robots excluye autenticación,
   perfiles, gestión, chat y API. También se definieron canonical públicos hacia
   `www.viciosyplaceres.com`, porque los hosts con y sin `www` respondían ambos
   `200`. Ambos están confirmados en producción.

### Prioridad baja

9. **El wordmark del header descarga una imagen sobredimensionada.** Para un
   logo mostrado alrededor de 207×20 px, Next entrega una fuente de 1886×182;
   Lighthouse estima 13 KiB evitables. Declarar `sizes` apropiado o servir una
   variante raster pequeña conserva el aspecto y evita esa descarga.

10. **La creación masiva no limitaba filas ni asignaciones (corregido).** Cliente,
    action y RPC limitan la tanda a 100 artículos y 100 encargados.

## Confirmaciones positivas

- Las rutas públicas principales respondieron correctamente en móvil y
  escritorio, sin errores de página.
- El service worker maneja los fallos de red y, tras esta iteración, solo guarda
  una lista blanca de recursos estáticos; las pruebas excluyen RSC y API.
- Manifest PWA válido y con iconos de 192/512 px; la instalación iOS requiere
  seguir siendo iniciada por gesto del usuario desde la app instalada.
- `proxy.ts` borra `x-vyp-user-id` entrante antes de crear la identidad interna;
  la consulta de perfil vuelve a estar sometida a RLS.
- Las nuevas RPC revisadas restringen su ejecución a `authenticated`; la purga
  de chat comprueba directiva internamente antes de borrar.
- La compilación de producción enumera todas las rutas esperadas y finaliza sin
  errores.

## Orden de corrección recomendado

1. Promover el 404 temprano cuando Vercel libere la cuota y comprobar el estado
   HTTP de años falsos en el dominio público.
2. Añadir pruebas de roles/RLS y de la purga antes de tocar permisos otra vez.
3. Incorporar las cabeceras de endurecimiento tras inventariar orígenes.
4. Revisar minimatch cuando ESLint publique una cadena compatible corregida.
