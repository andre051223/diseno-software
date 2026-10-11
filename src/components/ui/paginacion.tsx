import Link from "next/link";

/** Navegación entre páginas de un listado conservando los filtros de la URL. */
export function Paginacion({
  pagina,
  totalPaginas,
  ruta,
  parametros,
}: {
  pagina: number;
  totalPaginas: number;
  ruta: string;
  parametros: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) return null;

  const enlace = (numero: number) => {
    const busqueda = new URLSearchParams();
    for (const [clave, valor] of Object.entries(parametros)) {
      if (valor) busqueda.set(clave, valor);
    }
    busqueda.set("pagina", String(numero));
    return `${ruta}?${busqueda.toString()}`;
  };

  const clases = "min-h-11 rounded-lg border border-petroleo-600 px-4 py-2 font-semibold text-petroleo-700 hover:bg-petroleo-50";

  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-slate-700">
        Página {pagina} de {totalPaginas}
      </p>
      <div className="flex gap-2">
        {pagina > 1 ? (
          <Link href={enlace(pagina - 1)} className={clases}>
            Anterior
          </Link>
        ) : null}
        {pagina < totalPaginas ? (
          <Link href={enlace(pagina + 1)} className={clases}>
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function leerPagina(valor: string | string[] | undefined): number {
  const numero = Number(typeof valor === "string" ? valor : 1);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}
