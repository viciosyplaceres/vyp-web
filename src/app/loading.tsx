import Image from "next/image";

/** Respuesta visual inmediata mientras una ruta dinámica termina de llegar. */
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16" role="status">
      <div className="flex flex-col items-center gap-3 text-sm text-white/50">
        <Image
          src="/logo/vyp-logo-192.png"
          alt=""
          width={80}
          height={80}
          unoptimized
          priority
          className="vyp-loader-logo h-20 w-20"
        />
        <span className="sr-only">Cargando…</span>
      </div>
    </main>
  );
}
