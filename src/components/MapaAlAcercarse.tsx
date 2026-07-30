"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

export default function MapaAlAcercarse({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [cargar, setCargar] = useState(false);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || cargar) return;

    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setCargar(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setCargar(true);
        observer.disconnect();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(contenedor);
    return () => observer.disconnect();
  }, [cargar]);

  return (
    <div ref={contenedorRef} className="relative h-[320px] overflow-hidden sm:h-[420px]">
      {cargar ? (
        <iframe
          src={src}
          title={title}
          className="absolute inset-x-0 top-0 h-[calc(100%+44px)] w-full border-0 grayscale invert"
        />
      ) : (
        <div
          role="status"
          aria-label="El mapa se cargará al acercarse a esta sección"
          className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_65%)] text-white/35"
        >
          <MapPin size={28} aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
