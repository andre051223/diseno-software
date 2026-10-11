"use client";

import { useActionState } from "react";
import { registrarNovedadAccion } from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { AreaTexto, Campo, Selector } from "@/components/ui/campo";
import { listaTiposNovedad, nombresTipoNovedad } from "@/lib/etiquetas";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-11: registro de una novedad del médico. */
export function FormularioNovedad({
  medicos,
  hoy,
  medicoInicial,
}: {
  medicos: { valor: number; etiqueta: string }[];
  hoy: string;
  medicoInicial?: number;
}) {
  const [estado, accion] = useActionState(registrarNovedadAccion, estadoInicial);
  const valores = estado.valores;

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje && !estado.ok ? <Alerta tipo="error">{estado.mensaje}</Alerta> : null}
      <Selector
        nombre="medicoId"
        etiqueta="Médico"
        required
        textoVacio="Seleccione el médico"
        opciones={medicos}
        defaultValue={valores?.medicoId ?? medicoInicial ?? ""}
        errores={estado.errores?.medicoId}
      />
      <Selector
        nombre="tipo"
        etiqueta="Tipo de novedad"
        required
        textoVacio="Seleccione el tipo"
        opciones={listaTiposNovedad.map((tipo) => ({ valor: tipo, etiqueta: nombresTipoNovedad[tipo] }))}
        defaultValue={valores?.tipo ?? ""}
        errores={estado.errores?.tipo}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nombre="fechaInicio"
          etiqueta="Fecha de inicio"
          type="date"
          required
          min={hoy}
          defaultValue={valores?.fechaInicio ?? hoy}
          errores={estado.errores?.fechaInicio}
        />
        <Campo
          nombre="horaInicio"
          etiqueta="Hora de inicio"
          type="time"
          required
          ayuda="Formato de 24 h."
          defaultValue={valores?.horaInicio ?? "00:00"}
          errores={estado.errores?.horaInicio}
        />
        <Campo
          nombre="fechaFin"
          etiqueta="Fecha de fin"
          type="date"
          required
          min={hoy}
          defaultValue={valores?.fechaFin ?? hoy}
          errores={estado.errores?.fechaFin}
        />
        <Campo
          nombre="horaFin"
          etiqueta="Hora de fin"
          type="time"
          required
          ayuda="Formato de 24 h."
          defaultValue={valores?.horaFin ?? "23:59"}
          errores={estado.errores?.horaFin}
        />
      </div>
      <AreaTexto
        nombre="motivo"
        etiqueta="Observaciones"
        ayuda="Opcional. Por ejemplo, el nombre del curso o el número de la incapacidad."
        defaultValue={valores?.motivo ?? ""}
        errores={estado.errores?.motivo}
      />
      <BotonEnviar textoEnviando="Registrando…">Registrar novedad y bloquear espacios</BotonEnviar>
    </form>
  );
}
