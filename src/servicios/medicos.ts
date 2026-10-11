import { db } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import type { DatosMedico } from "@/lib/validaciones/agenda";
import { registrarBitacora } from "./bitacora";

type Resultado = { ok: true; id: number } | { ok: false; mensaje: string; campo?: string };

/**
 * RF-09: registra o edita un médico y lo asocia a una o más especialidades
 * (relación muchos a muchos). Solo se pueden asignar especialidades activas, salvo
 * las que el médico ya tenía.
 */
export async function guardarMedico(datos: DatosMedico, actorId: number): Promise<Resultado> {
  const anterior = datos.id
    ? await db.medico.findUnique({ where: { id: datos.id }, include: { especialidades: true } })
    : null;
  if (datos.id && !anterior) return { ok: false, mensaje: "El médico no existe." };

  const especialidadIds = Array.from(new Set(datos.especialidadIds));
  const idsPrevios = new Set(anterior?.especialidades.map((especialidad) => especialidad.id) ?? []);
  const especialidades = await db.especialidad.findMany({ where: { id: { in: especialidadIds } } });
  const validas = especialidades.filter((especialidad) => especialidad.activo || idsPrevios.has(especialidad.id));
  if (validas.length !== especialidadIds.length) {
    return {
      ok: false,
      mensaje: "Alguna de las especialidades seleccionadas no existe o está inactiva.",
      campo: "especialidadIds",
    };
  }

  const resumen = (medico: {
    nombres: string;
    apellidos: string;
    registroMedico: string;
    correo: string | null;
    telefono: string | null;
    activo: boolean;
  }) => ({
    nombres: medico.nombres,
    apellidos: medico.apellidos,
    registroMedico: medico.registroMedico,
    correo: medico.correo,
    telefono: medico.telefono,
    activo: medico.activo,
  });

  const datosMedico = {
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    registroMedico: datos.registroMedico,
    correo: datos.correo,
    telefono: datos.telefono,
  };

  try {
    const guardado = await db.$transaction(async (tx) => {
      const medico = anterior
        ? await tx.medico.update({
            where: { id: anterior.id },
            data: {
              ...datosMedico,
              activo: datos.activo,
              especialidades: { set: especialidadIds.map((id) => ({ id })) },
            },
          })
        : await tx.medico.create({
            data: { ...datosMedico, especialidades: { connect: especialidadIds.map((id) => ({ id })) } },
          });

      await registrarBitacora(
        {
          usuarioId: actorId,
          entidad: "Medico",
          entidadId: medico.id,
          accion: anterior ? "editar_medico" : "registrar_medico",
          estadoAnterior: anterior
            ? { ...resumen(anterior), especialidades: [...idsPrevios].sort((a, b) => a - b) }
            : null,
          estadoNuevo: { ...resumen(medico), especialidades: [...especialidadIds].sort((a, b) => a - b) },
        },
        tx,
      );
      return medico;
    });
    return { ok: true, id: guardado.id };
  } catch (error) {
    if (esErrorUnico(error)) {
      return { ok: false, mensaje: "Ya existe un médico con ese registro médico.", campo: "registroMedico" };
    }
    throw error;
  }
}
