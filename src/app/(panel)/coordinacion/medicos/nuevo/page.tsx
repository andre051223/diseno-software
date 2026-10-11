import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { FormularioMedico } from "../formulario-medico";

export const metadata: Metadata = { title: "Registrar médico" };

// RF-09: registro de un médico.
export default async function PaginaNuevoMedico() {
  await requerirRol("coordinador_agenda");
  const especialidades = await db.especialidad.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return (
    <>
      <Link
        href="/coordinacion/medicos"
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a médicos
      </Link>
      <EncabezadoPagina
        titulo="Registrar médico"
        descripcion="Después de registrarlo podrá configurar su disponibilidad semanal."
      />
      <Tarjeta>
        <FormularioMedico especialidades={especialidades} />
      </Tarjeta>
    </>
  );
}
