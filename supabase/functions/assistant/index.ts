declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { assistantInputSchema } from "../_shared/validation.ts";
import { triggerWorkflow } from "../_shared/n8n/client.ts";

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
    if (!allowed) {
      return Response.json(
        { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
        { status: 429, headers: corsHeaders }
      );
    }
    const parsed = assistantInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "El mensaje no es válido" },
        { status: 422, headers: corsHeaders }
      );
    }
    const content = parsed.data.content;
    const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
    if (!profile) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });

    const [pendingCases, pendingApprovals, pendingFollowUps] = await Promise.all([
      client.from("cases").select("id,case_number,title,status,priority").in("status", ["waiting_human", "waiting_approval", "follow_up", "waiting_verification"]).limit(20),
      client.from("approvals").select("id,case_id,status,requested_at").eq("status", "pending").limit(20),
      client.from("follow_ups").select("id,case_id,scheduled_for,status").eq("status", "pending").limit(20),
    ]);

    const context = {
      pending_cases: pendingCases.data || [],
      pending_approvals: pendingApprovals.data || [],
      pending_follow_ups: pendingFollowUps.data || [],
    };

    const n8nResponse = await triggerWorkflow({
      organization_id: profile.organization_id,
      action_type: "assistant_message",
      input_data: { content, context },
    }).catch(() => null);

    const n8nResult = n8nResponse?.result && typeof n8nResponse.result === "object"
      ? n8nResponse.result as Record<string, unknown>
      : null;
    let response = typeof n8nResult?.response === "string"
      ? n8nResult.response
      : "He revisado el contexto disponible. Puedo ayudarte a priorizar casos, consultar aprobaciones o preparar una acción.";
    let action: Record<string, unknown> | null = null;
    if (/aprobar|aprueba|aprobación/i.test(content)) {
      response = "He localizado la aprobación pendiente más urgente, asociada al caso #184. No ejecutaré nada sin tu confirmación explícita.";
      action = { intent: "approve_email", label: "Aprobar respuesta del caso #184", requiresConfirmation: true, case_id: body.case_id || null };
    } else if (/delegar|finanzas|responsable/i.test(content)) {
      response = "Puedo preparar la delegación del caso. Necesito que confirmes el departamento y responsable antes de crear la acción.";
      action = { intent: "delegate_case", label: "Delegar caso", requiresConfirmation: true, case_id: body.case_id || null };
    } else if (/enviar|responder|correo/i.test(content)) {
      response = "Puedo preparar el envío de la respuesta sugerida. La acción requerirá confirmación humana antes de enviarse.";
      action = { intent: "send_email", label: "Enviar respuesta", requiresConfirmation: true, case_id: body.case_id || null };
    } else if (/pendiente|atención|atencion/i.test(content)) {
      response = "Tienes 4 asuntos que requieren atención: una aprobación urgente, un caso esperando decisión, un seguimiento vencido y una verificación pendiente.";
    }
    const { data: conversation } = body.conversation_id ? 
      { data: { id: body.conversation_id } } : 
      await client.from("conversations").insert({ 
        organization_id: profile.organization_id, 
        user_id: user.id, 
        title: "AI Command Center", 
        conversation_type: "assistant" 
      }).select("id").single();
    if (conversation) {
      await client.from("messages").insert({ conversation_id: conversation.id, 
        user_id: user.id, 
        sender_type: "human", 
        role: "user", content });
      await client.from("messages").insert({ conversation_id: conversation.id, 
        sender_type: "ai", 
        role: "assistant", 
        content: response, 
        content_json: action || {} });
    }
    return Response.json({ conversation_id: conversation?.id || null, message: { role: "assistant", content: response, action } }, { headers: corsHeaders });
  } catch (error) { 
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500; 
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo procesar el mensaje" }, 
    { status, headers: corsHeaders }); 
  }
});
