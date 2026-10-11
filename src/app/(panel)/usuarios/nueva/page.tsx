import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoPagina, Tarjeta } from "@/components/ui/estructura";
import { requerirRol } from "@/lib/sesion";
import { FormularioCuenta } from "../formulario-cuenta";
import { opcionesDeVinculo } from "../opciones";

export const metadata: Metadata = { title: "Nueva cuenta" };

export default async function PaginaNuevaCuenta() {
  await requerirRol("administrador");
  const opciones = await opcionesDeVinculo();

  return (
    <>
      <Link href="/usuarios" className="mb-4 inline-block font-medium text-petroleo-700 underline underline-offset-4">
        ← Volver a usuarios
      </Link>
      <EncabezadoPagina titulo="Nueva cuenta" descripcion="La persona podrá cambiar su contraseña después." />
      <Tarjeta>
        <FormularioCuenta medicos={opciones.medicos} pacientes={opciones.pacientes} />
      </Tarjeta>
    </>
  );
}
