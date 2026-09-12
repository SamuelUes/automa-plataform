declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, createCommand, createExecution } from "../_shared/integration.ts";
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
const sensitiveActions = new Set([
  "approve_email",
  "reject_approval",
  "send_email",
  "delegate_case",
  "resolve_case",
  "verify_case",
  "close_case",
]);

function evaluateAuthority(actionType: string, targetWorkflowCode: string, payload: Record<string, unknown>, approvalGranted = false) {
  const requiresApproval = !approvalGranted && (sensitiveActions.has(actionType) || actionType !== "schedule_follow_up");
  return {
    decision: requiresApproval ? "REQUIRES_APPROVAL" : "AUTHORIZED",
    action_type: actionType,
    target_workflow_code: targetWorkflowCode,
    authorized: !requiresApproval,
    requires_approval: requiresApproval,
    reason: requiresApproval
      ? "La acción requiere aprobación humana según la política de autoridad."
      : "La acción está permitida por la política de autoridad.",
    rule: requiresApproval ? "sensitive_action_policy" : "non_sensitive_action_policy",
    rule_version: "1",
    playbook_version: "1",
    evidence: [{ source: "supabase.functions.actions", action_type: actionType, target_workflow_code: targetWorkflowCode }],
    payload,
  };
}

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
    if (actionType === "schedule_follow_up" && !body.input_data?.follow_up_id && !body.input_data?.scheduled_for) {
      return Response.json({ error: "scheduled_for es obligatorio para crear un seguimiento" }, { status: 422, headers: corsHeaders });
    }
    const decisionWorkflowCode = targetWorkflowByAction[actionType] || (actionType === "schedule_follow_up" ? "PE06" : "PE02");
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
    const targetWorkflowCode = targetWorkflowByAction[actionType] || body.workflow_code || "PE02";
    let approvalGranted = false;
    if (body.approval_id) {
      const { data: approval } = await client.from("approvals").select("id,status,organization_id").eq("id", body.approval_id).eq("organization_id", profile.organization_id).maybeSingle();
      approvalGranted = approval?.status === "approved";
    }
    const authority = evaluateAuthority(actionType, targetWorkflowCode, body.input_data || {}, approvalGranted);
    const { data: decision, error: decisionError } = await admin.from("authority_decisions").insert({
      organization_id: profile.organization_id,
      action_id: action.id,
      case_id: body.case_id || null,
      conversation_id: body.conversation_id || null,
      decision: authority.decision,
      action_type: actionType,
      authorized: authority.authorized,
      requires_approval: authority.requires_approval,
      reason: authority.reason,
      rule: authority.rule,
      rule_version: authority.rule_version,
      playbook_version: authority.playbook_version,
      evidence: authority.evidence,
      correlation_id: body.conversation_id || action.id,
      idempotency_key: `${idempotencyKey}:decision`,
    }).select("id").single();
    if (decisionError) throw decisionError;
    await admin.from("actions").update({ decision_id: decision.id }).eq("id", action.id);

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

    if (authority.requires_approval) {
      await admin.from("actions").update({ status: "pending" }).eq("id", action.id);
      await admin.from("workflow_executions").update({
        status: "success",
        decision_id: decision.id,
        output_data: authority,
        finished_at: new Date().toISOString(),
      }).eq("id", executionId);
      await admin.from("workflow_events").insert({
        organization_id: profile.organization_id,
        workflow_execution_id: executionId,
        case_id: body.case_id || null,
        event_type: "authority.requires_approval",
        event_data: authority,
        idempotency_key: `${idempotencyKey}:authority`,
      });
      return Response.json({ action: { ...action, status: "pending" }, workflow_execution_id: executionId, authority }, { status: 202, headers: corsHeaders });
    }

    let domainOutput: Record<string, unknown> | null = null;
    if (actionType === "schedule_follow_up") {
      const followUpId = typeof body.input_data?.follow_up_id === "string" ? body.input_data.follow_up_id : null;
      const scheduledFor = typeof body.input_data?.scheduled_for === "string" ? body.input_data.scheduled_for : null;
      const reason = typeof body.input_data?.reason === "string" ? body.input_data.reason : null;
      const executeNow = body.input_data?.execute_now === true;
      if (followUpId) {
        const update = {
          ...(scheduledFor ? { scheduled_for: scheduledFor, status: "pending" } : {}),
          ...(reason ? { reason } : {}),
          ...(executeNow ? { last_attempt_at: new Date().toISOString() } : {}),
          metadata: { workflow_execution_id: executionId, decision: authority },
        };
        const { error } = await admin.from("follow_ups").update(update)
          .eq("id", followUpId).eq("organization_id", profile.organization_id);
        if (error) throw error;
        domainOutput = { ...authority, state: executeNow ? "follow_up_executed" : "follow_up_rescheduled" };
      } else {
        if (!body.case_id || !scheduledFor) throw new Error("FOLLOW_UP_DATA_INCOMPLETE");
        const { data: followUp, error } = await admin.from("follow_ups").insert({
          organization_id: profile.organization_id,
          case_id: body.case_id,
          scheduled_for: scheduledFor,
          reason,
          status: "pending",
          metadata: { workflow_execution_id: executionId, decision: authority },
        }).select("id,scheduled_for,status").single();
        if (error) throw error;
        domainOutput = { ...authority, state: "follow_up_scheduled", follow_up: followUp };
      }
    } else if (actionType === "delegate_case" && body.case_id) {
      const { error } = await admin.from("cases").update({
        assigned_to: body.input_data?.assigned_to || null,
        department_id: body.input_data?.department_id || null,
        status: "delegated",
      }).eq("id", body.case_id).eq("organization_id", profile.organization_id);
      if (error) throw error;
      domainOutput = { ...authority, state: "delegated", assigned_to: body.input_data?.assigned_to || null };
    } else if (["verify_case", "resolve_case", "close_case"].includes(actionType) && body.case_id) {
      const statusByAction: Record<string, string> = { verify_case: "verified", resolve_case: "resolved", close_case: "closed" };
      const status = statusByAction[actionType];
      const { error } = await admin.from("cases").update({ status }).eq("id", body.case_id).eq("organization_id", profile.organization_id);
      if (error) throw error;
      if (actionType === "resolve_case") {
        const { error: followUpError } = await admin.from("follow_ups").update({
          status: "completed",
          completed_at: new Date().toISOString(),
          metadata: { workflow_execution_id: executionId, decision: authority },
        }).eq("case_id", body.case_id).eq("organization_id", profile.organization_id).eq("status", "pending");
        if (followUpError) throw followUpError;
      }
      domainOutput = { ...authority, state: status };
    }

    if (domainOutput) {
      await admin.from("actions").update({ status: "completed", output_data: domainOutput, completed_at: new Date().toISOString() }).eq("id", action.id);
      await admin.from("workflow_executions").update({ status: "success", decision_id: decision.id, output_data: domainOutput, finished_at: new Date().toISOString() }).eq("id", executionId);
      await admin.from("workflow_events").insert({
        organization_id: profile.organization_id,
        workflow_execution_id: executionId,
        case_id: body.case_id || null,
        event_type: `function.${actionType}.completed`,
        event_data: domainOutput,
        idempotency_key: `${idempotencyKey}:completed`,
      });
      return Response.json({ action: { ...action, status: "completed" }, workflow_execution_id: executionId, authority: domainOutput }, { status: 202, headers: corsHeaders });
    }

    try {
      const commandId = await createCommand(admin, {
        organization_id: profile.organization_id,
        action_id: action.id,
        decision_id: decision.id,
        workflow_code: decisionWorkflowCode,
        command_type: actionType,
        payload: body.input_data || {},
        idempotency_key: `${idempotencyKey}:command`,
      });
      const result = await triggerWorkflow({
        action_id: action.id,
        approval_id: body.approval_id || undefined,
        requested_by: user.id,
        organization_id: profile.organization_id,
        case_id: body.case_id || null,
        action_type: actionType,
        command_id: commandId,
        decision_id: decision.id,
        workflow_code: decisionWorkflowCode,
        workflow_execution_id: executionId,
        input_data: { action_type: actionType, target_workflow_code: targetWorkflowByAction[actionType] || body.workflow_code || null, payload: body.input_data || {} },
      });
      await admin.from("commands").update({ status: "dispatched" }).eq("id", commandId);
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
