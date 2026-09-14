# PE08 Context Broker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert PE08 into a context-aware conversational workflow that can query related Supabase data and request existing operational actions through the authorized orchestration path.

**Architecture:** Extend `conversation-context` into a typed, organization-scoped Context Broker. PE08 calls the broker for a bounded base snapshot and on-demand searches, then emits structured `action_requests`; the existing orchestrator, `actions`, authority decisions, operational workflows, and webhook callback remain the only write path.

**Tech Stack:** Supabase Edge Functions/Deno, `@supabase/supabase-js`, Zod in Deno imports, n8n workflow JSON, PostgreSQL/RLS, Next.js assistant integration, npm lint/typecheck/build, Supabase CLI verification.

---

## Existing files and responsibilities

- `supabase/functions/conversation-context/index.ts`: current authenticated-by-secret context endpoint; extend into the typed broker.
- `supabase/functions/assistant/index.ts`: creates/reuses conversations and starts PE08 executions; add a stable conversational envelope and snapshot metadata.
- `supabase/functions/_shared/integration.ts`: shared envelope, execution, activity, and context URL helpers; add shared context/action result types only if needed by more than one function.
- `supabase/functions/_shared/validation.ts`: current Zod schemas for assistant and actions; add broker request validation without duplicating it in the handler.
- `supabase/functions/workflow-bridge/index.ts`: orchestration child dispatch and callback forwarding; preserve existing write behavior and only adjust PE08 dispatch metadata if required.
- `supabase/functions/webhooks/index.ts`: persists workflow callbacks and PE08 assistant results; add snapshot/message reconciliation here.
- `supabase/functions/actions/index.ts`: existing action authorization and domain mutation boundary; do not bypass it.
- `flujos/PE08.json`: current n8n PE08 workflow, still based on the experimental local/mock navigation contract; replace executable path while preserving fixtures where useful.
- `scripts/fixtures/n8n-sam-workflows.json`: n8n fixture used by the repository verifier; update the PE08 fixture with the new node sequence and webhook URLs.
- `supabase/migrations/`: migration location for indexes or constraints required by bounded broker queries.
- `docs/pe08-context-broker-design.md`: approved design; implementation must satisfy its contracts and success criteria.

The repository has no configured unit-test script. New Edge Function tests should use Deno test files and be run with the installed Supabase/Deno tooling or a local Deno installation; frontend verification remains `npm run lint`, `npm run typecheck`, and `npm run build`.

---

### Task 1: Define and validate the typed Context Broker contract

**Files:**
- Modify: `supabase/functions/_shared/validation.ts`
- Create: `supabase/functions/_shared/context-broker.ts`
- Create: `supabase/functions/_shared/context-broker.test.ts`

- [ ] **Step 1: Write failing contract tests**

Add tests for a pure parser/normalizer exported from `context-broker.ts`:

```ts
Deno.test("parseContextBrokerRequest accepts a bounded snapshot request", () => {
  const parsed = parseContextBrokerRequest({
    operation: "get_context_snapshot",
    organization_id: "00000000-0000-4000-8000-000000000001",
    conversation_id: "00000000-0000-4000-8000-000000000002",
    case_id: null,
    request_id: "00000000-0000-4000-8000-000000000003",
    parameters: {},
  });
  if (!parsed.success || parsed.data.operation !== "get_context_snapshot") {
    throw new Error("expected a valid snapshot request");
  }
});

Deno.test("parseContextBrokerRequest rejects arbitrary SQL and unknown operations", () => {
  const parsed = parseContextBrokerRequest({
    operation: "execute_sql",
    organization_id: "00000000-0000-4000-8000-000000000001",
    conversation_id: "00000000-0000-4000-8000-000000000002",
    request_id: "00000000-0000-4000-8000-000000000003",
    parameters: { sql: "select * from emails" },
  });
  if (parsed.success) throw new Error("arbitrary operations must be rejected");
});

Deno.test("normalizeLimit clamps requested limits to the broker maximum", () => {
  if (normalizeLimit(0, 40) !== 1) throw new Error("minimum limit failed");
  if (normalizeLimit(1000, 40) !== 40) throw new Error("maximum limit failed");
});
```

The schema must enumerate exactly these operations: `get_context_snapshot`, `search_emails`, `get_email_thread`, `search_messages`, `list_email_drafts`, `get_case_context`, `list_case_delegations`, `list_case_followups`, and `get_related_activity`. Parameters must be a record with operation-specific fields, not arbitrary SQL or table names.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
deno test --no-check "supabase/functions/_shared/context-broker.test.ts"
```

Expected: FAIL because the parser and limit normalizer do not exist yet.

- [ ] **Step 3: Implement the shared contract**

Export:

```ts
export const contextBrokerOperations = [
  "get_context_snapshot",
  "search_emails",
  "get_email_thread",
  "search_messages",
  "list_email_drafts",
  "get_case_context",
  "list_case_delegations",
  "list_case_followups",
  "get_related_activity",
] as const;

export type ContextBrokerOperation = typeof contextBrokerOperations[number];

export function normalizeLimit(value: unknown, maximum: number) {
  return Math.min(Math.max(Number(value) || 20, 1), maximum);
}
```

Use the repository’s Deno Zod import style in `validation.ts` and export a strict `contextBrokerRequestSchema`. Reject unknown operation values, missing UUIDs, SQL-like parameter keys, and limits outside the accepted shape. Keep `parameters` operation-specific through a map of allowed keys so unknown column names cannot reach Supabase queries.

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

```bash
deno test --no-check "supabase/functions/_shared/context-broker.test.ts"
npm run typecheck
```

Expected: all focused tests pass and TypeScript exits with code 0.

- [ ] **Step 5: Commit the contract in isolation**

```bash
git add supabase/functions/_shared/validation.ts supabase/functions/_shared/context-broker.ts supabase/functions/_shared/context-broker.test.ts
git commit -m "feat: define typed context broker contract"
```

---

### Task 2: Implement organization-scoped Context Broker queries

**Files:**
- Modify: `supabase/functions/conversation-context/index.ts`
- Modify: `supabase/functions/_shared/context-broker.ts`
- Create: `supabase/functions/conversation-context/index.test.ts`

- [ ] **Step 1: Write failing query-handler tests**

Use a fake Supabase client or injected query adapter so tests do not require production credentials. Cover:

```ts
Deno.test("get_context_snapshot returns partial coverage when one optional source fails", async () => {
  const result = await buildContextSnapshot(fakeAdapter({ fail: "email_drafts" }), baseRequest());
  if (result.coverage.status !== "PARTIAL") throw new Error("expected partial coverage");
  if (!result.coverage.missing_sources.includes("email_drafts")) {
    throw new Error("missing source was not reported");
  }
});

Deno.test("broker rejects a case that does not belong to the conversation", async () => {
  await assertRejects(
    () => resolveConversationScope(fakeAdapter({ conversationCaseId: CASE_A, requestedCaseId: CASE_B }), baseRequest()),
    "CONVERSATION_CASE_MISMATCH",
  );
});
```

Also cover a nonexistent conversation, an organization mismatch, a limit above the source maximum, and a search that returns `truncated: true`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
deno test --no-check "supabase/functions/conversation-context/index.test.ts"
```

Expected: FAIL because the adapter, scope resolver, and snapshot builder do not exist.

- [ ] **Step 3: Implement scope resolution and query builders**

Resolve the conversation first with organization ownership:

```ts
const { data: conversation, error } = await admin
  .from("conversations")
  .select("id,organization_id,case_id,conversation_type,title,status,context,pending_intent,last_activity_at,inactivity_generation,updated_at")
  .eq("id", conversationId)
  .eq("organization_id", organizationId)
  .maybeSingle();
```

Reject missing conversations with a generic not-found response. If a requested case differs from `conversation.case_id`, return an ownership/scope error without revealing the other record.

Implement bounded source loaders with fixed select lists and organization predicates:

- `messages`: current conversation, newest first, then reverse for model order, max 40.
- `cases`: current case only when present; include `case_number`, `title`, `description`, `status`, `priority`, `assigned_to`, `department_id`, `metadata`, and timestamps.
- `context`: latest snapshot for the conversation.
- `emails`: current case or thread only; never query organization-wide without an explicit search operation.
- `email_drafts`: current case/conversation, fixed fields, max 20.
- `delegations`: current case and organization, fixed fields, max 20.
- `follow_ups`: current case and organization, fixed fields, max 20.
- `related_actions`: current conversation/case with fixed status and output fields, max 30.

For under-demand operations, build separate functions with explicit filters. Escape user search text for the PostgREST `ilike` pattern rather than interpolating arbitrary query fragments. Return `{ data, refs, coverage }` and set `truncated` when the bounded result reaches its cap.

Do not add a new database migration unless `EXPLAIN` or observed query behavior demonstrates a missing index. If one is needed, create it with:

```bash
supabase migration new pe08_context_broker_indexes
```

The migration must add only indexes supporting organization/case/conversation/thread/date access and must preserve RLS. Do not apply it to a remote project from the plan execution without reviewing the generated SQL.

- [ ] **Step 4: Implement the Edge Function handler**

Keep `OPTIONS` handling and `N8N_INGRESS_SECRET` validation. For `POST`, parse JSON through `parseContextBrokerRequest`, create the admin client, resolve scope, dispatch only to the enumerated operation handler, and return:

```ts
return Response.json(result, {
  headers: { ...cors(req), "Cache-Control": "no-store" },
});
```

Map source failures to structured errors containing `code`, `source`, and `retryable`; never include SQL, service-role details, or full provider credentials. Return 401 for the wrong secret, 422 for invalid contract, 404 for a missing owned conversation, and 500 only for unexpected failures.

- [ ] **Step 5: Run focused tests and function verification**

Run:

```bash
deno test --no-check "supabase/functions/_shared/context-broker.test.ts" "supabase/functions/conversation-context/index.test.ts"
npm run typecheck
```

Expected: all broker tests pass and the repository typecheck remains clean.

- [ ] **Step 6: Commit the broker**

```bash
git add supabase/functions/conversation-context/index.ts supabase/functions/_shared/context-broker.ts supabase/functions/conversation-context/index.test.ts supabase/migrations
 git commit -m "feat: add organization-scoped conversation context broker"
```

Stage only the generated migration if this task actually creates one; do not stage unrelated existing migrations.

---

### Task 3: Persist versioned context snapshots and expose stable references

**Files:**
- Modify: `supabase/functions/_shared/integration.ts`
- Modify: `supabase/functions/webhooks/index.ts`
- Modify: `supabase/functions/conversation-context/index.ts`
- Create: `supabase/functions/_shared/context-snapshot.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

Test a pure merge function with these invariants:

```ts
Deno.test("mergeContextSnapshot increments the version and preserves source refs", () => {
  const previous = { version: 2, content_json: { source_refs: [{ type: "case", id: CASE_A }] } };
  const next = mergeContextSnapshot(previous, {
    conversation: { id: CONVERSATION_ID },
    source_refs: [{ type: "email", id: EMAIL_ID }],
  });
  if (next.version !== 3) throw new Error("version was not incremented");
  if (next.content_json.source_refs.length !== 2) throw new Error("refs were not merged");
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
deno test --no-check "supabase/functions/_shared/context-snapshot.test.ts"
```

Expected: FAIL because snapshot merge/persistence helpers do not exist.

- [ ] **Step 3: Implement snapshot helpers and persistence**

Add a shared helper that reads the current `context` row by `conversation_id`, sets `version` to the previous version plus one, merges bounded `source_refs`, and upserts `content_json`, `organization_id`, `conversation_id`, `case_id`, and `updated_at`. Never append full email/message bodies to logs; the snapshot may contain only the fields intentionally returned by the broker.

Update the callback path in `webhooks/index.ts` so successful PE08 results:

1. Extract `response`, `context_refs`, and `coverage` from `output_data`.
2. Persist the new context snapshot.
3. Associate the generated assistant message with the returned `context_id` and `request_id`.
4. Preserve `pending_intent` only for clarification/orchestrator routes.
5. Reuse the callback idempotency check so duplicate callbacks cannot create duplicate messages or snapshots.

Add `context_id` and snapshot version to the callback metadata returned to the client/UI.

- [ ] **Step 4: Run snapshot and callback tests**

```bash
deno test --no-check "supabase/functions/_shared/context-snapshot.test.ts"
npm run typecheck
```

Expected: snapshot tests pass and TypeScript remains clean.

- [ ] **Step 5: Commit snapshot persistence**

```bash
git add supabase/functions/_shared/integration.ts supabase/functions/webhooks/index.ts supabase/functions/conversation-context/index.ts supabase/functions/_shared/context-snapshot.test.ts
 git commit -m "feat: persist PE08 context snapshots"
```

---

### Task 4: Update assistant and PE08 conversational envelopes

**Files:**
- Modify: `supabase/functions/assistant/index.ts`
- Modify: `supabase/functions/_shared/integration.ts`
- Modify: `supabase/functions/_shared/validation.ts`
- Modify: `flujos/PE08.json`
- Modify: `scripts/fixtures/n8n-sam-workflows.json`
- Create: `supabase/functions/assistant/index.test.ts`

- [ ] **Step 1: Write failing envelope tests**

Test that a PE08 input includes the conversation identity and broker request metadata:

```ts
Deno.test("buildAssistantEnvelope includes the PE08 context request", () => {
  const envelope = buildAssistantEnvelope({
    content: "Busca el último correo del caso",
    organizationId: ORG_ID,
    userId: USER_ID,
    conversationId: CONVERSATION_ID,
    caseId: CASE_ID,
    requestId: REQUEST_ID,
  });
  if (envelope.workflow_code !== "PE08") throw new Error("wrong workflow");
  if (envelope.input_data?.context_request?.conversation_id !== CONVERSATION_ID) {
    throw new Error("conversation was not propagated");
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

```bash
deno test --no-check "supabase/functions/assistant/index.test.ts"
```

Expected: FAIL because the envelope builder is not extracted or does not include the required fields.

- [ ] **Step 3: Extract and implement the assistant envelope builder**

Create a pure `buildAssistantEnvelope` helper used by the handler. Preserve the existing activity timer fields and add:

```ts
input_data: {
  source_channel: "dashboard",
  content,
  context_url: conversationContextUrl(),
  context_request: {
    operation: "get_context_snapshot",
    organization_id: organizationId,
    conversation_id: conversationId,
    case_id: caseId,
    request_id: requestId,
    parameters: {},
  },
  context_contract_version: "conversation-context.v2",
}
```

Do not put service-role credentials or complete database rows into the assistant request.

- [ ] **Step 4: Replace the PE08 executable path**

Update `flujos/PE08.json` so the connected nodes execute this order:

```text
Webhook Trigger
  → Validate conversational PE08 envelope
  → POST conversation-context get_context_snapshot
  → Normalize context and expose bounded tool definitions
  → Invoke the existing configured AI/orchestrator model
  → If tool call: POST conversation-context operation and loop with max 5 calls
  → If action request: POST the orchestration bridge with structured workflow_calls
  → Validate conversational PE08 result
  → POST callback to webhooks
```

The validation code must reject malformed `action_requests`, unknown broker operations, more than five context calls, more than three actions, and successful results missing `response` or `coverage`. Preserve `external_effects` and `network_access` semantics; PE08 itself must not claim a domain mutation occurred until the callback reports the action result.

Update the fixture JSON with the same node names, URLs, and connection order. The PE08 workflow must use the deployed `PROLOGISTICA_EDGE_FUNCTION_URL` and the existing ingress/callback secret mechanism, not localhost URLs.

- [ ] **Step 5: Run workflow fixture verification**

```bash
npm run verify:n8n-sam
npm run typecheck
```

Expected: the workflow verifier accepts the updated fixture and TypeScript remains clean.

- [ ] **Step 6: Commit the conversational envelope and workflow**

```bash
git add supabase/functions/assistant/index.ts supabase/functions/_shared/integration.ts supabase/functions/_shared/validation.ts supabase/functions/assistant/index.test.ts flujos/PE08.json scripts/fixtures/n8n-sam-workflows.json
git commit -m "feat: make PE08 conversational and context aware"
```

---

### Task 5: Route action requests through the existing orchestrator safely

**Files:**
- Modify: `supabase/functions/workflow-bridge/index.ts`
- Modify: `supabase/functions/actions/index.ts` only where validation must accept PE08-originated structured actions
- Modify: `supabase/functions/_shared/validation.ts`
- Modify: `supabase/functions/webhooks/index.ts`
- Create: `supabase/functions/workflow-bridge/index.test.ts`

- [ ] **Step 1: Write failing action-routing tests**

Cover these cases:

```ts
Deno.test("PE08 action request maps to an existing operational workflow", () => {
  const call = normalizePe08ActionRequest({
    action_type: "create_email_draft",
    input_data: { email_id: EMAIL_ID, instructions: "Responder" },
  });
  if (call.workflow_code !== "PE03") throw new Error("draft was not routed to PE03");
});

Deno.test("unknown PE08 actions are rejected before dispatch", () => {
  assertThrows(() => normalizePe08ActionRequest({ action_type: "delete_everything", input_data: {} }), "ACTION_NOT_ALLOWED");
});
```

Also test that `send_email`, `delegate_case`, `verify_case`, `resolve_case`, and `close_case` retain the current authorization path rather than being marked successful by PE08 itself.

- [ ] **Step 2: Run focused tests and verify they fail**

```bash
deno test --no-check "supabase/functions/workflow-bridge/index.test.ts"
```

Expected: FAIL because structured PE08 action normalization is not implemented.

- [ ] **Step 3: Implement an explicit PE08 action allowlist and mapping**

Use a fixed mapping consistent with `actions/index.ts`:

```ts
const pe08WorkflowByAction = {
  create_email_draft: "PE03",
  approve_email: "PE07",
  reject_approval: "PE07",
  send_email: "PE07",
  delegate_case: "PE04",
  schedule_follow_up: "PE06",
  verify_case: "PE12",
  resolve_case: "PE12",
  close_case: "PE12",
} as const;
```

Validate required fields per action before dispatch. Include the parent PE08 execution, conversation, case, organization, tool call, and idempotency key in the child payload. Do not add PE08 as an unrestricted generic destination; only the normalized allowlist may dispatch.

Keep authority decisions and approvals in `actions/index.ts`. If an action requires approval, return the existing pending shape and let `webhooks` expose that state to the conversation.

- [ ] **Step 4: Handle action callback results in the conversation**

Extend the PE08 callback handling to distinguish:

- `completed`: report the completed action and persist its output reference.
- `requires_approval`: report the approval requirement with `action_id` and `decision_id`.
- `failed`: report a bounded error and retain the action reference for retry/follow-up.
- duplicate callback: return the existing result without adding another assistant message.

- [ ] **Step 5: Run the focused tests and repository checks**

```bash
deno test --no-check "supabase/functions/workflow-bridge/index.test.ts"
npm run lint
npm run typecheck
```

Expected: focused tests pass, lint reports no new errors, and typecheck exits successfully.

- [ ] **Step 6: Commit the action routing**

```bash
git add supabase/functions/workflow-bridge/index.ts supabase/functions/actions/index.ts supabase/functions/_shared/validation.ts supabase/functions/webhooks/index.ts supabase/functions/workflow-bridge/index.test.ts
git commit -m "feat: route PE08 actions through authority workflows"
```

---

### Task 6: Add end-to-end broker, security, and idempotency verification

**Files:**
- Create: `supabase/functions/conversation-context/integration.test.ts`
- Create: `supabase/functions/webhooks/pe08-callback.test.ts`
- Modify: `scripts/verify-n8n-sam-workflows.mjs` only if the verifier needs a named PE08 contract assertion
- Modify: `README.md` with the exact local verification commands and broker contract if documentation is currently missing them

- [ ] **Step 1: Add integration test fixtures**

Create deterministic organization A/B fixtures with:

- Two organizations.
- One conversation and case per organization.
- Messages, emails, one draft, one delegation, and one follow-up per case.
- One PE08 execution per conversation.

Use generated UUIDs in the test setup and clean up only rows created by the test using their organization IDs; do not truncate shared tables.

- [ ] **Step 2: Add cross-organization and source-boundary tests**

The test suite must prove:

```ts
Deno.test("broker never returns organization B data to organization A", async () => {
  const result = await brokerRequest({ organization_id: ORG_A, conversation_id: CONVERSATION_A, operation: "search_emails", parameters: { query: "shared" } });
  if (result.emails.some((email) => email.organization_id === ORG_B)) {
    throw new Error("cross-organization data leak");
  }
});
```

Also verify that an email from another case, an unrelated draft, and an unrelated follow-up do not appear in the current case snapshot.

- [ ] **Step 3: Add callback idempotency tests**

Send the same PE08 success callback twice with the same `idempotency_key`. Assert that:

- `workflow_events` has one event.
- One assistant message is persisted.
- One context version is created.
- The second response reports `duplicate: true` or the repository’s existing equivalent.

- [ ] **Step 4: Run all available verification**

Run:

```bash
deno test --no-check "supabase/functions/_shared/context-broker.test.ts" "supabase/functions/_shared/context-snapshot.test.ts" "supabase/functions/conversation-context/index.test.ts" "supabase/functions/conversation-context/integration.test.ts" "supabase/functions/assistant/index.test.ts" "supabase/functions/workflow-bridge/index.test.ts" "supabase/functions/webhooks/pe08-callback.test.ts"
npm run verify:n8n-sam
npm run lint
npm run typecheck
npm run build
```

Expected: all focused tests pass, the n8n fixture verifier passes, lint/typecheck/build pass, and no unrelated working-tree files are staged.

- [ ] **Step 5: Review the final diff and commit tests**

```bash
git status --short
git diff --check
git diff HEAD~1 --stat
git add supabase/functions/conversation-context/integration.test.ts supabase/functions/webhooks/pe08-callback.test.ts scripts/verify-n8n-sam-workflows.mjs README.md
git commit -m "test: verify PE08 context and action boundaries"
```

Do not stage existing user modifications or unrelated untracked files.

---

## Final implementation review

Before declaring the feature complete, verify every approved design requirement:

- Context Broker supports the snapshot and all eight typed on-demand read operations.
- All reads are organization-scoped and bounded.
- PE08 has a conversational envelope and bounded tool loop.
- Context snapshots are versioned and linked to assistant messages.
- Action requests use the existing orchestrator and authority boundary.
- Approval-required actions cannot be marked successful by PE08 alone.
- Partial context and source failures are explicit in `coverage`.
- Duplicate callbacks do not duplicate messages, actions, or snapshots.
- The old mock fixture remains available for compatibility but is not PE08’s primary execution path.
- `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run verify:n8n-sam` pass.
