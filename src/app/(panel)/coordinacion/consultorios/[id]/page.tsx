import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { FormularioConsultorio } from "../formulario-consultorio";

export const metadata: Metadata = { title: "Editar consultorio" };

// RF-08: edición de un consultorio.
export default async function PaginaEditarConsultorio({ params }: PageProps<"/coordinacion/consultorios/[id]">) {
  await requerirRol("coordinador_agenda");
  const { id } = await params;
  const consultorio = await db.consultorio.findUnique({ where: { id: Number(id) || 0 } });
  if (!consultorio) notFound();

  return (
    <>
      <Link
        href="/coordinacion/consultorios"
        className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4"
      >
        ← Volver a consultorios
      </Link>
      <EncabezadoPagina titulo={`Editar ${consultorio.nombre.toLowerCase()}`} />
      <Tarjeta className="max-w-2xl">
        <FormularioConsultorio consultorio={consultorio} />
      </Tarjeta>
    </>
  );
}
