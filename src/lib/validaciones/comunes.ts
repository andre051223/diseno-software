import { z } from "zod";
import "@/lib/validaciones/idioma";

/** Estado que devuelven las Server Actions a los formularios. */
export type EstadoFormulario = {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string[] | undefined>;
  /** Valores enviados, para volver a mostrarlos cuando hay errores (sin contraseñas). */
  valores?: Record<string, string>;
};

export const estadoInicial: EstadoFormulario = {};

const CAMPOS_SENSIBLES = /contrasena|confirmacion|token/i;

/** Copia los valores del formulario excepto contraseñas y tokens. */
export function valoresSeguros(datos: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(datos).filter(([clave]) => !CAMPOS_SENSIBLES.test(clave)));
}

/** Convierte un error de Zod en el estado que entienden los formularios. */
export function erroresDeValidacion(
  error: z.ZodError,
  datos?: Record<string, string>,
): EstadoFormulario {
  return {
    ok: false,
    mensaje: "Revise los campos marcados.",
    errores: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
    valores: datos ? valoresSeguros(datos) : undefined,
  };
}

/** Lee un FormData como objeto plano de textos. */
export function datosDeFormulario(formData: FormData): Record<string, string> {
  const datos: Record<string, string> = {};
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === "string") datos[clave] = valor;
  }
  return datos;
}

/** Lee todos los valores de un campo repetido (por ejemplo, casillas con el mismo nombre). */
export function valoresMultiples(formData: FormData, clave: string): string[] {
  return formData.getAll(clave).filter((valor): valor is string => typeof valor === "string");
}

export const esquemaCorreo = z
  .string()
  .trim()
  .min(1, "Escriba el correo electrónico.")
  .pipe(z.email("Escriba un correo electrónico válido."))
  .transform((valor) => valor.toLowerCase());

export const esquemaContrasenaNueva = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .regex(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/, "La contraseña debe incluir al menos una letra.")
  .regex(/\d/, "La contraseña debe incluir al menos un número.");
