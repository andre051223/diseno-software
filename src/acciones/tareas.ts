"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/sesion";
import { ejecutarTareasProgramadas } from "@/servicios/tareas";

// RF-14, RF-23 y RF-25: el administrador ejecuta los procesos programados para la demostración.
export async function ejecutarTareasAccion() {
  const actor = await requerirRol("administrador");
  await ejecutarTareasProgramadas("panel", actor.id);
  // RF-26: los cambios de estado se reflejan en todas las pantallas.
  revalidatePath("/", "layout");
  redirect("/tareas?ejecutada=1");
}
