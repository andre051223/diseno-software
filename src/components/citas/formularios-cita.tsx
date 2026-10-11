"use client";

import { useActionState } from "react";
import { cancelarCitaAccion, reprogramarCitaAccion } from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { AreaTexto } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-17: cancelación con el motivo obligatorio. */
export function FormularioCancelacion({ citaId }: { citaId: number }) {
  const [estado, accion] = useActionState(cancelarCitaAccion, estadoInicial);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="citaId" value={citaId} />
      <AreaTexto
        nombre="motivo"
        etiqueta="Motivo de la cancelación"
        required
        maxLength={300}
        defaultValue={estado.valores?.motivo ?? ""}
        errores={estado.errores?.motivo}
        ayuda="El horario quedará disponible para otros pacientes."
      />
      <BotonEnviar variante="peligro" textoEnviando="Cancelando…">
        Cancelar la cita
      </BotonEnviar>
    </form>
  );
}

/** RF-16: confirmación del cambio al nuevo horario. */
export function FormularioReprogramacion({ citaId, espacioId }: { citaId: number; espacioId: number }) {
  const [estado, accion] = useActionState(reprogramarCitaAccion, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="citaId" value={citaId} />
      <input type="hidden" name="espacioId" value={espacioId} />
      <BotonEnviar textoEnviando="Reprogramando…">Confirmar reprogramación</BotonEnviar>
    </form>
  );
}
