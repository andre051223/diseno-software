"use client";

import { useActionState } from "react";
import { guardarConsultorioAccion } from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-08: creación y edición de un consultorio. */
export function FormularioConsultorio({
  consultorio,
}: {
  consultorio?: { id: number; nombre: string; ubicacion: string };
}) {
  const [estado, accion] = useActionState(guardarConsultorioAccion, estadoInicial);
  const valores = estado.valores;

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      {consultorio ? <input type="hidden" name="id" value={consultorio.id} /> : null}
      <Campo
        nombre="nombre"
        etiqueta="Nombre del consultorio"
        required
        ayuda="Por ejemplo, Consultorio 106."
        defaultValue={valores?.nombre ?? consultorio?.nombre}
        errores={estado.errores?.nombre}
      />
      <Campo
        nombre="ubicacion"
        etiqueta="Ubicación"
        required
        ayuda="Bloque y piso, para orientar al paciente."
        defaultValue={valores?.ubicacion ?? consultorio?.ubicacion}
        errores={estado.errores?.ubicacion}
      />
      <BotonEnviar textoEnviando="Guardando…">{consultorio ? "Guardar cambios" : "Crear consultorio"}</BotonEnviar>
    </form>
  );
}
