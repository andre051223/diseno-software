import type { EstadoEspacio } from "@/generated/prisma/enums";
import { db, type TransaccionDb } from "@/lib/db";
import { nombreMedico } from "@/lib/etiquetas";
import { nombresDiasSemana } from "@/lib/fechas";
import type { DatosDisponibilidad } from "@/lib/validaciones/agenda";
import { registrarBitacora } from "./bitacora";
import { calcularEspacios, finVentanaGeneracion, seSolapan, separarSolapados } from "./generador-espacios";

export type ResumenGeneracion = {
  /** Espacios nuevos creados. */
  generados: number;
  /** De los creados, los que quedaron bloqueados por una novedad del médico. */
  bloqueados: number;
  /** Candidatos descartados por cruzarse con otro espacio del consultorio o del médico. */
  omitidos: number;
};

type BloqueGuardado = {
  id: number;
  medicoId: number;
  consultorioId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  duracionMinutos: number;
};

const ESTADOS_SIN_USO: EstadoEspacio[] = ["libre", "reservado_temporal"];

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function horariosSeCruzan(a: { horaInicio: string; horaFin: string }, b: { horaInicio: string; horaFin: string }) {
  return minutos(a.horaInicio) < minutos(b.horaFin) && minutos(b.horaInicio) < minutos(a.horaFin);
}

/**
 * RF-10: genera los espacios de un bloque de disponibilidad desde ahora hasta el fin de
 * la ventana (ocho semanas), sin solaparlos con otros espacios del mismo consultorio ni
 * del mismo médico. Es idempotente: los espacios que el bloque ya tiene no se repiten.
 * Los espacios que caen dentro de una novedad del médico se crean bloqueados (RF-11).
 */
export async function generarEspaciosDeBloque(
  tx: TransaccionDb,
  bloque: BloqueGuardado,
  ahora: Date = new Date(),
): Promise<ResumenGeneracion> {
  const hasta = finVentanaGeneracion(ahora);
  const candidatos = calcularEspacios(bloque, ahora, hasta).filter((espacio) => espacio.inicio > ahora);
  if (candidatos.length === 0) return { generados: 0, bloqueados: 0, omitidos: 0 };

  const desde = candidatos[0].inicio;
  const existentes = await tx.espacio.findMany({
    where: {
      OR: [{ consultorioId: bloque.consultorioId }, { medicoId: bloque.medicoId }],
      inicio: { lt: hasta },
      fin: { gt: desde },
    },
    select: { inicio: true, fin: true, disponibilidadId: true },
  });

  // Los espacios que este mismo bloque ya generó no son un cruce: simplemente ya existen.
  const propios = new Set(
    existentes.filter((espacio) => espacio.disponibilidadId === bloque.id).map((espacio) => espacio.inicio.getTime()),
  );
  const pendientes = candidatos.filter((candidato) => !propios.has(candidato.inicio.getTime()));
  const { aceptados, omitidos } = separarSolapados(pendientes, existentes);

  const novedades = await tx.novedad.findMany({
    where: { medicoId: bloque.medicoId, inicio: { lt: hasta }, fin: { gt: desde } },
    select: { id: true, inicio: true, fin: true },
  });

  const nuevos = aceptados.map((intervalo) => {
    const novedad = novedades.find((item) => seSolapan(intervalo, item));
    return {
      medicoId: bloque.medicoId,
      consultorioId: bloque.consultorioId,
      disponibilidadId: bloque.id,
      inicio: intervalo.inicio,
      fin: intervalo.fin,
      estado: novedad ? ("bloqueado" as const) : ("libre" as const),
      novedadId: novedad?.id ?? null,
    };
  });
  if (nuevos.length > 0) await tx.espacio.createMany({ data: nuevos });

  return {
    generados: nuevos.length,
    bloqueados: nuevos.filter((espacio) => espacio.estado === "bloqueado").length,
    omitidos: omitidos.length,
  };
}

function sumar(a: ResumenGeneracion, b: ResumenGeneracion): ResumenGeneracion {
  return { generados: a.generados + b.generados, bloqueados: a.bloqueados + b.bloqueados, omitidos: a.omitidos + b.omitidos };
}

export type ResultadoDisponibilidad =
  | ({ ok: true } & ResumenGeneracion)
  | { ok: false; mensaje: string; campo?: string; conflictos?: string[] };

/**
 * RF-10: registra la disponibilidad semanal de un médico (uno o varios días con el mismo
 * horario, duración y consultorio) y genera sus espacios para las próximas ocho semanas.
 * Se rechaza si el horario se cruza con otro bloque activo del mismo consultorio o del médico.
 */
export async function crearDisponibilidad(
  datos: DatosDisponibilidad,
  actorId: number,
  ahora: Date = new Date(),
): Promise<ResultadoDisponibilidad> {
  const [medico, consultorio] = await Promise.all([
    db.medico.findUnique({ where: { id: datos.medicoId } }),
    db.consultorio.findUnique({ where: { id: datos.consultorioId } }),
  ]);
  if (!medico || !medico.activo) return { ok: false, mensaje: "El médico no existe o está inactivo.", campo: "medicoId" };
  if (!consultorio || !consultorio.activo) {
    return { ok: false, mensaje: "El consultorio no existe o está inactivo.", campo: "consultorioId" };
  }

  const dias = Array.from(new Set(datos.dias)).sort();
  const bloquesDelDia = await db.disponibilidadSemanal.findMany({
    where: {
      activo: true,
      diaSemana: { in: dias },
      OR: [{ consultorioId: datos.consultorioId }, { medicoId: datos.medicoId }],
    },
    include: { medico: true, consultorio: true },
  });

  const conflictos = bloquesDelDia
    .filter((bloque) => horariosSeCruzan(bloque, datos))
    .map((bloque) => {
      const dia = nombresDiasSemana[bloque.diaSemana].toLowerCase();
      const horario = `de ${bloque.horaInicio} a ${bloque.horaFin}`;
      return bloque.medicoId === datos.medicoId
        ? `El médico ya atiende el ${dia} ${horario} en ${bloque.consultorio.nombre}.`
        : `${bloque.consultorio.nombre} está asignado el ${dia} ${horario} a ${nombreMedico(bloque.medico)}.`;
    });
  if (conflictos.length > 0) {
    return { ok: false, mensaje: "El horario se cruza con otra disponibilidad.", conflictos };
  }

  const resumen = await db.$transaction(async (tx) => {
    let total: ResumenGeneracion = { generados: 0, bloqueados: 0, omitidos: 0 };
    for (const diaSemana of dias) {
      const bloque = await tx.disponibilidadSemanal.create({
        data: {
          medicoId: datos.medicoId,
          consultorioId: datos.consultorioId,
          diaSemana,
          horaInicio: datos.horaInicio,
          horaFin: datos.horaFin,
          duracionMinutos: datos.duracionMinutos,
        },
      });
      const parcial = await generarEspaciosDeBloque(tx, bloque, ahora);
      total = sumar(total, parcial);
      await registrarBitacora(
        {
          usuarioId: actorId,
          entidad: "DisponibilidadSemanal",
          entidadId: bloque.id,
          accion: "crear_disponibilidad",
          estadoNuevo: {
            medicoId: bloque.medicoId,
            consultorioId: bloque.consultorioId,
            diaSemana,
            horaInicio: bloque.horaInicio,
            horaFin: bloque.horaFin,
            duracionMinutos: bloque.duracionMinutos,
            ...parcial,
          },
        },
        tx,
      );
    }
    return total;
  });

  return { ok: true, ...resumen };
}

/**
 * RF-10: vuelve a generar los espacios de todos los bloques activos del médico para
 * mantener cubiertas las próximas ocho semanas (por ejemplo, al comenzar cada semana).
 */
export async function regenerarEspaciosMedico(
  medicoId: number,
  actorId: number,
  ahora: Date = new Date(),
): Promise<ResumenGeneracion> {
  const bloques = await db.disponibilidadSemanal.findMany({
    where: { medicoId, activo: true, consultorio: { activo: true }, medico: { activo: true } },
  });

  return db.$transaction(async (tx) => {
    let total: ResumenGeneracion = { generados: 0, bloqueados: 0, omitidos: 0 };
    for (const bloque of bloques) total = sumar(total, await generarEspaciosDeBloque(tx, bloque, ahora));
    await registrarBitacora(
      { usuarioId: actorId, entidad: "Medico", entidadId: medicoId, accion: "generar_espacios", estadoNuevo: total },
      tx,
    );
    return total;
  });
}

/**
 * RF-10: desactiva un bloque de disponibilidad. Sus espacios futuros libres se eliminan;
 * los que tienen citas activas se conservan para no afectar a los pacientes.
 */
export async function desactivarDisponibilidad(
  id: number,
  actorId: number,
  ahora: Date = new Date(),
): Promise<{ ok: true; eliminados: number; conservados: number } | { ok: false; mensaje: string }> {
  const bloque = await db.disponibilidadSemanal.findUnique({ where: { id } });
  if (!bloque || !bloque.activo) return { ok: false, mensaje: "El bloque no existe o ya estaba inactivo." };

  return db.$transaction(async (tx) => {
    await tx.disponibilidadSemanal.update({ where: { id }, data: { activo: false } });
    const sinUso = { disponibilidadId: id, inicio: { gt: ahora }, estado: { in: ESTADOS_SIN_USO } };
    // Los espacios sin ninguna cita se borran; los que tienen citas canceladas en su historial se bloquean.
    const eliminados = await tx.espacio.deleteMany({ where: { ...sinUso, citas: { none: {} } } });
    await tx.espacio.updateMany({
      where: sinUso,
      data: { estado: "bloqueado", reservadoHasta: null, reservadoPorId: null },
    });
    const conservados = await tx.espacio.count({
      where: { disponibilidadId: id, inicio: { gt: ahora }, estado: "ocupado" },
    });
    await registrarBitacora(
      {
        usuarioId: actorId,
        entidad: "DisponibilidadSemanal",
        entidadId: id,
        accion: "desactivar_disponibilidad",
        estadoAnterior: { activo: true },
        estadoNuevo: { activo: false, espaciosEliminados: eliminados.count, espaciosConCitas: conservados },
      },
      tx,
    );
    return { ok: true as const, eliminados: eliminados.count, conservados };
  });
}
