import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { diagramas, idRequisito, trazabilidad } from "@/lib/diseno-uml";

const todosLosRequisitos = Array.from({ length: 35 }, (_, indice) => idRequisito(indice + 1));

describe("Diseño UML: trazabilidad de requisitos a casos de uso", () => {
  it("contiene RF-01 a RF-35 sin duplicados", () => {
    const requisitos = trazabilidad.map((fila) => fila.rf);
    expect(new Set(requisitos).size).toBe(requisitos.length);
    expect([...requisitos].sort()).toEqual(todosLosRequisitos);
  });

  it("cada requisito RF-nn tiene el caso de uso CU-nn con el mismo número", () => {
    for (const fila of trazabilidad) {
      expect(fila.cu, `caso de uso de ${fila.rf}`).toBe(fila.rf.replace("RF-", "CU-"));
      expect(fila.casoUso.trim(), `nombre del caso de uso de ${fila.rf}`).not.toBe("");
      expect(fila.actor.trim(), `actor de ${fila.rf}`).not.toBe("");
    }
  });

  it("las relaciones «include» y «extend» indican con qué caso de uso se relacionan", () => {
    for (const fila of trazabilidad.filter((f) => f.relacion !== "asociacion")) {
      expect(fila.detalle, `detalle de ${fila.rf}`).toMatch(/CU-\d{2}/);
    }
  });

  it("los diagramas de módulo cubren los 35 requisitos una sola vez", () => {
    const modulos = diagramas.filter((diagrama) => diagrama.id.startsWith("cu-modulo-"));
    expect(modulos).toHaveLength(8);
    const cubiertos = modulos.flatMap((diagrama) => diagrama.requisitos);
    expect(cubiertos).toEqual(todosLosRequisitos);
  });

  it("hay dieciocho diagramas con imagen SVG y texto alternativo", () => {
    expect(diagramas).toHaveLength(18);
    for (const diagrama of diagramas) {
      expect(diagrama.archivo).toMatch(/^\/diagramas\/[a-z0-9-]+\.svg$/);
      expect(diagrama.alt.trim()).not.toBe("");
    }
  });

  it("hay 10 diagramas del eje 2, 5 estructurales y 3 de comportamiento del eje 3", () => {
    const contar = (eje: number, categoria: string) =>
      diagramas.filter((diagrama) => diagrama.eje === eje && diagrama.categoria === categoria).length;
    expect(contar(2, "casos-uso")).toBe(10);
    expect(contar(3, "estructural")).toBe(5);
    expect(contar(3, "comportamiento")).toBe(3);
  });

  it("cada SVG existe en public/diagramas/ y su viewBox coincide con ancho y alto", () => {
    for (const diagrama of diagramas) {
      const contenido = readFileSync(path.join(process.cwd(), "public", diagrama.archivo), "utf-8");
      const viewBox = contenido.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(viewBox, `viewBox de ${diagrama.archivo}`).not.toBeNull();
      expect(Number(viewBox![1]), `ancho de ${diagrama.archivo}`).toBe(diagrama.ancho);
      expect(Number(viewBox![2]), `alto de ${diagrama.archivo}`).toBe(diagrama.alto);
    }
  });
});
