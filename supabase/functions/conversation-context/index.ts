declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isUuid } from "../_shared/integration.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expectedSecret = Deno.env.get("N8N_INGRESS_SECRET");
  if (!expectedSecret || req.headers.get("x-prologistica-secret") !== expectedSecret) {
    return Response.json({ error: "Contexto no autorizado" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const conversationId = body.conversation_id;
    const organizationId = body.organization_id;
    const caseId = body.case_id || null;
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);

    if (!isUuid(conversationId) || !isUuid(organizationId) || (caseId && !isUuid(caseId))) {
      return Response.json({ error: "conversation_id y organization_id son obligatorios" }, { status: 422, headers: corsHeaders });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("SUPABASE_ADMIN_NOT_CONFIGURED");
    const admin = createClient(url, serviceKey);

    const conversationQuery = admin
      .from("conversations")
      .select("id,organization_id,case_id,conversation_type,status,context,pending_intent,last_activity_at,inactivity_generation")
      .eq("id", conversationId)
      .eq("organization_id", organizationId);
    const { data: conversation, error: conversationError } = await conversationQuery.maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation || (caseId && conversation.case_id !== caseId)) {
      return Response.json({ error: "Conversación no encontrada" }, { status: 404, headers: corsHeaders });
    }

    const { data: messages, error: messagesError } = await admin
      .from("messages")
      .select("id,conversation_id,user_id,sender_type,role,channel,content,content_json,metadata,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (messagesError) throw messagesError;

    type CaseContext = {
      case_number: number;
      title: string;
      status: string;
      priority: string;
      updated_at: string;
    };
    const { data: cases, error: casesError } = await admin
      .from("cases")
      .select("id,case_number,title,status,priority,updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (casesError) throw casesError;

    return Response.json({
      conversation,
      messages: (messages || []).reverse(),
      cases: ((cases || []) as CaseContext[]).map((item) => ({ case_number: item.case_number, title: item.title, status: item.status, priority: item.priority, updated_at: item.updated_at })),
      instructions: "Al mencionar casos, usa siempre title y case_number; no muestres UUIDs ni identifiques casos solo por id.",
    }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo cargar el contexto" }, { status: 500, headers: corsHeaders });
  }
});
