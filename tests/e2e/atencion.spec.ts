import { expect, test } from "@playwright/test";
import { cerrarSesion, cuentas, iniciarSesion } from "./ayudantes";

/** Documento del paciente que la semilla deja con una cita confirmada hoy con la médica de demostración. */
const DOCUMENTO_LLEGADA = "52037011";

test.describe("Registro de llegada y atención (RF-28 a RF-30)", () => {
  test("la recepcionista registra la llegada y la médica atiende al paciente", async ({ page }) => {
    // RF-28: búsqueda por documento y registro de llegada.
    await iniciarSesion(page, cuentas.recepcionista);
    await expect(page).toHaveURL(/\/llegadas$/);
    await page.getByLabel("Documento del paciente o código de la cita").fill(DOCUMENTO_LLEGADA);
    await page.getByRole("button", { name: "Buscar" }).click();

    const resultado = page.getByRole("region", { name: "Resultado de la búsqueda" }).getByRole("listitem");
    await expect(resultado).toHaveCount(1);
    await expect(resultado.getByText("Confirmada", { exact: true })).toBeVisible();
    const paciente = (await resultado.locator("p.text-lg").textContent())?.trim() ?? "";
    expect(paciente).not.toBe("");

    await resultado.getByRole("button", { name: /^Registrar llegada/ }).click();
    await expect(resultado.getByText("En sala", { exact: true })).toBeVisible();
    await expect(resultado.getByText(/^Llegó a las \d{2}:\d{2}\.$/)).toBeVisible();
    await cerrarSesion(page);

    // RF-29: la médica ve al paciente en sala en su agenda del día.
    await iniciarSesion(page, cuentas.medico);
    await expect(page).toHaveURL(/\/agenda-medico$/);
    await expect(page.getByText("La lista se actualiza sola cada 30 segundos")).toBeVisible();
    const fila = page.getByRole("row").filter({ hasText: paciente });
    await expect(fila.getByText("En sala", { exact: true })).toBeVisible();

    // RF-30: inicio y fin de la atención, con enlace a la historia clínica simulada.
    await fila.getByRole("link", { name: `Atender a ${paciente}` }).click();
    await expect(page.getByRole("heading", { name: paciente })).toBeVisible();
    await page.getByRole("button", { name: "Iniciar atención" }).click();
    await expect(page.getByText(/^Atención en curso desde las \d{2}:\d{2}\.$/)).toBeVisible();
    await page.getByRole("button", { name: "Finalizar atención" }).click();
    await expect(page.getByText("Cita atendida")).toBeVisible();
    await expect(page.getByText("Atendida", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Abrir historia clínica (sistema externo simulado)" }).click();
    await expect(page.getByRole("heading", { name: "Historia clínica electrónica" })).toBeVisible();
    await expect(page.getByText(DOCUMENTO_LLEGADA)).toBeVisible();

    await page.getByRole("link", { name: "Volver a la agenda del día" }).click();
    await expect(page.getByRole("row").filter({ hasText: paciente }).getByText("Atendida", { exact: true })).toBeVisible();
  });
});
