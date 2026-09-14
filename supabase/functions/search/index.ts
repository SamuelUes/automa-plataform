declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>
  ): void;
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
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return Response.json(
        { error: "No autorizado" },
        { status: 401, headers: cors(req) }
      );
    }

    const body = await req.json().catch(() => ({}));
    const term = typeof body.query === "string" ? body.query.trim() : "";

    if (term.length < 2 || term.length > 120) {
      return Response.json(
        { data: [] },
        { headers: cors(req) }
      );
    }

    const { data: profile } = await client
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const isAgent = profile?.role === "agent";
    let assignedCaseIds: string[] | null = null;

    if (isAgent) {
      const { data: assignedCases } = await client
        .from("cases")
        .select("id")
        .eq("assigned_to", user.id);
      assignedCaseIds = (assignedCases || []).map((item: { id: string }) => item.id);
    }

    const pattern = `%${term}%`;
    const casesQuery = client
      .from("cases")
      .select("id,case_number,title,status,priority,updated_at")
      .or(`title.ilike.${pattern},source_id.ilike.${pattern}`)
      .limit(8);
    const emailsQuery = client
      .from("emails")
      .select("id,subject,sender,received_at,case_id")
      .or(`subject.ilike.${pattern},body_text.ilike.${pattern}`)
      .limit(8);
    const actionsQuery = client
      .from("actions")
      .select("id,action_type,status,created_at,case_id")
      .ilike("action_type", pattern)
      .limit(8);

    if (isAgent) {
      const ids = assignedCaseIds || [];
      if (ids.length) {
        casesQuery.in("id", ids);
        emailsQuery.in("case_id", ids);
        actionsQuery.in("case_id", ids);
      } else {
        const emptyId = "00000000-0000-0000-0000-000000000000";
        casesQuery.eq("id", emptyId);
        emailsQuery.eq("case_id", emptyId);
        actionsQuery.eq("case_id", emptyId);
      }
    }

    const [cases, emails, contacts, actions] = await Promise.all([
      casesQuery,
      emailsQuery,
      client.from("contacts").select("id,name,email,company,updated_at").or(`name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`).limit(8),
      actionsQuery,
    ]);

    return Response.json(
      {
        data: {
          cases: cases.data || [],
          emails: emails.data || [],
          contacts: contacts.data || [],
          actions: actions.data || [],
        },
      },
      { headers: cors(req) }
    );
  } catch {
    return Response.json(
      { error: "No se pudo completar la búsqueda" },
      { status: 500, headers: cors(req) }
    );
  }
});
