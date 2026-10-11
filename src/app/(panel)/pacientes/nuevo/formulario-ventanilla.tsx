"use client";

import { useActionState } from "react";
import { registrarPacienteVentanillaAccion } from "@/acciones/pacientes";
import { CamposPaciente, type OpcionAseguradora } from "@/components/campos-paciente";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-05 y RF-06: registro del paciente en ventanilla. */
export function FormularioVentanilla({ aseguradoras }: { aseguradoras: OpcionAseguradora[] }) {
  const [estado, accion] = useActionState(registrarPacienteVentanillaAccion, estadoInicial);

  return (
    <form action={accion} className="space-y-6" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <CamposPaciente aseguradoras={aseguradoras} estado={estado} />
      <BotonEnviar textoEnviando="Registrando…">Registrar paciente</BotonEnviar>
    </form>
  );
}
