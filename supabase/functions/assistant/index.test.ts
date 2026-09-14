import { buildAssistantEnvelope } from "./index.ts";

const organizationId = "00000000-0000-4000-8000-000000000001";
const conversationId = "00000000-0000-4000-8000-000000000002";
const caseId = "00000000-0000-4000-8000-000000000003";
const userId = "00000000-0000-4000-8000-000000000004";
const requestId = "00000000-0000-4000-8000-000000000005";
const timerId = "00000000-0000-4000-8000-000000000006";
const deadline = "2026-09-15T12:02:00.000Z";
const lastActivityAt = "2026-09-15T12:00:00.000Z";

Deno.test("buildAssistantEnvelope includes the PE08 context request and activity timer", () => {
  const envelope = buildAssistantEnvelope({
    content: "Busca el último correo del caso",
    organizationId,
    userId,
    conversationId,
    caseId,
    requestId,
    activity: {
      timer_id: timerId,
      generation: 3,
      deadline,
      last_activity_at: lastActivityAt,
    },
  });

  if (envelope.workflow_code !== "PE08") throw new Error("wrong workflow");
  if (envelope.request_id !== requestId) throw new Error("request was not propagated");
  if (envelope.correlation_id !== conversationId) throw new Error("correlation was not propagated");
  if (envelope.organization_id !== organizationId) throw new Error("organization was not propagated");
  if (envelope.conversation_id !== conversationId) throw new Error("conversation was not propagated");
  if (envelope.case_id !== caseId) throw new Error("case was not propagated");

  const contextRequest = envelope.input_data.context_request;
  if (envelope.input_data.context_contract_version !== "conversation-context.v2") {
    throw new Error("wrong context contract version");
  }
  if (contextRequest.operation !== "get_context_snapshot") {
    throw new Error("wrong context operation");
  }
  if (contextRequest.organization_id !== organizationId) {
    throw new Error("context organization was not propagated");
  }
  if (contextRequest.conversation_id !== conversationId) {
    throw new Error("context conversation was not propagated");
  }
  if (contextRequest.case_id !== caseId) throw new Error("context case was not propagated");
  if (contextRequest.request_id !== requestId) throw new Error("context request was not propagated");

  if (envelope.input_data.inactivity_timer_id !== timerId) throw new Error("timer was not preserved");
  if (envelope.input_data.inactivity_generation !== 3) throw new Error("generation was not preserved");
  if (envelope.input_data.inactivity_deadline_at !== deadline) throw new Error("deadline was not preserved");
  if (envelope.input_data.last_activity_at !== lastActivityAt) {
    throw new Error("last activity timestamp was not preserved");
  }
});
