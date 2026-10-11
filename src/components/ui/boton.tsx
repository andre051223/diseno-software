import Link from "next/link";
import type { ComponentProps } from "react";

export type VarianteBoton = "primario" | "secundario" | "peligro" | "discreto" | "claro";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const variantes: Record<VarianteBoton, string> = {
  primario: "bg-acento-600 text-white hover:bg-acento-700",
  secundario:
    "border border-petroleo-600 bg-white text-petroleo-700 hover:bg-petroleo-50",
  peligro: "bg-red-700 text-white hover:bg-red-800",
  discreto: "text-petroleo-700 underline-offset-4 hover:bg-petroleo-50 hover:underline",
  // Para fondos oscuros (azul petróleo).
  claro: "border border-white bg-transparent text-white hover:bg-petroleo-700",
};

export function clasesBoton(variante: VarianteBoton = "primario", extra = "") {
  return `${base} ${variantes[variante]} ${extra}`.trim();
}

type PropiedadesBoton = ComponentProps<"button"> & { variante?: VarianteBoton };

export function Boton({ variante = "primario", className = "", type = "button", ...resto }: PropiedadesBoton) {
  return <button type={type} className={clasesBoton(variante, className)} {...resto} />;
}

type PropiedadesEnlaceBoton = ComponentProps<typeof Link> & { variante?: VarianteBoton };

export function EnlaceBoton({ variante = "primario", className = "", ...resto }: PropiedadesEnlaceBoton) {
  return <Link className={clasesBoton(variante, className)} {...resto} />;
}
