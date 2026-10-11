import { db } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import type { DatosConsultorio, DatosEspecialidad } from "@/lib/validaciones/agenda";
import { registrarBitacora } from "./bitacora";

type Resultado = { ok: true; id: number } | { ok: false; mensaje: string; campo?: string };

// ---------------------------------------------------------------------------
// Especialidades
// ---------------------------------------------------------------------------

/** RF-08: crea o edita una especialidad. El nombre es único. */
export async function guardarEspecialidad(datos: DatosEspecialidad, actorId: number): Promise<Resultado> {
  const anterior = datos.id ? await db.especialidad.findUnique({ where: { id: datos.id } }) : null;
  if (datos.id && !anterior) return { ok: false, mensaje: "La especialidad no existe." };

  try {
    const guardada = await db.$transaction(async (tx) => {
      const especialidad = anterior
        ? await tx.especialidad.update({
            where: { id: anterior.id },
            data: { nombre: datos.nombre, descripcion: datos.descripcion },
          })
        : await tx.especialidad.create({ data: { nombre: datos.nombre, descripcion: datos.descripcion } });
      await registrarBitacora(
        {
          usuarioId: actorId,
          entidad: "Especialidad",
          entidadId: especialidad.id,
          accion: anterior ? "editar_especialidad" : "crear_especialidad",
          estadoAnterior: anterior ? { nombre: anterior.nombre, descripcion: anterior.descripcion } : null,
          estadoNuevo: { nombre: especialidad.nombre, descripcion: especialidad.descripcion },
        },
        tx,
      );
      return especialidad;
    });
    return { ok: true, id: guardada.id };
  } catch (error) {
    if (esErrorUnico(error)) {
      return { ok: false, mensaje: "Ya existe una especialidad con ese nombre.", campo: "nombre" };
    }
    throw error;
  }
}

/**
 * RF-08: activa o inactiva una especialidad sin borrarla. Una especialidad inactiva
 * conserva su historial, pero no se ofrece para nuevas citas ni para nuevos médicos.
 */
export async function cambiarEstadoEspecialidad(id: number, activo: boolean, actorId: number): Promise<Resultado> {
  const anterior = await db.especialidad.findUnique({ where: { id } });
  if (!anterior) return { ok: false, mensaje: "La especialidad no existe." };
  if (anterior.activo === activo) return { ok: true, id };

  await db.$transaction(async (tx) => {
    await tx.especialidad.update({ where: { id }, data: { activo } });
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Especialidad",
        entidadId: id,
        accion: activo ? "activar_especialidad" : "inactivar_especialidad",
        estadoAnterior: { activo: anterior.activo },
        estadoNuevo: { activo },
      },
      tx,
    );
  });
  return { ok: true, id };
}

// ---------------------------------------------------------------------------
// Consultorios
// ---------------------------------------------------------------------------

/** RF-08: crea o edita un consultorio. El nombre es único. */
export async function guardarConsultorio(datos: DatosConsultorio, actorId: number): Promise<Resultado> {
  const anterior = datos.id ? await db.consultorio.findUnique({ where: { id: datos.id } }) : null;
  if (datos.id && !anterior) return { ok: false, mensaje: "El consultorio no existe." };

  try {
    const guardado = await db.$transaction(async (tx) => {
      const consultorio = anterior
        ? await tx.consultorio.update({
            where: { id: anterior.id },
            data: { nombre: datos.nombre, ubicacion: datos.ubicacion },
          })
        : await tx.consultorio.create({ data: { nombre: datos.nombre, ubicacion: datos.ubicacion } });
      await registrarBitacora(
        {
          usuarioId: actorId,
          entidad: "Consultorio",
          entidadId: consultorio.id,
          accion: anterior ? "editar_consultorio" : "crear_consultorio",
          estadoAnterior: anterior ? { nombre: anterior.nombre, ubicacion: anterior.ubicacion } : null,
          estadoNuevo: { nombre: consultorio.nombre, ubicacion: consultorio.ubicacion },
        },
        tx,
      );
      return consultorio;
    });
    return { ok: true, id: guardado.id };
  } catch (error) {
    if (esErrorUnico(error)) {
      return { ok: false, mensaje: "Ya existe un consultorio con ese nombre.", campo: "nombre" };
    }
    throw error;
  }
}

/**
 * RF-08: activa o inactiva un consultorio sin borrarlo. Un consultorio inactivo no
 * puede recibir nueva disponibilidad y sus espacios libres no se ofrecen al agendar;
 * las citas ya asignadas se conservan.
 */
export async function cambiarEstadoConsultorio(id: number, activo: boolean, actorId: number): Promise<Resultado> {
  const anterior = await db.consultorio.findUnique({ where: { id } });
  if (!anterior) return { ok: false, mensaje: "El consultorio no existe." };
  if (anterior.activo === activo) return { ok: true, id };

  await db.$transaction(async (tx) => {
    await tx.consultorio.update({ where: { id }, data: { activo } });
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "Consultorio",
        entidadId: id,
        accion: activo ? "activar_consultorio" : "inactivar_consultorio",
        estadoAnterior: { activo: anterior.activo },
        estadoNuevo: { activo },
      },
      tx,
    );
  });
  return { ok: true, id };
}
