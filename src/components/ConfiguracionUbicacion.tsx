"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, MapPinned, Save } from "lucide-react";
import {
  actualizarUbicacion,
  type UbicacionPublica,
} from "@/app/actions/configuracion";

export default function ConfiguracionUbicacion({
  ubicacion,
}: {
  ubicacion: UbicacionPublica;
}) {
  const [nombre, setNombre] = useState(ubicacion.nombre);
  const [direccion, setDireccion] = useState(ubicacion.direccion);
  const [mapsUrl, setMapsUrl] = useState(ubicacion.mapsUrl);
  const [coordenadas, setCoordenadas] = useState(
    `${ubicacion.latitud}, ${ubicacion.longitud}`,
  );
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const enlacePrueba = mapsUrl.trim().startsWith("https://") ? mapsUrl : ubicacion.mapsUrl;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    const partes = coordenadas.split(",").map((parte) => parte.trim());
    const latitud = Number(partes[0]);
    const longitud = Number(partes[1]);
    if (partes.length !== 2 || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
      setError("Copia las coordenadas como latitud, longitud. Por ejemplo: 37.717352, -1.17391");
      return;
    }

    setError(null);
    setGuardado(false);
    startTransition(async () => {
      try {
        await actualizarUbicacion({ nombre, direccion, mapsUrl, latitud, longitud });
        setGuardado(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la ubicación.");
      }
    });
  }

  return (
    <form
      onSubmit={guardar}
      className="mb-6 rounded-xl border border-white/15 bg-white/5 p-4"
    >
      <div className="flex items-start gap-3">
        <MapPinned size={19} className="mt-0.5 shrink-0 text-white/60" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Ubicación de la peña</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/50">
            Controla la dirección, el mapa de la portada y el botón “Cómo llegar”.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs text-white/60">Nombre breve del lugar</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            maxLength={120}
            placeholder="Fuente Álamo · Murcia"
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs text-white/60">Dirección que verá la gente</span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
            maxLength={300}
            placeholder="Calle, número, localidad"
            className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1.5">
        <span className="text-xs text-white/60">URL exacta de Google Maps</span>
        <input
          type="url"
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          required
          placeholder="https://maps.app.goo.gl/…"
          className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
        />
      </label>

      <label className="mt-3 block space-y-1.5">
        <span className="text-xs text-white/60">Coordenadas exactas: latitud, longitud</span>
        <input
          value={coordenadas}
          onChange={(e) => setCoordenadas(e.target.value)}
          required
          inputMode="decimal"
          placeholder="37.717352, -1.17391"
          className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 font-mono text-base outline-none focus:border-white"
        />
      </label>

      <details className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white/55">
        <summary className="cursor-pointer font-medium text-white/70">
          Cómo sacar estos datos de Google Maps
        </summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed">
          <li>Abre Google Maps y mantén pulsado justo donde está la peña para poner un marcador.</li>
          <li>Pulsa “Compartir” y “Copiar enlace”; pega ese enlace en el campo de URL.</li>
          <li>
            En la ficha del marcador aparecen dos números, por ejemplo “37.717352, -1.17391”.
            Cópialos en el mismo orden en Coordenadas.
          </li>
          <li>Guarda y comprueba el botón de la portada. No hará falta tocar el código.</li>
        </ol>
      </details>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {guardado && !error && !pendiente && (
        <p role="status" className="mt-3 text-sm text-white/60">
          Ubicación guardada y portada actualizada.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-5 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-50"
        >
          {pendiente ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={18} aria-hidden="true" />
          )}
          {pendiente ? "Guardando…" : "Guardar ubicación"}
        </button>
        <a
          href={enlacePrueba}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm transition-colors duration-200 hover:bg-white/10"
        >
          <ExternalLink size={17} aria-hidden="true" />
          Probar enlace
        </a>
      </div>
    </form>
  );
}
