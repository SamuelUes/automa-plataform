import {
  contextBrokerOperations,
  contextBrokerRequestSchema,
  normalizeLimit,
  parseContextBrokerRequest,
} from "./context-broker.ts";

const organizationId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";

Deno.test("parseContextBrokerRequest accepts a bounded snapshot request", () => {
  const parsed = parseContextBrokerRequest({
    operation: "get_context_snapshot",
    organization_id: organizationId,
    conversation_id: conversationId,
    case_id: null,
    request_id: requestId,
    parameters: {},
  });

  if (!parsed.success || parsed.data.operation !== "get_context_snapshot") {
    throw new Error("expected a valid snapshot request");
  }
});

Deno.test("context broker exposes exactly the approved operations", () => {
  const expected = [
    "get_context_snapshot",
    "search_emails",
    "get_email_thread",
    "search_messages",
    "list_email_drafts",
    "get_case_context",
    "list_case_delegations",
    "list_case_followups",
    "get_related_activity",
  ];

  if (JSON.stringify(contextBrokerOperations) !== JSON.stringify(expected)) {
    throw new Error("context broker operation catalog changed");
  }
});

Deno.test("parseContextBrokerRequest rejects arbitrary SQL, columns, and unknown operations", () => {
  const sqlRequest = parseContextBrokerRequest({
    operation: "execute_sql",
    organization_id: organizationId,
    conversation_id: conversationId,
    request_id: requestId,
    parameters: { sql: "select * from emails" },
  });
  const arbitraryColumnRequest = parseContextBrokerRequest({
    operation: "search_emails",
    organization_id: organizationId,
    conversation_id: conversationId,
    request_id: requestId,
    parameters: { query: "invoice", secret_column: "anything" },
  });

  if (sqlRequest.success || arbitraryColumnRequest.success) {
    throw new Error("arbitrary operations and parameter keys must be rejected");
  }
});

Deno.test("parseContextBrokerRequest rejects invalid UUIDs and malformed limits", () => {
  const invalidUuid = parseContextBrokerRequest({
    operation: "get_context_snapshot",
    organization_id: "not-a-uuid",
    conversation_id: conversationId,
    request_id: requestId,
    parameters: {},
  });
  const malformedLimit = parseContextBrokerRequest({
    operation: "search_messages",
    organization_id: organizationId,
    conversation_id: conversationId,
    request_id: requestId,
    parameters: { limit: "40" },
  });

  if (invalidUuid.success || malformedLimit.success) {
    throw new Error("invalid UUIDs and malformed limits must be rejected");
  }
});

Deno.test("contextBrokerRequestSchema rejects unknown top-level keys", () => {
  const parsed = contextBrokerRequestSchema.safeParse({
    operation: "get_context_snapshot",
    organization_id: organizationId,
    conversation_id: conversationId,
    request_id: requestId,
    parameters: {},
    table: "emails",
  });

  if (parsed.success) throw new Error("unknown top-level keys must be rejected");
});

Deno.test("normalizeLimit clamps requested limits to the broker maximum", () => {
  if (normalizeLimit(0, 40) !== 1) throw new Error("minimum limit failed");
  if (normalizeLimit(1000, 40) !== 40) throw new Error("maximum limit failed");
});
