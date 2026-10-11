import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { cancelarCita, crearCita, reprogramarCita, type DatosNuevaCita } from "@/servicios/agendamiento";
import type { ConsultorAseguradora } from "@/servicios/cobertura";
import { construirMensajesCita } from "@/servicios/mensajes-cita";
import { cancelarCitasPorNovedad, registrarNovedad } from "@/servicios/novedades";
import {
  cancelarDesdeRecordatorio,
  confirmarDesdeRecordatorio,
  enviarRecordatorios,
  opcionesRespuesta,
} from "@/servicios/recordatorios";
import { ejecutarTareasProgramadas } from "@/servicios/tareas";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

// Lunes 12 de octubre de 2026, 08:00 en Bogotá.
const AHORA = new Date("2026-10-12T13:00:00Z");
const enHoras = (horas: number) => new Date(AHORA.getTime() + horas * 3_600_000);

let catalogo: Awaited<ReturnType<typeof crearCatalogoPrueba>>;
let usuarioId: number;
let coordinadorId: number;
let pacienteId: number;

async function crearEspacio(inicio: Date) {
  return db.espacio.create({
    data: {
      medicoId: catalogo.medicoA.id,
      consultorioId: catalogo.consultorioA.id,
      inicio,
      fin: new Date(inicio.getTime() + 30 * 60_000),
    },
  });
}

/** Crea una cita en un espacio nuevo que empieza dentro de las horas indicadas. */
async function citaEnHoras(horas: number, cambios: Partial<DatosNuevaCita> = {}) {
  const espacio = await crearEspacio(enHoras(horas));
  const resultado = await crearCita(
    {
      pacienteId,
      espacioId: espacio.id,
      especialidadId: catalogo.especialidad.id,
      canal: "portal_web",
      creadaPorId: usuarioId,
      resultadoCobertura: "cubierta",
      detalleCobertura: "Afiliación vigente.",
      esParticular: false,
      ...cambios,
    },
    AHORA,
  );
  if (!resultado.ok) throw new Error(resultado.mensaje);
  return { ...resultado, espacioId: espacio.id };
}

/** Segunda especialidad del médico A, para que el mismo paciente tenga otra cita activa (RF-18). */
async function otraEspecialidad() {
  const especialidad = await db.especialidad.create({ data: { nombre: "Otra" } });
  await db.medico.update({ where: { id: catalogo.medicoA.id }, data: { especialidades: { connect: { id: especialidad.id } } } });
  return especialidad.id;
}

async function mensajesDe(citaId: number, tipo?: string) {
  return db.notificacion.findMany({ where: { citaId, ...(tipo ? { tipo } : {}) }, orderBy: { id: "asc" } });
}

beforeEach(async () => {
  await limpiarBase();
  catalogo = await crearCatalogoPrueba();
  usuarioId = (await crearUsuarioPrueba()).id;
  coordinadorId = (await crearUsuarioPrueba({ rol: "coordinador_agenda" })).id;
  pacienteId = (
    await db.paciente.create({
      data: {
        tipoDocumento: "CC",
        numeroDocumento: "52009993",
        nombres: "Lucía",
        apellidos: "Rendón Prieto",
        fechaNacimiento: new Date("1985-05-05T05:00:00Z"),
        telefono: "3001234567",
        correo: "lucia@correo.test",
        aseguradoraId: catalogo.aseguradora.id,
        usuarioId,
      },
    })
  ).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("RF-24: mensajes al confirmar, reprogramar o cancelar", () => {
  it("registra un correo y un SMS con los datos de la cita agendada", async () => {
    const cita = await citaEnHoras(72);
    const mensajes = await mensajesDe(cita.citaId);
    expect(mensajes.map((m) => [m.canal, m.tipo, m.estado])).toEqual([
      ["correo", "cita_agendada", "enviada"],
      ["sms", "cita_agendada", "enviada"],
    ]);
    expect(mensajes[0].destinatario).toBe("lucia@correo.test");
    expect(mensajes[1].destinatario).toBe("3001234567");
    for (const mensaje of mensajes) {
      expect(mensaje.contenido).toContain(cita.codigo);
      expect(mensaje.contenido).toContain("15/10/2026");
      expect(mensaje.contenido).toContain("08:00");
    }
    expect(mensajes[0].contenido).toContain("Médico A De Prueba");
    expect(mensajes[0].contenido).toContain(catalogo.consultorioA.nombre);
  });

  it("al reprogramar envía el horario nuevo y menciona el anterior", async () => {
    const cita = await citaEnHoras(72);
    const nuevo = await crearEspacio(enHoras(96));
    const resultado = await reprogramarCita({ citaId: cita.citaId, espacioId: nuevo.id, actorId: usuarioId, rol: "paciente" }, AHORA);
    expect(resultado.ok).toBe(true);

    const mensajes = await mensajesDe(cita.citaId, "cita_reprogramada");
    expect(mensajes).toHaveLength(2);
    expect(mensajes[0].contenido).toContain("16/10/2026");
    expect(mensajes[0].contenido).toMatch(/Horario anterior: .*15\/10\/2026/);
  });

  it("al cancelar envía el aviso con el motivo", async () => {
    const cita = await citaEnHoras(72);
    await cancelarCita({ citaId: cita.citaId, motivo: "Viaje de trabajo", actorId: usuarioId, rol: "paciente" }, AHORA);
    const mensajes = await mensajesDe(cita.citaId, "cita_cancelada");
    expect(mensajes.map((m) => m.canal)).toEqual(["correo", "sms"]);
    expect(mensajes[0].contenido).toContain("Motivo: Viaje de trabajo");
  });

  it("no registra mensajes si el cambio falla", async () => {
    const cita = await citaEnHoras(10);
    const resultado = await cancelarCita({ citaId: cita.citaId, motivo: "Ya no puedo", actorId: usuarioId, rol: "paciente" }, AHORA);
    expect(resultado.ok).toBe(false);
    expect(await mensajesDe(cita.citaId, "cita_cancelada")).toHaveLength(0);
  });

  it("indica en la cita agendada cuando queda pendiente de validación", () => {
    const mensajes = construirMensajesCita("agendada", {
      codigo: "HSR-ABC234",
      pendienteValidacion: true,
      paciente: { nombres: "Lucía" },
      especialidad: "Cardiología",
      medico: { nombres: "Ana", apellidos: "Ruiz" },
      consultorio: { nombre: "Consultorio 101", ubicacion: "Piso 1" },
      inicio: enHoras(72),
    });
    expect(mensajes.correo.contenido).toContain("pendiente de validación");
    expect(mensajes.sms.contenido).toContain("pendiente de validación");
  });
});

describe("RF-25: recordatorio 48 horas antes", () => {
  it("envía el recordatorio con enlaces para confirmar o cancelar solo a las citas de las próximas 48 horas", async () => {
    const cercana = await citaEnHoras(30);
    const lejana = await citaEnHoras(60, { especialidadId: await otraEspecialidad() });

    expect(await enviarRecordatorios(AHORA)).toBe(1);
    const recordatorios = await mensajesDe(cercana.citaId, "cita_recordatorio");
    expect(recordatorios.map((m) => m.canal)).toEqual(["correo", "sms"]);
    const token = (await db.cita.findUniqueOrThrow({ where: { id: cercana.citaId } })).tokenRespuesta;
    for (const mensaje of recordatorios) {
      expect(mensaje.contenido).toContain(`/responder-cita/${token}?accion=confirmar`);
      expect(mensaje.contenido).toContain(`/responder-cita/${token}?accion=cancelar`);
    }
    expect(await mensajesDe(lejana.citaId, "cita_recordatorio")).toHaveLength(0);
  });

  it("no repite el recordatorio ni lo envía a citas confirmadas o canceladas", async () => {
    const cita = await citaEnHoras(30);
    expect(await enviarRecordatorios(AHORA)).toBe(1);
    expect(await enviarRecordatorios(AHORA)).toBe(0);
    expect(await mensajesDe(cita.citaId, "cita_recordatorio")).toHaveLength(2);

    await db.cita.update({ where: { id: cita.citaId }, data: { estado: "confirmada", recordatorioEnviadoEn: null } });
    expect(await enviarRecordatorios(AHORA)).toBe(0);
  });
});

describe("RF-26: respuesta del paciente al recordatorio", () => {
  async function tokenDe(citaId: number) {
    return (await db.cita.findUniqueOrThrow({ where: { id: citaId } })).tokenRespuesta;
  }

  it("al confirmar, la cita pasa a «confirmada», queda en la bitácora y se avisa al paciente", async () => {
    const cita = await citaEnHoras(30);
    const resultado = await confirmarDesdeRecordatorio(await tokenDe(cita.citaId), AHORA);
    expect(resultado.ok).toBe(true);
    expect((await db.cita.findUniqueOrThrow({ where: { id: cita.citaId } })).estado).toBe("confirmada");
    expect(await db.bitacora.count({ where: { accion: "confirmar_cita_recordatorio", entidadId: String(cita.citaId), usuarioId } })).toBe(1);
    expect(await mensajesDe(cita.citaId, "cita_confirmada")).toHaveLength(2);

    // Confirmar de nuevo no duplica nada.
    expect((await confirmarDesdeRecordatorio(await tokenDe(cita.citaId), AHORA)).ok).toBe(true);
    expect(await mensajesDe(cita.citaId, "cita_confirmada")).toHaveLength(2);
  });

  it("al cancelar con más de 24 horas, la cita queda cancelada y el espacio libre", async () => {
    const cita = await citaEnHoras(30);
    const resultado = await cancelarDesdeRecordatorio(await tokenDe(cita.citaId), "No consigo permiso en el trabajo", AHORA);
    expect(resultado.ok).toBe(true);
    const actualizada = await db.cita.findUniqueOrThrow({ where: { id: cita.citaId }, include: { espacio: true } });
    expect(actualizada.estado).toBe("cancelada");
    expect(actualizada.espacioActivoId).toBeNull();
    expect(actualizada.espacio.estado).toBe("libre");
    expect(await db.bitacora.count({ where: { accion: "cancelar_cita_recordatorio" } })).toBe(1);
  });

  it("con menos de 24 horas no cancela y pide comunicarse con recepción", async () => {
    const cita = await citaEnHoras(20);
    const resultado = await cancelarDesdeRecordatorio(await tokenDe(cita.citaId), "No puedo asistir", AHORA);
    expect(resultado).toMatchObject({ ok: false, codigo: "requiere-recepcion" });
    const actualizada = await db.cita.findUniqueOrThrow({ where: { id: cita.citaId }, include: { espacio: true } });
    expect(actualizada.estado).toBe("agendada");
    expect(opcionesRespuesta(actualizada, AHORA)).toMatchObject({ puedeConfirmar: true, puedeCancelar: false });
    expect(opcionesRespuesta(actualizada, AHORA).avisoCancelacion).toContain("comuníquese con recepción");
  });

  it("rechaza un enlace inexistente", async () => {
    expect(await confirmarDesdeRecordatorio("token-que-no-existe", AHORA)).toMatchObject({ ok: false, codigo: "no-encontrada" });
  });
});

describe("RF-27: cancelación por novedad del médico", () => {
  it("cancela las citas del periodo, mantiene bloqueados los espacios y avisa con el motivo y el enlace para reprogramar", async () => {
    const afectada = await citaEnHoras(50); // miércoles 14/10 a las 10:00
    const fuera = await citaEnHoras(100, { especialidadId: await otraEspecialidad() });

    const novedad = await registrarNovedad(
      {
        medicoId: catalogo.medicoA.id,
        tipo: "incapacidad",
        fechaInicio: "2026-10-14",
        horaInicio: "00:00",
        fechaFin: "2026-10-14",
        horaFin: "23:59",
        motivo: "Observación interna",
      },
      coordinadorId,
    );
    if (!novedad.ok) throw new Error(novedad.mensaje);
    expect(novedad.citasAfectadas).toBe(1);

    const resultado = await cancelarCitasPorNovedad(novedad.id, coordinadorId, AHORA);
    expect(resultado).toEqual({ ok: true, canceladas: 1, noCanceladas: 0 });

    const cita = await db.cita.findUniqueOrThrow({ where: { id: afectada.citaId }, include: { espacio: true } });
    expect(cita.estado).toBe("cancelada");
    expect(cita.motivoCancelacion).toBe("El médico no estará disponible por incapacidad.");
    expect(cita.espacio.estado).toBe("bloqueado");
    expect((await db.cita.findUniqueOrThrow({ where: { id: fuera.citaId } })).estado).toBe("agendada");

    const avisos = await mensajesDe(afectada.citaId, "cita_cancelada_novedad");
    expect(avisos.map((m) => m.canal)).toEqual(["correo", "sms"]);
    for (const aviso of avisos) {
      expect(aviso.contenido).toContain("El médico no estará disponible por incapacidad.");
      expect(aviso.contenido).toContain(`/mis-citas/nueva?especialidad=${catalogo.especialidad.id}`);
      // Las observaciones internas de la novedad no se comparten con el paciente.
      expect(aviso.contenido).not.toContain("Observación interna");
    }
    expect(await db.bitacora.count({ where: { accion: "cancelar_cita_novedad", usuarioId: coordinadorId } })).toBe(1);
  });

  it("cancela aunque falten menos de 24 horas, porque la cancelación es del hospital", async () => {
    const cita = await citaEnHoras(4);
    const novedad = await registrarNovedad(
      { medicoId: catalogo.medicoA.id, tipo: "capacitacion", fechaInicio: "2026-10-12", horaInicio: "00:00", fechaFin: "2026-10-12", horaFin: "23:59", motivo: null },
      coordinadorId,
    );
    if (!novedad.ok) throw new Error(novedad.mensaje);
    expect(await cancelarCitasPorNovedad(novedad.id, coordinadorId, AHORA)).toMatchObject({ canceladas: 1 });
    expect((await db.cita.findUniqueOrThrow({ where: { id: cita.citaId } })).estado).toBe("cancelada");
  });
});

describe("Tareas programadas", () => {
  it("libera reservas vencidas, reintenta coberturas, envía recordatorios y deja la ejecución en la bitácora", async () => {
    const vencida = await crearEspacio(enHoras(200));
    await db.espacio.update({
      where: { id: vencida.id },
      data: { estado: "reservado_temporal", reservadoHasta: new Date(Date.now() - 60_000), reservadoPorId: usuarioId },
    });
    // Cita pendiente de validación dentro de las próximas 48 horas (relativas a la hora real).
    const espacio = await db.espacio.create({
      data: {
        medicoId: catalogo.medicoB.id,
        consultorioId: catalogo.consultorioB.id,
        inicio: new Date(Date.now() + 30 * 3_600_000),
        fin: new Date(Date.now() + 30.5 * 3_600_000),
      },
    });
    const pendiente = await crearCita({
      pacienteId,
      espacioId: espacio.id,
      especialidadId: catalogo.especialidad.id,
      canal: "telefono",
      creadaPorId: usuarioId,
      resultadoCobertura: "sin_respuesta",
      detalleCobertura: "Sin respuesta.",
      esParticular: false,
    });
    if (!pendiente.ok) throw new Error(pendiente.mensaje);

    const consultor: ConsultorAseguradora = async () => ({ vigente: true, cubierta: true, mensaje: "Afiliación vigente." });
    const resumen = await ejecutarTareasProgramadas("panel", usuarioId, { consultor });

    expect(resumen.reservasLiberadas).toBe(1);
    expect(resumen.coberturas).toEqual({ revisadas: 1, cubiertas: 1, rechazadas: 0, sinRespuesta: 0 });
    // La cita recién validada pasa a «agendada» y recibe el recordatorio en la misma ejecución.
    expect(resumen.recordatoriosEnviados).toBe(1);
    expect((await db.espacio.findUniqueOrThrow({ where: { id: vencida.id } })).estado).toBe("libre");
    expect(await db.bitacora.count({ where: { entidad: "TareasProgramadas", accion: "ejecutar_tareas_panel" } })).toBe(1);
  });
});
