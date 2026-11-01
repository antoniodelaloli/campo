import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes, favicon, el service worker, el manifiesto
    // de la app, el aviso diario (lo llama el cron de Vercel, sin sesión) y el conector
    // para ChatGPT/Claude (/api/mcp y /.well-known: van con su propio token).
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|api/avisos/diario|api/mcp|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
