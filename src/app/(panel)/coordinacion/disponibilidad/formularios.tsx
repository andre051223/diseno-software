"use client";

import { useActionState } from "react";
import {
  crearDisponibilidadAccion,
  desactivarDisponibilidadAccion,
  regenerarEspaciosAccion,
} from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo, Casilla, Selector } from "@/components/ui/campo";
import { nombresDiasSemana } from "@/lib/fechas";
import { estadoInicial } from "@/lib/validaciones/comunes";

/** RF-10: alta de un bloque de disponibilidad semanal para uno o varios días. */
export function FormularioDisponibilidad({
  medicoId,
  consultorios,
  duracionSugerida,
}: {
  medicoId: number;
  consultorios: { valor: number; etiqueta: string }[];
  duracionSugerida: number;
}) {
  const [estado, accion] = useActionState(crearDisponibilidadAccion, estadoInicial);
  const valores = estado.valores;
  const diasMarcados = new Set((valores?.dias ?? "").split(",").filter(Boolean).map(Number));
  const errorDias = estado.errores?.dias;

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="medicoId" value={medicoId} />

      <fieldset
        aria-describedby={errorDias?.length ? "dias-error" : undefined}
        className={`rounded-lg border p-4 ${errorDias?.length ? "border-red-700" : "border-slate-200"}`}
      >
        <legend className="px-1 font-medium text-slate-800">
          Días de la semana<span className="text-red-700"> *</span>
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(nombresDiasSemana).map(([numero, nombre]) => (
            <Casilla
              key={numero}
              id={`dia-${numero}`}
              nombre="dias"
              value={numero}
              etiqueta={nombre}
              defaultChecked={diasMarcados.has(Number(numero))}
            />
          ))}
        </div>
        {errorDias?.length ? (
          <p id="dias-error" className="mt-2 text-sm font-medium text-red-700">
            {errorDias.join(" ")}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nombre="horaInicio"
          etiqueta="Hora de inicio"
          type="time"
          required
          step={300}
          ayuda="Formato de 24 h."
          defaultValue={valores?.horaInicio ?? "07:00"}
          errores={estado.errores?.horaInicio}
        />
        <Campo
          nombre="horaFin"
          etiqueta="Hora de fin"
          type="time"
          required
          step={300}
          ayuda="Formato de 24 h."
          defaultValue={valores?.horaFin ?? "12:00"}
          errores={estado.errores?.horaFin}
        />
        <Campo
          nombre="duracionMinutos"
          etiqueta="Duración de la consulta (minutos)"
          type="number"
          inputMode="numeric"
          min={10}
          max={120}
          step={5}
          required
          defaultValue={valores?.duracionMinutos ?? duracionSugerida}
          errores={estado.errores?.duracionMinutos}
        />
        <Selector
          nombre="consultorioId"
          etiqueta="Consultorio"
          required
          textoVacio="Seleccione el consultorio"
          opciones={consultorios}
          defaultValue={valores?.consultorioId ?? ""}
          errores={estado.errores?.consultorioId}
        />
      </div>

      <BotonEnviar textoEnviando="Generando espacios…">Guardar y generar espacios</BotonEnviar>
    </form>
  );
}

/** RF-10: completa los espacios de las próximas 8 semanas para los bloques activos del médico. */
export function FormularioRegenerar({ medicoId }: { medicoId: number }) {
  const [estado, accion] = useActionState(regenerarEspaciosAccion, estadoInicial);
  return (
    <form action={accion} className="space-y-3">
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      <input type="hidden" name="medicoId" value={medicoId} />
      <BotonEnviar variante="secundario" textoEnviando="Generando…">
        Generar espacios de las próximas 8 semanas
      </BotonEnviar>
    </form>
  );
}

/** RF-10: desactiva un bloque de disponibilidad. */
export function BotonDesactivarBloque({ id, descripcion }: { id: number; descripcion: string }) {
  const [estado, accion] = useActionState(desactivarDisponibilidadAccion, estadoInicial);
  return (
    <form
      action={accion}
      className="space-y-2"
      onSubmit={(evento) => {
        if (!window.confirm(`¿Desactivar el bloque ${descripcion}? Se retirarán sus espacios libres futuros.`)) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <BotonEnviar variante="peligro" textoEnviando="Desactivando…">
        Desactivar<span className="sr-only"> el bloque {descripcion}</span>
      </BotonEnviar>
      {estado.mensaje && !estado.ok ? <p className="text-sm font-medium text-red-700">{estado.mensaje}</p> : null}
    </form>
  );
}
