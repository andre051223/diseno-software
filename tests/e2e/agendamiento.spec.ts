import { expect, test, type Page } from "@playwright/test";
import {
  buscarHorarios,
  cerrarSesion,
  cuentas,
  fechaBogota,
  iniciarSesion,
  llenarDatosPaciente,
  reservarPrimerHorario,
} from "./ayudantes";

/** La recepcionista registra un paciente en ventanilla y abre su ficha. */
async function registrarEnVentanilla(pagina: Page, numero: string, nombres: string) {
  await pagina.goto("/pacientes/nuevo");
  await llenarDatosPaciente(pagina, {
    tipo: "CC",
    numero,
    nombres,
    apellidos: "Prueba Agenda",
    correo: `${nombres.toLowerCase()}.agenda@correo.test`,
  });
  await pagina.getByRole("button", { name: "Registrar paciente" }).click();
  await expect(pagina.getByRole("heading", { name: `${nombres} Prueba Agenda` })).toBeVisible();
}

test.describe("Agendamiento con cobertura (RF-12 a RF-23)", () => {
  test("el paciente agenda, reprograma y cancela su cita desde el portal", async ({ page }) => {
    await iniciarSesion(page, cuentas.paciente);
    await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Nueva cita" }).click();

    // RF-12 y RF-14: busca horarios libres y reserva uno.
    await buscarHorarios(page, { especialidad: "Dermatología", desde: fechaBogota(3), hasta: fechaBogota(10) });
    await reservarPrimerHorario(page);
    await expect(page.getByText("Le reservamos este horario mientras completa la cita.")).toBeVisible();

    // RF-21: el documento del paciente de demostración tiene cobertura vigente.
    await page.getByRole("button", { name: "Validar cobertura" }).click();
    await expect(page.getByText("Cobertura verificada")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar cita" }).click();

    // RF-15: comprobante con código único.
    await expect(page.getByText("Cita agendada", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Cita HSR-[A-Z0-9]{6}$/ })).toBeVisible();
    await expect(page.getByRole("article", { name: "Comprobante de cita" }).getByText("Dermatología")).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimir comprobante" })).toBeVisible();
    const codigo = (await page.locator("[data-codigo-cita]").textContent())?.trim();

    // RF-18: no puede agendar otra cita activa en la misma especialidad.
    await page.goto("/mis-citas/nueva");
    await page.getByLabel("Especialidad").selectOption({ label: "Dermatología" });
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Ya tiene una cita activa en esta especialidad")).toBeVisible();

    // RF-16: reprograma la cita a otro horario; el código no cambia.
    await page.goto("/mis-citas");
    await page.getByRole("link", { name: `Ver detalle de la cita ${codigo}` }).click();
    await page.getByRole("link", { name: "Reprogramar" }).click();
    await buscarHorarios(page, { desde: fechaBogota(11), hasta: fechaBogota(20) });
    await reservarPrimerHorario(page);
    await expect(page.getByRole("heading", { name: "Nuevo horario" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar reprogramación" }).click();
    await expect(page.getByText("Cita reprogramada", { exact: true })).toBeVisible();
    await expect(page.locator("[data-codigo-cita]")).toHaveText(codigo!);

    // RF-17: cancela con más de 24 horas de anticipación indicando el motivo.
    await page.getByRole("button", { name: "Cancelar la cita" }).click();
    await expect(page.getByText(/Escriba el motivo de la cancelación/)).toBeVisible();
    await page.getByLabel("Motivo de la cancelación").fill("Viaje fuera de la ciudad");
    await page.getByRole("button", { name: "Cancelar la cita" }).click();
    await expect(page.getByText("Cita cancelada", { exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: "Comprobante de cita" }).getByText("Cancelada")).toBeVisible();
  });

  test("RF-13 y RF-14: dos sesiones intentan reservar el mismo horario y solo una lo logra", async ({ browser }) => {
    const recepcion = await browser.newPage();
    const callcenter = await browser.newPage();

    await iniciarSesion(recepcion, cuentas.recepcionista);
    await registrarEnVentanilla(recepcion, "80111223", "Rosalba");
    await recepcion.getByRole("main").getByRole("link", { name: "Agendar cita" }).click();

    await iniciarSesion(callcenter, cuentas.agente);
    await callcenter.goto("/agendar");
    await callcenter.getByLabel("Documento o nombre del paciente").fill("52000003");
    await callcenter.getByRole("button", { name: "Buscar" }).click();
    await callcenter.getByRole("main").getByRole("link", { name: /^Agendar/ }).click();

    // Ambas sesiones ven la misma lista de horarios libres.
    const filtro = {
      especialidad: "Cardiología",
      medico: "María José Vargas Lozano",
      desde: fechaBogota(5),
      hasta: fechaBogota(12),
    };
    await buscarHorarios(recepcion, filtro);
    await buscarHorarios(callcenter, filtro);
    const horario = await recepcion.getByRole("radio").first().getAttribute("value");
    expect(await callcenter.getByRole("radio").first().getAttribute("value")).toBe(horario);

    // La recepcionista reserva primero; el agente telefónico ya no puede tomar ese horario.
    await reservarPrimerHorario(recepcion);
    await expect(recepcion.getByText("Le reservamos este horario mientras completa la cita.")).toBeVisible();
    await reservarPrimerHorario(callcenter);
    await expect(callcenter.getByText(/acaba de ser tomado por otra persona/)).toBeVisible();
    await expect(callcenter.locator(`input[type=radio][value="${horario}"]`)).toHaveCount(0);

    // La recepcionista completa la cita con el canal ventanilla.
    await recepcion.getByRole("button", { name: "Validar cobertura" }).click();
    await recepcion.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(recepcion.getByText("Cita agendada", { exact: true })).toBeVisible();
    await expect(recepcion.getByRole("article", { name: "Comprobante de cita" }).getByText("Ventanilla")).toBeVisible();

    await recepcion.close();
    await callcenter.close();
  });

  test("RF-22: sin afiliación vigente se ofrece agendar como particular", async ({ page }) => {
    await iniciarSesion(page, cuentas.recepcionista);
    // Los documentos que terminan en 0 no tienen afiliación vigente en la aseguradora simulada.
    await registrarEnVentanilla(page, "80111230", "Aurelio");
    await page.getByRole("main").getByRole("link", { name: "Agendar cita" }).click();
    await buscarHorarios(page, { especialidad: "Neurología", desde: fechaBogota(2), hasta: fechaBogota(9) });
    await reservarPrimerHorario(page);
    await page.getByRole("button", { name: "Validar cobertura" }).click();
    await expect(page.getByText("Sin afiliación vigente")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar cita" })).toHaveCount(0);
    await page.getByRole("button", { name: "Agendar como particular" }).click();
    await expect(page.getByText("Cita agendada", { exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: "Comprobante de cita" }).getByText("Particular", { exact: true })).toBeVisible();
    await cerrarSesion(page);

    // La decisión queda en la bitácora.
    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/bitacora?entidad=Cita");
    await expect(page.getByRole("cell", { name: "acepta particular" }).first()).toBeVisible();
  });

  test("RF-23: si la aseguradora no responde, la cita queda pendiente y se valida en segundo plano", async ({ page }) => {
    test.setTimeout(90_000);
    await iniciarSesion(page, cuentas.recepcionista);
    // Los documentos que terminan en 9 hacen que la aseguradora tarde más de 10 segundos.
    await registrarEnVentanilla(page, "80111239", "Leonor");
    await page.getByRole("main").getByRole("link", { name: "Agendar cita" }).click();
    await buscarHorarios(page, { especialidad: "Endocrinología", desde: fechaBogota(2), hasta: fechaBogota(9) });
    await reservarPrimerHorario(page);
    await page.getByRole("button", { name: "Validar cobertura" }).click();
    await expect(page.getByText("La aseguradora no respondió", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Confirmar cita pendiente de validación" }).click();
    await expect(page.getByText("Cita agendada, pendiente de validación")).toBeVisible();

    // El reintento en segundo plano obtiene la respuesta y la cita pasa a «Agendada».
    const comprobante = page.getByRole("article", { name: "Comprobante de cita" });
    await expect
      .poll(
        async () => {
          await page.reload();
          return comprobante.getByText("Agendada", { exact: true }).count();
        },
        { timeout: 30_000, intervals: [1_000, 2_000, 3_000] },
      )
      .toBe(1);
  });
});
