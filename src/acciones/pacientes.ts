"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/sesion";
import {
  datosDeFormulario,
  erroresDeValidacion,
  valoresSeguros,
  type EstadoFormulario,
} from "@/lib/validaciones/comunes";
import {
  esquemaDatosContacto,
  esquemaRegistroPortal,
  esquemaRegistroVentanilla,
} from "@/lib/validaciones/pacientes";
import { actualizarContacto, registrarPaciente, type ResultadoPaciente } from "@/servicios/pacientes";

function estadoDeError(
  resultado: Extract<ResultadoPaciente, { ok: false }> | { mensaje: string; campo?: string },
  datos: Record<string, string>,
): EstadoFormulario {
  return {
    ok: false,
    mensaje: resultado.mensaje,
    errores: resultado.campo ? { [resultado.campo]: [resultado.mensaje] } : undefined,
    valores: valoresSeguros(datos),
  };
}

// RF-05 y RF-06: registro del paciente desde el portal web (también usado desde el teléfono).
export async function registrarPacientePortalAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDeFormulario(formData);
  const validacion = esquemaRegistroPortal.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await registrarPaciente(validacion.data, {
    canal: "portal_web",
    contrasena: validacion.data.contrasena,
  });
  if (!resultado.ok) return estadoDeError(resultado, datos);

  redirect("/iniciar-sesion?registrado=1");
}

// RF-05 y RF-06: registro del paciente en ventanilla por la recepcionista.
export async function registrarPacienteVentanillaAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("recepcionista");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaRegistroVentanilla.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await registrarPaciente(validacion.data, { canal: "ventanilla", actorId: actor.id });
  if (!resultado.ok) return estadoDeError(resultado, datos);

  revalidatePath("/pacientes");
  // La página muestra el aviso según este código, sin copiar textos desde la URL.
  redirect(`/pacientes/${resultado.pacienteId}?registrado=${resultado.usuarioId ? "con-cuenta" : "sin-cuenta"}`);
}

// RF-07: el paciente actualiza sus datos de contacto; el cambio queda en la bitácora.
export async function actualizarMisDatosAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("paciente");
  if (!actor.pacienteId) return { ok: false, mensaje: "Su cuenta no está asociada a un paciente." };
  return guardarContacto(actor.pacienteId, actor.id, formData, "/mis-datos");
}

// RF-07: la recepcionista o el agente telefónico actualizan los datos de contacto de un paciente.
export async function actualizarContactoPacienteAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("recepcionista", "agente_telefonico");
  const pacienteId = Number(formData.get("pacienteId"));
  if (!Number.isInteger(pacienteId) || pacienteId <= 0) return { ok: false, mensaje: "El paciente no es válido." };
  return guardarContacto(pacienteId, actor.id, formData, `/pacientes/${pacienteId}`);
}

async function guardarContacto(
  pacienteId: number,
  actorId: number,
  formData: FormData,
  ruta: string,
): Promise<EstadoFormulario> {
  const datos = datosDeFormulario(formData);
  const validacion = esquemaDatosContacto.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await actualizarContacto(pacienteId, validacion.data, actorId);
  if (!resultado.ok) return estadoDeError(resultado, datos);

  revalidatePath(ruta);
  return {
    ok: true,
    mensaje: resultado.sinCambios ? "No hubo cambios que guardar." : "Los datos de contacto se actualizaron.",
  };
}
