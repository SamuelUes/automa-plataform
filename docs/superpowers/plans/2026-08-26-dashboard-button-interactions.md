# Dashboard Button Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir los botones sin comportamiento del dashboard en interacciones reales, separando filtros frontend de operaciones persistentes en Supabase/n8n y manteniendo un fallback funcional para datos demo.

**Architecture:** Mantener la carga de datos en cada página y añadir componentes client reutilizables para formularios, confirmaciones, menús y feedback. Las mutaciones de negocio usarán `createAction`; los filtros y fechas modificarán estado local; los registros demo se actualizarán localmente y se identificarán como no persistidos.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase SSR/client, Edge Functions, Radix ya instalado, componentes shadcn existentes, `react-hook-form`, `zod`, `sonner`, `lucide-react`.

---

## Mapa de archivos

**Crear**

- `src/components/dashboard/action-feedback.tsx`: helper/componente para estado de carga y mensajes de operación.
- `src/components/dashboard/operation-dialog.tsx`: primitivas compartidas de diálogo para formularios y confirmaciones, usando `@radix-ui/react-dialog` ya instalado.
- `src/components/dashboard/case-form.tsx`: formulario de creación de casos, validación zod y modo demo/real.
- `src/components/dashboard/delegation-form.tsx`: formulario para delegar un caso.
- `src/components/dashboard/follow-up-form.tsx`: formulario para programar un seguimiento.
- `src/components/dashboard/email-compose-form.tsx`: redactar, responder y reenviar.

**Modificar**

- `src/lib/actions.ts`: agregar generación de idempotency key por operación y un normalizador de errores sin cambiar el contrato de `createAction`.
- `src/app/(dashboard)/cases/page.tsx`: crear caso, filtros avanzados y refresco/feedback.
- `src/app/(dashboard)/cases/[id]/page.tsx`: resolver, menú de acciones, navegación/diálogos de aprobación, delegación y seguimiento.
- `src/app/(dashboard)/emails/page.tsx`: filtros avanzados, composición, menús y estados explícitos para archivar/adjuntar.
- `src/app/(dashboard)/activity/page.tsx`: rango de fechas local y estado de recarga.
- `src/app/(dashboard)/delegations/page.tsx`: tabs de estado, creación, menú y completar con confirmación.
- `src/app/(dashboard)/follow-ups/page.tsx`: creación, menús y confirmación para completar.

**Verificación**

- No hay infraestructura de tests automatizados actualmente; usar `npm run typecheck`, `npm run lint` y `npm run build`, además de una matriz de pruebas manuales documentada en el PR/entrega.

---

### Task 1: Añadir primitivas compartidas de operación y validación

**Files:**
- Create: `src/components/dashboard/action-feedback.tsx`
- Create: `src/components/dashboard/operation-dialog.tsx`
- Modify: `src/lib/actions.ts`

- [ ] **Step 1: Crear el helper de detección y resultado de operación**

Exportar funciones pequeñas y tipadas:

```ts
export function isDemoId(id: string | null | undefined) {
  return Boolean(id && /^(demo-|case-|email-|delegation-|follow-|activity-)/.test(id));
}

export function operationMessage(data: unknown) {
  const result = data as { n8n?: { success?: boolean }; action?: { status?: string } } | null;
  if (result?.n8n?.success === false) return "La acción se creó, pero el workflow está pendiente.";
  if (result?.action?.status === "queued") return "La acción fue enviada a procesamiento.";
  return "La operación se completó.";
}
```

El componente `ActionFeedback` debe recibir `processing: boolean` y renderizar `Spinner`/texto sin introducir estado global.

- [ ] **Step 2: Crear el contenedor de diálogo accesible**

Usar `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` y `DialogFooter` de `@radix-ui/react-dialog` mediante un wrapper local. Cada diálogo debe exigir un título visible o `sr-only`; no usar un modal casero con `div` y `onClick`.

- [ ] **Step 3: Normalizar errores de Supabase y funciones**

En `src/lib/actions.ts`, conservar `createAction(actionType, payload)` y añadir:

```ts
export function getOperationError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "No se pudo completar la operación.";
}
```

No registrar tokens, payloads completos ni información sensible.

- [ ] **Step 4: Ejecutar verificación de tipos**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/action-feedback.tsx src/components/dashboard/operation-dialog.tsx src/lib/actions.ts
git commit -m "Add shared dashboard operation primitives"
```

---

### Task 2: Implementar formularios de creación

**Files:**
- Create: `src/components/dashboard/case-form.tsx`
- Create: `src/components/dashboard/delegation-form.tsx`
- Create: `src/components/dashboard/follow-up-form.tsx`

- [ ] **Step 1: Definir esquemas zod y tipos de salida**

Usar `useForm` con esquemas equivalentes a:

```ts
const caseSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(500),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  contact_id: z.string().uuid().optional().or(z.literal("")),
  department_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
});

const delegationSchema = z.object({
  case_id: z.string().uuid("Selecciona un caso"),
  assigned_to: z.string().uuid("Selecciona un responsable"),
  department_id: z.string().uuid().optional().or(z.literal("")),
  reason: z.string().trim().max(2000).optional(),
});

const followUpSchema = z.object({
  case_id: z.string().uuid("Selecciona un caso"),
  scheduled_for: z.string().min(1, "Selecciona fecha y hora"),
  reason: z.string().trim().max(2000).optional(),
});
```

- [ ] **Step 2: Implementar el formulario de caso**

Renderizar título, descripción, prioridad y selects opcionales. En modo real, insertar solo los campos permitidos en `cases` con `createClient().from("cases").insert(...).select(...).single()`. En modo demo, devolver un `DemoCase` generado en memoria. El callback debe devolver `{ mode: "real" | "demo", record }` para que la página actualice su lista sin afirmar persistencia demo.

- [ ] **Step 3: Implementar delegación**

En modo real llamar:

```ts
await createAction("delegate_case", {
  case_id: values.case_id,
  input_data: {
    assigned_to: values.assigned_to,
    department_id: values.department_id || null,
    reason: values.reason || null,
  },
});
```

En modo demo devolver una delegación local. Deshabilitar envío mientras `isSubmitting` sea true.

- [ ] **Step 4: Implementar seguimiento**

Convertir el valor de `datetime-local` a ISO con `new Date(values.scheduled_for).toISOString()` y llamar:

```ts
await createAction("schedule_follow_up", {
  case_id: values.case_id,
  input_data: {
    scheduled_for: scheduledForIso,
    reason: values.reason || null,
  },
});
```

No enviar la fecha como una mutación de filtro ni ocultar la conversión de zona horaria.

- [ ] **Step 5: Ejecutar lint y typecheck**

Run: `npm run lint && npm run typecheck`
Expected: exit code 0 and no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/case-form.tsx src/components/dashboard/delegation-form.tsx src/components/dashboard/follow-up-form.tsx
git commit -m "Add validated case operation forms"
```

---

### Task 3: Activar acciones y filtros de casos

**Files:**
- Modify: `src/app/(dashboard)/cases/page.tsx`
- Modify: `src/app/(dashboard)/cases/[id]/page.tsx`

- [ ] **Step 1: Conectar Nuevo caso en el listado**

Añadir estado `caseDialogOpen`, renderizar `OperationDialog` con `CaseForm`, insertar el resultado demo en `setCases` o volver a consultar `cases` tras una inserción real, y mostrar toast diferenciando ambos modos.

- [ ] **Step 2: Hacer funcional Más filtros**

Añadir estado local para rango de fechas, `requiresApproval` y `requiresHuman`. El modal debe aplicar esos criterios a `useMemo`; cancelar no cambia los filtros. Limpiar debe volver a los valores `all`/vacíos. No llamar `createAction` ni Edge Functions.

- [ ] **Step 3: Activar acciones del detalle**

Añadir un handler con guardas:

```ts
async function resolveCase() {
  if (!id || id.startsWith("demo-") || item.status === "resolved") return;
  setProcessing("resolve");
  try {
    await createAction("resolve_case", { case_id: id });
    toast.success("Caso enviado a resolución");
    await reloadCase();
  } catch (error) {
    toast.error(getOperationError(error));
  } finally {
    setProcessing(null);
  }
}
```

Para demo actualizar `item.status` localmente y notificar que no se persistió. `Más acciones` debe usar un `DropdownMenu` con verificar/cerrar únicamente cuando el estado lo permita.

- [ ] **Step 4: Conectar Delegar caso y Crear seguimiento del detalle**

Abrir los formularios con el `case_id` actual preseleccionado. Tras una acción real recargar el caso; tras demo actualizar la vista local. `Revisar aprobación` debe navegar a la aprobación existente si hay `approval_id`; si no existe, mostrar toast informativo en lugar de una navegación rota.

- [ ] **Step 5: Ejecutar typecheck**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/cases/page.tsx" "src/app/(dashboard)/cases/[id]/page.tsx"
git commit -m "Connect case creation filters and actions"
```

---

### Task 4: Activar delegaciones y seguimientos

**Files:**
- Modify: `src/app/(dashboard)/delegations/page.tsx`
- Modify: `src/app/(dashboard)/follow-ups/page.tsx`

- [ ] **Step 1: Conectar filtros de delegaciones**

Añadir `filter: "active" | "completed"` y derivar `visibleDelegations` con `useMemo`. Los botones deben cambiar variante y lista; no ejecutar consultas ni acciones.

- [ ] **Step 2: Conectar Delegar caso**

Abrir `DelegationForm`; usar el listado de casos/usuarios/departamentos disponible o cargar opciones reales antes de habilitar el envío. En demo insertar el resultado local. En real mostrar “acción enviada” y recargar delegaciones.

- [ ] **Step 3: Completar delegación con confirmación**

Conservar `createAction("delegate_case", ...)`, envolverlo en `Dialog` de confirmación, capturar errores con toast y solo cambiar a `completed` después de una respuesta aceptada. Mantener la modificación preexistente de formato en este archivo.

- [ ] **Step 4: Conectar Nuevo seguimiento**

Abrir `FollowUpForm`, actualizar estado demo o recargar datos reales y cerrar el diálogo solamente tras éxito.

- [ ] **Step 5: Mejorar acciones de seguimiento**

Mantener `schedule_follow_up` para Ejecutar ahora y `resolve_case` para Completar. Añadir confirmación únicamente para Completar, estados independientes por ID para no bloquear toda la lista y toast para respuestas 201/202. El menú Más opciones debe mostrar opciones contextuales sin mutar por abrirlo.

- [ ] **Step 6: Ejecutar lint y typecheck**

Run: `npm run lint && npm run typecheck`
Expected: exit code 0.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/delegations/page.tsx" "src/app/(dashboard)/follow-ups/page.tsx"
git commit -m "Connect delegation and follow-up operations"
```

---

### Task 5: Activar correos sin inventar capacidades del backend

**Files:**
- Create: `src/components/dashboard/email-compose-form.tsx`
- Modify: `src/app/(dashboard)/emails/page.tsx`

- [ ] **Step 1: Confirmar campos de correo disponibles**

Usar únicamente `sender`, `recipients`, `cc`, `subject`, `body_text`, `case_id` y metadatos existentes. No añadir una columna de archivado ni una tabla de adjuntos en este alcance.

- [ ] **Step 2: Implementar composición**

Validar destinatario, asunto y cuerpo. Redactar, responder y reenviar deben compartir el componente y diferenciar el modo mediante props. Para datos reales llamar:

```ts
await createAction("send_email", {
  case_id: selected.caseId || null,
  message_id: selected.id,
  input_data: { to, cc, subject, body },
});
```

Para demo cerrar el diálogo y mostrar que la operación es local/no persistida.

- [ ] **Step 3: Hacer Más filtros local**

Añadir filtro de dirección, aprobación y rango de recepción sobre `emails`; cancelar no altera `visible`. No consultar n8n.

- [ ] **Step 4: Implementar menús y límites explícitos**

`Más opciones` usa `DropdownMenu`. Archivar debe quedar deshabilitado con explicación si no existe soporte persistente. Adjuntar debe quedar deshabilitado con texto “Disponible cuando Storage esté configurado”; no simular archivo enviado.

- [ ] **Step 5: Ejecutar build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/email-compose-form.tsx "src/app/(dashboard)/emails/page.tsx"
git commit -m "Connect email composition and local filters"
```

---

### Task 6: Hacer funcional el selector de fechas de actividad

**Files:**
- Modify: `src/app/(dashboard)/activity/page.tsx`

- [ ] **Step 1: Añadir estado local del rango**

Usar `fromDate` y `toDate` como strings `YYYY-MM-DD`. El diálogo de fecha debe permitir aplicar, cancelar y limpiar.

- [ ] **Step 2: Filtrar eventos sin mutación**

Conservar un timestamp real separado de `time` al mapear `audit_logs`; para demos, derivar el rango únicamente cuando el dato permita una fecha fiable. `visible` debe filtrar tono, búsqueda y rango. El botón Fecha no debe invocar `createAction`.

- [ ] **Step 3: Mejorar Actualizar actividad**

Añadir `loading` y feedback. La acción solamente ejecuta `load()`, conserva el fallback demo si la consulta no devuelve datos y muestra error si la consulta falla.

- [ ] **Step 4: Ejecutar lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/activity/page.tsx"
git commit -m "Add local activity date filtering"
```

---

### Task 7: Verificación completa y revisión de cambios

**Files:**
- Modify: only files required by failures found during verification.

- [ ] **Step 1: Ejecutar typecheck completo**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 2: Ejecutar lint completo**

Run: `npm run lint`
Expected: exit code 0 and no warnings that indicate broken hooks, accessibility or unused handlers.

- [ ] **Step 3: Ejecutar build completo**

Run: `npm run build`
Expected: exit code 0 and all dashboard routes compile.

- [ ] **Step 4: Revisar el diff y el estado**

Run: `git diff HEAD~6..HEAD --stat; git status --short`
Expected: los commits solo contienen los cambios de la implementación y la modificación previa de `delegations/page.tsx` no se pierde; no hay secretos ni archivos de entorno staged.

- [ ] **Step 5: Ejecutar matriz manual**

Verificar con datos demo y reales:

- abrir/cerrar cada diálogo y cancelar sin mutar;
- validación de título, responsable, caso y fecha;
- filtros de casos/correos/actividad/delegaciones/seguimientos;
- resolver, completar, delegar y programar con estado de carga;
- respuestas 201/202, 401, 403, 404 y 422;
- fallback demo con mensaje de no persistencia;
- doble click/idempotencia en acciones;
- refresco posterior de listas y detalle;
- teclado, foco, labels y cierre accesible de diálogos/menús.

- [ ] **Step 6: Commit de correcciones de verificación**

```bash
git add src/components/dashboard src/lib/actions.ts "src/app/(dashboard)/cases/page.tsx" "src/app/(dashboard)/cases/[id]/page.tsx" "src/app/(dashboard)/emails/page.tsx" "src/app/(dashboard)/activity/page.tsx" "src/app/(dashboard)/delegations/page.tsx" "src/app/(dashboard)/follow-ups/page.tsx"
git commit -m "Verify dashboard button interactions"
```

Solo crear este commit si hubo correcciones después de los comandos de verificación; no incluir documentos ni archivos no relacionados.
