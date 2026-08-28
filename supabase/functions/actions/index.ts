declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, createExecution } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";
import { actionInputSchema } from "../_shared/validation.ts";

const targetWorkflowByAction: Record<string, string> = {
  approve_email: "PE07",
  reject_approval: "PE07",
  delegate_case: "PE04",
  send_email: "PE07",
  schedule_follow_up: "PE06",
  resolve_case: "PE12",
  verify_case: "PE12",
  close_case: "PE12",
};

const privilegedActions = new Set(["close_case", "resolve_case", "verify_case"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    const { data: allowed } = await client.rpc("check_rate_limit", {
      p_key: `actions:${user.id}`,
      p_limit: 60,
      p_window_seconds: 60,
    });

    if (!allowed) {
      return Response.json(
        { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
        { status: 429, headers: corsHeaders },
      );
    }

    const parsed = actionInputSchema.safeParse({
      ...body,
      idempotency_key: req.headers.get("idempotency-key") || body.idempotency_key,
    });
    if (!parsed.success) return Response.json({ error: "Los datos de la acción no son válidos." }, { status: 422, headers: corsHeaders });

    const actionType = parsed.data.action_type;
    const decisionWorkflowCode = actionType === "schedule_follow_up" ? "PE06" : "PE02";
    if (privilegedActions.has(actionType)) {
      const { data: profile } = await client.from("users").select("organization_id,role").eq("id", user.id).single();
      if (!profile || !["owner", "admin", "manager"].includes(profile.role)) return Response.json({ error: "No tienes permisos para esta acción." }, { status: 403, headers: corsHeaders });
    }

    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });

    if (body.case_id) {
      const { data: caseRecord } = await client.from("cases").select("id,organization_id").eq("id", body.case_id).maybeSingle();
      if (!caseRecord || caseRecord.organization_id !== profile.organization_id) return Response.json({ error: "El caso no existe o no pertenece a tu organización." }, { status: 404, headers: corsHeaders });
    }

    const idempotencyKey = parsed.data.idempotency_key;
    const { data: existing } = await client.from("actions").select("id,status,action_type").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return Response.json({ action: existing, idempotent: true }, { headers: corsHeaders });

    const { data: action, error: actionError } = await client.from("actions").insert({
      organization_id: profile.organization_id,
      case_id: body.case_id || null,
      conversation_id: body.conversation_id || null,
      message_id: body.message_id || null,
      action_type: actionType,
      requested_by: user.id,
      workflow_name: "PE02",
      input_data: { ...body.input_data, target_workflow_code: targetWorkflowByAction[actionType] || body.workflow_code || null },
      idempotency_key: idempotencyKey,
    }).select("id,status,action_type,created_at").single();
    if (actionError) throw actionError;

    const admin = adminClient();
    const executionId = await createExecution(admin, {
      event_type: "authority_requested",
      workflow_code: decisionWorkflowCode,
      request_id: crypto.randomUUID(),
      correlation_id: body.conversation_id || action.id,
      idempotency_key: `${idempotencyKey}:pe02`,
      organization_id: profile.organization_id,
      user_id: user.id,
      case_id: body.case_id || null,
      conversation_id: body.conversation_id || null,
      source_message_id: body.message_id || null,
      action_id: action.id,
      input_data: {
        action_type: actionType,
        target_workflow_code: targetWorkflowByAction[actionType] || body.workflow_code || null,
        payload: body.input_data || {},
      },
    });

    try {
      const result = await triggerWorkflow({
        action_id: action.id,
        approval_id: body.approval_id || undefined,
        requested_by: user.id,
        organization_id: profile.organization_id,
        case_id: body.case_id || null,
        action_type: actionType,
        workflow_code: decisionWorkflowCode,
        workflow_execution_id: executionId,
        input_data: { action_type: actionType, target_workflow_code: targetWorkflowByAction[actionType] || body.workflow_code || null, payload: body.input_data || {} },
      });
      await admin.from("actions").update({ status: "queued" }).eq("id", action.id);
      return Response.json({ action: { ...action, status: "queued" }, workflow_execution_id: executionId, n8n: result }, { status: 202, headers: corsHeaders });
    } catch (error) {
      await admin.from("workflow_executions").update({ status: "failed", error_data: { code: error instanceof Error ? error.message : "WORKFLOW_FAILED" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      await admin.from("actions").update({ status: "failed", error_data: { code: "WORKFLOW_FAILED" }, completed_at: new Date().toISOString() }).eq("id", action.id);
      return Response.json({ action: { ...action, status: "failed" }, workflow_execution_id: executionId, error: "No se pudo iniciar PE02" }, { status: 503, headers: corsHeaders });
    }
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo crear la acción" }, { status, headers: corsHeaders });
  }
});
