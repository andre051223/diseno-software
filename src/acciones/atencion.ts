"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/sesion";
import { esquemaIdCita } from "@/lib/validaciones/citas";
import { datosDeFormulario, type EstadoFormulario } from "@/lib/validaciones/comunes";
import { finalizarAtencion, iniciarAtencion, registrarLlegada } from "@/servicios/atencion";

/** RF-29: la recepción y la agenda del médico muestran el cambio. */
function revalidarAtencion(citaId: number) {
  revalidatePath("/llegadas");
  revalidatePath("/agenda-medico", "layout");
  revalidatePath(`/citas/${citaId}`);
  revalidatePath(`/mis-citas/${citaId}`);
}

// RF-28: la recepcionista registra la llegada del paciente; la cita queda «en sala».
export async function registrarLlegadaAccion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const actor = await requerirRol("recepcionista");
  const validacion = esquemaIdCita.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return { ok: false, mensaje: "La cita no es válida." };

  const resultado = await registrarLlegada(validacion.data.citaId, actor.id);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidarAtencion(validacion.data.citaId);
  return { ok: true, mensaje: "Llegada registrada. El paciente quedó en sala de espera." };
}

// RF-30: el médico registra el inicio de la atención.
export async function iniciarAtencionAccion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const actor = await requerirRol("medico");
  const validacion = esquemaIdCita.safeParse(datosDeFormulario(formData));
  if (!validacion.success || !actor.medicoId) return { ok: false, mensaje: "La cita no es válida." };

  const resultado = await iniciarAtencion(validacion.data.citaId, actor.medicoId, actor.id);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidarAtencion(validacion.data.citaId);
  return { ok: true, mensaje: "Se registró el inicio de la atención." };
}

// RF-30: el médico registra el fin de la atención y la cita queda «atendida».
export async function finalizarAtencionAccion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const actor = await requerirRol("medico");
  const validacion = esquemaIdCita.safeParse(datosDeFormulario(formData));
  if (!validacion.success || !actor.medicoId) return { ok: false, mensaje: "La cita no es válida." };

  const resultado = await finalizarAtencion(validacion.data.citaId, actor.medicoId, actor.id);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidarAtencion(validacion.data.citaId);
  return { ok: true, mensaje: "La atención terminó y la cita quedó como atendida." };
}
