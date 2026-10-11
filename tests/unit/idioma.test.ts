import { describe, expect, it } from "vitest";
import { z } from "zod";
import "@/lib/validaciones/idioma";

describe("Mensajes de validación en español", () => {
  it("las validaciones sin mensaje propio responden en español", () => {
    const resultado = z.object({ correo: z.email(), edad: z.number().min(18) }).safeParse({ correo: "x", edad: 3 });
    expect(resultado.success).toBe(false);
    const mensajes = resultado.error!.issues.map((issue) => issue.message).join(" ");
    expect(mensajes).toMatch(/inválid|Demasiado pequeño/i);
    expect(mensajes).not.toMatch(/Invalid|Too small/);
  });
});
