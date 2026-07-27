/**
 * Convierte la clave pública VAPID (base64url) al formato binario que espera
 * `pushManager.subscribe`. Se usa desde el navegador.
 */
export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normal);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
