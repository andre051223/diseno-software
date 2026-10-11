import { z } from "zod";
import "@/lib/validaciones/idioma";
import { esquemaContrasenaNueva, esquemaCorreo } from "./comunes";

export const esquemaInicioSesion = z.object({
  correo: esquemaCorreo,
  contrasena: z.string().min(1, "Escriba la contraseña."),
});

export const esquemaSolicitudRecuperacion = z.object({
  correo: esquemaCorreo,
});

export const esquemaRestablecer = z
  .object({
    token: z.string().min(10, "El enlace no es válido."),
    contrasena: esquemaContrasenaNueva,
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden.",
  });
