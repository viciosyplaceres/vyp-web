"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type PistaReproducible = {
  id: string;
  titulo: string;
  artista: string | null;
  clave: string; // clave del objeto en R2
};

type EstadoReproductor = {
  actual: PistaReproducible | null;
  sonando: boolean;
  posicion: number;
  duracion: number;
  cola: PistaReproducible[];
  reproducir: (pista: PistaReproducible, cola?: PistaReproducible[]) => void;
  alternar: () => void;
  siguiente: () => void;
  anterior: () => void;
  buscar: (segundos: number) => void;
  cerrar: () => void;
};

const Contexto = createContext<EstadoReproductor | null>(null);

export function useReproductor() {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("useReproductor debe usarse dentro de ReproductorProvider");
  }
  return ctx;
}

export default function ReproductorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [actual, setActual] = useState<PistaReproducible | null>(null);
  const [cola, setCola] = useState<PistaReproducible[]>([]);
  const [sonando, setSonando] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [duracion, setDuracion] = useState(0);

  const reproducir = useCallback(
    (pista: PistaReproducible, nuevaCola?: PistaReproducible[]) => {
      setCola(nuevaCola?.length ? nuevaCola : [pista]);
      setActual(pista);
      setSonando(true);
    },
    [],
  );

  const alternar = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !actual) return;
    if (audio.paused) {
      void audio.play();
      setSonando(true);
    } else {
      audio.pause();
      setSonando(false);
    }
  }, [actual]);

  const saltar = useCallback(
    (delta: number) => {
      if (!actual) return;
      const i = cola.findIndex((p) => p.id === actual.id);
      const siguiente = cola[i + delta];
      if (siguiente) {
        setActual(siguiente);
        setSonando(true);
      }
    },
    [actual, cola],
  );

  const siguiente = useCallback(() => saltar(1), [saltar]);
  const anterior = useCallback(() => saltar(-1), [saltar]);

  const buscar = useCallback((segundos: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = segundos;
    setPosicion(segundos);
  }, []);

  const cerrar = useCallback(() => {
    audioRef.current?.pause();
    setActual(null);
    setSonando(false);
    setPosicion(0);
    setDuracion(0);
  }, []);

  // Al cambiar de pista, recarga la fuente y arranca.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !actual) return;
    audio.src = `/api/r2/reproducir?clave=${encodeURIComponent(actual.clave)}`;
    audio.load();
    if (sonando) {
      void audio.play().catch(() => setSonando(false));
    }
    // Solo debe dispararse cuando cambia la pista, no al pausar/reanudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual]);

  // Controles del sistema operativo (pantalla de bloqueo, auriculares).
  useEffect(() => {
    if (!actual || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: actual.titulo,
      artist: actual.artista ?? "Vicios & Placeres",
      album: "Vicios & Placeres",
    });
    navigator.mediaSession.setActionHandler("play", alternar);
    navigator.mediaSession.setActionHandler("pause", alternar);
    navigator.mediaSession.setActionHandler("nexttrack", siguiente);
    navigator.mediaSession.setActionHandler("previoustrack", anterior);
  }, [actual, alternar, siguiente, anterior]);

  const valor = useMemo(
    () => ({
      actual,
      sonando,
      posicion,
      duracion,
      cola,
      reproducir,
      alternar,
      siguiente,
      anterior,
      buscar,
      cerrar,
    }),
    [
      actual,
      sonando,
      posicion,
      duracion,
      cola,
      reproducir,
      alternar,
      siguiente,
      anterior,
      buscar,
      cerrar,
    ],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(e) => setPosicion(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration || 0)}
        onPlay={() => setSonando(true)}
        onPause={() => setSonando(false)}
        onEnded={siguiente}
      />
    </Contexto.Provider>
  );
}
