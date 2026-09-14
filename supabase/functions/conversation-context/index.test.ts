import {
  executeContextBroker,
  resolveConversationScope,
  type QueryAdapter,
} from "./index.ts";
import type { ContextBrokerRequest } from "../_shared/context-broker.ts";

const ORG = "00000000-0000-4000-8000-000000000001";
const CONVERSATION = "00000000-0000-4000-8000-000000000002";
const CASE_A = "00000000-0000-4000-8000-000000000003";
const CASE_B = "00000000-0000-4000-8000-000000000004";
const REQUEST = "00000000-0000-4000-8000-000000000005";

function request(operation: ContextBrokerRequest["operation"], parameters: Record<string, unknown> = {}) {
  return { operation, organization_id: ORG, conversation_id: CONVERSATION, case_id: CASE_A, request_id: REQUEST, parameters } as ContextBrokerRequest;
}

function fakeAdapter(options: { fail?: string; conversationCaseId?: string | null; count?: number } = {}): QueryAdapter {
  return {
    async query(source) {
      if (source === options.fail) return { data: null, error: new Error("source unavailable") };
      if (source === "conversations") return { data: [{ id: CONVERSATION, organization_id: ORG, case_id: options.conversationCaseId === undefined ? CASE_A : options.conversationCaseId }] };
      return { data: Array.from({ length: options.count || 0 }, (_, index) => ({ id: `row-${index}` })) };
    },
  };
}

Deno.test("list_email_drafts uses the email_drafts body column", async () => {
  let select = "";
  const adapter: QueryAdapter = {
    async query(source, spec) {
      if (source === "conversations") return { data: [{ id: CONVERSATION, organization_id: ORG, case_id: CASE_A }] };
      if (source === "email_drafts") {
        select = spec.select;
        return { data: [{ id: "draft-1", body: "Draft body" }] };
      }
      return { data: [] };
    },
  };
  const result = await executeContextBroker(adapter, request("list_email_drafts"));
  if (!select.includes(",body,")) throw new Error(`expected email_drafts.body in select, got ${select}`);
  if ((result.data as Array<{ body: string }>)[0]?.body !== "Draft body") throw new Error("expected draft data");
});

Deno.test("get_context_snapshot returns partial coverage when an optional source fails", async () => {
  const result = await executeContextBroker(fakeAdapter({ fail: "email_drafts" }), request("get_context_snapshot"));
  if (result.coverage.status !== "PARTIAL" || !result.coverage.missing_sources.includes("email_drafts")) throw new Error("expected missing email draft coverage");
});

Deno.test("get_context_snapshot exposes related emails and source values directly", async () => {
  const queried: Array<{ source: string; filters: unknown }> = [];
  const adapter: QueryAdapter = {
    async query(source, spec) {
      queried.push({ source, filters: spec.filters });
      if (source === "conversations") return { data: [{ id: CONVERSATION, organization_id: ORG, case_id: CASE_A }] };
      if (source === "emails") return { data: [{ id: "email-1", case_id: CASE_A, subject: "Related" }] };
      return { data: [] };
    },
  };
  const result = await executeContextBroker(adapter, request("get_context_snapshot"));
  const snapshot = result.data as { emails: Array<{ id: string }>; email_drafts: unknown[] };
  if (snapshot.emails[0]?.id !== "email-1") throw new Error("expected related email in snapshot");
  if (!Array.isArray(snapshot.email_drafts)) throw new Error("expected direct email_drafts source value");
  if (!result.coverage.loaded_sources.includes("emails")) throw new Error("expected emails in loaded coverage");
  const emailQuery = queried.find((item) => item.source === "emails");
  const filters = emailQuery?.filters as Array<[string, string, unknown]> | undefined;
  if (!filters?.some(([column, operator, value]) => column === "organization_id" && operator === "eq" && value === ORG) || !filters.some(([column, operator, value]) => column === "case_id" && operator === "eq" && value === CASE_A)) {
    throw new Error("expected organization and case filters for related emails");
  }
});

Deno.test("broker rejects a case that does not belong to the conversation", async () => {
  await (async () => {
    try {
      await resolveConversationScope(fakeAdapter({ conversationCaseId: CASE_B }), request("get_context_snapshot"));
      throw new Error("expected scope mismatch");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("CONVERSATION_CASE_MISMATCH")) throw error;
    }
  })();
});

Deno.test("bounded source result reports truncation", async () => {
  const result = await executeContextBroker(fakeAdapter({ count: 40 }), request("search_messages", { limit: 40 }));
  if (!result.coverage.truncated) throw new Error("expected truncated result");
});
