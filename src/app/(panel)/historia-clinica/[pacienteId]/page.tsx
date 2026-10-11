import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alerta } from "@/components/ui/alerta";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { nombrePaciente, nombresTipoDocumento } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/fechas";
import { requerirRol } from "@/lib/sesion";
import { pacienteDelMedico } from "@/servicios/atencion";

export const metadata: Metadata = { title: "Historia clínica" };

/**
 * RF-30: enlace simulado a la historia clínica electrónica. La historia clínica completa
 * está fuera del alcance del proyecto; esta pantalla representa el sistema externo.
 */
export default async function PaginaHistoriaClinica({ params }: PageProps<"/historia-clinica/[pacienteId]">) {
  const usuario = await requerirRol("medico");
  const { pacienteId } = await params;
  if (!usuario.medicoId) notFound();
  // Solo los pacientes que tienen o tuvieron cita con el médico.
  const paciente = await pacienteDelMedico(Number(pacienteId) || 0, usuario.medicoId);
  if (!paciente) notFound();

  return (
    <>
      <Link href="/agenda-medico" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a la agenda del día
      </Link>
      <EncabezadoPagina titulo="Historia clínica electrónica" descripcion="Sistema externo simulado." />
      <div className="space-y-6">
        <Alerta tipo="info" titulo="Sistema externo">
          En la operación real, este enlace abre la historia clínica electrónica del hospital. Su contenido está fuera
          del alcance del sistema de citas.
        </Alerta>
        <Tarjeta titulo={nombrePaciente(paciente)}>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-slate-600">Documento</dt>
              <dd>
                {nombresTipoDocumento[paciente.tipoDocumento]} {paciente.numeroDocumento}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Fecha de nacimiento</dt>
              <dd>{formatearFecha(paciente.fechaNacimiento)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-slate-600">Aseguradora</dt>
              <dd>{paciente.aseguradora.nombre}</dd>
            </div>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
