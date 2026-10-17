# Diagramas UML (eje 2)

Esta carpeta contiene las fuentes en PlantUML de los diagramas de casos de uso del sistema de gestión de citas médicas del Hospital Central San Rafael. Los diagramas modelan los 35 requisitos funcionales definidos en el eje 1 y se publican en la página [`/diseno-uml`](https://diseno-software.vercel.app/diseno-uml).

## Contenido

| Archivo | Diagrama | Requisitos |
|---|---|---|
| `01-diagrama-roles.puml` | Jerarquía de actores (roles) | RF-01 y RF-02 |
| `02-casos-uso-sistema.puml` | Casos de uso del sistema (14 casos de alto nivel) | RF-01 a RF-35 |
| `03-cu-modulo-1-autenticacion.puml` | Módulo 1. Autenticación y control de acceso | RF-01 a RF-04 |
| `04-cu-modulo-2-pacientes.puml` | Módulo 2. Registro de pacientes | RF-05 a RF-07 |
| `05-cu-modulo-3-agenda.puml` | Módulo 3. Médicos, especialidades, horarios y consultorios | RF-08 a RF-11 |
| `06-cu-modulo-4-agendamiento.puml` | Módulo 4. Agendamiento, reprogramación y cancelación | RF-12 a RF-20 |
| `07-cu-modulo-5-cobertura.puml` | Módulo 5. Validación de cobertura | RF-21 a RF-23 |
| `08-cu-modulo-6-notificaciones.puml` | Módulo 6. Notificaciones y recordatorios | RF-24 a RF-27 |
| `09-cu-modulo-7-atencion.puml` | Módulo 7. Registro de llegada y atención | RF-28 a RF-31 |
| `10-cu-modulo-8-reportes.puml` | Módulo 8. Reportes de gestión | RF-32 a RF-35 |
| `estilo.iuml` | Estilo compartido (colores, fuentes y resolución) que incluyen todos los diagramas | |

Las imágenes SVG generadas están en [`public/diagramas/`](../../public/diagramas/). Las imágenes PNG no se guardan en el repositorio.

## Convención CU-nn = RF-nn

Cada caso de uso **CU-nn representa al requisito RF-nn** con el mismo número: CU-13 corresponde a RF-13, CU-35 a RF-35, y así con los 35. Los casos que ejecuta el sistema sin un actor humano se relacionan con el caso que los dispara mediante «include» (siempre ocurren) o «extend» (ocurren bajo una condición).

La tabla completa de trazabilidad está en [`src/lib/diseno-uml.ts`](../../src/lib/diseno-uml.ts) y se muestra al final de la página `/diseno-uml`.

## Regenerar los SVG

PlantUML y Java no son dependencias del proyecto. Para regenerar las imágenes después de editar un `.puml`, descargue el JAR de [PlantUML](https://plantuml.com/download), tenga Java instalado y ejecute desde la raíz del repositorio:

```bash
java -jar plantuml.jar -tsvg -charset UTF-8 docs/uml/*.puml -o ../../public/diagramas
```

La ruta de `-o` es relativa a la carpeta de cada fuente, por eso sube dos niveles. Si cambian las dimensiones de un diagrama, actualice `ancho` y `alto` en `src/lib/diseno-uml.ts` con los valores del `viewBox` del SVG.
