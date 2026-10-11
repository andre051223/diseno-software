import { describe, expect, it } from "vitest";
import { listaRoles, menuPorRol, puedeAcceder, esRutaProtegida, inicioDeRol } from "@/lib/roles";
import { firmarSesion, verificarSesion } from "@/lib/token-sesion";

describe("RF-01: token de sesión firmado", () => {
  it("firma y verifica el contenido de la sesión", async () => {
    const token = await firmarSesion({ usuarioId: 7, rol: "medico", nombre: "Dra. Prueba" });
    expect(await verificarSesion(token)).toEqual({ usuarioId: 7, rol: "medico", nombre: "Dra. Prueba" });
  });

  it("rechaza un token alterado", async () => {
    const token = await firmarSesion({ usuarioId: 7, rol: "paciente", nombre: "Prueba" });
    const [cabecera, , firma] = token.split(".");
    const cuerpoFalso = Buffer.from(JSON.stringify({ sub: "1", rol: "administrador" })).toString("base64url");
    expect(await verificarSesion(`${cabecera}.${cuerpoFalso}.${firma}`)).toBeNull();
    expect(await verificarSesion(undefined)).toBeNull();
  });
});

describe("RF-02: cada rol accede solo a su menú", () => {
  it("existen los siete roles y cada uno tiene menú", () => {
    expect(listaRoles).toHaveLength(7);
    for (const rol of listaRoles) expect(menuPorRol[rol].length).toBeGreaterThan(0);
  });

  it("todas las opciones del menú son accesibles para su rol", () => {
    for (const rol of listaRoles) {
      for (const elemento of menuPorRol[rol]) expect(puedeAcceder(rol, elemento.href)).toBe(true);
      expect(puedeAcceder(rol, inicioDeRol(rol))).toBe(true);
    }
  });

  it("impide que un rol abra rutas de otro", () => {
    expect(puedeAcceder("paciente", "/usuarios")).toBe(false);
    expect(puedeAcceder("medico", "/reportes")).toBe(false);
    expect(puedeAcceder("agente_telefonico", "/llegadas")).toBe(false);
    expect(puedeAcceder("recepcionista", "/llegadas")).toBe(true);
    // Un prefijo parecido no debe dar acceso.
    expect(puedeAcceder("paciente", "/mis-citas-falsas")).toBe(false);
  });

  it("las rutas públicas no exigen sesión", () => {
    expect(esRutaProtegida("/")).toBe(false);
    expect(esRutaProtegida("/iniciar-sesion")).toBe(false);
    expect(esRutaProtegida("/registro")).toBe(false);
    expect(esRutaProtegida("/usuarios/3")).toBe(true);
  });
});
