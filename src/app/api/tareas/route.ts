import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ejecutarTareasProgramadas } from "@/servicios/tareas";

/** Compara el token recibido con `TAREAS_TOKEN` sin revelar información por el tiempo de respuesta. */
function tokenValido(recibido: string | null): boolean {
  const esperado = process.env.TAREAS_TOKEN;
  if (!esperado || !recibido) return false;
  const resumen = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(resumen(recibido), resumen(esperado));
}

/**
 * Procesos programados (RF-14, RF-23, RF-25 y RF-31): liberación de reservas vencidas, reintentos
 * de cobertura, recordatorios y marca de inasistencia. Un programador externo (cron) la invoca con el encabezado
 * `Authorization: Bearer <TAREAS_TOKEN>`.
 */
async function ejecutar(request: Request) {
  const encabezado = request.headers.get("authorization");
  const token = encabezado?.startsWith("Bearer ") ? encabezado.slice("Bearer ".length).trim() : null;
  if (!tokenValido(token)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const resumen = await ejecutarTareasProgramadas("api");
  // RF-26: los cambios de estado se reflejan en recepción y en la agenda del médico.
  revalidatePath("/", "layout");
  return Response.json({ ok: true, resumen });
}

export const GET = ejecutar;
export const POST = ejecutar;
