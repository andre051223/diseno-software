import { SignJWT, jwtVerify } from "jose";
import type { ResultadoCobertura } from "@/generated/prisma/enums";
import { obtenerClave } from "./token-sesion";

/**
 * RF-21: comprobante firmado del resultado de la aseguradora. Viaja en el formulario
 * entre la validación y la confirmación para que el navegador no pueda alterarlo ni
 * se tenga que consultar dos veces a la aseguradora.
 */
export type ComprobanteCobertura = {
  usuarioId: number;
  pacienteId: number;
  especialidadId: number;
  espacioId: number;
  resultado: ResultadoCobertura;
  detalle: string;
};

const RESULTADOS: ResultadoCobertura[] = ["cubierta", "sin_vigencia", "sin_cobertura", "sin_respuesta"];
const AUDIENCIA = "cobertura";

export async function firmarCobertura(datos: ComprobanteCobertura): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(obtenerClave());
}

export async function verificarCobertura(token: string): Promise<ComprobanteCobertura | null> {
  try {
    const { payload } = await jwtVerify(token, obtenerClave(), { algorithms: ["HS256"], audience: AUDIENCIA });
    const numeros = [payload.usuarioId, payload.pacienteId, payload.especialidadId, payload.espacioId];
    if (!numeros.every((valor) => typeof valor === "number" && Number.isInteger(valor))) return null;
    if (!RESULTADOS.includes(payload.resultado as ResultadoCobertura) || typeof payload.detalle !== "string") return null;
    return {
      usuarioId: payload.usuarioId as number,
      pacienteId: payload.pacienteId as number,
      especialidadId: payload.especialidadId as number,
      espacioId: payload.espacioId as number,
      resultado: payload.resultado as ResultadoCobertura,
      detalle: payload.detalle,
    };
  } catch {
    return null;
  }
}
