"use client";

import { useActionState } from "react";
import { guardarMedicoAccion } from "@/acciones/coordinacion";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo, Casilla } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/validaciones/comunes";

type Medico = {
  id: number;
  nombres: string;
  apellidos: string;
  registroMedico: string;
  correo: string | null;
  telefono: string | null;
  activo: boolean;
  especialidadIds: number[];
};

/** RF-09: registro y edición de un médico con una o más especialidades. */
export function FormularioMedico({
  especialidades,
  medico,
}: {
  especialidades: { id: number; nombre: string; activo: boolean }[];
  medico?: Medico;
}) {
  const [estado, accion] = useActionState(guardarMedicoAccion, estadoInicial);
  const valores = estado.valores;
  const seleccionadas = new Set(
    valores?.especialidadIds !== undefined
      ? valores.especialidadIds.split(",").filter(Boolean).map(Number)
      : (medico?.especialidadIds ?? []),
  );
  const erroresEspecialidades = estado.errores?.especialidadIds;

  return (
    <form action={accion} className="space-y-6" noValidate>
      {estado.mensaje ? <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta> : null}
      {medico ? <input type="hidden" name="id" value={medico.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nombre="nombres"
          etiqueta="Nombres"
          required
          defaultValue={valores?.nombres ?? medico?.nombres}
          errores={estado.errores?.nombres}
        />
        <Campo
          nombre="apellidos"
          etiqueta="Apellidos"
          required
          defaultValue={valores?.apellidos ?? medico?.apellidos}
          errores={estado.errores?.apellidos}
        />
        <Campo
          nombre="registroMedico"
          etiqueta="Registro médico"
          required
          ayuda="Número de registro profesional, por ejemplo RM-10025."
          defaultValue={valores?.registroMedico ?? medico?.registroMedico}
          errores={estado.errores?.registroMedico}
        />
        <Campo
          nombre="telefono"
          etiqueta="Teléfono"
          type="tel"
          inputMode="numeric"
          defaultValue={valores?.telefono ?? medico?.telefono ?? ""}
          errores={estado.errores?.telefono}
        />
        <Campo
          nombre="correo"
          etiqueta="Correo electrónico"
          type="email"
          className="sm:col-span-2"
          defaultValue={valores?.correo ?? medico?.correo ?? ""}
          errores={estado.errores?.correo}
        />
      </div>

      <fieldset
        aria-describedby={erroresEspecialidades?.length ? "especialidades-error" : undefined}
        className={`rounded-lg border p-4 ${erroresEspecialidades?.length ? "border-red-700" : "border-slate-200"}`}
      >
        <legend className="px-1 font-medium text-slate-800">
          Especialidades<span className="text-red-700"> *</span>
        </legend>
        <p className="mb-3 text-sm text-slate-600">Seleccione una o más especialidades que atiende el médico.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {especialidades.map((especialidad) => (
            <Casilla
              key={especialidad.id}
              id={`especialidad-${especialidad.id}`}
              nombre="especialidadIds"
              value={especialidad.id}
              etiqueta={especialidad.activo ? especialidad.nombre : `${especialidad.nombre} (inactiva)`}
              defaultChecked={seleccionadas.has(especialidad.id)}
            />
          ))}
        </div>
        {erroresEspecialidades?.length ? (
          <p id="especialidades-error" className="mt-2 text-sm font-medium text-red-700">
            {erroresEspecialidades.join(" ")}
          </p>
        ) : null}
      </fieldset>

      {medico ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <Casilla
            nombre="activo"
            etiqueta="Médico activo"
            ayuda="Un médico inactivo conserva su historial, pero no se le generan nuevos espacios."
            defaultChecked={valores ? valores.activo === "on" : medico.activo}
          />
        </div>
      ) : null}

      <BotonEnviar textoEnviando="Guardando…">{medico ? "Guardar cambios" : "Registrar médico"}</BotonEnviar>
    </form>
  );
}
