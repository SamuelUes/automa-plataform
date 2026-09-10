declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, createExecution } from "../_shared/integration.ts";
import { getWorkflowExecution, triggerWorkflow } from "../_shared/n8n/client.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json().catch(() => ({}));
    const profile = await client.from("users").select("organization_id,role").eq("id", user.id).single();
   
    if (!profile.data) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });
   
    if (req.method === "GET" || body.operation === "list") {
      const { data, error } = await client.from("workflow_definitions").select("id,code,name,description,n8n_workflow_id,version,is_active,configuration,created_at,updated_at").order("code");
      if (error) throw error;
      return Response.json({ data: data || [] }, { headers: corsHeaders });
    }
    if (body.execution_id) return Response.json({ data: await getWorkflowExecution(body.execution_id) }, { headers: corsHeaders });
    if (!body.workflow_code && !body.action_id) return Response.json({ error: "workflow_code o action_id requerido" }, 
      { status: 422, headers: corsHeaders });
    
    const payload = { action_id: body.action_id, organization_id: profile.data.organization_id,
      case_id: body.case_id || null, action_type: body.action_type || "execute_workflow", workflow_code: body.workflow_code, input_data: body.input_data || {} };

    if (["PE09", "PE11"].includes(body.workflow_code)) {
      const admin = adminClient();
      const requestId = body.request_id || crypto.randomUUID();
      const idempotencyKey = body.idempotency_key || `${body.workflow_code}:${requestId}`;
      const executionId = await createExecution(admin, {
        event_type: body.workflow_code === "PE09" ? "case_correlation" : "coverage_observed",
        workflow_code: body.workflow_code,
        request_id: requestId,
        correlation_id: body.correlation_id || body.case_id || requestId,
        idempotency_key: idempotencyKey,
        organization_id: profile.data.organization_id,
        case_id: body.case_id || null,
        input_data: body.input_data || {},
      });
      const eventData = body.workflow_code === "PE09"
        ? { item_ref: body.input_data?.itemRef || null, case_ref: body.input_data?.caseRef || body.case_id || null, conversation_refs: body.input_data?.conversationRefs || [] }
        : { coverage_status: body.input_data?.coverage_status || "UNKNOWN", required_source_refs: body.input_data?.requiredSourceRefs || [] };
      const { error } = await admin.from("workflow_events").insert({
        organization_id: profile.data.organization_id,
        workflow_execution_id: executionId,
        case_id: body.case_id || null,
        event_type: body.workflow_code === "PE09" ? "function.pe09.case_correlation" : "function.pe11.coverage_recorded",
        event_data: eventData,
        idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      await admin.from("workflow_executions").update({ status: "success", output_data: eventData, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ data: { success: true, workflow_execution_id: executionId, output_data: eventData } }, { status: 202, headers: corsHeaders });
    }

    const result = await triggerWorkflow(payload);
    
    if (body.action_id) {
      await client.from("actions").update({ status: "queued", n8n_execution_id: result.execution_id || null }).eq("id", body.action_id);
    }
    
    return Response.json({ data: result }, { status: 202, headers: corsHeaders });
  } 
  catch (error) { 
    const message = error instanceof Error && error.message === "UNAUTHORIZED" ? "No autorizado" : error instanceof Error && error.message.includes("N8N") ? 
    "La integración con n8n no está disponible" : "No se pudo procesar el workflow"; 
    return Response.json({ error: message }, 
      { status: message === "No autorizado" ? 401 : 500, headers: corsHeaders }); }
});
