import type { Rol } from "@/generated/prisma/enums";

/** Nombres visibles de los siete roles (RF-02). */
export const nombresRoles: Record<Rol, string> = {
  paciente: "Paciente",
  recepcionista: "Recepcionista",
  agente_telefonico: "Agente telefónico",
  medico: "Médico",
  coordinador_agenda: "Coordinador de agenda",
  director_medico: "Director médico",
  administrador: "Administrador",
};

export const listaRoles = Object.keys(nombresRoles) as Rol[];

export type ElementoMenu = { href: string; etiqueta: string };

/** Menú de cada rol: cada perfil ve solo sus opciones (RF-01, RF-02). */
export const menuPorRol: Record<Rol, ElementoMenu[]> = {
  paciente: [
    { href: "/mis-citas", etiqueta: "Mis citas" },
    { href: "/mis-citas/nueva", etiqueta: "Nueva cita" },
    { href: "/mis-datos", etiqueta: "Mis datos" },
  ],
  recepcionista: [
    { href: "/llegadas", etiqueta: "Registro de llegada" },
    { href: "/agendar", etiqueta: "Agendar cita" },
    { href: "/pacientes", etiqueta: "Pacientes" },
  ],
  agente_telefonico: [
    { href: "/pacientes", etiqueta: "Pacientes" },
    { href: "/agendar", etiqueta: "Agendar cita" },
  ],
  medico: [{ href: "/agenda-medico", etiqueta: "Agenda del día" }],
  coordinador_agenda: [
    { href: "/coordinacion/especialidades", etiqueta: "Especialidades" },
    { href: "/coordinacion/consultorios", etiqueta: "Consultorios" },
    { href: "/coordinacion/medicos", etiqueta: "Médicos" },
    { href: "/coordinacion/disponibilidad", etiqueta: "Disponibilidad semanal" },
    { href: "/coordinacion/novedades", etiqueta: "Novedades" },
  ],
  director_medico: [{ href: "/reportes", etiqueta: "Reportes" }],
  administrador: [
    { href: "/usuarios", etiqueta: "Usuarios y roles" },
    { href: "/bitacora", etiqueta: "Bitácora" },
    { href: "/bandeja-salida", etiqueta: "Bandeja de salida" },
    { href: "/tareas", etiqueta: "Tareas programadas" },
  ],
};

/**
 * Prefijos de ruta permitidos por rol. El proxy los usa para impedir que un rol
 * abra pantallas de otro aunque escriba la dirección a mano.
 */
export const rutasPorRol: Record<Rol, string[]> = {
  paciente: ["/mis-citas", "/mis-datos"],
  recepcionista: ["/llegadas", "/agendar", "/pacientes", "/citas"],
  agente_telefonico: ["/agendar", "/pacientes", "/citas"],
  medico: ["/agenda-medico", "/historia-clinica"],
  coordinador_agenda: ["/coordinacion"],
  director_medico: ["/reportes"],
  administrador: ["/usuarios", "/bitacora", "/bandeja-salida", "/tareas"],
};

/** Todas las rutas que exigen sesión. */
export const rutasProtegidas = Array.from(new Set(Object.values(rutasPorRol).flat()));

export function coincideRuta(ruta: string, prefijo: string): boolean {
  return ruta === prefijo || ruta.startsWith(`${prefijo}/`);
}

export function puedeAcceder(rol: Rol, ruta: string): boolean {
  return rutasPorRol[rol].some((prefijo) => coincideRuta(ruta, prefijo));
}

export function esRutaProtegida(ruta: string): boolean {
  return rutasProtegidas.some((prefijo) => coincideRuta(ruta, prefijo));
}

/** Página de inicio de cada rol después de iniciar sesión. */
export function inicioDeRol(rol: Rol): string {
  return menuPorRol[rol][0].href;
}
