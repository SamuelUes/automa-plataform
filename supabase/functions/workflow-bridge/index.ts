declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("N8N_INGRESS_SECRET");
  if (!secret || req.headers.get("x-prologistica-secret") !== secret) return Response.json({ error: "No autorizado" }, { status: 401, headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "POST requerido" }, { status: 405, headers: corsHeaders });
  try {
    const body = await req.json();
    if (!body.workflow_code || !body.workflow_execution_id || !body.organization_id) return Response.json({ error: "Contrato incompleto" }, 
      { status: 422, headers: corsHeaders });
      
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
    if (!supabaseUrl || !callbackSecret) throw new Error("CALLBACK_NOT_CONFIGURED");
    const callback = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/webhooks`, { 
      method: "POST", 
      headers: { "content-type": "application/json", "x-n8n-webhook-secret": callbackSecret }, 
      body: JSON.stringify(body) 
    });
    const result = await callback.json().catch(() => ({}));
    return Response.json(result, { status: callback.ok ? 200 : callback.status, headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo guardar el resultado" }, 
      { status: 500, headers: corsHeaders });
  }
});
