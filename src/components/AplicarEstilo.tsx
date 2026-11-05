"use client";

import { useEffect } from "react";

/**
 * Pone el estilo del usuario («granja» o «sobrio») en <html data-estilo>, y lo
 * guarda en una cookie para que la próxima vez salga bien desde el primer
 * momento (lo lee un script en layout.tsx antes de pintar).
 */
export function AplicarEstilo({ estilo }: { estilo: "granja" | "sobrio" }) {
  useEffect(() => {
    document.documentElement.dataset.estilo = estilo;
    if (!document.cookie.includes(`campo_estilo=${estilo}`)) {
      document.cookie = `campo_estilo=${estilo}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [estilo]);
  return null;
}
