import { db, type ClienteDb, type TransaccionDb } from "@/lib/db";

export type EntradaBitacora = {
  usuarioId: number | null;
  entidad: string;
  entidadId?: string | number | null;
  accion: string;
  estadoAnterior?: unknown;
  estadoNuevo?: unknown;
};

function serializar(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  return typeof valor === "string" ? valor : JSON.stringify(valor);
}

/**
 * RF-07 y RF-20: deja constancia de un cambio con usuario, fecha y hora,
 * estado anterior y estado nuevo.
 */
export async function registrarBitacora(
  entrada: EntradaBitacora,
  cliente: ClienteDb | TransaccionDb = db,
) {
  await cliente.bitacora.create({
    data: {
      usuarioId: entrada.usuarioId,
      entidad: entrada.entidad,
      entidadId: entrada.entidadId == null ? null : String(entrada.entidadId),
      accion: entrada.accion,
      estadoAnterior: serializar(entrada.estadoAnterior),
      estadoNuevo: serializar(entrada.estadoNuevo),
    },
  });
}
