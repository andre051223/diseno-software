import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaConfirmarReprogramacion } from "@/components/citas/pagina-reprogramar";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Confirmar reprogramación" };

// RF-16: el paciente confirma el cambio al nuevo horario.
export default async function PaginaConfirmarReprogramacionPaciente({
  params,
  searchParams,
}: PageProps<"/mis-citas/[id]/reprogramar/confirmar">) {
  const usuario = await requerirRol("paciente");
  const { id } = await params;
  const cita = await obtenerCita(Number(id) || 0);
  if (!cita || cita.pacienteId !== usuario.pacienteId) notFound();

  return <PaginaConfirmarReprogramacion actor={usuario} cita={cita} parametros={await searchParams} />;
}
