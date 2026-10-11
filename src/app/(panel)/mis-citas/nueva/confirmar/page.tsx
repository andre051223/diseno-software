import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PaginaConfirmar } from "@/components/citas/pagina-confirmar";
import { EncabezadoPagina } from "@/components/ui/estructura";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Confirmar cita" };

// RF-21 a RF-23: validación de cobertura y confirmación de la cita del paciente.
export default async function PaginaConfirmarCita({ searchParams }: PageProps<"/mis-citas/nueva/confirmar">) {
  const usuario = await requerirRol("paciente");
  if (!usuario.pacienteId) redirect("/mis-citas");
  const parametros = await searchParams;

  return (
    <>
      <EncabezadoPagina titulo="Confirmar cita" />
      <PaginaConfirmar
        contexto={{ rol: usuario.rol, pacienteId: usuario.pacienteId }}
        parametros={parametros}
        usuarioId={usuario.id}
      />
    </>
  );
}
