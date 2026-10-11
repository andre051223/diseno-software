import Link from "next/link";
import { Logo } from "@/components/logo";
import { PiePagina } from "@/components/pie-pagina";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav aria-label="Acceso" className="flex flex-wrap gap-2">
            <Link
              href="/iniciar-sesion"
              className="rounded-lg px-3 py-2 font-semibold text-petroleo-700 hover:bg-petroleo-50"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-acento-600 px-3 py-2 font-semibold text-white hover:bg-acento-700"
            >
              Registrarse
            </Link>
          </nav>
        </div>
      </header>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <PiePagina />
    </div>
  );
}
