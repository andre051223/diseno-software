import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Citas médicas | Hospital Central San Rafael",
    template: "%s | Hospital Central San Rafael",
  },
  description:
    "Sistema de gestión de citas médicas del Hospital Central San Rafael: agende, confirme, reprograme o cancele sus citas en línea.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f4f5c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-petroleo-800"
        >
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
