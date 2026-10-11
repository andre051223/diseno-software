import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { FormularioRegistro } from "./formulario-registro";

export const metadata: Metadata = { title: "Registro de paciente" };

// RF-05: registro del paciente por el portal web.
export default async function PaginaRegistro() {
  // Las aseguradoras se leen en cada solicitud, no al compilar.
  await connection();
  const aseguradoras = await db.aseguradora.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Registro de paciente</h1>
      <p className="mt-1 text-slate-700">
        Cree su cuenta para agendar, confirmar, reprogramar o cancelar sus citas. Los campos con{" "}
        <span className="text-red-700">*</span> son obligatorios.
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <FormularioRegistro
          aseguradoras={aseguradoras.map((aseguradora) => ({ valor: aseguradora.id, etiqueta: aseguradora.nombre }))}
        />
      </div>

      <p className="mt-6 text-center text-slate-700">
        ¿Ya tiene cuenta?{" "}
        <Link href="/iniciar-sesion" className="font-semibold text-petroleo-700 underline underline-offset-4">
          Inicie sesión
        </Link>
      </p>
    </div>
  );
}
