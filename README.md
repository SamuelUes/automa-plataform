# Prologistica AI Command Center

Centro de control ejecutivo para casos, correos, aprobaciones, agentes IA y automatizaciones n8n.

## Arquitectura

- Frontend: Next.js 16, App Router, TypeScript, React y Tailwind CSS.
- Datos y autenticación: Supabase PostgreSQL, Supabase Auth y RLS.
- Backend: Supabase Edge Functions con runtime Deno.
- Automatización: n8n mediante webhook privado.
- IA: proveedor externo administrado únicamente por n8n o Edge Functions.

Next.js no contiene Route Handlers, Server Actions ni secretos de backend.

## Rutas

- `/login`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/cases`
- `/cases/[id]`
- `/emails`
- `/approvals`
- `/assistant`
- `/automations`
- `/automations/[id]`
- `/delegations`
- `/follow-ups`
- `/activity`
- `/settings`

## Edge Functions

- `actions`: crea acciones idempotentes y dispara n8n.
- `assistant`: procesa mensajes del Command Center.
- `case-messages`: procesa conversaciones de los casos y dispara PE13.
- `workflow-bridge`: recibe resultados de n8n y los entrega al callback seguro.
- `PE13`: orquesta conversaciones de casos sin reemplazar PE05 (Sent Watcher).
- `authority_decisions` y `commands`: persisten la decisión del motor y los comandos autorizados.
- `cases`: consulta casos paginados y filtrados.
- `dashboard`: carga el resumen operativo.
- `notifications`: lista notificaciones y permite marcarlas como leídas.
- `search`: búsqueda global multi-entidad.
- `settings`: perfil, organización, departamentos, invitaciones y roles.
- `workflows`: definiciones y ejecuciones de workflows.
- `webhooks/n8n`: callback autenticado desde n8n para actualizar ejecuciones.

## Variables públicas

Solo estas variables pueden estar disponibles en el frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

## Secretos de Supabase Edge Functions

Configurar mediante Supabase Secrets, nunca en `NEXT_PUBLIC_*`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
N8N_WEBHOOK_URL=https://your-n8n-host
N8N_API_URL=https://your-n8n-host/api/v1
N8N_API_KEY=your_n8n_api_key
N8N_INGRESS_SECRET=your_ingress_secret
N8N_WEBHOOK_SECRET=your_callback_secret
FRONTEND_ORIGIN=https://your-frontend-domain,https://app.novatec.digital
```
# n8n
```PROLOGISTICA_EDGE_FUNCTION_URL=https://<supabase-project>.supabase.co/functions/v1```

## Desarrollo local

```bash
npm install
npm run dev
```

## Verificación

```bash
npm run lint
npm run typecheck
npm run build
```

## Migraciones Supabase

Las migraciones nuevas se encuentran en `supabase/migrations/`.

Aplicar únicamente en un proyecto Supabase autenticado:

```bash
supabase db push
```

La migración de notificaciones crea la tabla `public.notifications`, sus índices, políticas RLS y permisos necesarios.

## Despliegue de Edge Functions

Desde un entorno autenticado con Supabase CLI:

```bash
supabase functions deploy actions
supabase functions deploy assistant
supabase functions deploy case-messages
supabase functions deploy workflow-bridge
supabase functions deploy cases
supabase functions deploy dashboard
supabase functions deploy notifications
supabase functions deploy search
supabase functions deploy settings
supabase functions deploy workflows
supabase functions deploy webhooks/n8n
```

No ejecutar estos comandos contra producción sin revisar primero las migraciones, políticas RLS y secretos.

## Seguridad

- Nunca usar `SUPABASE_SERVICE_ROLE_KEY` en componentes cliente.
- Nunca guardar API keys en `localStorage`.
- Nunca ejecutar n8n directamente desde el navegador.
- Validar JWT, organización, rol e input en cada Edge Function.
- Usar el secreto `N8N_WEBHOOK_SECRET` para callbacks de n8n.
- Mantener `FRONTEND_ORIGIN` restringido al dominio real del frontend.
