import type { Metadata, Viewport } from "next";
import { GeistPixelSquare } from "geist/font/pixel";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campo",
  description: "Gestión interna de fincas",
};

export const viewport: Viewport = {
  themeColor: "#8a5a2b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`h-full antialiased ${GeistPixelSquare.variable}`}>
      <head>
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
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
