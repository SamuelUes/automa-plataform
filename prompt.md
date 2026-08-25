# PROMPT — PLATAFORMA / DASHBOARD DE AGENTES IA Y AUTOMATIZACIONES

Construye una plataforma web SaaS profesional llamada provisionalmente "Prologistica AI Command Center".

La plataforma será un centro de control para administrar correos, casos, automatizaciones de n8n, agentes de IA, aprobaciones humanas, delegaciones, seguimientos y conversaciones con un asistente de IA.

NO construir un dashboard administrativo genérico.

El producto debe sentirse como una mezcla entre:

- Executive Assistant
- CRM ligero
- Case Management System
- AI Agent Command Center
- Automation Control Center

El usuario principal es una gerente/directiva que necesita ver rápidamente qué requiere su atención y poder actuar directamente desde la plataforma.

============================================================
1. STACK
============================================================

Utilizar:

- Next.js latest estable
- App Router
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Radix UI
- Lucide React
- Supabase
- @supabase/ssr
- TanStack Query
- React Hook Form
- Zod
- date-fns
- Recharts
- Sonner
- Framer Motion
- next-themes

Arquitectura:

Frontend:
Next.js

Backend:
Supabase Edge Functions (Deno)

Next.js NO debe contener backend de negocio, Server Actions ni Route Handlers.
Next.js se utiliza únicamente como frontend y consumidor de Supabase.

Database:
Supabase PostgreSQL

Authentication:
Supabase Auth

Automation:
n8n mediante webhooks/API

AI:
Proveedor externo mediante API Key administrada exclusivamente desde n8n o Supabase Edge Functions. Nunca desde Next.js ni el frontend.

NO utilizar Ollama.

NO almacenar API keys de proveedores de IA en el frontend.

NO exponer secretos en variables NEXT_PUBLIC_*.

============================================================
2. PRINCIPIOS DE ARQUITECTURA
============================================================

La plataforma NO ejecuta directamente los workflows de n8n desde el navegador.

El flujo debe ser:

Usuario
   ↓
Next.js / Supabase Client
   ↓
Supabase Edge Function
   ↓
Action
   ↓
n8n
   ↓
Workflow
   ↓
Resultado
   ↓
Supabase
   ↓
Next.js
   ↓
Usuario

Supabase es la fuente de verdad.

n8n es el motor de ejecución y automatización.

El proveedor de IA es utilizado por n8n.

Next.js es la interfaz de control humano.

============================================================
3. DISEÑO VISUAL
============================================================

Crear una interfaz premium, minimalista y profesional.

Sensación visual:

- Executive software
- AI command center
- Enterprise SaaS
- Modern B2B
- Limpio
- Elegante
- Alta legibilidad
- No parecer un template administrativo genérico

Evitar:

- Gradientes excesivos
- Neón
- Tarjetas innecesarias
- Demasiados colores
- Interfaces saturadas
- Efectos visuales exagerados
- Dashboard con 20 métricas inútiles

Priorizar:

- Jerarquía visual
- Espacio negativo
- Información importante primero
- Estados claros
- Acciones rápidas
- Excelente tipografía
- Diseño responsive
- Accesibilidad

Modo:

- Light
- Dark

Utilizar una paleta principalmente neutra.

Los estados pueden utilizar colores semánticos:

success
warning
danger
info

No usar color como único indicador de estado.

============================================================
4. LAYOUT PRINCIPAL
============================================================

Desktop:

┌──────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar                                         │
│         ├───────────────────────────────────────────────┐ │
│         │                                               │ │
│         │                  MAIN CONTENT                 │ │
│         │                                               │ │
│         │                                               │ │
│         └───────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘

Sidebar:

Logo

Command Center

Inicio

Casos

Correos

Aprobaciones

Delegaciones

Seguimientos

Conversaciones

Automatizaciones

Actividad

Configuración

Separador

Perfil del usuario

Estado de conexión

La sidebar debe poder:

- Expandirse
- Colapsarse
- En mobile convertirse en drawer

============================================================
5. TOPBAR
============================================================

Debe incluir:

- Breadcrumb
- Buscador global
- Botón de Command Center
- Notificaciones
- Estado del sistema
- Avatar
- Menú de usuario

El buscador global debe permitir buscar:

- Casos
- Correos
- Clientes
- Conversaciones
- Acciones
- IDs externos

Placeholder:

"Buscar casos, correos o acciones..."

============================================================
6. HOME / COMMAND CENTER
============================================================

La pantalla principal NO debe centrarse en métricas.

Debe responder:

"¿Qué necesita mi atención ahora?"

Crear:

------------------------------------------------------------

Header:

Buenos días, Daniela

"Esto es lo que requiere tu atención."

Mostrar fecha actual.

------------------------------------------------------------

Bloque principal:

"ATENCIÓN REQUERIDA"

Mostrar tarjetas/lista de:

- Aprobaciones pendientes
- Casos urgentes
- Casos esperando decisión
- Seguimientos vencidos
- Casos esperando verificación

Cada elemento debe mostrar:

- Prioridad
- Título
- Cliente/contacto
- Tiempo transcurrido
- Estado
- Acción recomendada

Ejemplo:

┌─────────────────────────────────────────────┐
│ 🔴 URGENTE                                  │
│                                             │
│ Aprobación de propuesta comercial           │
│ ABC Corporation                             │
│                                             │
│ El agente recomienda aprobar el borrador.   │
│                                             │
│ [Revisar]             [Aprobar]             │
└─────────────────────────────────────────────┘

------------------------------------------------------------

Bloque:

"RESUMEN DEL DÍA"

Mostrar:

Correos procesados
Casos activos
Aprobaciones pendientes
Seguimientos pendientes

No utilizar gráficos grandes para métricas simples.

------------------------------------------------------------

Bloque:

"ACTIVIDAD RECIENTE"

Timeline:

09:42
Correo recibido

09:43
Agente clasificó como urgente

09:44
Borrador generado

09:45
Aprobación solicitada

------------------------------------------------------------

Bloque inferior:

"ESTADO DE AUTOMATIZACIONES"

Mostrar PE01 - PE12.

Cada workflow:

PE01
Outlook Intake
● Operativo

PE02
Evaluate
● Operativo

PE03
Reply Orchestrator
● Operativo

Si un workflow tiene errores:

PE10
Delivery Retry
⚠ Requiere atención

============================================================
7. CASES
============================================================

Crear página:

/cases

Debe ser la vista central del sistema.

Incluir:

Título:

"Casos"

Descripción:

"Gestiona solicitudes, reclamos y asuntos que requieren seguimiento."

Filtros:

- Estado
- Prioridad
- Departamento
- Responsable
- Fecha
- Origen
- Requiere aprobación
- Requiere atención humana

Vista:

Tabla desktop.

Columnas:

Prioridad
Caso
Cliente
Estado
Responsable
Departamento
Última actividad
Actualizado

Cada fila debe ser clickeable.

Agregar vista alternativa:

- Kanban

Estados:

Nuevo
Evaluando
Esperando aprobación
En progreso
Delegado
Esperando cliente
Seguimiento
Resuelto
Esperando verificación
Cerrado

============================================================
8. CASE DETAIL
============================================================

Ruta:

/cases/[id]

Esta debe ser una de las pantallas más importantes.

Layout:

┌───────────────────────────────────────────────┐
│ Caso #184                                    │
│ Título                                       │
│                                               │
│ Priority    Status      Department           │
├───────────────────────┬───────────────────────┤
│                       │                       │
│ Timeline              │ Case information      │
│                       │                       │
│                       │ Customer              │
│                       │ Assigned to           │
│                       │ Department            │
│                       │ Priority              │
│                       │ Status                │
│                       │                       │
├───────────────────────┴───────────────────────┤
│                                               │
│ AI ANALYSIS                                   │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│ CONVERSATION                                  │
│                                               │
└───────────────────────────────────────────────┘

Mostrar:

- Información del caso
- Cliente
- Departamento
- Responsable
- Estado
- Prioridad
- Correos relacionados
- Evaluaciones de IA
- Acciones realizadas
- Aprobaciones
- Delegaciones
- Follow-ups
- Workflow executions
- Audit log

============================================================
9. AI ANALYSIS
============================================================

Mostrar claramente:

"Análisis del agente"

Ejemplo:

Prioridad:
URGENTE

Decisión:
Requiere aprobación humana

Confianza:
94%

Motivo:

"El cliente solicita una autorización comercial con
un límite de tiempo inferior a 48 horas."

Datos detectados:

Cliente
ABC Corporation

Monto
$12,500

Fecha límite
25/08/2026

No mostrar razonamiento interno privado del modelo.

Mostrar solamente:

- explicación resumida
- evidencia
- datos estructurados
- decisión
- confianza

No inventar chain-of-thought.

============================================================
10. EMAILS
============================================================

Ruta:

/emails

Crear inbox profesional.

Columnas:

- Prioridad
- Remitente
- Asunto
- Caso
- Estado
- Última actividad
- Fecha

Filtros:

- Urgente
- Importante
- Requiere respuesta
- Requiere aprobación
- Respondido
- Esperando cliente

Crear vista de email.

Layout:

Lista izquierda:

emails

Centro:

contenido del correo

Derecha:

AI analysis
case
actions

============================================================
11. EMAIL DETAIL
============================================================

Mostrar:

From
To
CC
Subject
Date

Contenido del correo.

Thread completo.

Cada email debe diferenciar:

Inbound
Outbound

Debajo:

"AI recommendation"

Mostrar:

- clasificación
- prioridad
- respuesta recomendada
- necesidad de aprobación

Botones:

"Editar respuesta"

"Enviar"

"Solicitar aprobación"

"Delegar"

"Crear seguimiento"

============================================================
12. APPROVALS
============================================================

Ruta:

/approvals

Esta sección debe ser altamente accionable.

Mostrar:

"Aprobaciones pendientes"

Cada tarjeta:

┌────────────────────────────────────────────┐
│ APROBACIÓN REQUERIDA                       │
│                                            │
│ Caso #184                                  │
│ Respuesta al cliente ABC Corporation       │
│                                            │
│ Borrador:                                  │
│ "Estimado cliente..."                      │
│                                            │
│ Motivo del agente:                         │
│ "La respuesta requiere autorización..."    │
│                                            │
│ [Editar] [Rechazar] [Aprobar y enviar]    │
└────────────────────────────────────────────┘

Al aprobar:

Crear action:

approve_email

Enviar la action a la Supabase Edge Function, que la deja disponible para n8n.

NO ejecutar n8n directamente desde el browser.

============================================================
13. DELEGATIONS
============================================================

Ruta:

/delegations

Mostrar:

Casos delegados.

Información:

Caso
Responsable
Departamento
Quién delegó
Fecha
Motivo
Estado

Permitir:

- Delegar
- Cambiar responsable
- Cambiar departamento
- Completar delegación

Cuando el usuario indique:

"Enviar este caso a Finanzas"

crear una action:

delegate_case

payload:

{
  case_id,
  department_id,
  assigned_to,
  reason
}

============================================================
14. FOLLOW UPS
============================================================

Ruta:

/follow-ups

Mostrar:

- vencidos
- hoy
- próximos
- completados

Cada seguimiento:

Caso
Cliente
Motivo
Fecha programada
Responsable
Estado

Acciones:

- Ejecutar ahora
- Reprogramar
- Completar
- Cancelar

============================================================
15. CONVERSATIONS / AI COMMAND CENTER
============================================================

Esta es una funcionalidad central.

Ruta:

/assistant

Crear una interfaz tipo ChatGPT, pero integrada con los datos empresariales.

Layout:

┌────────────────────────────────────────────────────┐
│ AI COMMAND CENTER                                  │
├────────────────────────────────────────────────────┤
│                                                    │
│ User: ¿Qué tengo pendiente?                        │
│                                                    │
│ AI: Tienes 4 asuntos que requieren atención:      │
│                                                    │
│ 1. Aprobación urgente                              │
│ 2. Caso sin responsable                            │
│ 3. Seguimiento vencido                             │
│ 4. Respuesta pendiente                             │
│                                                    │
│ User: Aprueba el primero                           │
│                                                    │
│ AI: Voy a aprobar el borrador del caso #184.      │
│                                                    │
│ ¿Confirmas?                                        │
│                                                    │
│ [Confirmar] [Cancelar]                             │
│                                                    │
├────────────────────────────────────────────────────┤
│ Escribe una instrucción...                 [Send] │
└────────────────────────────────────────────────────┘

El chat debe poder utilizar contexto de:

- Cases
- Emails
- Approvals
- Delegations
- Follow-ups
- Users
- Departments
- Workflow status

Pero el modelo NO debe ejecutar acciones directamente.

Debe producir una acción estructurada.

Ejemplo:

{
  "intent": "approve_email",
  "case_id": "...",
  "requires_confirmation": true,
  "parameters": {}
}

Luego el frontend invoca la Supabase Edge Function correspondiente.

La Edge Function valida la sesión, organización, permisos e input; crea el registro en `actions` y registra la auditoría.

n8n detecta o recibe la action mediante el flujo configurado y ejecuta el proceso.

============================================================
16. ACTION CONFIRMATION
============================================================

Para acciones sensibles:

- Enviar correo
- Delegar caso
- Cerrar caso
- Aprobar respuesta
- Eliminar información

pedir confirmación humana.

Ejemplo:

"Voy a enviar este correo a cliente@empresa.com."

Mostrar:

[Cancelar]
[Confirmar acción]

No ejecutar acciones destructivas mediante una sola instrucción ambigua.

============================================================
17. AUTOMATIONS
============================================================

Ruta:

/automations

Mostrar los PE01 - PE12.

Cards:

PE01
Outlook Intake

Estado:
Operational

Última ejecución:
hace 2 minutos

Ejecuciones:
1,284

Errores:
3

Duración promedio:
1.8s

Botones:

Ver ejecuciones
Ver detalles

No permitir editar workflows directamente desde el dashboard inicialmente.

============================================================
18. WORKFLOW DETAIL
============================================================

Ruta:

/automations/[id]

Mostrar:

Workflow:

PE02 - Evaluate

Estado:

Operational

Últimas ejecuciones.

Tabla:

ID
Trigger
Case
Status
Duration
Started
Finished

Mostrar:

Success
Failed
Running

Mostrar errores de forma comprensible.

============================================================
19. ACTIVITY / AUDIT
============================================================

Ruta:

/activity

Timeline global.

Ejemplos:

Daniela aprobó correo
AI evaluó caso
PE03 envió email
Caso delegado a Finanzas
Follow-up creado
Cliente respondió
Caso cerrado

Filtros:

Usuario
Tipo de evento
Caso
Workflow
Fecha

============================================================
20. SETTINGS
============================================================

Ruta:

/settings

Secciones:

Profile

Organization

Users

Departments

Notifications

AI configuration

Automation configuration

Security

============================================================
21. AI CONFIGURATION
============================================================

NO mostrar API keys completas.

Mostrar:

Provider:
OpenAI

Model:
[model]

Status:
Connected

API Key:
••••••••••••••••

La clave real debe ser manejada exclusivamente por las Supabase Edge Functions o por n8n.

El frontend nunca debe recibir la API key.

============================================================
22. NOTIFICATIONS
============================================================

Crear sistema de notificaciones.

Tipos:

- approval_required
- urgent_case
- workflow_failed
- follow_up_due
- delegation_received
- customer_replied
- system_error

Mostrar:

Unread
Read

============================================================
23. REALTIME
============================================================

Utilizar Supabase Realtime para actualizar:

- Cases
- Approvals
- Actions
- Messages
- Notifications
- Workflow executions

Ejemplo:

Cuando n8n cambia:

action.status

de:

running

a:

completed

el dashboard debe actualizarse sin reload.

============================================================
24. SUPABASE SECURITY
============================================================

Utilizar:

Supabase Auth
RLS

Todas las consultas deben respetar:

organization_id

Nunca confiar en organization_id enviado por el cliente.

El usuario debe obtener su organization_id desde su sesión/contexto autorizado.

Nunca usar:

SUPABASE_SERVICE_ROLE_KEY

en componentes cliente.

Nunca utilizar:

NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

Nunca.

Separar:

Browser client: únicamente para UI, Auth y consultas protegidas por RLS.

Server client: únicamente para SSR/session refresh de Next.js; no contiene lógica de negocio ni secretos.

Admin/server-only client: únicamente dentro de Supabase Edge Functions o n8n confiable. Nunca en el frontend y nunca en variables `NEXT_PUBLIC_*`.

Las Edge Functions deben validar el JWT recibido y aplicar autorización antes de usar privilegios elevados.

Configurar CORS de forma explícita para el dominio del frontend y no permitir orígenes arbitrarios en producción.

============================================================
25. SUPABASE EDGE FUNCTIONS
============================================================

Crear Supabase Edge Functions en `supabase/functions/` para acciones sensibles.

El frontend debe invocarlas usando `supabase.functions.invoke()`.

No crear Server Actions ni Route Handlers de Next.js.

Crear las siguientes operaciones dentro de la capa de Edge Functions:

createAction()

approveEmail()

rejectApproval()

delegateCase()

sendEmail()

scheduleFollowUp()

resolveCase()

verifyCase()

closeCase()

executeWorkflow()

Cada operación debe:

1. Validar el JWT de Supabase Auth.
2. Obtener la organización desde el contexto autorizado; nunca confiar en `organization_id` enviado por el cliente.
3. Validar permisos/RBAC.
4. Validar input con Zod o un esquema equivalente dentro de la Edge Function.
5. Crear una action con estado `pending`.
6. Registrar el audit log.
7. Dejar que n8n ejecute el proceso.
8. Responder con errores HTTP seguros, sin secretos ni payloads sensibles.

============================================================
26. ACTION EDGE FUNCTION
============================================================

Crear la Supabase Edge Function `actions`.

Invocación desde el frontend mediante:

`supabase.functions.invoke('actions', { body: payload })`

La función debe aceptar solicitudes POST autenticadas y ser el único punto de entrada para crear acciones.

Input:

{
  "action_type": "approve_email",
  "case_id": "...",
  "input_data": {}
}

Validar:

- authenticated user
- organization
- permission
- action type
- case existence
- case ownership

Crear:

actions

con:

status = pending

y:

idempotency_key

No ejecutar directamente el workflow desde el navegador.

============================================================
27. N8N INTEGRATION
============================================================

Preparar una capa dentro de las Supabase Edge Functions:

supabase/functions/_shared/n8n/

con funciones server-side:

triggerWorkflow()

getWorkflowStatus()

getWorkflowExecution()

Las credenciales y URLs privadas de n8n deben existir únicamente como secretos de Supabase Edge Functions o en las credenciales seguras de n8n.

Nunca exponerlas al navegador.

Cada workflow debe recibir un payload estructurado.

Ejemplo:

{
  "action_id": "...",
  "organization_id": "...",
  "case_id": "...",
  "action_type": "approve_email",
  "input_data": {}
}

n8n devuelve:

{
  "success": true,
  "execution_id": "...",
  "result": {}
}

No exponer URL privada ni API credentials de n8n al cliente.

============================================================
28. TYPES
============================================================

Crear tipos TypeScript basados en el schema de Supabase.

Utilizar:

Database

generado desde Supabase.

No duplicar manualmente los tipos de las tablas si pueden generarse.

Crear tipos específicos para:

Case

Email

Evaluation

Action

Approval

Conversation

Message

WorkflowExecution

FollowUp

Notification

============================================================
29. COMPONENTES
============================================================

Crear componentes reutilizables:

AppShell
Sidebar
Topbar
GlobalSearch
NotificationBell

CaseCard
CaseTable
CaseStatusBadge
PriorityBadge
CaseTimeline

EmailList
EmailViewer
EmailThread
EmailComposer

ApprovalCard
ApprovalDialog

DelegationDialog
FollowUpCard

AIMessage
UserMessage
ChatInput
CommandConfirmation

WorkflowCard
WorkflowStatusBadge
ExecutionTable

ActivityTimeline

EmptyState
LoadingState
ErrorState
ConfirmDialog

============================================================
30. RESPONSIVE
============================================================

Desktop first.

Debe funcionar correctamente en:

1440px
1280px
1024px
768px
390px

En mobile:

Sidebar → drawer

Tables → cards/list

Case detail → stacked layout

Chat → full screen

============================================================
31. UX
============================================================

Cada acción debe proporcionar feedback.

Utilizar:

toast

loading states

skeletons

optimistic UI únicamente cuando sea seguro

confirmation dialogs

empty states

error states

Ejemplo:

Al aprobar:

"Enviando aprobación..."

Después:

"Correo aprobado. PE03 está procesando el envío."

Si falla:

"No se pudo ejecutar la acción. El caso permanece sin cambios."

============================================================
32. ACCESSIBILITY
============================================================

Cumplir buenas prácticas WCAG.

Utilizar:

semantic HTML

keyboard navigation

focus states

aria-labels

contraste adecuado

No depender exclusivamente del color.

============================================================
33. DATA FETCHING
============================================================

Utilizar TanStack Query para:

cases
emails
approvals
actions
workflows
notifications

Utilizar Supabase Realtime para invalidar/refrescar queries cuando existan cambios.

Evitar polling innecesario.

============================================================
34. DASHBOARD PERFORMANCE
============================================================

No cargar todos los casos.

Utilizar:

pagination

cursor pagination cuando sea necesario

server-side filtering

server-side sorting

select solamente las columnas necesarias.

No hacer:

select *

cuando no sea necesario.

============================================================
35. ERROR HANDLING
============================================================

Crear sistema global de errores.

Manejar:

401
403
404
409
422
429
500

Mostrar mensajes humanos.

No mostrar:

stack traces

API keys

tokens

payloads sensibles

errores internos completos

============================================================
36. SEGURIDAD
============================================================

Nunca confiar en:

organization_id
user_id
role
permissions

provenientes directamente del frontend.

Validarlos server-side.

Todas las acciones sensibles requieren autorización.

Implementar:

RBAC

RLS

Zod validation

CSRF protection cuando corresponda

rate limiting para endpoints sensibles

idempotency keys

audit logging

secure headers

No almacenar secretos en localStorage.

No almacenar tokens sensibles manualmente.

============================================================
37. ESTRUCTURA DEL PROYECTO
============================================================

Utilizar una estructura similar:

app/
├── (auth)/
│   ├── login/
│   └── forgot-password/
│
├── (dashboard)/
│   ├── dashboard/
│   ├── cases/
│   ├── emails/
│   ├── approvals/
│   ├── delegations/
│   ├── follow-ups/
│   ├── assistant/
│   ├── automations/
│   ├── activity/
│   └── settings/
│
supabase/
├── functions/
│   ├── _shared/
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   └── n8n/
│   ├── actions/
│   ├── cases/
│   ├── dashboard/
│   ├── assistant/
│   └── webhooks/
├── migrations/
└── seed.sql
│
components/
├── ui/
├── layout/
├── cases/
├── emails/
├── approvals/
├── assistant/
├── automations/
└── activity/

lib/
├── supabase/
│   ├── client.ts
│   ├── server.ts
│   └── admin.ts
│
├── auth/
├── permissions/
├── validations/
└── utils/

Las funciones que acceden a secretos, n8n o proveedores de IA deben vivir en `supabase/functions/`, nunca en `app/` ni en componentes cliente.

types/
├── database.ts
├── cases.ts
├── actions.ts
├── assistant.ts
└── workflows.ts

============================================================
38. AUTH
============================================================

Implementar Supabase Auth.

Login:

Email
Password

Preparar arquitectura para:

Google OAuth
Microsoft OAuth

No es obligatorio activarlos inicialmente.

Después de login:

validar:

auth.users
→ public.users
→ organization

Si el usuario no pertenece a una organización:

mostrar:

"Tu cuenta aún no ha sido configurada."

No permitir acceso al dashboard.

============================================================
39. GLOBAL SEARCH
============================================================

Implementar buscador global.

Buscar:

Cases
Emails
Contacts
Actions

Resultados agrupados:

CASOS

EMAILS

CONTACTOS

ACCIONES

Cada resultado debe mostrar:

tipo
título
estado
fecha

============================================================
40. DEMO DATA
============================================================

Crear seed/mock data únicamente para desarrollo.

No utilizar información real.

Crear:

5 casos

8 emails

3 approvals

3 follow-ups

5 workflow executions

2 conversations

10 messages

Simular:

- caso urgente
- aprobación pendiente
- caso delegado
- seguimiento vencido
- workflow fallido

============================================================
41. NO HACER
============================================================

No crear:

- sistema de CRM genérico
- kanban excesivamente complejo
- gráficos innecesarios
- páginas sin propósito
- configuración ficticia
- credenciales falsas
- API keys en frontend
- integración directa browser → Outlook
- integración directa browser → proveedor IA
- ejecución directa de n8n desde cliente

============================================================
42. PRIORIDAD DE IMPLEMENTACIÓN
============================================================

Implementar en este orden:

FASE 1

Authentication
AppShell
Sidebar
Dashboard
Cases
Case Detail

FASE 2

Emails
Email Thread
Approvals
Actions

FASE 3

AI Command Center
Conversations
Messages
Action confirmation

FASE 4

n8n integrations
Workflow executions
Realtime

FASE 5

Delegations
Follow-ups
Audit logs

FASE 6

Settings
RBAC
Organization management

============================================================
43. RESULTADO ESPERADO
============================================================

La plataforma final debe sentirse como:

"Un asistente ejecutivo digital que tiene memoria, entiende el contexto de los casos, ejecuta automatizaciones y sabe cuándo debe pedir autorización humana."

La pantalla principal debe permitir que una gerente abra la plataforma y en menos de 10 segundos pueda entender:

1. ¿Qué pasó?
2. ¿Qué necesita mi atención?
3. ¿Qué decidió la IA?
4. ¿Por qué lo decidió?
5. ¿Qué puedo aprobar/rechazar/delegar?
6. ¿Qué está ejecutando n8n?
7. ¿Qué falló?
8. ¿Qué necesita seguimiento?

La plataforma debe estar preparada para crecer de un agente de correo hacia múltiples agentes especializados.

Arquitectura futura:

                    AI COMMAND CENTER
                           │
              ┌────────────┼────────────┐
              │            │            │
         Email Agent   Case Agent   Follow-up Agent
              │            │            │
              └────────────┼────────────┘
                           │
                          n8n
                           │
                       Supabase

El sistema debe tratar cada agente como un conjunto de workflows, acciones y capacidades, no como páginas independientes.

Priorizar arquitectura limpia, seguridad, escalabilidad y una excelente experiencia de usuario.