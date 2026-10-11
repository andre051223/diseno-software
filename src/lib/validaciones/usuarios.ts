import { z } from "zod";
import "@/lib/validaciones/idioma";
import { listaRoles } from "@/lib/roles";
import type { Rol } from "@/generated/prisma/enums";
import { esquemaContrasenaNueva, esquemaCorreo } from "./comunes";

const esquemaRol = z.enum(listaRoles as [Rol, ...Rol[]], "Seleccione un rol válido.");

const idOpcional = z
  .string()
  .optional()
  .transform((valor) => (valor ? Number(valor) : null))
  .pipe(z.number().int().positive().nullable());

const esquemaNombre = z
  .string()
  .trim()
  .min(3, "Escriba el nombre completo.")
  .max(120, "El nombre es demasiado largo.");

function validarVinculo(
  datos: { rol: Rol; medicoId: number | null; pacienteId: number | null },
  contexto: z.RefinementCtx,
) {
  if (datos.rol === "medico" && !datos.medicoId) {
    contexto.addIssue({
      code: "custom",
      path: ["medicoId"],
      message: "Seleccione el médico al que pertenece la cuenta.",
    });
  }
  if (datos.rol === "paciente" && !datos.pacienteId) {
    contexto.addIssue({
      code: "custom",
      path: ["pacienteId"],
      message: "Seleccione el paciente al que pertenece la cuenta.",
    });
  }
}

/** RF-02: creación de una cuenta con uno de los siete roles. */
export const esquemaCrearCuenta = z
  .object({
    nombre: esquemaNombre,
    correo: esquemaCorreo,
    rol: esquemaRol,
    contrasena: esquemaContrasenaNueva,
    medicoId: idOpcional,
    pacienteId: idOpcional,
  })
  .superRefine(validarVinculo);

/** RF-02: modificación de una cuenta existente. */
export const esquemaEditarCuenta = z
  .object({
    id: z.coerce.number().int().positive(),
    nombre: esquemaNombre,
    rol: esquemaRol,
    activo: z
      .string()
      .optional()
      .transform((valor) => valor === "on"),
    desbloquear: z
      .string()
      .optional()
      .transform((valor) => valor === "on"),
    medicoId: idOpcional,
    pacienteId: idOpcional,
  })
  .superRefine(validarVinculo);

export type DatosCrearCuenta = z.infer<typeof esquemaCrearCuenta>;
export type DatosEditarCuenta = z.infer<typeof esquemaEditarCuenta>;
