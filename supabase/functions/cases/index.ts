declare const Deno: { serve(handler: (request: Request) => Response | Promise<Response>): void };

import { corsHeaders } from "../_shared/cors.ts";
import { getAuthedClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { client } = await getAuthedClient(req);
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
    let query = client.from("cases").select("id,case_number,title,description,status,priority,contact_id,department_id,assigned_to,source,requires_approval,requires_human,created_at,updated_at", { count: "exact" }).order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
    const status = url.searchParams.get("status"); const priority = url.searchParams.get("priority"); const search = url.searchParams.get("q");
    if (status && status !== "all") query = query.eq("status", status);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error, count } = await query;
    if (error) throw error;
    return Response.json({ data, count, limit, offset }, { headers: corsHeaders });
  } catch (error) { const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500; return Response.json({ error: status === 401 ? "No autorizado" : "No se pudieron cargar los casos" }, { status, headers: corsHeaders }); }
});
