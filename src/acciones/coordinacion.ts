"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/sesion";
import {
  esquemaCambioEstado,
  esquemaConsultorio,
  esquemaDisponibilidad,
  esquemaEspecialidad,
  esquemaMedico,
  esquemaIdNovedad,
  esquemaNovedad,
} from "@/lib/validaciones/agenda";
import {
  datosDeFormulario,
  erroresDeValidacion,
  valoresMultiples,
  valoresSeguros,
  type EstadoFormulario,
} from "@/lib/validaciones/comunes";
import {
  cambiarEstadoConsultorio,
  cambiarEstadoEspecialidad,
  guardarConsultorio,
  guardarEspecialidad,
} from "@/servicios/catalogos";
import { crearDisponibilidad, desactivarDisponibilidad, regenerarEspaciosMedico } from "@/servicios/disponibilidad";
import { guardarMedico } from "@/servicios/medicos";
import { cancelarCitasPorNovedad, registrarNovedad } from "@/servicios/novedades";

type ErrorServicio = { mensaje: string; campo?: string };

function estadoDeError(resultado: ErrorServicio, datos: Record<string, string>): EstadoFormulario {
  return {
    ok: false,
    mensaje: resultado.mensaje,
    errores: resultado.campo ? { [resultado.campo]: [resultado.mensaje] } : undefined,
    valores: valoresSeguros(datos),
  };
}

function plural(cantidad: number, singular: string, varios: string) {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

// ---------------------------------------------------------------------------
// RF-08: especialidades y consultorios
// ---------------------------------------------------------------------------

// RF-08: el coordinador crea o edita una especialidad.
export async function guardarEspecialidadAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaEspecialidad.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await guardarEspecialidad(validacion.data, actor.id);
  if (!resultado.ok) return estadoDeError(resultado, datos);

  revalidatePath("/coordinacion/especialidades");
  if (validacion.data.id) return { ok: true, mensaje: "Los cambios se guardaron correctamente." };
  return { ok: true, mensaje: `La especialidad «${validacion.data.nombre}» se creó correctamente.` };
}

// RF-08: el coordinador activa o inactiva una especialidad sin borrarla.
export async function cambiarEstadoEspecialidadAccion(formData: FormData) {
  const actor = await requerirRol("coordinador_agenda");
  const validacion = esquemaCambioEstado.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return;
  await cambiarEstadoEspecialidad(validacion.data.id, validacion.data.activo, actor.id);
  revalidatePath("/coordinacion/especialidades");
}

// RF-08: el coordinador crea o edita un consultorio.
export async function guardarConsultorioAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaConsultorio.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await guardarConsultorio(validacion.data, actor.id);
  if (!resultado.ok) return estadoDeError(resultado, datos);

  revalidatePath("/coordinacion/consultorios");
  if (validacion.data.id) return { ok: true, mensaje: "Los cambios se guardaron correctamente." };
  return { ok: true, mensaje: `El consultorio «${validacion.data.nombre}» se creó correctamente.` };
}

// RF-08: el coordinador activa o inactiva un consultorio sin borrarlo.
export async function cambiarEstadoConsultorioAccion(formData: FormData) {
  const actor = await requerirRol("coordinador_agenda");
  const validacion = esquemaCambioEstado.safeParse(datosDeFormulario(formData));
  if (!validacion.success) return;
  await cambiarEstadoConsultorio(validacion.data.id, validacion.data.activo, actor.id);
  revalidatePath("/coordinacion/consultorios");
}

// ---------------------------------------------------------------------------
// RF-09: médicos
// ---------------------------------------------------------------------------

// RF-09: el coordinador registra o edita un médico y lo asocia a una o más especialidades.
export async function guardarMedicoAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const datos = datosDeFormulario(formData);
  const especialidadIds = valoresMultiples(formData, "especialidadIds");
  // Las casillas marcadas se devuelven unidas para volver a marcarlas si hay errores.
  const valores = { ...datos, especialidadIds: especialidadIds.join(",") };
  const validacion = esquemaMedico.safeParse({ ...datos, especialidadIds });
  if (!validacion.success) return erroresDeValidacion(validacion.error, valores);

  const resultado = await guardarMedico(validacion.data, actor.id);
  if (!resultado.ok) return estadoDeError(resultado, valores);

  revalidatePath("/coordinacion/medicos");
  if (validacion.data.id) return { ok: true, mensaje: "Los cambios se guardaron correctamente." };
  redirect(`/coordinacion/disponibilidad?medico=${resultado.id}&nuevo=1`);
}

// ---------------------------------------------------------------------------
// RF-10: disponibilidad semanal
// ---------------------------------------------------------------------------

// RF-10: el coordinador configura la disponibilidad semanal y se generan los espacios de las próximas 8 semanas.
export async function crearDisponibilidadAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const datos = datosDeFormulario(formData);
  const dias = valoresMultiples(formData, "dias");
  const valores = { ...datos, dias: dias.join(",") };
  const validacion = esquemaDisponibilidad.safeParse({ ...datos, dias });
  if (!validacion.success) return erroresDeValidacion(validacion.error, valores);

  const resultado = await crearDisponibilidad(validacion.data, actor.id);
  if (!resultado.ok) {
    return {
      ...estadoDeError(resultado, valores),
      errores: resultado.conflictos ? { horaInicio: resultado.conflictos } : undefined,
    };
  }

  revalidatePath("/coordinacion/disponibilidad");
  return { ok: true, mensaje: mensajeGeneracion(resultado) };
}

function mensajeGeneracion(resumen: { generados: number; bloqueados: number; omitidos: number }) {
  const partes = [`Se generaron ${plural(resumen.generados, "espacio", "espacios")} para las próximas 8 semanas.`];
  if (resumen.bloqueados > 0) {
    partes.push(`${plural(resumen.bloqueados, "quedó bloqueado", "quedaron bloqueados")} por novedades del médico.`);
  }
  if (resumen.omitidos > 0) {
    partes.push(
      `Se omitieron ${plural(resumen.omitidos, "espacio", "espacios")} porque se cruzaban con otros espacios del consultorio o del médico.`,
    );
  }
  return partes.join(" ");
}

// RF-10: completa los espacios de las próximas 8 semanas para todos los bloques activos del médico.
export async function regenerarEspaciosAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const medicoId = Number(formData.get("medicoId"));
  if (!Number.isInteger(medicoId) || medicoId <= 0) return { ok: false, mensaje: "Seleccione un médico." };

  const resumen = await regenerarEspaciosMedico(medicoId, actor.id);
  revalidatePath("/coordinacion/disponibilidad");
  if (resumen.generados === 0 && resumen.omitidos === 0) {
    return { ok: true, mensaje: "La agenda ya tenía todos los espacios de las próximas 8 semanas." };
  }
  return { ok: true, mensaje: mensajeGeneracion(resumen) };
}

// RF-10: desactiva un bloque de disponibilidad y libera sus espacios futuros sin citas.
export async function desactivarDisponibilidadAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: "El bloque no es válido." };

  const resultado = await desactivarDisponibilidad(id, actor.id);
  if (!resultado.ok) return { ok: false, mensaje: resultado.mensaje };

  revalidatePath("/coordinacion/disponibilidad");
  const conservados =
    resultado.conservados > 0
      ? ` Se conservan ${plural(resultado.conservados, "espacio", "espacios")} con citas asignadas.`
      : "";
  return {
    ok: true,
    mensaje: `El bloque quedó inactivo y se retiraron ${plural(resultado.eliminados, "espacio libre", "espacios libres")}.${conservados}`,
  };
}

// ---------------------------------------------------------------------------
// RF-11: novedades del médico
// ---------------------------------------------------------------------------

// RF-11: registra la novedad, bloquea los espacios afectados y muestra las citas ya asignadas.
export async function registrarNovedadAccion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await requerirRol("coordinador_agenda");
  const datos = datosDeFormulario(formData);
  const validacion = esquemaNovedad.safeParse(datos);
  if (!validacion.success) return erroresDeValidacion(validacion.error, datos);

  const resultado = await registrarNovedad(validacion.data, actor.id);
  if (!resultado.ok) return estadoDeError(resultado, datos);

  revalidatePath("/coordinacion/novedades");
  redirect(`/coordinacion/novedades/${resultado.id}?registrada=1`);
}

// RF-27: cancela las citas afectadas por la novedad y avisa a cada paciente con el motivo y un enlace para reprogramar.
export async function cancelarCitasNovedadAccion(formData: FormData) {
  const actor = await requerirRol("coordinador_agenda");
  const validacion = esquemaIdNovedad.safeParse(datosDeFormulario(formData));
  if (!validacion.success) redirect("/coordinacion/novedades");

  const resultado = await cancelarCitasPorNovedad(validacion.data.novedadId, actor.id);
  if (!resultado.ok) redirect("/coordinacion/novedades");

  revalidatePath("/coordinacion/novedades");
  redirect(`/coordinacion/novedades/${validacion.data.novedadId}?canceladas=${resultado.canceladas}`);
}
