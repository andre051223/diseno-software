import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { configuracion } from "@/lib/configuracion";
import { db } from "@/lib/db";
import {
  restablecerContrasena,
  solicitarRecuperacion,
  validarCredenciales,
  verificarTokenRecuperacion,
} from "@/servicios/autenticacion";
import { crearUsuarioPrueba, limpiarBase } from "./ayudantes";

beforeEach(async () => {
  await limpiarBase();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-01: inicio de sesión", () => {
  it("abre la sesión con credenciales correctas y devuelve el rol", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "recepcionista" });
    const resultado = await validarCredenciales(usuario.correo, "Clave1234");
    expect(resultado).toEqual({ ok: true, usuario: { id: usuario.id, nombre: usuario.nombre, rol: "recepcionista" } });
  });

  it("no distingue mayúsculas en el correo", async () => {
    const usuario = await crearUsuarioPrueba();
    const resultado = await validarCredenciales(usuario.correo.toUpperCase(), "Clave1234");
    expect(resultado.ok).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const usuario = await crearUsuarioPrueba();
    const resultado = await validarCredenciales(usuario.correo, "otra-clave");
    expect(resultado.ok).toBe(false);
  });

  it("rechaza las cuentas inactivas aunque la contraseña sea correcta", async () => {
    const usuario = await crearUsuarioPrueba({ activo: false });
    const resultado = await validarCredenciales(usuario.correo, "Clave1234");
    expect(resultado.ok).toBe(false);
  });

  it("rechaza correos que no existen con el mismo mensaje", async () => {
    const usuario = await crearUsuarioPrueba();
    const inexistente = await validarCredenciales("nadie@hsr.test", "Clave1234");
    const incorrecta = await validarCredenciales(usuario.correo, "mala");
    expect(inexistente).toEqual(incorrecta);
  });
});

describe("RF-03: bloqueo por intentos fallidos", () => {
  it("bloquea la cuenta 15 minutos al tercer intento fallido y avisa por correo", async () => {
    const usuario = await crearUsuarioPrueba();
    const ahora = new Date("2026-10-12T14:00:00Z");

    for (let i = 0; i < configuracion.intentosFallidosAntesDeBloqueo; i++) {
      await validarCredenciales(usuario.correo, "incorrecta", ahora);
    }

    const bloqueado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(bloqueado.bloqueadoHasta?.getTime()).toBe(
      ahora.getTime() + configuracion.minutosBloqueoCuenta * 60_000,
    );

    const avisos = await db.notificacion.findMany({ where: { usuarioId: usuario.id, tipo: "bloqueo_cuenta" } });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].canal).toBe("correo");
    expect(avisos[0].destinatario).toBe(usuario.correo);
  });

  it("no permite ingresar durante el bloqueo, ni con la contraseña correcta", async () => {
    const usuario = await crearUsuarioPrueba();
    const ahora = new Date("2026-10-12T14:00:00Z");
    for (let i = 0; i < 3; i++) await validarCredenciales(usuario.correo, "incorrecta", ahora);

    const durante = await validarCredenciales(usuario.correo, "Clave1234", new Date(ahora.getTime() + 14 * 60_000));
    expect(durante.ok).toBe(false);
    if (!durante.ok) expect(durante.mensaje).toMatch(/bloqueada/);

    const despues = await validarCredenciales(usuario.correo, "Clave1234", new Date(ahora.getTime() + 16 * 60_000));
    expect(despues.ok).toBe(true);
  });

  it("un ingreso correcto reinicia el conteo de intentos", async () => {
    const usuario = await crearUsuarioPrueba();
    await validarCredenciales(usuario.correo, "incorrecta");
    await validarCredenciales(usuario.correo, "incorrecta");
    await validarCredenciales(usuario.correo, "Clave1234");
    await validarCredenciales(usuario.correo, "incorrecta");

    const actualizado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actualizado.intentosFallidos).toBe(1);
    expect(actualizado.bloqueadoHasta).toBeNull();
  });
});

describe("RF-04: recuperación de contraseña", () => {
  it("envía un enlace de un solo uso que permite cambiar la contraseña", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "paciente" });
    const token = await solicitarRecuperacion(usuario.correo);
    expect(token).toBeTypeOf("string");

    const mensaje = await db.notificacion.findFirstOrThrow({ where: { tipo: "recuperacion_contrasena" } });
    expect(mensaje.contenido).toContain(`/restablecer-contrasena/${token}`);

    expect(await restablecerContrasena(token!, "NuevaClave99")).toEqual({ ok: true });
    expect((await validarCredenciales(usuario.correo, "NuevaClave99")).ok).toBe(true);

    // Segundo uso del mismo enlace: debe fallar.
    const reutilizado = await restablecerContrasena(token!, "OtraClave77");
    expect(reutilizado.ok).toBe(false);
  });

  it("el enlace vence a los 30 minutos", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "paciente" });
    const ahora = new Date("2026-10-12T14:00:00Z");
    const token = (await solicitarRecuperacion(usuario.correo, ahora))!;

    expect(await verificarTokenRecuperacion(token, new Date(ahora.getTime() + 29 * 60_000))).not.toBeNull();
    expect(await verificarTokenRecuperacion(token, new Date(ahora.getTime() + 31 * 60_000))).toBeNull();
    const vencido = await restablecerContrasena(token, "NuevaClave99", new Date(ahora.getTime() + 31 * 60_000));
    expect(vencido.ok).toBe(false);
  });

  it("un enlace nuevo invalida el anterior", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "paciente" });
    const primero = (await solicitarRecuperacion(usuario.correo))!;
    await solicitarRecuperacion(usuario.correo);
    expect(await verificarTokenRecuperacion(primero)).toBeNull();
  });

  it("no genera enlaces para cuentas que no son de paciente", async () => {
    const usuario = await crearUsuarioPrueba({ rol: "administrador" });
    expect(await solicitarRecuperacion(usuario.correo)).toBeUndefined();
    expect(await db.notificacion.count()).toBe(0);
  });
});
