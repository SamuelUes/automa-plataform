import { z } from "./validation.ts";

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

const uuid = z.string().uuid();
const optionalUuid = uuid.nullable().optional();
const boundedLimit = z.number().int().min(1).max(100).optional();
const cursor = z.string().trim().min(1).max(500).optional();
const date = z.string().trim().min(1).max(100).optional();
const status = z.string().trim().min(1).max(100).optional();

const commonRequestFields = {
  organization_id: uuid,
  conversation_id: uuid,
  case_id: optionalUuid,
  request_id: uuid,
};

const snapshotParameters = z.object({
  limit: boundedLimit,
}).strict();

const searchEmailParameters = z.object({
  query: z.string().trim().min(1).max(500).optional(),
  status,
  direction: z.enum(["inbound", "outbound"]).optional(),
  from: date,
  to: date,
  limit: boundedLimit,
  cursor,
}).strict();

const emailThreadParameters = z.object({
  email_id: uuid.optional(),
  thread_id: uuid.optional(),
  limit: boundedLimit,
  cursor,
}).strict().refine((value: { email_id?: string; thread_id?: string }) => value.email_id !== undefined || value.thread_id !== undefined, {
  message: "email_id or thread_id is required",
});

const searchMessageParameters = z.object({
  query: z.string().trim().min(1).max(500).optional(),
  sender_type: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().min(1).max(100).optional(),
  channel: z.string().trim().min(1).max(100).optional(),
  from: date,
  to: date,
  limit: boundedLimit,
  cursor,
}).strict();

const emailDraftParameters = z.object({
  status,
  case_id: uuid.optional(),
  conversation_id: uuid.optional(),
  limit: boundedLimit,
  cursor,
}).strict();

const caseContextParameters = z.object({
  case_id: uuid.optional(),
  limit: boundedLimit,
}).strict();

const caseListParameters = z.object({
  case_id: uuid.optional(),
  status,
  limit: boundedLimit,
  cursor,
}).strict();

const relatedActivityParameters = z.object({
  case_id: uuid.optional(),
  conversation_id: uuid.optional(),
  activity_type: z.string().trim().min(1).max(100).optional(),
  from: date,
  to: date,
  limit: boundedLimit,
  cursor,
}).strict();

type RequestFields = typeof commonRequestFields;

const requestSchema = <TOperation extends ContextBrokerOperation, TParameters extends z.ZodTypeAny>(
  operation: TOperation,
  parameters: TParameters,
) => z.object({
  ...commonRequestFields,
  operation: z.literal(operation),
  parameters,
}).strict();

export const contextBrokerRequestSchema = z.discriminatedUnion("operation", [
  requestSchema("get_context_snapshot", snapshotParameters),
  requestSchema("search_emails", searchEmailParameters),
  requestSchema("get_email_thread", emailThreadParameters),
  requestSchema("search_messages", searchMessageParameters),
  requestSchema("list_email_drafts", emailDraftParameters),
  requestSchema("get_case_context", caseContextParameters),
  requestSchema("list_case_delegations", caseListParameters),
  requestSchema("list_case_followups", caseListParameters),
  requestSchema("get_related_activity", relatedActivityParameters),
]);

export type ContextBrokerRequest = z.infer<typeof contextBrokerRequestSchema>;

export function parseContextBrokerRequest(input: unknown) {
  return contextBrokerRequestSchema.safeParse(input);
}

export function normalizeLimit(value: unknown, maximum: number): number {
  let numericValue: number;
  try {
    numericValue = Number(value);
  } catch {
    numericValue = Number.NaN;
  }

  const fallback = Number.isFinite(numericValue) && numericValue !== 0 ? numericValue : 20;
  const boundedMaximum = Math.max(Math.floor(Number(maximum) || 1), 1);
  return Math.min(Math.max(Math.floor(fallback), 1), boundedMaximum);
}

export type ContextBrokerRequestFields = RequestFields;
