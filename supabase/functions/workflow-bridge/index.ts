declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

import { cors } from "../_shared/cors.ts";
import { adminClient, createExecution, recordAssistantProgress } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";

const orchestrationWorkflowCodes = new Set([
  "PE01", "PE02", "PE03", "PE04", "PE05", "PE06", "PE07",
  "PE09", "PE10", "PE11", "PE12", "CREATOR01",
]);

export type OrchestrationCall = {
  workflow_code: string;
  input_data: Record<string, unknown>;
  tool_call_id?: string | null;
  action_type?: string | null;
  [key: string]: unknown;
};

export function normalizeOrchestrationCalls(value: unknown): OrchestrationCall[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("WORKFLOW_CALLS_REQUIRED");
  }

  return value.map((call, index) => {
    if (!call || typeof call !== "object" || Array.isArray(call)) {
      throw new Error(`MALFORMED_WORKFLOW_CALL_${index + 1}`);
    }

    const candidate = call as Record<string, unknown>;
    if (typeof candidate.workflow_code !== "string" || !orchestrationWorkflowCodes.has(candidate.workflow_code)) {
      throw new Error(`UNAUTHORIZED_WORKFLOW_CALL_${index + 1}`);
    }

    const inputData = candidate.input_data;
    if (!inputData || typeof inputData !== "object" || Array.isArray(inputData) || Object.keys(inputData).length === 0) {
      throw new Error(`MALFORMED_WORKFLOW_INPUT_${index + 1}`);
    }
    if (candidate.tool_call_id !== undefined && candidate.tool_call_id !== null && typeof candidate.tool_call_id !== "string") {
      throw new Error(`MALFORMED_WORKFLOW_CALL_${index + 1}`);
    }
    if (candidate.action_type !== undefined && candidate.action_type !== null && typeof candidate.action_type !== "string") {
      throw new Error(`MALFORMED_WORKFLOW_CALL_${index + 1}`);
    }

    return {
      ...candidate,
      workflow_code: candidate.workflow_code,
      input_data: { ...(inputData as Record<string, unknown>) },
      tool_call_id: candidate.tool_call_id as string | null | undefined,
      action_type: candidate.action_type as string | null | undefined,
    };
  });
}

const pe08WorkflowByAction: Record<string, string> = {
  create_email_draft: "PE03",
  approve_email: "PE07",
  reject_approval: "PE07",
  send_email: "PE07",
  delegate_case: "PE04",
  schedule_follow_up: "PE06",
  verify_case: "PE12",
  resolve_case: "PE12",
  close_case: "PE12",
};

export function normalizePe08ActionRequest(value: unknown): OrchestrationCall {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MALFORMED_ACTION_REQUEST");
  }
  const action = value as Record<string, unknown>;
  const workflowCode = typeof action.action_type === "string" ? pe08WorkflowByAction[action.action_type] : undefined;
  if (!workflowCode || !action.input_data || typeof action.input_data !== "object" || Array.isArray(action.input_data) || Object.keys(action.input_data).length === 0) {
    throw new Error("ACTION_NOT_ALLOWED");
  }
  return normalizeOrchestrationCalls([{
    workflow_code: workflowCode,
    input_data: action.input_data,
    tool_call_id: typeof action.tool_call_id === "string" ? action.tool_call_id : null,
    action_type: action.action_type,
  }])[0];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const secret = Deno.env.get("N8N_INGRESS_SECRET");
  if (!secret || req.headers.get("x-prologistica-secret") !== secret) 
    return Response.json({ error: "No autorizado" }, 
      { status: 401, headers: cors(req) });
  if (req.method !== "POST") 
    return Response.json({ error: "POST requerido" }, 
      { status: 405, headers: cors(req) });
  try {
    const body = await req.json();
    if (body.operation === "dispatch_orchestration") {
      const calls = Array.isArray(body.workflow_calls) ? body.workflow_calls : [];
      const parentRequestId = body.request_id || body.parent_workflow_execution_id;
      if (!body.organization_id ||
         !body.parent_workflow_execution_id || 
         !body.conversation_id || 
         !parentRequestId || 
         !calls.length) {
        return Response.json({ error: "Despacho de orquestación incompleto" }, 
          { status: 422, headers: cors(req) });
      }
      let normalizedCalls: OrchestrationCall[];
      try {
        normalizedCalls = normalizeOrchestrationCalls(calls);
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "WORKFLOW_CALLS_INVALID" },
          { status: 422, headers: cors(req) });
      }
      const admin = adminClient();
      if (body.input_data?.intent || body.input_data?.target_capability || body.input_data?.workflow_alias) {
        await admin.from("conversations").update({ pending_intent: {
          status: "executing",
          intent: body.input_data.intent || null,
          normalized_request: body.input_data.normalized_request || body.input_data.content || null,
          target_capability: body.input_data.target_capability || null,
          workflow_alias: body.input_data.workflow_alias || null,
          case_reference: body.input_data.case_reference || null,
          collected_fields: body.input_data.collected_fields || {},
          missing_fields: body.input_data.missing_fields || [],
          request_id: parentRequestId,
        } }).eq("id", body.conversation_id).eq("organization_id", body.organization_id);
      }
      await recordAssistantProgress(admin, {
        organization_id: body.organization_id,
        conversation_id: body.conversation_id,
        request_id: parentRequestId,
        workflow_execution_id: body.parent_workflow_execution_id,
        source_channel: body.source_channel || "dashboard",
        status: "orchestrator_selected",
        progress_order: 30,
      });
      const dispatched = [];
      const errors = [];
      for (const call of normalizedCalls) {
        await recordAssistantProgress(admin, {
          organization_id: body.organization_id,
          conversation_id: body.conversation_id,
          request_id: parentRequestId,
          workflow_execution_id: body.parent_workflow_execution_id,
          source_channel: body.source_channel || "dashboard",
          status: "workflow_selected",
          progress_order: 40,
          metadata: { workflow_code: call.workflow_code },
        });
        const requestId = crypto.randomUUID();
        const idempotencyKey = `orchestration:${body.parent_workflow_execution_id}:${call.workflow_code}`;
        const { data: existingExecution } = await admin.from("workflow_executions")
          .select("id,status,workflow_code")
          .eq("parent_workflow_execution_id", body.parent_workflow_execution_id)
          .eq("workflow_code", call.workflow_code)
          .in("status", ["running", "success"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existingExecution) {
          dispatched.push({ workflow_code: call.workflow_code, workflow_execution_id: existingExecution.id, duplicate: true });
          continue;
        }
        const childPayload = {
          event_type: "orchestrated_command",
          workflow_code: call.workflow_code,
          request_id: requestId,
          correlation_id: body.conversation_id || body.parent_workflow_execution_id,
          idempotency_key: idempotencyKey,
          organization_id: body.organization_id,
          user_id: body.user_id || null,
          case_id: body.case_id || null,
          conversation_id: body.conversation_id || null,
          parent_workflow_execution_id: body.parent_workflow_execution_id,
          orchestration_id: body.orchestration_id || body.parent_workflow_execution_id,
          tool_call_id: call.tool_call_id || null,
          source_channel: body.source_channel || "dashboard",
          input_data: { ...(body.input_data || {}), ...(call.input_data || {}), orchestration: { parent_workflow_execution_id: body.parent_workflow_execution_id } },
        };
        try {
          const executionId = await createExecution(admin, childPayload);
          await triggerWorkflow({ ...childPayload, workflow_execution_id: executionId, action_type: call.action_type || "orchestrated_command" });
          dispatched.push({ workflow_code: call.workflow_code, workflow_execution_id: executionId });
        } catch (error) {
          const message = error instanceof Error ? error.message : "CHILD_WORKFLOW_DISPATCH_FAILED";
          errors.push({ workflow_code: call.workflow_code, error: message });
          await admin.from("workflow_events").insert({
            organization_id: body.organization_id,
            workflow_execution_id: body.parent_workflow_execution_id,
            event_type: "orchestration.child_dispatch_failed",
            event_data: { workflow_code: call.workflow_code, error: message },
            idempotency_key: `${idempotencyKey}:failed`,
          });
        }
      }
      if (!dispatched.length && errors.length) 
        return Response.json({ success: false, status: "failed", dispatched, errors }, 
      { status: 502, headers: cors(req) });
      if (!dispatched.length) 
        return Response.json({ error: "No hay destinos operacionales autorizados" }, 
      { status: 422, headers: cors(req) });
      return Response.json({ success: errors.length === 0, status: errors.length ? "partial" : "dispatched", dispatched, errors }, 
      { headers: cors(req) });
    }
    if (!body.workflow_code || !body.workflow_execution_id || !body.organization_id) 
      return Response.json({ error: "Contrato incompleto" }, 
      { status: 422, headers: cors(req) });
      
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    if (!supabaseUrl || !callbackSecret) throw new Error("CALLBACK_NOT_CONFIGURED");
    const callback = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/webhooks`, { 
      method: "POST", 
      headers: { "content-type": "application/json", "x-n8n-webhook-secret": callbackSecret }, 
      body: JSON.stringify(body) 
    });
    const result = await callback.json().catch(() => ({}));
    return Response.json(result, { status: callback.ok ? 200 : callback.status, headers: cors(req) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el resultado" }, 
      { status: 500, headers: cors(req) });
  }
});
