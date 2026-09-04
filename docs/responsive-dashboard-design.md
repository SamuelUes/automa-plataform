# Diseño responsive del dashboard

## Contexto

La aplicación es una consola operativa B2B para gestionar casos, correos, aprobaciones, seguimientos y automatizaciones. La base actual usa Next.js 16, React 19, Tailwind CSS v4, Radix UI y tokens semánticos en OKLCH. El objetivo es mejorar el comportamiento responsive del dashboard completo sin cambiar la identidad visual, las rutas, la navegación principal ni la lógica de datos.

## Dirección aprobada

Se aplicará una estrategia **shell primero**, seguida de ajustes específicos por pantalla. Se conservará la estética sobria y utilitaria actual, con prioridad para legibilidad, densidad controlada, accesibilidad y uso táctil.

No se crearán mockups, no se añadirá otra librería de UI y no se hará una reescritura visual completa.

## Objetivos

- Evitar overflow horizontal accidental entre 320 px y 1023 px.
- Hacer que navegación, acciones y filtros sean utilizables con una mano en móvil.
- Mantener densidad útil en tablet y escritorio.
- Reemplazar composiciones que sólo funcionan en escritorio por estados y layouts explícitos.
- Preservar rutas, labels principales, comportamiento de datos y eventos existentes.

## Breakpoints y reglas de layout

- Menos de 640 px: una columna, acciones apiladas, controles a ancho completo cuando sea necesario.
- 640-767 px: agrupación flexible de acciones y formularios de dos columnas sólo cuando el contenido quepa.
- 768-1023 px: layouts de dos columnas para contenido compatible; navegación móvil todavía disponible.
- Desde 1024 px: sidebar persistente y layouts de escritorio.
- Desde 1280 px: paneles densos como correo de tres columnas y kanban completo.

Todos los cambios multi-columna declararán explícitamente su fallback por debajo de 768 px. El contenido principal usará ancho fluido con límites razonables y padding reducido en pantallas estrechas.

## Cambios por área

### App shell

- Mantener sidebar persistente desde `lg` y Sheet de navegación por debajo de `lg`.
- Hacer que el header móvil tenga una jerarquía clara: menú, contexto abreviado y acciones esenciales.
- Evitar que búsqueda, ayuda, notificaciones, tema y avatar desborden el viewport.
- Mantener cierre del Sheet al navegar y targets táctiles adecuados.
- Ajustar el contenedor principal para no desperdiciar ancho en móviles.

### Dashboard

- Cabecera: título y descripción arriba; actualización debajo o alineada sólo cuando haya espacio.
- Atención requerida: una columna en móvil, dos en tablet y cuatro sólo en anchos grandes.
- Resumen diario: cuadrícula 2x2 en móvil sin separadores verticales que corten el contenido.
- Actividad reciente y automatizaciones: listas legibles, truncado controlado y estados conservados.

### Casos

- Búsqueda a ancho completo en móvil.
- Filtros agrupados sin desbordamiento; los filtros secundarios permanecen en panel desplegable.
- Tabla de escritorio desde `md`.
- Vista de tarjetas/lista para móvil con la misma información esencial y enlaces a detalle.
- Kanban con scroll horizontal intencional dentro de su región, sin provocar scroll global accidental.

### Correos

- Desde `lg`: bandeja, detalle y panel auxiliar en tres columnas.
- Entre `md` y `lg`: bandeja compacta y detalle en composición de dos paneles.
- Menos de `md`: alternar entre bandeja y detalle dentro de la misma vista, con acción explícita para volver.
- Mantener búsqueda, filtros, selección, respuesta, reenvío y archivado.
- Las acciones del mensaje podrán envolver de forma controlada sin salir del viewport.

### Configuración

- Desde `lg`: navegación lateral y contenido.
- Por debajo de `lg`: navegación de secciones en una lista horizontal desplazable, sin ocupar una columna permanente.
- Formularios de dos columnas desde `sm` sólo cuando las etiquetas y campos mantengan legibilidad.
- Acciones principales a ancho completo en móvil.
- Filas de usuarios y departamentos con composición vertical clara en pantallas estrechas.

### Componentes compartidos

- Revisar Cards, Buttons, Inputs, Sheets, diálogos operativos, badges y estados para evitar tamaños o paddings que creen overflow.
- Mantener estados loading, empty, error y success existentes.
- Respetar foco visible, labels, contraste y targets táctiles mínimos de 44 px.

## Datos y comportamiento

No se modificará el flujo de Supabase, las consultas, los formularios, los nombres de campos ni las acciones existentes. Los cambios de layout se resolverán en la capa de presentación. Cuando una vista móvil necesite alternar entre regiones, el estado será local al componente cliente y no afectará a la selección o filtros existentes.

## Accesibilidad y rendimiento

- No se añadirá animación decorativa.
- Se conservarán las transiciones actuales y se evitarán animaciones de propiedades de layout.
- Los elementos interactivos seguirán siendo accesibles por teclado y lector de pantalla.
- Los contenedores con scroll tendrán límites y foco comprensible.
- No se añadirán dependencias nuevas.

## Verificación

Se verificará con:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Revisión manual en 320, 375, 768, 1024 y 1280 px.
- Revisión en modo claro y oscuro.
- Comprobación de navegación por teclado, foco, diálogos, Sheet móvil y scroll horizontal localizado.
- Comprobación de que las rutas y acciones principales siguen funcionando.

## Fuera de alcance

- Cambios de marca, paleta o tipografía global.
- Cambios de rutas, IA de navegación o labels principales.
- Nuevas funciones de datos o persistencia.
- Rediseño de autenticación.
- Nueva librería de componentes o sistema de diseño.
