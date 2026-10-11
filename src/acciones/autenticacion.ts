"use server";

import { redirect } from "next/navigation";
import { inicioDeRol, puedeAcceder } from "@/lib/roles";
import { cerrarSesion, crearSesion } from "@/lib/sesion";
import {
  esquemaInicioSesion,
  esquemaRestablecer,
  esquemaSolicitudRecuperacion,
} from "@/lib/validaciones/autenticacion";
import {
  datosDeFormulario,
  erroresDeValidacion,
  valoresSeguros,
  type EstadoFormulario,
} from "@/lib/validaciones/comunes";
import {
  restablecerContrasena,
  solicitarRecuperacion,
  validarCredenciales,
} from "@/servicios/autenticacion";

// RF-01: valida las credenciales y abre la sesión con el rol del usuario.
// RF-03: el servicio bloquea la cuenta tras los intentos fallidos permitidos.
export async function iniciarSesionAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDeFormulario(formData);
  const validacion = esquemaInicioSesion.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await validarCredenciales(validacion.data.correo, validacion.data.contrasena);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje, valores: valoresSeguros(datos) };

  const { usuario } = resultado;
  await crearSesion({ usuarioId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });

  // Solo se respeta la ruta de regreso si es interna y pertenece al rol.
  const siguiente = datos.siguiente ?? "";
  const destino =
    siguiente.startsWith("/") && !siguiente.startsWith("//") && puedeAcceder(usuario.rol, siguiente)
      ? siguiente
      : inicioDeRol(usuario.rol);
  redirect(destino);
}

export async function cerrarSesionAccion() {
  await cerrarSesion();
  redirect("/iniciar-sesion");
}

// RF-04: registra en la bandeja de salida un enlace de un solo uso con vigencia de 30 minutos.
export async function solicitarRecuperacionAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDeFormulario(formData);
  const validacion = esquemaSolicitudRecuperacion.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  await solicitarRecuperacion(validacion.data.correo);
  return {
    ok: true,
    mensaje:
      "Si el correo corresponde a una cuenta de paciente, le enviamos un enlace para crear una nueva contraseña. El enlace vence en 30 minutos.",
  };
}

// RF-04: cambia la contraseña usando el enlace de un solo uso.
export async function restablecerContrasenaAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacion = esquemaRestablecer.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return erroresDeValidacion(validacion.error);

  const resultado = await restablecerContrasena(validacion.data.token, validacion.data.contrasena);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  redirect("/iniciar-sesion?restablecida=1");
}
