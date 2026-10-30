# Diagramas UML (ejes 2 y 3)

Esta carpeta contiene las fuentes en PlantUML de los diagramas del sistema de gestión de citas médicas del Hospital Central San Rafael: los diagramas de casos de uso del eje 2, que modelan los 35 requisitos funcionales definidos en el eje 1, y los diagramas estructurales y de comportamiento del eje 3. Todos se publican en la página [`/diseno-uml`](https://diseno-software.vercel.app/diseno-uml).

## Contenido

### Eje 2: casos de uso

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

### Eje 3: diagramas estructurales y de comportamiento

| Archivo | Diagrama | Categoría | Requisitos |
|---|---|---|---|
| `11-diagrama-clases.puml` | Diagrama de clases del dominio | Estructural | RF-01 a RF-35 |
| `12-diagrama-objetos.puml` | Diagrama de objetos después de confirmar la cita HSR-7K3QX2 | Estructural | RF-13, RF-15, RF-19, RF-20 y RF-24 |
| `13-diagrama-componentes.puml` | Diagrama de componentes | Estructural | RF-01 a RF-35 |
| `14-diagrama-paquetes.puml` | Diagrama de paquetes | Estructural | RF-01 a RF-35 |
| `15-diagrama-despliegue.puml` | Diagrama de despliegue en Vercel y Neon | Estructural | RF-21, RF-23, RF-25 y RF-31 |
| `16-secuencia-iniciar-sesion.puml` | Secuencia del inicio de sesión | Comportamiento | RF-01 y RF-03 |
| `17-secuencia-agendar-cita.puml` | Secuencia de la confirmación de una cita | Comportamiento | RF-13, RF-14, RF-15, RF-18, RF-20, RF-21, RF-23 y RF-24 |
| `18-secuencia-recordatorio.puml` | Secuencia del envío y la respuesta del recordatorio | Comportamiento | RF-25 y RF-26 |

### Estilo compartido

`estilo.iuml` define los colores, las fuentes y la resolución que incluyen todos los diagramas mediante `!include estilo.iuml`.

Las imágenes SVG generadas están en [`public/diagramas/`](../../public/diagramas/). Las imágenes PNG no se guardan en el repositorio.

## Convención CU-nn = RF-nn

Cada caso de uso **CU-nn representa al requisito RF-nn** con el mismo número: CU-13 corresponde a RF-13, CU-35 a RF-35, y así con los 35. Los casos que ejecuta el sistema sin un actor humano se relacionan con el caso que los dispara mediante «include» (siempre ocurren) o «extend» (ocurren bajo una condición).

La tabla completa de trazabilidad está en [`src/lib/diseno-uml.ts`](../../src/lib/diseno-uml.ts) y se muestra al final de la página `/diseno-uml`.

## Regenerar los SVG

PlantUML y Java no son dependencias del proyecto. Para regenerar las imágenes después de editar un `.puml`, descargue el JAR de [PlantUML](https://plantuml.com/download), tenga Java instalado y ejecute desde la raíz del repositorio:

```bash
java -DPLANTUML_LIMIT_SIZE=8192 -jar plantuml.jar -tsvg -charset UTF-8 docs/uml/*.puml -o ../../public/diagramas
```

El diagrama 18 supera el tamaño máximo de imagen que PlantUML admite por defecto (4096 px), por eso el comando incluye `-DPLANTUML_LIMIT_SIZE=8192`; sin esa opción el diagrama se recorta. La ruta de `-o` es relativa a la carpeta de cada fuente, por eso sube dos niveles. Si cambian las dimensiones de un diagrama, actualice `ancho` y `alto` en `src/lib/diseno-uml.ts` con los valores del `viewBox` del SVG.
