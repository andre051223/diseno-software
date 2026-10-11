import { expect, test } from "@playwright/test";
import { cerrarSesion, cuentas, fechaBogota, iniciarSesion, llenarDatosPaciente } from "./ayudantes";

test.describe("Registro de pacientes (RF-05 a RF-07)", () => {
  test("el paciente se registra en el portal, actualiza su contacto y no puede repetir documento", async ({ page }) => {
    const paciente = {
      tipo: "CC",
      numero: "79123451",
      nombres: "Gloria Inés",
      apellidos: "Mendoza Rubio",
      correo: "gloria.mendoza@correo.test",
    };

    await page.goto("/registro");
    await llenarDatosPaciente(page, paciente);
    await page.getByLabel("Contraseña *", { exact: true }).fill("MiClave2026");
    await page.getByLabel("Confirme la contraseña").fill("MiClave2026");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByText("Su cuenta quedó creada.")).toBeVisible();

    await iniciarSesion(page, paciente.correo, "MiClave2026");
    await page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: "Mis datos" }).click();
    await expect(page.getByText("Cédula de ciudadanía 79123451")).toBeVisible();
    await expect(page.getByText("Aún no hay cambios registrados")).toBeVisible();

    // RF-07: el cambio de contacto queda con usuario, fecha y hora.
    await page.getByLabel("Teléfono celular").fill("3001112233");
    await page.getByRole("button", { name: "Guardar datos de contacto" }).click();
    await expect(page.getByText("Los datos de contacto se actualizaron.")).toBeVisible();
    const historial = page.getByRole("region", { name: "Historial de cambios de contacto" });
    await expect(historial.getByRole("cell", { name: "Gloria Inés Mendoza Rubio" })).toBeVisible();
    await expect(historial.getByText("3001112233")).toBeVisible();
    await cerrarSesion(page);

    // RF-06: el mismo tipo y número de documento no se acepta otra vez.
    await page.goto("/registro");
    await llenarDatosPaciente(page, { ...paciente, nombres: "Otra", correo: "otra.persona@correo.test" });
    await page.getByLabel("Contraseña *", { exact: true }).fill("MiClave2026");
    await page.getByLabel("Confirme la contraseña").fill("MiClave2026");
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(
      page.getByText("Ya existe un paciente registrado con ese tipo y número de documento.").first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("la recepcionista registra en ventanilla y el agente telefónico lo encuentra", async ({ page }) => {
    await iniciarSesion(page, cuentas.recepcionista);
    await page.goto("/pacientes/nuevo");
    await llenarDatosPaciente(page, {
      tipo: "CE",
      numero: "E445566",
      nombres: "Pierre",
      apellidos: "Dubois Martín",
      correo: "pierre.dubois@correo.test",
    });
    await page.getByRole("button", { name: "Registrar paciente" }).click();
    await expect(page.getByText(/El paciente quedó registrado\. Le enviamos al correo un enlace/)).toBeVisible();
    await expect(page.getByText("Con cuenta en el portal")).toBeVisible();
    await cerrarSesion(page);

    await iniciarSesion(page, cuentas.agente);
    await page.getByLabel("Documento o nombre del paciente").fill("E445566");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("1 paciente encontrado.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrar paciente" })).toHaveCount(0);
    await page.getByRole("link", { name: /Ver ficha/ }).click();
    await expect(page.getByRole("heading", { name: "Pierre Dubois Martín" })).toBeVisible();
    await cerrarSesion(page);

    // El enlace de activación quedó en la bandeja de salida.
    await iniciarSesion(page, cuentas.administrador);
    await page.goto("/bandeja-salida");
    await expect(
      page.getByRole("listitem").filter({ hasText: "pierre.dubois@correo.test" }).getByText("Active su acceso al portal de citas"),
    ).toBeVisible();
  });
});

test.describe("Administración de agenda (RF-08 a RF-11)", () => {
  test("el coordinador crea catálogos, un médico, su disponibilidad y una novedad", async ({ page }) => {
    await iniciarSesion(page, cuentas.coordinador);

    // RF-08: especialidad y consultorio nuevos; luego se inactiva y reactiva la especialidad.
    await page.goto("/coordinacion/especialidades");
    await page.getByLabel("Nombre de la especialidad").fill("Reumatología");
    await page.getByRole("button", { name: "Crear especialidad" }).click();
    await expect(page.getByText("La especialidad «Reumatología» se creó correctamente.")).toBeVisible();
    const fila = page.getByRole("row").filter({ hasText: "Reumatología" });
    await fila.getByRole("button", { name: /Inactivar/ }).click();
    await expect(fila.getByText("Inactiva", { exact: true })).toBeVisible();
    await fila.getByRole("button", { name: /Activar/ }).click();
    await expect(fila.getByText("Activa", { exact: true })).toBeVisible();

    await page.goto("/coordinacion/consultorios");
    await page.getByLabel("Nombre del consultorio").fill("Consultorio 301");
    await page.getByLabel("Ubicación").fill("Bloque C, piso 3");
    await page.getByRole("button", { name: "Crear consultorio" }).click();
    await expect(page.getByText("El consultorio «Consultorio 301» se creó correctamente.")).toBeVisible();

    // RF-09: médico con dos especialidades.
    await page.goto("/coordinacion/medicos/nuevo");
    await page.getByLabel("Nombres").fill("Hernán");
    await page.getByLabel("Apellidos").fill("Quiroga Lemus");
    await page.getByLabel("Registro médico").fill("RM-20500");
    await page.getByLabel("Reumatología").check();
    await page.getByLabel("Medicina interna").check();
    await page.getByRole("button", { name: "Registrar médico" }).click();
    await expect(page.getByText("El médico quedó registrado.")).toBeVisible();

    // RF-10: disponibilidad de lunes a viernes; se generan los espacios de las próximas 8 semanas.
    for (const dia of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"]) {
      await page.getByLabel(dia, { exact: true }).check();
    }
    await page.getByLabel("Hora de inicio").fill("07:00");
    await page.getByLabel("Hora de fin").fill("09:00");
    await page.getByLabel("Duración de la consulta (minutos)").fill("30");
    await page.getByLabel("Consultorio", { exact: false }).selectOption({ label: "Consultorio 301 (Bloque C, piso 3)" });
    await page.getByRole("button", { name: "Guardar y generar espacios" }).click();
    await expect(page.getByText(/Se generaron \d+ espacios para las próximas 8 semanas\./)).toBeVisible();
    await expect(page.getByRole("region", { name: "Bloques de disponibilidad semanal" }).getByRole("row")).toHaveCount(6);

    // RF-10: otro médico no puede usar el mismo consultorio a la misma hora.
    await page.goto("/coordinacion/disponibilidad?medico=1");
    await page.getByLabel("Lunes", { exact: true }).check();
    await page.getByLabel("Hora de inicio").fill("08:00");
    await page.getByLabel("Hora de fin").fill("10:00");
    await page.getByLabel("Consultorio", { exact: false }).selectOption({ label: "Consultorio 301 (Bloque C, piso 3)" });
    await page.getByRole("button", { name: "Guardar y generar espacios" }).click();
    await expect(page.getByText("El horario se cruza con otra disponibilidad.")).toBeVisible();
    await expect(page.getByText(/Consultorio 301 está asignado el lunes de 07:00 a 09:00/)).toBeVisible();

    // RF-11: novedad de una semana; se bloquean los espacios del periodo.
    await page.goto("/coordinacion/novedades");
    await page.getByLabel("Médico").selectOption({ label: "Quiroga Lemus, Hernán" });
    await page.getByLabel("Tipo de novedad").selectOption("vacaciones");
    await page.getByLabel("Fecha de inicio").fill(fechaBogota(1));
    await page.getByLabel("Fecha de fin").fill(fechaBogota(7));
    await page.getByRole("button", { name: "Registrar novedad y bloquear espacios" }).click();
    await expect(page).toHaveURL(/\/coordinacion\/novedades\/\d+\?registrada=1$/);
    await expect(page.getByRole("heading", { name: "Vacaciones de Hernán Quiroga Lemus" })).toBeVisible();
    await expect(page.getByText(/se bloquearon 20 espacios del médico/)).toBeVisible();
    await expect(page.getByText("No hay citas asignadas en este periodo")).toBeVisible();
  });

  test("la novedad de la semilla lista las citas ya asignadas", async ({ page }) => {
    await iniciarSesion(page, cuentas.coordinador);
    await page.goto("/coordinacion/novedades");
    await page
      .getByRole("row")
      .filter({ hasText: "Andrés Felipe Rodríguez Peña" })
      .getByRole("link", { name: /Ver detalle/ })
      .click();
    await expect(page.getByRole("heading", { name: /Capacitación de Andrés Felipe Rodríguez Peña/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Citas ya asignadas en el periodo" })).toBeVisible();
  });
});
