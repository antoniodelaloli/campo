import type { Metadata, Viewport } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campo",
  description: "Gestión interna de fincas",
  applicationName: "Campo",
  // iPhone: al añadirla a la pantalla de inicio se abre como app (necesario para los avisos)
  appleWebApp: { capable: true, title: "Campo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#8a5a2b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`h-full antialiased ${GeistPixelSquare.variable}`} suppressHydrationWarning>
      <head>
        {/* estilo del usuario (granja / sobrio) antes de pintar, desde la cookie: sin parpadeo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var m=document.cookie.match(/(?:^|; )campo_estilo=(sobrio|granja)/);if(m)document.documentElement.dataset.estilo=m[1]}catch(e){}`,
          }}
        />
        {/* Texto normal: Nunito (Google Fonts). Títulos: Geist Pixel, servida por la propia app. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- layout raíz: carga en todas las páginas */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
