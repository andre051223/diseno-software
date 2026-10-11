import type { Metadata } from "next";
import Link from "next/link";
import { ResumenEspacio } from "@/components/citas/resumen-espacio";
import { Alerta } from "@/components/ui/alerta";
import { EstadoVacio, Insignia, Tarjeta } from "@/components/ui/estructura";
import { estadosCita } from "@/lib/etiquetas";
import { obtenerCitaPorToken, opcionesRespuesta } from "@/servicios/recordatorios";
import { FormularioCancelarDesdeRecordatorio, FormularioConfirmarAsistencia } from "./formularios-respuesta";

export const metadata: Metadata = { title: "Responder recordatorio", robots: { index: false, follow: false } };

function Contenedor({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">{children}</div>;
}

/**
 * RF-25 y RF-26: el paciente abre el enlace del recordatorio y confirma o cancela su cita
 * sin iniciar sesión. El enlace solo muestra la cita; el cambio se hace con el botón, para
 * que abrir el enlace no modifique nada por sí solo.
 */
export default async function PaginaResponderCita({ params, searchParams }: PageProps<"/responder-cita/[token]">) {
  const { token } = await params;
  const { accion, resultado } = await searchParams;
  const cita = await obtenerCitaPorToken(token);

  if (!cita) {
    return (
      <Contenedor>
        <h1 className="text-2xl font-bold sm:text-3xl">Responder recordatorio</h1>
        <EstadoVacio titulo="El enlace no es válido">
          Revise que haya copiado el enlace completo del mensaje o comuníquese con la línea de citas.
        </EstadoVacio>
      </Contenedor>
    );
  }

  const opciones = opcionesRespuesta(cita);
  const estado = estadosCita[cita.estado];
  const quiereCancelar = accion === "cancelar";

  return (
    <Contenedor>
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Su cita {cita.codigo}</h1>
        <p className="mt-1 text-slate-700">Revise los datos y confirme su asistencia o cancele la cita.</p>
      </div>

      {resultado === "confirmada" ? (
        <Alerta tipo="exito" titulo="Asistencia confirmada">
          Gracias por confirmar. Le enviamos la confirmación por correo y SMS. Llegue 20 minutos antes con su documento.
        </Alerta>
      ) : null}
      {resultado === "cancelada" ? (
        <Alerta tipo="exito" titulo="Cita cancelada">
          La cita se canceló y el horario quedó disponible para otros pacientes. Si necesita una nueva cita, ingrese al
          portal o comuníquese con la línea de citas.
        </Alerta>
      ) : null}

      <Tarjeta>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-700">Estado:</span>
          <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
        </div>
        <ResumenEspacio espacio={cita.espacio} especialidad={cita.especialidad.nombre} paciente={cita.paciente.nombres} />
      </Tarjeta>

      {opciones.puedeConfirmar && !quiereCancelar ? (
        <Tarjeta titulo="¿Asistirá a la cita?">
          <FormularioConfirmarAsistencia token={token} />
        </Tarjeta>
      ) : null}

      {opciones.puedeCancelar ? (
        <Tarjeta titulo={quiereCancelar ? "Cancelar la cita" : "¿No puede asistir?"}>
          <FormularioCancelarDesdeRecordatorio token={token} />
          {quiereCancelar && opciones.puedeConfirmar ? (
            <p className="mt-4">
              <Link
                href={`/responder-cita/${token}?accion=confirmar`}
                className="font-semibold text-petroleo-700 underline underline-offset-4"
              >
                Prefiero confirmar mi asistencia
              </Link>
            </p>
          ) : null}
        </Tarjeta>
      ) : opciones.avisoCancelacion ? (
        // RF-17: con menos de 24 horas el paciente debe comunicarse con recepción.
        <Alerta tipo="advertencia" titulo="Cancelación por recepción">
          {opciones.avisoCancelacion} Línea de citas: (601) 555 0100.
        </Alerta>
      ) : null}

      {!opciones.puedeConfirmar && !opciones.puedeCancelar && !opciones.avisoCancelacion && !resultado ? (
        <Alerta tipo="info" titulo="No hay acciones pendientes">
          Esta cita ya no admite cambios desde el recordatorio. Si tiene dudas, comuníquese con la línea de citas.
        </Alerta>
      ) : null}
    </Contenedor>
  );
}
