declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { assistantInputSchema } from "../_shared/validation.ts";
import { createExecution } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    const { data: allowed } = await client.rpc("check_rate_limit", { p_key: `assistant:${user.id}`, p_limit: 30, p_window_seconds: 60 });
    if (!allowed) return Response.json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." }, { status: 429, headers: corsHeaders });
    const parsed = assistantInputSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "El mensaje no es válido" }, { status: 422, headers: corsHeaders });
    const { content, case_id: caseId } = parsed.data;
    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });

    let conversationId = body.conversation_id as string | null;
    if (conversationId) {
      const { data } = await client.from("conversations").select("id").eq("id", conversationId).eq("organization_id", profile.organization_id).eq("user_id", user.id).maybeSingle();
      if (!data) conversationId = null;
    }
    if (!conversationId) {
      const { data, error } = await client.from("conversations").insert({ 
        organization_id: profile.organization_id, 
        user_id: user.id, 
        case_id: caseId || null, 
        title: "AI Command Center", 
        conversation_type: "assistant" 
      }).select("id").single();
      if (error) throw error;
      conversationId = data.id;
    }
    const { data: sourceMessage, error: messageError } = await client.from("messages").insert({ 
      conversation_id: conversationId, 
      user_id: user.id, 
      sender_type: "human", 
      role: "user", 
      content, 
      metadata: { source: "dashboard", case_id: caseId || null } 
    }).select("id").single();
    if (messageError) throw messageError;
    const context = {
      pending_cases: (await client.from("cases").select("id,case_number,title,status,priority").in("status", ["waiting_human", "waiting_approval", "follow_up", "waiting_verification"]).limit(20)).data || [],
      pending_approvals: (await client.from("approvals").select("id,case_id,status,requested_at").eq("status", "pending").limit(20)).data || [],
      pending_follow_ups: (await client.from("follow_ups").select("id,case_id,scheduled_for,status").eq("status", "pending").limit(20)).data || [],
    };
    const envelope = { 
      event_type: "assistant_message", 
      workflow_code: "PE08", 
      request_id: crypto.randomUUID(), 
      correlation_id: conversationId || crypto.randomUUID(), 
      idempotency_key: `assistant-message:${sourceMessage.id}`, 
      organization_id: profile.organization_id, 
      user_id: user.id, 
      case_id: caseId || null, 
      conversation_id: conversationId, 
      source_message_id: sourceMessage.id, 
      input_data: { content, context } 
    };
    const executionId = await createExecution(client, envelope);
    const n8nResponse = await triggerWorkflow({ 
      ...envelope, 
      workflow_execution_id: executionId, 
      action_type: "assistant_message" 
    }).catch(() => null);
    
    if (!n8nResponse) {
      await client.from("workflow_executions").update({ status: "failed", error_data: { code: "N8N_UNAVAILABLE" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ 
        conversation_id: conversationId, 
        message_id: sourceMessage.id, 
        workflow_execution_id: executionId, 
        status: "failed", 
        error: "No se pudo conectar con el Command Center" 
      }, { status: 503, headers: corsHeaders });
    }

    const result = n8nResponse.result && typeof n8nResponse.result === "object" ? n8nResponse.result as Record<string, unknown> : {};
    const response = typeof result.response === "string" ? result.response : null;
    const action = result.action && typeof result.action === "object" ? result.action : null;
    if (response) await client.from("messages").insert({ 
      conversation_id: conversationId, 
      sender_type: "ai", 
      role: "assistant", 
      content: response, 
      content_json: action || {}, 
      metadata: { source: "n8n", workflow_execution_id: executionId } 
    });
    return Response.json({ 
      conversation_id: conversationId, 
      workflow_execution_id: executionId, 
      status: response ? "success" : "queued", 
      message: response ? { role: "assistant", content: response, action } : null 
    }, { status: 202, headers: corsHeaders });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo procesar el mensaje" }, { status, headers: corsHeaders });
  }
});
