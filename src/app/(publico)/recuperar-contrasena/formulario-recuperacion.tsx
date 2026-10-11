"use client";

import { useActionState } from "react";
import { solicitarRecuperacionAccion } from "@/acciones/autenticacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

export function FormularioRecuperacion() {
  const [estado, accion] = useActionState(solicitarRecuperacionAccion, estadoInicial);

  if (estado.ok) {
    return <Alerta tipo="exito" titulo="Solicitud recibida">{estado.mensaje}</Alerta>;
  }

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <Campo
        nombre="correo"
        etiqueta="Correo electrónico de su cuenta"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores?.correo}
        errores={estado.errores?.correo}
      />
      <BotonEnviar className="w-full" textoEnviando="Enviando…">
        Enviar enlace de recuperación
      </BotonEnviar>
    </form>
  );
}
