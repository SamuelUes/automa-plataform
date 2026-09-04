# Action Center y diálogos operativos

## Diseño aprobado

La plataforma conservará sus rutas y componentes actuales. Los diálogos evolucionarán hacia un Action Center contextual que sólo muestra acciones permitidas por el estado, rol y contrato backend del recurso.

## Contratos existentes

La Edge Function `actions` ya soporta:

- `approve_email` y `reject_approval` mediante PE07.
- `send_email` mediante PE07.
- `delegate_case` mediante PE04.
- `schedule_follow_up` mediante PE06.
- `resolve_case`, `verify_case` y `close_case` mediante PE12.
- `execute_workflow` como punto de extensión para workflows existentes.

No se añadirá una acción de adjuntos hasta ejecutar y verificar el contrato de Storage ubicado en `supabase/migrations/storage/`.

## Interfaz

Se reutilizarán:

- `OperationDialog` como primitive Radix.
- `OperationDialogHeader`, `OperationDialogFooter` y formularios existentes.
- `createAction` como punto único de mutación.
- `getOperationError` para errores visibles.

Se añadirá un componente compartido para mostrar:

- Acción y consecuencia.
- Workflow destino.
- Requisito de aprobación.
- Campos específicos.
- Estado submitting, queued, running, completed o failed.
- Reintento sin duplicar mediante idempotencia.

## Flujos

### Correo

- Redactar, responder y reenviar usan `send_email`.
- CC y BCC se conservan en el payload existente.
- Crear o vincular caso sólo se muestra cuando exista un contrato de Edge Function para esa operación.
- Adjuntar se mantiene separado hasta que Storage esté verificado.

### Seguimiento

- Crear usa `schedule_follow_up`.
- Posponer reutiliza `schedule_follow_up` con `follow_up_id` y una fecha nueva.
- Completar requiere un comando backend explícito. No se actualizará sólo el estado local.
- El menú incluye abrir caso y ver actividad.

### Delegación

- Crear y transferir usan `delegate_case`.
- Aceptar, rechazar, completar y reasignar requieren que PE04 y la Edge Function distingan el estado enviado en `input_data`.
- El frontend siempre espera la respuesta antes de mostrar éxito.

### Caso

- Más acciones abre el Action Center.
- Resolver, verificar y cerrar usan PE12.
- Delegar y crear seguimiento reutilizan los diálogos existentes.
- Ver actividad y ejecuciones son navegaciones, no mutaciones.

### Dashboard

- Actualizar llama a `router.refresh()` desde un componente cliente pequeño.
- El botón muestra loading y evita solicitudes duplicadas.

## Datos y permisos

No se incluyen cambios SQL en este diseño de UI. Cualquier cambio de tablas, Storage, RLS o grants debe estar en un archivo SQL separado dentro de `supabase/migrations/` y ejecutarse manualmente.

Las Edge Functions deben seguir validando:

- autenticación
- organización
- rol
- transición válida
- idempotency key
- ownership del recurso

## Storage

El diseño de adjuntos está separado en:

- `supabase/migrations/storage/README.md`
- `supabase/migrations/storage/20260904000000_email_attachments_storage.sql`

Ese SQL no se aplica automáticamente y debe verificarse en staging antes de conectarlo al diálogo de correo.
