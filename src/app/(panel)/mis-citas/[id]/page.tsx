import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDetalleCita } from "@/components/citas/pagina-detalle-cita";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Detalle de la cita" };

// RF-15 a RF-17: comprobante, reprogramación y cancelación de una cita del paciente.
export default async function PaginaCitaPaciente({ params, searchParams }: PageProps<"/mis-citas/[id]">) {
  const usuario = await requerirRol("paciente");
  const { id } = await params;
  const { aviso } = await searchParams;
  const cita = await obtenerCita(Number(id) || 0);
  // Cada paciente solo ve sus propias citas.
  if (!cita || cita.pacienteId !== usuario.pacienteId) notFound();

  return (
    <PaginaDetalleCita
      actor={usuario}
      cita={cita}
      aviso={typeof aviso === "string" ? aviso : undefined}
      volver={{ href: "/mis-citas", texto: "Volver a mis citas" }}
    />
  );
}
