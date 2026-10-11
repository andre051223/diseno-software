import { z } from "zod";
import "@/lib/validaciones/idioma";
import { configuracion } from "@/lib/configuracion";

const idPositivo = (mensaje: string) => z.coerce.number(mensaje).int(mensaje).positive(mensaje);

const idOpcional = z
  .string()
  .optional()
  .transform((valor) => (valor ? Number(valor) : undefined))
  .pipe(z.number().int().positive().optional());

/** Días máximos del rango de búsqueda: la agenda solo existe para las próximas semanas (RF-10). */
export const diasMaximosBusqueda = configuracion.semanasGeneracionEspacios * 7;

// ---------------------------------------------------------------------------
// RF-12: búsqueda de espacios libres
// ---------------------------------------------------------------------------

export const esquemaBusquedaEspacios = z
  .object({
    especialidad: idPositivo("Seleccione la especialidad."),
    medico: idOpcional,
    desde: z.iso.date("Escriba la fecha inicial."),
    hasta: z.iso.date("Escriba la fecha final."),
  })
  .superRefine((datos, contexto) => {
    if (datos.hasta < datos.desde) {
      contexto.addIssue({
        code: "custom",
        path: ["hasta"],
        message: "La fecha final debe ser igual o posterior a la inicial.",
      });
      return;
    }
    const dias = (Date.parse(datos.hasta) - Date.parse(datos.desde)) / 86_400_000;
    if (dias > diasMaximosBusqueda) {
      contexto.addIssue({
        code: "custom",
        path: ["hasta"],
        message: `El rango no puede superar ${diasMaximosBusqueda} días.`,
      });
    }
  });

export type BusquedaEspacios = z.infer<typeof esquemaBusquedaEspacios>;

// ---------------------------------------------------------------------------
// RF-14: reserva temporal del espacio elegido
// ---------------------------------------------------------------------------

export const esquemaReserva = z.object({
  espacioId: idPositivo("Seleccione un horario."),
  especialidadId: idPositivo("Seleccione la especialidad."),
  pacienteId: idOpcional,
  citaId: idOpcional,
  // Filtros de la búsqueda, para volver a la misma lista si el horario ya no está disponible.
  consulta: z.string().max(300).optional(),
});

// ---------------------------------------------------------------------------
// RF-21 y RF-22: validación de cobertura y confirmación
// ---------------------------------------------------------------------------

export const esquemaValidacionCobertura = z.object({
  espacioId: idPositivo("El horario no es válido."),
  especialidadId: idPositivo("La especialidad no es válida."),
  pacienteId: idOpcional,
});

export const esquemaConfirmacion = z.object({
  token: z.string().min(10, "Vuelva a validar la cobertura."),
  // RF-22: decisión de agendar como particular cuando no hay vigencia o cobertura.
  particular: z
    .string()
    .optional()
    .transform((valor) => valor === "si"),
});

// ---------------------------------------------------------------------------
// RF-16 y RF-17: reprogramación y cancelación
// ---------------------------------------------------------------------------

export const esquemaReprogramacion = z.object({
  citaId: idPositivo("La cita no es válida."),
  espacioId: idPositivo("Seleccione el nuevo horario."),
});

export const esquemaCancelacion = z.object({
  citaId: idPositivo("La cita no es válida."),
  motivo: z
    .string()
    .trim()
    .min(5, "Escriba el motivo de la cancelación (mínimo 5 caracteres).")
    .max(300, "El motivo no puede superar 300 caracteres."),
});

export const esquemaIdCita = z.object({ citaId: idPositivo("La cita no es válida.") });

// ---------------------------------------------------------------------------
// RF-26: respuesta del paciente al recordatorio
// ---------------------------------------------------------------------------

const tokenRespuesta = z.string().min(10, "El enlace no es válido.").max(100, "El enlace no es válido.");

export const esquemaConfirmacionRecordatorio = z.object({ token: tokenRespuesta });

export const esquemaCancelacionRecordatorio = z.object({
  token: tokenRespuesta,
  motivo: esquemaCancelacion.shape.motivo,
});
