"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { datosDeFormulario, type EstadoFormulario } from "@/lib/validaciones/comunes";
import { esquemaCancelacionRecordatorio, esquemaConfirmacionRecordatorio } from "@/lib/validaciones/citas";
import { cancelarDesdeRecordatorio, confirmarDesdeRecordatorio } from "@/servicios/recordatorios";

/** RF-26: el cambio se refleja en recepción, en la agenda del médico y en el portal del paciente. */
function revalidarRespuesta() {
  revalidatePath("/llegadas");
  revalidatePath("/agenda-medico");
  revalidatePath("/mis-citas", "layout");
  revalidatePath("/citas", "layout");
}

// RF-26: el paciente confirma su asistencia desde el enlace del recordatorio.
export async function confirmarRecordatorioAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const validacion = esquemaConfirmacionRecordatorio.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return { ok: false, mensaje: "El enlace no es válido." };

  const resultado = await confirmarDesdeRecordatorio(validacion.data.token);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidarRespuesta();
  redirect(`/responder-cita/${validacion.data.token}?resultado=confirmada`);
}

// RF-26 y RF-17: el paciente cancela desde el recordatorio indicando el motivo; el horario queda libre.
export async function cancelarRecordatorioAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDeFormulario(formData);
  const validacion = esquemaCancelacionRecordatorio.safeParse(datos);
  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revise los campos marcados.",
      errores: { motivo: validacion.error.issues.filter((i) => i.path[0] === "motivo").map((i) => i.message) },
      valores: { motivo: datos.motivo ?? "" },
    };
  }

  const resultado = await cancelarDesdeRecordatorio(validacion.data.token, validacion.data.motivo);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje, valores: { motivo: validacion.data.motivo } };

  revalidarRespuesta();
  redirect(`/responder-cita/${validacion.data.token}?resultado=cancelada`);
}
