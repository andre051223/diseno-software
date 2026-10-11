"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ElementoMenu } from "@/lib/roles";

/** Menú del rol; marca la opción actual con aria-current y subrayado (no solo color). */
export function MenuNavegacion({ elementos }: { elementos: ElementoMenu[] }) {
  const ruta = usePathname();
  // Se marca la opción cuyo prefijo coincide de forma más específica con la ruta actual.
  const activa = elementos
    .filter((elemento) => ruta === elemento.href || ruta.startsWith(`${elemento.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Menú principal" className="bg-petroleo-800 no-imprimir">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
        {elementos.map((elemento) => {
          const esActiva = elemento.href === activa;
          return (
            <li key={elemento.href} className="shrink-0">
              <Link
                href={elemento.href}
                aria-current={esActiva ? "page" : undefined}
                className={`block border-b-4 px-3 py-3 font-medium whitespace-nowrap ${
                  esActiva
                    ? "border-acento-100 text-white"
                    : "border-transparent text-petroleo-100 hover:bg-petroleo-700 hover:text-white"
                }`}
              >
                {elemento.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
