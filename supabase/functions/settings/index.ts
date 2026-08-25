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
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "No autorizado" },
        { status: 401, headers: corsHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "No autorizado" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: allowed } = await userClient.rpc("check_rate_limit", {
      p_key: `settings:${user.id}`,
      p_limit: 30,
      p_window_seconds: 60,
    });
    if (!allowed) {
      return Response.json(
        { error: "Demasiadas solicitudes. Inténtalo de nuevo en un momento." },
        { status: 429, headers: corsHeaders }
      );
    }

    const { data: profile } = await userClient
      .from("users")
      .select("id,organization_id,full_name,email,avatar_url,role,settings,is_active")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return Response.json(
        { error: "Tu cuenta aún no ha sido configurada." },
        { status: 403, headers: corsHeaders }
      );
    }

    const organizationId = profile.organization_id;
    const body = await req.json().catch(() => ({}));
    const operation = body.operation || "get";
    const isAdmin = profile.role === "owner" || profile.role === "admin";

    if (operation === "get") {
      const [organization, departments, users] = await Promise.all([
        userClient
          .from("organizations")
          .select("id,name,slug,settings,is_active,created_at,updated_at")
          .eq("id", organizationId)
          .single(),
        userClient
          .from("departments")
          .select("id,name,description,is_active,created_at,updated_at")
          .eq("organization_id", organizationId)
          .order("name"),
        userClient
          .from("users")
          .select("id,full_name,email,avatar_url,role,is_active,created_at,updated_at")
          .eq("organization_id", organizationId)
          .order("full_name"),
      ]);

      return Response.json(
        {
          profile,
          organization: organization.data,
          departments: departments.data || [],
          users: users.data || [],
        },
        { headers: corsHeaders }
      );
    }

    if (operation === "preferences") {
      if (!body.preferences || typeof body.preferences !== "object") {
        return Response.json(
          { error: "Preferencias no válidas." },
          { status: 422, headers: corsHeaders }
        );
      }

      const { data: current } = await userClient
        .from("users")
        .select("settings")
        .eq("id", user.id)
        .single();
      const currentSettings = current?.settings && typeof current.settings === "object" ? current.settings : {};
      const { data, error } = await userClient
        .from("users")
        .update({ settings: { ...currentSettings, notifications: body.preferences } })
        .eq("id", user.id)
        .select("id,settings")
        .single();

      if (error) throw error;
      return Response.json({ settings: data?.settings }, { headers: corsHeaders });
    }

    if (operation === "profile") {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

      if (fullName.length < 2 || fullName.length > 200) {
        return Response.json(
          { error: "El nombre debe tener entre 2 y 200 caracteres." },
          { status: 422, headers: corsHeaders }
        );
      }

      const { data, error } = await userClient
        .from("users")
        .update({ full_name: fullName, avatar_url: body.avatar_url || null })
        .eq("id", user.id)
        .select("id,full_name,email,avatar_url,role,settings")
        .single();

      if (error) throw error;
      return Response.json({ profile: data }, { headers: corsHeaders });
    }

    if (!isAdmin) {
      return Response.json(
        { error: "No tienes permisos para administrar esta configuración." },
        { status: 403, headers: corsHeaders }
      );
    }

    if (operation === "invite_user") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return Response.json(
          { error: "El correo de invitación no es válido." },
          { status: 422, headers: corsHeaders }
        );
      }

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          organization_id: organizationId,
        },
      });

      if (error) throw error;
      return Response.json(
        { invited: true, user_id: data.user.id },
        { status: 201, headers: corsHeaders }
      );
    }

    if (operation === "organization") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";

      if (name.length < 2 || name.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
        return Response.json(
          { error: "Los datos de organización no son válidos." },
          { status: 422, headers: corsHeaders }
        );
      }

      const { data, error } = await adminClient
        .from("organizations")
        .update({ name, slug, settings: body.settings || {} })
        .eq("id", organizationId)
        .select("id,name,slug,settings,is_active")
        .single();

      if (error) throw error;
      return Response.json({ organization: data }, { headers: corsHeaders });
    }

    if (operation === "department") {
      const name = typeof body.name === "string" ? body.name.trim() : "";

      if (name.length < 2 || name.length > 120) {
        return Response.json(
          { error: "El departamento debe tener entre 2 y 120 caracteres." },
          { status: 422, headers: corsHeaders }
        );
      }

      const payload = {
        name,
        description: typeof body.description === "string" ? body.description.trim() : null,
        organization_id: organizationId,
      };
      const query = body.id
        ? adminClient.from("departments").update(payload).eq("id", body.id).eq("organization_id", organizationId)
        : adminClient.from("departments").insert(payload);
      const { data, error } = await query.select("id,name,description,is_active,created_at,updated_at").single();

      if (error) throw error;
      return Response.json({ department: data }, { headers: corsHeaders });
    }

    if (operation === "user_role") {
      if (!body.user_id || !["owner", "admin", "manager", "agent", "viewer"].includes(body.role)) {
        return Response.json(
          { error: "Usuario o rol no válido." },
          { status: 422, headers: corsHeaders }
        );
      }

      const { data, error } = await adminClient
        .from("users")
        .update({ role: body.role, is_active: body.is_active !== false })
        .eq("id", body.user_id)
        .eq("organization_id", organizationId)
        .select("id,full_name,email,role,is_active")
        .single();

      if (error) throw error;
      return Response.json({ user: data }, { headers: corsHeaders });
    }

    return Response.json(
      { error: "Operación no soportada" },
      { status: 422, headers: corsHeaders }
    );
  } catch {
    return Response.json(
      { error: "No se pudo guardar la configuración." },
      { status: 500, headers: corsHeaders }
    );
  }
});
