declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";
import { createExecution } from "../_shared/integration.ts";
import { actionInputSchema } from "../_shared/validation.ts";

const allowedActions = new Set([
  "approve_email", 
  "reject_approval", 
  "delegate_case", 
  "send_email", 
  "schedule_follow_up", 
  "resolve_case", 
  "verify_case", 
  "close_case", 
  "execute_workflow"
]);

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
        { status: 429, headers: corsHeaders }
      );
    }
    const parsed = actionInputSchema.safeParse({
      ...body,
      idempotency_key: req.headers.get("idempotency-key") || body.idempotency_key,
    });
    if (!parsed.success || !allowedActions.has(parsed.data.action_type)) {
      return Response.json(
        { error: "Los datos de la acción no son válidos." },
        { status: 422, headers: corsHeaders }
      );
    }
    const actionType = parsed.data.action_type;
    const idempotencyKey = parsed.data.idempotency_key;
    const { data: profile } = await client.from("users").select("organization_id,role").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });

    const privilegedActions = new Set(["close_case", "resolve_case", "verify_case"]);
    if (privilegedActions.has(actionType) && !["owner", "admin", "manager"].includes(profile.role)) {
      return Response.json(
        { error: "No tienes permisos para esta acción." },
        { status: 403, headers: corsHeaders }
      );
    }

    if (body.case_id) {
      const { data: caseRecord } = await client
        .from("cases")
        .select("id,organization_id")
        .eq("id", body.case_id)
        .maybeSingle();
      if (!caseRecord || caseRecord.organization_id !== profile.organization_id) {
        return Response.json(
          { error: "El caso no existe o no pertenece a tu organización." },
          { status: 404, headers: corsHeaders }
        );
      }
    }

    const { data: existing } = await client.from("actions").select("id,status").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return Response.json({ action: existing, idempotent: true }, { headers: corsHeaders });
    
    const { data: action, error } = await client.from("actions").insert({ 
      organization_id: profile.organization_id, 
      case_id: body.case_id || null, 
      conversation_id: body.conversation_id || null, 
      message_id: body.message_id || null, 
      action_type: actionType, 
      requested_by: user.id, 
      workflow_name: body.workflow_name || null, 
      input_data: body.input_data || {}, 
      idempotency_key: idempotencyKey 
    }).select("id,status,action_type,created_at").single();
    
    if (error) throw error;
    await client.rpc("create_audit_log", { 
      p_organization_id: profile.organization_id, 
      p_event_type: "action_created", 
      p_entity_type: "action", 
      p_entity_id: action.id, 
      p_case_id: body.case_id || null, 
      p_action_id: action.id, 
      p_new_data: { action_type: actionType } 
    });
    const workflowExecutionId = await createExecution(client, {
      event_type: "action_requested",
      workflow_code: body.workflow_code || actionType,
      request_id: crypto.randomUUID(),
      correlation_id: body.conversation_id || action.id,
      idempotency_key: `${idempotencyKey}:execution`,
      organization_id: profile.organization_id,
      user_id: user.id,
      case_id: body.case_id || null,
      conversation_id: body.conversation_id || null,
      source_message_id: body.message_id || null,
      action_id: action.id,
      input_data: body.input_data || {},
    });
    try {
      const n8nResult = await triggerWorkflow({ 
        action_id: action.id,
        approval_id: body.approval_id || undefined,
        requested_by: user.id,
        organization_id: profile.organization_id, 
        case_id: body.case_id || null, 
        action_type: actionType, 
        workflow_code: body.workflow_code,
        workflow_execution_id: workflowExecutionId,
        input_data: body.input_data || {} 
      });
      await client.from("actions").update({ status: "queued", n8n_execution_id: n8nResult.execution_id || null }).eq("id", action.id);
      
      return Response.json({ action: { ...action, status: "queued", n8n_execution_id: n8nResult.execution_id || null }, 
        n8n: { success: true } }, 
        { status: 202, headers: corsHeaders });
    } catch {
      
      return Response.json({ action, n8n: { success: false, message: "Action creada; n8n procesará cuando esté disponible." } }, 
        { status: 201, headers: corsHeaders });
    }
  } catch (error) 
  { 
    const message = error instanceof Error && error.message === "UNAUTHORIZED" ? "No autorizado" : "No se pudo crear la acción"; 
    return Response.json({ error: message }, 
      { status: message === "No autorizado" ? 401 : 500, headers: corsHeaders }); 
  }
});
