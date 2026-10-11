import { randomBytes, randomInt } from "node:crypto";

// Sin caracteres que se confunden al dictarlos o leerlos (0/O, 1/I/L).
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** RF-15: código legible de la cita, por ejemplo HSR-7K3QX2. */
export function generarCodigoCita(aleatorio: (maximo: number) => number = randomInt): string {
  let codigo = "";
  for (let i = 0; i < 6; i++) codigo += ALFABETO[aleatorio(ALFABETO.length)];
  return `HSR-${codigo}`;
}

/** Token aleatorio para los enlaces de respuesta al recordatorio (RF-25). */
export function generarTokenRespuesta(): string {
  return randomBytes(24).toString("base64url");
}
