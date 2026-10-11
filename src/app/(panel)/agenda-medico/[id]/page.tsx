import { differenceInYears } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { finalizarAtencionAccion, iniciarAtencionAccion } from "@/acciones/atencion";
import { BotonAccionCita } from "@/components/atencion/boton-accion-cita";
import { Alerta } from "@/components/ui/alerta";
import { EncabezadoPagina, Insignia, Tarjeta } from "@/components/ui/estructura";
import { estadosCita, nombrePaciente, nombresResultadoCobertura, nombresTipoDocumento } from "@/lib/etiquetas";
import { formatearFecha, formatearHora } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { citaDelMedico, estadosEsperandoLlegada } from "@/servicios/atencion";

export const metadata: Metadata = { title: "Detalle de la atención" };

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-600">{etiqueta}</dt>
      <dd className="text-lg">{children}</dd>
    </div>
  );
}

// RF-30: el médico registra el inicio y el fin de la atención y consulta la historia clínica (simulada).
export default async function PaginaAtencion({ params }: PageProps<"/agenda-medico/[id]">) {
  const usuario = await requerirRol("medico");
  const { id } = await params;
  if (!usuario.medicoId) notFound();
  const cita = await citaDelMedico(Number(id) || 0, usuario.medicoId);
  if (!cita) notFound();

  const { paciente } = cita;
  const estado = estadosCita[cita.estado];
  const cobertura = cita.esParticular
    ? "Particular"
    : cita.resultadoCobertura
      ? `${paciente.aseguradora.nombre}: ${nombresResultadoCobertura[cita.resultadoCobertura].toLowerCase()}`
      : paciente.aseguradora.nombre;

  return (
    <>
      <Link href="/agenda-medico" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a la agenda del día
      </Link>
      <EncabezadoPagina
        titulo={nombrePaciente(paciente)}
        descripcion={`Cita ${cita.codigo} · ${formatearFecha(cita.espacio.inicio)} a las ${formatearHora(cita.espacio.inicio)} · ${cita.espacio.consultorio.nombre}`}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Tarjeta titulo="Paciente">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dato etiqueta="Documento">
                {nombresTipoDocumento[paciente.tipoDocumento]} {paciente.numeroDocumento}
              </Dato>
              <Dato etiqueta="Edad">{differenceInYears(new Date(), paciente.fechaNacimiento)} años</Dato>
              <Dato etiqueta="Teléfono">{paciente.telefono}</Dato>
              <Dato etiqueta="Cobertura">{cobertura}</Dato>
            </dl>
            <p className="mt-4">
              <Link
                href={`/historia-clinica/${paciente.id}`}
                className="font-semibold text-petroleo-700 underline underline-offset-4"
              >
                Abrir historia clínica (sistema externo simulado)
              </Link>
            </p>
          </Tarjeta>

          <Tarjeta titulo="Cita">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <Dato etiqueta="Estado">
                <Insignia tono={estado.tono}>{estado.etiqueta}</Insignia>
              </Dato>
              <Dato etiqueta="Especialidad">{cita.especialidad.nombre}</Dato>
              <Dato etiqueta="Hora de llegada">{cita.horaLlegada ? formatearHora(cita.horaLlegada) : "Sin registrar"}</Dato>
              <Dato etiqueta="Inicio de la atención">
                {cita.inicioAtencion ? formatearHora(cita.inicioAtencion) : "Sin registrar"}
              </Dato>
              <Dato etiqueta="Fin de la atención">{cita.finAtencion ? formatearHora(cita.finAtencion) : "Sin registrar"}</Dato>
            </dl>
          </Tarjeta>
        </div>

        <Tarjeta titulo="Atención">
          {cita.estado === "en_sala" && !cita.inicioAtencion ? (
            <div className="space-y-3">
              <p className="text-slate-700">El paciente está en sala de espera.</p>
              <BotonAccionCita
                accion={iniciarAtencionAccion}
                citaId={cita.id}
                texto="Iniciar atención"
                textoEnviando="Registrando…"
              />
            </div>
          ) : cita.estado === "en_sala" && cita.inicioAtencion ? (
            <div className="space-y-3">
              <p className="text-slate-700">Atención en curso desde las {formatearHora(cita.inicioAtencion)}.</p>
              <BotonAccionCita
                accion={finalizarAtencionAccion}
                citaId={cita.id}
                texto="Finalizar atención"
                textoEnviando="Registrando…"
              />
            </div>
          ) : cita.estado === "atendida" ? (
            <Alerta tipo="exito" titulo="Cita atendida">
              La atención quedó registrada.
            </Alerta>
          ) : estadosEsperandoLlegada.includes(cita.estado) ? (
            <Alerta tipo="info" titulo="El paciente aún no ha llegado">
              La recepción debe registrar su llegada para poder iniciar la atención.
            </Alerta>
          ) : (
            <Alerta tipo="info" titulo={estado.etiqueta}>
              Esta cita no requiere atención.
            </Alerta>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
