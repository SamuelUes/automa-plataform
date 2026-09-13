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
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(req) });
  }

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json(
        { error: "El correo no es válido." },
        { status: 422, headers: cors(req) }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 422, headers: cors(req) }
      );
    }

    if (password.length > 128) {
      return Response.json(
        { error: "La contraseña no puede exceder 128 caracteres." },
        { status: 422, headers: cors(req) }
      );
    }

    // Verify the email belongs to an invited user in public.users.
    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("id,organization_id,email,full_name")
      .eq("email", email)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return Response.json(
        { error: "Este correo no tiene una invitación pendiente. Contacta a tu administrador." },
        { status: 404, headers: cors(req) }
      );
    }

    // Set the password on the auth user.
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      profile.id,
      { password }
    );

    if (updateError) {
      const message = updateError.message || "";
      if (message.includes("password") && message.includes("weak")) {
        return Response.json(
          { error: "La contraseña es demasiado débil. Usa una combinación de letras, números y símbolos." },
          { status: 422, headers: cors(req) }
        );
      }
      throw updateError;
    }

    return Response.json(
      { accepted: true, email: profile.email, full_name: profile.full_name },
      { headers: cors(req) }
    );
  } catch (error) {
    console.error("accept-invite edge function error:", error);
    const message = error instanceof Error ? error.message : "No se pudo completar el registro.";
    return Response.json(
      { error: message },
      { status: 500, headers: cors(req) }
    );
  }
});
