import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Variable con eje de tamaño óptico: el título de 30 px usa el corte de titular.
  weight: "variable",
  axes: ["opsz"],
});

const sans = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // El teclado virtual reduce el área visible en vez de taparla.
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: {
    default: "Grupo LRomero Importaciones",
    template: "%s | Grupo LRomero Importaciones",
  },
  description: "Plataforma de ventas, compras, inventario y caja de Grupo LRomero Importaciones.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
