import type { CanalNotificacion } from "@/generated/prisma/enums";
import { db, type ClienteDb, type TransaccionDb } from "@/lib/db";

export type NuevaNotificacion = {
  destinatario: string;
  canal: CanalNotificacion;
  tipo: string;
  asunto?: string;
  contenido: string;
  pacienteId?: number | null;
  citaId?: number | null;
  usuarioId?: number | null;
  /** Si se indica una fecha futura, el mensaje queda pendiente hasta esa fecha. */
  fechaProgramada?: Date;
};

/**
 * Registra un mensaje en la bandeja de salida simulada. Los mensajes inmediatos
 * se marcan como enviados en el mismo momento; los programados quedan pendientes
 * hasta que los procese la tarea programada.
 */
export async function registrarNotificacion(
  datos: NuevaNotificacion,
  cliente: ClienteDb | TransaccionDb = db,
  ahora: Date = new Date(),
) {
  const programada = datos.fechaProgramada ?? ahora;
  const inmediata = programada.getTime() <= ahora.getTime();
  return cliente.notificacion.create({
    data: {
      destinatario: datos.destinatario,
      canal: datos.canal,
      tipo: datos.tipo,
      asunto: datos.asunto ?? null,
      contenido: datos.contenido,
      pacienteId: datos.pacienteId ?? null,
      citaId: datos.citaId ?? null,
      usuarioId: datos.usuarioId ?? null,
      fechaProgramada: programada,
      fechaEnvio: inmediata ? ahora : null,
      estado: inmediata ? "enviada" : "pendiente",
    },
  });
}

/** URL base para construir los enlaces incluidos en los mensajes. */
export function urlAplicacion(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
