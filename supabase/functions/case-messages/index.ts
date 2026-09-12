declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, conversationContextUrl, createExecution, invokeN8n, isUuid, startConversationActivity, verifyOrganization } from "../_shared/integration.ts";

function conversationTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 56 ? `${normalized.slice(0, 53).trimEnd()}...` : normalized;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000 || !isUuid(body.case_id)) return Response.json({ error: "case_id y content son obligatorios" }, { status: 422, headers: corsHeaders });

    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });
    const admin = adminClient();
    await verifyOrganization(admin, profile.organization_id, body.case_id);

    let conversationId = isUuid(body.conversation_id) ? body.conversation_id : null;
    if (conversationId) {
      const { data } = await client.from("conversations").select("id,status").eq("id", conversationId).eq("case_id", body.case_id).eq("organization_id", profile.organization_id).maybeSingle();
      if (!data) conversationId = null;
      if (data?.status === "closed") {
        await admin.from("conversations").update({ status: "active", closed_at: null, paused_at: null }).eq("id", conversationId).eq("organization_id", profile.organization_id);
      }
    }
    if (!conversationId) {
      const { data, error } = await client.from("conversations").insert({ organization_id: profile.organization_id, user_id: user.id, case_id: body.case_id, title: body.title || conversationTitle(content), conversation_type: "case" }).select("id").single();
      if (error) throw error;
      conversationId = data.id;
    }
    if (!conversationId) throw new Error("CONVERSATION_NOT_CREATED");

    const activity = await startConversationActivity(admin, {
      conversation_id: conversationId,
      organization_id: profile.organization_id,
      source_workflow: "PE13",
      timer_minutes: 15,
    });
    const requestId = crypto.randomUUID();
    const payload = {
      event_type: "case_message",
      workflow_code: "PE13",
      request_id: requestId,
      correlation_id: conversationId,
      idempotency_key: `case-message:${conversationId}:${requestId}`,
      organization_id: profile.organization_id,
      user_id: user.id,
      case_id: body.case_id,
      conversation_id: conversationId,
      source_message_id: null,
      input_data: {
        source_channel: "dashboard",
        content,
        inactivity_timer_id: activity.timer_id,
        inactivity_generation: activity.generation,
        inactivity_deadline_at: activity.deadline,
        last_activity_at: activity.conversation.last_activity_at,
        context_url: conversationContextUrl(),
        context_request: {
          conversation_id: conversationId,
          organization_id: profile.organization_id,
          case_id: body.case_id,
        },
      },
    };
    const executionId = await createExecution(admin, payload);
    const n8nPayload = { ...payload, workflow_execution_id: executionId };
    await admin.from("workflow_executions").update({ input_data: n8nPayload }).eq("id", executionId);

    try {
      const result = await invokeN8n(n8nPayload);
      return Response.json({ conversation_id: conversationId, request_id: requestId, workflow_execution_id: executionId, status: "queued", n8n: result }, { status: 202, headers: corsHeaders });
    } catch (error) {
      await admin.from("workflow_executions").update({ status: "failed", error_data: { code: error instanceof Error ? error.message : "N8N_ERROR" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ conversation_id: conversationId, request_id: requestId, workflow_execution_id: executionId, status: "failed", error: "No se pudo iniciar PE13" }, { status: 503, headers: corsHeaders });
    }
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo enviar el mensaje" }, { status, headers: corsHeaders });
  }
});
