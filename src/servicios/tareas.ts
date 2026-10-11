import { db } from "@/lib/db";
import { liberarReservasVencidas } from "./agendamiento";
import { marcarInasistencias } from "./atencion";
import { registrarBitacora } from "./bitacora";
import { reintentarCoberturasPendientes, type ConsultorAseguradora } from "./cobertura";
import { enviarRecordatorios } from "./recordatorios";

export type ResumenTareas = {
  reservasLiberadas: number;
  coberturas: { revisadas: number; cubiertas: number; rechazadas: number; sinRespuesta: number };
  recordatoriosEnviados: number;
  /** Puede faltar en ejecuciones anteriores a la fase 5. */
  inasistencias?: number;
  inicio: string;
  fin: string;
};

export type OrigenTareas = "api" | "panel";

/**
 * Procesos programados del sistema. Se ejecutan desde `/api/tareas` (protegida con token)
 * o con el botón del panel del administrador:
 * - RF-14: libera las reservas temporales vencidas.
 * - RF-23: reintenta la validación de las citas pendientes con la aseguradora.
 * - RF-25: envía los recordatorios de las citas de las próximas 48 horas (después de los
 *   reintentos, para que las citas recién validadas también lo reciban).
 * - RF-31: marca la inasistencia de las citas sin llegada 20 minutos después de su hora.
 * Cada ejecución queda en la bitácora con su resumen.
 */
export async function ejecutarTareasProgramadas(
  origen: OrigenTareas,
  usuarioId: number | null = null,
  opciones: { ahora?: Date; consultor?: ConsultorAseguradora } = {},
): Promise<ResumenTareas> {
  const inicio = new Date();
  const ahora = opciones.ahora ?? inicio;

  const reservasLiberadas = await liberarReservasVencidas(ahora);
  const coberturas = await reintentarCoberturasPendientes(opciones.consultor);
  const recordatoriosEnviados = await enviarRecordatorios(ahora);
  const inasistencias = await marcarInasistencias(ahora);

  const resumen: ResumenTareas = {
    reservasLiberadas,
    coberturas,
    recordatoriosEnviados,
    inasistencias,
    inicio: inicio.toISOString(),
    fin: new Date().toISOString(),
  };
  await registrarBitacora({
    usuarioId,
    entidad: "TareasProgramadas",
    accion: origen === "api" ? "ejecutar_tareas_api" : "ejecutar_tareas_panel",
    estadoNuevo: resumen,
  });
  return resumen;
}

/** Últimas ejecuciones registradas en la bitácora, para el panel del administrador. */
export async function ultimasEjecuciones(cantidad = 10) {
  const registros = await db.bitacora.findMany({
    where: { entidad: "TareasProgramadas" },
    include: { usuario: { select: { nombre: true } } },
    orderBy: [{ fecha: "desc" }, { id: "desc" }],
    take: cantidad,
  });
  return registros.map((registro) => ({
    id: registro.id,
    fecha: registro.fecha,
    origen: registro.accion === "ejecutar_tareas_api" ? ("api" as const) : ("panel" as const),
    usuario: registro.usuario?.nombre ?? null,
    resumen: leerResumen(registro.estadoNuevo),
  }));
}

function leerResumen(texto: string | null): ResumenTareas | null {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as ResumenTareas;
  } catch {
    return null;
  }
}
