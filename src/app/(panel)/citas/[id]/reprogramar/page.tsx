import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaReprogramar } from "@/components/citas/pagina-reprogramar";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Reprogramar cita" };

// RF-16: recepción o el centro de llamadas buscan un nuevo horario para la cita.
export default async function PaginaReprogramarPersonal({ params, searchParams }: PageProps<"/citas/[id]/reprogramar">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const { id } = await params;
  const cita = await obtenerCita(Number(id) || 0);
  if (!cita) notFound();

  return <PaginaReprogramar actor={usuario} cita={cita} parametros={await searchParams} />;
}
