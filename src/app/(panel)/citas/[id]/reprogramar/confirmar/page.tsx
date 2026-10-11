import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaConfirmarReprogramacion } from "@/components/citas/pagina-reprogramar";
import { requerirRol } from "@/lib/sesion";
import { obtenerCita } from "@/servicios/agendamiento";

export const metadata: Metadata = { title: "Confirmar reprogramación" };

// RF-16: recepción o el centro de llamadas confirman el cambio al nuevo horario.
export default async function PaginaConfirmarReprogramacionPersonal({
  params,
  searchParams,
}: PageProps<"/citas/[id]/reprogramar/confirmar">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const { id } = await params;
  const cita = await obtenerCita(Number(id) || 0);
  if (!cita) notFound();

  return <PaginaConfirmarReprogramacion actor={usuario} cita={cita} parametros={await searchParams} />;
}
