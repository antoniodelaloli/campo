import type { MetadataRoute } from "next";

// Permite instalar Campo como app (icono en la pantalla de inicio).
// En iPhone es imprescindible instalarla para recibir avisos.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Campo · fincas",
    short_name: "Campo",
    description: "Gestión interna de las fincas: tareas, agua, tratamientos, cosecha y fechas clave.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff8e2",
    theme_color: "#8a5a2b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
