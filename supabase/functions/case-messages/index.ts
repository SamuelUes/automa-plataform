declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { createExecution, invokeN8n, isUuid, verifyOrganization } from "../_shared/integration.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json();
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!content || content.length > 2000 || !isUuid(body.case_id)) {
      return Response.json({ error: "case_id y content son obligatorios" }, { status: 422, headers: corsHeaders });
    }
    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });
    await verifyOrganization(client, profile.organization_id, body.case_id);

    let conversationId = isUuid(body.conversation_id) ? body.conversation_id : null;
    if (conversationId) {
      const { data } = await client.from("conversations").select("id").eq("id", conversationId).eq("case_id", body.case_id).eq("organization_id", profile.organization_id).maybeSingle();
      if (!data) conversationId = null;
    }
    if (!conversationId) {
      const { data, error } = await client.from("conversations").insert({ 
        organization_id: profile.organization_id, 
        user_id: user.id, 
        case_id: body.case_id, 
        title: body.title || "Conversación del caso", 
        conversation_type: "case" 
      }).select("id").single();

      if (error) throw error;
      conversationId = data.id;
    }
    const { data: message, error: messageError } = await client.from("messages").insert({ 
      conversation_id: conversationId, 
      user_id: user.id, 
      sender_type: "human", 
      role: "user", 
      content, metadata: { source: "dashboard", case_id: body.case_id } }).select("id,conversation_id,created_at").single();
    if (messageError) throw messageError;
    const requestId = crypto.randomUUID();
    const payload = { 
      event_type: "case_message", 
      workflow_code: "PE05", 
      request_id: requestId, 
      correlation_id: conversationId, 
      idempotency_key: `case-message:${message.id}`, 
      organization_id: profile.organization_id, 
      user_id: user.id, 
      case_id: body.case_id, 
      conversation_id: conversationId, 
      source_message_id: message.id, 
      input_data: { content } 
    };

    const executionId = await createExecution(client, payload);
    const n8nPayload = { ...payload, workflow_execution_id: executionId };
    await client.from("workflow_executions").update({ input_data: n8nPayload }).eq("id", executionId);
    try {
      const result = await invokeN8n(n8nPayload);
      return Response.json({ 
        conversation_id: conversationId, 
        message_id: message.id, 
        workflow_execution_id: executionId, 
        status: "queued", 
        n8n: result }, 
        { status: 202, 
          headers: corsHeaders });

    } catch (error) {
      await client.from("workflow_executions").update({ status: "failed", error_data: { message: error instanceof Error ? error.message : "N8N_ERROR" }, finished_at: new Date().toISOString() }).eq("id", executionId);
      return Response.json({ 
        conversation_id: conversationId, 
        message_id: message.id, 
        workflow_execution_id: executionId, 
        status: "failed", 
        error: "No se pudo conectar con el procesamiento del caso" 
      }, { status: 503, headers: corsHeaders });
    }
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo enviar el mensaje" }, { status, headers: corsHeaders });
  }
});
