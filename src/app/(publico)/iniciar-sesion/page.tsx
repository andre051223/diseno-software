import type { Metadata } from "next";
import Link from "next/link";
import { Alerta } from "@/components/ui/alerta";
import { FormularioInicioSesion } from "./formulario-inicio-sesion";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function PaginaIniciarSesion({ searchParams }: PageProps<"/iniciar-sesion">) {
  const parametros = await searchParams;
  const siguiente = typeof parametros.siguiente === "string" ? parametros.siguiente : undefined;
  const restablecida = parametros.restablecida === "1";
  const registrado = parametros.registrado === "1";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Iniciar sesión</h1>
      <p className="mt-1 text-slate-700">Ingrese con el correo y la contraseña de su cuenta.</p>

      <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {restablecida ? (
          <Alerta tipo="exito">Su contraseña se cambió correctamente. Ya puede iniciar sesión.</Alerta>
        ) : null}
        {registrado ? (
          <Alerta tipo="exito">Su cuenta quedó creada. Inicie sesión para agendar su primera cita.</Alerta>
        ) : null}
        {siguiente ? (
          <Alerta tipo="info">Debe iniciar sesión para continuar.</Alerta>
        ) : null}
        <FormularioInicioSesion siguiente={siguiente} />
      </div>

      <p className="mt-6 text-center text-slate-700">
        ¿Es paciente y aún no tiene cuenta?{" "}
        <Link href="/registro" className="font-semibold text-petroleo-700 underline underline-offset-4">
          Regístrese aquí
        </Link>
      </p>
    </div>
  );
}
