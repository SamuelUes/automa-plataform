# Diseño integral de producto y plataforma

## Contexto

Prologistica AI Command Center es una consola operativa B2B para gestionar casos, correos, aprobaciones, delegaciones, seguimientos, conversaciones y automatizaciones. La plataforma usa Next.js 16, React 19, Tailwind CSS v4, Radix UI, Supabase, Edge Functions y n8n.

El objetivo es mejorar diseño y funcionalidades en toda la plataforma sin reemplazar la arquitectura de información, las rutas, la identidad visual ni el trabajo responsive existente.

## Dirección aprobada

La plataforma evolucionará mediante tres capas, aplicadas en este orden:

1. Sistema unificado de datos, comandos y estados.
2. Cockpit de operación diaria centrado en colas de trabajo.
3. Supervisión progresiva de IA y automatizaciones.

Esta secuencia evita construir nuevas experiencias sobre contratos de datos inconsistentes.

## Principios de diseño

- Producto sobrio, técnico y orientado a decisiones.
- Densidad alta pero legible.
- Color reservado para identidad, estado y acción.
- Superficies tonales y bordes suaves como estrategia de profundidad.
- Una acción primaria por contexto.
- Movimiento limitado a feedback y cambios de estado.
- Patrones familiares para navegación, tablas, filtros, formularios y diálogos.
- Estados loading, empty, error, offline, stale y success explícitos.
- Sin mockups, gradientes decorativos, glassmorphism ni animaciones de presentación.

## Sistema visual

Se conservarán los tokens OKLCH, radios y temas claro/oscuro actuales. La jerarquía se reforzará mediante peso, contraste y espacio, no aumentando indiscriminadamente el tamaño tipográfico.

Los controles tendrán una altura táctil mínima de 40 px en escritorio y 44 px en móvil. Botones, inputs, selects, diálogos y badges compartirán estados default, hover, focus, active, disabled y loading.

Se mantendrá Lucide como única familia de iconos porque ya forma parte del producto. No se añadirá otra librería visual.

## Arquitectura frontend

### ResourcePage

Patrón compartido para páginas de recursos:

- Título y descripción.
- Acción primaria.
- Filtros y búsqueda.
- Resumen de resultados.
- Loading, empty y error.
- Contenido en tabla, lista, timeline o board.
- Paginación en recursos que superen el tamaño de página configurado.

Se aplicará progresivamente a casos, correos, aprobaciones, delegaciones, seguimientos, automatizaciones y actividad.

### CommandButton

Todas las mutaciones operativas usarán un contrato compartido. El botón mostrará:

- Submitting.
- Queued.
- Running.
- Awaiting approval.
- Succeeded.
- Failed.
- Stale.

El frontend no decidirá si una transición es válida. Esa responsabilidad permanecerá en Edge Functions y el motor de decisiones.

### Capa de queries

TanStack Query será la capa consistente para datos interactivos del cliente. Las queries se organizarán por recurso y las mutaciones invalidarán únicamente las claves relacionadas.

Realtime dejará de refrescar rutas completas y pasará a invalidar queries concretas según tabla y organización.

### Select compartido

Se creará un Select basado en Radix, dependencia ya instalada. Reemplazará selectores nativos en filtros y formularios donde sea necesario mantener consistencia, accesibilidad y búsqueda de opciones.

### Command Center

La búsqueda global evolucionará hacia una paleta accesible:

- Apertura con Cmd/Ctrl + K.
- Búsqueda de casos, correos, contactos y workflows.
- Navegación completa por teclado.
- Acciones de navegación y creación.
- Sheet en móvil y diálogo en escritorio.
- Confirmación antes de ejecutar acciones sensibles.

## Contratos operativos

### CommandRequest

Cada mutación incluirá:

- Tipo de comando.
- Tipo e ID del recurso objetivo.
- Payload.
- Request ID.
- Correlation ID.
- Idempotency key.
- Expected version para entidades mutables que dispongan de versionado.

### CommandResponse

Las respuestas posibles serán:

- Accepted.
- Pending approval.
- Completed.
- Rejected con código estructurado.

### Error estructurado

Todas las Edge Functions relevantes devolverán:

- `code`
- `message`
- `correlation_id`

No se expondrán secretos, razonamiento interno de modelos ni detalles sensibles del backend.

## Diseño por ruta

### Dashboard

El dashboard responderá rápidamente:

- Qué requiere atención.
- Qué está vencido.
- Qué cambió recientemente.
- Si las automatizaciones están saludables.

Las métricas estáticas se sustituirán por un RPC. La actividad será real y la cola de atención combinará casos, aprobaciones y seguimientos.

### Casos

- Datos reales de contacto, empresa, departamento y responsable.
- Filtros Asignados a mí, Sin asignar, Vencidos y Requieren aprobación.
- Búsqueda paginada en servidor.
- Timeline real.
- Acciones según estado y permisos.
- Formulario con contacto, departamento, responsable y prioridad.
- Tabla, tarjetas responsive y Kanban conservados.

### Correos

- Agrupación por thread cuando el modelo de datos lo permita.
- Crear caso desde correo.
- Vincular correo a caso existente.
- Enlaces mediante `case_id` real.
- Búsqueda full-text.
- Composición y respuesta con contactos sugeridos.
- Realtime selectivo.

### Aprobaciones

- Eliminar datos estáticos.
- Vistas Pendientes, Delegadas, Escaladas e Histórico.
- Mostrar borrador, motivo, solicitante y contexto.
- Aprobar y enviar.
- Rechazo con comentario obligatorio.
- Estado actualizado desde la fuente de verdad.

### Delegaciones

- Sustituir UUID manuales por Select.
- Aceptar, rechazar, reasignar y completar.
- Mostrar asignador, responsable, caso y motivo.
- Aplicar permisos por rol.

### Seguimientos

- Agrupar en Vencidos, Hoy y Próximos.
- Posponer un día o una semana.
- Completar y abrir el caso relacionado.
- Filtrar por responsable.
- Calcular fechas usando una zona horaria consistente.

### Asistente

- Eliminar contexto estático.
- Añadir comandos rápidos.
- Renderizar propuestas estructuradas.
- Confirmar, editar o cancelar antes de ejecutar.
- Mantener conversaciones y mensajes como fuente de verdad.

### Automatizaciones

- Salud real por workflow.
- Última ejecución, tasa de error, duración y estado.
- Detalle de ejecuciones y eventos.
- Reintentos y referencias externas.
- Realtime filtrado por workflow.

### Actividad

- Ledger unificado con eventos, auditoría y acciones.
- Actor y tipo de entidad legibles.
- Búsqueda por correlation ID.
- Enlaces a los recursos relacionados.
- Tonos semánticos derivados del tipo de evento.

### Configuración

- Persistir ajustes de IA y automatización.
- Mantener perfil, organización, usuarios, departamentos, notificaciones y seguridad.
- Añadir niveles Auto, Sugerir y Pausar en una fase posterior.
- Añadir políticas de aprobación y controles de emergencia sólo después de validar los flujos operativos.

## Supabase y seguridad

Los cambios de esquema se harán mediante migraciones creadas por Supabase CLI. Antes de implementar se verificará la versión del CLI, el changelog relevante y la estructura real de la base.

Toda tabla nueva en esquemas expuestos tendrá RLS. Las vistas serán `security_invoker` y filtrarán por organización. Las políticas combinarán autenticación con autorización por organización, usuario o rol.

Las primeras piezas de datos serán:

- `case_summaries`
- `activity_feed`
- `follow_ups_due`
- `pending_approvals_with_context`
- `get_dashboard_summary()`
- `get_daily_attention()`

También se resolverá la discrepancia entre el webhook y la tabla ausente `authority_decisions` antes de extender el flujo de autoridad.

## Datos demo

Los datos demo dejarán de actuar como fallback silencioso. Se habilitarán únicamente con un modo demo explícito. En producción:

- Cero registros mostrará un EmptyState.
- Error de red mostrará ErrorState con reintento.
- Falta de permisos mostrará un estado no autorizado.

## Permisos

- Viewer: lectura.
- Agent: crear casos, notas, mensajes y completar seguimientos permitidos.
- Manager, Admin y Owner: acciones operativas avanzadas.
- Aprobaciones limitadas al usuario solicitado o a roles autorizados.

La UI ocultará o deshabilitará acciones según capacidades, pero el servidor seguirá validando cada operación.

## Fases

### Fase 1: fundamentos

- Tipos de comandos, operaciones y errores.
- Select Radix.
- Estados compartidos.
- Queries tipadas.
- Realtime selectivo.
- Modo demo explícito.
- Corrección de idempotencia.

### Fase 2: cockpit operativo

- Dashboard real.
- Casos reales y paginados.
- Timeline y acciones de caso.
- Badges dinámicos.

### Fase 3: decisiones y handoffs

- Correos vinculados a casos.
- Aprobaciones reales.
- Delegaciones operativas.
- Seguimientos por fecha y responsable.

### Fase 4: comando y trazabilidad

- Command Center.
- Salud de automatizaciones.
- Detalle de ejecución.
- Activity ledger.

### Fase 5: IA supervisada

- Propuestas estructuradas.
- Políticas de aprobación.
- Niveles de autonomía.
- Overrides humanos.

### Fase 6: hardening

- Revisión RLS.
- Pruebas multi-tenant.
- Idempotencia y stale state.
- Accesibilidad.
- Responsive.
- Lint, typecheck y build.
- Pruebas de integración con Edge Functions y n8n.

## Fuera de alcance inicial

- Reemplazar Supabase o n8n.
- Cambiar rutas o labels principales de navegación.
- Crear una nueva identidad de marca.
- Exponer razonamiento interno del modelo.
- Añadir visualizaciones decorativas sin utilidad operativa.
- Crear todas las tablas avanzadas de IA antes de validar las fases operativas.

## Criterios de aceptación

- No quedan métricas o colas críticas respaldadas por datos estáticos en producción.
- Toda mutación importante tiene estado y error visible.
- Las páginas principales comparten patrones de cabecera, filtros y estados.
- Realtime no refresca rutas completas.
- Búsqueda y Command Center funcionan con teclado y móvil.
- Los filtros y formularios no requieren introducir UUID manuales.
- Las vistas y RPCs respetan aislamiento por organización.
- No se introducen regresiones responsive ni de tema.
- Lint, typecheck y build finalizan correctamente.
