"use client";

import { useActionState } from "react";
import { restablecerContrasenaAccion } from "@/acciones/autenticacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

export function FormularioRestablecer({ token }: { token: string }) {
  const [estado, accion] = useActionState(restablecerContrasenaAccion, estadoInicial);

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="token" value={token} />
      <Campo
        nombre="contrasena"
        etiqueta="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
        ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
        errores={estado.errores?.contrasena}
      />
      <Campo
        nombre="confirmacion"
        etiqueta="Confirme la nueva contraseña"
        type="password"
        autoComplete="new-password"
        required
        errores={estado.errores?.confirmacion}
      />
      <BotonEnviar className="w-full" textoEnviando="Guardando…">
        Guardar nueva contraseña
      </BotonEnviar>
    </form>
  );
}
