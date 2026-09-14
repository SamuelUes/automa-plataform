import { normalizeOrchestrationCalls, normalizePe08ActionRequest } from "./index.ts";

function assertThrows(action: () => unknown, message: string) {
  try {
    action();
  } catch (error) {
    if (error instanceof Error && error.message === message) return;
    throw new Error(`expected ${message}`);
  }
  throw new Error(`expected ${message}`);
}

Deno.test("normalizeOrchestrationCalls accepts operational calls and preserves routing metadata", () => {
  const calls = normalizeOrchestrationCalls([{
    workflow_code: "PE03",
    input_data: { email_id: "email-1" },
    tool_call_id: "call-1",
    action_type: "create_email_draft",
  }]);

  if (calls[0].workflow_code !== "PE03") throw new Error("workflow was not preserved");
  if (calls[0].tool_call_id !== "call-1") throw new Error("tool_call_id was not preserved");
  if (calls[0].action_type !== "create_email_draft") throw new Error("action_type was not preserved");
});

Deno.test("normalizeOrchestrationCalls rejects unauthorized, malformed, and empty calls", () => {
  assertThrows(() => normalizeOrchestrationCalls([{
    workflow_code: "PE08",
    input_data: { content: "not a child workflow" },
  }]), "UNAUTHORIZED_WORKFLOW_CALL_1");
  assertThrows(() => normalizeOrchestrationCalls([{
    workflow_code: "PE03",
    input_data: {},
  }]), "MALFORMED_WORKFLOW_INPUT_1");
  assertThrows(() => normalizeOrchestrationCalls([null]), "MALFORMED_WORKFLOW_CALL_1");
});

Deno.test("PE08 action requests remain mapped to existing operational workflows", () => {
  const expected: Record<string, string> = {
    create_email_draft: "PE03",
    delegate_case: "PE04",
    schedule_follow_up: "PE06",
    send_email: "PE07",
    verify_case: "PE12",
  };

  for (const [action_type, workflow_code] of Object.entries(expected)) {
    const call = normalizePe08ActionRequest({ action_type, input_data: { reference: "value" } });
    if (call.workflow_code !== workflow_code) throw new Error(`${action_type} was not routed to ${workflow_code}`);
    if (call.action_type !== action_type) throw new Error(`${action_type} was not preserved`);
  }

  assertThrows(() => normalizePe08ActionRequest({ action_type: "delete_everything", input_data: { reference: "value" } }), "ACTION_NOT_ALLOWED");
});

Deno.test("PE08 sensitive action mapping does not authorize the action", () => {
  const call = normalizePe08ActionRequest({
    action_type: "send_email",
    input_data: { email_id: "email-1" },
    tool_call_id: "call-sensitive",
  });

  if (call.workflow_code !== "PE07" || call.action_type !== "send_email") {
    throw new Error("sensitive action was not routed through its operational workflow");
  }
  if (Object.prototype.hasOwnProperty.call(call, "authorized")) {
    throw new Error("normalization must not authorize sensitive actions");
  }
});
