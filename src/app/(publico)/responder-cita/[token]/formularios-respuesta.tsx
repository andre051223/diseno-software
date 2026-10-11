"use client";

import { useActionState } from "react";
import { cancelarRecordatorioAccion, confirmarRecordatorioAccion } from "@/acciones/recordatorios";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { AreaTexto } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-26: confirmación de asistencia desde el recordatorio. */
export function FormularioConfirmarAsistencia({ token }: { token: string }) {
  const [estado, accion] = useActionState(confirmarRecordatorioAccion, estadoInicial);
  return (
    <form action={accion} className="space-y-4">
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="token" value={token} />
      <BotonEnviar textoEnviando="Confirmando…">Confirmar asistencia</BotonEnviar>
    </form>
  );
}

/** RF-26 y RF-17: cancelación desde el recordatorio con el motivo obligatorio. */
export function FormularioCancelarDesdeRecordatorio({ token }: { token: string }) {
  const [estado, accion] = useActionState(cancelarRecordatorioAccion, estadoInicial);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="token" value={token} />
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
