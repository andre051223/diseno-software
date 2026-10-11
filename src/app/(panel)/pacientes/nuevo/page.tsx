import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { FormularioVentanilla } from "./formulario-ventanilla";

export const metadata: Metadata = { title: "Registrar paciente" };

// RF-05: registro del paciente en ventanilla por la recepcionista.
export default async function PaginaNuevoPaciente() {
  await requerirRol("recepcionista");
  const aseguradoras = await db.aseguradora.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return (
    <>
      <Link href="/pacientes" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a pacientes
      </Link>
      <EncabezadoPagina
        titulo="Registrar paciente"
        descripcion="Verifique los datos con el documento de identidad. Si el correo no pertenece a otra cuenta, el paciente recibirá un enlace para activar su acceso al portal."
      />
      <Tarjeta>
        <FormularioVentanilla
          aseguradoras={aseguradoras.map((aseguradora) => ({ valor: aseguradora.id, etiqueta: aseguradora.nombre }))}
        />
      </Tarjeta>
    </>
  );
}
