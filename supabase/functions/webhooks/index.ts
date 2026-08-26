declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const terminalStatuses = ["success", "failed", "cancelled"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (!expectedSecret || req.headers.get("x-n8n-webhook-secret") !== expectedSecret) {
    return Response.json({ error: "Webhook no autorizado" }, { status: 401, headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const status = ["running", "success", "failed", "cancelled", "waiting"].includes(body.status) ? body.status : "failed";
    if (!body.workflow_execution_id || !body.organization_id || !body.workflow_code) {
      return Response.json({ error: "workflow_execution_id, organization_id y workflow_code son obligatorios" }, { status: 422, headers: corsHeaders });
    }
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !supabaseUrl) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: execution, error: executionError } = await admin.from("workflow_executions").select("id,organization_id,case_id,action_id,source_message_id,input_data").eq("id", body.workflow_execution_id).eq("input_data->>organization_id", body.organization_id).maybeSingle();
    if (executionError) throw executionError;
    if (!execution) return Response.json({ error: "Ejecución no encontrada" }, { status: 404, headers: corsHeaders });

    const outputData = body.output_data && typeof body.output_data === "object" ? body.output_data : {};
    const errorData = body.error_data && typeof body.error_data === "object" ? body.error_data : {};
    const resultKey = body.idempotency_key || `callback:${body.workflow_execution_id}:${status}:${body.n8n_execution_id || "unknown"}`;
    const { data: existingEvent } = await admin.from("workflow_events").select("id").eq("organization_id", body.organization_id).eq("idempotency_key", resultKey).maybeSingle();
    if (existingEvent) return Response.json({ success: true, duplicate: true }, { headers: corsHeaders });

    const { error: updateError } = await admin.from("workflow_executions").update({ 
      status, 
      output_data: outputData, 
      error_data: errorData, 
      n8n_execution_id: body.n8n_execution_id || null, 
      finished_at: terminalStatuses.includes(status) ? new Date().toISOString() : null 
    }).eq("id", execution.id);
    
    if (updateError) throw updateError;
    if (execution.action_id) {
      const actionStatus = status === "success" ? "completed" : status === "failed" ? "failed" : status === "cancelled" ? "cancelled" : "running";
      const { error } = await admin.from("actions").update({ 
        status: actionStatus, 
        output_data: outputData, 
        error_data: errorData, 
        n8n_execution_id: body.n8n_execution_id || null, 
        completed_at: ["completed", "failed", "cancelled"].includes(actionStatus) ? new Date().toISOString() : null 
      }).eq("id", execution.action_id);
      if (error) throw error;
    }
    const responseContent = typeof outputData.response === "string" ? outputData.response : typeof body.response === "string" ? body.response : null;
    if (responseContent && execution.input_data?.conversation_id) {
      const { error } = await admin.from("messages").insert({ conversation_id: execution.input_data.conversation_id, sender_type: "ai", role: "assistant", content: responseContent, content_json: outputData.action || {}, metadata: { source: "n8n", workflow_code: body.workflow_code, workflow_execution_id: execution.id, n8n_execution_id: body.n8n_execution_id || null, correlation_id: body.correlation_id || null } });
      if (error) throw error;
    }
    if (body.action_type === "approve_email" && body.approval_id) await admin.from("approvals").update({ 
      status: status === "success" ? "approved" : "rejected", 
      decision: status === "success" ? "approved" : "rejected", 
      responded_at: new Date().toISOString() 
    }).eq("id", body.approval_id);

    if (body.action_type === "delegate_case" && execution.case_id && status === "success") {
      const assignedTo = body.input_data?.assigned_to || body.assigned_to;
      const departmentId = body.input_data?.department_id || body.department_id;
      if (assignedTo) {
        await admin.from("cases").update({ 
          assigned_to: assignedTo, 
          department_id: departmentId || null, status: "delegated" }).eq("id", execution.case_id).eq("organization_id", body.organization_id);
        await admin.from("delegations").insert({ 
          organization_id: body.organization_id, 
          case_id: execution.case_id, 
          assigned_to: assignedTo, 
          assigned_by: body.requested_by || null, 
          department_id: departmentId || null, 
          reason: body.input_data?.reason || null, 
          metadata: { workflow_execution_id: execution.id } 
        });
      }
    }
    if (body.action_type === "schedule_follow_up" && execution.case_id && status === "success" && typeof body.input_data?.scheduled_for === "string") await admin.from("follow_ups").insert({ 
      organization_id: body.organization_id, 
      case_id: execution.case_id, 
      scheduled_for: body.input_data.scheduled_for, 
      reason: body.input_data.reason || null, 
      metadata: { workflow_execution_id: execution.id } 
    });
    const { error: eventError } = await admin.from("workflow_events").insert({ 
      organization_id: body.organization_id, 
      workflow_execution_id: execution.id, 
      case_id: execution.case_id, 
      event_type: `n8n.${body.workflow_code}.${status}`, 
      event_data: { ...body, output_data: outputData }, 
      idempotency_key: resultKey 
    });
    if (eventError) throw eventError;
    return Response.json({ success: true, workflow_execution_id: execution.id }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo procesar el callback de n8n" }, { status: 500, headers: corsHeaders });
  }
});
