import Image from "next/image";

/** Iniciales como respaldo cuando alguien todavía no ha puesto foto. */
function iniciales(nombre: string | null) {
  if (!nombre) return "?";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Avatar({
  nombre,
  avatarUrl,
  tamano = 36,
  className = "",
}: {
  nombre: string | null;
  avatarUrl?: string | null;
  tamano?: number;
  className?: string;
}) {
  const base = `shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10 ${className}`;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={nombre ? `Foto de ${nombre}` : "Avatar"}
        width={tamano}
        height={tamano}
        className={`${base} object-cover`}
        style={{ width: tamano, height: tamano }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} flex items-center justify-center font-medium text-white/70`}
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.38 }}
    >
      {iniciales(nombre)}
    </span>
  );
}
