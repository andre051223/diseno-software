import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { formatearFechaHora } from "@/lib/fechas";
import type { DatosDisponibilidad } from "@/lib/validaciones/agenda";
import { esquemaDisponibilidad, esquemaMedico } from "@/lib/validaciones/agenda";
import { cambiarEstadoConsultorio, guardarEspecialidad } from "@/servicios/catalogos";
import { crearDisponibilidad, desactivarDisponibilidad, regenerarEspaciosMedico } from "@/servicios/disponibilidad";
import { finVentanaGeneracion, seSolapan } from "@/servicios/generador-espacios";
import { guardarMedico } from "@/servicios/medicos";
import { citasAfectadasPorNovedad, registrarNovedad } from "@/servicios/novedades";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

// Lunes 12 de octubre de 2026, 00:00 en Bogotá.
const AHORA = new Date("2026-10-12T05:00:00Z");

let catalogo: Awaited<ReturnType<typeof crearCatalogoPrueba>>;
let coordinadorId: number;

function bloque(cambios: Partial<DatosDisponibilidad> = {}): DatosDisponibilidad {
  return {
    medicoId: catalogo.medicoA.id,
    consultorioId: catalogo.consultorioA.id,
    dias: [1],
    horaInicio: "07:00",
    horaFin: "09:00",
    duracionMinutos: 30,
    ...cambios,
  };
}

beforeEach(async () => {
  await limpiarBase();
  catalogo = await crearCatalogoPrueba();
  coordinadorId = (await crearUsuarioPrueba({ rol: "coordinador_agenda" })).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-08: especialidades y consultorios", () => {
  it("no admite dos especialidades con el mismo nombre", async () => {
    const resultado = await guardarEspecialidad({ nombre: catalogo.especialidad.nombre, descripcion: null }, coordinadorId);
    expect(resultado).toMatchObject({ ok: false, campo: "nombre" });
  });

  it("inactiva un consultorio sin borrarlo y deja constancia en la bitácora", async () => {
    await cambiarEstadoConsultorio(catalogo.consultorioA.id, false, coordinadorId);
    const consultorio = await db.consultorio.findUniqueOrThrow({ where: { id: catalogo.consultorioA.id } });
    expect(consultorio.activo).toBe(false);
    const registro = await db.bitacora.findFirstOrThrow({ where: { accion: "inactivar_consultorio" } });
    expect(registro.usuarioId).toBe(coordinadorId);
  });
});

describe("RF-09: médicos con una o más especialidades", () => {
  it("exige al menos una especialidad", () => {
    const resultado = esquemaMedico.safeParse({
      nombres: "Juan",
      apellidos: "Pérez",
      registroMedico: "RM-1",
      especialidadIds: [],
    });
    expect(resultado.success).toBe(false);
  });

  it("registra un médico con dos especialidades y luego cambia sus especialidades", async () => {
    const otra = await db.especialidad.create({ data: { nombre: "Cardiología de prueba" } });
    const creado = await guardarMedico(
      {
        nombres: "Juan",
        apellidos: "Pérez",
        registroMedico: "RM-9001",
        correo: null,
        telefono: null,
        especialidadIds: [catalogo.especialidad.id, otra.id],
        activo: false,
      },
      coordinadorId,
    );
    if (!creado.ok) throw new Error(creado.mensaje);
    let medico = await db.medico.findUniqueOrThrow({ where: { id: creado.id }, include: { especialidades: true } });
    expect(medico.especialidades).toHaveLength(2);
    // Al crear se ignora la casilla «activo»: todo médico nuevo empieza activo.
    expect(medico.activo).toBe(true);

    await guardarMedico(
      {
        id: creado.id,
        nombres: "Juan",
        apellidos: "Pérez",
        registroMedico: "RM-9001",
        correo: null,
        telefono: null,
        especialidadIds: [otra.id],
        activo: true,
      },
      coordinadorId,
    );
    medico = await db.medico.findUniqueOrThrow({ where: { id: creado.id }, include: { especialidades: true } });
    expect(medico.especialidades.map((especialidad) => especialidad.id)).toEqual([otra.id]);
  });

  it("no asigna especialidades inactivas a un médico nuevo", async () => {
    const inactiva = await db.especialidad.create({ data: { nombre: "Inactiva", activo: false } });
    const resultado = await guardarMedico(
      {
        nombres: "Ana",
        apellidos: "Gil",
        registroMedico: "RM-9002",
        correo: null,
        telefono: null,
        especialidadIds: [inactiva.id],
        activo: true,
      },
      coordinadorId,
    );
    expect(resultado).toMatchObject({ ok: false, campo: "especialidadIds" });
  });
});

describe("RF-10: disponibilidad semanal y generación de espacios", () => {
  it("valida que la hora de fin sea posterior al inicio y que quepa una consulta", () => {
    const invertido = esquemaDisponibilidad.safeParse({ ...bloque({ horaInicio: "10:00", horaFin: "09:00" }), dias: ["1"] });
    expect(invertido.success).toBe(false);
    const corto = esquemaDisponibilidad.safeParse({
      ...bloque({ horaInicio: "07:00", horaFin: "07:20", duracionMinutos: 30 }),
      dias: ["1"],
    });
    expect(corto.success).toBe(false);
  });

  it("genera los espacios de las próximas 8 semanas según día, horario y duración", async () => {
    const resultado = await crearDisponibilidad(bloque({ dias: [1, 3] }), coordinadorId, AHORA);
    // 4 espacios por día × 2 días × 9 semanas (del lunes 12/10/2026 al lunes 07/12/2026, ambos incluidos).
    expect(resultado).toEqual({ ok: true, generados: 68, bloqueados: 0, omitidos: 0 });

    const espacios = await db.espacio.findMany({ orderBy: { inicio: "asc" } });
    expect(formatearFechaHora(espacios[0].inicio)).toBe("12/10/2026 07:00");
    expect(formatearFechaHora(espacios[0].fin)).toBe("12/10/2026 07:30");
    expect(espacios.at(-1)!.inicio <= finVentanaGeneracion(AHORA)).toBe(true);
    expect(espacios.every((espacio) => espacio.estado === "libre")).toBe(true);
  });

  it("rechaza un bloque que se cruza con otro del mismo consultorio", async () => {
    await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    const resultado = await crearDisponibilidad(
      bloque({ medicoId: catalogo.medicoB.id, horaInicio: "08:00", horaFin: "10:00" }),
      coordinadorId,
      AHORA,
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.conflictos?.[0]).toMatch(/está asignado el lunes de 07:00 a 09:00/);
    expect(await db.disponibilidadSemanal.count()).toBe(1);
  });

  it("rechaza un bloque del mismo médico a la misma hora en otro consultorio", async () => {
    await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    const resultado = await crearDisponibilidad(
      bloque({ consultorioId: catalogo.consultorioB.id, horaInicio: "08:30", horaFin: "11:00" }),
      coordinadorId,
      AHORA,
    );
    expect(resultado.ok).toBe(false);
  });

  it("permite bloques contiguos y nunca deja espacios solapados en un consultorio", async () => {
    await crearDisponibilidad(bloque({ duracionMinutos: 20, horaFin: "09:00" }), coordinadorId, AHORA);
    await crearDisponibilidad(
      bloque({ medicoId: catalogo.medicoB.id, duracionMinutos: 30, horaInicio: "09:00", horaFin: "11:00" }),
      coordinadorId,
      AHORA,
    );
    const espacios = await db.espacio.findMany({
      where: { consultorioId: catalogo.consultorioA.id },
      orderBy: { inicio: "asc" },
    });
    expect(espacios.length).toBeGreaterThan(0);
    for (let i = 1; i < espacios.length; i++) expect(seSolapan(espacios[i - 1], espacios[i])).toBe(false);
  });

  it("omite los espacios que se cruzan con espacios ya existentes del consultorio", async () => {
    // Un espacio suelto (por ejemplo, de un bloque ya desactivado que conserva una cita) ocupa el 19/10 de 07:45 a 08:15.
    await db.espacio.create({
      data: {
        medicoId: catalogo.medicoB.id,
        consultorioId: catalogo.consultorioA.id,
        inicio: new Date("2026-10-19T12:45:00Z"),
        fin: new Date("2026-10-19T13:15:00Z"),
        estado: "ocupado",
      },
    });
    const resultado = await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    // Ese lunes se omiten 07:30 y 08:00 porque se cruzan con el espacio existente.
    expect(resultado).toMatchObject({ ok: true, generados: 34, omitidos: 2 });

    const espacios = await db.espacio.findMany({
      where: { consultorioId: catalogo.consultorioA.id },
      orderBy: { inicio: "asc" },
    });
    for (let i = 1; i < espacios.length; i++) expect(seSolapan(espacios[i - 1], espacios[i])).toBe(false);
  });

  it("la regeneración es idempotente y no duplica espacios", async () => {
    await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    const total = await db.espacio.count();
    const resumen = await regenerarEspaciosMedico(catalogo.medicoA.id, coordinadorId, AHORA);
    expect(resumen).toEqual({ generados: 0, bloqueados: 0, omitidos: 0 });
    expect(await db.espacio.count()).toBe(total);

    // Una semana después se agregan solo los espacios de la nueva semana.
    const unaSemanaDespues = new Date(AHORA.getTime() + 7 * 86_400_000);
    const siguiente = await regenerarEspaciosMedico(catalogo.medicoA.id, coordinadorId, unaSemanaDespues);
    expect(siguiente.generados).toBe(4);
  });

  it("al desactivar un bloque retira los espacios libres y conserva los ocupados", async () => {
    await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    const disponibilidad = await db.disponibilidadSemanal.findFirstOrThrow();
    const primero = await db.espacio.findFirstOrThrow({ orderBy: { inicio: "asc" } });
    await db.espacio.update({ where: { id: primero.id }, data: { estado: "ocupado" } });

    const resultado = await desactivarDisponibilidad(disponibilidad.id, coordinadorId, AHORA);
    expect(resultado).toEqual({ ok: true, eliminados: 35, conservados: 1 });
    expect(await db.espacio.count()).toBe(1);
  });
});

describe("RF-11: novedades del médico", () => {
  it("bloquea los espacios del periodo y lista las citas ya asignadas", async () => {
    await crearDisponibilidad(bloque({ dias: [1, 2, 3, 4, 5] }), coordinadorId, AHORA);
    const paciente = await db.paciente.create({
      data: {
        tipoDocumento: "CC",
        numeroDocumento: "123456",
        nombres: "Laura",
        apellidos: "Prieto",
        fechaNacimiento: new Date("1980-01-01T05:00:00Z"),
        telefono: "3000000000",
        correo: "laura@correo.test",
        aseguradoraId: catalogo.aseguradora.id,
      },
    });
    // Cita activa el martes 20/10/2026 a las 07:00.
    const espacio = await db.espacio.findFirstOrThrow({ where: { inicio: new Date("2026-10-20T12:00:00Z") } });
    await db.espacio.update({ where: { id: espacio.id }, data: { estado: "ocupado" } });
    await db.cita.create({
      data: {
        codigo: "HSR-PRUEBA",
        pacienteId: paciente.id,
        espacioId: espacio.id,
        espacioActivoId: espacio.id,
        especialidadId: catalogo.especialidad.id,
        canal: "portal_web",
        creadaPorId: coordinadorId,
        tokenRespuesta: "token-prueba",
      },
    });

    // Capacitación del lunes 19/10 al miércoles 21/10 de 2026, todo el día.
    const resultado = await registrarNovedad(
      {
        medicoId: catalogo.medicoA.id,
        tipo: "capacitacion",
        fechaInicio: "2026-10-19",
        horaInicio: "00:00",
        fechaFin: "2026-10-21",
        horaFin: "23:59",
        motivo: "Congreso nacional",
      },
      coordinadorId,
    );
    expect(resultado).toMatchObject({ ok: true, espaciosBloqueados: 12, citasAfectadas: 1 });

    const bloqueados = await db.espacio.findMany({ where: { estado: "bloqueado" } });
    expect(bloqueados).toHaveLength(12);
    const inicioNovedad = new Date("2026-10-19T05:00:00Z");
    const finNovedad = new Date("2026-10-22T04:59:00Z");
    expect(bloqueados.every((item) => item.inicio >= inicioNovedad && item.fin <= finNovedad)).toBe(true);

    const novedad = await db.novedad.findUniqueOrThrow({ where: { id: resultado.ok ? resultado.id : 0 } });
    const citas = await citasAfectadasPorNovedad(novedad);
    expect(citas.map((cita) => cita.codigo)).toEqual(["HSR-PRUEBA"]);
  });

  it("los espacios generados después dentro de una novedad nacen bloqueados", async () => {
    await registrarNovedad(
      {
        medicoId: catalogo.medicoA.id,
        tipo: "vacaciones",
        fechaInicio: "2026-10-19",
        horaInicio: "00:00",
        fechaFin: "2026-10-25",
        horaFin: "23:59",
        motivo: null,
      },
      coordinadorId,
    );
    const resultado = await crearDisponibilidad(bloque(), coordinadorId, AHORA);
    expect(resultado).toMatchObject({ ok: true, generados: 36, bloqueados: 4 });
  });
});
