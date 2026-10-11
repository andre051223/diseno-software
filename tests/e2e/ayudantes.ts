import { expect, type Page } from "@playwright/test";

/** Contraseña de todas las cuentas creadas por la semilla. */
export const CONTRASENA = "Hospital2026";

export const cuentas = {
  administrador: "admin@hsr.test",
  coordinador: "coordinacion@hsr.test",
  director: "direccion@hsr.test",
  recepcionista: "recepcion@hsr.test",
  agente: "callcenter@hsr.test",
  medico: "medico@hsr.test",
  paciente: "paciente@hsr.test",
};

/** Llena el formulario de inicio de sesión y espera a que el panel cargue. */
export async function iniciarSesion(pagina: Page, correo: string, contrasena = CONTRASENA) {
  await enviarCredenciales(pagina, correo, contrasena);
  await expect(pagina).not.toHaveURL(/\/iniciar-sesion/);
}

/** Envía credenciales sin esperar éxito (para probar errores y bloqueos). */
export async function enviarCredenciales(pagina: Page, correo: string, contrasena: string) {
  await pagina.goto("/iniciar-sesion");
  await pagina.getByLabel("Correo electrónico").fill(correo);
  await pagina.getByLabel("Contraseña").fill(contrasena);
  await pagina.getByRole("button", { name: "Ingresar" }).click();
}

export async function cerrarSesion(pagina: Page) {
  await pagina.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(pagina).toHaveURL(/\/iniciar-sesion/);
}

/** Fecha aaaa-mm-dd en Bogotá, desplazada los días indicados desde hoy. */
export function fechaBogota(dias = 0) {
  return new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

/** Llena los datos del formulario de registro de paciente (RF-05). */
export async function llenarDatosPaciente(
  pagina: Page,
  datos: { tipo: string; numero: string; nombres: string; apellidos: string; correo: string },
) {
  await pagina.getByLabel("Tipo de documento").selectOption(datos.tipo);
  await pagina.getByLabel("Número de documento").fill(datos.numero);
  await pagina.getByLabel("Nombres").fill(datos.nombres);
  await pagina.getByLabel("Apellidos").fill(datos.apellidos);
  await pagina.getByLabel("Fecha de nacimiento").fill("1988-04-23");
  await pagina.getByLabel("Teléfono celular").fill("3157778899");
  await pagina.getByLabel("Correo electrónico").fill(datos.correo);
  await pagina.getByLabel("Aseguradora").selectOption({ label: "Salud Andina EPS" });
}

/** Pasos 1 a 3 del asistente: especialidad, médico y rango de fechas. */
export async function buscarHorarios(
  pagina: Page,
  datos: { especialidad?: string; medico?: string; desde: string; hasta: string },
) {
  if (datos.especialidad) {
    await pagina.getByLabel("Especialidad").selectOption({ label: datos.especialidad });
    await pagina.getByRole("button", { name: "Continuar" }).click();
  }
  if (datos.medico) await pagina.getByLabel("Médico").selectOption({ label: datos.medico });
  await pagina.getByLabel("Desde").fill(datos.desde);
  await pagina.getByLabel("Hasta").fill(datos.hasta);
  await pagina.getByRole("button", { name: "Ver horarios disponibles" }).click();
  await expect(pagina.getByRole("heading", { name: "Horarios disponibles" })).toBeVisible();
}

/** Elige el primer horario de la lista y lo reserva (RF-14). */
export async function reservarPrimerHorario(pagina: Page) {
  await pagina.getByRole("radio").first().check();
  await pagina.getByRole("button", { name: "Reservar horario y continuar" }).click();
}
