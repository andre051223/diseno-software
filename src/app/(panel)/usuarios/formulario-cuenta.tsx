"use client";

import { useActionState, useState } from "react";
import { crearCuentaAccion, editarCuentaAccion } from "@/acciones/usuarios";
import { Alerta } from "@/components/ui/alerta";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo, Casilla, Selector } from "@/components/ui/campo";
import type { Rol } from "@/generated/prisma/enums";
import { listaRoles, nombresRoles } from "@/lib/roles";
import { estadoInicial } from "@/lib/validaciones/comunes";

type Opcion = { valor: number; etiqueta: string };

type Propiedades = {
  medicos: Opcion[];
  pacientes: Opcion[];
  cuenta?: {
    id: number;
    nombre: string;
    correo: string;
    rol: Rol;
    activo: boolean;
    bloqueada: boolean;
    medicoId: number | null;
    pacienteId: number | null;
  };
};

/** RF-02: formulario para crear o editar una cuenta y asignarle uno de los siete roles. */
export function FormularioCuenta({ medicos, pacientes, cuenta }: Propiedades) {
  const esEdicion = Boolean(cuenta);
  const [estado, accion] = useActionState(esEdicion ? editarCuentaAccion : crearCuentaAccion, estadoInicial);
  const [rol, setRol] = useState<Rol | "">(
    (estado.valores?.rol as Rol | undefined) ?? cuenta?.rol ?? "",
  );
  const valores = estado.valores;

  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.mensaje ? (
        <Alerta tipo={estado.ok ? "exito" : "error"}>{estado.mensaje}</Alerta>
      ) : null}
      {cuenta ? <input type="hidden" name="id" value={cuenta.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          nombre="nombre"
          etiqueta="Nombre completo"
          required
          defaultValue={valores?.nombre ?? cuenta?.nombre}
          errores={estado.errores?.nombre}
        />
        {cuenta ? (
          <div>
            <p className="mb-1 font-medium text-slate-800">Correo electrónico</p>
            <p className="min-h-11 rounded-lg bg-slate-100 px-3 py-2">{cuenta.correo}</p>
          </div>
        ) : (
          <Campo
            nombre="correo"
            etiqueta="Correo electrónico"
            type="email"
            required
            defaultValue={valores?.correo}
            errores={estado.errores?.correo}
          />
        )}
        <Selector
          nombre="rol"
          etiqueta="Rol"
          required
          textoVacio="Seleccione un rol"
          opciones={listaRoles.map((valor) => ({ valor, etiqueta: nombresRoles[valor] }))}
          value={rol}
          onChange={(evento) => setRol(evento.target.value as Rol)}
          errores={estado.errores?.rol}
        />
        {!cuenta ? (
          <Campo
            nombre="contrasena"
            etiqueta="Contraseña inicial"
            type="password"
            autoComplete="new-password"
            required
            ayuda="Mínimo 8 caracteres, con al menos una letra y un número."
            errores={estado.errores?.contrasena}
          />
        ) : null}
        {rol === "medico" ? (
          <Selector
            nombre="medicoId"
            etiqueta="Médico asociado"
            required
            textoVacio="Seleccione el médico"
            opciones={medicos}
            defaultValue={valores?.medicoId ?? cuenta?.medicoId ?? ""}
            errores={estado.errores?.medicoId}
            ayuda="Solo aparecen los médicos que aún no tienen cuenta."
          />
        ) : null}
        {rol === "paciente" ? (
          <Selector
            nombre="pacienteId"
            etiqueta="Paciente asociado"
            required
            textoVacio="Seleccione el paciente"
            opciones={pacientes}
            defaultValue={valores?.pacienteId ?? cuenta?.pacienteId ?? ""}
            errores={estado.errores?.pacienteId}
            ayuda="Solo aparecen los pacientes que aún no tienen cuenta."
          />
        ) : null}
      </div>

      {cuenta ? (
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <Casilla
            nombre="activo"
            etiqueta="Cuenta activa"
            ayuda="Una cuenta inactiva no puede iniciar sesión, pero conserva su historial."
            defaultChecked={cuenta.activo}
          />
          {cuenta.bloqueada ? (
            <Casilla
              nombre="desbloquear"
              etiqueta="Desbloquear la cuenta"
              ayuda="La cuenta está bloqueada por intentos fallidos. Marque esta opción para habilitarla ya."
            />
          ) : null}
        </div>
      ) : null}

      <BotonEnviar textoEnviando="Guardando…">{cuenta ? "Guardar cambios" : "Crear cuenta"}</BotonEnviar>
    </form>
  );
}
