import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-4 text-xs uppercase tracking-[0.35em] text-white/50">
        Fuente Álamo &middot; Murcia
      </p>
      <Image
        src="/logo/vyp-wordmark.png"
        alt="Vicios & Placeres"
        width={480}
        height={155}
        priority
        className="h-auto w-full max-w-md"
      />
      <p className="mt-8 max-w-md text-base text-white/60">
        Estamos preparando la web de la peña: galería de fotos, música y
        gestión de las fiestas. Vuelve pronto.
      </p>
      <div className="mt-10 h-px w-16 bg-white/20" />
    </div>
  );
}
