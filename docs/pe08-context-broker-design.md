# PE08 Conversacional con Context Broker — Diseño

**Fecha:** 2026-09-13
**Estado:** Diseño aprobado por el usuario

## Objetivo

Convertir PE08 en un flujo conversacional capaz de resolver contexto relacionado con conversaciones, casos y correos desde Supabase bajo demanda, y de solicitar todas las acciones operativas existentes mediante el orquestador y el circuito de autoridad actual.

PE08 debe poder responder solicitudes encadenadas como buscar un correo, entender el caso relacionado, preparar un borrador, delegar el caso o programar un seguimiento sin que el usuario tenga que repetir referencias en cada mensaje.

## Contexto actual

- `assistant` crea o reutiliza una conversación, inicia la actividad, crea `workflow_executions` y dispara PE08.
- `assistant` ya envía `conversation_id`, `case_id`, `context_url` y `context_request`, pero PE08 todavía usa un flujo experimental de navegación/mock.
- `conversation-context` actualmente devuelve conversación, mensajes y una lista de casos; no ofrece operaciones tipadas para emails, drafts, delegaciones o follow-ups.
- `workflow-bridge` conecta el despacho del orquestador con workflows hijos y entrega callbacks a `webhooks`.
- `actions` ya aplica idempotencia, permisos y decisiones de autoridad para acciones de email, casos y follow-ups.
- PE08 debe dejar de depender del contrato experimental de navegación `ROUTED_TO_UI` como comportamiento principal y adoptar un contrato conversacional compatible con el envelope de workflows existente.

## Decisiones de diseño

### 1. Frontera de autoridad

PE08 podrá leer contexto y proponer o solicitar acciones, pero no ejecutará SQL ni modificará tablas directamente.

- Las lecturas se realizan a través de una Edge Function Context Broker.
- Las escrituras se convierten en comandos estructurados y pasan por el orquestador, `actions`, `authority_decisions` y el workflow operativo correspondiente.
- PE08 no puede autoconcederse aprobación.
- Las acciones sensibles mantienen las políticas actuales de aprobación y permisos.

### 2. Resolución de contexto

Se usará un modelo de **contexto base + búsqueda bajo demanda**.

El contexto base incluye:

- Conversación actual.
- Caso actual, si existe.
- Mensajes recientes.
- Snapshot `context` más reciente.
- Referencias de emails, drafts, delegaciones y follow-ups relacionados cuando estén disponibles.

Las demás fuentes se consultan mediante operaciones explícitas cuando la intención lo requiera. No se enviará toda la organización al modelo en cada turno.

### 3. Persistencia conversacional

El contexto de trabajo será persistente y versionado:

- `public.context` almacenará el snapshot de la conversación y el caso.
- Cada actualización incrementará `version`.
- `content_json` contendrá el contexto normalizado y `source_refs`.
- Los mensajes generados quedarán asociados mediante `messages.context_id`.
- Las fuentes se volverán a consultar antes de acciones críticas para evitar operar sobre datos obsoletos.

## Arquitectura

```text
Usuario
  ↓
assistant
  ↓
PE08
  ↓
Context Broker (Supabase Edge Function)
  ├─ contexto base
  ├─ búsquedas tipadas
  └─ referencias y cobertura
  ↓
PE08 responde o genera action_request
  ↓
Orquestador
  ↓
actions / authority_decisions / workflow_executions
  ↓
PE03, PE04, PE06, PE07, PE12 u otros workflows operativos
  ↓
webhooks
  ↓
messages / conversations / context / actions
```

## Context Broker

La Edge Function `conversation-context` evolucionará para recibir operaciones `POST` tipadas. El acceso estará protegido por `N8N_INGRESS_SECRET` y se ejecutará con `SUPABASE_SERVICE_ROLE_KEY` únicamente dentro de la función.

### Entrada común

```json
{
  "operation": "get_context_snapshot",
  "organization_id": "uuid",
  "conversation_id": "uuid",
  "case_id": "uuid|null",
  "request_id": "uuid",
  "parameters": {}
}
```

Reglas:

- `operation`, `organization_id`, `conversation_id` y `request_id` son obligatorios.
- `case_id` puede inferirse desde la conversación; si se proporciona debe coincidir.
- Todos los resultados se filtran por `organization_id`.
- Se valida la relación entre conversación, caso y organización.
- No se aceptan SQL, nombres de tabla, columnas arbitrarias ni filtros libres.

### Operaciones de lectura

#### `get_context_snapshot`

Devuelve el contexto base:

```json
{
  "conversation": {},
  "case": {},
  "messages": [],
  "context": {},
  "emails": [],
  "email_drafts": [],
  "delegations": [],
  "follow_ups": [],
  "related_actions": [],
  "refs": [],
  "coverage": {
    "status": "COMPLETE",
    "loaded_sources": [],
    "missing_sources": [],
    "truncated": false
  }
}
```

Límites iniciales:

- 40 mensajes recientes.
- 20 emails del hilo.
- 20 drafts relacionados.
- 20 delegaciones.
- 20 follow-ups.
- 30 actividades relacionadas.

#### Operaciones bajo demanda

- `search_emails`
- `get_email_thread`
- `search_messages`
- `list_email_drafts`
- `get_case_context`
- `list_case_delegations`
- `list_case_followups`
- `get_related_activity`

Cada operación define sus parámetros permitidos, por ejemplo `query`, `status`, `direction`, fechas, `email_id`, `thread_id`, `case_id`, `conversation_id`, `limit` y `cursor`.

Las respuestas indican si hubo truncamiento y proporcionan referencias estables para que PE08 pueda continuar una conversación sin exponer identificadores internos al usuario final.

## Contrato conversacional de PE08

El envelope existente continuará transportando correlación, idempotencia, organización y ejecución. El payload conversacional deberá incluir:

- `conversation_id`.
- `case_id`.
- `request_id`.
- `content` o comando del usuario.
- `context_snapshot`.
- `available_tools`.
- `tool_calls`.
- `decision`.
- `response`.
- `action_requests`.
- `context_refs`.
- `coverage`.

Ejemplo de resultado:

```json
{
  "workflow_code": "PE08",
  "status": "completed",
  "response": "Encontré el correo y preparé un borrador...",
  "decision": {
    "route": "orchestrator",
    "intent": "create_email_draft"
  },
  "action_requests": [
    {
      "action_type": "create_email_draft",
      "input_data": {
        "email_id": "uuid",
        "instructions": "Preparar una respuesta breve y profesional"
      }
    }
  ],
  "context_refs": [
    {
      "type": "email",
      "id": "uuid",
      "source": "search_emails"
    }
  ],
  "coverage": {
    "status": "COMPLETE",
    "sources": ["conversation", "messages", "emails"]
  }
}
```

El contrato experimental de navegación/mock podrá mantenerse para fixtures o pruebas de compatibilidad, pero no será la interfaz principal de la conversación real.

## Acciones soportadas

PE08 podrá solicitar el catálogo existente completo:

- `create_email_draft`
- `approve_email`
- `reject_approval`
- `send_email`
- `delegate_case`
- `schedule_follow_up`
- `verify_case`
- `resolve_case`
- `close_case`

Las acciones se entregarán como solicitudes estructuradas:

```json
{
  "action_type": "create_email_draft",
  "case_id": "uuid",
  "conversation_id": "uuid",
  "input_data": {
    "email_id": "uuid",
    "instructions": "Preparar una respuesta breve y profesional"
  },
  "requires_confirmation": false
}
```

El orquestador resolverá el workflow destino y reutilizará el circuito existente de autoridad, idempotencia y callbacks.

## Flujo de ejecución

1. `assistant` crea o recupera la conversación y dispara PE08.
2. PE08 valida el envelope y carga el contexto base.
3. PE08 analiza la intención.
4. Si necesita más información, llama al Context Broker con una operación tipada.
5. PE08 puede realizar como máximo cinco consultas de contexto por turno.
6. Si la intención requiere una acción, PE08 genera hasta tres `action_requests` estructurados.
7. Las acciones pasan por el orquestador y los workflows existentes.
8. El callback `webhooks` actualiza la ejecución, acción, conversación, mensajes y snapshot.
9. La respuesta final se persiste con sus referencias y cobertura.

Si hay ambigüedad o demasiados resultados, PE08 pedirá aclaración en vez de elegir silenciosamente.

## Errores y cobertura

El broker usará errores estructurados:

```json
{
  "error": {
    "code": "CONTEXT_SOURCE_UNAVAILABLE",
    "message": "No se pudo consultar email_drafts",
    "source": "email_drafts",
    "retryable": true
  },
  "coverage": {
    "status": "PARTIAL",
    "loaded_sources": ["conversation", "messages", "cases"],
    "missing_sources": ["email_drafts"]
  }
}
```

Comportamiento:

- Error recuperable: un reintento controlado o continuación con contexto parcial.
- Error de ownership: respuesta genérica sin revelar si existe el registro.
- Datos insuficientes: solicitud de aclaración.
- Acción fallida: informar el fallo y conservar referencias de la acción.
- Contexto obsoleto: volver a consultar antes de ejecutar la acción.
- Falla del broker: PE08 no inventa datos ni ejecuta acciones basadas en información no verificada.

## Seguridad y observabilidad

- Todas las consultas tienen filtro de organización.
- Las relaciones conversación → caso → entidad se validan en el broker.
- No se exponen secretos, tokens ni credenciales.
- PE08 no puede actualizar directamente ninguna tabla de dominio.
- Las acciones sensibles conservan aprobación humana.
- Las claves de idempotencia se derivan de conversación, request y acción.
- Se registra `request_id`, `conversation_id`, `case_id`, `workflow_execution_id`, `context_id`, versión, fuentes, truncamiento, acciones y resultados.
- Los logs técnicos no incluirán cuerpos completos de emails o mensajes.

## Compatibilidad e integración

La integración nueva debe corregir la discrepancia existente entre el nodo de PE08 que intenta obtener contexto y las rutas disponibles en `workflow-bridge`. PE08 llamará explícitamente al `POST` tipado de `conversation-context`.

El callback debe continuar siendo `webhooks`, usando el secreto de callback y las validaciones actuales de ejecución y organización.

## Pruebas

### Unitarias

- Validación de operaciones y parámetros.
- Ownership y UUIDs.
- Límites, cursores y truncamiento.
- Normalización de resultados.
- Contrato conversacional de PE08.
- Idempotencia de consultas y acciones.

### Edge Functions

- Contexto completo y parcial.
- Conversación inexistente.
- Caso de otra organización.
- Email fuera del caso.
- Draft no relacionado.
- Broker sin secreto.
- Paginación.
- Error de fuente individual.

### Integración

- `assistant → PE08 → Context Broker`.
- PE08 → orquestador.
- Acción que requiere aprobación.
- Acción exitosa.
- Callback duplicado.
- Reintento de workflow.
- Persistencia de `context` y `messages.context_id`.
- Solicitudes encadenadas en una conversación.

### Verificación manual

- Consultar un caso.
- Buscar un correo relacionado.
- Crear un draft desde el correo.
- Delegar un caso.
- Programar un follow-up.
- Intentar una acción sensible sin aprobación.
- Continuar una solicitud en un segundo mensaje sin repetir referencias.

## Criterios de éxito

- PE08 responde usando conversación, caso, emails, drafts, mensajes, delegaciones y follow-ups.
- Puede buscar fuentes adicionales bajo demanda.
- Puede mantener referencias entre mensajes.
- Puede solicitar todas las acciones existentes mediante el circuito autorizado.
- No realiza escrituras arbitrarias ni SQL directo.
- No existe fuga de datos entre organizaciones.
- Las acciones sensibles siguen requiriendo aprobación.
- Los errores parciales no producen respuestas inventadas ni mutaciones inseguras.
- Pasan las pruebas de contrato, seguridad, integración e idempotencia.

## Fuera de alcance

- Rediseño visual del dashboard.
- Sustitución del orquestador.
- Creación de un nuevo proveedor de IA.
- Acceso directo del navegador a n8n.
- Exposición de tablas completas mediante una API genérica.
- Eliminación inmediata de los fixtures/mock de PE08; podrán permanecer para pruebas de compatibilidad.
