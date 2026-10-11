"use client";

import { Boton } from "@/components/ui/boton";

/** RF-15: imprime el comprobante de la cita (la navegación se oculta al imprimir). */
export function BotonImprimir({ texto = "Imprimir comprobante" }: { texto?: string }) {
  return (
    <Boton variante="secundario" className="no-imprimir" onClick={() => window.print()}>
      {texto}
    </Boton>
  );
}
