"use client";

import Link from "next/link";
import { useActionState } from "react";
import { iniciarSesionAccion } from "@/acciones/autenticacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

export function FormularioInicioSesion({ siguiente }: { siguiente?: string }) {
  const [estado, accion] = useActionState(iniciarSesionAccion, estadoInicial);

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="siguiente" value={siguiente ?? ""} />
      <Campo
        nombre="correo"
        etiqueta="Correo electrónico"
        type="email"
        autoComplete="email"
        required
        defaultValue={estado.valores?.correo}
        errores={estado.errores?.correo}
      />
      <Campo
        nombre="contrasena"
        etiqueta="Contraseña"
        type="password"
        autoComplete="current-password"
        required
        errores={estado.errores?.contrasena}
      />
      <BotonEnviar className="w-full" textoEnviando="Verificando…">
        Ingresar
      </BotonEnviar>
      <p className="text-center">
        <Link href="/recuperar-contrasena" className="font-medium text-petroleo-700 underline underline-offset-4">
          ¿Olvidó su contraseña?
        </Link>
      </p>
    </form>
  );
}
