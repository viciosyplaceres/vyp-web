import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "@/app/actions/auth";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let esAdmin = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("rol, aprobado")
      .eq("id", user.id)
      .single();
    esAdmin = perfil?.rol === "admin" && perfil?.aprobado === true;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo/vyp-wordmark.png"
            alt="Vicios & Placeres"
            width={220}
            height={71}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          {esAdmin && (
            <Link href="/admin/miembros" className="text-white/70 hover:text-white">
              Miembros
            </Link>
          )}
          {user ? (
            <form action={cerrarSesion}>
              <button type="submit" className="text-white/70 hover:text-white">
                Salir
              </button>
            </form>
          ) : (
            <Link href="/login" className="text-white/70 hover:text-white">
              Acceder
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
