declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";
import { getWorkflowExecution, triggerWorkflow } from "../_shared/n8n/client.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client, user } = await getAuthedClient(req);
    const body = await req.json().catch(() => ({}));
    const profile = await client.from("users").select("organization_id,role").eq("id", user.id).single();
   
    if (!profile.data) return Response.json({ error: "Usuario sin organización" }, { status: 403, headers: corsHeaders });
   
    if (req.method === "GET" || body.operation === "list") {
      const { data, error } = await client.from("workflow_definitions").select("id,code,name,description,n8n_workflow_id,version,is_active,configuration,created_at,updated_at").order("code");
      if (error) throw error;
      return Response.json({ data: data || [] }, { headers: corsHeaders });
    }
    if (body.execution_id) return Response.json({ data: await getWorkflowExecution(body.execution_id) }, { headers: corsHeaders });
    if (!body.workflow_code && !body.action_id) return Response.json({ error: "workflow_code o action_id requerido" }, 
      { status: 422, headers: corsHeaders });
    
    const payload = { action_id: body.action_id, organization_id: profile.data.organization_id, 
      case_id: body.case_id || null, action_type: body.action_type || "execute_workflow", workflow_code: body.workflow_code, input_data: body.input_data || {} };
    
    const result = await triggerWorkflow(payload);
    
    if (body.action_id) {
      await client.from("actions").update({ status: "queued", n8n_execution_id: result.execution_id || null }).eq("id", body.action_id);
    }
    
    return Response.json({ data: result }, { status: 202, headers: corsHeaders });
  } 
  catch (error) { 
    const message = error instanceof Error && error.message === "UNAUTHORIZED" ? "No autorizado" : error instanceof Error && error.message.includes("N8N") ? 
    "La integración con n8n no está disponible" : "No se pudo procesar el workflow"; 
    return Response.json({ error: message }, 
      { status: message === "No autorizado" ? 401 : 500, headers: corsHeaders }); }
});
