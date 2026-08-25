declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const allowedOrigin = Deno.env.get("FRONTEND_ORIGIN") || "http://localhost:3000";

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Vary": "Origin",
};
