import { expect, test } from "@playwright/test";
import { CONTRASENA, cerrarSesion, cuentas, enviarCredenciales, iniciarSesion } from "./ayudantes";

test.describe("Autenticación y control de acceso (RF-01 a RF-04)", () => {
  test("cada rol entra a su pantalla de inicio y ve solo su menú", async ({ page }) => {
    const casos = [
      { correo: cuentas.administrador, url: /\/usuarios$/, menu: "Usuarios y roles", ajeno: "Reportes" },
      { correo: cuentas.coordinador, url: /\/coordinacion\/especialidades$/, menu: "Novedades", ajeno: "Usuarios y roles" },
      { correo: cuentas.director, url: /\/reportes$/, menu: "Reportes", ajeno: "Bitácora" },
      { correo: cuentas.recepcionista, url: /\/llegadas$/, menu: "Registro de llegada", ajeno: "Reportes" },
      { correo: cuentas.agente, url: /\/pacientes$/, menu: "Agendar cita", ajeno: "Registro de llegada" },
      { correo: cuentas.medico, url: /\/agenda-medico$/, menu: "Agenda del día", ajeno: "Pacientes" },
      { correo: cuentas.paciente, url: /\/mis-citas$/, menu: "Mis datos", ajeno: "Usuarios y roles" },
    ];

    for (const caso of casos) {
      await iniciarSesion(page, caso.correo);
      await expect(page).toHaveURL(caso.url);
      const menu = page.getByRole("navigation", { name: "Menú principal" });
      await expect(menu.getByRole("link", { name: caso.menu })).toBeVisible();
      await expect(menu.getByRole("link", { name: caso.ajeno })).toHaveCount(0);
      await cerrarSesion(page);
    }
  });

  test("un rol no puede abrir pantallas de otro escribiendo la dirección", async ({ page }) => {
    await iniciarSesion(page, cuentas.paciente);
    await expect(page).toHaveURL(/\/mis-citas$/);
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/mis-citas$/);
  });

  test("sin sesión, las pantallas internas llevan al inicio de sesión y luego regresan", async ({ page }) => {
    await page.goto("/bitacora");
    await expect(page).toHaveURL(/\/iniciar-sesion\?siguiente=%2Fbitacora/);
    await expect(page.getByText("Debe iniciar sesión para continuar.")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill(cuentas.administrador);
    await page.getByLabel("Contraseña").fill(CONTRASENA);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/bitacora$/);
  });

  test("tres intentos fallidos bloquean la cuenta y se envía un aviso", async ({ page }) => {
    const correo = "carlos.rodriguez1@correo.test";
    for (let i = 0; i < 2; i++) {
      await enviarCredenciales(page, correo, "incorrecta");
      await expect(page.getByText("El correo o la contraseña no son correctos.")).toBeVisible();
    }
    await enviarCredenciales(page, correo, "incorrecta");
    await expect(page.getByText(/La cuenta quedó bloqueada durante 15 minutos/)).toBeVisible();

    // Con la contraseña correcta tampoco puede ingresar mientras dure el bloqueo.
    await enviarCredenciales(page, correo, CONTRASENA);
    await expect(page.getByText(/La cuenta está bloqueada por seguridad/)).toBeVisible();

    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/bandeja-salida");
    const aviso = page.getByRole("listitem").filter({ hasText: correo });
    await expect(aviso.getByText("Su cuenta fue bloqueada temporalmente")).toBeVisible();

    await page.goto("/usuarios?q=carlos.rodriguez1");
    await expect(page.getByText(/Bloqueada hasta/)).toBeVisible();
  });

  test("el paciente recupera la contraseña con un enlace de un solo uso", async ({ page }) => {
    const correo = "sofia.martinez2@correo.test";
    await page.goto("/recuperar-contrasena");
    await page.getByLabel("Correo electrónico de su cuenta").fill(correo);
    await page.getByRole("button", { name: "Enviar enlace de recuperación" }).click();
    await expect(page.getByText("Solicitud recibida")).toBeVisible();

    // El administrador consulta la bandeja de salida simulada para obtener el enlace.
    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/bandeja-salida");
    const mensaje = page.getByRole("listitem").filter({ hasText: correo }).first();
    const texto = (await mensaje.textContent()) ?? "";
    const enlace = texto.match(/http:\/\/localhost:\d+\/restablecer-contrasena\/[A-Za-z0-9_-]+/)?.[0];
    expect(enlace).toBeTruthy();
    await cerrarSesion(page);

    await page.goto(enlace!);
    await page.getByRole("textbox", { name: "Nueva contraseña *", exact: true }).fill("NuevaClave2026");
    await page.getByLabel("Confirme la nueva contraseña").fill("NuevaClave2026");
    await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
    await expect(page.getByText("Su contraseña se cambió correctamente.")).toBeVisible();

    await iniciarSesion(page, correo, "NuevaClave2026");
    await expect(page).toHaveURL(/\/mis-citas$/);
    await cerrarSesion(page);

    // El mismo enlace ya no sirve.
    await page.goto(enlace!);
    await expect(page.getByText("Enlace no válido")).toBeVisible();
  });

  test("el administrador crea una cuenta interna con un rol", async ({ page }) => {
    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/usuarios/nueva");
    await page.getByLabel("Nombre completo").fill("Rosa Elena Pardo");
    await page.getByLabel("Correo electrónico").fill("rosa.pardo@hsr.test");
    await page.getByLabel("Rol").selectOption("recepcionista");
    await page.getByLabel("Contraseña inicial").fill("Recepcion2026");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("La cuenta se creó correctamente.")).toBeVisible();
    await cerrarSesion(page);

    await iniciarSesion(page, "rosa.pardo@hsr.test", "Recepcion2026");
    await expect(page).toHaveURL(/\/llegadas$/);
  });
});
