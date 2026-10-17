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

  it("hay diez diagramas con imagen SVG y texto alternativo", () => {
    expect(diagramas).toHaveLength(10);
    for (const diagrama of diagramas) {
      expect(diagrama.archivo).toMatch(/^\/diagramas\/[a-z0-9-]+\.svg$/);
      expect(diagrama.alt.trim()).not.toBe("");
    }
  });
});
