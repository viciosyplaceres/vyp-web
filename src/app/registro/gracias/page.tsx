import Link from "next/link";

export default function GraciasRegistroPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Cuenta creada</h1>
        <p className="text-white/70">
          Revisa tu correo para confirmar la cuenta. Después, un miembro de la
          directiva debe aprobarte antes de que puedas subir contenido o
          comentar — mientras tanto puedes ver toda la galería y escuchar toda
          la música.
        </p>
        <Link href="/" className="underline">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
