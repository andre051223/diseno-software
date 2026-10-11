import type { ReactNode } from "react";

/** Título de la página con descripción y acciones opcionales. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{titulo}</h1>
        {descripcion ? <p className="mt-1 max-w-3xl text-slate-700">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}

export function Tarjeta({
  titulo,
  children,
  className = "",
}: {
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}>
      {titulo ? <h2 className="mb-4 text-xl font-semibold">{titulo}</h2> : null}
      {children}
    </section>
  );
}

/** Mensaje para listas o consultas sin resultados. */
export function EstadoVacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-lg font-semibold text-slate-800">{titulo}</p>
      {children ? <div className="mt-2 text-slate-700">{children}</div> : null}
    </div>
  );
}

/** Indicador de carga accesible. */
export function Cargando({ texto = "Cargando información…" }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 p-8 text-slate-700">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-petroleo-200 border-t-petroleo-700"
      />
      {texto}
    </div>
  );
}

/** Contenedor de tablas con desplazamiento horizontal en pantallas pequeñas. */
export function ContenedorTabla({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div
      className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white"
      role="region"
      aria-label={etiqueta}
      tabIndex={0}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export const clasesEncabezadoTabla =
  "border-b border-slate-200 bg-petroleo-50 px-4 py-3 text-sm font-semibold text-petroleo-900";
export const clasesCeldaTabla = "border-b border-slate-100 px-4 py-3 align-top";

export function Insignia({
  children,
  tono = "neutro",
}: {
  children: ReactNode;
  tono?: "neutro" | "exito" | "advertencia" | "peligro" | "info";
}) {
  const tonos = {
    neutro: "bg-slate-100 text-slate-800 border-slate-300",
    exito: "bg-green-50 text-green-900 border-green-700",
    advertencia: "bg-amber-50 text-amber-950 border-amber-600",
    peligro: "bg-red-50 text-red-900 border-red-700",
    info: "bg-petroleo-50 text-petroleo-900 border-petroleo-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${tonos[tono]}`}>
      {children}
    </span>
  );
}
