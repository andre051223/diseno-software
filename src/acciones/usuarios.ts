"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/sesion";
import {
  datosDeFormulario,
  erroresDeValidacion,
  valoresSeguros,
  type EstadoFormulario,
} from "@/lib/validaciones/comunes";
import { esquemaCrearCuenta, esquemaEditarCuenta } from "@/lib/validaciones/usuarios";
import { crearCuenta, editarCuenta } from "@/servicios/usuarios";

// RF-02: el administrador crea una cuenta y le asigna uno de los siete roles.
export async function crearCuentaAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("administrador");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaCrearCuenta.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await crearCuenta(validacion.data, actor.id);
  if (!resultado.ok) {
    return {
      ok: false,
      mensaje: resultado.mensaje,
      errores: resultado.campo ? { [resultado.campo]: [resultado.mensaje] } : undefined,
      valores: valoresSeguros(datos),
    };
  }

  revalidatePath("/usuarios");
  return { ok: true, mensaje: "La cuenta se creó correctamente." };
}

// RF-02: el administrador modifica el rol, el nombre o el estado de una cuenta.
export async function editarCuentaAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("administrador");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaEditarCuenta.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await editarCuenta(validacion.data, actor.id);
  if (!resultado.ok) {
    return {
      ok: false,
      mensaje: resultado.mensaje,
      errores: resultado.campo ? { [resultado.campo]: [resultado.mensaje] } : undefined,
      valores: valoresSeguros(datos),
    };
  }

  revalidatePath("/usuarios");
  return { ok: true, mensaje: "Los cambios se guardaron correctamente." };
}
