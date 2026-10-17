import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Ancho mínimo que debe soportar la interfaz. */
const ANCHO_MOVIL = 360;

test.describe("Página pública de diseño UML", () => {
  test("carga sin sesión y muestra los diez diagramas con texto alternativo", async ({ page }) => {
    await page.goto("/diseno-uml");
    await expect(page).toHaveURL(/\/diseno-uml$/);
    await expect(page.getByRole("heading", { level: 1, name: "Diseño UML del sistema" })).toBeVisible();

    const imagenes = page.locator("main img");
    await expect(imagenes).toHaveCount(10);
    for (const imagen of await imagenes.all()) {
      const alt = await imagen.getAttribute("alt");
      expect(alt?.trim(), "texto alternativo del diagrama").toBeTruthy();
    }

    // Cada SVG se sirve sin sesión y se puede abrir en tamaño completo.
    const enlaces = page.getByRole("link", { name: /Abrir en tamaño completo/ });
    await expect(enlaces).toHaveCount(10);
    for (const enlace of await enlaces.all()) {
      await expect(enlace).toHaveAttribute("target", "_blank");
      const respuesta = await page.request.get((await enlace.getAttribute("href"))!);
      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()["content-type"]).toContain("image/svg+xml");
    }
  });

  test("la tabla de trazabilidad tiene una fila por requisito", async ({ page }) => {
    await page.goto("/diseno-uml");
    const tabla = page.getByRole("region", { name: "Trazabilidad de requisitos a casos de uso" }).locator("table");
    await expect(tabla.locator("tbody tr")).toHaveCount(35);
    await expect(tabla.locator("tbody tr").first()).toContainText("RF-01");
    await expect(tabla.locator("tbody tr").last()).toContainText("CU-35");
  });

  test("pasa axe sin infracciones graves y no desborda a 360 px", async ({ page }) => {
    await page.setViewportSize({ width: ANCHO_MOVIL, height: 800 });
    await page.goto("/diseno-uml");
    await expect(page.locator("main img")).toHaveCount(10);
    await expect(page.locator("tbody tr")).toHaveCount(35);

    const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const graves = resultado.violations
      .filter((falla) => falla.impact === "serious" || falla.impact === "critical")
      .map((falla) => ({ regla: falla.id, impacto: falla.impact, descripcion: falla.help }));
    expect(graves).toEqual([]);

    const anchoDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(anchoDocumento).toBeLessThanOrEqual(ANCHO_MOVIL);
  });

  test("el inicio y el pie de página enlazan a la página", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main").getByRole("link", { name: "Diseño UML" })).toHaveAttribute("href", "/diseno-uml");
    await page.locator("footer").getByRole("link", { name: "Diseño UML" }).click();
    await expect(page).toHaveURL(/\/diseno-uml$/);
  });
});
