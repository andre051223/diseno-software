import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperacion } from "./formulario-recuperacion";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperarContrasena() {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Recuperar contraseña</h1>
      <p className="mt-1 text-slate-700">
        Escriba el correo con el que se registró. Le enviaremos un enlace para crear una nueva contraseña; el
        enlace sirve una sola vez y vence en 30 minutos.
      </p>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <FormularioRecuperacion />
      </div>
      <p className="mt-6 text-center">
        <Link href="/iniciar-sesion" className="font-semibold text-petroleo-700 underline underline-offset-4">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
