import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CanalOrigen, EstadoCita, EstadoEspacio } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { esquemaFiltrosReporte, leerFiltrosReporte } from "@/lib/validaciones/reportes";
import { armarDocumentoReporte } from "@/servicios/documentos-reporte";
import { generarCsv, generarPdf } from "@/servicios/exportacion-reportes";
import { porcentaje, reporteAusentismo, reporteOcupacion, reporteTiempos } from "@/servicios/reportes";
import { crearCatalogoPrueba, crearUsuarioPrueba, limpiarBase } from "./ayudantes";

// Lunes 5 de octubre de 2026, 08:00 en Bogotá.
const BASE = new Date("2026-10-05T13:00:00Z");
const FILTROS = { desde: "2026-10-05", hasta: "2026-10-09" };

let catalogo: Awaited<ReturnType<typeof crearCatalogoPrueba>>;
let usuarioId: number;
let pacienteId: number;
let contador = 0;

/** Crea un espacio del médico indicado a los minutos dados desde BASE. */
function crearEspacio(minutos: number, estado: EstadoEspacio, medico: "A" | "B" = "A") {
  return db.espacio.create({
    data: {
      medicoId: medico === "A" ? catalogo.medicoA.id : catalogo.medicoB.id,
      consultorioId: medico === "A" ? catalogo.consultorioA.id : catalogo.consultorioB.id,
      inicio: new Date(BASE.getTime() + minutos * 60_000),
      fin: new Date(BASE.getTime() + (minutos + 20) * 60_000),
      estado,
    },
  });
}

/** Crea un espacio y una cita en él, con los datos opcionales para RF-34. */
async function crearCita(
  minutos: number,
  estado: EstadoCita,
  datos: { canal?: CanalOrigen; medico?: "A" | "B"; diasSolicitud?: number; minutosEspera?: number } = {},
) {
  contador++;
  const ocupa = estado !== "cancelada";
  const espacio = await crearEspacio(minutos, ocupa ? "ocupado" : "libre", datos.medico);
  const horaLlegada = datos.minutosEspera !== undefined ? new Date(espacio.inicio.getTime() - 10 * 60_000) : null;
  return db.cita.create({
    data: {
      codigo: `HSR-R${String(contador).padStart(5, "0")}`,
      pacienteId,
      espacioId: espacio.id,
      espacioActivoId: ocupa ? espacio.id : null,
      especialidadId: catalogo.especialidad.id,
      estado,
      canal: datos.canal ?? "portal_web",
      creadaPorId: usuarioId,
      tokenRespuesta: `token-reporte-${contador}-${Date.now()}`,
      fechaSolicitud: new Date(espacio.inicio.getTime() - (datos.diasSolicitud ?? 1) * 86_400_000),
      horaLlegada,
      inicioAtencion:
        horaLlegada && datos.minutosEspera !== undefined
          ? new Date(horaLlegada.getTime() + datos.minutosEspera * 60_000)
          : null,
    },
  });
}

beforeEach(async () => {
  await limpiarBase();
  catalogo = await crearCatalogoPrueba();
  usuarioId = (await crearUsuarioPrueba({ rol: "recepcionista" })).id;
  pacienteId = (
    await db.paciente.create({
      data: {
        tipoDocumento: "CC",
        numeroDocumento: "1010101010",
        nombres: "Ana",
        apellidos: "Pérez",
        fechaNacimiento: new Date("1990-05-10T05:00:00Z"),
        telefono: "3001112233",
        correo: "ana@correo.test",
        aseguradoraId: catalogo.aseguradora.id,
      },
    })
  ).id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Filtros de los reportes", () => {
  it("usa los últimos 30 días cuando no llegan fechas", () => {
    const { resultado } = leerFiltrosReporte({}, BASE);
    expect(resultado.success && resultado.data).toEqual({ desde: "2026-09-05", hasta: "2026-10-05" });
  });

  it("rechaza un rango invertido", () => {
    const resultado = esquemaFiltrosReporte.safeParse({ desde: "2026-10-09", hasta: "2026-10-05" });
    expect(resultado.success).toBe(false);
  });
});

describe("RF-32: ocupación", () => {
  it("divide los espacios ocupados entre los ofertados y no oferta los bloqueados", async () => {
    await crearCita(0, "atendida");
    await crearCita(60, "inasistencia"); // la inasistencia conserva el espacio (RF-31)
    await crearCita(120, "cancelada"); // al cancelar, el espacio queda libre
    await crearEspacio(180, "libre");
    await crearEspacio(240, "bloqueado"); // novedad del médico: no se oferta
    await crearEspacio(300, "libre", "B");
    await crearEspacio(60 * 24 * 10, "ocupado"); // fuera del rango

    const reporte = await reporteOcupacion(FILTROS);

    expect(reporte.total).toMatchObject({ ofertados: 5, ocupados: 2, porcentaje: 40 });
    expect(reporte.porMedico.find((fila) => fila.id === catalogo.medicoA.id)).toMatchObject({
      ofertados: 4,
      ocupados: 2,
      porcentaje: 50,
    });
    expect(reporte.porConsultorio.find((fila) => fila.id === catalogo.consultorioB.id)).toMatchObject({
      ofertados: 1,
      ocupados: 0,
      porcentaje: 0,
    });
    expect(reporte.porEspecialidad).toEqual([
      expect.objectContaining({ id: catalogo.especialidad.id, ofertados: 5, ocupados: 2, porcentaje: 40 }),
    ]);
  });

  it("filtra por especialidad", async () => {
    await crearCita(0, "agendada");
    const reporte = await reporteOcupacion({ ...FILTROS, especialidad: catalogo.especialidad.id + 999 });
    expect(reporte.total.ofertados).toBe(0);
    expect(reporte.total.porcentaje).toBeNull();
  });
});

describe("RF-33: inasistencias y cancelaciones", () => {
  it("cuenta y calcula el porcentaje por especialidad y por canal", async () => {
    await crearCita(0, "atendida", { canal: "telefono" });
    await crearCita(60, "inasistencia", { canal: "telefono" });
    await crearCita(120, "cancelada", { canal: "portal_web" });
    await crearCita(180, "confirmada", { canal: "portal_web" });

    const reporte = await reporteAusentismo(FILTROS);

    expect(reporte.total).toMatchObject({
      citas: 4,
      inasistencias: 1,
      cancelaciones: 1,
      porcentajeInasistencias: 25,
      porcentajeCancelaciones: 25,
    });
    expect(reporte.porCanal.map((fila) => fila.nombre)).toEqual(["Teléfono", "Portal web"]);
    expect(reporte.porCanal[0]).toMatchObject({ citas: 2, inasistencias: 1, porcentajeInasistencias: 50 });
    expect(reporte.porCanal[1]).toMatchObject({ citas: 2, cancelaciones: 1, porcentajeCancelaciones: 50 });
  });
});

describe("RF-34: tiempos promedio", () => {
  it("promedia los días de solicitud sin canceladas y los minutos de espera con llegada registrada", async () => {
    await crearCita(0, "atendida", { diasSolicitud: 2, minutosEspera: 10 });
    await crearCita(60, "atendida", { diasSolicitud: 4, minutosEspera: 20 });
    await crearCita(120, "confirmada", { diasSolicitud: 6 });
    await crearCita(180, "cancelada", { diasSolicitud: 30 }); // no cuenta

    const reporte = await reporteTiempos(FILTROS);

    expect(reporte.total).toMatchObject({
      citasSolicitud: 3,
      diasPromedioSolicitud: 4,
      citasEspera: 2,
      minutosPromedioEspera: 15,
    });
  });

  it("devuelve null cuando no hay datos para el promedio", async () => {
    const reporte = await reporteTiempos(FILTROS);
    expect(reporte.total.diasPromedioSolicitud).toBeNull();
    expect(porcentaje(1, 0)).toBeNull();
  });
});

describe("RF-35: exportación a CSV y PDF", () => {
  it("genera el CSV con BOM, filtros aplicados y punto y coma", async () => {
    await crearCita(0, "inasistencia", { canal: "telefono" });
    const documento = await armarDocumentoReporte("ausentismo", FILTROS);
    const csv = generarCsv(documento, BASE);

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Desde: 05/10/2026");
    expect(csv).toContain("Hasta: 09/10/2026");
    expect(csv).toContain("Especialidad: Todas");
    expect(csv).toContain("Canal;Citas;Inasistencias;% inasistencias;Cancelaciones;% cancelaciones");
    expect(csv).toContain("Teléfono;1;1;100,0 %;0;0,0 %");
  });

  it("escapa las celdas que contienen el separador", () => {
    const csv = generarCsv(
      { titulo: "Prueba", requisito: "RF-35", filtros: [], notas: [], tablas: [{ titulo: "T", columnas: ["A"], filas: [['x;"y"']] }] },
      BASE,
    );
    expect(csv).toContain('"x;""y"""');
  });

  it("genera un PDF válido con tildes", async () => {
    await crearCita(0, "atendida");
    const documento = await armarDocumentoReporte("ocupacion", FILTROS);
    const pdf = await generarPdf(documento, BASE);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
