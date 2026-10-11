"use client";

import { useActionState } from "react";
import { guardarEspecialidadAccion } from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { AreaTexto, Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-08: creación y edición de una especialidad. */
export function FormularioEspecialidad({
  especialidad,
}: {
  especialidad?: { id: number; nombre: string; descripcion: string | null };
}) {
  const [estado, accion] = useActionState(guardarEspecialidadAccion, estadoInicial);
  const valores = estado.valores;

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      {especialidad ? <input type="hidden" name="id" value={especialidad.id} /> : null}
      <Campo
        nombre="nombre"
        etiqueta="Nombre de la especialidad"
        required
        defaultValue={valores?.nombre ?? especialidad?.nombre}
        errores={estado.errores?.nombre}
      />
      <AreaTexto
        nombre="descripcion"
        etiqueta="Descripción"
        ayuda="Opcional. Se muestra a los pacientes al elegir la especialidad."
        defaultValue={valores?.descripcion ?? especialidad?.descripcion ?? ""}
        errores={estado.errores?.descripcion}
      />
      <BotonEnviar textoEnviando="Guardando…">{especialidad ? "Guardar cambios" : "Crear especialidad"}</BotonEnviar>
    </form>
  );
}
