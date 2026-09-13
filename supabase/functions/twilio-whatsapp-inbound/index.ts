declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

import { cors } from "../_shared/cors.ts";
import { adminClient, conversationContextUrl, createExecution, startConversationActivity } from "../_shared/integration.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";

function twiml(message = "") {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${escaped ? `<Message>${escaped}</Message>` : ""}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

function normalizeWhatsAppPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const digits = compact.replace(/^whatsapp:/i, "");
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? `whatsapp:${normalized}` : null;
}

function conversationTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length > 56 ? `${normalized.slice(0, 53).trimEnd()}...` : normalized;
}

async function isValidTwilioSignature(req: Request, params: Record<string, string>) {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const configuredUrl = Deno.env.get("TWILIO_WHATSAPP_WEBHOOK_URL");
  if (!authToken || !configuredUrl) return false;
  const data = configuredUrl + Object.keys(params).sort().map((key) => `${key}${params[key]}`).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return req.headers.get("x-twilio-signature") === expected;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return twiml();

  try {
    const form = await req.formData();
    const params = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
    if (!await isValidTwilioSignature(req, params)) 
      return new Response("Unauthorized", { status: 401, headers: cors(req) });

    const from = normalizeWhatsAppPhone(params.From || "");
    const content = (params.Body || "").trim();
    const externalMessageId = (params.MessageSid || "").trim();
    if (!from || !content || !externalMessageId) return twiml();

    const admin = adminClient();
    const { data: duplicate } = await admin
      .from("messages")
      .select("id")
      .contains("metadata", { external_message_id: externalMessageId })
      .limit(1)
      .maybeSingle();
    if (duplicate) return twiml();

    const { data: user, error: userError } = await admin
      .from("users")
      .select("id,organization_id,full_name")
      .eq("whatsapp_phone", from)
      .eq("is_active", true)
      .maybeSingle();
    if (userError) throw userError;
    if (!user) return twiml("Este número no está asociado a un usuario autorizado.");

    let conversation;
    const { data: existingConversation, error: conversationError } = await admin
      .from("conversations")
      .select("id,title")
      .eq("organization_id", user.organization_id)
      .eq("user_id", user.id)
      .eq("conversation_type", "assistant")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw conversationError;
    conversation = existingConversation;

    if (!conversation) {
      const result = await admin.from("conversations").insert({
        organization_id: user.organization_id,
        user_id: user.id,
        title: conversationTitle(content),
        conversation_type: "assistant",
      }).select("id,title").single();
      if (result.error) throw result.error;
      conversation = result.data;
    }

    const activity = await startConversationActivity(admin, {
      conversation_id: conversation.id,
      organization_id: user.organization_id,
      source_workflow: "PE08",
      timer_minutes: 2,
    });
    const requestId = crypto.randomUUID();
    const envelope = {
      event_type: "whatsapp_message",
      workflow_code: "PE08",
      request_id: requestId,
      correlation_id: conversation.id,
      idempotency_key: `whatsapp:${externalMessageId}`,
      organization_id: user.organization_id,
      user_id: user.id,
      case_id: null,
      conversation_id: conversation.id,
      source_message_id: null,
      input_data: {
        source_channel: "whatsapp",
        content,
        from_number: from,
        destination: from,
        external_message_id: externalMessageId,
        inactivity_timer_id: activity.timer_id,
        inactivity_generation: activity.generation,
        inactivity_deadline_at: activity.deadline,
        last_activity_at: activity.conversation.last_activity_at,
        context_url: conversationContextUrl(),
        context_request: { conversation_id: conversation.id, organization_id: user.organization_id },
      },
    };
    const executionId = await createExecution(admin, envelope);
    await triggerWorkflow({ ...envelope, workflow_execution_id: executionId, action_type: "whatsapp_message" });
    return twiml();
  } catch (error) {
    console.error("twilio whatsapp inbound failed", error instanceof Error ? error.message : error);
    return twiml("No pude procesar tu mensaje. Inténtalo de nuevo en unos segundos.");
  }
});
