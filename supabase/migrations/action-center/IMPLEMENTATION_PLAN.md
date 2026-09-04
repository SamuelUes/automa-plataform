# Action Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder dialogs and nonfunctional buttons with contextual, accessible actions backed by existing `createAction`, Supabase Edge Functions and n8n workflows, while keeping the current routes and components.

**Architecture:** Reuse `OperationDialog`, existing forms, `createAction`, PE04, PE06, PE07 and PE12. Add one small shared Action Center only for selecting actions and displaying operation state. No direct database mutations from the browser. Storage remains a separate, manually executed SQL contract under `supabase/migrations/storage/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Radix Dialog, existing Tailwind tokens, Supabase Edge Functions, n8n.

---

## Backend capability map

- Email send, reply, forward: `send_email` → PE07.
- Approval accept/reject: `approve_email`, `reject_approval` → PE07.
- Delegation: `delegate_case` → PE04.
- Follow-up create/reschedule: `schedule_follow_up` → PE06.
- Case verify/resolve/close: `verify_case`, `resolve_case`, `close_case` → PE12.
- Generic workflow execution: `execute_workflow` through the existing workflow boundary.
- Attachments: not active yet. The SQL contract is separate and must be reviewed and executed manually before UI activation.

## Preservation rules

- Preserve the user formatting changes in `emails/page.tsx`, `follow-ups/page.tsx` and `global-search.tsx`.
- Do not rename routes, action types, or existing form field names.
- Do not claim success before an Edge Function response confirms the operation.
- Keep demo actions visibly separated from real actions.
- Do not execute SQL, migrations, grants, bucket creation or policy changes from the application.

## Task 1: Upgrade the dialog primitive and operation state

**Files:**
- Modify: `src/components/dashboard/operation-dialog.tsx`
- Modify: `src/components/ui/states.tsx`
- Create: `src/components/dashboard/operation-status.tsx`

- [ ] Add a responsive dialog body with `max-h-[min(80dvh,720px)] overflow-y-auto`, mobile-safe footer spacing, and a visible title/description hierarchy.
- [ ] Add an `OperationStatus` component with `idle`, `submitting`, `queued`, `success`, and `error` states.
- [ ] Render error messages with a retry callback and `role="alert"`; render success with `role="status"`.
- [ ] Keep Radix focus management, Escape close and the existing close button.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 2: Add shared contextual action menu

**Files:**
- Create: `src/components/dashboard/action-center.tsx`
- Modify: `src/lib/actions.ts`

- [ ] Define an `ActionCenterItem` type with `id`, `label`, `description`, `workflow`, `requiresApproval`, `tone`, and `onSelect`.
- [ ] Render grouped actions in a Radix Dialog using existing Button and icon conventions.
- [ ] Show workflow metadata in a quiet secondary line so users understand the consequence before confirming.
- [ ] Generate a unique idempotency key per user intent, preserving explicit keys passed by existing callers.
- [ ] Do not add unsupported action types to `ActionType`.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 3: Make dashboard refresh functional

**Files:**
- Create: `src/components/dashboard/refresh-dashboard-button.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] Move the current static update Button into a client component.
- [ ] On click, call `router.refresh()` and expose `Actualizando...` while the refresh is scheduled.
- [ ] Prevent duplicate clicks for 500 ms and preserve the current `w-full sm:w-fit` layout.
- [ ] Add a polite status message for screen readers.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 4: Replace case detail toast with Action Center

**Files:**
- Modify: `src/app/(dashboard)/cases/[id]/page.tsx`

- [ ] Replace `toast.info("Las acciones disponibles...")` with Action Center items based on the current `item.status` and available permissions.
- [ ] Wire existing actions: `verify_case`, `resolve_case`, `close_case`, `delegate_case`, and `schedule_follow_up`.
- [ ] Reuse the current delegation and follow-up dialogs for forms instead of duplicating them.
- [ ] Add `Ver actividad` and `Ver ejecución` navigation items only when target IDs exist.
- [ ] Keep the primary Resolve button and make Action Center secondary actions non-duplicative.
- [ ] Show backend errors through `getOperationError` and keep the dialog open when an action fails.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 5: Make follow-up overflow actions real

**Files:**
- Modify: `src/app/(dashboard)/follow-ups/page.tsx`

- [ ] Replace the toast-only overflow action with a contextual dialog/menu.
- [ ] Add `Posponer una hora`, `Posponer mañana`, `Posponer una semana`, `Completar`, `Abrir caso`, and `Ver actividad`.
- [ ] Implement postpone using `schedule_follow_up` with `follow_up_id`, `case_id`, and a new ISO `scheduled_for` value.
- [ ] Implement completion only through the existing backend action contract; never mutate the row locally before success.
- [ ] Update the row after the backend response and show retryable errors.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 6: Improve delegation dialog and actions

**Files:**
- Modify: `src/components/dashboard/delegation-form.tsx`
- Modify: `src/app/(dashboard)/delegations/page.tsx`
- Modify: `src/app/(dashboard)/cases/[id]/page.tsx`

- [ ] Preserve the current form fields and user formatting.
- [ ] Replace UUID-only helper text with searchable Select controls when organization data is available.
- [ ] Add review summary before submit: case, responsible, department and reason.
- [ ] Add contextual actions for accept, reject, reassign and complete only if the current Edge Function accepts the corresponding `input_data.status` values.
- [ ] Keep `delegate_case` as the mutation boundary.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 7: Upgrade email compose and message actions

**Files:**
- Modify: `src/components/dashboard/email-compose-form.tsx`
- Modify: `src/app/(dashboard)/emails/page.tsx`

- [ ] Preserve the user's formatting changes around the email actions.
- [ ] Add progressive CC/BCC fields and a visible case context block.
- [ ] Add a confirmation summary before `send_email` submission.
- [ ] Wire `Responder` and `Reenviar` through the existing compose modes.
- [ ] Add `Crear caso` and `Vincular a caso` only after confirming an existing Edge Function contract; otherwise leave them out rather than creating dead controls.
- [ ] Keep `Adjuntar` disabled with a precise explanation until the Storage contract is applied and an upload Edge Function exists.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 8: Reject approval with required reason

**Files:**
- Modify: `src/app/(dashboard)/approvals/page.tsx`
- Reuse: `src/components/dashboard/operation-dialog.tsx`

- [ ] Open a compact rejection dialog from the existing Rechazar action.
- [ ] Require a non-empty reason and send it under `input_data.comment` with `reject_approval`.
- [ ] Keep the approval pending if the backend rejects or times out.
- [ ] Show the returned operation state and keep focus inside the dialog until close.
- [ ] Run `npm run lint && npm run typecheck`.

## Task 9: Separate and verify Storage contract

**Files:**
- Review: `supabase/migrations/storage/README.md`
- Review: `supabase/migrations/storage/20260904000000_email_attachments_storage.sql`

- [ ] Review the target project's existing Storage buckets and `storage.objects` policies.
- [ ] Execute the SQL manually only in staging after confirming no conflicting bucket or policy exists.
- [ ] Test organization isolation, upload size, MIME restrictions, read and delete policies.
- [ ] Do not connect the Attach button until the bucket, metadata table, upload flow and Edge Function contract are verified.

## Task 10: Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Verify keyboard focus, Escape, mobile dialog scrolling and screen-reader status.
- [ ] Verify all action payloads against `supabase/functions/actions/index.ts`.
- [ ] Verify no unsupported UI option calls a nonexistent workflow.
- [ ] Verify no SQL was applied automatically.
