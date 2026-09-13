declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { cors } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    const { client } = await getAuthedClient(req);
    const [{ data: cases }, { data: approvals }, { data: followUps }, { data: workflows }] = await Promise.all([
      client.from("cases").select("id,case_number,title,status,priority,updated_at,requires_approval,requires_human").order("updated_at", { ascending: false }).limit(8),
      client.from("approvals").select("id,case_id,status,requested_at").eq("status", "pending").order("requested_at", { ascending: true }).limit(10),
      client.from("follow_ups").select("id,case_id,status,scheduled_for,reason").eq("status", "pending").order("scheduled_for", { ascending: true }).limit(10),
      client.from("workflow_definitions").select("id,code,name,is_active,updated_at").order("code").limit(12),
    ]);
    return Response.json({ cases: cases || 
      [], approvals: approvals || 
      [], follow_ups: followUps || 
      [], workflows: workflows || [] }, 
      { headers: cors(req) });
  } catch (error) { const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500; 
    return Response.json({ error: status === 401 ? "No autorizado" : "No se pudo cargar el dashboard" }, 
      { status, headers: cors(req) }); }
});
