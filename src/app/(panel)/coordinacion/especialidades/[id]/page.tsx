import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { FormularioEspecialidad } from "../formulario-especialidad";

export const metadata: Metadata = { title: "Editar especialidad" };

// RF-08: edición de una especialidad.
export default async function PaginaEditarEspecialidad({ params }: PageProps<"/coordinacion/especialidades/[id]">) {
  await requerirRol("coordinador_agenda");
  const { id } = await params;
  const especialidad = await db.especialidad.findUnique({ where: { id: Number(id) || 0 } });
  if (!especialidad) notFound();

  return (
    <>
      <Link
        href="/coordinacion/especialidades"
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a especialidades
      </Link>
      <EncabezadoPagina titulo={`Editar ${especialidad.nombre.toLowerCase()}`} />
      <Tarjeta className="max-w-2xl">
        <FormularioEspecialidad especialidad={especialidad} />
      </Tarjeta>
    </>
  );
}
