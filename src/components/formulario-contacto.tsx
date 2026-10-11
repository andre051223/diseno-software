"use client";

import { useActionState } from "react";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial, type EstadoFormulario } from "@/lib/validaciones/comunes";

type Accion = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/** RF-07: actualización del teléfono y el correo de contacto. */
export function FormularioContacto({
  accion,
  telefono,
  correo,
  pacienteId,
  ayudaCorreo,
}: {
  accion: Accion;
  telefono: string;
  correo: string;
  pacienteId?: number;
  ayudaCorreo?: string;
}) {
  const [estado, enviar] = useActionState(accion, estadoInicial);

  return (
    <form action={enviar} className="space-y-4" noValidate>
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      {pacienteId ? <input type="hidden" name="pacienteId" value={pacienteId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nombre="telefono"
          etiqueta="Teléfono celular"
          type="tel"
          inputMode="numeric"
          required
          defaultValue={estado.valores?.telefono ?? telefono}
          errores={estado.errores?.telefono}
        />
        <Campo
          nombre="correo"
          etiqueta="Correo electrónico"
          type="email"
          required
          ayuda={ayudaCorreo}
          defaultValue={estado.valores?.correo ?? correo}
          errores={estado.errores?.correo}
        />
      </div>
      <BotonEnviar textoEnviando="Guardando…">Guardar datos de contacto</BotonEnviar>
    </form>
  );
}
