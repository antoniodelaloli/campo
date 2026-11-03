import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes, favicon, el service worker, el manifiesto
    // de la app, el aviso diario (lo llama el cron de Vercel, sin sesión) y el conector
    // para ChatGPT/Claude (/api/mcp y /.well-known) y los atajos de Siri (/api/atajos): van con su propio token o clave.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|api/avisos/diario|api/mcp|api/atajos|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
