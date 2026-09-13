declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

import { cors } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { adminClient, isUuid } from "../_shared/integration.ts";

type Operation = "pause_if_inactive" | "resume" | "close";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  try {
    const body = await req.json();
    const n8nSecret = Deno.env.get("N8N_INGRESS_SECRET");
    const isN8nRequest = Boolean(n8nSecret && req.headers.get("x-prologistica-secret") === n8nSecret);
    const { client, user } = isN8nRequest ? { client: adminClient(), user: null } : await getAuthedClient(req);
    const conversationId = body.conversation_id;
    const operation = body.operation as Operation;
    const timerId = typeof body.timer_id === "string" ? body.timer_id : null;
    const expectedGeneration = Number.isFinite(Number(body.expected_generation)) ? Number(body.expected_generation) : null;
    const expectedLastActivityAt = typeof body.expected_last_activity_at === "string" ? body.expected_last_activity_at : null;
    if (!isUuid(conversationId) || !["pause_if_inactive", "resume", "close"].includes(operation)) {
      return Response.json({ error: "conversation_id y operation son obligatorios" }, { status: 422, headers: cors(req) });
    }

    const organizationId = isN8nRequest ? body.organization_id : (await client.from("users").select("organization_id").eq("id", user.id).single()).data?.organization_id;
    if (!isUuid(organizationId)) return Response.json({ error: "Organización no válida" }, { status: 403, headers: cors(req) });

    const admin = adminClient();
    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("id,organization_id,status,updated_at,paused_at,last_activity_at,inactivity_generation,active_inactivity_timer_id,inactivity_deadline_at,case_id")
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return Response.json({ error: "Conversación no encontrada" }, { status: 404, headers: cors(req) });

    const now = new Date();
    if (operation === "pause_if_inactive") {
      if (!timerId || expectedGeneration === null || !expectedLastActivityAt) {
        return Response.json({ conversation, paused: false, ignored: true, reason: "TIMER_METADATA_REQUIRED" }, { headers: cors(req) });
      }
      if (conversation.status === "closed" || conversation.status === "paused") {
        return Response.json({ conversation, paused: false, ignored: true, reason: conversation.status === "paused" ? "ALREADY_PAUSED" : "CLOSED" }, { headers: cors(req) });
      }
      const deadlinePassed = !conversation.inactivity_deadline_at || new Date(conversation.inactivity_deadline_at).getTime() <= now.getTime();
      const timerMatches = !timerId || conversation.active_inactivity_timer_id === timerId;
      const generationMatches = expectedGeneration === null || Number(conversation.inactivity_generation || 0) === expectedGeneration;
      const activityMatches = !expectedLastActivityAt || conversation.last_activity_at === expectedLastActivityAt;
      if (!deadlinePassed || !timerMatches || !generationMatches || !activityMatches) {
        return Response.json({ conversation, paused: false, ignored: true, reason: "STALE_TIMER" }, { headers: cors(req) });
      }
      const { data, error } = await admin.from("conversations").update({
        status: "paused",
        paused_at: now.toISOString(),
        inactivity_notice_sent_at: now.toISOString(),
      }).eq("id", conversationId).eq("organization_id", organizationId).eq("status", "active").eq("active_inactivity_timer_id", timerId || conversation.active_inactivity_timer_id).eq("inactivity_generation", expectedGeneration ?? conversation.inactivity_generation).select("id,status,paused_at,inactivity_notice_sent_at").maybeSingle();
      if (error) throw error;
      if (!data) return Response.json({ conversation, paused: false, ignored: true, reason: "STALE_TIMER" }, { headers: cors(req) });
      await admin.from("workflow_executions").update({
        status: "cancelled",
        finished_at: now.toISOString(),
        error_data: { code: "CONVERSATION_INACTIVE", message: "Conversation paused after fifteen minutes without activity." },
      }).eq("correlation_id", conversationId).eq("status", "running").in("workflow_code", ["PE08", "PE13"]);
      await admin.from("messages").insert({
        conversation_id: conversationId,
        sender_type: "system",
        role: "system",
        content: "La conversación se pausó por 15 minutos sin actividad. Puedes reanudarla o finalizarla.",
        content_json: { type: "inactivity_notice", paused_at: now.toISOString(), timer_id: timerId },
        metadata: { source: "conversation-control", workflow_codes: ["PE08", "PE13"], timer_id: timerId },
      });
      return Response.json({ conversation: data, paused: true }, { headers: cors(req) });
    }

    if (operation === "close") {
      const expectedPausedAt = typeof body.expected_paused_at === "string" ? body.expected_paused_at : null;
      if (expectedPausedAt && conversation.paused_at !== expectedPausedAt) {
        return Response.json({ conversation, closed: false, reason: "CONVERSATION_REACTIVATED" }, { headers: cors(req) });
      }
      await admin.from("workflow_executions").update({
        status: "cancelled",
        finished_at: now.toISOString(),
        error_data: { code: "CONVERSATION_CLOSED", message: "Conversation was closed by the user." },
      }).eq("correlation_id", conversationId).eq("status", "running").in("workflow_code", ["PE08", "PE13"]);
      const { data, error } = await admin.from("conversations").update({ status: "closed", closed_at: now.toISOString() }).eq("id", conversationId).eq("organization_id", organizationId).neq("status", "closed").select("id,status,closed_at,case_id").maybeSingle();
      if (error) throw error;
      if (conversation.case_id) {
        const { error: caseError } = await admin.from("cases").update({ status: "closed", updated_at: now.toISOString() }).eq("id", conversation.case_id).eq("organization_id", organizationId);
        if (caseError) throw caseError;
      }
      return Response.json({ 
        conversation: data || { ...conversation, status: "closed" }, 
        case_closed: Boolean(conversation.case_id), 
        closed: true 
      }, { headers: cors(req) });
    }

    const { data, error } = await admin.from("conversations").update({ status: "active", paused_at: null }).eq("id", conversationId).eq("organization_id", organizationId).neq("status", "closed").select("id,status,paused_at").single();
    if (error) throw error;
    return Response.json({ conversation: data }, { headers: cors(req) });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo actualizar la conversación" }, { status, headers: cors(req) });
  }
});
