import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { cuentas, iniciarSesion } from "./ayudantes";

/** Ancho mínimo que debe soportar la interfaz, porque los pacientes agendan desde el teléfono. */
const ANCHO_MOVIL = 360;

/** Pantallas que se revisan con cada rol (sin sesión, las públicas). */
const pantallas: { rol: keyof typeof cuentas | null; rutas: string[] }[] = [
  { rol: null, rutas: ["/", "/iniciar-sesion", "/registro", "/recuperar-contrasena"] },
  { rol: "paciente", rutas: ["/mis-citas", "/mis-citas/nueva", "/mis-datos"] },
  { rol: "recepcionista", rutas: ["/llegadas", "/agendar", "/pacientes", "/pacientes/nuevo", "/pacientes/1"] },
  { rol: "agente", rutas: ["/pacientes", "/agendar"] },
  { rol: "medico", rutas: ["/agenda-medico"] },
  {
    rol: "coordinador",
    rutas: [
      "/coordinacion/especialidades",
      "/coordinacion/consultorios",
      "/coordinacion/medicos",
      "/coordinacion/medicos/nuevo",
      "/coordinacion/medicos/1",
      "/coordinacion/disponibilidad",
      "/coordinacion/novedades",
      "/coordinacion/novedades/1",
    ],
  },
  { rol: "director", rutas: ["/reportes"] },
  { rol: "administrador", rutas: ["/usuarios", "/usuarios/nueva", "/usuarios/1", "/bitacora", "/bandeja-salida", "/tareas"] },
];

/** Nombre legible de cada perfil para el título de la prueba. */
const nombresPerfil: Record<keyof typeof cuentas, string> = {
  administrador: "administrador",
  coordinador: "coordinador de agenda",
  director: "director médico",
  recepcionista: "recepcionista",
  agente: "agente telefónico",
  medico: "médico",
  paciente: "paciente",
};

/** Revisa la página con axe (WCAG 2.1 A y AA) y devuelve las fallas con su detalle. */
async function auditar(pagina: Page) {
  const resultado = await new AxeBuilder({ page: pagina }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return resultado.violations.map((falla) => ({
    regla: falla.id,
    impacto: falla.impact,
    descripcion: falla.help,
    elementos: falla.nodes.slice(0, 3).map((nodo) => nodo.target.join(" ")),
  }));
}

test.describe("Accesibilidad y diseño adaptable", () => {
  for (const { rol, rutas } of pantallas) {
    test(`pantallas de ${rol ? nombresPerfil[rol] : "acceso público"}: WCAG AA y sin desplazamiento horizontal a ${ANCHO_MOVIL} px`, async ({
      page,
    }) => {
      if (rol) await iniciarSesion(page, cuentas[rol]);
      await page.setViewportSize({ width: ANCHO_MOVIL, height: 800 });

      for (const ruta of rutas) {
        await page.goto(ruta);
        await expect(page.locator("main, #contenido").first()).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${ruta === "/" ? "/$" : ruta}`));

        expect(await auditar(page), `fallas de accesibilidad en ${ruta}`).toEqual([]);

        const anchoDocumento = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(anchoDocumento, `desplazamiento horizontal en ${ruta}`).toBeLessThanOrEqual(ANCHO_MOVIL);

        // El documento declara el idioma y la codificación.
        await expect(page.locator("html")).toHaveAttribute("lang", "es");
        expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
      }
    });
  }
});
