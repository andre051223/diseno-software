import { describe, expect, it } from "vitest";
import { formatearFechaHora } from "@/lib/fechas";
import { calcularEspacios, seSolapan, separarSolapados } from "@/servicios/generador-espacios";

describe("RF-10: cálculo de espacios a partir de la disponibilidad semanal", () => {
  // Lunes 12 de octubre de 2026 a domingo 18 de octubre de 2026 (hora de Bogotá).
  const desde = new Date("2026-10-12T05:00:00Z");
  const hasta = new Date("2026-10-19T04:59:00Z");

  it("genera espacios solo el día de la semana indicado y en hora de Bogotá", () => {
    const espacios = calcularEspacios(
      { diaSemana: 3, horaInicio: "07:00", horaFin: "09:00", duracionMinutos: 30 },
      desde,
      hasta,
    );
    expect(espacios.map((espacio) => formatearFechaHora(espacio.inicio))).toEqual([
      "14/10/2026 07:00",
      "14/10/2026 07:30",
      "14/10/2026 08:00",
      "14/10/2026 08:30",
    ]);
    // 07:00 en Bogotá corresponde a las 12:00 UTC.
    expect(espacios[0].inicio.toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });

  it("descarta el último espacio si no cabe completo", () => {
    const espacios = calcularEspacios(
      { diaSemana: 1, horaInicio: "07:00", horaFin: "08:10", duracionMinutos: 20 },
      desde,
      hasta,
    );
    expect(espacios).toHaveLength(3);
    expect(formatearFechaHora(espacios.at(-1)!.fin)).toBe("12/10/2026 08:00");
  });

  it("los espacios generados no se solapan entre sí", () => {
    const espacios = calcularEspacios(
      { diaSemana: 5, horaInicio: "13:00", horaFin: "18:00", duracionMinutos: 40 },
      desde,
      hasta,
    );
    for (let i = 1; i < espacios.length; i++) {
      expect(seSolapan(espacios[i - 1], espacios[i])).toBe(false);
    }
  });

  it("detecta el solapamiento entre espacios de distinta duración", () => {
    const a = { inicio: new Date("2026-10-12T12:00:00Z"), fin: new Date("2026-10-12T12:30:00Z") };
    const b = { inicio: new Date("2026-10-12T12:20:00Z"), fin: new Date("2026-10-12T12:40:00Z") };
    const c = { inicio: new Date("2026-10-12T12:30:00Z"), fin: new Date("2026-10-12T13:00:00Z") };
    expect(seSolapan(a, b)).toBe(true);
    expect(seSolapan(a, c)).toBe(false);
  });
});

describe("RF-10: descarte de espacios que se cruzan", () => {
  const intervalo = (inicio: string, fin: string) => ({
    inicio: new Date(`2026-10-12T${inicio}:00Z`),
    fin: new Date(`2026-10-12T${fin}:00Z`),
  });

  it("omite los candidatos que se cruzan con espacios existentes y conserva el resto", () => {
    const candidatos = [intervalo("12:00", "12:30"), intervalo("12:30", "13:00"), intervalo("13:00", "13:30")];
    const existentes = [intervalo("12:40", "12:50")];
    const { aceptados, omitidos } = separarSolapados(candidatos, existentes);
    expect(aceptados).toEqual([candidatos[0], candidatos[2]]);
    expect(omitidos).toEqual([candidatos[1]]);
  });

  it("tampoco acepta candidatos que se cruzan entre sí", () => {
    const candidatos = [intervalo("12:00", "12:30"), intervalo("12:15", "12:45")];
    expect(separarSolapados(candidatos, []).aceptados).toEqual([candidatos[0]]);
  });
});
