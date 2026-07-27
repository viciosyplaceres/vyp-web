"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Camera, Video, FolderOpen, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { registrarMedia, avisarSubidaGaleria } from "@/app/actions/media";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // tope real de la cuenta de Cloudinary

const ANIOS = Array.from(
  { length: new Date().getFullYear() - 2010 + 1 },
  (_, i) => new Date().getFullYear() - i,
);

export default function SubirMedia() {
  const router = useRouter();
  const [anio, setAnio] = useState(ANIOS[0]);
  const [ficheros, setFicheros] = useState<File[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [progreso, setProgreso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hechos, setHechos] = useState(0);

  /**
   * Suma lo elegido a lo que ya había, en vez de reemplazarlo: así se pueden
   * encadenar varias fotos de la cámara sin perder las anteriores. Se limpia
   * el input para poder volver a elegir el mismo archivo si hiciera falta.
   */
  function anadirFicheros(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = [...(e.target.files ?? [])];
    if (nuevos.length) setFicheros((prev) => [...prev, ...nuevos]);
    e.target.value = "";
  }

  function quitarFichero(indice: number) {
    setFicheros((prev) => prev.filter((_, i) => i !== indice));
  }

  async function subir(e: React.FormEvent) {
    e.preventDefault();
    if (!ficheros.length) return;

    setError(null);
    setHechos(0);

    for (let i = 0; i < ficheros.length; i++) {
      const original = ficheros[i];
      const esVideo = original.type.startsWith("video/");
      setProgreso(`Preparando ${i + 1} de ${ficheros.length}…`);

      try {
        if (esVideo && original.size > MAX_VIDEO_BYTES) {
          throw new Error(
            `"${original.name}" pesa más de 100 MB y no se puede subir. Recórtalo antes.`,
          );
        }

        // Las fotos se encogen aquí mismo, en el móvil: subir 8 MB con mala
        // cobertura en el recinto es inviable, y 2400px sobra para verse bien.
        let fichero: File = original;
        if (!esVideo) {
          setProgreso(`Comprimiendo ${i + 1} de ${ficheros.length}…`);
          fichero = await imageCompression(original, {
            maxWidthOrHeight: 2400,
            maxSizeMB: 2,
            useWebWorker: true,
            preserveExif: true,
          });
        }

        setProgreso(`Subiendo ${i + 1} de ${ficheros.length}…`);

        const resFirma = await fetch("/api/cloudinary/firma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anio, tipo: esVideo ? "video" : "foto" }),
        });
        if (!resFirma.ok) {
          const cuerpo = await resFirma.json().catch(() => ({}));
          throw new Error(cuerpo.error ?? "No se pudo firmar la subida.");
        }
        const firma = await resFirma.json();

        const datos = new FormData();
        datos.append("file", fichero);
        datos.append("api_key", firma.apiKey);
        datos.append("timestamp", String(firma.timestamp));
        datos.append("signature", firma.signature);
        datos.append("folder", firma.folder);

        const resSubida = await fetch(
          `https://api.cloudinary.com/v1_1/${firma.cloudName}/${esVideo ? "video" : "image"}/upload`,
          { method: "POST", body: datos },
        );

        if (!resSubida.ok) {
          const cuerpo = await resSubida.json().catch(() => ({}));
          throw new Error(
            cuerpo?.error?.message ?? "Cloudinary rechazó el archivo.",
          );
        }

        const subido = await resSubida.json();

        await registrarMedia({
          tipo: esVideo ? "video" : "foto",
          anio,
          storageId: subido.public_id,
          url: subido.secure_url,
          thumbUrl: esVideo
            ? subido.secure_url.replace(/\.[^.]+$/, ".jpg")
            : subido.secure_url.replace(
                "/upload/",
                "/upload/c_fill,w_600,h_600,q_auto,f_auto/",
              ),
          ancho: subido.width ?? null,
          alto: subido.height ?? null,
          duracionS: subido.duration ? Math.round(subido.duration) : null,
          descripcion: ficheros.length === 1 ? descripcion : null,
        });

        setHechos(i + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al subir.");
        setProgreso(null);
        return;
      }
    }

    // Un único aviso al terminar toda la tanda, no uno por foto.
    await avisarSubidaGaleria(anio, ficheros.length).catch(() => undefined);

    setProgreso(null);
    setFicheros([]);
    setDescripcion("");
    router.push(`/galeria/${anio}`);
    router.refresh();
  }

  return (
    <form onSubmit={subir} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="anio" className="text-sm text-white/70">
          Año de las fiestas
        </label>
        <select
          id="anio"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="min-h-[48px] w-full cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
        >
          {ANIOS.map((a) => (
            <option key={a} value={a} className="bg-black">
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-white/70">Fotos o vídeos</p>

        {/* Tres entradas distintas apuntando al mismo estado. El atributo
            `capture` es lo que hace que el móvil abra la cámara directamente
            en vez del explorador de archivos. En un ordenador, `capture` se
            ignora y los tres botones abren el selector normal. */}
        <div className="grid grid-cols-3 gap-2">
          <label className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-2 text-center text-xs font-medium transition-colors duration-200 hover:border-white/40 hover:bg-white/10">
            <Camera size={22} aria-hidden="true" />
            Hacer foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={anadirFicheros}
            />
          </label>

          <label className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-2 text-center text-xs font-medium transition-colors duration-200 hover:border-white/40 hover:bg-white/10">
            <Video size={22} aria-hidden="true" />
            Grabar vídeo
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="sr-only"
              onChange={anadirFicheros}
            />
          </label>

          <label className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-2 text-center text-xs font-medium transition-colors duration-200 hover:border-white/40 hover:bg-white/10">
            <FolderOpen size={22} aria-hidden="true" />
            De la galería
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={anadirFicheros}
            />
          </label>
        </div>

        {ficheros.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {ficheros.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm"
              >
                {f.type.startsWith("video/") ? (
                  <Video size={16} className="shrink-0 text-white/50" aria-hidden="true" />
                ) : (
                  <Camera size={16} className="shrink-0 text-white/50" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="shrink-0 text-xs text-white/40">
                  {(f.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => quitarFichero(i)}
                  aria-label={`Quitar ${f.name}`}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/30 transition-colors duration-200 hover:text-red-400"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-white/40">
          Las fotos se comprimen en tu móvil antes de enviarse. Los vídeos
          admiten hasta 100 MB.
        </p>
      </div>

      {ficheros.length === 1 && (
        <div className="space-y-1.5">
          <label htmlFor="descripcion" className="text-sm text-white/70">
            Descripción (opcional)
          </label>
          <input
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={300}
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {progreso && (
        <p aria-live="polite" className="text-sm text-white/70">
          {progreso}
          {ficheros.length > 1 && ` (${hechos}/${ficheros.length} listos)`}
        </p>
      )}

      <button
        type="submit"
        disabled={!ficheros.length || Boolean(progreso)}
        className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40"
      >
        <ImagePlus size={18} aria-hidden="true" />
        {progreso ? "Subiendo…" : "Subir a la galería"}
      </button>
    </form>
  );
}
