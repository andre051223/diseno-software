import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaReprogramar } from "@/components/citas/pagina-reprogramar";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Reprogramar cita" };

// RF-16: el paciente busca un nuevo horario para su cita.
export default async function PaginaReprogramarPaciente({ params, searchParams }: PageProps<"/mis-citas/[id]/reprogramar">) {
  const usuario = await requerirRol("paciente");
  const { id } = await params;
  const cita = await obtenerCita(Number(id) || 0);
  if (!cita || cita.pacienteId !== usuario.pacienteId) notFound();

  return <PaginaReprogramar actor={usuario} cita={cita} parametros={await searchParams} />;
}
