"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ResultadoCobertura } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { baseAsistente, construirUrl, filtrosDeConsulta, rutaDetalleCita } from "@/lib/rutas-citas";
import { requerirRol, type UsuarioActual } from "@/lib/sesion";
import { firmarCobertura, verificarCobertura } from "@/lib/token-cobertura";
import { datosDeFormulario, type EstadoFormulario } from "@/lib/validaciones/comunes";
import {
  esquemaCancelacion,
  esquemaConfirmacion,
  esquemaIdCita,
  esquemaReprogramacion,
  esquemaReserva,
  esquemaValidacionCobertura,
} from "@/lib/validaciones/citas";
import {
  aceptarParticularCita,
  canalSegunRol,
  cancelarCita,
  citaActivaEnEspecialidad,
  crearCita,
  liberarReserva,
  obtenerReservaVigente,
  registrarDecisionParticular,
  reprogramarCita,
  reservarEspacio,
} from "@/servicios/agendamiento";
import { consultarCobertura, reintentarCoberturaCita, solicitudParaPaciente } from "@/servicios/cobertura";

const ROLES_AGENDA = ["paciente", "recepcionista", "agente_telefonico"] as const;

/**
 * Paciente sobre el que actúa el usuario: el paciente agenda para sí mismo; el personal
 * de recepción y del centro de llamadas indica el paciente.
 */
async function pacienteDelActor(actor: UsuarioActual, pacienteIdFormulario?: number): Promise<number | null> {
  if (actor.rol === "paciente") return actor.pacienteId;
  if (!pacienteIdFormulario) return null;
  const paciente = await db.paciente.findUnique({ where: { id: pacienteIdFormulario }, select: { id: true } });
  return paciente?.id ?? null;
}

/** Cita que el usuario puede ver y modificar: el paciente solo las suyas. */
async function citaAutorizada(actor: UsuarioActual, citaId: number) {
  const cita = await db.cita.findUnique({ where: { id: citaId }, include: { espacio: true } });
  if (!cita) return null;
  if (actor.rol === "paciente" && cita.pacienteId !== actor.pacienteId) return null;
  return cita;
}

function revalidarCitas(pacienteId: number, citaId?: number) {
  revalidatePath("/mis-citas");
  revalidatePath(`/pacientes/${pacienteId}`);
  if (citaId) {
    revalidatePath(`/mis-citas/${citaId}`);
    revalidatePath(`/citas/${citaId}`);
  }
}

// ---------------------------------------------------------------------------
// RF-14: reserva temporal del horario elegido
// ---------------------------------------------------------------------------

// RF-14: bloquea el espacio elegido durante cinco minutos y lleva al paso de confirmación.
export async function reservarEspacioAccion(formData: FormData) {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaReserva.safeParse(datosDeFormulario(formData));
  if (!validacion.success) redirect(actor.rol === "paciente" ? "/mis-citas/nueva" : "/agendar");
  const datos = validacion.data;

  const pacienteId = await pacienteDelActor(actor, datos.pacienteId);
  if (!pacienteId) redirect(actor.rol === "paciente" ? "/mis-citas" : "/agendar");

  let especialidadId = datos.especialidadId;
  if (datos.citaId) {
    const cita = await citaAutorizada(actor, datos.citaId);
    if (!cita) redirect(actor.rol === "paciente" ? "/mis-citas" : "/agendar");
    especialidadId = cita.especialidadId;
  }

  const base = baseAsistente({ rol: actor.rol, pacienteId, citaId: datos.citaId });
  const volver = (error: string) =>
    construirUrl(base.ruta, { ...base.fijos, ...filtrosDeConsulta(datos.consulta), error });

  // RF-18: aviso temprano; la regla se vuelve a verificar al confirmar.
  if (!datos.citaId && (await citaActivaEnEspecialidad(pacienteId, especialidadId))) redirect(volver("cita-activa"));

  const resultado = await reservarEspacio(datos.espacioId, especialidadId, actor.id);
  if (!resultado.ok) redirect(volver("no-disponible"));

  redirect(
    construirUrl(`${base.ruta}/confirmar`, {
      ...base.fijos,
      ...filtrosDeConsulta(datos.consulta),
      espacio: datos.espacioId,
      especialidad: especialidadId,
    }),
  );
}

// RF-14: el usuario suelta el horario reservado para elegir otro.
export async function liberarReservaAccion(formData: FormData) {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaReserva.safeParse(datosDeFormulario(formData));
  if (!validacion.success) redirect(actor.rol === "paciente" ? "/mis-citas" : "/agendar");
  const datos = validacion.data;
  const pacienteId = await pacienteDelActor(actor, datos.pacienteId);
  if (!pacienteId) redirect(actor.rol === "paciente" ? "/mis-citas" : "/agendar");

  await liberarReserva(datos.espacioId, actor.id);
  const base = baseAsistente({ rol: actor.rol, pacienteId, citaId: datos.citaId });
  redirect(construirUrl(base.ruta, { ...base.fijos, ...filtrosDeConsulta(datos.consulta) }));
}

// ---------------------------------------------------------------------------
// RF-21 a RF-23: validación de cobertura y confirmación
// ---------------------------------------------------------------------------

export type EstadoCobertura = {
  error?: string;
  resultado?: ResultadoCobertura;
  detalle?: string;
  token?: string;
};

// RF-21: consulta a la aseguradora antes de confirmar. RF-23: espera como máximo 10 segundos.
export async function validarCoberturaAccion(_estado: EstadoCobertura, formData: FormData): Promise<EstadoCobertura> {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaValidacionCobertura.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return { error: "Los datos de la reserva no son válidos." };
  const { espacioId, especialidadId } = validacion.data;

  const pacienteId = await pacienteDelActor(actor, validacion.data.pacienteId);
  if (!pacienteId) return { error: "No encontramos al paciente." };
  if (!(await obtenerReservaVigente(espacioId, actor.id))) {
    return { error: "La reserva del horario venció. Vuelva a elegir un horario." };
  }

  const { resultado, detalle } = await consultarCobertura(await solicitudParaPaciente(pacienteId, especialidadId));
  const token = await firmarCobertura({ usuarioId: actor.id, pacienteId, especialidadId, espacioId, resultado, detalle });
  return { resultado, detalle, token };
}

// RF-15, RF-19 y RF-22: confirma la cita con el resultado de la aseguradora y muestra el comprobante.
export async function confirmarCitaAccion(_estado: EstadoCobertura, formData: FormData): Promise<EstadoCobertura> {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaConfirmacion.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return { error: "Vuelva a validar la cobertura." };

  const cobertura = await verificarCobertura(validacion.data.token);
  if (!cobertura || cobertura.usuarioId !== actor.id) {
    return { error: "La validación de cobertura venció. Vuelva a validarla." };
  }
  if (actor.rol === "paciente" && cobertura.pacienteId !== actor.pacienteId) return { error: "La reserva no es válida." };

  const requiereParticular = cobertura.resultado === "sin_vigencia" || cobertura.resultado === "sin_cobertura";
  const esParticular = requiereParticular && validacion.data.particular;
  if (requiereParticular && !esParticular) {
    return { error: "Sin cobertura de la aseguradora, la cita solo se puede agendar como particular." };
  }

  const resultado = await crearCita({
    pacienteId: cobertura.pacienteId,
    espacioId: cobertura.espacioId,
    especialidadId: cobertura.especialidadId,
    canal: canalSegunRol(actor.rol),
    creadaPorId: actor.id,
    resultadoCobertura: cobertura.resultado,
    detalleCobertura: cobertura.detalle,
    esParticular,
  });
  if (!resultado.ok) return { error: resultado.mensaje };

  // RF-22: la decisión de agendar como particular queda registrada.
  if (esParticular) {
    await registrarDecisionParticular({ ...cobertura, usuarioId: actor.id, acepta: true });
  }
  // RF-23: si la aseguradora no respondió, se reintenta en segundo plano después de responder.
  if (cobertura.resultado === "sin_respuesta") {
    const citaId = resultado.citaId;
    after(async () => {
      await reintentarCoberturaCita(citaId);
    });
  }

  revalidarCitas(cobertura.pacienteId, resultado.citaId);
  redirect(`${rutaDetalleCita(actor.rol, resultado.citaId)}?aviso=creada`);
}

// RF-22: el paciente no acepta agendar como particular; se registra la decisión y se suelta el horario.
export async function rechazarParticularAccion(formData: FormData) {
  const actor = await requerirRol(...ROLES_AGENDA);
  const cobertura = await verificarCobertura(String(formData.get("token") ?? ""));
  if (!cobertura || cobertura.usuarioId !== actor.id) redirect(actor.rol === "paciente" ? "/mis-citas" : "/agendar");

  await registrarDecisionParticular({ ...cobertura, usuarioId: actor.id, acepta: false });
  await liberarReserva(cobertura.espacioId, actor.id);
  redirect(actor.rol === "paciente" ? "/mis-citas?aviso=sin-agendar" : construirUrl("/agendar", { paciente: cobertura.pacienteId, aviso: "sin-agendar" }));
}

// RF-22: una cita pendiente que la aseguradora rechazó se mantiene como particular.
export async function aceptarParticularAccion(formData: FormData) {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaIdCita.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return;
  const cita = await citaAutorizada(actor, validacion.data.citaId);
  if (!cita) return;
  await aceptarParticularCita(cita.id, actor.id);
  revalidarCitas(cita.pacienteId, cita.id);
}

// ---------------------------------------------------------------------------
// RF-16 y RF-17: reprogramación y cancelación
// ---------------------------------------------------------------------------

// RF-16: cambia la cita al nuevo horario en una sola transacción.
export async function reprogramarCitaAccion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const actor = await requerirRol(...ROLES_AGENDA);
  const validacion = esquemaReprogramacion.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return { ok: false, mensaje: "Seleccione el nuevo horario." };

  const cita = await citaAutorizada(actor, validacion.data.citaId);
  if (!cita) return { ok: false, mensaje: "La cita no existe." };

  const resultado = await reprogramarCita({ ...validacion.data, actorId: actor.id, rol: actor.rol });
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidarCitas(cita.pacienteId, cita.id);
  redirect(`${rutaDetalleCita(actor.rol, cita.id)}?aviso=reprogramada`);
}

// RF-17: cancela con el motivo indicado; con menos de 24 horas el paciente debe llamar a recepción.
export async function cancelarCitaAccion(_estado: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const actor = await requerirRol(...ROLES_AGENDA);
  const datos = datosDeFormulario(formData);
  const validacion = esquemaCancelacion.safeParse(datos);
  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revise los campos marcados.",
      errores: { motivo: validacion.error.issues.filter((i) => i.path[0] === "motivo").map((i) => i.message) },
      valores: { motivo: datos.motivo ?? "" },
    };
  }

  const cita = await citaAutorizada(actor, validacion.data.citaId);
  if (!cita) return { ok: false, mensaje: "La cita no existe." };

  const resultado = await cancelarCita({ ...validacion.data, actorId: actor.id, rol: actor.rol });
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje, valores: { motivo: validacion.data.motivo } };

  revalidarCitas(cita.pacienteId, cita.id);
  redirect(`${rutaDetalleCita(actor.rol, cita.id)}?aviso=cancelada`);
}
