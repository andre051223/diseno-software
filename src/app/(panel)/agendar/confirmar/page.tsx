import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaginaConfirmar } from "@/components/citas/pagina-confirmar";
import { EncabezadoPagina } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Confirmar cita" };

// RF-21 a RF-23: validación de cobertura y confirmación desde recepción o el centro de llamadas.
export default async function PaginaConfirmarAgendar({ searchParams }: PageProps<"/agendar/confirmar">) {
  const usuario = await requerirRol("recepcionista", "agente_telefonico");
  const parametros = await searchParams;
  const paciente = await db.paciente.findUnique({ where: { id: Number(parametros.paciente) || 0 }, select: { id: true } });
  if (!paciente) redirect("/agendar");

  return (
    <>
      <EncabezadoPagina titulo="Confirmar cita" />
      <PaginaConfirmar
        contexto={{ rol: usuario.rol, pacienteId: paciente.id }}
        parametros={parametros}
        usuarioId={usuario.id}
      />
    </>
  );
}
