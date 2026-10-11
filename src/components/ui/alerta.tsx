import type { ReactNode } from "react";

export type TipoAlerta = "info" | "exito" | "advertencia" | "error";

const estilos: Record<TipoAlerta, { clases: string; titulo: string; simbolo: string }> = {
  info: { clases: "border-petroleo-300 bg-petroleo-50 text-petroleo-900", titulo: "Información", simbolo: "i" },
  exito: { clases: "border-green-700 bg-green-50 text-green-900", titulo: "Listo", simbolo: "✓" },
  advertencia: { clases: "border-amber-600 bg-amber-50 text-amber-950", titulo: "Atención", simbolo: "!" },
  error: { clases: "border-red-700 bg-red-50 text-red-900", titulo: "Error", simbolo: "✕" },
};

/** Mensaje destacado. El tipo se comunica con texto y símbolo, no solo con color. */
export function Alerta({
  tipo = "info",
  titulo,
  children,
}: {
  tipo?: TipoAlerta;
  titulo?: string;
  children: ReactNode;
}) {
  const estilo = estilos[tipo];
  return (
    <div
      role={tipo === "error" || tipo === "advertencia" ? "alert" : "status"}
      className={`flex gap-3 rounded-lg border-l-4 p-4 ${estilo.clases}`}
    >
      <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">
        {estilo.simbolo}
      </span>
      <div>
        <p className="font-semibold">{titulo ?? estilo.titulo}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
