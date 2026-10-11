import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/sesion";
import { FormularioCuenta } from "../formulario-cuenta";
import { opcionesDeVinculo } from "../opciones";

export const metadata: Metadata = { title: "Editar cuenta" };

export default async function PaginaEditarCuenta({ params }: PageProps<"/usuarios/[id]">) {
  await requerirRol("administrador");
  const { id } = await params;
  const cuenta = await db.usuario.findUnique({
    where: { id: Number(id) || 0 },
    include: { medico: { select: { id: true } }, paciente: { select: { id: true } } },
  });
  if (!cuenta) notFound();

  const opciones = await opcionesDeVinculo(cuenta.id);

  return (
    <>
      <Link href="/usuarios" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a usuarios
      </Link>
      <EncabezadoPagina titulo={`Editar cuenta de ${cuenta.nombre}`} />
      <Tarjeta>
        <FormularioCuenta
          medicos={opciones.medicos}
          pacientes={opciones.pacientes}
          cuenta={{
            id: cuenta.id,
            nombre: cuenta.nombre,
            correo: cuenta.correo,
            rol: cuenta.rol,
            activo: cuenta.activo,
            bloqueada: Boolean(cuenta.bloqueadoHasta && cuenta.bloqueadoHasta > new Date()),
            medicoId: cuenta.medico?.id ?? null,
            pacienteId: cuenta.paciente?.id ?? null,
          }}
        />
      </Tarjeta>
    </>
  );
}
