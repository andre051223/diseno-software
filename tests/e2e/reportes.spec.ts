import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { cuentas, fechaBogota, iniciarSesion } from "./ayudantes";

test.describe("Reportes de gestión (RF-32 a RF-35)", () => {
  test("el director filtra los reportes y los exporta en CSV y PDF", async ({ page }) => {
    await iniciarSesion(page, cuentas.director);
    await expect(page).toHaveURL(/\/reportes$/);
    await expect(page.getByRole("heading", { name: "Reportes de gestión" })).toBeVisible();

    // RF-32 a RF-34: indicadores, gráficos y tablas con los datos de la semilla.
    await expect(page.getByRole("heading", { name: "Ocupación de la agenda" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inasistencias y cancelaciones" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tiempos de oportunidad y de espera" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ocupación: por especialidad" }).getByRole("row")).not.toHaveCount(0);
    await expect(page.getByRole("region", { name: "Inasistencias y cancelaciones: por canal de origen" })).toContainText(
      "Ventanilla",
    );

    // Filtros: una sola especialidad y un rango de catorce días.
    const desde = fechaBogota(-14);
    const hasta = fechaBogota(0);
    await page.getByLabel("Desde").fill(desde);
    await page.getByLabel("Hasta").fill(hasta);
    await page.getByLabel("Especialidad", { exact: true }).selectOption({ label: "Cardiología" });
    await page.getByRole("button", { name: "Aplicar filtros" }).click();
    await expect(page).toHaveURL(/especialidad=\d+/);
    await expect(page.getByText(/· Cardiología\.$/)).toBeVisible();
    const tablaEspecialidad = page.getByRole("region", { name: "Inasistencias y cancelaciones: por especialidad" });
    await expect(tablaEspecialidad.getByRole("rowheader", { name: "Cardiología" })).toBeVisible();
    await expect(tablaEspecialidad.getByRole("rowheader", { name: "Pediatría" })).toHaveCount(0);

    // RF-35: el CSV conserva los filtros aplicados.
    const [descargaCsv] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Descargar inasistencias y cancelaciones en CSV" }).click(),
    ]);
    expect(descargaCsv.suggestedFilename()).toBe(`reporte-ausentismo-${desde}-a-${hasta}.csv`);
    const csv = await readFile((await descargaCsv.path())!, "utf8");
    const [anio, mes, dia] = desde.split("-");
    expect(csv).toContain(`Desde: ${dia}/${mes}/${anio}`);
    expect(csv).toContain("Especialidad: Cardiología");
    expect(csv).toContain("Especialidad;Citas;Inasistencias;% inasistencias;Cancelaciones;% cancelaciones");

    // RF-35: el PDF se descarga como documento PDF.
    const [descargaPdf] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Descargar ocupación de la agenda en PDF" }).click(),
    ]);
    expect(descargaPdf.suggestedFilename()).toBe(`reporte-ocupacion-${desde}-a-${hasta}.pdf`);
    const pdf = await readFile((await descargaPdf.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("otro rol no puede descargar reportes", async ({ page }) => {
    await iniciarSesion(page, cuentas.recepcionista);
    const respuesta = await page.request.get("/reportes/exportar?reporte=ocupacion&formato=csv", { maxRedirects: 0 });
    expect(respuesta.status()).not.toBe(200);
  });
});
