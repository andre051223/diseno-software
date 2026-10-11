import Link from "next/link";
import { aceptarParticularAccion } from "@/acciones/citas";
import { Alerta } from "@/components/ui/alerta";
import { EnlaceBoton } from "@/components/ui/boton";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { nombresResultadoCobertura } from "@/lib/etiquetas";
import { rutaDetalleCita } from "@/lib/rutas-citas";
import type { UsuarioActual } from "@/lib/sesion";
import { evaluarCambio, type CitaDetallada } from "@/servicios/agendamiento";
import { BotonImprimir } from "./boton-imprimir";
import { ComprobanteCita } from "./comprobante-cita";
import { FormularioCancelacion } from "./formularios-cita";

function AvisoAccion({ aviso, cita }: { aviso?: string; cita: CitaDetallada }) {
  if (aviso === "creada") {
    return cita.estado === "pendiente_validacion" ? (
      <Alerta tipo="advertencia" titulo="Cita agendada, pendiente de validación">
        La aseguradora no respondió a tiempo. La cita quedó reservada y seguiremos intentando validar la cobertura en
        segundo plano. Guarde el código {cita.codigo}.
      </Alerta>
    ) : (
      <Alerta tipo="exito" titulo="Cita agendada">
        La cita quedó agendada con el código {cita.codigo}. Puede imprimir el comprobante.
      </Alerta>
    );
  }
  if (aviso === "reprogramada") {
    return (
      <Alerta tipo="exito" titulo="Cita reprogramada">
        La cita cambió al nuevo horario y el anterior quedó libre. El código no cambia.
      </Alerta>
    );
  }
  if (aviso === "cancelada") {
    return (
      <Alerta tipo="exito" titulo="Cita cancelada">
        La cita se canceló y el horario quedó disponible para otros pacientes.
      </Alerta>
    );
  }
  return null;
}

/** Detalle de la cita con su comprobante (RF-15) y las opciones de reprogramar y cancelar (RF-16, RF-17). */
export function PaginaDetalleCita({
  actor,
  cita,
  aviso,
  volver,
}: {
  actor: UsuarioActual;
  cita: CitaDetallada;
  aviso?: string;
  volver: { href: string; texto: string };
}) {
  const evaluacion = evaluarCambio({ estado: cita.estado, inicio: cita.espacio.inicio }, actor.rol);
  const rechazadaPendiente =
    cita.estado === "pendiente_validacion" &&
    (cita.resultadoCobertura === "sin_vigencia" || cita.resultadoCobertura === "sin_cobertura");

  return (
    <>
      <Link href={volver.href} className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4 no-imprimir">
        ← {volver.texto}
      </Link>
      <div className="no-imprimir">
        <EncabezadoPagina titulo={`Cita ${cita.codigo}`} acciones={<BotonImprimir />} />
      </div>

      <div className="space-y-6">
        <div className="no-imprimir space-y-4 empty:hidden">
          <AvisoAccion aviso={aviso} cita={cita} />

          {/* RF-22: la aseguradora rechazó la cobertura después de agendar; se decide si sigue como particular. */}
          {rechazadaPendiente ? (
            <Alerta tipo="advertencia" titulo={nombresResultadoCobertura[cita.resultadoCobertura!]}>
              <p>{cita.detalleCobertura}</p>
              <p className="mt-2">
                Puede mantener la cita como particular (el paciente asume el valor de la consulta) o cancelarla.
              </p>
              <form action={aceptarParticularAccion} className="mt-3">
                <input type="hidden" name="citaId" value={cita.id} />
                <BotonEnviar textoEnviando="Guardando…">Agendar como particular</BotonEnviar>
              </form>
            </Alerta>
          ) : null}

          {cita.estado === "pendiente_validacion" && cita.resultadoCobertura === "sin_respuesta" ? (
            <Alerta tipo="info" titulo="Validación de cobertura en curso">
              La aseguradora no ha respondido. Seguimos intentando validar la cobertura en segundo plano.
            </Alerta>
          ) : null}

          {cita.estado === "cancelada" && cita.motivoCancelacion ? (
            <Alerta tipo="info" titulo="Motivo de la cancelación">
              {cita.motivoCancelacion}
            </Alerta>
          ) : null}
        </div>

        <ComprobanteCita cita={cita} />

        <div className="no-imprimir">
          {evaluacion.permitido ? (
            <Tarjeta titulo="Reprogramar o cancelar">
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-slate-700">Elija un nuevo horario; el actual se libera al confirmar el cambio.</p>
                  <EnlaceBoton href={`${rutaDetalleCita(actor.rol, cita.id)}/reprogramar`} variante="secundario">
                    Reprogramar
                  </EnlaceBoton>
                </div>
                <div className="border-t border-slate-200 pt-6">
                  <FormularioCancelacion citaId={cita.id} />
                </div>
              </div>
            </Tarjeta>
          ) : evaluacion.motivo === "requiere-recepcion" ? (
            // RF-17: con menos de 24 horas el paciente debe comunicarse con recepción.
            <Alerta tipo="advertencia" titulo="Comuníquese con recepción">
              {evaluacion.mensaje}
            </Alerta>
          ) : null}
        </div>
      </div>
    </>
  );
}
