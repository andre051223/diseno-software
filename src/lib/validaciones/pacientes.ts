import { z } from "zod";
import "@/lib/validaciones/idioma";
import type { TipoDocumento } from "@/generated/prisma/enums";
import { aFechaIso } from "@/lib/fechas";
import { listaTiposDocumento } from "@/lib/etiquetas";
import { esquemaContrasenaNueva, esquemaCorreo } from "./comunes";

const esquemaTipoDocumento = z.enum(
  listaTiposDocumento as [TipoDocumento, ...TipoDocumento[]],
  "Seleccione el tipo de documento.",
);

const esquemaNombrePropio = (campo: string) =>
  z
    .string()
    .trim()
    .min(2, `Escriba ${campo}.`)
    .max(80, `El texto de ${campo} es demasiado largo.`)
    .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/, `Escriba ${campo} solo con letras.`)
    .transform((valor) => valor.replace(/\s+/g, " "));

export const esquemaTelefono = z
  .string()
  .transform((valor) => valor.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\d{7,10}$/, "Escriba un teléfono de 7 a 10 dígitos, sin indicativo."));

/** RF-05: datos que se solicitan al registrar un paciente por cualquier canal. */
const camposPaciente = z.object({
  tipoDocumento: esquemaTipoDocumento,
  numeroDocumento: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Escriba el número de documento.")
    .regex(/^[A-Z0-9]{4,15}$/, "El número de documento debe tener de 4 a 15 letras o números, sin puntos ni espacios."),
  nombres: esquemaNombrePropio("los nombres"),
  apellidos: esquemaNombrePropio("los apellidos"),
  fechaNacimiento: z.iso.date("Escriba la fecha de nacimiento."),
  telefono: esquemaTelefono,
  correo: esquemaCorreo,
  aseguradoraId: z.coerce.number("Seleccione la aseguradora.").int().positive("Seleccione la aseguradora."),
});

function validarDatosPaciente(datos: z.infer<typeof camposPaciente>, contexto: z.RefinementCtx) {
  // Cédulas, tarjetas de identidad y registros civiles solo tienen números.
  if (["CC", "TI", "RC"].includes(datos.tipoDocumento) && !/^\d+$/.test(datos.numeroDocumento)) {
    contexto.addIssue({
      code: "custom",
      path: ["numeroDocumento"],
      message: "Para este tipo de documento escriba solo números.",
    });
  }
  if (datos.fechaNacimiento > aFechaIso(new Date())) {
    contexto.addIssue({
      code: "custom",
      path: ["fechaNacimiento"],
      message: "La fecha de nacimiento no puede ser posterior a hoy.",
    });
  }
  if (datos.fechaNacimiento < "1900-01-01") {
    contexto.addIssue({ code: "custom", path: ["fechaNacimiento"], message: "Revise el año de nacimiento." });
  }
}

/** RF-05: registro en ventanilla por la recepcionista. */
export const esquemaRegistroVentanilla = camposPaciente.superRefine(validarDatosPaciente);

/** RF-05: registro en el portal; además de los datos del paciente se crea la contraseña de la cuenta. */
export const esquemaRegistroPortal = camposPaciente
  .extend({ contrasena: esquemaContrasenaNueva, confirmacion: z.string() })
  .superRefine((datos, contexto) => {
    validarDatosPaciente(datos, contexto);
    if (datos.contrasena !== datos.confirmacion) {
      contexto.addIssue({ code: "custom", path: ["confirmacion"], message: "Las contraseñas no coinciden." });
    }
  });

/** RF-07: actualización de los datos de contacto. */
export const esquemaDatosContacto = z.object({
  telefono: esquemaTelefono,
  correo: esquemaCorreo,
});

export type DatosPaciente = z.infer<typeof esquemaRegistroVentanilla>;
export type DatosContacto = z.infer<typeof esquemaDatosContacto>;
