import { z } from "zod";
import "@/lib/validaciones/idioma";
import {
  debeDemorarse,
  evaluarCobertura,
  milisegundosDemoraSimulada,
} from "@/servicios/aseguradora-simulada";

const esquemaSolicitud = z.object({
  tipoDocumento: z.string().min(1).max(5),
  numeroDocumento: z.string().min(3).max(20),
  aseguradora: z.string().min(1).max(120),
  especialidad: z.string().min(1).max(120),
  reintento: z.boolean().optional(),
});

/**
 * RF-21: servicio simulado de la aseguradora. Recibe el documento del afiliado y la
 * especialidad, y responde la vigencia y la cobertura de forma determinista
 * (ver `src/servicios/aseguradora-simulada.ts`).
 */
export async function POST(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "La solicitud no es un JSON válido." }, { status: 400 });
  }

  const validacion = esquemaSolicitud.safeParse(cuerpo);
  if (!validacion.success) {
    return Response.json({ error: "Faltan datos del afiliado o de la especialidad." }, { status: 400 });
  }

  // RF-23: los documentos terminados en 9 simulan una aseguradora que tarda más de lo permitido.
  if (debeDemorarse(validacion.data)) {
    await new Promise((resolver) => setTimeout(resolver, milisegundosDemoraSimulada));
  }

  return Response.json(evaluarCobertura(validacion.data));
}
