import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const segmentoGaleria = path.match(/^\/galeria\/([^/]+)(?:\/|$)/)?.[1];
  if (segmentoGaleria) {
    const anio = Number(segmentoGaleria);
    if (!/^\d{4}$/.test(segmentoGaleria) || anio < 2010 || anio > 2100) {
      const url = request.nextUrl.clone();
      url.pathname = "/_not-found";
      return NextResponse.rewrite(url, { status: 404 });
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No ejecutar código entre createServerClient y getClaims(): rompería el
  // refresco de sesión y provocaría cierres de sesión aleatorios.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Se clonan después de getClaims() para incluir cualquier cookie que Auth
  // haya refrescado mediante setAll(). La identidad entrante nunca se reenvía.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-vyp-user-id");
  if (typeof user?.sub === "string") {
    requestHeaders.set("x-vyp-user-id", user.sub);
  }

  const rutaProtegida =
    path.startsWith("/admin") || path.startsWith("/perfil");

  if (!user && rutaProtegida) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
