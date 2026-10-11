"use client";

import { useActionState } from "react";
import { Alerta } from "@/components/ui/alerta";
import type { VarianteBoton } from "@/components/ui/boton";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { estadoInicial, type EstadoFormulario } from "@/lib/validaciones/comunes";

/** Botón de una acción sobre una cita (llegada o atención) que muestra el resultado junto al botón. */
export function BotonAccionCita({
  accion,
  citaId,
  texto,
  textoEnviando,
  detalle,
  variante = "primario",
}: {
  accion: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  citaId: number;
  texto: string;
  textoEnviando: string;
  /** Texto adicional para lectores de pantalla, por ejemplo el nombre del paciente. */
  detalle?: string;
  variante?: VarianteBoton;
}) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="citaId" value={citaId} />
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      <BotonEnviar variante={variante} textoEnviando={textoEnviando}>
        {texto}
        {detalle ? <span className="sr-only"> {detalle}</span> : null}
      </BotonEnviar>
    </form>
  );
}
