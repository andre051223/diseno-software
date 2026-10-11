import { z } from "zod";

/**
 * Mensajes de Zod en español para cualquier validación que no defina su propio mensaje.
 * Cada archivo que valida datos importa este módulo para que la configuración aplique
 * tanto en el servidor como en el navegador.
 */
z.config(z.locales.es());
