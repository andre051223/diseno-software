import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { esErrorUnico } from "@/lib/errores-db";
import { esquemaRegistroPortal, esquemaRegistroVentanilla, type DatosPaciente } from "@/lib/validaciones/pacientes";
import { validarCredenciales } from "@/servicios/autenticacion";
import { actualizarContacto, historialContacto, registrarPaciente } from "@/servicios/pacientes";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

let aseguradoraId: number;

function datosPaciente(cambios: Partial<DatosPaciente> = {}): DatosPaciente {
  return {
    tipoDocumento: "CC",
    numeroDocumento: "1032456789",
    nombres: "Ana María",
    apellidos: "Rojas Peña",
    fechaNacimiento: "1990-05-17",
    telefono: "3101234567",
    correo: "ana.rojas@correo.test",
    aseguradoraId,
    ...cambios,
  };
}

beforeEach(async () => {
  await limpiarBase();
  aseguradoraId = (await crearCatalogoPrueba()).aseguradora.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-05: registro de pacientes", () => {
  it("el formulario exige todos los datos solicitados", () => {
    const resultado = esquemaRegistroVentanilla.safeParse({});
    expect(resultado.success).toBe(false);
    const campos = new Set(resultado.error!.issues.map((problema) => problema.path[0]));
    for (const campo of [
      "tipoDocumento",
      "numeroDocumento",
      "nombres",
      "apellidos",
      "fechaNacimiento",
      "telefono",
      "correo",
      "aseguradoraId",
    ]) {
      expect(campos.has(campo)).toBe(true);
    }
  });

  it("rechaza fechas de nacimiento futuras, letras en la cédula y contraseñas que no coinciden", () => {
    const resultado = esquemaRegistroPortal.safeParse({
      ...datosPaciente({ numeroDocumento: "ABC123", fechaNacimiento: "2999-01-01" }),
      aseguradoraId: String(aseguradoraId),
      contrasena: "Clave1234",
      confirmacion: "Otra1234",
    });
    expect(resultado.success).toBe(false);
    const campos = resultado.error!.issues.map((problema) => problema.path[0]);
    expect(campos).toEqual(expect.arrayContaining(["numeroDocumento", "fechaNacimiento", "confirmacion"]));
  });

  it("por el portal crea el paciente con su cuenta y la contraseña elegida", async () => {
    const resultado = await registrarPaciente(datosPaciente(), { canal: "portal_web", contrasena: "Clave1234" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    const paciente = await db.paciente.findUniqueOrThrow({ where: { id: resultado.pacienteId } });
    expect(paciente.usuarioId).toBe(resultado.usuarioId);
    expect((await validarCredenciales("ana.rojas@correo.test", "Clave1234")).ok).toBe(true);

    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "registrar_paciente" } });
    expect(JSON.parse(registro.estadoNuevo!)).toMatchObject({ canal: "portal_web", numeroDocumento: "1032456789" });
    expect(registro.estadoNuevo).not.toContain("Clave1234");
  });

  it("en ventanilla crea la cuenta y envía un enlace de activación de un solo uso", async () => {
    const recepcionista = await crearUsuarioPrueba({ rol: "recepcionista" });
    const resultado = await registrarPaciente(datosPaciente(), { canal: "ventanilla", actorId: recepcionista.id });
    expect(resultado.ok && resultado.usuarioId).toBeTruthy();

    const aviso = await db.notificacion.findFirstOrThrow({ where: { tipo: "activacion_cuenta" } });
    expect(aviso.destinatario).toBe("ana.rojas@correo.test");
    expect(aviso.contenido).toMatch(/\/restablecer-contrasena\//);
    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "registrar_paciente" } });
    expect(registro.usuarioId).toBe(recepcionista.id);
  });

  it("en ventanilla registra sin cuenta propia al paciente cuyo correo ya usa otra cuenta", async () => {
    await registrarPaciente(datosPaciente(), { canal: "portal_web", contrasena: "Clave1234" });
    const resultado = await registrarPaciente(
      datosPaciente({ tipoDocumento: "TI", numeroDocumento: "1100223344", nombres: "Tomás", fechaNacimiento: "2015-03-02" }),
      { canal: "ventanilla" },
    );
    expect(resultado).toMatchObject({ ok: true, usuarioId: null });
  });

  it("por el portal no acepta un correo que ya tiene cuenta", async () => {
    await crearUsuarioPrueba({ correo: "ana.rojas@correo.test" });
    const resultado = await registrarPaciente(datosPaciente(), { canal: "portal_web", contrasena: "Clave1234" });
    expect(resultado).toMatchObject({ ok: false, campo: "correo" });
  });
});

describe("RF-06: documento único", () => {
  it("no acepta un tipo y número de documento ya existente", async () => {
    expect((await registrarPaciente(datosPaciente(), { canal: "ventanilla" })).ok).toBe(true);

    const repetido = await registrarPaciente(datosPaciente({ correo: "otro@correo.test", nombres: "Otra" }), {
      canal: "portal_web",
      contrasena: "Clave1234",
    });
    expect(repetido).toEqual({
      ok: false,
      mensaje: "Ya existe un paciente registrado con ese tipo y número de documento.",
      campo: "numeroDocumento",
    });
    expect(await db.paciente.count()).toBe(1);
    // Al fallar no queda una cuenta huérfana.
    expect(await db.usuario.count({ where: { correo: "otro@correo.test" } })).toBe(0);
  });

  it("el mismo número con otro tipo de documento sí se acepta", async () => {
    await registrarPaciente(datosPaciente(), { canal: "ventanilla" });
    const otroTipo = await registrarPaciente(datosPaciente({ tipoDocumento: "CE", correo: "ce@correo.test" }), {
      canal: "ventanilla",
    });
    expect(otroTipo.ok).toBe(true);
  });

  it("la base de datos también lo impide con el índice único compuesto", async () => {
    const base = {
      tipoDocumento: "CC" as const,
      numeroDocumento: "555666",
      nombres: "Uno",
      apellidos: "Prueba",
      fechaNacimiento: new Date("1990-01-01T05:00:00Z"),
      telefono: "3000000000",
      correo: "uno@correo.test",
      aseguradoraId,
    };
    await db.paciente.create({ data: base });
    const error = await db.paciente.create({ data: { ...base, nombres: "Dos" } }).catch((e: unknown) => e);
    expect(esErrorUnico(error)).toBe(true);
  });

  it("dos registros simultáneos con el mismo documento terminan con un solo paciente", async () => {
    const resultados = await Promise.all([
      registrarPaciente(datosPaciente({ correo: "a@correo.test" }), { canal: "ventanilla" }),
      registrarPaciente(datosPaciente({ correo: "b@correo.test" }), { canal: "ventanilla" }),
    ]);
    expect(resultados.filter((resultado) => resultado.ok)).toHaveLength(1);
    expect(await db.paciente.count()).toBe(1);
  });
});

describe("RF-07: actualización de datos de contacto", () => {
  it("guarda el cambio con el usuario, la fecha y los valores anterior y nuevo", async () => {
    const recepcionista = await crearUsuarioPrueba({ rol: "recepcionista" });
    const registro = await registrarPaciente(datosPaciente(), { canal: "portal_web", contrasena: "Clave1234" });
    if (!registro.ok) throw new Error("No se registró el paciente");

    const antes = new Date();
    const resultado = await actualizarContacto(
      registro.pacienteId,
      { telefono: "3209998877", correo: "ana.nueva@correo.test" },
      recepcionista.id,
    );
    expect(resultado).toEqual({ ok: true });

    const [cambio] = await historialContacto(registro.pacienteId);
    expect(cambio.usuario).toBe(recepcionista.nombre);
    expect(cambio.fecha.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);
    expect(cambio.anterior).toEqual({ telefono: "3101234567", correo: "ana.rojas@correo.test" });
    expect(cambio.nuevo).toEqual({ telefono: "3209998877", correo: "ana.nueva@correo.test" });

    // El correo de inicio de sesión se actualiza junto con el de contacto.
    expect((await validarCredenciales("ana.nueva@correo.test", "Clave1234")).ok).toBe(true);
  });

  it("no registra nada si los datos no cambiaron", async () => {
    const registro = await registrarPaciente(datosPaciente(), { canal: "ventanilla" });
    if (!registro.ok) throw new Error("No se registró el paciente");
    const actor = await crearUsuarioPrueba({ rol: "agente_telefonico" });
    const resultado = await actualizarContacto(
      registro.pacienteId,
      { telefono: "3101234567", correo: "ana.rojas@correo.test" },
      actor.id,
    );
    expect(resultado).toEqual({ ok: true, sinCambios: true });
    expect(await historialContacto(registro.pacienteId)).toHaveLength(0);
  });

  it("no permite usar el correo de otra cuenta", async () => {
    await crearUsuarioPrueba({ correo: "ocupado@correo.test" });
    const registro = await registrarPaciente(datosPaciente(), { canal: "portal_web", contrasena: "Clave1234" });
    if (!registro.ok) throw new Error("No se registró el paciente");
    const resultado = await actualizarContacto(
      registro.pacienteId,
      { telefono: "3101234567", correo: "ocupado@correo.test" },
      registro.usuarioId!,
    );
    expect(resultado).toMatchObject({ ok: false, campo: "correo" });
  });
});
