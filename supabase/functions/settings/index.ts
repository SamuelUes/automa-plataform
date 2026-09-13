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

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeWhatsAppPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[\s()-]/g, "");
  const digits = compact.replace(/^whatsapp:/i, "");
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  return `whatsapp:${normalized}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "No autorizado" },
        { status: 401, headers: cors(req) }
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
        { status: 401, headers: cors(req) }
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
        { status: 429, headers: cors(req) }
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
        { status: 403, headers: cors(req) }
      );
    }

    const organizationId = profile.organization_id;
    const body = await req.json().catch(() => ({}));
    const operation = body.operation || "get";
    const isOwner = profile.role === "owner";

    if (operation === "get") {
      const [organization, departments, users, conversations, cases, commands] = await Promise.all([
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
          .select("id,full_name,email,avatar_url,role,is_active,whatsapp_phone,auth_provider,department_id,created_at,updated_at")
          .eq("organization_id", organizationId)
          .order("full_name"),
        userClient
          .from("conversations")
          .select("id,case_id,title,status,updated_at")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false })
          .limit(100),
        userClient
          .from("cases")
          .select("id,case_number,title,status,updated_at")
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false })
          .limit(100),
        userClient
          .from("commands")
          .select("id,workflow_code,command_type,status,payload,idempotency_key,created_at,decision_id")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      // Fetch last_sign_in_at from auth.users via RPC to distinguish invited (never signed in) from active users.
      const userIds = (users.data || []).map((u: { id: string }) => u.id);
      const authMeta: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: signInData } = await adminClient.rpc("get_user_sign_in_times", {
          p_user_ids: userIds,
        });
        for (const row of (signInData as Array<{ id: string; last_sign_in_at: string | null }>) || []) {
          authMeta[row.id] = row.last_sign_in_at;
        }
      }

      const usersWithSignIn = (users.data || []).map((u: Record<string, unknown>) => ({
        ...u,
        last_sign_in_at: authMeta[u.id as string] || null,
      }));

      return Response.json(
        {
          profile,
          organization: organization.data,
          departments: departments.data || [],
          users: usersWithSignIn,
          conversations: conversations.data || [],
          cases: cases.data || [],
          commands: commands.data || [],
        },
        { headers: cors(req) }
      );
    }

    if (operation === "preferences") {
      if (!body.preferences || typeof body.preferences !== "object") {
        return Response.json(
          { error: "Preferencias no válidas." },
          { status: 422, headers: cors(req) }
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
      return Response.json({ settings: data?.settings }, { headers: cors(req) });
    }

    if (operation === "profile") {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

      if (fullName.length < 2 || fullName.length > 200) {
        return Response.json(
          { error: "El nombre debe tener entre 2 y 200 caracteres." },
          { status: 422, headers: cors(req) }
        );
      }

      const { data, error } = await userClient
        .from("users")
        .update({ full_name: fullName, avatar_url: body.avatar_url || null })
        .eq("id", user.id)
        .select("id,full_name,email,avatar_url,role,auth_provider,settings")
        .single();

      if (error) throw error;
      return Response.json({ profile: data }, { headers: cors(req) });
    }

    if (!isOwner) {
      return Response.json(
        { error: "No tienes permisos para administrar esta configuración." },
        { status: 403, headers: cors(req) }
      );
    }

    if (operation === "commands_get") {
      const workflowCode = typeof body.workflow_code === "string" ? body.workflow_code.trim().toUpperCase() : "";
      const status = typeof body.status === "string" ? body.status.trim() : "";
      let query = adminClient
        .from("commands")
        .select("id,organization_id,action_id,decision_id,workflow_code,command_type,payload,status,idempotency_key,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (workflowCode) query = query.eq("workflow_code", workflowCode);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return Response.json({ commands: data || [] }, { headers: cors(req) });
    }

    if (operation === "command_create") {
      const workflowCode = typeof body.workflow_code === "string" ? body.workflow_code.trim().toUpperCase() : "";
      const commandType = typeof body.command_type === "string" ? body.command_type.trim() : "PREPARE_EMAIL_DRAFT";
      const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : crypto.randomUUID();
      const inputData = body.input_data;
      const conversationId = typeof body.conversation_id === "string" && body.conversation_id ? body.conversation_id : null;
      const caseId = typeof body.case_id === "string" && body.case_id ? body.case_id : null;
      const supportedWorkflow = /^PE(?:0[1-9]|1[0-3])$/.test(workflowCode);

      if (!supportedWorkflow || !commandType || typeof inputData !== "object" || inputData === null || Array.isArray(inputData)) {
        return Response.json({ error: "Los datos del comando no son válidos." }, { status: 422, headers: cors(req) });
      }

      const draft = typeof (inputData as Record<string, unknown>).draft === "string"
        ? (inputData as Record<string, unknown>).draft as string
        : "";
      if (workflowCode === "PE03" && !draft.trim()) {
        return Response.json({ error: "PE03 requiere input_data.draft." }, { status: 422, headers: cors(req) });
      }

      if (conversationId) {
        const { data: conversation } = await adminClient
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!conversation) return Response.json({ error: "Conversación no encontrada en tu organización." }, { status: 404, headers: cors(req) });
      }

      if (caseId) {
        const { data: caseRow } = await adminClient
          .from("cases")
          .select("id")
          .eq("id", caseId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!caseRow) return Response.json({ error: "Caso no encontrado en tu organización." }, { status: 404, headers: cors(req) });
      }

      const { data: existing } = await adminClient
        .from("commands")
        .select("id,decision_id,workflow_code,command_type,payload,status,idempotency_key,created_at")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) return Response.json({ command: existing, duplicate: true }, { headers: cors(req) });

      const { data: decision, error: decisionError } = await adminClient
        .from("authority_decisions")
        .insert({
          organization_id: organizationId,
          case_id: caseId,
          conversation_id: conversationId,
          decision: "AUTO_ELIGIBLE",
          action_type: commandType,
          authorized: true,
          requires_approval: false,
          reason: "Comando creado por un administrador desde Settings.",
          evidence: { source: "settings", user_id: user.id, workflow_code: workflowCode },
          idempotency_key: `decision:${idempotencyKey}`,
        })
        .select("id")
        .single();
      if (decisionError) throw decisionError;

      const { data: command, error: commandError } = await adminClient
        .from("commands")
        .insert({
          organization_id: organizationId,
          decision_id: decision.id,
          workflow_code: workflowCode,
          command_type: commandType,
          payload: { conversation_id: conversationId, case_id: caseId, input_data: inputData },
          status: "created",
          idempotency_key: idempotencyKey,
        })
        .select("id,organization_id,decision_id,workflow_code,command_type,payload,status,idempotency_key,created_at")
        .single();
      if (commandError) throw commandError;

      return Response.json({ command, decision_id: decision.id }, { status: 201, headers: cors(req) });
    }

    if (operation === "whatsapp_phone") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const whatsappPhone = body.whatsapp_phone === null || body.whatsapp_phone === ""
        ? null
        : normalizeWhatsAppPhone(body.whatsapp_phone);
      if (!userId || (body.whatsapp_phone && !whatsappPhone)) {
        return Response.json({ error: "El número debe usar el formato whatsapp:+5215555555555." }, { status: 422, headers: cors(req) });
      }
      const { data: target } = await adminClient
        .from("users")
        .select("id,organization_id")
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!target) return Response.json({ error: "Usuario no encontrado en tu organización." }, { status: 404, headers: cors(req) });
      const { data, error } = await adminClient
        .from("users")
        .update({ whatsapp_phone: whatsappPhone })
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .select("id,whatsapp_phone")
        .single();
      if (error) {
        if (error.code === "23505") return Response.json({ error: "Ese número ya está asociado a otro usuario." }, { status: 409, headers: cors(req) });
        throw error;
      }
      return Response.json({ user: data }, { headers: cors(req) });
    }

    if (operation === "invite_user") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      const authProvider = typeof body.auth_provider === "string" ? body.auth_provider.trim().toLowerCase() : "email";

      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return Response.json(
          { error: "El correo de invitación no es válido." },
          { status: 422, headers: cors(req) }
        );
      }

      if (fullName.length > 0 && (fullName.length < 2 || fullName.length > 200)) {
        return Response.json(
          { error: "El nombre debe tener entre 2 y 200 caracteres." },
          { status: 422, headers: cors(req) }
        );
      }

      const { data: existingUser } = await adminClient
        .from("users")
        .select("id")
        .eq("email", email)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existingUser) {
        return Response.json(
          { error: "Ese correo ya pertenece a un usuario de tu organización." },
          { status: 409, headers: cors(req) }
        );
      }

      const origin = req.headers.get("Origin") || Deno.env.get("FRONTEND_ORIGIN")?.split(",")[0]?.trim() || "http://localhost:3000";
      const redirectTo = `${origin}/auth/callback?next=/accept-invite`;

      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          organization_id: organizationId,
          ...(fullName ? { full_name: fullName } : {}),
        },
      });

      if (error) {
        const message = error.message || "";
        if (message.includes("already") || message.includes("registered") || message.includes("exists") || message.includes("duplicate")) {
          return Response.json(
            { error: "Ya existe un usuario con ese correo." },
            { status: 409, headers: cors(req) }
          );
        }
        throw error;
      }

      // The handle_new_user trigger creates the public.users row from metadata.
      // Update auth_provider explicitly since the trigger doesn't set it.
      if (fullName || authProvider !== "email") {
        await adminClient
          .from("users")
          .update({ ...(fullName ? { full_name: fullName } : {}), auth_provider: authProvider })
          .eq("id", data.user.id);
      }

      return Response.json(
        { invited: true, user_id: data.user.id, full_name: fullName || null, auth_provider: authProvider },
        { status: 201, headers: cors(req) }
      );
    }

    if (operation === "organization") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";

      if (name.length < 2 || name.length > 200 || !/^[a-z0-9-]+$/.test(slug)) {
        return Response.json(
          { error: "Los datos de organización no son válidos." },
          { status: 422, headers: cors(req) }
        );
      }

      const { data, error } = await adminClient
        .from("organizations")
        .update({ name, slug, settings: body.settings || {} })
        .eq("id", organizationId)
        .select("id,name,slug,settings,is_active")
        .single();

      if (error) throw error;
      return Response.json({ organization: data }, { headers: cors(req) });
    }

    if (operation === "department") {
      const name = typeof body.name === "string" ? body.name.trim() : "";

      if (name.length < 2 || name.length > 120) {
        return Response.json(
          { error: "El departamento debe tener entre 2 y 120 caracteres." },
          { status: 422, headers: cors(req) }
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
      return Response.json({ department: data }, { headers: cors(req) });
    }

    if (operation === "user_role") {
      if (!body.user_id || !["owner", "admin", "manager", "agent", "viewer"].includes(body.role)) {
        return Response.json(
          { error: "Usuario o rol no válido." },
          { status: 422, headers: cors(req) }
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
      return Response.json({ user: data }, { headers: cors(req) });
    }

    if (operation === "user_delete") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";

      if (!userId) {
        return Response.json(
          { error: "Usuario no válido." },
          { status: 422, headers: cors(req) }
        );
      }

      // Prevent self-deletion
      if (userId === user.id) {
        return Response.json(
          { error: "No puedes eliminar tu propia cuenta." },
          { status: 422, headers: cors(req) }
        );
      }

      // Verify the target belongs to the caller's organization
      const { data: target } = await adminClient
        .from("users")
        .select("id,organization_id,role")
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (!target) {
        return Response.json(
          { error: "Usuario no encontrado en tu organización." },
          { status: 404, headers: cors(req) }
        );
      }

      // Delete from auth.users — ON DELETE CASCADE removes the public.users row automatically.
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      return Response.json({ deleted: true, user_id: userId }, { headers: cors(req) });
    }

    if (operation === "user_department") {
      const userId = typeof body.user_id === "string" ? body.user_id : "";
      const departmentId =
        typeof body.department_id === "string" && body.department_id
          ? body.department_id
          : null;

      if (!userId) {
        return Response.json(
          { error: "Usuario no válido." },
          { status: 422, headers: cors(req) }
        );
      }

      const { data: target } = await adminClient
        .from("users")
        .select("id,organization_id")
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!target) {
        return Response.json(
          { error: "Usuario no encontrado en tu organización." },
          { status: 404, headers: cors(req) }
        );
      }

      if (departmentId) {
        const { data: department } = await adminClient
          .from("departments")
          .select("id")
          .eq("id", departmentId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!department) {
          return Response.json(
            { error: "Departamento no encontrado en tu organización." },
            { status: 404, headers: cors(req) }
          );
        }
      }

      const { data, error } = await adminClient
        .from("users")
        .update({ department_id: departmentId })
        .eq("id", userId)
        .eq("organization_id", organizationId)
        .select("id,department_id")
        .single();

      if (error) throw error;
      return Response.json({ user: data }, { headers: cors(req) });
    }

    return Response.json(
      { error: "Operación no soportada" },
      { status: 422, headers: cors(req) }
    );
  } catch (error) {
    console.error("settings edge function error:", error);
    const message = error instanceof Error ? error.message : "No se pudo guardar la configuración.";
    return Response.json(
      { error: message },
      { status: 500, headers: cors(req) }
    );
  }
});
