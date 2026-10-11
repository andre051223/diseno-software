import type { Metadata } from "next";
import { Alerta } from "@/components/ui/alerta";
import { EnlaceBoton } from "@/components/ui/boton";
import { verificarTokenRecuperacion } from "@/servicios/autenticacion";
import { FormularioRestablecer } from "./formulario-restablecer";

export const metadata: Metadata = { title: "Crear nueva contraseña" };

// RF-04: el enlace solo funciona si no se ha usado y está dentro de los 30 minutos de vigencia.
export default async function PaginaRestablecer({ params }: PageProps<"/restablecer-contrasena/[token]">) {
  const { token } = await params;
  const valido = await verificarTokenRecuperacion(token);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold sm:text-3xl">Crear nueva contraseña</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {valido ? (
          <FormularioRestablecer token={token} />
        ) : (
          <div className="space-y-4">
            <Alerta tipo="error" titulo="Enlace no válido">
              El enlace ya fue usado o venció. Por seguridad, cada enlace sirve una sola vez durante 30 minutos.
            </Alerta>
            <EnlaceBoton href="/recuperar-contrasena" className="w-full">
              Solicitar un enlace nuevo
            </EnlaceBoton>
          </div>
        )}
      </div>
    </div>
  );
}
