import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada petición y redirige a /login
 * si no hay usuario autenticado.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // No pongas código entre createServerClient y getClaims().
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims);
  const esLogin = request.nextUrl.pathname.startsWith("/login");

  if (!autenticado && !esLogin) {
    const url = request.nextUrl.clone();
    // Se recuerda adónde iba (p. ej. la pantalla de permiso de ChatGPT/Claude)
    const destino = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.search = destino !== "/" ? `?siguiente=${encodeURIComponent(destino)}` : "";
    return NextResponse.redirect(url);
  }

  if (autenticado && esLogin) {
    return NextResponse.redirect(new URL(destinoSeguro(request.nextUrl.searchParams.get("siguiente")), request.url));
  }

  return response;
}

/** Solo rutas internas de la app (evita redirecciones a otras webs). */
export function destinoSeguro(siguiente: string | null | undefined) {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return "/";
  return siguiente;
}
