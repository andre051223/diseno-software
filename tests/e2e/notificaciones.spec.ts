import { expect, test } from "@playwright/test";
import {
  buscarHorarios,
  cerrarSesion,
  cuentas,
  fechaBogota,
  iniciarSesion,
  llenarDatosPaciente,
  reservarPrimerHorario,
} from "./ayudantes";

const TOKEN_TAREAS = "token-pruebas-e2e";

test.describe("Notificaciones y tareas programadas (RF-24 a RF-26)", () => {
  test("la ruta de tareas programadas exige el token", async ({ request }) => {
    expect((await request.post("/api/tareas")).status()).toBe(401);
    expect((await request.post("/api/tareas", { headers: { Authorization: "Bearer otro-token" } })).status()).toBe(401);

    const respuesta = await request.post("/api/tareas", { headers: { Authorization: `Bearer ${TOKEN_TAREAS}` } });
    expect(respuesta.ok()).toBe(true);
    const cuerpo = await respuesta.json();
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.resumen).toHaveProperty("recordatoriosEnviados");
  });

  test("el paciente se registra, agenda con cobertura y confirma su asistencia desde el recordatorio", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    // Se procesan antes los recordatorios pendientes de la semilla para que el de esta cita sea el más reciente.
    expect((await request.post("/api/tareas", { headers: { Authorization: `Bearer ${TOKEN_TAREAS}` } })).ok()).toBe(true);

    // RF-05: registro en el portal.
    const correo = "hernan.quintero@correo.test";
    await page.goto("/registro");
    await llenarDatosPaciente(page, {
      tipo: "CC",
      numero: "79123464",
      nombres: "Hernán",
      apellidos: "Quintero Salas",
      correo,
    });
    await page.getByLabel("Contraseña *", { exact: true }).fill("MiClave2026");
    await page.getByLabel("Confirme la contraseña").fill("MiClave2026");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByText("Su cuenta quedó creada.")).toBeVisible();

    // RF-12 a RF-15 y RF-21: agenda la primera cita disponible (dentro de las próximas 48 horas) con cobertura.
    await iniciarSesion(page, correo, "MiClave2026");
    await page.goto("/mis-citas/nueva");
    await buscarHorarios(page, { especialidad: "Medicina general", desde: fechaBogota(0), hasta: fechaBogota(2) });
    await reservarPrimerHorario(page);
    await page.getByRole("button", { name: "Validar cobertura" }).click();
    await expect(page.getByText("Cobertura verificada")).toBeVisible();
    await page.getByRole("button", { name: "Confirmar cita" }).click();
    await expect(page.getByText("Cita agendada", { exact: true })).toBeVisible();
    const codigo = (await page.locator("[data-codigo-cita]").textContent())?.trim() ?? "";
    expect(codigo).toMatch(/^HSR-[A-Z0-9]{6}$/);
    await cerrarSesion(page);

    // RF-25: el administrador ejecuta las tareas programadas y se envía el recordatorio.
    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/tareas");
    await page.getByRole("button", { name: "Ejecutar tareas programadas" }).click();
    await expect(page.getByText("Tareas ejecutadas")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/recordatorios? enviados?/).first()).toBeVisible();

    // RF-24: la bandeja de salida tiene el correo y el SMS de la cita agendada; RF-25: y los del recordatorio.
    await page.goto("/bandeja-salida");
    await expect(page.getByRole("listitem").filter({ hasText: `Cita agendada ${codigo}` })).toHaveCount(1);
    const recordatorio = page.getByRole("listitem").filter({ hasText: `Recordatorio de su cita ${codigo}` });
    await expect(recordatorio).toHaveCount(1);
    await expect(
      page.getByRole("listitem").filter({ hasText: "SMS" }).filter({ hasText: `recuerde su cita ${codigo}` }),
    ).toHaveCount(1);
    const texto = (await recordatorio.textContent()) ?? "";
    const enlace = texto.match(/http:\/\/localhost:\d+\/responder-cita\/[A-Za-z0-9_-]+\?accion=confirmar/)?.[0];
    expect(enlace).toBeTruthy();
    await cerrarSesion(page);

    // RF-26: el paciente abre el enlace sin iniciar sesión y confirma.
    await page.goto(enlace!);
    await expect(page.getByRole("heading", { name: `Su cita ${codigo}` })).toBeVisible();
    await expect(page.getByText("Agendada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar asistencia" }).click();
    await expect(page.getByText("Asistencia confirmada")).toBeVisible();
    await expect(page.getByText("Confirmada", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar asistencia" })).toHaveCount(0);

    // El cambio se refleja en el portal del paciente.
    await iniciarSesion(page, correo, "MiClave2026");
    await page.goto("/mis-citas");
    await page.getByRole("link", { name: `Ver detalle de la cita ${codigo}` }).click();
    await expect(page.getByRole("article", { name: "Comprobante de cita" }).getByText("Confirmada")).toBeVisible();
  });
});
