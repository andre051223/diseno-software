"use client";

import { useFormStatus } from "react-dom";
import { clasesBoton, type VarianteBoton } from "./boton";

type Propiedades = {
  children: React.ReactNode;
  textoEnviando?: string;
  variante?: VarianteBoton;
  className?: string;
  name?: string;
  value?: string;
};

/** Botón de envío que se desactiva y muestra un texto mientras la acción se procesa. */
export function BotonEnviar({
  children,
  textoEnviando = "Procesando…",
  variante = "primario",
  className = "",
  name,
  value,
}: Propiedades) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={clasesBoton(variante, className)}
    >
      {pending ? textoEnviando : children}
    </button>
  );
}
