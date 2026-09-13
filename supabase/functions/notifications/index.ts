declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return Response.json({ error: "No autorizado" }, { status: 401, headers: cors(req) });
    }

    const body = await req.json().catch(() => ({}));

    if (body.operation === "mark_read" && body.id) {
      const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id);
      if (error) throw error;
      return Response.json({ success: true }, { headers: cors(req) });
    }

    if (body.operation === "mark_all_read") {
      const { data: profile } = await client.from("users").select("organization_id").eq("id", user.id).single();
      if (!profile) return Response.json({ error: "Usuario sin organización" }, 
        { status: 403, headers: cors(req) });
      const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("organization_id", profile.organization_id).or(`user_id.eq.${user.id},user_id.is.null`).is("read_at", null);
      if (error) throw error;
      return Response.json({ success: true }, { headers: cors(req) });
    }

    const { data, error } = await client.from("notifications").select("id,organization_id,user_id,notification_type,title,body,entity_type,entity_id,metadata,read_at,created_at").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return Response.json({ data: data || [] }, { headers: cors(req) });
  } catch {
    return Response.json({ error: "No se pudieron cargar las notificaciones" }, 
      { status: 500, headers: cors(req) });
  }
});
