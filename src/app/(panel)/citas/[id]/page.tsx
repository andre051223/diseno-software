import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDetalleCita } from "@/components/citas/pagina-detalle-cita";
import { nombrePaciente } from "@/lib/etiquetas";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Detalle de la cita" };

// RF-15 a RF-17: comprobante, reprogramación y cancelación desde recepción o el centro de llamadas.
export default async function PaginaCitaPersonal({ params, searchParams }: PageProps<"/citas/[id]">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const { id } = await params;
  const { aviso } = await searchParams;
  const cita = await obtenerCita(Number(id) || 0);
  if (!cita) notFound();

  return (
    <PaginaDetalleCita
      actor={usuario}
      cita={cita}
      aviso={typeof aviso === "string" ? aviso : undefined}
      volver={{ href: `/pacientes/${cita.pacienteId}`, texto: `Volver a la ficha de ${nombrePaciente(cita.paciente)}` }}
    />
  );
}
