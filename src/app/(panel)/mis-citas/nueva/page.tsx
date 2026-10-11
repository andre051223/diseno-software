import type { Metadata } from "next";
import { AsistenteHorarios } from "@/components/citas/asistente-horarios";
import { Alerta } from "@/components/ui/alerta";
import { EncabezadoPagina } from "@/components/ui/estructura";
import { requerirRol } from "@/lib/sesion";

export const metadata: Metadata = { title: "Nueva cita" };

// RF-12 y RF-14: asistente de agendamiento del paciente desde el portal.
export default async function PaginaNuevaCita({ searchParams }: PageProps<"/mis-citas/nueva">) {
  const usuario = await requerirRol("paciente");
  const parametros = await searchParams;

  return (
    <>
      <EncabezadoPagina titulo="Nueva cita" descripcion="Elija la especialidad, el médico, la fecha y el horario." />
      {usuario.pacienteId ? (
        <AsistenteHorarios
          contexto={{ rol: usuario.rol, pacienteId: usuario.pacienteId }}
          parametros={parametros}
          usuarioId={usuario.id}
        />
      ) : (
        <Alerta tipo="advertencia">
          Su cuenta no está asociada a un registro de paciente. Comuníquese con recepción para completar su registro.
        </Alerta>
      )}
    </>
  );
}
