# PROMPT — IMPLEMENTACIÓN DE SUPABASE EDGE FUNCTIONS + FRONTEND
# PULSO EJECUTIVO / PROLOGISTICA
# ARQUITECTURA CENTRADA EN EL MOTOR DE DECISIONES

## CONTEXTO

Estamos construyendo PULSO EJECUTIVO, una plataforma de asistencia ejecutiva
con:

- Frontend / Dashboard
- Supabase PostgreSQL
- Supabase Edge Functions
- n8n
- Motor de decisiones de negocio
- IA mediante API externa
- Outlook / Microsoft 365
- WhatsApp y otras integraciones futuras

Existe un repositorio base:

dcastellonc/prologistica-pulso-ejecutivo-lab

El repositorio contiene contratos, workflows, runtime, fixtures y reglas
arquitectónicas que NO deben ignorarse.

La arquitectura final debe evolucionar el laboratorio hacia una plataforma
real sin romper la filosofía central del proyecto.

---

# 1. REGLA ARQUITECTÓNICA ABSOLUTA

LA AUTORIDAD DE NEGOCIO ES EL MOTOR.

Nunca implementes lógica de autorización de negocio directamente en:

- React
- Next.js
- API routes del frontend
- Supabase Edge Functions
- n8n Code Nodes
- prompts de IA
- componentes visuales

El sistema debe seguir esta separación:

    FRONTEND
        ↓
    SUPABASE EDGE FUNCTIONS
        ↓
    MOTOR DE DECISIONES
        ↓
    COMANDO AUTORIZADO
        ↓
    n8n
        ↓
    INTEGRACIÓN EXTERNA

Y para persistencia:

    MOTOR / n8n / Edge Functions
        ↓
    SUPABASE
        ↓
    DATABASE

La regla conceptual es:

    MOTOR = decide
    EDGE FUNCTIONS = protegen y exponen
    SUPABASE DB = persiste / fuente de verdad
    n8n = orquesta y ejecuta integraciones
    IA = analiza / propone
    FRONTEND = presenta y solicita acciones

Ningún componente distinto del MOTOR puede convertirse en autoridad
de negocio por conveniencia de implementación.

---

# 2. NO CONFUNDIR AUTENTICACIÓN CON AUTORIDAD

Supabase puede verificar:

- JWT
- usuario autenticado
- organization_id
- pertenencia a organización
- rol técnico
- permisos básicos de acceso

Pero eso NO significa que Supabase pueda decidir:

- si un correo puede enviarse automáticamente
- si un caso puede cerrarse
- si una respuesta requiere aprobación
- si una delegación está permitida
- si una acción es segura
- si una acción cumple un playbook
- si un SLA permite determinada transición

Esas decisiones pertenecen al MOTOR.

Ejemplo INCORRECTO:

    Edge Function:
        if importance === "low":
            allowSend = true

Eso NO debe existir.

Ejemplo CORRECTO:

    Frontend
        ↓
    Edge Function
        ↓
    Motor
        ↓
    decision:
        action = SEND_EMAIL
        authorized = true
        requires_approval = false
        rule = ...
        playbook_version = ...
        evidence = ...
        correlation_id = ...

La Edge Function únicamente valida el contrato y persiste/transporta
el resultado.

---

# 3. RESPONSABILIDAD DEL FRONTEND

El frontend NO debe implementar reglas de negocio.

El frontend debe:

- mostrar estado
- mostrar decisiones del motor
- mostrar razones
- mostrar recomendaciones
- permitir acciones humanas
- enviar comandos
- mostrar errores
- mostrar aprobaciones pendientes
- mostrar historial
- mostrar trazabilidad
- escuchar cambios mediante Supabase Realtime

El frontend NO debe determinar:

- prioridad real
- autoridad
- aprobación
- transición válida
- cierre permitido
- retry permitido
- SLA
- si una respuesta se puede enviar
- si un usuario puede saltarse una aprobación

El frontend puede ocultar botones por UX, pero eso NO constituye seguridad.

La seguridad real debe existir en Edge Functions + Motor.

---

# 4. CAMBIO FUNDAMENTAL EN EL FRONTEND

Actualmente una UI podría pensar:

    usuario hace click "Enviar"
        ↓
    API
        ↓
    n8n
        ↓
    Outlook

NO implementar esto.

La UI debe trabajar con COMMANDS.

Ejemplo:

    usuario hace click "Enviar"
        ↓
    frontend
        ↓
    POST /actions
        ↓
    Edge Function
        ↓
    valida identidad / organización
        ↓
    Motor
        ↓
    determina:
        autorizado?
        requiere aprobación?
        qué transición corresponde?
        qué workflow debe ejecutarse?
        qué evidencia se necesita?
        ↓
    resultado
        ↓
    si autorizado:
        crear comando
        ↓
        n8n
    si no autorizado:
        devolver rechazo estructurado

El frontend debe representar el resultado.

---

# 5. MODELO DE ACTION

Toda acción iniciada por el usuario debe tener un objeto estructurado.

Ejemplo:

{
  "action_id": "...",
  "organization_id": "...",
  "case_id": "...",
  "conversation_id": "...",
  "actor_user_id": "...",
  "action_type": "SEND_EMAIL",
  "payload": {},
  "request_id": "...",
  "correlation_id": "...",
  "idempotency_key": "..."
}

No ejecutar directamente una integración desde la UI.

---

# 6. EL MOTOR DEBE DEVOLVER DECISIONES EXPLÍCITAS

No aceptar respuestas ambiguas.

Una decisión del motor debe poder expresar algo como:

{
  "authorized": true,
  "action": "SEND_EMAIL",
  "requires_approval": false,
  "reason": "...",
  "rule": "...",
  "rule_version": "...",
  "playbook_version": "...",
  "evidence": [],
  "correlation_id": "...",
  "next_review_at": "...",
  "command": {
    "type": "OUTLOOK_SEND",
    "payload": {}
  }
}

Cuando no está autorizado:

{
  "authorized": false,
  "action": "SEND_EMAIL",
  "reason": "...",
  "required_approval": true,
  "rule": "...",
  "rule_version": "...",
  "playbook_version": "...",
  "correlation_id": "..."
}

No convertir:

    authorized = false

en:

    frontend = "botón deshabilitado"

El rechazo debe ser una decisión real del sistema.

---

# 7. EDGE FUNCTIONS

Las Edge Functions serán la frontera entre:

- frontend
- n8n
- motor
- Supabase

No deben convertirse en el nuevo motor.

Sus responsabilidades:

## Seguridad

- validar JWT
- obtener usuario
- validar organización
- validar permisos de acceso
- validar estructura del request
- aplicar rate limits donde corresponda
- controlar idempotencia
- evitar acceso indebido entre organizaciones

## Contratos

- validar input
- validar output
- versionar contratos
- rechazar payloads inválidos

## Persistencia

- crear registros
- actualizar estados autorizados
- registrar eventos
- guardar resultados
- guardar auditoría

## Orquestación

- enviar comandos autorizados hacia n8n
- recibir callbacks de n8n
- correlacionar workflow_execution_id
- manejar idempotencia

NO deben contener reglas como:

    if case.status === "..."
    if urgency === "..."
    if role === "..."
    then allow ...

si esa condición representa una decisión de negocio.

---

# 8. EDGE FUNCTIONS PARA ACCIONES

Crear una frontera lógica del estilo:

    /functions/v1/actions

La función recibe:

{
  "action_type": "...",
  "case_id": "...",
  "conversation_id": "...",
  "payload": {},
  "idempotency_key": "..."
}

La Edge Function:

1. autentica
2. obtiene organization_id
3. valida que el usuario pueda acceder al recurso
4. valida schema
5. genera correlation_id si falta
6. consulta contexto necesario
7. solicita decisión al MOTOR
8. recibe decisión
9. persiste la decisión
10. si existe comando autorizado:
       crea command/action
       envía a n8n
11. devuelve resultado al frontend

---

# 9. NUNCA PERMITIR QUE EL FRONTEND LLAME DIRECTAMENTE A n8n

Evitar:

    Next.js
        ↓
    n8n webhook

Preferir:

    Next.js
        ↓
    Supabase Edge Function
        ↓
    Motor
        ↓
    command
        ↓
    n8n

El frontend nunca debe conocer secretos de n8n.

---

# 10. n8n TAMPOCO DEBE SER LA AUTORIDAD

n8n es el orquestador.

n8n puede:

- recibir comandos
- ejecutar workflows
- llamar Outlook
- llamar APIs externas
- llamar al proveedor de IA
- manejar retries
- esperar eventos
- programar follow-ups
- producir resultados

n8n NO debe decidir unilateralmente:

- autoridad
- aprobación
- cierre
- política
- SLA de negocio
- transición válida

Si n8n necesita saber si puede hacer algo:

    n8n
      ↓
    Motor
      ↓
    decisión
      ↓
    n8n ejecuta

---

# 11. LA IA NO ES AUTORIDAD

La IA puede:

- clasificar
- resumir
- detectar intención
- extraer entidades
- generar draft
- sugerir acción
- estimar confianza
- explicar contenido

La IA NO puede:

- autorizar una acción crítica
- cerrar un caso
- saltarse aprobación
- modificar políticas
- decidir autoridad definitiva

Ejemplo:

    IA:
        "Sugiero enviar automáticamente"

NO significa:

    authorized = true

Debe ocurrir:

    IA
      ↓
    propuesta
      ↓
    MOTOR
      ↓
    decisión
      ↓
    n8n

---

# 12. SUPABASE DATABASE COMO SOURCE OF TRUTH

La DB debe representar el estado durable del sistema.

No utilizar n8n como fuente de verdad.

La base debe poder responder:

- qué caso existe
- cuál es su estado
- qué mensajes tiene
- qué decisiones se tomaron
- qué aprobaciones existen
- qué acciones fueron solicitadas
- qué workflows se ejecutaron
- qué ocurrió en cada workflow
- qué entregas se realizaron
- qué delegaciones existen
- qué follow-ups están pendientes
- qué evidencia existe
- qué usuario realizó una acción

---

# 13. DIFERENCIAR ESTADO DE EVENTOS

No mezclar:

    case state
    workflow execution
    workflow event
    user action
    AI decision
    message

Deben tener responsabilidades distintas.

Ejemplo:

cases
    estado actual del caso

workflow_executions
    ejecución concreta de PE01, PE02, etc.

workflow_events
    eventos internos de ejecución

actions
    intención operativa humana/sistema

ai_evaluations
    análisis producido por IA

messages
    comunicación de la conversación

audit_logs
    trazabilidad de acciones

---

# 14. WORKFLOW_EXECUTION_ID

Utilizar:

    workflow_execution_id

como identificador interno de ejecución.

Guardar además:

    n8n_execution_id

como referencia externa.

No hacer que toda la arquitectura dependa de n8n_execution_id.

La relación debe ser:

    workflow_execution
        workflow_execution_id
        n8n_execution_id
        workflow_code
        workflow_version
        status
        started_at
        finished_at

n8n es reemplazable.

La plataforma no.

---

# 15. IDEMPOTENCIA

Todas las acciones externas deben ser idempotentes.

Utilizar:

- request_id
- correlation_id
- idempotency_key
- action_id
- workflow_execution_id

Una repetición de:

    SEND_EMAIL

no debe producir accidentalmente dos correos.

Antes de ejecutar:

    verificar idempotency_key

Si ya fue procesada:

    devolver resultado anterior

No ejecutar nuevamente.

---

# 16. CALLBACKS DESDE n8n

n8n debe devolver resultados mediante una frontera controlada.

Preferencia:

    n8n
      ↓
    workflow bridge / callback
      ↓
    Edge Function
      ↓
    Supabase

No:

    n8n
      ↓
    PostgreSQL directamente

La Edge Function debe:

1. autenticar el callback
2. validar firma/token interno
3. validar schema
4. validar workflow
5. validar execution
6. comprobar idempotencia
7. persistir resultado
8. registrar evento
9. actualizar estado
10. notificar Realtime

---

# 17. SUPABASE REALTIME

Realtime sirve para que el dashboard refleje cambios.

Ejemplo:

    n8n
      ↓
    callback
      ↓
    Edge Function
      ↓
    DB UPDATE
      ↓
    Supabase Realtime
      ↓
    Dashboard

No usar Realtime como mecanismo de autorización.

Realtime únicamente refleja estado.

---

# 18. APROBACIONES

Las aprobaciones deben ser explícitas.

Ejemplo:

    PE02 / MOTOR
        ↓
    requires_approval = true
        ↓
    approval_request
        ↓
    Dashboard
        ↓
    usuario aprueba
        ↓
    Edge Function
        ↓
    MOTOR
        ↓
    valida que la aprobación sea válida
        ↓
    command autorizado
        ↓
    n8n
        ↓
    Outlook

Nunca:

    frontend:
        approved = true
        ↓
    n8n:
        send

El frontend no concede autoridad.

---

# 19. CAMBIO EN EL FLUJO DE "APROBAR"

Implementar:

    POST /actions/approve

pero internamente:

    Edge Function
        ↓
    valida actor
        ↓
    obtiene approval_request
        ↓
    obtiene estado actual
        ↓
    MOTOR
        ↓
    verifica:
        - aprobación válida
        - usuario autorizado
        - versión esperada
        - estado actual
        - regla aplicable
        - no expirado
        ↓
    genera comando
        ↓
    n8n

---

# 20. CIERRE DE CASOS

Nunca permitir:

    frontend
        ↓
    UPDATE cases
    status = CLOSED

El cierre debe ser:

    frontend
        ↓
    request CLOSE_CASE
        ↓
    Edge Function
        ↓
    MOTOR
        ↓
    verifica:
        - rol
        - estado
        - evidencia
        - condición de cierre
        - versión
        ↓
    comando autorizado
        ↓
    n8n / transición
        ↓
    Edge Function
        ↓
    DB

PE12 debe conservar la verificación humana y evidencia antes del cierre.

---

# 21. DELEGACIÓN

Nunca hacer:

    frontend:
        assigned_to = user_id

y actualizar directamente.

Debe ser:

    frontend
      ↓
    ASSIGN_CASE
      ↓
    Edge Function
      ↓
    MOTOR
      ↓
    valida autoridad / política
      ↓
    command
      ↓
    n8n
      ↓
    persistencia

La Edge Function puede validar que el usuario exista y pertenezca
a la organización.

Pero la decisión de si la delegación está permitida pertenece al MOTOR.

---

# 22. PE01–PE12

Mantener las responsabilidades existentes del repositorio.

No cambiar silenciosamente los contratos.

Particular atención:

PE01
    Outlook Intake

PE02
    Evaluate / Authority

PE03
    Reply Orchestrator

PE04
    Delegation

PE05
    Sent Watcher

PE06
    Follow-up Clock

PE07
    Delivery / WhatsApp según contrato vigente

PE08
    Assistant Commands / evolución del contrato existente

PE09
    CaseProvider / correlación según contrato

PE10
    Delivery Retry / Receipt / Reconciliation

PE11
    Pulse / Coverage / Reconciliation

PE12
    Verification / Closure

Si se requiere una nueva función de conversación de casos, NO reutilizar
silenciosamente PE05 si eso rompe su contrato actual.

Preferir agregar PE13.

---

# 23. MOTOR COMO SERVICIO

Si el motor todavía no está implementado completamente:

NO reemplazarlo con lógica temporal dentro de Edge Functions.

Crear una interfaz:

    DecisionEngine

Por ejemplo:

    evaluateAction(context, action)

    evaluateMessage(context, message)

    evaluateTransition(context, transition)

    evaluateClosure(context, closure)

    evaluateDelivery(context, delivery)

El resto del sistema debe depender de esta interfaz.

Así posteriormente el motor real puede reemplazar el mock sin reescribir:

- frontend
- Edge Functions
- n8n
- DB

---

# 24. MODO MOCK DURANTE DESARROLLO

Mientras el MOTOR real no esté implementado:

crear un adaptador:

    MockDecisionEngine

Pero mantener exactamente la misma interfaz:

    DecisionEngine

NO hacer:

    if MOCK:
        allow everything

El mock debe respetar los contratos y producir decisiones deterministas.

Debe ser claramente identificable como:

    mock
    testing
    non-production

---

# 25. CONTRATOS

Antes de crear una Edge Function nueva:

1. revisar contracts/
2. revisar schemas
3. revisar workflow contracts
4. revisar runtime/validator-core
5. revisar workflows correspondientes
6. revisar tests
7. revisar README de n8n
8. revisar motor/README

No inventar campos si ya existe un contrato.

Si se necesita un nuevo campo:

- versionar contrato
- actualizar schema
- actualizar validator
- actualizar fixtures
- actualizar tests
- actualizar workflow
- documentar cambio

---

# 26. JSONB

Usar JSONB para información variable.

Pero NO convertir toda la DB en JSONB.

Usar columnas relacionales para:

- IDs
- foreign keys
- organization_id
- timestamps
- estados
- tipos
- claves de correlación
- índices
- relaciones

Usar JSONB para:

- payloads externos
- snapshots
- AI metadata
- provider responses
- evidencia variable
- contexto variable

---

# 27. SEGURIDAD MULTI-TENANT

Todas las operaciones deben considerar:

    organization_id

Nunca confiar en:

    organization_id enviado por frontend

Debe derivarse del usuario autenticado o de contexto autorizado.

Evitar:

    SELECT * FROM cases WHERE id = case_id

Preferir:

    SELECT ...
    FROM cases
    WHERE id = case_id
      AND organization_id = authenticated_organization

Aplicar RLS donde corresponda.

Las Edge Functions con privilegios elevados deben ser muy limitadas
y nunca exponer esos privilegios al frontend.

---

# 28. FRONTEND: NUEVO MODELO DE ESTADO

El dashboard debe dejar de pensar solamente en:

    loading
    success
    error

y manejar estados de negocio:

    PENDING_AUTHORITY
    WAITING_APPROVAL
    APPROVED
    REJECTED
    EXECUTING
    DELIVERED
    DELIVERY_FAILED
    FOLLOW_UP_PENDING
    WAITING_VERIFICATION
    CLOSED

Estos estados deben venir de la DB / motor.

No inventarlos dentro de React.

---

# 29. FRONTEND: COMPONENTES

Crear componentes orientados a estado y decisión.

Ejemplo:

    CaseHeader
    CaseTimeline
    CaseStatus
    AIAnalysis
    AuthorityDecision
    ApprovalPanel
    DraftReply
    DelegationPanel
    FollowUpPanel
    DeliveryStatus
    VerificationPanel
    ActivityTimeline

Pero estos componentes deben ser presentacionales.

Ejemplo:

    <ApprovalPanel
        approval={approval}
        decision={decision}
        onApprove={...}
        onReject={...}
    />

No:

    <ApprovalPanel>
        if priority === HIGH:
            ...
    </ApprovalPanel>

---

# 30. FRONTEND: ACTION API

Centralizar las acciones.

Ejemplo:

    actions.approveDraft()
    actions.rejectDraft()
    actions.sendDraft()
    actions.delegateCase()
    actions.requestFollowUp()
    actions.closeCase()
    actions.sendMessage()

Todas pasan por Edge Functions.

No permitir llamadas arbitrarias desde componentes.

---

# 31. CHAT DEL DASHBOARD

El chat del dashboard NO debe convertirse en un agente con autoridad propia.

Flujo:

    Usuario
       ↓
    Case Chat
       ↓
    Edge Function
       ↓
    Motor / Orchestrator
       ↓
    IA
       ↓
    propuesta
       ↓
    Motor
       ↓
    respuesta / comando
       ↓
    Dashboard

Si el usuario dice:

    "manda este correo"

No enviar directamente.

Debe convertirse en una intención/action:

    SEND_EMAIL

y pasar por:

    Edge Function
        ↓
    Motor
        ↓
    autorización
        ↓
    n8n

---

# 32. IA DENTRO DEL CHAT

La IA puede generar:

    suggested_action
    draft
    explanation
    classification

Pero nunca:

    final_authorization

La respuesta de IA debe considerarse:

    proposal

hasta que el MOTOR la convierta en:

    authorized command

---

# 33. OBSERVABILIDAD

Toda acción importante debe poder rastrearse:

    request_id
        ↓
    correlation_id
        ↓
    action_id
        ↓
    workflow_execution_id
        ↓
    n8n_execution_id
        ↓
    provider_receipt

Esto debe permitir contestar:

    ¿Quién pidió la acción?
    ¿Qué decidió el motor?
    ¿Qué workflow la ejecutó?
    ¿Qué proveedor recibió la petición?
    ¿Cuál fue el resultado?
    ¿Qué evidencia existe?

---

# 34. ERRORES

Nunca devolver simplemente:

    500 Internal Server Error

cuando se trate de una decisión de negocio.

Utilizar errores estructurados:

{
  "error": {
    "code": "AUTHORITY_REQUIRED",
    "message": "...",
    "correlation_id": "...",
    "details": {}
  }
}

Ejemplos:

    INVALID_CONTRACT
    UNAUTHORIZED_ACTION
    APPROVAL_REQUIRED
    STALE_STATE
    IDEMPOTENCY_REPLAY
    INVALID_TRANSITION
    MOTOR_UNAVAILABLE
    WORKFLOW_FAILED
    DELIVERY_FAILED
    VERIFICATION_REQUIRED

---

# 35. STALE STATE

Importantísimo.

Si el frontend muestra:

    APPROVAL_REQUIRED

pero mientras tanto otro proceso cambió el caso:

    APPROVED

la aprobación vieja no debe ejecutarse ciegamente.

La Edge Function debe enviar al Motor:

    expected_version

o equivalente.

El Motor debe comprobar:

    current_version === expected_version

Si no coincide:

    STALE_STATE

y no ejecutar.

---

# 36. NO OPTIMIZAR ROMPIENDO LA ARQUITECTURA

Si una implementación parece más fácil haciendo:

    Edge Function → DB → permitir

pero requiere saltarse el MOTOR:

NO hacerlo.

Si parece más rápido:

    Frontend → n8n

NO hacerlo.

Si parece más fácil:

    n8n → PostgreSQL

NO hacerlo.

Si parece más sencillo:

    IA → ejecutar

NO hacerlo.

La arquitectura tiene prioridad sobre la conveniencia.

---

# 37. CAMBIOS ESPERADOS EN EL FRONTEND

Revisar el frontend existente y cambiar:

1. llamadas directas a n8n
2. updates directos de estados críticos
3. lógica de autorización en React
4. lógica de transición en React
5. lógica de aprobación en React
6. lógica de cierre en React
7. lógica de envío directo
8. estados derivados incorrectamente
9. acciones sin idempotency_key
10. acciones sin correlation_id

Sustituirlas por:

    UI
      ↓
    Action Client
      ↓
    Edge Function
      ↓
    Motor
      ↓
    Command
      ↓
    n8n

---

# 38. CAMBIOS ESPERADOS EN EDGE FUNCTIONS

Revisar todas las Edge Functions existentes.

Para cada una determinar:

    ¿Es autenticación?
    ¿Es autorización técnica?
    ¿Es persistencia?
    ¿Es integración?
    ¿Es decisión de negocio?

Si es decisión de negocio:

    moverla al MOTOR.

Si es seguridad:

    mantenerla en Edge Function.

Si es persistencia:

    mantenerla en Edge Function.

Si es integración:

    pasarla a n8n.

---

# 39. TABLA DE RESPONSABILIDADES FINAL

Usar esta matriz como regla:

| Componente | Responsabilidad |
|---|---|
| Frontend | UI / interacción |
| Frontend | solicitar acciones |
| Frontend | mostrar decisiones |
| Edge Functions | autenticación |
| Edge Functions | autorización técnica |
| Edge Functions | validación |
| Edge Functions | persistencia |
| Edge Functions | callbacks |
| Edge Functions | gateway |
| Motor | reglas de negocio |
| Motor | autoridad |
| Motor | políticas |
| Motor | transiciones |
| Motor | aprobación |
| Motor | SLA |
| Motor | cierre |
| IA | análisis |
| IA | propuestas |
| n8n | orquestación |
| n8n | integraciones |
| n8n | retries |
| n8n | scheduling |
| Supabase DB | estado durable |
| Supabase DB | historial |
| Supabase Realtime | actualización UI |

---

# 40. REGLA DE ORO

Antes de implementar cualquier función nueva pregunta:

    "¿Esto es una decisión de negocio?"

Si la respuesta es:

    SÍ

entonces debe pasar por el MOTOR.

Si la respuesta es:

    NO

entonces puede pertenecer a:

    Frontend
    Edge Function
    n8n
    DB

según su responsabilidad.

---

# 41. ANTES DE MODIFICAR CÓDIGO

Primero:

1. inspeccionar repositorio
2. inspeccionar Edge Functions existentes
3. inspeccionar schemas
4. inspeccionar contracts/
5. inspeccionar motor/
6. inspeccionar n8n/
7. inspeccionar workflows
8. inspeccionar frontend
9. identificar conflictos
10. presentar plan de cambios

NO modificar código inmediatamente.

Primero generar:

    ARCHITECTURE IMPACT REPORT

con:

    archivo
    problema
    responsabilidad actual
    responsabilidad nueva
    impacto
    cambio necesario
    riesgo
    contrato afectado

---

# 42. DESPUÉS DE IMPLEMENTAR

Ejecutar:

- tests unitarios
- tests de contratos
- tests de Edge Functions
- tests de idempotencia
- tests multi-tenant
- tests de autorización
- tests de stale state
- tests de callbacks
- tests de integración con n8n mock
- tests de motor mock

Verificar especialmente:

    frontend no puede saltarse motor
    n8n no puede saltarse motor
    IA no puede saltarse motor
    usuario no puede saltarse aprobación
    organización A no puede acceder a organización B
    replay no ejecuta nuevamente acciones externas
    cierre requiere condiciones del motor

---

# 43. CRITERIO DE ACEPTACIÓN PRINCIPAL

La implementación será considerada correcta únicamente si:

    FRONTEND
        ↓
    EDGE FUNCTION
        ↓
    MOTOR
        ↓
    AUTHORIZED COMMAND
        ↓
    n8n
        ↓
    EXTERNAL SYSTEM

y nunca:

    FRONTEND → n8n → EXTERNAL SYSTEM

ni:

    FRONTEND → DB → status crítico

ni:

    n8n → DB → decisión de negocio

ni:

    IA → EXTERNAL SYSTEM

---

# 44. OBJETIVO FINAL

Construir una plataforma donde:

    Supabase recuerda.
    Edge Functions protegen.
    Motor decide.
    IA propone.
    n8n ejecuta.
    Dashboard permite operar.
    Realtime mantiene sincronizada la interfaz.

El MOTOR debe permanecer desacoplado de las integraciones.

n8n debe permanecer reemplazable.

La IA debe permanecer reemplazable.

El frontend debe permanecer reemplazable.

La fuente de verdad debe permanecer en Supabase.

Y ninguna capa de presentación o integración debe convertirse
accidentalmente en autoridad de negocio.

Antes de realizar cambios, analiza el repositorio completo y señala
cualquier conflicto entre esta arquitectura y la implementación existente.
No ocultes ni resuelvas silenciosamente conflictos de contratos:
repórtalos y propone la modificación más compatible con la arquitectura
del MOTOR.