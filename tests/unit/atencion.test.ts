import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { EstadoCita } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  agendaDelDia,
  buscarCitasParaLlegada,
  evaluarLlegada,
  finalizarAtencion,
  iniciarAtencion,
  marcarInasistencias,
  registrarLlegada,
} from "@/servicios/atencion";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

// Lunes 12 de octubre de 2026, 08:00 en Bogotá.
const AHORA = new Date("2026-10-12T13:00:00Z");
const enMinutos = (minutos: number) => new Date(AHORA.getTime() + minutos * 60_000);

let catalogo: Awaited<ReturnType<typeof crearCatalogoPrueba>>;
let recepcionistaId: number;
let medicoUsuarioId: number;
let pacienteId: number;
let contador = 0;

/** Crea una cita en el estado indicado para el médico A, con inicio a los minutos dados desde AHORA. */
async function crearCitaEn(minutos: number, estado: EstadoCita = "confirmada", medico: "A" | "B" = "A") {
  contador++;
  const espacio = await db.espacio.create({
    data: {
      medicoId: medico === "A" ? catalogo.medicoA.id : catalogo.medicoB.id,
      consultorioId: medico === "A" ? catalogo.consultorioA.id : catalogo.consultorioB.id,
      inicio: enMinutos(minutos),
      fin: enMinutos(minutos + 20),
      estado: "ocupado",
    },
  });
  return db.cita.create({
    data: {
      codigo: `HSR-T${String(contador).padStart(5, "0")}`,
      pacienteId,
      espacioId: espacio.id,
      espacioActivoId: estado === "cancelada" ? null : espacio.id,
      especialidadId: catalogo.especialidad.id,
      estado,
      canal: "ventanilla",
      creadaPorId: recepcionistaId,
      tokenRespuesta: `token-${contador}-${Date.now()}`,
    },
  });
}

beforeEach(async () => {
  await limpiarBase();
  catalogo = await crearCatalogoPrueba();
  recepcionistaId = (await crearUsuarioPrueba({ rol: "recepcionista" })).id;
  medicoUsuarioId = (await crearUsuarioPrueba({ rol: "medico" })).id;
  pacienteId = (
    await db.paciente.create({
      data: {
        tipoDocumento: "CC",
        numeroDocumento: "52037011",
        nombres: "Carlos",
        apellidos: "Rodríguez Gómez",
        fechaNacimiento: new Date("1980-01-15T05:00:00Z"),
        telefono: "3001234567",
        correo: "carlos@correo.test",
        aseguradoraId: catalogo.aseguradora.id,
      },
    })
  ).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-28: registro de llegada", () => {
  it("encuentra las citas de hoy por documento o por código, sin importar mayúsculas", async () => {
    const hoy = await crearCitaEn(60);
    await crearCitaEn(60 * 24 * 2, "agendada"); // otro día: no aparece

    const porDocumento = await buscarCitasParaLlegada(" 52037011 ", AHORA);
    expect(porDocumento.map((cita) => cita.id)).toEqual([hoy.id]);
    const porCodigo = await buscarCitasParaLlegada(hoy.codigo.toLowerCase(), AHORA);
    expect(porCodigo.map((cita) => cita.id)).toEqual([hoy.id]);
    expect(await buscarCitasParaLlegada("99999999", AHORA)).toEqual([]);
  });

  it("registra la llegada: la cita queda «en sala» con la hora y en la bitácora", async () => {
    const cita = await crearCitaEn(30);
    expect(await registrarLlegada(cita.id, recepcionistaId, AHORA)).toEqual({ ok: true });

    const actualizada = await db.cita.findUniqueOrThrow({ where: { id: cita.id } });
    expect(actualizada.estado).toBe("en_sala");
    expect(actualizada.horaLlegada).toEqual(AHORA);
    expect(await db.bitacora.count({ where: { accion: "registrar_llegada", usuarioId: recepcionistaId } })).toBe(1);

    // Una segunda llegada no se registra.
    expect((await registrarLlegada(cita.id, recepcionistaId, AHORA)).ok).toBe(false);
  });

  it("no registra la llegada de otro día, de una cita cancelada ni pasada la tolerancia de 20 minutos", async () => {
    const manana = await crearCitaEn(60 * 24);
    const cancelada = await crearCitaEn(90, "cancelada");
    const tarde = await crearCitaEn(-21);
    const justo = await crearCitaEn(-20);

    expect(await registrarLlegada(manana.id, recepcionistaId, AHORA)).toMatchObject({ ok: false });
    expect(await registrarLlegada(cancelada.id, recepcionistaId, AHORA)).toMatchObject({ ok: false });
    expect(await registrarLlegada(tarde.id, recepcionistaId, AHORA)).toMatchObject({
      ok: false,
      mensaje: expect.stringContaining("20 minutos"),
    });
    expect(await registrarLlegada(justo.id, recepcionistaId, AHORA)).toEqual({ ok: true });
  });

  it("evalúa por separado cada estado de la cita", () => {
    const inicio = enMinutos(10);
    for (const estado of ["agendada", "confirmada", "pendiente_validacion"] as const) {
      expect(evaluarLlegada({ estado, inicio }, AHORA).permitido).toBe(true);
    }
    for (const estado of ["en_sala", "atendida", "cancelada", "inasistencia"] as const) {
      expect(evaluarLlegada({ estado, inicio }, AHORA).permitido).toBe(false);
    }
  });
});

describe("RF-29 y RF-30: agenda del médico y atención", () => {
  it("la agenda del día solo trae las citas de hoy del médico, en orden de hora", async () => {
    const segunda = await crearCitaEn(120);
    const primera = await crearCitaEn(30, "agendada");
    await crearCitaEn(60, "confirmada", "B");
    await crearCitaEn(60 * 24, "confirmada");

    const agenda = await agendaDelDia(catalogo.medicoA.id, AHORA);
    expect(agenda.map((cita) => cita.id)).toEqual([primera.id, segunda.id]);
    expect(agenda[0].paciente.nombres).toBe("Carlos");
  });

  it("registra inicio y fin de la atención y deja la cita «atendida»", async () => {
    const cita = await crearCitaEn(10);
    // Sin llegada no se puede iniciar.
    expect((await iniciarAtencion(cita.id, catalogo.medicoA.id, medicoUsuarioId, AHORA)).ok).toBe(false);

    await registrarLlegada(cita.id, recepcionistaId, AHORA);
    // Sin inicio no se puede finalizar.
    expect((await finalizarAtencion(cita.id, catalogo.medicoA.id, medicoUsuarioId, enMinutos(5))).ok).toBe(false);

    expect(await iniciarAtencion(cita.id, catalogo.medicoA.id, medicoUsuarioId, enMinutos(12))).toEqual({ ok: true });
    expect((await iniciarAtencion(cita.id, catalogo.medicoA.id, medicoUsuarioId, enMinutos(13))).ok).toBe(false);
    expect(await finalizarAtencion(cita.id, catalogo.medicoA.id, medicoUsuarioId, enMinutos(30))).toEqual({ ok: true });

    const atendida = await db.cita.findUniqueOrThrow({ where: { id: cita.id } });
    expect(atendida.estado).toBe("atendida");
    expect(atendida.inicioAtencion).toEqual(enMinutos(12));
    expect(atendida.finAtencion).toEqual(enMinutos(30));
    expect(
      await db.bitacora.count({ where: { accion: { in: ["iniciar_atencion", "finalizar_atencion"] }, usuarioId: medicoUsuarioId } }),
    ).toBe(2);
  });

  it("un médico no puede atender las citas de otro", async () => {
    const cita = await crearCitaEn(10);
    await registrarLlegada(cita.id, recepcionistaId, AHORA);
    expect(await iniciarAtencion(cita.id, catalogo.medicoB.id, medicoUsuarioId, AHORA)).toMatchObject({
      ok: false,
      codigo: "no-encontrada",
    });
  });
});

describe("RF-31: marca de inasistencia", () => {
  it("marca las citas sin llegada 20 minutos después de su hora y deja constancia en la bitácora", async () => {
    const vencidaAgendada = await crearCitaEn(-25, "agendada");
    const vencidaConfirmada = await crearCitaEn(-20, "confirmada");
    const vencidaPendiente = await crearCitaEn(-60, "pendiente_validacion");
    const aTiempo = await crearCitaEn(-19, "confirmada");
    const enSala = await crearCitaEn(-40, "en_sala");
    const cancelada = await crearCitaEn(-45, "cancelada");

    expect(await marcarInasistencias(AHORA)).toBe(3);

    const estados = Object.fromEntries(
      (await db.cita.findMany({ select: { id: true, estado: true } })).map((cita) => [cita.id, cita.estado]),
    );
    expect(estados[vencidaAgendada.id]).toBe("inasistencia");
    expect(estados[vencidaConfirmada.id]).toBe("inasistencia");
    expect(estados[vencidaPendiente.id]).toBe("inasistencia");
    expect(estados[aTiempo.id]).toBe("confirmada");
    expect(estados[enSala.id]).toBe("en_sala");
    expect(estados[cancelada.id]).toBe("cancelada");
    expect(await db.bitacora.count({ where: { accion: "marcar_inasistencia" } })).toBe(3);

    // El espacio sigue ocupado para los reportes de ocupación y ejecutar de nuevo no cambia nada.
    const espacio = await db.espacio.findUniqueOrThrow({ where: { id: vencidaAgendada.espacioId } });
    expect(espacio.estado).toBe("ocupado");
    expect(await marcarInasistencias(AHORA)).toBe(0);
  });

  it("después de marcar la inasistencia ya no se puede registrar la llegada", async () => {
    const cita = await crearCitaEn(-30, "confirmada");
    await marcarInasistencias(AHORA);
    expect((await registrarLlegada(cita.id, recepcionistaId, AHORA)).ok).toBe(false);
  });
});
