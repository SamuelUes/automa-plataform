declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { cors } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, createCommand, createExecution } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";
import { actionInputSchema } from "../_shared/validation.ts";

const targetWorkflowByAction: Record<string, string> = {
  approve_email: "PE07",
  reject_approval: "PE07",
  delegate_case: "PE04",
  send_email: "PE07",
  create_email_draft: "PE03",
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

function evaluateAuthority(actionType: string, 
  targetWorkflowCode: string, 
  payload: Record<string, unknown>, 
  approvalGranted = false) {
  
    const requiresApproval = !approvalGranted && sensitiveActions.has(actionType);
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    let allowed: boolean | null = null;
    try {
      const rateLimit = await client.rpc("check_rate_limit", {
        p_key: `actions:${user.id}`,
        p_limit: 60,
        p_window_seconds: 60,
      });
      if (rateLimit.error) throw rateLimit.error;
      allowed = rateLimit.data;
    } catch {
      return Response.json(
        { error: "No se pudo validar el límite de solicitudes. Inténtalo de nuevo." },
        { status: 503, headers: cors(req) },
      );
    }

    if (!allowed) {
      return Response.json(
        { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
        { status: 429, headers: cors(req) },
      );
    }

    const parsed = actionInputSchema.safeParse({
      ...body,
      idempotency_key: req.headers.get("idempotency-key") || body.idempotency_key,
    });
    if (!parsed.success) return Response.json({ error: "Los datos de la acción no son válidos." }, 
      { status: 422, headers: cors(req) });

    const actionType = parsed.data.action_type;
    if (actionType === "execute_workflow" && typeof body.workflow_code !== "string") {
      return Response.json({ error: "workflow_code es obligatorio para ejecutar un workflow." },
        { status: 422, headers: cors(req) });
    }
    if (actionType === "schedule_follow_up" && !body.input_data?.follow_up_id && !body.input_data?.scheduled_for) {
      return Response.json({ error: "scheduled_for es obligatorio para crear un seguimiento" }, 
        { status: 422, headers: cors(req) });
    }
    const targetWorkflowCode = targetWorkflowByAction[actionType] || body.workflow_code || (actionType === "schedule_follow_up" ? "PE06" : "PE02");
    if (privilegedActions.has(actionType)) {
      const { data: profile } = await client.from("users").select("organization_id,role").eq("id", user.id).single();
      if (!profile || !["owner", "admin", "manager"].includes(profile.role)) 
        return Response.json({ error: "No tienes permisos para esta acción." }, 
        { status: 403, headers: cors(req) });
    }

    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json(
      { error: "Usuario sin organización" },
      { status: 403, headers: cors(req) },
    );

    if (body.case_id) {
      const { data: caseRecord } = await client.from("cases").select("id,organization_id").eq("id", body.case_id).maybeSingle();
      if (!caseRecord || caseRecord.organization_id !== profile.organization_id) return Response.json(
        { error: "El caso no existe o no pertenece a tu organización." },
        { status: 404, headers: cors(req) },
      );
    }

    const admin = adminClient();
    const idempotencyKey = parsed.data.idempotency_key;
    const { data: existing } = await client.from("actions").select("id,status,action_type").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return Response.json(
      { action: existing, idempotent: true },
      { headers: cors(req) },
    );

    if (actionType === "discard_email_draft") {
      const draftId = typeof body.input_data?.draft_id === "string" ? body.input_data.draft_id : "";
      if (!draftId) return Response.json({ error: "draft_id es obligatorio para descartar un borrador." }, { status: 422, headers: cors(req) });
      const { data: draft, error: draftError } = await admin.from("email_drafts")
        .select("id,organization_id,status,metadata")
        .eq("id", draftId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      if (draftError) throw draftError;
      if (!draft) return Response.json({ error: "El borrador no existe o no pertenece a tu organización." }, { status: 404, headers: cors(req) });
      if (["sent", "approved"].includes(draft.status)) return Response.json({ error: "No se puede descartar un borrador aprobado o enviado." }, { status: 409, headers: cors(req) });
      const { error: discardError } = await admin.from("email_drafts").update({ status: "discarded" })
        .eq("id", draft.id)
        .eq("organization_id", profile.organization_id);
      if (discardError) throw discardError;
      const metadata = draft.metadata && typeof draft.metadata === "object" ? draft.metadata as Record<string, unknown> : {};
      const creationId = typeof metadata.creation_id === "string" ? metadata.creation_id : null;
      if (creationId) {
        const { error: creationError } = await admin.from("creations").update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("id", creationId)
          .eq("organization_id", profile.organization_id);
        if (creationError) throw creationError;
      }
      return Response.json({ discarded: true, draft_id: draft.id, creation_id: creationId }, { headers: cors(req) });
    }

    let creationId: string | null = null;
    if (actionType === "create_email_draft") {
      const emailId = typeof body.input_data?.email_id === "string" ? body.input_data.email_id : "";
      if (!emailId) return Response.json({ error: "email_id es obligatorio para crear un borrador." }, { status: 422, headers: cors(req) });

      const { data: email, error: emailError } = await client
        .from("emails")
        .select("id,organization_id,thread_id,case_id,direction,sender,recipients,cc,subject,body_text,received_at,metadata")
        .eq("id", emailId)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();
      if (emailError) throw emailError;
      if (!email) return Response.json({ error: "El correo no existe o no pertenece a tu organización." }, { status: 404, headers: cors(req) });

      const resolvedCaseId = body.case_id || email.case_id || null;
      if (resolvedCaseId && resolvedCaseId !== email.case_id) {
        return Response.json({ error: "El caso no coincide con el correo seleccionado." }, { status: 409, headers: cors(req) });
      }
      body.case_id = resolvedCaseId;

      const [{ data: threadEmails, error: threadError }, { data: conversation, error: conversationError }] = await Promise.all([
        email.thread_id
          ? client.from("emails").select("id,subject,body_text,direction,sender,received_at,case_id").eq("organization_id", profile.organization_id).eq("thread_id", email.thread_id).order("received_at", { ascending: true }).limit(20)
          : Promise.resolve({ data: [], error: null }),
        resolvedCaseId
          ? client.from("conversations").select("id,case_id,title,status,context,updated_at").eq("organization_id", profile.organization_id).eq("case_id", resolvedCaseId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (threadError) throw threadError;
      if (conversationError) throw conversationError;

      const { data: messages, error: messagesError } = conversation?.id
        ? await client.from("messages").select("id,role,sender_type,content,content_json,created_at,metadata").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(40)
        : { data: [], error: null };
      if (messagesError) throw messagesError;

      const { data: caseRecord, error: caseError } = resolvedCaseId
        ? await client.from("cases").select("id,case_number,title,description,status,priority,metadata,assigned_to,department_id").eq("id", resolvedCaseId).eq("organization_id", profile.organization_id).maybeSingle()
        : { data: null, error: null };
      if (caseError) throw caseError;

      body.conversation_id = body.conversation_id || conversation?.id || null;
      const context = {
        version: 1,
        source_refs: { email_id: email.id, thread_id: email.thread_id, case_id: caseRecord?.id || null, conversation_id: conversation?.id || null },
        email,
        thread: threadEmails || [],
        case: caseRecord,
        conversation,
        messages: messages || [],
      };
      const instructions = typeof body.input_data?.instructions === "string" ? body.input_data.instructions.trim().slice(0, 2000) : "";
      body.input_data = {
        ...body.input_data,
        email_id: email.id,
        context,
        draft: `${instructions || "Redacta una respuesta profesional, clara y contextualizada para el correo proporcionado."}\n\nContexto autorizado del email:\n${JSON.stringify(context).slice(0, 24000)}`,
        requested_output: "email_draft",
      };

      const { data: creation, error: creationError } = await admin.from("creations").insert({
        organization_id: profile.organization_id,
        created_by: user.id,
        email_id: email.id,
        case_id: resolvedCaseId,
        conversation_id: body.conversation_id,
        idempotency_key: `${parsed.data.idempotency_key}:creation`,
        creation_type: "email_draft",
        status: "queued",
        title: email.subject || "Borrador de email",
        prompt: instructions || null,
        context_snapshot: { version: 1, source_refs: context.source_refs },
        metadata: { source: "email_inbox", workflow_code: "PE03" },
      }).select("id").single();
      if (creationError) throw creationError;
      creationId = creation.id;
      body.input_data = { ...body.input_data, creation_id: creationId };
    }

    const { data: workflow, error: workflowError } = await admin
      .from("workflow_definitions")
      .select("id,code")
      .eq("organization_id", profile.organization_id)
      .eq("code", targetWorkflowCode)
      .maybeSingle();
    if (workflowError) throw workflowError;
    const actionInputData = {
      action_type: actionType,
      target_workflow_code: targetWorkflowCode,
      payload: body.input_data || {},
    };
    const startedAt = new Date().toISOString();
    const { data: action, error: actionError } = await admin.from("actions").insert({
      organization_id: profile.organization_id,
      case_id: body.case_id || null,
      conversation_id: body.conversation_id || null,
      message_id: body.message_id || null,
      action_type: actionType,
      requested_by: user.id,
      workflow_id: workflow?.id || null,
      workflow_name: workflow?.code || targetWorkflowCode,
      input_data: actionInputData,
      idempotency_key: idempotencyKey,
      started_at: startedAt,
    }).select("id,status,action_type,workflow_id,workflow_name,input_data,created_at,started_at").single();
    if (actionError) throw actionError;
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
    const { error: actionDecisionError } = await admin
      .from("actions")
      .update({ decision_id: decision.id })
      .eq("id", action.id)
      .eq("organization_id", profile.organization_id);
    if (actionDecisionError) throw actionDecisionError;

    const executionId = await createExecution(admin, {
      event_type: "authority_requested",
      workflow_code: targetWorkflowCode,
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
        target_workflow_code: targetWorkflowCode,
        payload: body.input_data || {},
      },
    });

    if (actionType === "create_email_draft" && creationId) {
      const { error: creationExecutionError } = await admin.from("creations").update({ workflow_execution_id: executionId, status: "running" })
        .eq("id", creationId)
        .eq("organization_id", profile.organization_id);
      if (creationExecutionError) throw creationExecutionError;
    }

    if (authority.requires_approval) {
      const { error: pendingActionError } = await admin
        .from("actions")
        .update({ status: "pending" })
        .eq("id", action.id)
        .eq("organization_id", profile.organization_id);
      if (pendingActionError) throw pendingActionError;
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
      return Response.json({ action: { ...action, status: "pending" }, 
        workflow_execution_id: executionId, authority }, 
        { status: 202, headers: cors(req) });
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
      const { error: completedActionError } = await admin
        .from("actions")
        .update({ status: "completed", output_data: domainOutput, completed_at: new Date().toISOString() })
        .eq("id", action.id)
        .eq("organization_id", profile.organization_id);
      if (completedActionError) throw completedActionError;
      await admin.from("workflow_executions").update({ status: "success", decision_id: decision.id, output_data: domainOutput, finished_at: new Date().toISOString() }).eq("id", executionId);
      await admin.from("workflow_events").insert({
        organization_id: profile.organization_id,
        workflow_execution_id: executionId,
        case_id: body.case_id || null,
        event_type: `function.${actionType}.completed`,
        event_data: domainOutput,
        idempotency_key: `${idempotencyKey}:completed`,
      });
      return Response.json({ action: { ...action, status: "completed" }, workflow_execution_id: executionId, authority: domainOutput }, { status: 202, headers: cors(req) });
    }

    try {
      const commandId = await createCommand(admin, {
        organization_id: profile.organization_id,
        action_id: action.id,
        decision_id: decision.id,
        workflow_code: targetWorkflowCode,
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
        workflow_code: targetWorkflowCode,
        workflow_execution_id: executionId,
        input_data: actionInputData,
      });
      await admin.from("commands").update({ status: "dispatched" }).eq("id", commandId);
      const { error: queuedActionError } = await admin
        .from("actions")
        .update({ status: "queued" })
        .eq("id", action.id)
        .eq("organization_id", profile.organization_id);
      if (queuedActionError) throw queuedActionError;
      return Response.json({ action: { ...action, status: "queued" }, 
        workflow_execution_id: executionId, n8n: result }, 
        { status: 202, headers: cors(req) });
    } catch (error) {
      await admin.from("workflow_executions").update({ status: "failed", error_data: { code: error instanceof Error ? error.message : "WORKFLOW_FAILED" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      await admin
        .from("actions")
        .update({ status: "failed", error_data: { code: error instanceof Error ? error.message : "WORKFLOW_FAILED" }, completed_at: new Date().toISOString() })
        .eq("id", action.id)
        .eq("organization_id", profile.organization_id);
      return Response.json({ action: { ...action, status: "failed" }, workflow_execution_id: executionId, error: "No se pudo iniciar el workflow de la acción" },
        { status: 503, headers: cors(req) });
    }
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = errorCode === "UNAUTHORIZED" ? 401 : errorCode === "AUTH_SERVICE_UNAVAILABLE" ? 503 : 500;
    const message = status === 401
      ? "No autorizado"
      : status === 503
        ? "El servicio de autenticación está temporalmente no disponible. Inténtalo de nuevo."
        : "No se pudo crear la acción";
    return Response.json({ error: message }, { status, headers: cors(req) });
  }
});
