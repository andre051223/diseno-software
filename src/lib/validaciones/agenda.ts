import { z } from "zod";
import "@/lib/validaciones/idioma";
import type { TipoNovedad } from "@/generated/prisma/enums";
import { listaTiposNovedad } from "@/lib/etiquetas";
import { esquemaCorreo } from "./comunes";

const textoObligatorio = (mensaje: string, maximo = 120) =>
  z.string().trim().min(2, mensaje).max(maximo, "El texto es demasiado largo.");

const textoOpcional = (maximo = 300) =>
  z
    .string()
    .trim()
    .max(maximo, "El texto es demasiado largo.")
    .optional()
    .transform((valor) => (valor ? valor : null));

const idPositivo = (mensaje: string) => z.coerce.number(mensaje).int(mensaje).positive(mensaje);

const esquemaHora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Escriba la hora en formato de 24 h (HH:mm).");

// ---------------------------------------------------------------------------
// RF-08: especialidades y consultorios
// ---------------------------------------------------------------------------

export const esquemaEspecialidad = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombre: textoObligatorio("Escriba el nombre de la especialidad.", 80),
  descripcion: textoOpcional(),
});

export const esquemaConsultorio = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombre: textoObligatorio("Escriba el nombre del consultorio.", 60),
  ubicacion: textoObligatorio("Escriba la ubicación del consultorio.", 120),
});

export const esquemaCambioEstado = z.object({
  id: z.coerce.number().int().positive(),
  activo: z.enum(["true", "false"]).transform((valor) => valor === "true"),
});

export type DatosEspecialidad = z.infer<typeof esquemaEspecialidad>;
export type DatosConsultorio = z.infer<typeof esquemaConsultorio>;

// ---------------------------------------------------------------------------
// RF-09: médicos
// ---------------------------------------------------------------------------

export const esquemaMedico = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombres: textoObligatorio("Escriba los nombres del médico.", 80),
  apellidos: textoObligatorio("Escriba los apellidos del médico.", 80),
  registroMedico: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,20}$/, "Escriba el registro médico (de 4 a 20 letras, números o guiones)."),
  correo: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor : undefined))
    .pipe(esquemaCorreo.optional())
    .transform((valor) => valor ?? null),
  telefono: z
    .string()
    .optional()
    .transform((valor) => (valor ? valor.replace(/[\s()-]/g, "") : null))
    .pipe(z.string().regex(/^\d{7,10}$/, "Escriba un teléfono de 7 a 10 dígitos.").nullable()),
  especialidadIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Seleccione al menos una especialidad."),
  activo: z
    .string()
    .optional()
    .transform((valor) => valor === "on"),
});

export type DatosMedico = z.infer<typeof esquemaMedico>;

// ---------------------------------------------------------------------------
// RF-10: disponibilidad semanal
// ---------------------------------------------------------------------------

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export const esquemaDisponibilidad = z
  .object({
    medicoId: idPositivo("Seleccione el médico."),
    consultorioId: idPositivo("Seleccione el consultorio."),
    dias: z
      .array(z.coerce.number().int().min(1).max(7))
      .min(1, "Seleccione al menos un día de la semana."),
    horaInicio: esquemaHora,
    horaFin: esquemaHora,
    duracionMinutos: z.coerce
      .number("Escriba la duración de la consulta.")
      .int("La duración debe ser un número entero de minutos.")
      .min(10, "La consulta debe durar al menos 10 minutos.")
      .max(120, "La consulta no puede durar más de 120 minutos."),
  })
  .superRefine((datos, contexto) => {
    if (minutos(datos.horaFin) <= minutos(datos.horaInicio)) {
      contexto.addIssue({
        code: "custom",
        path: ["horaFin"],
        message: "La hora de fin debe ser posterior a la hora de inicio.",
      });
    } else if (minutos(datos.horaFin) - minutos(datos.horaInicio) < datos.duracionMinutos) {
      contexto.addIssue({
        code: "custom",
        path: ["duracionMinutos"],
        message: "En el horario indicado no cabe ni una consulta de esa duración.",
      });
    }
  });

export type DatosDisponibilidad = z.infer<typeof esquemaDisponibilidad>;

// ---------------------------------------------------------------------------
// RF-11: novedades del médico
// ---------------------------------------------------------------------------

export const esquemaNovedad = z
  .object({
    medicoId: idPositivo("Seleccione el médico."),
    tipo: z.enum(listaTiposNovedad as [TipoNovedad, ...TipoNovedad[]], "Seleccione el tipo de novedad."),
    fechaInicio: z.iso.date("Escriba la fecha de inicio."),
    horaInicio: esquemaHora,
    fechaFin: z.iso.date("Escriba la fecha de fin."),
    horaFin: esquemaHora,
    motivo: textoOpcional(300),
  })
  .superRefine((datos, contexto) => {
    if (`${datos.fechaFin} ${datos.horaFin}` <= `${datos.fechaInicio} ${datos.horaInicio}`) {
      contexto.addIssue({
        code: "custom",
        path: ["fechaFin"],
        message: "El fin de la novedad debe ser posterior a su inicio.",
      });
    }
  });

export type DatosNovedad = z.infer<typeof esquemaNovedad>;

/** RF-27: novedad cuyas citas afectadas se cancelan. */
export const esquemaIdNovedad = z.object({ novedadId: idPositivo("La novedad no es válida.") });
