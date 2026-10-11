"use client";

import { useActionState } from "react";
import {
  confirmarCitaAccion,
  rechazarParticularAccion,
  validarCoberturaAccion,
  type EstadoCobertura,
} from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { nombresResultadoCobertura } from "@/lib/etiquetas";

const inicial: EstadoCobertura = {};

/**
 * Pasos 4 y 5 del asistente.
 * RF-21: consulta a la aseguradora antes de confirmar.
 * RF-22: sin vigencia o cobertura, muestra el motivo y la opción de agendar como particular.
 * RF-23: si la aseguradora no responde a tiempo, la cita se confirma como pendiente de validación.
 */
export function ConfirmacionCita({
  espacioId,
  especialidadId,
  pacienteId,
  aseguradora,
}: {
  espacioId: number;
  especialidadId: number;
  pacienteId?: number;
  aseguradora: string;
}) {
  const [cobertura, validar, validando] = useActionState(validarCoberturaAccion, inicial);
  const [confirmacion, confirmar] = useActionState(confirmarCitaAccion, inicial);
  const resultado = cobertura.resultado;

  return (
    <div className="space-y-4">
      {!resultado ? (
        <form action={validar} className="space-y-4">
          <input type="hidden" name="espacioId" value={espacioId} />
          <input type="hidden" name="especialidadId" value={especialidadId} />
          {pacienteId ? <input type="hidden" name="pacienteId" value={pacienteId} /> : null}
          <p>
            Antes de confirmar consultamos a <strong>{aseguradora}</strong> la vigencia de la afiliación y la cobertura
            para la especialidad.
          </p>
          {cobertura.error ? <Alerta tipo="error">{cobertura.error}</Alerta> : null}
          <div aria-live="polite">
            {validando ? (
              <p className="text-slate-700">Consultando a la aseguradora; puede tardar hasta 10 segundos…</p>
            ) : null}
          </div>
          <BotonEnviar textoEnviando="Consultando a la aseguradora…">Validar cobertura</BotonEnviar>
        </form>
      ) : (
        <>
          {resultado === "cubierta" ? (
            <Alerta tipo="exito" titulo="Cobertura verificada">
              {cobertura.detalle}
            </Alerta>
          ) : resultado === "sin_respuesta" ? (
            <Alerta tipo="advertencia" titulo={nombresResultadoCobertura.sin_respuesta}>
              {cobertura.detalle} Puede confirmar la cita; le avisaremos si hay algún inconveniente con la cobertura.
            </Alerta>
          ) : (
            <Alerta tipo="advertencia" titulo={nombresResultadoCobertura[resultado]}>
              <p>{cobertura.detalle}</p>
              <p className="mt-2">
                Puede agendar la cita como particular (el paciente asume el valor de la consulta) o no agendarla.
              </p>
            </Alerta>
          )}

          {confirmacion.error ? <Alerta tipo="error">{confirmacion.error}</Alerta> : null}

          <div className="flex flex-wrap gap-3">
            <form action={confirmar}>
              <input type="hidden" name="token" value={cobertura.token} />
              {resultado === "sin_vigencia" || resultado === "sin_cobertura" ? (
                <>
                  <input type="hidden" name="particular" value="si" />
                  <BotonEnviar textoEnviando="Confirmando…">Agendar como particular</BotonEnviar>
                </>
              ) : (
                <BotonEnviar textoEnviando="Confirmando…">
                  {resultado === "sin_respuesta" ? "Confirmar cita pendiente de validación" : "Confirmar cita"}
                </BotonEnviar>
              )}
            </form>
            {resultado === "sin_vigencia" || resultado === "sin_cobertura" ? (
              <form action={rechazarParticularAccion}>
                <input type="hidden" name="token" value={cobertura.token} />
                <BotonEnviar variante="secundario" textoEnviando="Procesando…">
                  No agendar
                </BotonEnviar>
              </form>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
