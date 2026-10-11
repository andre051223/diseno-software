import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnlaceBoton } from "@/components/ui/boton";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { requerirRol } from "@/lib/sesion";
import { FormularioMedico } from "../formulario-medico";

export const metadata: Metadata = { title: "Editar médico" };

// RF-09: edición de un médico y de sus especialidades.
export default async function PaginaEditarMedico({ params }: PageProps<"/coordinacion/medicos/[id]">) {
  await requerirRol("coordinador_agenda");
  const { id } = await params;
  const medico = await db.medico.findUnique({ where: { id: Number(id) || 0 }, include: { especialidades: true } });
  if (!medico) notFound();

  const idsActuales = medico.especialidades.map((especialidad) => especialidad.id);
  // Se muestran las especialidades activas y las inactivas que el médico ya tenía.
  const especialidades = await db.especialidad.findMany({
    where: { OR: [{ activo: true }, { id: { in: idsActuales } }] },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <Link
        href="/coordinacion/medicos"
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a médicos
      </Link>
      <EncabezadoPagina
        titulo={nombreMedico(medico)}
        acciones={
          <EnlaceBoton href={`/coordinacion/disponibilidad?medico=${medico.id}`} variante="secundario">
            Disponibilidad semanal
          </EnlaceBoton>
        }
      />
      <Tarjeta>
        <FormularioMedico
          especialidades={especialidades}
          medico={{
            id: medico.id,
            nombres: medico.nombres,
            apellidos: medico.apellidos,
            registroMedico: medico.registroMedico,
            correo: medico.correo,
            telefono: medico.telefono,
            activo: medico.activo,
            especialidadIds: idsActuales,
          }}
        />
      </Tarjeta>
    </>
  );
}
