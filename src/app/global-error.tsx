"use client";

import "./globals.css";
import { PiePagina } from "@/components/pie-pagina";

export default function ErrorGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col">
        <main id="contenido" className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
          <h1 className="text-3xl font-bold">Ocurrió un error inesperado</h1>
          <p className="mt-3 text-slate-700">Intente de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 min-h-11 rounded-lg bg-acento-600 px-4 py-2 font-semibold text-white"
          >
            Intentar de nuevo
          </button>
        </main>
        <PiePagina />
      </body>
    </html>
  );
}
