# Diseño: interacciones funcionales del dashboard

## Objetivo

Convertir los botones actualmente sin comportamiento en interacciones útiles y coherentes. Las operaciones de frontend (filtros, selección, fechas y vistas) deben permanecer locales. Las operaciones de negocio sobre datos reales deben persistir mediante Supabase y, cuando corresponda, `createAction`/n8n. Los datos demo deben continuar siendo utilizables sin fingir persistencia real.

## Alcance

Páginas incluidas:

- `src/app/(dashboard)/cases/page.tsx`
- `src/app/(dashboard)/cases/[id]/page.tsx`
- `src/app/(dashboard)/emails/page.tsx`
- `src/app/(dashboard)/activity/page.tsx`
- `src/app/(dashboard)/delegations/page.tsx`
- `src/app/(dashboard)/follow-ups/page.tsx`

Se reutilizarán las dependencias actuales: Supabase, Radix/shadcn existente, `react-hook-form`, `zod`, `sonner` y `lucide-react`. No se agrega una dependencia nueva sin una necesidad comprobada.

## Clasificación de interacciones

### Solo frontend

- Búsqueda, filtros de estado/prioridad y cambio Tabla/Kanban en casos.
- Más filtros de casos y correos.
- Selección de correo.
- Filtros Activas/Completadas de delegaciones.
- Filtros de estado de seguimientos.
- Filtros de actividad y selector de rango de fechas.
- Menús que solo exponen opciones de interfaz.
- Actualizar actividad: vuelve a consultar `audit_logs`, pero no crea una acción n8n.

### Persistencia/operaciones reales

- Crear caso: inserta en `cases` con título obligatorio y campos opcionales compatibles con el esquema.
- Resolver caso: `createAction("resolve_case", { case_id })`.
- Verificar/cerrar caso desde Más acciones: `verify_case`/`close_case`, respetando permisos y estado.
- Delegar caso: formulario validado y `createAction("delegate_case", ...)`.
- Crear seguimiento: formulario validado y `createAction("schedule_follow_up", ...)`.
- Ejecutar seguimiento: conserva `schedule_follow_up`.
- Completar seguimiento/delegación: conserva la acción existente con confirmación y refresco.
- Redactar, responder y reenviar correo: formularios que utilizan `send_email`.
- Archivar correo: solo se persistirá si se comprueba una columna o acción compatible en el esquema.
- Adjuntar: no se simula; queda fuera de persistencia hasta verificar Storage y adjuntos.

## Arquitectura

Las páginas usarán una capa ligera y reutilizable para:

- distinguir IDs demo (`demo-*`) de UUID reales;
- presentar estados de carga, éxito y error con `sonner`;
- normalizar errores de Supabase y Edge Functions;
- refrescar desde Supabase después de una mutación real;
- actualizar estado local para acciones demo, indicando que el cambio no se guardó en la base.

Las operaciones de negocio existentes pasarán por `createAction`, que mantiene validación, idempotencia, control de organización, auditoría y disparo de workflow. No se enviarán filtros o fechas de visualización a n8n.

## Formularios

### Nuevo caso

Diálogo modal con título obligatorio, descripción opcional, prioridad, contacto, departamento y responsable cuando existan opciones disponibles. Validación con `zod` y `react-hook-form`. En datos reales inserta `cases`; en demo agrega un registro local.

### Delegar caso

Diálogo con caso, responsable obligatorio, departamento opcional y motivo opcional. En datos reales usa `delegate_case`. El éxito inicial se comunica como acción encolada/procesándose, no como finalización inmediata.

### Nuevo seguimiento

Diálogo con caso, fecha/hora obligatoria y motivo opcional. Valida fecha y conserva la zona horaria local al enviar `scheduled_for`. En datos reales usa `schedule_follow_up`; en demo agrega el seguimiento local.

### Correo

Diálogo reutilizable para redactar, responder y reenviar con destinatarios, CC, asunto y cuerpo. Responder y reenviar prellenan datos del correo seleccionado. Los adjuntos requieren soporte real comprobado antes de activarse.

## Menús y confirmaciones

- `Más acciones` en detalle de caso muestra acciones contextuales según estado y permisos.
- `Más opciones` usa `DropdownMenu` y no muta datos hasta seleccionar una operación.
- Resolver, completar delegación y completar seguimiento usan confirmación.
- Los controles se deshabilitan durante solicitudes y muestran spinner/estado pendiente.
- Las respuestas 201/202 se comunican como acción creada o en proceso.

## Permisos y errores

La UI puede ocultar o deshabilitar acciones según el perfil cargado, pero la autorización definitiva queda en Edge Functions. `resolve_case`, `verify_case` y `close_case` ya requieren roles `owner`, `admin` o `manager`.

Se distinguirán:

- 401: sesión no autorizada.
- 403: permisos insuficientes.
- 404: registro inexistente o fuera de la organización.
- 422: formulario o payload inválido.
- Error de n8n: acción creada pero workflow pendiente/no disponible, cuando el backend lo confirme.
- Error de red/consulta: no se modifica el estado local como si la operación hubiera terminado.

## Verificación

Ejecutar:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Validar manualmente con datos demo y reales: apertura/cierre de diálogos, validación, filtros, fechas, estados de carga, errores de permisos, respuestas 201/202, acciones idempotentes y refresco posterior. Revisar `git diff` para conservar cambios preexistentes en delegaciones.
