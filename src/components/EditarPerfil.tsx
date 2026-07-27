"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import Avatar from "./Avatar";
import { guardarPerfil } from "@/app/actions/perfil";

export default function EditarPerfil({
  nombre,
  usuario,
  avatarUrl,
}: {
  nombre: string | null;
  usuario: string | null;
  avatarUrl: string | null;
}) {
  const [estado, accion, pendiente] = useActionState(guardarPerfil, null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [subiendo, setSubiendo] = useState(false);
  const [errorAvatar, setErrorAvatar] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cambiarAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const fichero = e.target.files?.[0];
    e.target.value = "";
    if (!fichero) return;

    setErrorAvatar(null);
    setSubiendo(true);
    try {
      const resFirma = await fetch("/api/cloudinary/firma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "avatar" }),
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

      const subida = await fetch(
        `https://api.cloudinary.com/v1_1/${firma.cloudName}/image/upload`,
        { method: "POST", body: datos },
      );
      if (!subida.ok) throw new Error("No se pudo subir la foto.");

      const subido = await subida.json();
      // Recorte cuadrado y centrado en la cara: para un avatar es lo que toca.
      setAvatar(
        subido.secure_url.replace(
          "/upload/",
          "/upload/c_fill,g_face,w_400,h_400,q_auto,f_auto/",
        ),
      );
    } catch (err) {
      setErrorAvatar(err instanceof Error ? err.message : "Error al subir.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form action={accion} className="space-y-5">
      <input type="hidden" name="avatarUrl" value={avatar ?? ""} />

      <div className="flex items-center gap-4">
        <Avatar nombre={nombre} avatarUrl={avatar} tamano={72} />
        <div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/25 px-4 text-sm transition-colors duration-200 hover:bg-white/10 disabled:opacity-50"
          >
            {subiendo ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Camera size={16} aria-hidden="true" />
            )}
            {subiendo ? "Subiendo…" : "Cambiar foto"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={cambiarAvatar}
          />
          {errorAvatar && (
            <p role="alert" className="mt-1 text-xs text-red-400">
              {errorAvatar}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="nombrePerfil" className="text-sm text-white/70">
          Nombre
        </label>
        <input
          id="nombrePerfil"
          name="nombre"
          defaultValue={nombre ?? ""}
          required
          maxLength={60}
          className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="usuarioPerfil" className="text-sm text-white/70">
          Nombre de usuario
        </label>
        <input
          id="usuarioPerfil"
          name="usuario"
          defaultValue={usuario ?? ""}
          maxLength={20}
          placeholder="sin espacios ni acentos"
          className="min-h-[48px] w-full rounded-lg border border-white/20 bg-white/5 px-3 text-base outline-none focus:border-white"
        />
        <p className="text-xs text-white/40">
          Entre 3 y 20 caracteres. Solo letras, números, punto y guion bajo.
        </p>
      </div>

      {estado?.error && (
        <p role="alert" className="text-sm text-red-400">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p aria-live="polite" className="text-sm text-white/70">
          Guardado.
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente || subiendo}
        className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-full bg-white px-6 font-medium text-black transition-opacity duration-200 hover:opacity-85 disabled:opacity-40 sm:w-auto"
      >
        {pendiente ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}
