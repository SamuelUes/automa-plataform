declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, conversationContextUrl, createExecution, recordAssistantProgress, startConversationActivity } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";
import { assistantInputSchema } from "../_shared/validation.ts";

function conversationTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 56 ? `${normalized.slice(0, 53).trimEnd()}...` : normalized;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    const { data: allowed } = await client.rpc("check_rate_limit", {
      p_key: `assistant:${user.id}`,
      p_limit: 30,
      p_window_seconds: 60,
    });
    if (!allowed) return Response.json({ error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." }, { status: 429, headers: corsHeaders });

    const parsed = assistantInputSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "El mensaje no es válido" }, { status: 422, headers: corsHeaders });

    const { content, case_id: caseId } = parsed.data;
    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });

    const admin = adminClient();
    let conversationId = body.conversation_id as string | null;
    if (conversationId) {
      const { data } = await client.from("conversations").select("id,status").eq("id", conversationId).eq("organization_id", profile.organization_id).eq("user_id", user.id).maybeSingle();
      if (!data) conversationId = null;
      if (data?.status === "closed") {
        await admin.from("conversations").update({ status: "active", closed_at: null, paused_at: null }).eq("id", conversationId).eq("organization_id", profile.organization_id);
      }
    }
    if (!conversationId) {
      const { data, error } = await client.from("conversations").insert({ organization_id: profile.organization_id, user_id: user.id, case_id: caseId || null, title: conversationTitle(content), conversation_type: "assistant" }).select("id,title,updated_at").single();
      if (error) throw error;
      conversationId = data.id;
    }
    if (!conversationId) throw new Error("CONVERSATION_NOT_CREATED");

    const activity = await startConversationActivity(admin, {
      conversation_id: conversationId,
      organization_id: profile.organization_id,
      source_workflow: "PE08",
      timer_minutes: 15,
    });
    const requestId = crypto.randomUUID();
    const envelope = {
      event_type: "assistant_command",
      workflow_code: "PE08",
      request_id: requestId,
      correlation_id: conversationId,
      idempotency_key: `assistant-command:${conversationId}:${requestId}`,
      organization_id: profile.organization_id,
      user_id: user.id,
      case_id: caseId || null,
      conversation_id: conversationId,
      source_message_id: null,
      input_data: { 
        source_channel: "dashboard", 
        content, 
        context_url: conversationContextUrl(), 
        inactivity_timer_id: activity.timer_id, 
        inactivity_generation: activity.generation, 
        inactivity_deadline_at: activity.deadline, 
        last_activity_at: activity.conversation.last_activity_at, 
        context_request: { conversation_id: conversationId, organization_id: profile.organization_id } 
      },
    };
    const executionId = await createExecution(admin, envelope);
    await recordAssistantProgress(admin, {
      organization_id: profile.organization_id,
      conversation_id: conversationId,
      request_id: requestId,
      workflow_execution_id: executionId,
      source_channel: "dashboard",
      status: "received",
      progress_order: 1,
    });
    try {
      const n8nResponse = await triggerWorkflow({ ...envelope, workflow_execution_id: executionId, action_type: "assistant_command" });
      return Response.json({ 
        conversation_id: conversationId, 
        request_id: requestId, 
        workflow_execution_id: executionId, 
        status: "queued", 
        n8n: n8nResponse 
      }, { status: 202, headers: corsHeaders });
    } catch (error) {
      await admin.from("workflow_executions").update({ status: "failed", error_data: { code: error instanceof Error ? error.message : "WORKFLOW_FAILED" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ 
        conversation_id: conversationId, 
        workflow_execution_id: executionId, 
        status: "failed", 
        error: "No se pudo iniciar PE08" 
      }, { status: 503, headers: corsHeaders });
    }
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo procesar el mensaje" }, { status, headers: corsHeaders });
  }
});
