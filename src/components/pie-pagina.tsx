import Link from "next/link";

/** Pie de página común a todas las secciones de la plataforma. */
export function PiePagina() {
  return (
    <footer className="border-t border-slate-200 bg-white no-imprimir">
      <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-slate-700">
        <p>Diego Andrés Lopez Rodriguez - Diseño de Software - Fundación Universitaria del Área Andina</p>
        <p className="mt-1">
          Proyecto Académico | 2026 |{" "}
          <Link href="/diseno-uml" className="font-semibold text-petroleo-700 underline underline-offset-2 hover:text-petroleo-900">
            Diseño UML
          </Link>
        </p>
      </div>
    </footer>
  );
}
