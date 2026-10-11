"use client";

import { useActionState } from "react";
import { registrarPacientePortalAccion } from "@/acciones/pacientes";
import { CamposPaciente, type OpcionAseguradora } from "@/components/campos-paciente";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-05 y RF-06: registro del paciente en el portal. */
export function FormularioRegistro({ aseguradoras }: { aseguradoras: OpcionAseguradora[] }) {
  const [estado, accion] = useActionState(registrarPacientePortalAccion, estadoInicial);

  return (
    <form action={accion} className="space-y-6" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold text-petroleo-900">Datos personales</legend>
        <CamposPaciente aseguradoras={aseguradoras} estado={estado} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold text-petroleo-900">Contraseña de su cuenta</legend>
        <p className="text-slate-700">Iniciará sesión con su correo electrónico y esta contraseña.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nombre="contrasena"
            etiqueta="Contraseña"
            type="password"
            required
            autoComplete="new-password"
            ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
            errores={estado.errores?.contrasena}
          />
          <Campo
            nombre="confirmacion"
            etiqueta="Confirme la contraseña"
            type="password"
            required
            autoComplete="new-password"
            errores={estado.errores?.confirmacion}
          />
        </div>
      </fieldset>

      <BotonEnviar className="w-full sm:w-auto" textoEnviando="Creando la cuenta…">
        Crear mi cuenta
      </BotonEnviar>
    </form>
  );
}
