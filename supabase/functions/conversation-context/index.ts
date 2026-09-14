declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare global {
  interface ImportMeta {
    readonly main?: boolean;
  }
}

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../_shared/cors.ts";
import {
  contextBrokerRequestSchema,
  normalizeLimit,
  type ContextBrokerRequest,
} from "../_shared/context-broker.ts";

export type QuerySpec = {
  select: string;
  filters?: Array<[string, "eq" | "ilike" | "gte" | "lte", unknown]>;
  order?: Array<[string, boolean]>;
  limit?: number;
};

export type QueryAdapter = {
  query(source: string, spec: QuerySpec): Promise<{ data: unknown[] | unknown | null; error?: unknown }>;
};

export class BrokerError extends Error {
  constructor(public code: string, public source: string, public retryable = false, message = code) {
    super(message);
    this.name = "BrokerError";
  }
}

type Conversation = { id: string; organization_id: string; case_id: string | null } & Record<string, unknown>;

const MAX = {
  messages: 40, emails: 40, drafts: 20, delegations: 20, follow_ups: 20, actions: 30,
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data as Record<string, unknown>[] : data ? [data as Record<string, unknown>] : [];
}

async function query(adapter: QueryAdapter, source: string, spec: QuerySpec) {
  const result = await adapter.query(source, spec);
  if (result.error) throw new BrokerError("SOURCE_QUERY_FAILED", source, true);
  return rows(result.data);
}

export async function resolveConversationScope(adapter: QueryAdapter, request: ContextBrokerRequest) {
  const found = await query(adapter, "conversations", {
    select: "id,organization_id,case_id,title,conversation_type,status,context,updated_at,created_at",
    filters: [["id", "eq", request.conversation_id], ["organization_id", "eq", request.organization_id]],
    limit: 1,
  });
  const conversation = found[0] as Conversation | undefined;
  if (!conversation) throw new BrokerError("CONVERSATION_NOT_FOUND", "conversations", false);
  if (request.case_id && conversation.case_id !== request.case_id) {
    throw new BrokerError("CONVERSATION_CASE_MISMATCH", "conversations", false);
  }
  return conversation;
}

function result(data: unknown, count: number, cap: number, source: string, refs: unknown[] = []) {
  return {
    data,
    refs,
    coverage: {
      status: count >= cap ? "PARTIAL" : "COMPLETE",
      missing_sources: [],
      truncated: count >= cap,
      truncated_sources: count >= cap ? [source] : [],
      loaded_sources: [source],
      sources: [source],
    },
  };
}

function emptyResult(source: string) {
  return result([], 0, 1, source);
}

const EMAIL_DRAFT_SELECT = "id,organization_id,case_id,conversation_id,email_id,status,subject,body,metadata,created_at,updated_at";
const EMAIL_SELECT = "id,organization_id,thread_id,case_id,direction,evaluation,sender,recipients,subject,body_text,received_at,sent_at,created_at,metadata";
const CASE_SELECT = "id,organization_id,case_number,title,description,status,priority,assigned_to,department_id,metadata,created_at,updated_at,resolved_at,closed_at";
const ACTION_SELECT = "id,organization_id,case_id,conversation_id,action_type,status,input_data,output_data,error_data,created_at,started_at,completed_at";

function draftFilters(request: ContextBrokerRequest, conversation: Conversation, caseId?: string | null): QuerySpec["filters"] {
  return [
    ["organization_id", "eq", request.organization_id],
    ["conversation_id", "eq", conversation.id],
    ...(caseId ? [["case_id", "eq", caseId] as [string, "eq", unknown]] : []),
  ];
}

async function loadRelatedDrafts(adapter: QueryAdapter, request: ContextBrokerRequest, conversation: Conversation, limit: number) {
  const byConversation = await query(adapter, "email_drafts", {
    select: EMAIL_DRAFT_SELECT,
    filters: draftFilters(request, conversation),
    order: [["created_at", false], ["id", false]],
    limit,
  });
  const byCase = conversation.case_id
    ? await query(adapter, "email_drafts", {
      select: EMAIL_DRAFT_SELECT,
      filters: [["organization_id", "eq", request.organization_id], ["case_id", "eq", conversation.case_id]],
      order: [["created_at", false], ["id", false]],
      limit,
    })
    : [];
  const merged = [...byConversation, ...byCase].filter((draft, index, all) => all.findIndex((candidate) => candidate.id === draft.id) === index).slice(0, limit);
  return result(merged, merged.length, limit, "email_drafts");
}

async function loadMessages(adapter: QueryAdapter, request: ContextBrokerRequest) {
  const p = request.parameters as Record<string, unknown>;
  const limit = normalizeLimit(p.limit, MAX.messages);
  const filters: QuerySpec["filters"] = [["conversation_id", "eq", request.conversation_id]];
  if (p.sender_type) filters.push(["sender_type", "eq", p.sender_type]);
  if (p.role) filters.push(["role", "eq", p.role]);
  if (p.channel) filters.push(["channel", "eq", p.channel]);
  if (p.from) filters.push(["created_at", "gte", p.from]);
  if (p.to) filters.push(["created_at", "lte", p.to]);
  if (p.query) filters.push(["content", "ilike", `%${escapeLike(String(p.query))}%`]);
  const data = await query(adapter, "messages", { select: "id,conversation_id,user_id,sender_type,role,channel,content,content_json,metadata,created_at", filters, order: [["created_at", false], ["id", false]], limit });
  return result(data.reverse(), data.length, limit, "messages");
}

async function loadEmails(adapter: QueryAdapter, request: ContextBrokerRequest) {
  const p = request.parameters as Record<string, unknown>; const limit = normalizeLimit(p.limit, MAX.emails);
  const filters: QuerySpec["filters"] = [["organization_id", "eq", request.organization_id]];
  if (request.case_id) filters.push(["case_id", "eq", request.case_id]);
  if (p.status) filters.push(["evaluation", "eq", p.status]);
  if (p.direction) filters.push(["direction", "eq", p.direction]);
  if (p.from) filters.push(["created_at", "gte", p.from]);
  if (p.to) filters.push(["created_at", "lte", p.to]);
  if (p.query) filters.push(["subject", "ilike", `%${escapeLike(String(p.query))}%`]);
  const data = await query(adapter, "emails", { select: EMAIL_SELECT, filters, order: [["created_at", false], ["id", false]], limit });
  return result(data, data.length, limit, "emails");
}

async function loadThread(adapter: QueryAdapter, request: ContextBrokerRequest) {
  const p = request.parameters as Record<string, unknown>; const limit = normalizeLimit(p.limit, MAX.emails);
  const target = p.email_id ? await query(adapter, "emails", { select: "id,organization_id,thread_id,case_id", filters: [["id", "eq", p.email_id], ["organization_id", "eq", request.organization_id]], limit: 1 }) : [];
  const threadId = p.thread_id || target[0]?.thread_id;
  if (!threadId) throw new BrokerError("EMAIL_NOT_FOUND", "emails", false);
  const filters: QuerySpec["filters"] = [["organization_id", "eq", request.organization_id], ["thread_id", "eq", threadId]];
  if (request.case_id) filters.push(["case_id", "eq", request.case_id]);
  const data = await query(adapter, "emails", { select: EMAIL_SELECT, filters, order: [["received_at", true], ["id", true]], limit });
  return result(data, data.length, limit, "emails");
}

async function loadSource(adapter: QueryAdapter, source: string, select: string, filters: QuerySpec["filters"], limit: number, order: Array<[string, boolean]> = [["created_at", false], ["id", false]], bounded = true) {
  const data = await query(adapter, source, { select, filters, order, limit });
  return result(data, bounded ? data.length : 0, limit, source);
}

export async function executeContextBroker(adapter: QueryAdapter, request: ContextBrokerRequest, conversation?: Conversation) {
  const scope = conversation || await resolveConversationScope(adapter, request);
  const p = request.parameters as Record<string, unknown>;
  const requestedCaseId = typeof p.case_id === "string" ? p.case_id : null;
  if (requestedCaseId && requestedCaseId !== scope.case_id) {
    throw new BrokerError("CONVERSATION_CASE_MISMATCH", "conversations", false);
  }
  if (typeof p.conversation_id === "string" && p.conversation_id !== scope.id) {
    throw new BrokerError("CONVERSATION_SCOPE_MISMATCH", "conversations", false);
  }
  switch (request.operation) {
    case "search_messages": return loadMessages(adapter, request);
    case "search_emails": return loadEmails(adapter, request);
    case "get_email_thread": return loadThread(adapter, request);
    case "list_email_drafts": {
      const draftFilters: QuerySpec["filters"] = [["organization_id", "eq", request.organization_id]];
      if (p.case_id || request.case_id) draftFilters.push(["case_id", "eq", p.case_id || request.case_id]);
      if (p.conversation_id) draftFilters.push(["conversation_id", "eq", p.conversation_id]);
      if (!p.case_id && !request.case_id && !p.conversation_id) draftFilters.push(["conversation_id", "eq", scope.id]);
      if (p.status) draftFilters.push(["status", "eq", p.status]);
      return loadSource(adapter, "email_drafts", EMAIL_DRAFT_SELECT, draftFilters, normalizeLimit(p.limit, MAX.drafts));
    }
    case "list_case_delegations": return loadSource(adapter, "delegations", "id,organization_id,case_id,assigned_to,assigned_by,department_id,reason,status,metadata,created_at,completed_at", [["organization_id", "eq", request.organization_id], ["case_id", "eq", p.case_id || scope.case_id]], normalizeLimit(p.limit, MAX.delegations));
    case "list_case_followups": return loadSource(adapter, "follow_ups", "id,organization_id,case_id,scheduled_for,reason,status,attempt_count,metadata,created_at,completed_at", [["organization_id", "eq", request.organization_id], ["case_id", "eq", p.case_id || scope.case_id]], normalizeLimit(p.limit, MAX.follow_ups), [["scheduled_for", true], ["id", true]]);
    case "get_case_context": {
      const caseId = p.case_id || scope.case_id;
      if (!caseId) return { data: null, refs: [], coverage: { status: "COMPLETE", missing_sources: [], truncated: false, sources: [] } };
      return loadSource(adapter, "cases", "id,organization_id,case_number,title,description,status,priority,assigned_to,department_id,metadata,created_at,updated_at,resolved_at,closed_at", [["organization_id", "eq", request.organization_id], ["id", "eq", caseId]], 1, [["created_at", false], ["id", false]], false);
    }
    case "get_related_activity": return loadSource(adapter, "actions", "id,organization_id,case_id,conversation_id,action_type,status,input_data,output_data,error_data,created_at,started_at,completed_at", [["organization_id", "eq", request.organization_id], ...(scope.case_id || p.case_id ? [["case_id", "eq", p.case_id || scope.case_id] as [string, "eq", unknown]] : []), ...(p.conversation_id || request.conversation_id ? [["conversation_id", "eq", p.conversation_id || request.conversation_id] as [string, "eq", unknown]] : [])], normalizeLimit(p.limit, MAX.actions));
    case "get_context_snapshot": {
      const limit = normalizeLimit(p.limit, 40);
      const sources = ["messages", "context", "case", "emails", "email_drafts", "delegations", "follow_ups", "actions"];
      const loaders: Array<[string, Promise<unknown>]> = [
        ["messages", loadSource(adapter, "messages", "id,conversation_id,user_id,sender_type,role,channel,content,content_json,metadata,created_at", [["conversation_id", "eq", request.conversation_id]], Math.min(limit, MAX.messages), [["created_at", false], ["id", false]])],
        ["context", loadSource(adapter, "context", "id,organization_id,conversation_id,case_id,context_type,content_json,version,created_at,updated_at", [["organization_id", "eq", request.organization_id], ["conversation_id", "eq", request.conversation_id]], 1, [["created_at", false], ["id", false]], false)],
        ["case", scope.case_id ? loadSource(adapter, "cases", CASE_SELECT, [["organization_id", "eq", request.organization_id], ["id", "eq", scope.case_id]], 1, [["created_at", false], ["id", false]], false) : Promise.resolve(emptyResult("case"))],
        ["emails", scope.case_id ? loadSource(adapter, "emails", EMAIL_SELECT, [["organization_id", "eq", request.organization_id], ["case_id", "eq", scope.case_id]], MAX.emails, [["created_at", false], ["id", false]]) : Promise.resolve(emptyResult("emails"))],
        ["email_drafts", loadRelatedDrafts(adapter, request, scope, MAX.drafts)],
        ["delegations", scope.case_id ? loadSource(adapter, "delegations", "id,organization_id,case_id,assigned_to,assigned_by,department_id,reason,status,metadata,created_at,completed_at", [["organization_id", "eq", request.organization_id], ["case_id", "eq", scope.case_id]], MAX.delegations) : Promise.resolve(emptyResult("delegations"))],
        ["follow_ups", scope.case_id ? loadSource(adapter, "follow_ups", "id,organization_id,case_id,scheduled_for,reason,status,attempt_count,metadata,created_at,completed_at", [["organization_id", "eq", request.organization_id], ["case_id", "eq", scope.case_id]], MAX.follow_ups) : Promise.resolve(emptyResult("follow_ups"))],
        ["actions", loadSource(adapter, "actions", ACTION_SELECT, [["organization_id", "eq", request.organization_id], ["conversation_id", "eq", request.conversation_id]], MAX.actions)],
      ];
      const settled = await Promise.allSettled(loaders.map(([, promise]) => promise));
      const output: Record<string, unknown> = { conversation: scope, messages: [], context: null, case: null, emails: [], email_drafts: [], delegations: [], follow_ups: [], actions: [] };
      const refs: unknown[] = [];
      const missing: string[] = [];
      const truncated: string[] = [];
      const loaded: string[] = [];
      settled.forEach((item, index) => {
        const source = sources[index];
        if (item.status === "rejected") {
          missing.push(source);
          return;
        }
        const sourceResult = item.value as { data: unknown; refs?: unknown[]; coverage: { truncated: boolean } };
        output[source] = source === "case" || source === "context" ? rows(sourceResult.data)[0] || null : sourceResult.data;
        refs.push(...(sourceResult.refs || []));
        loaded.push(source);
        if (sourceResult.coverage.truncated) truncated.push(source);
      });
      return {
        data: output,
        refs,
        coverage: {
          status: missing.length || truncated.length ? "PARTIAL" : "COMPLETE",
          sources,
          loaded_sources: loaded,
          missing_sources: missing,
          truncated: truncated.length > 0,
          truncated_sources: truncated,
        },
      };
    }
  }
}

function supabaseAdapter(client: ReturnType<typeof createClient>): QueryAdapter {
  return { async query(source, spec) {
    let builder = client.from(source).select(spec.select);
    for (const [column, operator, value] of spec.filters || []) builder = operator === "eq" ? builder.eq(column, value) : operator === "ilike" ? builder.ilike(column, value) : operator === "gte" ? builder.gte(column, value) : builder.lte(column, value);
    for (const [column, ascending] of spec.order || []) builder = builder.order(column, { ascending });
    if (spec.limit) builder = builder.limit(spec.limit);
    return builder;
  } };
}

export async function handleContextBroker(req: Request, adapter?: QueryAdapter): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const expectedSecret = Deno.env.get("N8N_INGRESS_SECRET");
  if (!expectedSecret || req.headers.get("x-prologistica-secret") !== expectedSecret) return Response.json({ error: { code: "UNAUTHORIZED", source: "request", retryable: false } }, { status: 401, headers: cors(req) });
  if (req.method !== "POST") return Response.json({ error: { code: "METHOD_NOT_ALLOWED", source: "request", retryable: false } }, { status: 405, headers: cors(req) });
  try {
    const parsed = contextBrokerRequestSchema.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: { code: "INVALID_CONTEXT_REQUEST", source: "request", retryable: false, details: parsed.error.flatten() } }, { status: 422, headers: cors(req) });
    const queryAdapter = adapter || supabaseAdapter(createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!));
    const response = await executeContextBroker(queryAdapter, parsed.data);
    return Response.json({ ...response, request_id: parsed.data.request_id }, { headers: { ...cors(req), "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: { code: "INVALID_CONTEXT_REQUEST", source: "request", retryable: false } }, { status: 422, headers: cors(req) });
    }
    const e = error instanceof BrokerError ? error : new BrokerError("BROKER_FAILURE", "broker", true);
    const status = e.code === "CONVERSATION_NOT_FOUND" ? 404 : ["CONVERSATION_CASE_MISMATCH", "CONVERSATION_SCOPE_MISMATCH"].includes(e.code) ? 422 : 500;
    return Response.json({ error: { code: e.code, source: e.source, retryable: e.retryable } }, { status, headers: cors(req) });
  }
}

if (import.meta.main) Deno.serve(handleContextBroker);
